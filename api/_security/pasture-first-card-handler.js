'use strict';
// One-time, Preview-only ministry issuance for the inaugural personal acceptance.
// No public issue capability; requires TWO independently authenticated sessions:
// ministry publisher "tony" AND a verified pasture resident who already has a sheep.
const {getAuthenticatedPublisher}=require('./auth');
const {requireJsonPost,requireSameOrigin,sendJson}=require('./http');
const {consume,clientIp}=require('./rate-limit');
const residentDomain=require('./pasture-auth-domain');
const residentStore=require('./pasture-auth-store');
const cardDomain=require('./pasture-card-domain');
const cardStore=require('./pasture-card-store');

// Genesis issuance is allowed exactly on the reviewed Preview branch, never
// on production. A verified 'tony' publisher session IS the ministry approval
// for this inaugural one-use card; no unrelated server flag is needed.
const PILOT_BRANCH='feat/my-grass-cuv-shen-bible-v1';
function isPilotDeployment(env=process.env){
 return env.VERCEL_ENV==='preview' && env.VERCEL_GIT_COMMIT_REF===PILOT_BRANCH;
}
function verifierReady(env=process.env){
 try{cardDomain.verifierSecret(env);return Boolean(env.DATABASE_URL)}catch(e){return false}
}
function isAuthorizedIssuer(publisher){
 return Boolean(publisher?.role==='publisher'&&publisher.username==='tony');
}

module.exports=async function firstCardHandler(request,response){
 if(request.method==='GET'){
  const publisher=getAuthenticatedPublisher(request);
  if(!publisher)return sendJson(response,401,{ok:false,reason:'login_required'});
  const authorized=isAuthorizedIssuer(publisher)&&isPilotDeployment();
  const ready=authorized&&verifierReady();
  return sendJson(response,200,{
    ok:true,authenticated:true,ministryAuthorized:authorized,issuanceReady:ready,
    reason:!authorized?'ministry_issuer_unavailable':ready?null:'issuance_not_configured'
  });
 }
 if(request.method!=='POST')return sendJson(response,405,{ok:false,reason:'method_not_allowed'});
 const parsed=requireJsonPost(request,1024);
 if(parsed.error)return sendJson(response,parsed.status,{ok:false,reason:parsed.error});
 if(!requireSameOrigin(request))return sendJson(response,403,{ok:false,reason:'forbidden'});
 if(Object.keys(parsed.body).length!==1||parsed.body.confirm!==true)
  return sendJson(response,400,{ok:false,reason:'explicit_confirmation_required'});
 // A reviewed branch plus verified ministry-publisher identity authorize exactly
 // the pilot issuance; no visitor, resident-only account or production deployment can issue.
 if(!isPilotDeployment())return sendJson(response,404,{ok:false,reason:'not_available'});
 const publisher=getAuthenticatedPublisher(request);
 if(!isAuthorizedIssuer(publisher))
  return sendJson(response,403,{ok:false,reason:'ministry_authorization_required'});
 if(!verifierReady())return sendJson(response,503,{ok:false,reason:'issuance_not_configured'});
 if(!consume('genesis-first-card:'+clientIp(request),3,15*60*1000))
  return sendJson(response,429,{ok:false,reason:'rate_limited'});
 try{
  await residentStore.ensurePastureSchema();
  const sessionToken=residentDomain.readCookie(request);
  if(!sessionToken)return sendJson(response,401,{ok:false,reason:'pasture_login_required'});
  const session=await residentStore.sessionByTokenHash(residentDomain.tokenHash(sessionToken));
  if(!session?.user||session.user.status!=='ACTIVE')
   return sendJson(response,401,{ok:false,reason:'pasture_login_required'});
  const sheep=await residentStore.sheepForUser(session.user.id);
  if(!sheep)return sendJson(response,403,{ok:false,reason:'sheep_required'});
  if(session.user.cardActivatedAt)
   return sendJson(response,409,{ok:false,reason:'already_activated'});
  const issued=cardDomain.createIssuedCard();
  await cardStore.issueCardRecord({
   serial:issued.serial,secretDigest:issued.secretDigest,secretVersion:issued.secretVersion,
   batchId:'BUDAO_GENESIS_0001',issuerId:publisher.username,
   authorizationRef:'GENESIS-0001',deliveryChannel:'ONLINE',
   reservedForUserId:session.user.id
  });
  // The secret is returned exactly once, exclusively to the authorized two-session
  // browser. It is never written to logs, stored in SQL or persisted in localStorage.
  response.setHeader('Referrer-Policy','no-referrer');
  return sendJson(response,201,{ok:true,serial:issued.serial,code:issued.password});
 }catch(e){
  if(e?.code==='23505')
   return sendJson(response,409,{ok:false,reason:'first_card_already_issued'});
  if(e?.code==='PASTURE_CARD_NOT_CONFIGURED'||e?.code==='DATABASE_NOT_CONFIGURED')
   return sendJson(response,503,{ok:false,reason:'issuance_not_configured'});
  console.error('pasture-first-card',e?.code||'unavailable');
  return sendJson(response,503,{ok:false,reason:'issuance_unavailable'});
 }
};
