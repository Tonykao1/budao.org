/*
 * Tongdao real-time clock + mobile audio recovery fix.
 * Mobile browsers may pause timers and interrupt Web Audio while the screen is
 * locked or the page is backgrounded. Time is derived from wall-clock values,
 * and the warmup audio engine is resumed/rebuilt when the page becomes active.
 */

(function installTongdaoRealTimeClocks() {
  const WARMUP_BEAT_MS = 500;
  const WARMUP_ROUNDS_PER_PART = 4;
  const WARMUP_BEATS_PER_ROUND = 8;

  function getAudioContextConstructor() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function createAudioContext() {
    const AudioContext = getAudioContextConstructor();
    if (!AudioContext) return null;

    try {
      const context = new AudioContext({ latencyHint: "interactive" });
      state.audioContext = context;
      return context;
    } catch (error) {
      return null;
    }
  }

  async function resumeAudioContext(context) {
    if (!context || context.state === "closed") return null;

    if (context.state !== "running") {
      try {
        await context.resume();
      } catch (error) {
        return null;
      }
    }

    return context.state === "running" ? context : null;
  }

  async function rebuildAudioContext() {
    const previous = state.audioContext;
    state.audioContext = null;

    if (previous && previous.state !== "closed") {
      try {
        await previous.close();
      } catch (error) {
        // Some mobile browsers refuse to close an interrupted context.
      }
    }

    const replacement = createAudioContext();
    return resumeAudioContext(replacement);
  }

  async function recoverAudioContext({ rebuildIfNeeded = true } = {}) {
    if (document.hidden) return null;

    if (state.audioRecoveryPromise) {
      return state.audioRecoveryPromise;
    }

    state.audioRecoveryPromise = (async () => {
      let context = state.audioContext;
      if (!context || context.state === "closed") {
        context = createAudioContext();
      }

      let ready = await resumeAudioContext(context);
      if (!ready && rebuildIfNeeded) {
        ready = await rebuildAudioContext();
      }

      return ready;
    })();

    try {
      return await state.audioRecoveryPromise;
    } finally {
      state.audioRecoveryPromise = null;
    }
  }

  function emitTone(context, { frequency, volume, duration = 0.09, endFrequency = null }) {
    if (!context || context.state !== "running") return false;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + Math.min(0.05, duration));
      }

      gain.gain.setValueAtTime(Math.max(0.001, volume), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.01);
      return true;
    } catch (error) {
      return false;
    }
  }

  function scheduleTone(options) {
    if (document.hidden) return;

    const context = state.audioContext;
    if (context && context.state === "running" && emitTone(context, options)) {
      return;
    }

    recoverAudioContext().then((readyContext) => {
      if (!document.hidden && readyContext) {
        emitTone(readyContext, options);
      }
    });
  }

  playBeat = function playBeatWithRecovery(strong) {
    scheduleTone({
      frequency: strong ? 760 : 560,
      volume: strong ? 0.12 : 0.06,
      duration: 0.08
    });
  };

  playChime = function playChimeWithRecovery() {
    scheduleTone({
      frequency: 980,
      endFrequency: 1320,
      volume: 0.16,
      duration: 0.22
    });
  };

  function syncActiveClocks() {
    if (typeof state.timerSync === "function") {
      state.timerSync();
    }
    if (typeof state.warmupSync === "function") {
      state.warmupSync();
    }
  }

  function recoverWarmupAudio() {
    if (document.hidden || !state.warmupStarted || !state.warmupStartedAt) return;

    recoverAudioContext().then((context) => {
      if (!context || document.hidden || !state.warmupStarted || !state.warmupStartedAt) return;

      // A nearly silent probe forces the restored output path to become active
      // without adding an extra audible beep at an arbitrary point in the beat.
      emitTone(context, {
        frequency: 440,
        volume: 0.001,
        duration: 0.025
      });
    });
  }

  function restoreFromForeground() {
    syncActiveClocks();
    recoverWarmupAudio();
  }

  startTimer = function startTimerRealTime(seconds, onDone) {
    stopTimer();

    const durationMs = Math.max(0, Number(seconds) || 0) * 1000;
    state.timerEndAt = Date.now() + durationMs;
    state.timerRemaining = Math.ceil(durationMs / 1000);
    state.timerOnDone = typeof onDone === "function" ? onDone : null;

    const sync = () => {
      if (!state.timerEndAt) return;

      const remainingMs = Math.max(0, state.timerEndAt - Date.now());
      state.timerRemaining = Math.ceil(remainingMs / 1000);
      updateTimer();

      if (remainingMs <= 0) {
        const done = state.timerOnDone;
        stopTimer();
        if (done) done();
      }
    };

    state.timerSync = sync;
    updateTimer();
    state.timer = window.setInterval(sync, 250);
    sync();
  };

  stopTimer = function stopTimerRealTime() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
    state.timerEndAt = 0;
    state.timerOnDone = null;
    state.timerSync = null;
  };

  startWarmup = function startWarmupRealTime() {
    stopWarmup();
    state.warmupStarted = true;
    state.warmupStartedAt = Date.now();
    state.warmupLastBeatIndex = -1;
    state.warmupPartIndex = 0;
    state.warmupRound = 1;
    state.warmupBeat = 1;

    // startWarmup is called from a user tap, so prime Web Audio here while the
    // browser still has a user activation. This greatly improves iOS recovery.
    recoverAudioContext({ rebuildIfNeeded: true });

    const button = screen.querySelector('[data-action="primary"]');
    if (button) button.disabled = true;

    const totalBeats = getWarmupParts().length * WARMUP_ROUNDS_PER_PART * WARMUP_BEATS_PER_ROUND;

    const sync = () => {
      if (!state.warmupStartedAt) return;

      const elapsedMs = Math.max(0, Date.now() - state.warmupStartedAt);
      const beatIndex = Math.floor(elapsedMs / WARMUP_BEAT_MS);

      if (beatIndex >= totalBeats) {
        finishWarmup();
        return;
      }

      const beatsPerPart = WARMUP_ROUNDS_PER_PART * WARMUP_BEATS_PER_ROUND;
      const previousPart = state.warmupPartIndex;
      const partIndex = Math.floor(beatIndex / beatsPerPart);
      const beatWithinPart = beatIndex % beatsPerPart;
      const round = Math.floor(beatWithinPart / WARMUP_BEATS_PER_ROUND) + 1;
      const beat = (beatWithinPart % WARMUP_BEATS_PER_ROUND) + 1;
      const changed = beatIndex !== state.warmupLastBeatIndex;

      state.warmupPartIndex = partIndex;
      state.warmupRound = round;
      state.warmupBeat = beat;

      if (changed) {
        const partChanged = previousPart !== partIndex;
        if (!document.hidden) {
          playBeat(beat === 1);
          if (partChanged && beat === 1) playChime();
        }
        state.warmupLastBeatIndex = beatIndex;
      }

      renderWarmupProgress();
    };

    state.warmupSync = sync;
    state.warmupTimer = window.setInterval(sync, 125);
    sync();
  };

  stopWarmup = function stopWarmupRealTime() {
    if (state.warmupTimer) {
      window.clearInterval(state.warmupTimer);
      state.warmupTimer = null;
    }
    state.warmupStartedAt = 0;
    state.warmupLastBeatIndex = -1;
    state.warmupSync = null;
  };

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) restoreFromForeground();
  });
  window.addEventListener("pageshow", restoreFromForeground);
  window.addEventListener("focus", restoreFromForeground);

  // If a particular mobile browser still insists on a fresh gesture after an
  // interruption, the user's first normal touch restores audio silently. No
  // extra recovery button or restart is required.
  ["pointerdown", "touchend", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      if (!document.hidden && state.warmupStarted && state.warmupStartedAt) {
        recoverAudioContext({ rebuildIfNeeded: true });
      }
    }, { passive: true });
  });
})();

/* Load the reviewed-Dao adapter after the existing Tongdao runtime is ready. */
(function loadReviewedDaoBridge() {
  function loadScript(src, onDone) {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = onDone;
    document.head.appendChild(script);
  }

  loadScript("/tongdao-dao-adapter.js?v=20260907-1", function () {
    loadScript("/tongdao-dao-bridge.js?v=20260907-1", function () {});
  });
}());
