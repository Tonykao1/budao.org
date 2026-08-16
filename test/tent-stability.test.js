const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "test-only-session-secret-at-least-32-bytes";
process.env.GITHUB_TOKEN = "test-token-never-logged";
process.env.GITHUB_PUBLISH_BRANCH = "main";
process.env.GITHUB_BRANCH = "main";

const salt = Buffer.from("tent-stability-salt");
const hash = crypto.scryptSync("correct-password", salt, 32).toString("base64url");
const validUsers = JSON.stringify([{
  id: "publisher-ims",
  email: "publisher@example.test",
  passwordHash: "scrypt$" + salt.toString("base64url") + "$" + hash,
  slot: "IMS"
}]);
process.env.BUDAO_ADMIN_USERS_JSON = validUsers;

const login = require("../api/auth/login");
const upload = require("../api/upload-route-image");
const publish = require("../api/publish-route-v2");
const draftImages = require("../tent-draft-images");
const { resetForTests } = require("../api/_security/rate-limit");

function request(body, overrides = {}) {
  const { headers = {}, ...rest } = overrides;
  return {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://budao.test",
      host: "budao.test",
      "x-forwarded-for": "198.51.100.20",
      ...headers
    },
    ...rest
  };
}

function response() {
  return {
    headers: {}, statusCode: 0, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function signedCookie(slot = "IMS") {
  const payload = Buffer.from(JSON.stringify({
    iss: "budao.org", aud: "budao-admin", sub: "publisher-ims", role: "publisher", slot,
    exp: Math.floor(Date.now() / 1000) + 600
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.BUDAO_SESSION_SECRET).update(payload).digest("base64url");
  return "budao_admin_session=" + payload + "." + signature;
}

function png(width = 1, height = 1) {
  const bytes = Buffer.alloc(32);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function jpeg(width = 1, height = 1) {
  return Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08,
    height >> 8, height & 0xff, width >> 8, width & 0xff, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);
}

function webp(width = 1, height = 1) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBPVP8X", 8, "ascii");
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}

function imageBody(mimeType, bytes) {
  return { mimeType, data: bytes.toString("base64") };
}

test.beforeEach(() => {
  resetForTests();
  process.env.BUDAO_ADMIN_USERS_JSON = validUsers;
  process.env.BUDAO_SESSION_SECRET = "test-only-session-secret-at-least-32-bytes";
});

test("login distinguishes valid credentials, wrong credentials and safe configuration failures", async () => {
  let res = response();
  await login(request({ email: "publisher@example.test", password: "correct-password" }), res);
  assert.equal(res.statusCode, 200);

  resetForTests();
  res = response();
  await login(request({ email: "publisher@example.test", password: "wrong-password" }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.reason, "invalid_credentials");

  resetForTests();
  process.env.BUDAO_ADMIN_USERS_JSON = "not-json";
  res = response();
  await login(request({ email: "publisher@example.test", password: "correct-password" }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.reason, "user_configuration_unavailable");

  resetForTests();
  process.env.BUDAO_ADMIN_USERS_JSON = validUsers;
  process.env.BUDAO_SESSION_SECRET = "short";
  res = response();
  await login(request({ email: "publisher@example.test", password: "correct-password" }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.reason, "session_configuration_unavailable");
});

test("client login messages expose only credential or service availability states", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "tent-app.js"), "utf8");
  assert.match(source, /error\.status === 401\) return "邮箱或密码错误"/);
  assert.match(source, /return "登录服务暂时不可用，请稍后再试"/);
  assert.doesNotMatch(source, /登录名册暂时未就绪|会话暂时无法建立|BUDAO_ADMIN_USERS_JSON|BUDAO_SESSION_SECRET/);
});

test("draft image read failures are explicit and compression failures fall back to the original", async () => {
  class GoodReader {
    addEventListener(name, callback) { this[name] = callback; }
    readAsDataURL() { this.result = "data:image/png;base64,AAAA"; this.load(); }
  }
  class BadReader {
    addEventListener(name, callback) { this[name] = callback; }
    readAsDataURL() { this.error(); }
  }
  const file = { name: "route.png", type: "image/png" };

  await assert.rejects(
    draftImages.prepareRouteImage(file, { FileReaderCtor: BadReader }),
    (error) => error.reason === "image_read_failed"
  );
  const missing = await draftImages.prepareRouteImage(file, { FileReaderCtor: GoodReader });
  assert.equal(missing.dataUrl, "data:image/png;base64,AAAA");
  const rejected = await draftImages.prepareRouteImage(file, {
    FileReaderCtor: GoodReader,
    compressor: () => Promise.reject(new Error("canvas failed"))
  });
  assert.equal(rejected.dataUrl, "data:image/png;base64,AAAA");
  const canvasThrow = await draftImages.prepareRouteImage(file, {
    FileReaderCtor: GoodReader,
    compressor: () => { throw new Error("canvas unavailable"); }
  });
  assert.equal(canvasThrow.dataUrl, "data:image/png;base64,AAAA");
  const empty = await draftImages.prepareRouteImage(file, { FileReaderCtor: GoodReader, compressor: () => "" });
  assert.equal(empty.dataUrl, "data:image/png;base64,AAAA");
  const compressed = await draftImages.prepareRouteImage(file, {
    FileReaderCtor: GoodReader,
    compressor: () => "data:image/jpeg;base64,BBBB"
  });
  assert.equal(compressed.dataUrl, "data:image/jpeg;base64,BBBB");
});

test("draft image compression timeout falls back to the original image", async () => {
  class GoodReader {
    addEventListener(name, callback) { this[name] = callback; }
    readAsDataURL() { this.result = "data:image/png;base64,AAAA"; this.load(); }
  }

  const diagnostics = [];
  const result = await draftImages.prepareRouteImage(
    { name: "route.png", type: "image/png" },
    {
      FileReaderCtor: GoodReader,
      compressor: () => new Promise(() => {}),
      compressionTimeoutMs: 10,
      onDiagnostic: (stage, error) => diagnostics.push([stage, error.reason])
    }
  );

  assert.equal(result.dataUrl, "data:image/png;base64,AAAA");
  assert.deepEqual(diagnostics, [["image compression", "image_compression_timeout"]]);
});

test("route placement shows processing immediately, restores after success or failure and ignores rapid repeats", async () => {
  let message = "";
  let processing = false;
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const run = draftImages.createSubmissionGuard({
    setMessage(value) { message = value; },
    setProcessing(value) { processing = value; }
  });

  const first = run(async () => { calls += 1; await gate; return "saved"; });
  const second = run(async () => { calls += 1; return "duplicate"; });

  assert.equal(message, "正在安放这条步道…");
  assert.equal(processing, true);
  assert.equal(calls, 0);
  assert.deepEqual(await second, { skipped: true });
  release();
  assert.equal(await first, "saved");
  assert.equal(calls, 1);
  assert.equal(processing, false);

  await assert.rejects(run(async () => { throw new Error("save failed"); }), /save failed/);
  assert.equal(processing, false);
});

test("client route placement wires processing UI and four diagnostic stages", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "tent-app.js"), "utf8");
  const draftSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "tent-draft-images.js"), "utf8");
  assert.match(source, /createSubmissionGuard/);
  assert.match(draftSource, /正在安放这条步道…/);
  assert.match(source, /routeSubmitButton\.disabled = processing/);
  assert.match(source, /compressionTimeoutMs: 7000/);
  for (const stage of ["image read", "image compression", "draft persistence", "preview render"]) {
    assert.match(source + draftSource, new RegExp(stage));
  }
});

