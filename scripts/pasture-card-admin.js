#!/usr/bin/env node
'use strict';
// Offline, operator-only issuance / revocation. DO NOT expose via an HTTP route.
// No plaintext card secret is ever printed to stdout, logged, or stored in DB.
const fs=require('node:fs'),path=require('node:path');
const {createIssuedCard,verifierSecret}=require('../api/_security/pasture-card-domain');
const store=require('../api/_security/pasture-card-store');
const authStore=require('../api/_security/pasture-auth-store');

function option(name){
 const i=process.argv.indexOf(name);
 return i<0?null:process.argv[i+1]||null;
}
function fail(message){process.stderr.write('步道卡管理操作未完成：'+message+'\n');process.exitCode=1;}
async function main(){
 const action=process.argv[2];
 if(action!=='issue'&&action!=='revoke'){
  fail('请使用 issue 或 revoke，并在正式环境取得明确的操作授权。');return;
 }
 // Issuance or revocation can only run under a configured ministry operator.
 // The variable is set by operators, never by the online applicant.
 const issuer=option('--issuer');
 if(!process.env.PASTURE_MINISTRY_ISSUER_ID||issuer!==process.env.PASTURE_MINISTRY_ISSUER_ID){
  fail('此操作仅限已授权的步道事工发行操作员。');return;
 }
 // Refuse operation without the dedicated signing key and valid DB access.
 verifierSecret();
 await authStore.ensurePastureSchema();
 if(action==='revoke'){
  const serial=option('--serial');
  if(process.argv.indexOf('--confirm-revoke')<0||!/^BD-[0-9A-HJKMNP-TV-Z]{10}$/.test(serial||'')){
   fail('撤销需要有效 --serial 和 --confirm-revoke。');return;
  }
  const result=await store.revokeCard(serial);
  process.stdout.write(JSON.stringify({serial,revoked:result.revoked,
   residentDisabled:result.residentDisabled})+'\n');
  return;
 }
 const count=Number(option('--count'));
 const batchId=option('--batch'),output=option('--out');
 const authorizationRef=option('--approval-ref');
 const channel=String(option('--channel')||'').toUpperCase();
 const reservedForUserId=option('--recipient');
 if(process.argv.indexOf('--confirm-issue')<0||!Number.isInteger(count)||count<1||count>200||
   !/^[A-Za-z0-9_-]{4,40}$/.test(batchId||'')||!output||!path.isAbsolute(output)||
   !/^[A-Za-z0-9_.-]{3,80}$/.test(issuer||'')||
   !/^[A-Za-z0-9_.:-]{4,100}$/.test(authorizationRef||'')||
   !['ONLINE','TRAIL'].includes(channel)||
   (channel==='ONLINE'&&(count!==1||!/^[a-f0-9-]{36}$/i.test(reservedForUserId||'')))||
   (channel==='TRAIL'&&reservedForUserId)){
  fail('发行需要事工授权身份、批准依据、ONLINE 单位申请人或 TRAIL 活动批次，以及安全输出路径。');return;
 }
 const outfile=path.resolve(output),repoRoot=path.resolve(__dirname,'..');
 if(outfile===repoRoot||outfile.startsWith(repoRoot+path.sep)){
  fail('明文制卡文件不能放在代码仓库内。');return;
 }
 // Reserve an owner-only file before issuing anything to avoid accidental overwrite.
 const fd=fs.openSync(outfile,'wx',0o600);
 let success=false;
 try{
  fs.fchmodSync(fd,0o600);
  const records=[];
  for(let i=0;i<count;i++){
   const card=createIssuedCard();
   await store.issueCardRecord({serial:card.serial,secretDigest:card.secretDigest,
      secretVersion:card.secretVersion,batchId,issuerId:issuer,authorizationRef,
      deliveryChannel:channel,reservedForUserId:reservedForUserId||null});
   // Printed password remains only in the operator-owned, 0600 offline file.
   records.push({batchId,serial:card.serial,password:card.password,channel,
     reservedForUserId:reservedForUserId||null});
  }
  fs.writeFileSync(fd,JSON.stringify({batchId,issued:records.length,cards:records},null,2)+'\n');
  fs.fsyncSync(fd);success=true;
  process.stdout.write(JSON.stringify({batchId,issued:records.length,channel,
   file:outfile,warning:'请离线安全印制并销毁明文暂存文件；不可上传 GitHub 或云端共享盘。'})+'\n');
 }finally{
  fs.closeSync(fd);
  if(!success)try{fs.unlinkSync(outfile)}catch(e){}
 }
}
main().catch(e=>fail(e.code==='PASTURE_CARD_NOT_CONFIGURED'?
 '需要独立的 PASTURE_CARD_PEPPER 密钥。':
 '请检查数据库或发行权限；部分已写入的未激活卡可能需要按批次核对。'));
