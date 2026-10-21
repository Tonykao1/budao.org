const { requireJsonPost, requireSameOrigin, sendJson } = require("./http");
const { clientIp, consume } = require("./rate-limit");
const domain = require("./pasture-auth-domain");
const store = require("./pasture-auth-store");
const cardSecrets = require("./pasture-card-domain");
const cardStore = require("./pasture-card-store");

module.exports = async function handler(request, response) {
  try {
    await store.ensurePastureSchema();

    if (request.method === "GET") {
      const resident = await authenticatedResident(request);
      return sendJson(response, 200, { ok: true, user: resident });
    }

    const parsed = requireJsonPost(request);
    if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
    if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });
    if (!consume("pasture-ip:" + clientIp(request), 30, 60_000)) {
      return sendJson(response, 429, { ok: false, reason: "rate_limited" });
    }

    const action = String(parsed.body.action || "");
    if (action === "requestCode") return await requestCode(request, response, parsed.body);
    if (action === "verifyCode") return await verifyCode(request, response, parsed.body);
    if (action === "saveSheep") return await saveSheep(request, response, parsed.body);
    if (action === "activateCard") return await activateCard(request, response, parsed.body);
    if (action === "logout") return await logout(request, response);
    return sendJson(response, 400, { ok: false, reason: "unknown_action" });
  } catch (error) {
    if (error && error.code === "PASTURE_AUTH_NOT_CONFIGURED") {
      return sendJson(response, 503, { ok: false, reason: "auth_not_configured" });
    }
    if (error && error.code === "DATABASE_NOT_CONFIGURED") {
      return sendJson(response, 503, { ok: false, reason: "database_not_configured" });
    }
    if (error && error.code === "PASTURE_EMAIL_UNAVAILABLE") {
      return sendJson(response, 503, { ok: false, reason: "email_unavailable" });
    }
    if (error && error.code === "PASTURE_CARD_NOT_CONFIGURED") {
      return sendJson(response, 503, { ok: false, reason: "card_activation_pending" });
    }
    if (error && error.code === "INVALID_SHEEP") {
      return sendJson(response, 400, { ok: false, reason: "invalid_sheep" });
    }
    console.error("pasture-auth", String(error && error.message || error));
    return sendJson(response, 500, { ok: false, reason: "service_unavailable" });
  }
};

async function requestCode(request, response, body) {
  const email = domain.normalizeEmail(body.email);
  if (!domain.validEmail(email)) return sendJson(response, 400, { ok: false, reason: "invalid_email" });

  const emailHash = domain.emailHash(email);
  if (!consume("pasture-email:" + emailHash, 4, 15 * 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "email_rate_limited" });
  }

  const code = domain.createEmailCode();
  const expiresAt = new Date(Date.now() + domain.EMAIL_CODE_TTL_MS);
  await store.createVerification(emailHash, domain.codeHash(email, code), expiresAt);
  await sendVerificationEmail(email, code);

  return sendJson(response, 200, { ok: true, sent: true, expiresInSeconds: domain.EMAIL_CODE_TTL_MS / 1000 });
}

async function verifyCode(request, response, body) {
  const email = domain.normalizeEmail(body.email);
  const code = String(body.code || "").replace(/\s+/g, "");
  if (!domain.validEmail(email) || !/^\d{6}$/.test(code)) {
    return sendJson(response, 400, { ok: false, reason: "verification_invalid" });
  }

  const emailHash = domain.emailHash(email);
  const verification = await store.latestVerification(emailHash);
  if (!verification || verification.consumedAt || +new Date(verification.expiresAt) <= Date.now()) {
    return sendJson(response, 400, { ok: false, reason: "verification_expired" });
  }
  if (Number(verification.attempts) >= 5) {
    return sendJson(response, 429, { ok: false, reason: "verification_locked" });
  }

  await store.incrementVerificationAttempts(verification.id);
  if (!domain.safeEqual(verification.codeHash, domain.codeHash(email, code))) {
    return sendJson(response, 400, { ok: false, reason: "verification_invalid" });
  }

  await store.consumeVerification(verification.id);
  const user = await store.findOrCreateUser(emailHash, domain.maskEmail(email), domain.encryptEmail(email));
  if (!user || user.status !== "ACTIVE") {
    return sendJson(response, 403, { ok: false, reason: "account_unavailable" });
  }

  const token = domain.createSessionToken();
  const expiresAt = new Date(Date.now() + domain.SESSION_TTL_SECONDS * 1000);
  const ua = String(request.headers && request.headers["user-agent"] || "").slice(0, 180);
  await store.createSession(user.id, domain.tokenHash(token), expiresAt, ua);
  const sheep = await store.sheepForUser(user.id);

  response.setHeader("Set-Cookie", domain.serializeSessionCookie(token, process.env.NODE_ENV !== "test"));
  return sendJson(response, 200, { ok: true, user: domain.publicUser(user, sheep), needsSheep: !sheep });
}