test("draft persistence reports quota exhaustion instead of silently stripping images", () => {
  const quota = Object.assign(new Error("full"), { name: "QuotaExceededError" });
  const storage = { setItem() { throw quota; } };
  const result = draftImages.persistDraft(storage, "draft", [{ source: { images: [{ dataUrl: "data:image/png;base64,AAAA" }] } }]);
  assert.equal(result.saved, false);
  assert.equal(result.quotaExceeded, true);
});

test("route image upload requires authentication", async () => {
  const res = response();
  await upload(request(imageBody("image/png", png())), res);
  assert.equal(res.statusCode, 401);
});

test("route image upload accepts JPEG, PNG and WebP and returns a managed HTTPS URL", async () => {
  global.fetch = async (url, options) => {
    assert.equal(options.method, "PUT");
    assert.match(url, /\/contents\/route-assets\/ims\/[a-f0-9]{32}\.(?:jpg|png|webp)$/);
    return { ok: true, status: 201, json: async () => ({ content: { sha: "asset" } }) };
  };

  for (const [mimeType, bytes] of [["image/jpeg", jpeg()], ["image/png", png()], ["image/webp", webp()]]) {
    resetForTests();
    const res = response();
    await upload(request(imageBody(mimeType, bytes), { headers: { cookie: signedCookie() } }), res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body.url, /^https:\/\/raw\.githubusercontent\.com\/Tonykao1\/budao\.org\/main\/route-assets\/ims\/[a-f0-9]{32}\.(?:jpg|png|webp)$/);
  }
});

test("route image upload rejects SVG, false MIME and oversized payloads", async () => {
  let outgoingRequests = 0;
  global.fetch = async () => { outgoingRequests += 1; };
  for (const body of [
    imageBody("image/svg+xml", Buffer.from("<svg/>")),
    imageBody("image/png", Buffer.from("not a png")),
    imageBody("image/jpeg", Buffer.alloc(2 * 1024 * 1024 + 1, 1))
  ]) {
    resetForTests();
    const res = response();
    await upload(request(body, { headers: { cookie: signedCookie() } }), res);
    assert.ok([400, 413].includes(res.statusCode));
  }
  assert.equal(outgoingRequests, 0);
});

