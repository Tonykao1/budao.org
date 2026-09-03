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
    ["/contact.html", "易彼益"]
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
  const buttons = Object.fromEntries(["playBtn", "nextBtn", "prevBtn"].map((id) => [id, {
    classList: { add() {}, remove() {} },
    addEventListener(type, listener) { listeners.set(`${id}:${type}`, listener); }
  }]));

  class AudioStub {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.loadCount = 0;
      this.listeners = new Map();
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    load() { this.loadCount += 1; this.currentTime = 0; }
    pause() {}
    play() { return Promise.resolve(); }
  }

  const context = {
    Audio: AudioStub,
    Math: Object.create(Math),
    MediaMetadata: class {},
    navigator: { mediaSession: {} },
    document: { getElementById: (id) => buttons[id] }
  };
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
