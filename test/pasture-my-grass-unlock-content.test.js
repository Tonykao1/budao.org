'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('approved V0.4 content is present in the delivered functional zone, not replaced by a blank shell',()=>{
 const zone=read('pasture-preview/function-zone.html'),html=read('pasture-preview/index.html');
 assert.match(zone,/<section class="book-layer" id="bookLayer"/);
 assert.match(zone,/<div class="book-object">/);
 assert.match(zone,/my-grass-immersive-v04\.css/);
 assert.match(zone,/my-grass-folio-v04\.js/);
 assert.match(zone,/my-grass-bible-v04\.js/);
 assert.match(zone,/my-grass-v1\.js/);
 assert.match(zone,/my-grass-core\.js/);
 assert.match(html,/const localLoader=/);
 assert.match(html,/fetch\('\.\/function-zone\.html'/);
 assert.match(html,/pasture-grass-request-from-shell-v1/);
 const auth=read('pasture-preview/pasture-resident-auth.js');
 assert.match(auth,/const d=await call\(null,'GET'\)/);
 assert.match(auth,/if\(!user\.cardActivated\)/);
 assert.match(auth,/pasture-open-grass-after-check-v1/);
 const folio=read('pasture-preview/my-grass-folio-v04.js');
 assert.match(folio,/grassPixelFolio/);
 const reading=read('pasture-preview/my-grass-reading-v1.js');
 assert.match(reading,/CUV_NAME='圣经和合本（神版）'/);
 assert.match(reading,/B\.loadChapter/);
});

test('server-verified custom event opens the real three-stage folio, not only its surrounding frame',()=>{
 const listeners=new Map(),docListeners=new Map(),stored=new Map();
 const add=(map,k,fn)=>{if(!map.has(k))map.set(k,[]);map.get(k).push(fn)};
 const bodyClasses=new Set(),classList={
  contains:k=>bodyClasses.has(k),add:k=>bodyClasses.add(k),remove:k=>bodyClasses.delete(k)
 };
 const foot={querySelector:()=>null,prepend(){}};
 const root={
  id:'',hidden:false,innerHTML:'',style:{},setAttribute(){},
  querySelector(sel){return sel==='.gs-foot'&&this.innerHTML.includes('gs-foot')?foot:null},
  addEventListener(){},appendChild(){}
 };
 const book={appendChild(n){if(n.id==='grassWorkspace')globalRoot=n},insertBefore(){}};
 let globalRoot=null;
 const entry={classList:{add(){},remove(){}},addEventListener:(k,fn)=>add(docListeners,'entry:'+k,fn)};
 const store={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
 const doc={
  body:{classList},
  querySelector:sel=>sel==='#bookLayer .book-object'?book:null,
  getElementById:id=>id==='grassBookBtn'?entry:id==='refDisplay'?{textContent:'路 6:1–11'}:null,
  createElement:tag=>tag==='section'?root:{dataset:{},className:'',textContent:'',type:'',setAttribute(){}},
  addEventListener:(k,fn)=>add(docListeners,k,fn),
  dispatchEvent(){},
 };
 let granted=false;
 const gate={
  canUseGrass:()=>granted,
  getResident:()=>granted?{id:'b0b0b0b0-1111-2222-3333-444444444444'}:null
 };
 const window={
  MyGrassCore:require('../pasture-preview/my-grass-core.js'),
  MyGrassBible:require('../pasture-preview/my-grass-bible-v04.js'),
  PastureResidentGate:gate,
  crypto:{randomUUID:()=>'00000000-0000-4000-8000-000000000111'},
  localStorage:store,
  addEventListener:(k,fn)=>add(listeners,k,fn)
 };
 window.parent=window;
 const run=(map,key,evt)=>{for(const fn of map.get(key)||[])fn(evt)};
 const sandbox={window,document:doc,console,Date,Math,
  localStorage:store,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},performance:{now:()=>1000}
 };
 vm.runInNewContext(read('pasture-preview/my-grass-v1.js'),sandbox,{filename:'my-grass-v1.js'});
 assert.ok(globalRoot,'folio workspace mounted in approved book');
 assert.equal(globalRoot.hidden,true,'private folio initially locked');
 assert.doesNotMatch(globalRoot.innerHTML,/今日经文/,'no private content without entitlement');
 // A fresh, verified user is synchronized while the book is still shut.
 granted=true;run(docListeners,'pasture-resident-access-changed',{detail:{cardActivated:true}});
 assert.doesNotMatch(globalRoot.innerHTML,/今日经文/,'not rendered behind the closed folio');
 bodyClasses.add('grassbook-open');
 // This event comes from the authenticated shell AFTER it opens the real book.
 run(listeners,'pasture-open-grass-after-check-v1',{});
 assert.equal(globalRoot.hidden,false,'verified resident workspace displayed');
 assert.match(globalRoot.innerHTML,/gs-head/);
 assert.match(globalRoot.innerHTML,/读经/);
 assert.match(globalRoot.innerHTML,/领受/);
 assert.match(globalRoot.innerHTML,/牧养/);
 assert.match(globalRoot.innerHTML,/今日经文/);
 assert.match(globalRoot.innerHTML,/今日读经/);
 assert.match(globalRoot.innerHTML,/翻阅档案/);
 assert.match(globalRoot.innerHTML,/选经文/);
 assert.match(globalRoot.innerHTML,/ORIGINAL VOICE/);
 run(listeners,'pasture-open-grass-after-check-v1',{});
 assert.match(globalRoot.innerHTML,/今日经文/,'reopening does not lose loaded modules');
 granted=false;run(docListeners,'pasture-resident-access-changed',{detail:{cardActivated:false}});
 assert.equal(globalRoot.hidden,true,'revoking server grant hides private content');
 assert.equal(globalRoot.innerHTML,'','logout clears visible private content');
 assert.ok([...stored.keys()].every(k=>!k.includes('cardActivated')),'no fake card entitlement stored');
});
