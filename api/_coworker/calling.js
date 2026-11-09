
"use strict";
// Public responses do not create accounts or authorize tent access.
const crypto = require("node:crypto");
const { neon } = require("@neondatabase/serverless");
const { getAuthenticatedPublisher, isSteward } = require("../_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("../_security/http");
const { clientIp } = require("../_security/rate-limit");

const CAPTCHA_DURATION = 5 * 60 * 1000;
let setupPromise;
function secret() {
  const s = process.env.BUDAO_SESSION_SECRET;
  if (!s || s.length < 32) throw Error("calling_not_configured");
  return s;
}
function database() {
  if (!process.env.DATABASE_URL) throw Error("calling_database_unavailable");
  return neon(process.env.DATABASE_URL);
}
function hmac(value) {
  return crypto.createHmac("sha256", secret()).update("budao-calling-v1:" + value).digest("hex");
}
function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function dbReady(sql) {
  if (!setupPromise) setupPromise = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS coworker_calling_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      country TEXT NOT NULL, province TEXT NOT NULL, city TEXT NOT NULL,
      display_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'VISIBLE',
      captcha_nonce TEXT NOT NULL UNIQUE, consented_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_by TEXT,
      CONSTRAINT coworker_calling_status_ck CHECK (status IN ('VISIBLE','HIDDEN'))
    )`;
    await sql`CREATE TABLE IF NOT EXISTS coworker_calling_limits (
      key_hash TEXT PRIMARY KEY, window_started_at TIMESTAMPTZ NOT NULL,
      count INTEGER NOT NULL DEFAULT 1
    )`;
    await sql`CREATE INDEX IF NOT EXISTS coworker_calling_visible_idx
      ON coworker_calling_responses (status, created_at DESC)`;
  })().catch(e => { setupPromise = null; throw e; });
  return setupPromise;
}
async function rateAllowed(sql, req, purpose, max, windowMinutes) {
  const key = hmac("limit:" + purpose + ":" + clientIp(req));
  const threshold = new Date(Date.now() - windowMinutes * 60000).toISOString();
  const now = new Date().toISOString();
  const rows = await sql`INSERT INTO coworker_calling_limits (key_hash,window_started_at,count)
    VALUES (${key},${now},1)
    ON CONFLICT (key_hash) DO UPDATE SET
    count = CASE WHEN coworker_calling_limits.window_started_at < ${threshold}
      THEN 1 ELSE coworker_calling_limits.count + 1 END,
    window_started_at = CASE WHEN coworker_calling_limits.window_started_at < ${threshold}
      THEN ${now} ELSE coworker_calling_limits.window_started_at END
    RETURNING count`;
  return rows.length === 1 && Number(rows[0].count) <= max;
}
function digitsFor(nonce) {
  return String(parseInt(hmac("digits:" + nonce).slice(0, 12), 16) % 100000).padStart(5,"0");
}
function captchaSvg(code, nonce) {
  const turns = [-9,7,-4,8,-6], offsets = [0,3,-2,2,0];
  const glyphs = code.split("").map((digit,i) => {
    const x = 36 + i * 26, y = 40 + offsets[i];
    return '<text x="' + x + '" y="' + y + '" transform="rotate(' + turns[i] +
      ' ' + x + ' ' + y + ')" font-size="31" font-family="Georgia,serif" fill="#655846">' + digit + '</text>';
  }).join("");
  const seed = parseInt(hmac("visual:" + nonce).slice(0,8), 16);
  const lines = Array.from({length:4},(_,i) => {
    const x = 10 + ((seed >>> (i*5)) % 25), y = 9 + ((seed >>> (i*4)) % 39);
    return '<path d="M' + x + ',' + y + ' Q90,' + (y+12) + ' 166,' + (y+(i%2?-8:8)) +
      '" stroke="#c9b99f" stroke-width=".8" fill="none" opacity=".5"/>';
  }).join("");
  return '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60" viewBox="0 0 180 60">' +
    '<rect width="180" height="60" rx="3" fill="#f0eee9"/>' + lines + glyphs + '</svg>';
}
function issueCaptcha() {
  const nonce = crypto.randomBytes(18).toString("base64url"), exp = Date.now() + 300000;
  const payload = Buffer.from(JSON.stringify({ nonce,exp })).toString("base64url");
  return {
    token: payload + "." + hmac("challenge:" + payload),
    image: "data:image/svg+xml;base64," +
      Buffer.from(captchaSvg(digitsFor(nonce),nonce)).toString("base64"),
    expiresIn: 300
  };
}
function validateCaptcha(token, answer) {
  if (typeof token !== "string" || token.length > 300 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(token)) return "";
  const [payload,signature] = token.split(".");
  if (!equal(signature,hmac("challenge:" + payload))) return "";
  let p;
  try { p = JSON.parse(Buffer.from(payload,"base64url").toString("utf8")); }
  catch (_) { return ""; }
  if (!p || typeof p.nonce !== "string" || !/^[A-Za-z0-9_-]{24}$/.test(p.nonce) ||
      !Number.isFinite(p.exp) || p.exp < Date.now() || p.exp > Date.now()+CAPTCHA_DURATION) return "";
  return typeof answer === "string" && /^\d{5}$/.test(answer) && equal(digitsFor(p.nonce),answer) ? p.nonce : "";
}
function field(value,max=45) {
  if (typeof value !== "string") return "";
  const v = value.trim().replace(/\s+/g," ");
  return !v || [...v].length > max || /[<>\u0000-\u001f\u007f]/u.test(v) ? "" : v;
}
function fields(body) {
  const country=field(body.country),province=field(body.province),
    city=field(body.city),name=field(body.name);
  return country&&province&&city&&name ? {country,province,city,name} : null;
}
function mapped(row) {
  return {id:row.id,country:row.country,province:row.province,city:row.city,
    name:row.display_name,createdAt:row.created_at,...(row.status?{status:row.status}:{})};
}
function admin(req) {
  const user = getAuthenticatedPublisher(req);
  return user && isSteward(user) ? user : null;
}
module.exports = async function callingHandler(req,res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") return sendJson(res,405,{ok:false,reason:"method_not_allowed"});
    const sql = database();
    await dbReady(sql);
    const url = new URL(req.url||"/api/eebee","https://budao.org");
    if (req.method === "GET") {
      const view = url.searchParams.get("view") || "public";
      if (view === "captcha") {
        if (!await rateAllowed(sql,req,"captcha",30,10)) return sendJson(res,429,{ok:false,reason:"rate_limited"});
        return sendJson(res,200,{ok:true,captcha:issueCaptcha()});
      }
      if (view === "admin") {
        if (!admin(req)) return sendJson(res,401,{ok:false,reason:"unauthorized"});
        const rows = await sql`SELECT * FROM coworker_calling_responses ORDER BY created_at DESC LIMIT 250`;
        return sendJson(res,200,{ok:true,items:rows.map(mapped)});
      }
      if (view !== "public") return sendJson(res,400,{ok:false,reason:"invalid_view"});
      const rows = await sql`SELECT id,country,province,city,display_name,created_at
        FROM coworker_calling_responses WHERE status='VISIBLE'
        ORDER BY created_at DESC LIMIT 80`;
      return sendJson(res,200,{ok:true,items:rows.map(mapped)});
    }
    const parsed = requireJsonPost(req,3000);
    if (parsed.error) return sendJson(res,parsed.status,{ok:false,reason:parsed.error});
    if (!requireSameOrigin(req)) return sendJson(res,403,{ok:false,reason:"forbidden"});
    const body = parsed.body;
    if (body.action === "respond") {
      if (!await rateAllowed(sql,req,"respond",5,60)) return sendJson(res,429,{ok:false,reason:"rate_limited"});
      const data = fields(body);
      if (!data || body.consent !== true || body.website !== "") return sendJson(res,400,{ok:false,reason:"invalid_fields_or_consent"});
      const nonce = validateCaptcha(body.captchaToken,body.captchaCode);
      if (!nonce) return sendJson(res,400,{ok:false,reason:"invalid_captcha"});
      const rows = await sql`INSERT INTO coworker_calling_responses
        (country,province,city,display_name,captcha_nonce,consented_at)
        VALUES (${data.country},${data.province},${data.city},${data.name},${nonce},NOW())
        ON CONFLICT (captcha_nonce) DO NOTHING
        RETURNING id,country,province,city,display_name,created_at`;
      if (!rows.length) return sendJson(res,409,{ok:false,reason:"captcha_used"});
      return sendJson(res,201,{ok:true,item:mapped(rows[0])});
    }
    const operator = admin(req);
    if (!operator) return sendJson(res,401,{ok:false,reason:"unauthorized"});
    if (!/^[a-f0-9-]{36}$/i.test(String(body.id||""))) return sendJson(res,400,{ok:false,reason:"invalid_id"});
    if (body.action === "edit") {
      const data = fields(body);
      if (!data) return sendJson(res,400,{ok:false,reason:"invalid_fields"});
      const rows = await sql`UPDATE coworker_calling_responses SET country=${data.country},
        province=${data.province},city=${data.city},display_name=${data.name},
        updated_at=NOW(),updated_by=${operator.id} WHERE id=${body.id}::uuid RETURNING id`;
      return sendJson(res,rows.length?200:404,{ok:rows.length>0});
    }
    if (body.action === "withdraw" || body.action === "restore") {
      const next = body.action==="withdraw" ? "HIDDEN" : "VISIBLE";
      const rows = await sql`UPDATE coworker_calling_responses SET status=${next},
        updated_at=NOW(),updated_by=${operator.id} WHERE id=${body.id}::uuid RETURNING id`;
      return sendJson(res,rows.length?200:404,{ok:rows.length>0});
    }
    return sendJson(res,400,{ok:false,reason:"unknown_action"});
  } catch (error) {
    return sendJson(res,503,{ok:false,reason:"calling_service_unavailable"});
  }
};
module.exports._test = {field,fields,issueCaptcha,validateCaptcha,captchaSvg,mapped};