test("publishing accepts managed uploads, rejects forged URLs and preserves an existing legacy image", async () => {
  const cookie = signedCookie();
  const managed = "https://raw.githubusercontent.com/Tonykao1/budao.org/main/route-assets/ims/0123456789abcdef0123456789abcdef.jpg";
  let stored = Buffer.from("[]").toString("base64");
  global.fetch = async (_url, options) => {
    if (!options || options.method === "GET") return { ok: true, status: 200, json: async () => ({ sha: "routes", content: stored }) };
    stored = JSON.parse(options.body).content;
    return { ok: true, status: 200, json: async () => ({ commit: { sha: "commit" } }) };
  };

  let res = response();
  await publish(request({ title: "Managed", image: managed }, { headers: { cookie } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(Buffer.from(stored, "base64").toString("utf8"))[0].image, managed);

  resetForTests();
  res = response();
  await publish(request({ title: "Forged", image: "https://example.com/forged.jpg" }, { headers: { cookie } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.reason, "untrusted_image_url");

  resetForTests();
  const legacy = "https://legacy.example.test/original.jpg";
  stored = Buffer.from(JSON.stringify([{ id: "budao-ims", routeId: "budao-ims", slot: "IMS", owner: "IMS@budao.org", title: "Legacy", image: legacy }])).toString("base64");
  res = response();
  await publish(request({ title: "Legacy updated" }, { headers: { cookie } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(Buffer.from(stored, "base64").toString("utf8"))[0].image, legacy);
});

test("client flow never sends a data URL to route publishing", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "tent-app.js"), "utf8");
  assert.match(source, /uploadRouteImageIfNeeded/);
  assert.match(source, /if \(String\(payload\.image \|\| ""\)\.startsWith\("data:"\)\) throw publishError/);
  assert.doesNotMatch(source, /body:\s*JSON\.stringify\(route\)[\s\S]{0,120}publishEndpoint/);
});

test("an uploaded managed URL is retained and retry does not upload the same image again", async () => {
  const managed = "https://raw.githubusercontent.com/Tonykao1/budao.org/main/route-assets/ims/abcdefabcdefabcdefabcdefabcdefab.jpg";
  const trail = {
    id: "budao-ims",
    source: {
      images: [{ name: "route.jpg", dataUrl: "data:image/jpeg;base64,AAAA" }],
      existingImage: "",
      existingImageAlt: ""
    }
  };
  let uploadCalls = 0;
  let publishCalls = 0;
  const upload = async () => { uploadCalls += 1; return managed; };
  const publishAttempt = async () => {
    publishCalls += 1;
    if (publishCalls === 1) throw new Error("route publish failed");
    return { ok: true };
  };

  const first = await draftImages.ensureManagedRouteImage({
    title: "Route",
    image: trail.source.images[0].dataUrl,
    imageAlt: trail.source.images[0].name
  }, upload);
  assert.equal(first.uploaded, true);
  draftImages.rememberManagedRouteImage(trail, first.route.image, first.route.imageAlt);
  await assert.rejects(publishAttempt(first.route), /route publish failed/);

  const retry = await draftImages.ensureManagedRouteImage({
    title: "Route",
    image: trail.source.existingImage,
    imageAlt: trail.source.existingImageAlt
  }, upload);
  await publishAttempt(retry.route);
  assert.equal(retry.uploaded, false);
  assert.equal(retry.route.image, managed);
  assert.equal(uploadCalls, 1);
  assert.equal(publishCalls, 2);
  assert.deepEqual(trail.source.images, []);
  assert.equal(trail.source.existingImage, managed);
});

test("client renders a prepared route preview and reports preview failure separately", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "tent-app.js"), "utf8");
  assert.match(source, /try \{\s*renderRoutePreview\(trail\);\s*\} catch/);
  assert.match(source, /图片已经读入，但预览暂时无法呈现。/);
  assert.match(source, /图片读取失败，请重新选择。/);
});

test('timezone select exists and normalization rules are present', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'tent.html'), 'utf8');
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'tent-app.js'), 'utf8');

  // tent.html should use a select for timezone
  assert.match(html, /<select name="timezone">/);

  // normalizeTimezone helper and mappings
  assert.match(source, /function normalizeTimezone\(/);
  assert.match(source, /"China\/Beijing"\s*:\s*"Asia\/Shanghai"/);
  assert.match(source, /"US\/Pacific"\s*:\s*"America\/Los_Angeles"/);

  // buildTrailRecord should call normalizeTimezone when constructing timezone
  assert.match(source, /const timezoneRaw = valueOf\(form, "timezone"\)/);
  assert.match(source, /const timezone = normalizeTimezone\(timezoneRaw/);

  // slotRouteDefaults contain IMS and BACBC defaults
  assert.match(source, /IMS:\s*\{[\s\S]*timezone:\s*"Asia\/Shanghai"/);
  assert.match(source, /BACBC:\s*\{[\s\S]*timezone:\s*"America\/Los_Angeles"/);
});
