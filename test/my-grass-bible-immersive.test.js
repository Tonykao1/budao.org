const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const B=require('../pasture-preview/my-grass-bible-v04.js');
const base=path.join(__dirname,'..','pasture-preview');
test('导航保留旧约39卷与新约27卷，书卷无重复',()=>{
 assert.equal(B.groups.old.length,39);
 assert.equal(B.groups.new.length,27);
 assert.equal(new Set([...B.groups.old,...B.groups.new].map(([v])=>v)).size,66);
});
test('诗篇150篇、单章书卷、所有福音书等章节上限准确',()=>{
 assert.equal(B.resolve('诗篇')[2],150);
 assert.equal(B.resolve('俄')[2],1);
 assert.equal(B.resolve('门')[2],1);
 assert.equal(B.resolve('约贰')[2],1);
 assert.equal(B.resolve('太')[2],28);
 assert.equal(B.resolve('路')[2],24);
 assert.equal(B.resolve('启')[2],22);
 assert.equal(B.clampChapter('诗',200),150);
 assert.equal(B.clampChapter('太',0),1);
});
test('旧导航格式得到保留，支持节范围、单节与整章',()=>{
 assert.equal(B.format('诗',23,1,6),'诗 23:1–6');
 assert.equal(B.format('太',7,13,14),'太 7:13–14');
 assert.equal(B.format('约',15,4,4),'约 15:4');
 assert.equal(B.format('诗篇',119,1,1,true),'诗 119');
 assert.deepEqual(B.parse('诗 23:1–6'),{testament:'old',book:'诗',chapter:23,start:1,end:6,whole:false});
 assert.equal(B.parse('路 6:1–11').book,'路');
 assert.equal(B.parse('诗篇 119').whole,true);
 assert.equal(B.parse('玛 9:1'),null);
 assert.throws(()=>B.format('约',999,177,178),/节数/);
});
test('immersive treatment is scoped to 我的牧草, with original pixel farm and other modules unchanged',()=>{
 const css=fs.readFileSync(path.join(base,'my-grass-immersive-v04.css'),'utf8');
 const folio=fs.readFileSync(path.join(base,'my-grass-folio-v04.js'),'utf8');
 const page=fs.readFileSync(path.join(base,'function-zone.html'),'utf8');
 assert.match(css,/body\.grassbook-open \.book-layer/);
 assert.match(css,/96vw/);
 assert.match(css,/92dvh/);
 assert.match(css,/font:400 clamp\(16px/);
 assert.match(folio,/grassPixelFolio/);
 assert.match(folio,/const mobile=window\.matchMedia/);
 assert.match(page,/my-grass-immersive-v04\.css/);
 assert.match(page,/my-grass-folio-v04\.js/);
 assert.match(page,/my-grass-bible-v04\.js/);
});
