const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../pasture-preview/my-grass-bible-v04.js');

test('ESV is registered as the second translation without replacing CUV default',()=>{
 assert.equal(B.translation.id,'cuv1919-shen-s');
 assert.equal(B.translations.esv.id,'esv');
 assert.equal(B.translations.esv.name,'English Standard Version (ESV)');
 assert.equal(B.translations.esv.storage,'reference-only');
 assert.equal(B.translations.esv.endpoint,'/api/bible-esv');
});

test('Chinese navigation state converts to canonical English ESV references',()=>{
 assert.equal(B.toEnglishReference('约 3:16'),'John 3:16');
 assert.equal(B.toEnglishReference('路 6:1–11'),'Luke 6:1-11');
 assert.equal(B.toEnglishReference('诗 23'),'Psalms 23');
 assert.equal(B.bookMeta('启').english,'Revelation');
});

test('ESV loader calls only the same-origin proxy and returns reference-only payload',async()=>{
 let requested='';
 const fakeFetch=async url=>{
  requested=String(url);
  return {ok:true,status:200,json:async()=>({ok:true,canonical:'John 3:16',text:'For God so loved the world… (ESV)',copyright:'ESV'})};
 };
 const passage=await B.loadTranslationPassage('约 3:16','esv',fakeFetch);
 assert.equal(requested,'/api/bible-esv?reference=John%203%3A16');
 assert.deepEqual(passage,{
  reference:'约 3:16',
  canonical:'John 3:16',
  translation:'English Standard Version (ESV)',
  source:'esv',
  storage:'reference-only',
  verseIds:['JHN.3.16'],
  text:'For God so loved the world… (ESV)',
  copyright:'ESV'
 });
});

test('ESV loader surfaces an unconfigured API key cleanly',async()=>{
 const fakeFetch=async()=>({ok:false,status:503,json:async()=>({ok:false,reason:'esv_not_configured'})});
 await assert.rejects(()=>B.loadTranslationPassage('约 3:16','esv',fakeFetch),/ESV API 尚未配置/);
});

test('ESV server proxy requires server-side key and sends Crossway copyright-safe parameters',async()=>{
 const oldKey=process.env.ESV_API_KEY;
 const oldFetch=global.fetch;
 process.env.ESV_API_KEY='test-secret-key';
 let upstreamUrl='',upstreamAuth='';
 global.fetch=async(url,options)=>{
  upstreamUrl=String(url);upstreamAuth=options.headers.Authorization;
  return {ok:true,status:200,json:async()=>({canonical:'John 3:16',passages:['For God so loved the world… (ESV)']})};
 };
 const handler=require('../api/bible-esv.js');
 const response=mockResponse();
 await handler({method:'GET',query:{reference:'John 3:16'},headers:{'x-forwarded-for':'127.0.0.1'}},response);
 assert.equal(response.statusCode,200);
 assert.equal(upstreamAuth,'Token test-secret-key');
 const parsed=new URL(upstreamUrl);
 assert.equal(parsed.origin,'https://api.esv.org');
 assert.equal(parsed.pathname,'/v3/passage/text/');
 assert.equal(parsed.searchParams.get('q'),'John 3:16');
 assert.equal(parsed.searchParams.get('include-short-copyright'),'true');
 assert.equal(parsed.searchParams.get('include-footnotes'),'false');
 assert.equal(parsed.searchParams.get('include-headings'),'false');
 assert.equal(response.body.text,'For God so loved the world… (ESV)');
 global.fetch=oldFetch;
 if(oldKey===undefined)delete process.env.ESV_API_KEY; else process.env.ESV_API_KEY=oldKey;
});

test('ESV server proxy refuses to operate when the Crossway key is absent',async()=>{
 const oldKey=process.env.ESV_API_KEY;
 delete process.env.ESV_API_KEY;
 delete require.cache[require.resolve('../api/bible-esv.js')];
 const handler=require('../api/bible-esv.js');
 const response=mockResponse();
 await handler({method:'GET',query:{reference:'John 3:16'},headers:{'x-forwarded-for':'127.0.0.2'}},response);
 assert.equal(response.statusCode,503);
 assert.equal(response.body.reason,'esv_not_configured');
 if(oldKey!==undefined)process.env.ESV_API_KEY=oldKey;
});

function mockResponse(){
 return {
  statusCode:0,headers:{},body:null,
  setHeader(name,value){this.headers[name]=value},
  status(code){this.statusCode=code;return this},
  json(body){this.body=body;return this}
 };
}
