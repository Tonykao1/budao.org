'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('public sheep and resident sheep share exact daylight, night and weather render inputs',()=>{
 const core=read('tonglu-core.html'),engine=read('pasture-resident-core.js');
 assert.match(core,/let darkness=0,progress=\.5,sceneTint=null/);
 assert.match(core,/sceneTint='rgba\(244,177,112,'\+\(\(\.12-edge\)\*\.75\)\+'\)'/);
 assert.match(core,/sceneTint='rgba\(18,34,70,'\+darkness\+'\)'/);
 assert.match(core,/ctx\.fillStyle=sceneTint;ctx\.fillRect\(0,0,480,300\)/);
 assert.match(core,/window\.__tongluCoreResidentPaintV1\?\.\(\{tint:sceneTint,weatherKind:kind\(c\.weatherCode\),cloud\}\)/);
 assert.match(core,/window\.__tongluCoreWeatherFxV1=\(target,type,cloud\)=>weatherFx\(type,cloud,target\)/);
 assert.match(core,/function weatherFx\(type,cloud,target=ctx\)/);
 assert.match(core,/weatherFx\(kind\(c\.weatherCode\),cloud\)/);
 assert.match(engine,/residentCtx\.globalCompositeOperation='source-atop'/);
 assert.match(engine,/residentCtx\.fillStyle=residentScene\.tint/);
 assert.match(engine,/window\.__tongluCoreWeatherFxV1\?\.\(residentCtx,residentScene\.weatherKind,residentScene\.cloud\)/);
 assert.doesNotMatch(engine,/filter:\s*brightness|shadowBlur|drop-shadow|boxShadow|globalAlpha\s*=\s*1\.5/);
});

test('night tint and weather touch only the independently drawn sheep pixels, daylight has no extra veil',()=>{
 const listeners={},events=[],weather=[],ctxs={};
 function context(name){
  const stack=[],ops=[];
  const c={name,ops,fillStyle:'',globalAlpha:1,globalCompositeOperation:'source-over',
   imageSmoothingEnabled:false,clearRect(x,y,w,h){ops.push({kind:'clear',x,y,w,h})},
   fillRect(x,y,w,h){ops.push({kind:'fill',x,y,w,h,color:this.fillStyle,mode:this.globalCompositeOperation,alpha:this.globalAlpha})},
   save(){stack.push([this.fillStyle,this.globalAlpha,this.globalCompositeOperation])},
   restore(){const last=stack.pop();if(last)[this.fillStyle,this.globalAlpha,this.globalCompositeOperation]=last},
   getImageData(){return{data:new Uint8ClampedArray([1,1,1,255])}}
  };
  ctxs[name]=c;return c;
 }
 const environmentCtx=context('environment'),residentCtx=context('resident'),maskCtx=context('mask');
 const canvases={
  environmentLayer:{style:{display:'block',cursor:'default'},getContext:()=>environmentCtx,addEventListener(){}},
  residentSheepLayer:{style:{display:'none'},getContext:()=>residentCtx}
 };
 const parent={postMessage:e=>events.push(e)},origin='https://preview.budao.test';
 const win={
  parent,
  addEventListener:(type,fn)=>{listeners[type]=fn},
  PastureSheepDNA:{validateV2:()=>false},
  PastureSheepRenderer:{
   draw(ctx,x,y,s){ctx.fillStyle='#ead8c0';ctx.fillRect(x,y,16*s,8*s)},
   drawMask(ctx){ctx.fillStyle='#000';ctx.fillRect(8,12,16,8)}
  },
  __tongluCoreWeatherFxV1:(ctx,type,cloud)=>{
    weather.push({ctx:ctx.name,type,cloud,mode:ctx.globalCompositeOperation});
    if(type!=='clear'){ctx.fillStyle='#f5fbff';ctx.fillRect(5,5,1,3)}
  }
 };
 const sandbox={
  window:win,document:{getElementById:id=>canvases[id],createElement:()=>({getContext:()=>maskCtx})},
  location:{origin},
  localStorage:{getItem:()=>null,setItem(){}},
  performance:{now:()=>5000},
  queueMicrotask:fn=>fn(),
  setInterval:()=>1,setTimeout:()=>1,clearTimeout(){},cancelAnimationFrame(){},console
 };
 assert.doesNotThrow(()=>vm.runInNewContext(read('pasture-resident-core.js'),sandbox));
 listeners.message({origin,source:parent,data:{
  type:'tonglu-resident-v1',
  resident:{id:'only-resident',sheep:{bodyColor:'#ead8c0',headColor:'#685e59',marking:'NONE'}},
  arrival:false
 }});
 assert.equal(canvases.residentSheepLayer.style.display,'block');
 assert.equal(win.__tongluFlockCount,45);
 residentCtx.ops.length=0;
 win.__tongluCoreResidentPaintV1({tint:'rgba(18,34,70,0.62)',weatherKind:'rain',cloud:91});
 assert.ok(residentCtx.ops.some(x=>x.kind==='fill'&&x.color==='#ead8c0'&&x.mode==='source-over'));
 const night=residentCtx.ops.filter(x=>x.kind==='fill'&&x.w===480&&x.h===300);
 assert.equal(night.length,1);
 assert.equal(night[0].color,'rgba(18,34,70,0.62)');
 assert.equal(night[0].mode,'source-atop');
 assert.deepEqual(weather.at(-1),{ctx:'resident',type:'rain',cloud:91,mode:'source-atop'});
 assert.ok(events.some(x=>x.type==='tonglu-resident-painted-v1'&&x.actualPixels===true));
 residentCtx.ops.length=0;
 win.__tongluCoreResidentPaintV1({tint:null,weatherKind:'clear',cloud:0});
 assert.equal(residentCtx.ops.filter(x=>x.kind==='fill'&&x.w===480&&x.h===300).length,0,'no tint under clear midday');
 assert.equal(canvases.residentSheepLayer.style.display,'block');
 residentCtx.ops.length=0;
 win.__tongluCoreResidentPaintV1({tint:'rgba(244,177,112,0.08)',weatherKind:'fog',cloud:98});
 assert.equal(residentCtx.ops.filter(x=>x.kind==='fill'&&x.w===480&&x.h===300)[0].mode,'source-atop');
 assert.deepEqual(weather.at(-1),{ctx:'resident',type:'fog',cloud:98,mode:'source-atop'});
 listeners.message({origin,source:parent,data:{type:'tonglu-resident-clear-v1'}});
 assert.equal(canvases.residentSheepLayer.style.display,'none');
 assert.equal(win.__tongluFlockCount,44);
});
