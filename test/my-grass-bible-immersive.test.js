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
test('第一固定译本锁定为1919圣经和合本神版简体',()=>{
 assert.equal(B.translation.id,'cuv1919-shen-s');
 assert.equal(B.translation.name,'圣经和合本（神版）');
 assert.equal(B.translation.language,'zh-CN');
 assert.equal(B.translation.year,1919);
 assert.equal(B.translation.license,'Public Domain');
 assert.deepEqual(B.translation.stats,{books:66,chapters:1189,verses:31103});
});
test('经卷具有稳定OSIS与数据slug，经节ID可长期保存',()=>{
 assert.equal(B.bookMeta('创').osis,'GEN');
 assert.equal(B.bookMeta('创').slug,'genesis');
 assert.equal(B.bookMeta('路加福音').osis,'LUK');
 assert.equal(B.bookMeta('启').slug,'revelation-of-john');
 assert.equal(B.verseId('路',6,1),'LUK.6.1');
 assert.equal(B.verseId('启',22,21),'REV.22.21');
});
test('章节地址固定到已核验语料快照，不跟随上游漂移',()=>{
 assert.equal(B.translation.sourceCommit,'0bf4ed97ed6f115a37d9254d75f94bf97d0eab92');
 assert.equal(
  B.chapterUrl('创',1),
  'https://cdn.jsdelivr.net/gh/sangchy1972/pd-text-corpus@0bf4ed97ed6f115a37d9254d75f94bf97d0eab92/bibles/zh-Hans/books/genesis/chapters/1.json'
 );
});
test('已载入章节可按经文范围抽取，整章和越界都由真实节数决定',()=>{
 const chapter={verses:[
  {verse:1,text:'起初，神创造天地。'},
  {verse:2,text:'地是空虚混沌，渊面黑暗；神的灵运行在水面上。'},
  {verse:3,text:'神说：「要有光」，就有了光。'}
 ]};
 assert.deepEqual(B.extractPassage('创',1,chapter,1,2,false),{
  reference:'创 1:1–2',
  translation:'圣经和合本（神版）',
  source:'cuv1919-shen-s',
  verseIds:['GEN.1.1','GEN.1.2'],
  verses:[chapter.verses[0],chapter.verses[1]],
  text:'起初，神创造天地。\n地是空虚混沌，渊面黑暗；神的灵运行在水面上。'
 });
 assert.equal(B.extractPassage('创',1,chapter,1,1,true).reference,'创 1');
 assert.throws(()=>B.extractPassage('创',1,chapter,1,4,false),/本章只有 3 节/);
});
test('我的牧草正文层使用固定译本自动载入，不再要求手工录入经文',()=>{
 const app=fs.readFileSync(path.join(base,'my-grass-v1.js'),'utf8');
 assert.match(app,/B\.loadPassage\(/);
 assert.match(app,/B\.translation\.name/);
 assert.doesNotMatch(app,/在这里录入今日阅读的经文/);
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
