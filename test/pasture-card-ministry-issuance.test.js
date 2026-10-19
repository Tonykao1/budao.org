'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const store=require('../api/_security/pasture-card-store');
const serial='BD-0123456789';
const digest='a'.repeat(64);
const base={serial,secretDigest:digest,secretVersion:'v1',batchId:'BUDAO_WALK_01'};
test('issuance rejects applicants and unauthorized processes missing ministry operator or approval',async()=>{
 await assert.rejects(store.issueCardRecord({...base},{}),/ministry_issuance_authorization_required/);
 await assert.rejects(store.issueCardRecord({...base,deliveryChannel:'TRAIL',issuerId:'alice'},{}),/ministry_issuance_authorization_required/);
 await assert.rejects(store.issueCardRecord({...base,deliveryChannel:'TRAIL',authorizationRef:'WALK2026'},{}),/ministry_issuance_authorization_required/);
 await assert.rejects(store.issueCardRecord({...base,deliveryChannel:'ONLINE',issuerId:'alice',authorizationRef:'REQ-101'},{}),/ministry_issuance_authorization_required/);
});
test('online approval requires a recipient; trail issuance cannot impersonate bound applicant',async()=>{
 const fields={...base,issuerId:'ministry-staff',authorizationRef:'APPROVED-2026'};
 const uuid='e164c5e2-b1dd-4cd6-b4f2-ab23d7e67c31';
 await assert.rejects(store.issueCardRecord({...fields,deliveryChannel:'ONLINE',reservedForUserId:null},{}),/ministry_issuance_authorization_required/);
 await assert.rejects(store.issueCardRecord({...fields,deliveryChannel:'ONLINE',reservedForUserId:'other-user'},{}),/ministry_issuance_authorization_required/);
 await assert.rejects(store.issueCardRecord({...fields,deliveryChannel:'TRAIL',reservedForUserId:uuid},{}),/ministry_issuance_authorization_required/);
 await assert.rejects(store.issueCardRecord({...fields,deliveryChannel:'SELF'},{}),/ministry_issuance_authorization_required/);
});
test('public API supports redeeming after login, never issuing',()=>{
 const handler=load('api/_security/pasture-auth-handler.js');
 assert.match(handler,/action === "activateCard"/);
 assert.doesNotMatch(handler,/action === "issueCard"/);
 assert.doesNotMatch(handler,/action === "approveCard"/);
 assert.doesNotMatch(handler,/issueCardRecord\(/);
 assert.doesNotMatch(handler,/createIssuedCard\(/);
});
test('database records ministry issuer, approval, channel and binds ONLINE vouchers',()=>{
 const migration=load('db/migrations/0006_pasture_ministry_issuance.sql');
 const runtime=load('api/_security/pasture-auth-store.js');
 const storeSource=load('api/_security/pasture-card-store.js');
 for(const field of ['issuer_id','authorization_ref','delivery_channel','reserved_for_user_id']){
  assert.match(migration,new RegExp(field));
  assert.match(runtime,new RegExp('ADD COLUMN IF NOT EXISTS '+field));
  assert.match(storeSource,new RegExp(field));
 }
 assert.match(storeSource,/reserved_for_user_id IS NULL OR reserved_for_user_id=\$\{userId\}/);
 assert.match(storeSource,/AND status='ISSUED'/);
});
test('operator CLI requires ministry identity and an approval reference and channel',()=>{
 const cli=load('scripts/pasture-card-admin.js');
 const specs=load('docs/pasture-step-card-confidential-activation-v1.md');
 assert.match(cli,/PASTURE_MINISTRY_ISSUER_ID/);
 assert.match(cli,/--issuer/);
 assert.match(cli,/--approval-ref/);
 assert.match(cli,/--recipient/);
 assert.match(cli,/ONLINE'&&!\/\^\[a-f0-9-\]\{36\}\$/i);
 assert.match(cli,/--confirm-issue/);
 assert.match(specs,/步道事工是数字卡和实体卡的唯一发行主体/);
 assert.match(specs,/申请不会自动生成卡密/);
 assert.match(specs,/线上申请表、同工审核界面、自动定向交付和线上身份授权尚待建设/);
});
