const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PASTURE_SESSION_SECRET = process.env.PASTURE_SESSION_SECRET || 'test-secret-abcdefghijklmnopqrstuvwxyz-123456';
const store = require('../api/_security/pasture-auth-store');
const handler = require('../api/_security/pasture-auth-handler');

function responseStub(){
  return {headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v},status(code){this.statusCode=code;return this},json(value){this.body=value;return this}};
}
function requestStub(){return {headers:{cookie:'budao_pasture_session=test-token','user-agent':'test'}}}
const appearance={version:2,woolColor:'cloudWhite',faceColor:'warmTaupe',woolShape:'soft',bodyShape:'standard',ears:'medium',expression:'calm',marking:'none',forelock:'none'};

test('saveSheep returns V2 appearance and passes normalized V2 to store', async () => {
  const originalSession=store.sessionByTokenHash, originalSave=store.saveSheep;
  let received=null;
  try{
    store.sessionByTokenHash=async()=>({user:{id:'u1',emailMasked:'to***@example.com',createdAt:'2026-10-11'}});
    store.saveSheep=async(userId,normalized)=>{received=normalized;return {created:true,sheep:{id:'s1',bodyColor:'#eee8dc',headColor:'#8d836e',marking:'NONE',appearanceVersion:2,appearanceV2:appearance,createdAt:'2026-10-11'}}};
    const res=responseStub();
    await handler._test.saveSheep(requestStub(),res,{action:'saveSheep',appearanceVersion:2,appearance});
    assert.equal(res.statusCode,200);
    assert.equal(received.appearanceVersion,2);
    assert.deepEqual(received.v2,appearance);
    assert.equal(res.body.created,true);
    assert.equal(res.body.user.sheep.appearanceVersion,2);
    assert.deepEqual(res.body.user.sheep.appearance,appearance);
  }finally{store.sessionByTokenHash=originalSession;store.saveSheep=originalSave}
});

test('created false is preserved so arrival cannot replay on re-save', async () => {
  const originalSession=store.sessionByTokenHash, originalSave=store.saveSheep;
  try{
    store.sessionByTokenHash=async()=>({user:{id:'u1',emailMasked:'to***@example.com',createdAt:'2026-10-11'}});
    store.saveSheep=async()=>({created:false,sheep:{id:'s1',bodyColor:'#eee8dc',headColor:'#8d836e',marking:'NONE',appearanceVersion:2,appearanceV2:appearance,createdAt:'2026-10-11'}});
    const res=responseStub();
    await handler._test.saveSheep(requestStub(),res,{action:'saveSheep',appearanceVersion:2,appearance});
    assert.equal(res.body.created,false);
  }finally{store.sessionByTokenHash=originalSession;store.saveSheep=originalSave}
});

test('invalid V2 is rejected before store save', async () => {
  const originalSession=store.sessionByTokenHash, originalSave=store.saveSheep;
  let called=false;
  try{
    store.sessionByTokenHash=async()=>({user:{id:'u1',emailMasked:'to***@example.com',createdAt:'2026-10-11'}});
    store.saveSheep=async()=>{called=true;throw new Error('should not save')};
    const res=responseStub();
    await assert.rejects(()=>handler._test.saveSheep(requestStub(),res,{action:'saveSheep',appearanceVersion:2,appearance:{...appearance,ears:'horns'}}),e=>e.code==='INVALID_SHEEP');
    assert.equal(called,false);
  }finally{store.sessionByTokenHash=originalSession;store.saveSheep=originalSave}
});
