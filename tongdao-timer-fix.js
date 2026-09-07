/*
 * Tongdao real-time clock fix.
 * Mobile browsers may pause setInterval while the screen is locked or the
 * page is backgrounded. Timers below are derived from wall-clock timestamps
 * so they catch up immediately when the page becomes active again.
 */

(function installTongdaoRealTimeClocks() {
  const WARMUP_BEAT_MS = 500;
  const WARMUP_ROUNDS_PER_PART = 4;
  const WARMUP_BEATS_PER_ROUND = 8;

  function syncActiveClocks() {
    if (typeof state.timerSync === "function") {
      state.timerSync();
    }
    if (typeof state.warmupSync === "function") {
      state.warmupSync();
    }
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

  document.addEventListener("visibilitychange", syncActiveClocks);
  window.addEventListener("pageshow", syncActiveClocks);
  window.addEventListener("focus", syncActiveClocks);
})();
