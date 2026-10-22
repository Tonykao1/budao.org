'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('public landscape commits an offscreen complete frame, before resident receives lighting',()=>{
 const core=read('tonglu-core.html');
 assert.match(core,/const sceneBuffer=document\.createElement\('canvas'\)/);
 assert.match(core,/const screenCtx=canvas\.getContext\('2d'\)/);
 assert.match(core,/const ctx=sceneBuffer\.getContext\('2d'\)/);
 assert.match(core,/screenCtx\.globalCompositeOperation='copy'/);
 assert.match(core,/screenCtx\.drawImage\(sceneBuffer,0,0\)/);
 const draw=core.slice(core.indexOf('function draw(){'),core.indexOf('\nfunction build(',core.indexOf('function draw(){')));
 assert.ok(draw.indexOf('publishScene();')>draw.indexOf('weatherFx(kind(c.weatherCode),cloud)'));
 assert.ok(draw.indexOf('publishScene();')<draw.lastIndexOf('window.__tongluCoreResidentPaintV1?.('));
 assert.match(core,/if\(window\.__tongluResidentDraggingV1\)return/);
 assert.match(core,/if\(window\.__tongluResidentWasDraggedV1\)/);
});

test('100 pointer movements do not trigger 100 clears, scene updates piggyback the one drag animation frame',()=>{
 const listeners={},handlers={},frames=new Map(),events=[],writes=[];
 let nextFrame=0,now=5000;
 function makeCtx(label){
  const stateStack=[];
  const c={label,fillStyle:'',globalCompositeOperation:'source-over',
   imageSmoothingEnabled:false,clearRect(){},fillRect(){},
   getImageData:()=>({data:new Uint8ClampedArray([0,0,0,255])}),
   save(){stateStack.push(this.globalCompositeOperation)},
   restore(){this.globalCompositeOperation=stateStack.pop()||'source-over'}};
  return c;
 }
 const residentCtx=makeCtx('resident'),envCtx=makeCtx('environment'),maskCtx=makeCtx('mask');
 const envCanvas={
  style:{display:'block',cursor:'default'},
  getContext:()=>envCtx,
  getBoundingClientRect:()=>({left:0,top:0,width:480,height:300}),
  addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn)},
  setPointerCapture(){},releasePointerCapture(){}
 };
 const residentCanvas={style:{display:'none'},getContext:()=>residentCtx};
 const dom={
  getElementById:id=>id==='environmentLayer'?envCanvas:id==='residentSheepLayer'?residentCanvas:null,
  createElement:()=>({width:0,height:0,getContext:()=>maskCtx}),
  body:{appendChild(){}}
 };
 const parent={postMessage:e=>events.push(e)};
 const win={
  parent,
  addEventListener:(name,fn)=>{listeners[name]=fn},
  PastureSheepDNA:{validateV2:()=>false},
  PastureSheepRenderer:{
   draw(ctx,x,y,unit){ctx.fillStyle='#ead8c0';ctx.fillRect(x,y,16*unit,8*unit)},
   drawMask(ctx){ctx.fillStyle='#000';ctx.fillRect(8,12,16,8)}
  },
  __tongluCoreWeatherFxV1:()=>{}
 };
 const origin='https://preview.budao.test';
 const sandbox={
  window:win,document:dom,location:{origin},console,
  localStorage:{getItem:()=>JSON.stringify({x:160,y:225,flip:false}),setItem:(k,v)=>writes.push([k,v])},
  performance:{now:()=>now},
  queueMicrotask:fn=>fn(),
  requestAnimationFrame:fn=>{const id=++nextFrame;frames.set(id,fn);return id},
  cancelAnimationFrame:id=>frames.delete(id),
  setInterval:()=>1,clearTimeout(){},setTimeout:()=>1
 };
 vm.runInNewContext(read('pasture-resident-core.js'),sandbox);
 listeners.message({origin,source:parent,data:{type:'tonglu-resident-v1',
  resident:{id:'owner',sheep:{bodyColor:'#ead8c0',headColor:'#786451',marking:'NONE'}},arrival:false}});
 assert.equal(residentCanvas.style.display,'block');
 const before=win.__tongluResidentRenderAttempts;
 const makeEvent=(x,id=7)=>({clientX:x,clientY:226.5,pointerId:id,preventDefault(){}});
 for(const f of handlers.pointerdown)f(makeEvent(164));
 assert.equal(win.__tongluResidentDraggingV1,true);
 for(let i=0;i<100;i++){
  for(const f of handlers.pointermove)f(makeEvent(164+i/11));
 }
 assert.equal(frames.size,1,'one queued RAF for 100 pointer moves');
 assert.equal(win.__tongluResidentRenderAttempts,before,'no immediate clear during pointer events');
 win.__tongluCoreResidentPaintV1({tint:'rgba(18,34,70,0.45)',weatherKind:'clear',cloud:0});
 assert.equal(frames.size,1,'public scene does not force second resident frame during drag');
 assert.equal(win.__tongluResidentRenderAttempts,before);
 now+=16;
 for(const [id,fn] of Array.from(frames)){frames.delete(id);fn(now)}
 assert.equal(win.__tongluResidentRenderAttempts,before+1,'latest sheep position painted only once');
 assert.equal(residentCanvas.style.display,'block');
 assert.equal(win.__tongluResidentLastRenderError,null);
 // Prevent an audio construction in this Node test without changing production sound.
 // The audio call catches unavailable browser Audio internally.
 for(const f of handlers.pointerup)f(makeEvent(173));
 assert.equal(win.__tongluResidentDraggingV1,false);
 assert.equal(frames.size,0);
 assert.equal(writes.length,1,'release still persists the exact resident position');
 assert.equal(residentCanvas.style.display,'block');
});
