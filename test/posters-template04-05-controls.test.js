"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const four=fs.readFileSync(path.join(root,"posters/template-04.html"),"utf8");
const five=fs.readFileSync(path.join(root,"posters/template-05.html"),"utf8");

function extract(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0 && b>a, "missing source section: "+start);
 return source.slice(a,b);
}
const mockCtx=()=>{
 let current="400 24px sans-serif";
 const stack=[],draws=[];
 return {
  draws,
  save(){stack.push(current)},
  restore(){current=stack.pop()||current},
  set font(v){current=v},get font(){return current},
  measureText(s){
   const size=Number((current.match(/(\d+)px/)||[])[1]||24);
   const width=[...String(s)].reduce((sum,ch)=>sum+(/[\u3000-\u9fff]/u.test(ch)?size:size*.58),0);
   return {width};
  },
  fillText(...args){draws.push({text:args[0],x:args[1],y:args[2],font:current})}
 };
};
const bounds={x:103,y:274,width:874,height:691};
const cropSrc=extract(five,"function ceremonialPhotoCover(","function cover(");
const cropCtx={};vm.runInNewContext("const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));\n"+cropSrc+"this.cover=ceremonialPhotoCover;",cropCtx);
const cover=cropCtx.cover;

test("05 ceremonial poster has independent photo pan UI compatible with 06",()=>{
 for(const prop of ["horizontal","vertical"]){
  assert.match(five,new RegExp('<input id="'+prop+'" type="range" min="0" max="100" step="5" value="50"'));
  assert.match(five,new RegExp(prop+'Val'));
 }
 assert.match(five,/E\.horizontal\.value="50";E\.vertical\.value="50"/);
 assert.match(five,/E\.horizontal\.value=50;E\.vertical\.value=50/);
 assert.match(five,/for\(const \[el,out\] of \[\[E\.pattern,E\.patternVal\]/);
 assert.match(five,/E\.upload\.addEventListener\("change"/);
});

test("05 cover calculation has no uncovered edge over 6 aspect ratios, 3 zooms and 9 pan positions",()=>{
 let count=0;
 for(const photo of [
  {width:4000,height:1000},{width:1000,height:4000},{width:1600,height:900},
  {width:900,height:1600},{width:1000,height:1000},{width:1920,height:1080}
 ])for(const zoom of [1,1.25,1.55])for(const fx of [0,50,100])for(const fy of [0,50,100]){
  const q=cover(photo,bounds.x,bounds.y,bounds.width,bounds.height,zoom,fx,fy);
  assert.ok(q.x<=bounds.x+.01&&q.y<=bounds.y+.01);
  assert.ok(q.x+q.width>=bounds.x+bounds.width-.01);
  assert.ok(q.y+q.height>=bounds.y+bounds.height-.01);
  assert.ok(Math.abs(q.width/q.height-photo.width/photo.height)<1e-8);
  count++;
 }
 assert.equal(count,162);
});

test("05 pan axes are independent and at 50 reproduce the previous centered crop",()=>{
 const photo={width:1920,height:1080},center=cover(photo,103,274,874,691,1,50,50);
 const left=cover(photo,103,274,874,691,1,0,50),right=cover(photo,103,274,874,691,1,100,50);
 const top=cover(photo,103,274,874,691,1,50,0),bottom=cover(photo,103,274,874,691,1,50,100);
 assert.ok(left.x>center.x&&center.x>right.x);
 assert.ok(top.y>center.y&&center.y>bottom.y);
 assert.equal(left.y,center.y);assert.equal(right.y,center.y);
 assert.equal(top.x,center.x);assert.equal(bottom.x,center.x);
 assert.ok(Math.abs(center.x-(103+(874-center.width)/2))<.00001);
 assert.ok(Math.abs(center.y-(274+(691-center.height)/2))<.00001);
});

test("05 pan draws only inside original arch clip and retains its single-line headline",()=>{
 assert.match(five,/framePath\(x,y,w,h\);c\.clip\(\)/);
 assert.match(five,/ceremonialPhotoCover\(img,x,y,w,h,zoom,E\.horizontal\.value,E\.vertical\.value\)/);
 assert.match(five,/maxLines:1/);
 assert.doesNotMatch(five,/function titleRows\(/);
 assert.match(five,/bigTitle\(P,record,layoutGuard\)/);
});

test("04 optical poster exposes three different headline-only font presets",()=>{
 for(const style of ["optical","serif","kai"])assert.match(four,new RegExp('<option value="'+style+'"'));
 assert.match(four,/ui\.headlineFont\.addEventListener\("change",redraw\)/);
 assert.match(four,/const face=HEADLINE_FONTS\[ui\.headlineFont\.value\]/);
 assert.match(four,/face\.weight\+" "\+size\+"px "\+face\.family/);
 assert.match(four,/const baseKey=.*|function keyForBase\(/);
});

test("04 three font modes render complete title, retain original optical baseline and avoid QR zone",()=>{
 const helpers=extract(four,"function measureTracking(","function layoutDetails(");
 for(const mode of ["optical","serif","kai"]){
  const c=mockCtx(),claims=[];
  const sandbox={
   displayCtx:c,TYPEFACE:'"Arial","PingFang SC",sans-serif',
   HEADLINE_FONTS:{
    optical:{family:"Arial,sans-serif",weight:400,trackingPrimary:.155,trackingFallback:.10},
    serif:{family:"serif",weight:600,trackingPrimary:.05,trackingFallback:.035},
    kai:{family:"serif",weight:500,trackingPrimary:.035,trackingFallback:.025}
   },
   ui:{headlineFont:{value:mode}}
  };
  vm.runInNewContext(helpers,sandbox);
  for(const title of ["箭杆岭一线天小环线","北京延庆箭杆岭新发现的山间长距离步道活动"]){
   c.draws.length=0;claims.length=0;
   sandbox.teaserTitle(title,{claim:(name,box)=>claims.push(box)});
   assert.ok(c.draws.length>=title.length,"render each character");
   assert.equal(c.draws.map(r=>r.text).join(""),title);
   assert.ok(claims.every(b=>b.x>=0&&b.y>=0&&b.x+b.width<=1635));
  }
 }
});

test("04 title switch does not invalidate cached image-light fields",()=>{
 assert.match(four,/ui\.headlineFont\.addEventListener\("change",redraw\)/);
 const base=extract(four,"function keyForBase(","async function originalArtwork(");
 assert.doesNotMatch(base,/headlineFont/);
 assert.match(four,/function teaserTitle\(title,layoutGuard\)/);
});

test("QR source & draw commands remain the original templates",()=>{
 assert.match(four,/const URLS=\{photo:R\.photo,qr:R\.qr,brand:R\.logo\}/);
 assert.match(four,/window\.BudaoPosterQR\.draw\(c,qr,1635,778,152,152\)/);
 assert.match(five,/window\.BudaoPosterQR\.draw\(c,qr,x,qy,size,size\)/);
 assert.match(five,/const size=184,x=802,qy=1174/);
 assert.match(five,/const R=runtime\.normalized\(selected\)/);
});
test("04 and 05 HTML inline scripts stay syntactically valid",()=>{
 for(const [name,html] of [["04",four],["05",five]]){
  const codes=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(codes.length>0,name);
  for(const m of codes)assert.doesNotThrow(()=>new vm.Script(m[1]),name);
 }
});