async function saveSheep(request, response, body) {
  const resident = await authenticatedResident(request, true);
  if (!resident) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  const appearance = domain.validateSheep(body);
  const result = await store.saveSheep(resident.id, appearance);
  const sheep = result.sheep;
  return sendJson(response, 200, {
    ok: true,
    created: result.created,
    user: {
      ...resident,
      sheep: domain.publicSheep(sheep)
    }
  });
}


async function activateCard(request,response,body){
 const resident=await authenticatedResident(request);
 if(!resident)return sendJson(response,401,{ok:false,reason:'unauthorized'});
 if(!resident.sheep)return sendJson(response,403,{ok:false,reason:'sheep_required'});
 if(resident.cardActivated===true)return sendJson(response,409,{ok:false,reason:'card_already_activated'});
 // Supplemental IP limit; the durable counter below is enforced in PostgreSQL.
 if(!consume('card-ip:'+clientIp(request),8,15*60_000))
  return sendJson(response,429,{ok:false,reason:'card_rate_limited'});
 const allowed=await cardStore.consumeActivationAttempt(resident.id);
 if(!allowed)return sendJson(response,429,{ok:false,reason:'card_rate_limited'});
 const digest=cardSecrets.hashCode(body.password);
 if(!digest)return sendJson(response,400,{ok:false,reason:'activation_failed'});
 const serial=await cardStore.redeemSecretDigest(resident.id,digest);
 if(!serial)return sendJson(response,400,{ok:false,reason:'activation_failed'});
 // Re-read from the server: never grant a right based on client input.
 const updated=await authenticatedResident(request);
 if(!updated?.cardActivated)return sendJson(response,503,{ok:false,reason:'activation_pending_sync'});
 return sendJson(response,200,{ok:true,user:updated});
}

async function logout(request, response) {
  const token = domain.readCookie(request);
  if (token) await store.revokeSession(domain.tokenHash(token));
  response.setHeader("Set-Cookie", domain.clearSessionCookie(process.env.NODE_ENV !== "test"));
  return sendJson(response, 200, { ok: true });
}

async function authenticatedResident(request, withoutSheep = false) {
  const token = domain.readCookie(request);
  if (!token) return null;
  const row = await store.sessionByTokenHash(domain.tokenHash(token));
  if (!row) return null;
  const sheep = withoutSheep ? null : await store.sheepForUser(row.user.id);
  return domain.publicUser(row.user, sheep);
}

async function sendVerificationEmail(email, code) {
  if (process.env.NODE_ENV === "test") {
    global.__lastPastureEmail = { email, code };
    return;
  }
  const key = process.env.RESEND_API_KEY;
  const from = process.env.PASTURE_EMAIL_FROM ||
    process.env.EEBEE_EMAIL_FROM ||
    process.env.STEWARDSHIP_EMAIL_FROM ||
    process.env.EMAIL_FROM;
  if (!key || !from) {
    const error = new Error("pasture_email_unavailable");
    error.code = "PASTURE_EMAIL_UNAVAILABLE";
    throw error;
  }
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "你的数字牧场验证码",
      text: "你的数字牧场验证码是：" + code +
        "\n\n10 分钟内有效。验证后，你会成为牧场居民，并拥有一只属于自己的羊。\n\n若不是你本人操作，可以忽略这封邮件。"
    })
  });
  if (!result.ok) {
    const error = new Error("pasture_email_unavailable");
    error.code = "PASTURE_EMAIL_UNAVAILABLE";
    throw error;
  }
}

module.exports._test = { requestCode, verifyCode, saveSheep, activateCard, logout, authenticatedResident, sendVerificationEmail };
