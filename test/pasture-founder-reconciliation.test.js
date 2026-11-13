'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
process.env.PASTURE_SESSION_SECRET='pasture-card-unit-secret-that-is-long-enough-001';
process.env.BUDAO_SESSION_SECRET='budao-admin-unit-secret-that-is-long-enough-001';
const store=require('../api/_security/pasture-auth-store');
const cards=require('../api/_security/pasture-card-store');
const handler=require('../api/_security/pasture-auth-handler');
const {createSessionCookie}=require('../api/_security/auth');
const response=()=>({statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}});
const user={id:'00000000-0000-0000-0000-000000000001',emailMasked:'to***@example.com',status:'ACTIVE'};
const residentCookie='budao_pasture_session=dummy';
const request=(action,extra={},cookie=residentCookie)=>({method:'POST',url:'/api/pasture-auth',headers:{origin:'https://budao.org',host:'budao.org',cookie},body:{action,...extra}});
const original={sessionByTokenHash:store.sessionByTokenHash,
 sheepForUser:store.sheepForUser,ensurePastureSchema:store.ensurePastureSchema,
 cardForUser:cards.cardForUser,
 claimForUser:cards.founderClaimForUser,createFounderClaim:cards.createFounderClaim,
 approveFounderClaim:cards.approveFounderClaim,ensureCardSchema:cards.ensureCardSchema};
function putBack(){store.sessionByTokenHash=original.sessionByTokenHash;
 store.sheepForUser=original.sheepForUser;store.ensurePastureSchema=original.ensurePastureSchema;
 cards.cardForUser=original.cardForUser;cards.founderClaimForUser=original.claimForUser;
 cards.createFounderClaim=original.createFounderClaim;cards.approveFounderClaim=original.approveFounderClaim;
 cards.ensureCardSchema=original.ensureCardSchema}
test.afterEach(putBack);
test.beforeEach(()=>{store.sheepForUser=async()=>null;store.ensurePastureSchema=async()=>{};});
test('an authenticated resident can request review, but cannot activate a card',async()=>{
 store.sessionByTokenHash=async()=>({user});
 cards.ensureCardSchema=async()=>{};
 cards.cardForUser=async()=>null;
 cards.createFounderClaim=async()=>({status:'PENDING'});
 const res=response();
 await handler._test.requestFounderCardReview(request('requestFounderCardReview'),res);
 assert.equal(res.statusCode,202);
 assert.equal(res.body.founderClaim.status,'PENDING');
 assert.equal(res.body.card,undefined);
});
test('claim request rejects unauthenticated account and existing binding',async()=>{
 store.sessionByTokenHash=async()=>null;
 cards.ensureCardSchema=async()=>{};
 const denied=response();
 await handler._test.requestFounderCardReview(request('requestFounderCardReview'),denied);
 assert.equal(denied.statusCode,401);
 store.sessionByTokenHash=async()=>({user});
 cards.cardForUser=async()=>({status:'ACTIVATED'});
 const exists=response();
 await handler._test.requestFounderCardReview(request('requestFounderCardReview'),exists);
 assert.equal(exists.statusCode,409);
});
test('only authenticated steward can approve, and review evidence must be recorded',async()=>{
 cards.ensureCardSchema=async()=>{};
 let writes=0;cards.approveFounderClaim=async()=>{writes++;return {cardId:'confirmed'}};
 const claimId='00000000-0000-0000-0000-000000000002';
 const unauth=response();
 await handler._test.approveFounderCardReview(request('approveFounderCardReview',{claimId,evidenceReference:'founder-review-2026-001'}),unauth,{claimId,evidenceReference:'founder-review-2026-001'});
 assert.equal(unauth.statusCode,403);
 const steward=createSessionCookie({id:'admin-user',username:'tony',role:'publisher'}).split(';')[0];
 const invalid=response();
 await handler._test.approveFounderCardReview(request('approveFounderCardReview',{},steward),invalid,{claimId,evidenceReference:'BUDAO-2026'});
 assert.equal(invalid.statusCode,200);
 assert.equal(writes,1);
 const bad=response();
 await handler._test.approveFounderCardReview(request('approveFounderCardReview',{},steward),bad,{claimId,evidenceReference:'demo'});
 assert.equal(bad.statusCode,400);assert.equal(writes,1);
});
test('historical activation is server-side, auditable, and does not fabricate serial or dimensions',()=>{
 const storeCode=fs.readFileSync('api/_security/pasture-card-store.js','utf8');
 assert.match(storeCode,/HISTORIC_FOUNDER/);
 assert.match(storeCode,/verification_reference/);
 assert.match(storeCode,/ON CONFLICT DO NOTHING/);
 assert.match(storeCode,/NULL,'ACTIVATED'/);
 assert.doesNotMatch(storeCode,/randomPublic|randomUUID.*serial|issueCard/);
 const html=fs.readFileSync('pasture-card-viewer.html','utf8');
 const ui=fs.readFileSync('pasture-card-viewer.js','utf8');
 assert.match(html,/founderCardClaim/);
 assert.match(ui,/requestFounderCardReview/);
 assert.doesNotMatch(ui,/action:'activateCard'|issueCard\(/);
 const shell=fs.readFileSync('tonglu.html','utf8');
 for(const id of ['grassBookBtn','windNewsBtn','partnersBtn','mailBtn','boxEntryBtn']){
  assert.match(shell,new RegExp('pasture-feature-locked" id="'+id+'"'));
 }
});

test('GET obtains authenticated entitlement from server card ledger, not a demo value',async()=>{
 const res=response();
 store.sessionByTokenHash=async()=>({user});
 cards.ensureCardSchema=async()=>{};
 cards.cardForUser=async()=>({seriesId:'CSCZ-001',serial:null,status:'ACTIVATED',source:'HISTORIC_FOUNDER'});
 cards.founderClaimForUser=async()=>({status:'APPROVED'});
 await handler({method:'GET',url:'/api/pasture-auth',headers:{cookie:residentCookie}},res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.user.cardActivated,true);
 assert.equal(res.body.card.status,'ACTIVATED');
 assert.equal(res.body.card.serial,null);
});
test('GET protects identity when not logged in, and does not claim false activation',async()=>{
 const res=response();
 store.sessionByTokenHash=async()=>null;
 await handler({method:'GET',url:'/api/pasture-auth',headers:{}},res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.user,null);assert.equal(res.body.card,null);
});
test('GET keeps normal identity service available when card ledger is unavailable',async()=>{
 const res=response();
 store.sessionByTokenHash=async()=>({user});
 cards.ensureCardSchema=async()=>{throw Error('not-ready')};
 await handler({method:'GET',url:'/api/pasture-auth',headers:{cookie:residentCookie}},res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.cardStatusUnavailable,true);
 assert.notEqual(res.body.user.cardActivated,true);
});
test('steward queue is forbidden to all callers without authenticated steward cookie',async()=>{
 const res=response();
 cards.ensureCardSchema=async()=>{};
 await handler({method:'GET',url:'/api/pasture-auth?founderReviews=1',headers:{}},res);
 assert.equal(res.statusCode,403);
 assert.equal(res.body.reason,'forbidden');
});
