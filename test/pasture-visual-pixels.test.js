'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('resident sheep uses its own visible compositing canvas, pointer input still goes to landscape',()=>{
 const html=read('tonglu-core.html'),engine=read('pasture-resident-core.js');
 assert.match(html,/<canvas id="residentSheepLayer" width="480" height="300"/);
 assert.match(html,/#residentSheepLayer\{[^}]*z-index:4[^}]*\}/);
 assert.match(html,/#residentSheepLayer\{[^}]*pointer-events:none/);
 assert.match(html,/#environmentLayer\{[^}]*pointer-events:auto/);
 assert.match(html,/residentSheepLayer\.style\.display='none'/);
 assert.match(engine,/residentCanvas\.getContext\('2d'/);
 assert.match(engine,/Renderer\.draw\(residentCtx,x,y,s,pos\.flip,resident\.appearance\)/);
 assert.doesNotMatch(engine,/Renderer\.draw\(ctx,x,y,s,pos\.flip,resident\.appearance\)/);
 assert.match(engine,/residentCtx\.getImageData\(ox,oy,w,h\)/);
 assert.match(engine,/setInterval\(\(\)=>\{if\(resident\?\.appearance\)paintResident\(performance\.now\(\)\)\},200\)/);
 assert.match(engine,/queueMicrotask\(\(\)=>\{paintQueued=false;paintResident\(performance\.now\(\)\)\}\)/);
 assert.match(engine,/window\.__tongluResidentLastRenderError/);
 assert.match(engine,/if\(opaque===0\)return/);
 assert.match(engine,/actualPixels:true/);
 assert.match(engine,/clearResidentVisual\(\)/);
});
test('rendered sheep creates opaque pixels on independent layer, preserved through drag and cleared on sign-out',()=>{
 const sent=[],listeners={},inputListeners={},renderCalls=[];
 function context(id){
  let fills=[],clears=0;
  return {
   id,get fills(){return fills},get clears(){return clears},
   imageSmoothingEnabled:false,fillStyle:'',
   clearRect(){fills=[];clears++},
   fillRect(x,y,w,h){
    fills.push({x,y,w,h,tint:this.fillStyle});
   },
   save(){},restore(){},
   getImageData(){
    const painted=fills.some(x=>x.tint==='#f4ecdc');
    return {data:new Uint8ClampedArray([0,0,0,painted?255:0])};
   }
  };
 }
 const environmentCtx=context('environment'),sheepCtx=context('resident'),maskCtx=context('hitMask');
 const envCanvas={
  style:{display:'block',cursor:'default'},
  getContext:()=>environmentCtx,
  addEventListener:(n,fn)=>{inputListeners[n]=fn}
 };
 const sheepCanvas={style:{display:'none'},getContext:()=>sheepCtx};
 const doc={
  getElementById:n=>n==='environmentLayer'?envCanvas:n==='residentSheepLayer'?sheepCanvas:null,
  createElement:()=>({width:0,height:0,getContext:()=>maskCtx}),
  body:{appendChild(){}}
 };
 const origin='https://preview.test';
 const parent={postMessage:(data)=>sent.push(data)};
 const win={
  parent,addEventListener:(n,fn)=>{listeners[n]=fn},
  PastureSheepDNA:{validateV2:()=>false},
  PastureSheepRenderer:{
   draw(ctx,x,y,s,flip,dna){
    renderCalls.push({where:ctx.id,scale:s,x,y,color:dna.bodyColor});
    ctx.fillStyle=dna.bodyColor;ctx.fillRect(x,y,16*s,8*s);
   },
   drawMask(ctx){ctx.fillStyle='#000';ctx.fillRect(8,12,16,8)}
  }
 };
 const sandbox={
  window:win,document:doc,location:{origin},
  localStorage:{getItem:()=>null,setItem:()=>{}},
  performance:{now:()=>5000},
  queueMicrotask:fn=>fn(),
  cancelAnimationFrame:()=>{},clearTimeout:()=>{},setTimeout:()=>0,
  setInterval:(fn,ms)=>{if(ms!==200)throw Error('unexpected redraw interval');return 1},
  console
 };
 vm.runInNewContext(read('pasture-resident-core.js'),sandbox);
 assert.equal(typeof win.__tongluCoreResidentPaintV1,'function');
 win.__tongluCoreRedrawV1=()=>win.__tongluCoreResidentPaintV1();
 listeners.message({origin,source:parent,data:{
  type:'tonglu-resident-v1',resident:{
   id:'test-resident-only',sheep:{
    id:'test-sheep-only',appearanceVersion:1,
    bodyColor:'#f4ecdc',headColor:'#8d836e',marking:'NONE'
   }
  },arrival:false
 }});
 assert.equal(sheepCanvas.style.display,'block','visible dedicated canvas');
 assert.ok(renderCalls.some(x=>x.where==='resident'&&x.scale>0),'draw on dedicated canvas');
 assert.equal(renderCalls.some(x=>x.where==='environment'),false,'do not draw resident under weather');
 assert.ok(sheepCtx.fills.some(x=>x.tint==='#f4ecdc'),'real nontransparent wool pixels');
 assert.ok(sent.some(x=>x.type==='tonglu-resident-painted-v1'&&x.actualPixels===true),'only acknowledges actual wool pixels');
 assert.equal(win.__tongluFlockCount,45);
 assert.ok(win.BudaoResidentSheepLocator.position().opaquePixels>0);
 listeners.message({origin,source:parent,data:{type:'tonglu-resident-clear-v1'}});
 assert.equal(sheepCanvas.style.display,'none','no previous resident painted after logout');
 assert.equal(sheepCtx.fills.length,0);
 assert.equal(win.__tongluFlockCount,44);
});
test('nontransparent-pixel proof reaches the same-origin diagnostic UI',()=>{
 const bridge=read('pasture-preview/tonglu-final-bridge.html');
 const gate=read('pasture-preview/pasture-resident-gate.js');
 const diag=read('pasture-preview/pasture-sheep-check.js');
 assert.match(bridge,/actualPixels:!!e\.data\.actualPixels/);
 assert.match(gate,/actualPixels:!!event\.data\.actualPixels/);
 assert.match(diag,/羊像素验证/);
 assert.match(diag,/actualPixels=state\.actualPixels\|\|!!event\.data\.actualPixels/);
 assert.match(diag,/只读/);
 assert.doesNotMatch(diag,/activateCard|action:'saveSheep'/);
});
