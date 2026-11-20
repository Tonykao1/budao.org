const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const homepage = fs.readFileSync(path.join(root, "home.html"), "utf8");
const reference = JSON.parse(fs.readFileSync(path.join(root, "music/music.json"), "utf8"));
const match = homepage.match(/const playlist\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(match, "Homepage must declare the canonical music playlist");
const playlist = JSON.parse(match[1]);

test("Every curated music track has a unique source file", () => {
  assert.ok(playlist.length > 0);
  assert.equal(new Set(playlist).size, playlist.length, "duplicate playlist tracks");
  for (const source of playlist) {
    assert.match(source, /^music\/[\s\S]+\.mp3$/i);
    assert.ok(fs.statSync(path.join(root, source)).isFile(), "missing track: " + source);
  }
});

test("All published tracks have individually measured Reference B settings", () => {
  assert.equal(reference.system, "余 DSP Reference B");
  assert.equal(reference.target_integrated_lufs, -20);
  assert.equal(reference.pre_eq_true_peak_ceiling_dbtp, -1.5);
  assert.deepEqual(Object.keys(reference.tracks), playlist, "DSP map must match playlist in exact order");
  for (const source of playlist) {
    const row = reference.tracks[source];
    assert.ok(row, "unmeasured published track: " + source);
    for (const key of ["integrated_lufs", "true_peak_dbtp", "lra_lu", "threshold_lufs", "gain_db", "result_lufs_est", "result_tp_est"]) {
      assert.ok(typeof row[key] === "number" && Number.isFinite(row[key]), source + ": invalid " + key);
    }
    assert.ok(row.result_tp_est <= reference.pre_eq_true_peak_ceiling_dbtp + 0.03, source + ": unsafe true peak");
    assert.ok(Math.abs(row.true_peak_dbtp + row.gain_db - row.result_tp_est) <= 0.06, source + ": peak math mismatch");
    assert.ok(Math.abs(row.integrated_lufs + row.gain_db - row.result_lufs_est) <= 0.06, source + ": LUFS math mismatch");
    assert.ok(row.gain_db <= reference.pre_eq_true_peak_ceiling_dbtp - row.true_peak_dbtp + 0.03, source + ": gain violates peak ceiling");
  }
});

test("DSP stays opt-in and refuses incomplete measurements", () => {
  assert.match(homepage, /function isValidReferenceBMap\(data\)/);
  assert.match(homepage, /if \(!isValidReferenceBMap\(data\)\)/);
  assert.match(homepage, /if \(!referenceB\) return;/);
  assert.match(homepage, /sourceNode\.connect\(bypassGain\)/);
  assert.match(homepage, /sourceNode\s*\.connect\(trackGain\)/);
  assert.match(homepage, /if \(dspEnabled\) applyCurrentTrackGain\(true\)/);
});
