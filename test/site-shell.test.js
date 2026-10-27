const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const home = fs.readFileSync(path.join(root, "home.html"), "utf8");
const campfire = fs.readFileSync(path.join(root, "yhzd.html"), "utf8");

test("campfire page reuses the standard site navigation", () => {
  assert.match(campfire, /<link rel="stylesheet" href="style\.css" \/>/);

  const nav = campfire.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i)?.[1] || "";
  const expectedLinks = [
    ["/home.html", "首页"],
    ["/test.html", "步道"],
    ["/tongxing.html", "童行"],
    ["/tongdao.html", "同道"],
    ["/what.html", "同工"],
    ["/tonglu.html", "牧场"]
  ];

  let previousIndex = -1;
  for (const [href, label] of expectedLinks) {
    const index = nav.indexOf(`href="${href}"`);
    assert.ok(index > previousIndex, `navigation keeps ${label} in the standard order`);
    assert.ok(nav.includes(`>${label}</a>`));
    previousIndex = index;
  }
});

function createPlaybackHarness(randomValue = 0) {
  const playlistSource = home.match(/const playlist = \[([\s\S]*?)\];/)?.[1] || "";
  const tracks = [...playlistSource.matchAll(/"([^"]+\.mp3)"/g)].map((match) => match[1]);
  const script = home.match(/<script>([\s\S]*?)<\/script>/i)?.[1] || "";
  const listeners = new Map();
  const buttons = Object.fromEntries(["playBtn", "nextBtn", "prevBtn", "dspBtn"].map((id) => [id, {
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    addEventListener(type, listener) { listeners.set(`${id}:${type}`, listener); }
  }]));

  class AudioStub {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.loadCount = 0;
      this.listeners = new Map();
      this.paused = true;
      this.ended = false;
      this.defaultPlaybackRate = 1;
      this.playbackRate = 1;
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type, listener) { if(this.listeners.get(type)===listener) this.listeners.delete(type); }
    load() { this.loadCount += 1; this.currentTime = 0; this.ended = false; }
    pause() { this.paused = true; const fn=this.listeners.get("pause"); if(fn) fn(); }
    play() { this.paused = false; this.ended = false; const fn=this.listeners.get("play"); if(fn) fn(); return Promise.resolve(); }
  }

  const context = {
    Audio: AudioStub,
    Math: Object.create(Math),
    MediaMetadata: class {},
    navigator: { mediaSession: {} },
    document: { getElementById: (id) => buttons[id], addEventListener() {}, hidden: false },
    fetch: async () => ({ ok: true, json: async () => ({ system: "余 DSP Reference B", tracks: {} }) }),
    performance: { now: () => 0 },
    console,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: () => 1,
    clearTimeout() {},
    addEventListener() {}
  };
  context.window = context;
  context.Math.random = () => randomValue;
  vm.runInNewContext(`${script}\n;globalThis.playback = {\n` +
    "  audio, playlist, get currentTrack() { return currentTrack; }\n};", context);

  return {
    audio: context.playback.audio,
    tracks,
    get currentTrack() { return context.playback.currentTrack; },
    click(id) { listeners.get(`${id}:click`)(); },
    endTrack() { context.playback.audio.listeners.get("ended")(); }
  };
}

test("home playback randomizes the first start between the two Silent Night tracks", () => {
  const first = createPlaybackHarness(0);
  first.click("playBtn");
  assert.equal(first.currentTrack, 0);
  assert.equal(first.audio.src, "music/14 Silent Night.mp3");

  const second = createPlaybackHarness(0.999);
  second.click("playBtn");
  assert.equal(second.currentTrack, 10);
  assert.equal(second.audio.src, "music/12 Silent Night_Klusa Nakts.mp3");
});

test("home playback resumes without resetting the current track", () => {
  const player = createPlaybackHarness(0);
  player.click("playBtn");
  player.click("nextBtn");
  player.audio.currentTime = 23;
  player.click("playBtn");
  player.click("playBtn");

  assert.equal(player.currentTrack, 1);
  assert.equal(player.audio.currentTime, 23);
  assert.equal(player.audio.loadCount, 2);
});

for (const skipControl of ["nextBtn", "prevBtn"]) {
  test(`home playback resumes after the first start from ${skipControl}`, () => {
    const player = createPlaybackHarness(0);
    player.click(skipControl);
    const trackAfterSkip = player.currentTrack;
    const loadCountAfterSkip = player.audio.loadCount;
    player.audio.currentTime = 23;

    player.click("playBtn");
    player.click("playBtn");

    assert.equal(player.currentTrack, trackAfterSkip);
    assert.equal(player.audio.currentTime, 23);
    assert.equal(player.audio.loadCount, loadCountAfterSkip);
  });
}

test("home playback wraps right, left, and ended across the full playlist", () => {
  const player = createPlaybackHarness(0);
  player.click("playBtn");

  player.click("prevBtn");
  assert.equal(player.currentTrack, player.tracks.length - 1);
  player.click("nextBtn");
  assert.equal(player.currentTrack, 0);

  player.click("prevBtn");
  player.endTrack();
  assert.equal(player.currentTrack, 0);
});


