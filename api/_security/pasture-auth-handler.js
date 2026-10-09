const { requireJsonPost, requireSameOrigin, sendJson } = require('./http');
const { clientIp, consume } = require('./rate-limit');
const domain = require('./pasture-auth-domain');
const store = require('./pasture-auth-store');

module.exports = async function handler(request,response){
  try{
    await store.ensurePastureSchema();
    if(request.method==='GET'){
      const resident=await authenticatedResident(request);
      return sendJson(response,200,{ok:true,user:resident});
    }
    const parsed=requireJsonPost(request);
    if(parsed.error)return sendJson(response,parsed.status,{ok:false,reason:parsed.error});
    if(!requireSameOrigin(request))return sendJson(response,403,{ok:false,reason:'forbidden'});
    if(!consume('pasture-ip:'+clientIp(request),30,60_000))return sendJson(response,429,{ok:false,reason:'rate_limited'});
    const action=String(parsed.body.action||'');
    if(action==='requestCode')return requestCode(request,response,parsed.body);
    if(action==='verifyCode')return verifyCode(request,response,parsed.body);
    if(action==='saveSheep')return saveSheep(request,response,parsed.body);
    if(action==='logout')return logout(request,response);
    return sendJson(response,400,{ok:false,reason:'unknown_action'});
  }catch(error){
    if(error?.code==='PASTURE_AUTH_NOT_CONFIGURED')return sendJson(response,503,{ok:false,reason:'auth_not_configured'});
    if(error?.code==='DATABASE_NOT_CONFIGURED')return sendJson(response,503,{ok:false,reason:'database_not_configured'});
    if(error?.code==='PASTURE_EMAIL_UNAVAILABLE')return sendJson(response,503,{ok:false,reason:'email_unavailable'});
    if(error?.code==='INVALID_SHEEP')return sendJson(response,400,{ok:false,reason:'invalid_sheep'});
    console.error('pasture-auth',String(error?.message||error));
    return sendJson(response,500,{ok:false,reason:'service_unavailable'});
  }
};

async function requestCode(request,response,body){
  const email=domain.normalizeEmail(body.email);
  if(!domain.validEmail(email))return sendJson(response,400,{ok:false,reason:'invalid_email'});
  const emailHash=domain.emailHash(email);
  if(!consume('pasture-email:'+emailHash,4,15*60_000))return sendJson(response,429,{ok:false,reason:'email_rate_limited'});
  const code=domain.createEmailCode();
  const expiresAt=new Date(Date.now()+domain.EMAIL_CODE_TTL_MS);
  await store.createVerification(emailHash,domain.codeHash(email,code),expiresAt);
  await sendVerificationEmail(email,code);
  return sendJson(response,200,{ok:true,sent:true,expiresInSeconds:domain.EMAIL_CODE_TTL_MS/1000});
}
async function verifyCode(request,response,body){
  const email=domain.normalizeEmail(body.email),code=String(body.code||'').replace(/\s+/g,'');
  if(!domain.validEmail(email)||!/^\d{6}$/.test(code))return sendJson(response,400,{ok:false,reason:'verification_invalid'});
  const verification=await store.latestVerification(domain.emailHash(email));
  if(!verification||verification.consumedAt||+new Date(verification.expiresAt)<=Date.now())return sendJson(response,400,{ok:false,reason:'verification_expired'});
  if(Number(verification.attempts)>=5)return sendJson(response,429,{ok:false,reason:'verification_locked'});
  await store.incrementVerificationAttempts(verification.id);
  if(!domain.safeEqual(verification.codeHash,domain.codeHash(email,code)))return sendJson(response,400,{ok:false,reason:'verification_invalid'});
  await store.consumeVerification(verification.id);
  const user=await store.findOrCreateUser(domain.emailHash(email),domain.maskEmail(email),domain.encryptEmail(email));
  if(!user||user.status!=='ACTIVE')return sendJson(response,403,{ok:false,reason:'account_unavailable'});
  const token=domain.createSessionToken(),expiresAt=new Date(Date.now()+domain.SESSION_TTL_SECONDS*1000),ua=String(request.headers?.['user-agent']||'').slice(0,180);
  await store.createSession(user.id,domain.tokenHash(token),expiresAt,ua);
  const sheep=await store.sheepForUser(user.id);
  response.setHeader('Set-Cookie',domain.serializeSessionCookie(token,process.env.NODE_ENV!=='test'));
  return sendJson(response,200,{ok:true,user:domain.publicUser(user,sheep),needsSheep:!sheep});
}
async function saveSheep(request,response,body){
  const resident=await authenticatedResident(request,true);
  if(!resident)return sendJson(response,401,{ok:false,reason:'unauthorized'});
  const result=await store.saveSheep(resident.id,domain.validateSheep(body));
  return sendJson(response,200,{ok:true,created:result.created,user:{...resident,sheep:{id:result.sheep.id,bodyColor:result.sheep.bodyColor,headColor:result.sheep.headColor,marking:result.sheep.marking,createdAt:result.sheep.createdAt}}});
}
async function logout(request,response){
  const token=domain.readCookie(request);if(token)await store.revokeSession(domain.tokenHash(token));
  response.setHeader('Set-Cookie',domain.clearSessionCookie(process.env.NODE_ENV!=='test'));
  return sendJson(response,200,{ok:true});
}
async function authenticatedResident(request,withoutSheep=false){
  const token=domain.readCookie(request);if(!token)return null;
  const row=await store.sessionByTokenHash(domain.tokenHash(token));if(!row)return null;
  const sheep=withoutSheep?null:await store.sheepForUser(row.user.id);
  return domain.publicUser(row.user,sheep);
}
async function sendVerificationEmail(email,code){
  if(process.env.NODE_ENV==='test'){global.__lastPastureEmail={email,code};return}
  const key=process.env.RESEND_API_KEY;
  const from=process.env.PASTURE_EMAIL_FROM||process.env.EEBEE_EMAIL_FROM||process.env.STEWARDSHIP_EMAIL_FROM||process.env.EMAIL_FROM;
  if(!key||!from){const e=new Error('pasture_email_unavailable');e.code='PASTURE_EMAIL_UNAVAILABLE';throw e}
  const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:email,subject:'你的数字牧场验证码',text:'你的数字牧场验证码是：'+code+'\n\n10 分钟内有效。验证以后，你会进入羊群，并在数字牧场里认出自己。那只羊不是宠物；它就是你在牧场中的样子。\n\n若不是你本人操作，可以忽略这封邮件。'})});
  if(!result.ok){const e=new Error('pasture_email_unavailable');e.code='PASTURE_EMAIL_UNAVAILABLE';throw e}
}
module.exports._test={requestCode,verifyCode,saveSheep,logout,authenticatedResident,sendVerificationEmail};
