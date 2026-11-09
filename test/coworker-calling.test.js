
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.BUDAO_SESSION_SECRET ||= "temporary-unit-test-secret-with-at-least-thirty-two-characters";
const calling = require("../api/_coworker/calling")._test;

test("calling captcha is a valid raster PNG, signed and expires", () => {
  const challenge = calling.issueCaptcha();
  assert.match(challenge.token,/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/);
  assert.match(challenge.image,/^data:image\/png;base64,/);
  const png = Buffer.from(challenge.image.split(",")[1],"base64");
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16),180);
  assert.equal(png.readUInt32BE(20),60);
  const compressed = png.subarray(41, 41+png.readUInt32BE(33));
  const scanlines = require("node:zlib").inflateSync(compressed);
  assert.equal(scanlines.length,60*(1+180*3));
  const payload = JSON.parse(Buffer.from(challenge.token.split(".")[0],"base64url").toString("utf8"));
  const digits = calling.digitsFor(payload.nonce);
  assert.match(digits,/^\d{5}$/);
  assert.equal(challenge.token.includes(digits),false);
  assert.equal(calling.validateCaptcha(challenge.token,digits),payload.nonce);
  assert.equal(calling.validateCaptcha(challenge.token,"999999"),"");
  assert.equal(calling.validateCaptcha(challenge.token.slice(0,-1)+"x",digits),"");
  const realNow=Date.now;
  try {
    Date.now=()=>realNow()+310000;
    assert.equal(calling.validateCaptcha(challenge.token,digits),"","expired challenge rejected");
  } finally { Date.now=realNow; }
});

test("calling fields reject empty and HTML-like input, preserve Chinese locations", () => {
  const data = calling.fields({country:" 中国 ",province:"北京",city:"顺义",name:" 小明 "});
  assert.deepEqual(data,{country:"中国",province:"北京",city:"顺义",name:"小明"});
  assert.equal(calling.fields({country:"中国",province:"北京",city:"顺义",name:"<script>"}),null);
  assert.equal(calling.fields({country:"中国",province:"北京",city:"",name:"小明"}),null);
  assert.equal(calling.fields({country:"中国",province:"北京",city:"顺义",name:"x".repeat(50)}),null);
});

test("coworker response is separate from tent privileges and the old mail CTA is gone", () => {
  const html = fs.readFileSync(path.join(__dirname,"../what.html"),"utf8");
  const js = fs.readFileSync(path.join(__dirname,"../coworker-calling.js"),"utf8");
  assert.match(html,/id="respondCalling"[^>]*>我愿意<\/button>/);
  assert.match(html,/只有步道可以修改或撤下记录/);
  assert.match(html,/name="consent" required/);
  assert.match(html,/name="country"/);
  assert.match(html,/name="province"/);
  assert.match(html,/name="city"/);
  assert.match(html,/name="displayName"/);
  assert.match(html,/id="callingCaptchaImage"/);
  assert.doesNotMatch(html,/>成为带领人<\/a>/);
  assert.doesNotMatch(js,/\/api\/auth\/login|\/tent\.html/);
});