function createDspPlaybackHarness(options = {}) {
  const script = home.match(/<script>([\s\S]*?)<\/script>/i)?.[1] || "";
  const loudnessMap = JSON.parse(fs.readFileSync(path.join(root, "music/music.json"), "utf8"));
  const listeners = new Map();
  const contexts = [];
  const pendingResumes = [];
  const controls = Object.fromEntries(["playBtn", "nextBtn", "prevBtn", "dspBtn"].map((id) => [id, {
    attributes: {},
    classList: { toggle() {}, remove() {}, add() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, handler) { listeners.set(id + ":" + type, handler); }
  }]));

  class TestAudio {
    constructor(src) {
      this.src = src;
      this.paused = true;
      this.ended = false;
      this.currentTime = 0;
      this.duration = 180;
      this.readyState = 1;
      this.defaultPlaybackRate = 1;
      this.playbackRate = 1;
      this.listeners = new Map();
    }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    removeEventListener(type, fn) {
      if (this.listeners.get(type) === fn) this.listeners.delete(type);
    }
    emit(type) { this.listeners.get(type)?.(); }
    load() { this.currentTime = 0; this.emit("loadedmetadata"); }
    play() { this.paused = false; this.ended = false; this.emit("play"); return Promise.resolve(); }
    pause() { this.paused = true; this.emit("pause"); }
  }

  class TestParam {
    constructor(value = 1) { this.value = value; }
    cancelScheduledValues() {}
    setValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
  }
  class TestNode {
    constructor() {
      this.gain = new TestParam();
      this.frequency = new TestParam();
      this.Q = new TestParam();
    }
    connect(destination) { return destination; }
  }
  class TestAudioContext {
    constructor() {
      this.state = options.resumeFails || options.deferResume ? "suspended" : "running";
      this.currentTime = 0;
      this.destination = new TestNode();
      contexts.push(this);
    }
    createMediaElementSource(media) {
      if (media.attachedToWebAudio) throw new Error("MediaElement already attached");
      media.attachedToWebAudio = true;
      return new TestNode();
    }
    createGain() { return new TestNode(); }
    createBiquadFilter() { return new TestNode(); }
    async resume() {
      if (options.resumeFails) throw new Error("Simulated AudioContext resume rejection");
      if (options.deferResume) {
        await new Promise((resolve) => pendingResumes.push(resolve));
      }
      this.state = "running";
    }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  const navigator = {
    userAgent: options.safari
      ? "Mozilla/5.0 Macintosh AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15"
      : "Mozilla/5.0 Chrome/125.0 AppleWebKit/537.36 Safari/537.36",
    maxTouchPoints: 0,
    mediaSession: { setActionHandler() {}, setPositionState() {} }
  };
  const environment = {
    Audio: TestAudio,
    AudioContext: TestAudioContext,
    MediaMetadata: class {},
    Math: Object.create(Math),
    navigator,
    document: { getElementById: (id) => controls[id], addEventListener() {}, hidden: false },
    fetch: async () => ({ ok: true, json: async () => loudnessMap }),
    performance: { now: () => 0 },
    console: { ...console, debug() {} },
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: () => 1,
    clearTimeout() {},
    addEventListener() {}
  };
  environment.window = environment;
  environment.Math.random = () => 0;
  vm.runInNewContext(script + "\n;globalThis.dspProbe = {" +
    "get audio() { return audio; }," +
    "get enabled() { return dspEnabled; }," +
    "get pending() { return dspSwitchPending; }," +
    "get context() { return audioContext; }" +
    "};", environment);
  return {
    controls,
    contexts,
    pendingResumes,
    get audio() { return environment.dspProbe.audio; },
    get enabled() { return environment.dspProbe.enabled; },
    get pending() { return environment.dspProbe.pending; },
    get context() { return environment.dspProbe.context; },
    click(id) { return listeners.get(id + ":click")(); }
  };
}

test("Reference B includes a measured entry for every homepage song", () => {
  const playlist = [...home.match(/const playlist = \[([\s\S]*?)\];/)[1]
    .matchAll(/"([^"]+\.mp3)"/g)].map((match) => match[1]);
  const map = JSON.parse(fs.readFileSync(path.join(root, "music/music.json"), "utf8"));
  assert.equal(playlist.length, 25);
  assert.deepEqual(Object.keys(map.tracks).sort(), playlist.slice().sort());
  for (const song of playlist) {
    assert.ok(Number.isFinite(map.tracks[song].gain_db), song + " needs measured gain");
  }
});

test("raw playback does not construct Web Audio before DSP is enabled", async () => {
  const h = createDspPlaybackHarness();
  await h.click("playBtn");
  assert.equal(h.contexts.length, 0);
  await h.click("dspBtn");
  assert.equal(h.contexts.length, 1);
  assert.equal(h.enabled, true);
  assert.equal(h.controls.dspBtn.attributes["aria-pressed"], "true");
});

test("rapid DSP clicks never create duplicate contexts or double-toggle", async () => {
  const h = createDspPlaybackHarness({ deferResume: true });
  const first = h.click("dspBtn");
  const second = h.click("dspBtn");
  assert.equal(h.contexts.length, 1);
  assert.equal(h.pending, true);
  assert.equal(h.enabled, false);
  assert.equal(h.pendingResumes.length, 1);
  h.pendingResumes[0]();
  await Promise.all([first, second]);
  assert.equal(h.enabled, true);
  assert.equal(h.pending, false);
});

test("a rejected AudioContext resume restores native playback instead of silence", async () => {
  const h = createDspPlaybackHarness({ resumeFails: true });
  await h.click("playBtn");
  const previous = h.audio;
  previous.currentTime = 32;
  await h.click("dspBtn");
  assert.equal(h.enabled, false);
  assert.equal(h.context, null);
  assert.notEqual(h.audio, previous);
  assert.equal(h.audio.paused, false);
  assert.equal(h.audio.currentTime, 32);
  assert.equal(h.controls.dspBtn.attributes["aria-pressed"], "false");
});

test("Safari DSP off rebuilds native playback while preserving playback position", async () => {
  const h = createDspPlaybackHarness({ safari: true });
  await h.click("playBtn");
  await h.click("dspBtn");
  const previous = h.audio;
  const oldContext = h.context;
  previous.currentTime = 42;
  await h.click("dspBtn");
  assert.equal(h.enabled, false);
  assert.equal(h.context, null);
  assert.equal(oldContext.state, "closed");
  assert.notEqual(h.audio, previous);
  assert.equal(h.audio.currentTime, 42);
  assert.equal(h.audio.paused, false);
});

function createFellowshipQrHarness(route) {
  const source = fs.readFileSync(path.join(root, "route-invitation-action.js"), "utf8");
  let captureClick = null;
  let bubbleClick = null;
  const state = { modalOpen: false, bodyModalOpen: false, ariaHidden: "true" };
  const frame = { innerHTML: '<img src="secret-qr">' };
  const caption = { textContent: "扫码进群 · 即刻报名", style: { display: "" } };
  const modal = {
    classList: { add(name) { if (name === "open") state.modalOpen = true; } },
    setAttribute(name, value) { if (name === "aria-hidden") state.ariaHidden = value; }
  };
  const document = {
    head: { appendChild() {} },
    body: { classList: { add(name) { if (name === "modal-open") state.bodyModalOpen = true; } } },
    createElement() {
      return {
        id: "",
        textContent: "",
        className: "",
        style: {},
        classList: { add() {}, remove() {} },
        setAttribute() {},
        appendChild() {},
        addEventListener() {}
      };
    },
    getElementById(id) {
      if (id === "budao-three-slot-layout") return null;
      if (id === "qrModal") return modal;
      if (id === "qrFrame") return frame;
      if (id === "qrCaption") return caption;
      return null;
    },
    addEventListener(type, listener, capture) {
      if (type !== "click") return;
      if (capture) captureClick = listener;
      else bubbleClick = listener;
    }
  };
  const context = {
    window: { BudaoActiveRoutes: [route], open() {}, location: { origin: "https://budao.org" } },
    document,
    navigator: {},
    console,
    URL,
    fetch: async () => ({ ok: false, status: 500 })
  };
  vm.runInNewContext(source, context);
  return { captureClick, bubbleClick, frame, caption, state };
}

test("fellowship route opens the existing dialog with a blank QR area and private-group caption", () => {
  const harness = createFellowshipQrHarness({ calendarType: "fellowship", qrCode: "secret-qr" });
  assert.equal(typeof harness.captureClick, "function");

  let prevented = false;
  let stopped = false;
  const button = {
    dataset: { routeIndex: "0" },
    closest(selector) { return selector === ".route-button" ? this : null; }
  };
  harness.captureClick({
    target: button,
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; }
  });

  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(harness.frame.innerHTML, "");
  assert.equal(harness.caption.textContent, "｜小组同行 · 暂不对外｜");
  assert.equal(harness.caption.style.display, "");
  assert.equal(harness.state.modalOpen, true);
  assert.equal(harness.state.bodyModalOpen, true);
  assert.equal(harness.state.ariaHidden, "false");
});

test("non-fellowship routes are not intercepted by the private-group rule", () => {
  const harness = createFellowshipQrHarness({ calendarType: "budao", qrCode: "public-qr" });
  assert.equal(typeof harness.captureClick, "function");

  let prevented = false;
  const button = {
    dataset: { routeIndex: "0" },
    closest(selector) { return selector === ".route-button" ? this : null; }
  };
  harness.captureClick({
    target: button,
    preventDefault() { prevented = true; },
    stopImmediatePropagation() {}
  });

  assert.equal(prevented, false);
  assert.equal(harness.frame.innerHTML, '<img src="secret-qr">');
  assert.equal(harness.caption.textContent, "扫码进群 · 即刻报名");
  assert.equal(harness.state.modalOpen, false);
});
