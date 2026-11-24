const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const expected=[
 ['front',409000],['back',137050],['lining',167122]
];
for(const [name,minimum] of expected){
 test('MANNA 001 image '+name+' retains full source pixels and is not a preview thumbnail',()=>{
  const bytes=fs.readFileSync(path.join(root,'manna/assets/budao-fleece-'+name+'-hq-v2.webp'));
  assert.ok(bytes.length>=minimum,'Unexpectedly tiny image '+name+': '+bytes.length);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  const p=bytes.indexOf(Buffer.from([0x9d,0x01,0x2a]));
  assert.ok(p>=0,'VP8 frame marker absent');
  assert.equal(bytes.readUInt16LE(p+3)&0x3fff,1122,'source width');
  assert.equal(bytes.readUInt16LE(p+5)&0x3fff,1402,'source height');
 });
}
test('MANNA 001 public pages do not reuse old low-resolution thumbnails',()=>{
 for(const page of ['manna/index.html','manna/goods/index.html','manna/goods/budao-gospel-fleece/index.html']){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.match(html,/budao-fleece-front-hq-v2.webp/);
  assert.ok(!/budao-fleece-(?:front|back|lining)\.webp/.test(html));
 }
 const d=fs.readFileSync(path.join(root,'manna/goods/budao-gospel-fleece/index.html'),'utf8');
 assert.ok(d.includes('budao-fleece-back-hq-v2.webp')&&d.includes('budao-fleece-lining-hq-v2.webp'));
 assert.ok(d.includes('¥204')&&d.includes('购买通道暂未开放'));
});
