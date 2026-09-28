const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LEADERS_ONLY,
  TRUSTED_TEAM,
  validatePrayerSubmission
} = require("../api/_security/prayer-domain");
const {
  decryptPrayerPayload,
  encryptPrayerPayload
} = require("../api/_security/prayer-crypto");

test("prayer submission rejects blank body", () => {
  assert.throws(
    () => validatePrayerSubmission({ body: "  \n ", visibility: LEADERS_ONLY }),
    { message: "invalid_prayer_body" }
  );
});

test("prayer submission accepts one to one thousand normalized characters", () => {
  assert.deepEqual(validatePrayerSubmission({ body: " 求 ", visibility: LEADERS_ONLY }), {
    body: "求",
    visibility: LEADERS_ONLY,
    wantsReply: false,
    contact: ""
  });

  const decomposed = "e\u0301";
  assert.equal(validatePrayerSubmission({ body: decomposed }).body, "é");
  assert.equal(Array.from(validatePrayerSubmission({ body: "愿".repeat(1000) }).body).length, 1000);
  assert.throws(
    () => validatePrayerSubmission({ body: "愿".repeat(1001) }),
    { message: "invalid_prayer_body" }
  );
});

test("prayer submission only accepts explicit privacy scopes", () => {
  assert.equal(validatePrayerSubmission({ body: "请记念", visibility: TRUSTED_TEAM }).visibility, TRUSTED_TEAM);
  assert.equal(validatePrayerSubmission({ body: "请记念" }).visibility, LEADERS_ONLY);
  assert.throws(
    () => validatePrayerSubmission({ body: "请记念", visibility: "PUBLIC" }),
    { message: "invalid_prayer_visibility" }
  );
});

test("reply requests require contact and non-reply submissions discard it", () => {
  assert.throws(
    () => validatePrayerSubmission({ body: "请记念", wantsReply: true, contact: "  " }),
    { message: "invalid_prayer_contact" }
  );
  assert.deepEqual(
    validatePrayerSubmission({ body: "请记念", wantsReply: true, contact: "  example@example.com  " }),
    { body: "请记念", visibility: LEADERS_ONLY, wantsReply: true, contact: "example@example.com" }
  );
  assert.equal(
    validatePrayerSubmission({ body: "请记念", wantsReply: false, contact: "unexpected@example.com" }).contact,
    ""
  );
});

test("prayer payload encryption round trips and rejects the wrong key", () => {
  const key = Buffer.alloc(32, 7).toString("base64url");
  const wrongKey = Buffer.alloc(32, 8).toString("base64url");
  const encrypted = encryptPrayerPayload({ body: "请为家人记念", contact: "quiet@example.com" }, key);

  assert.match(encrypted.ciphertext, /^[A-Za-z0-9_-]+$/);
  assert.match(encrypted.nonce, /^[A-Za-z0-9_-]+$/);
  assert.match(encrypted.tag, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decryptPrayerPayload(encrypted, key), {
    body: "请为家人记念",
    contact: "quiet@example.com"
  });
  assert.throws(() => decryptPrayerPayload(encrypted, wrongKey), { message: "prayer_decryption_failed" });
});

test("prayer encryption requires an exact 32-byte key", () => {
  assert.throws(
    () => encryptPrayerPayload({ body: "请记念", contact: "" }, Buffer.alloc(31).toString("base64url")),
    { message: "prayer_crypto_unavailable" }
  );
});
