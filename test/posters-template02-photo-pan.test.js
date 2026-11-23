"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.resolve(__dirname,"../posters/template-02.html"),"utf8");
const sixth=fs.readFileSync(path.resolve(__dirname,"../posters/template-06.html"),"utf8");
function getCrop(){
 const first=html.indexOf("function footprintCrop("),last=html.indexOf("function fitFootprint(",first);
 assert.ok(first>0&&last>first,"footprint crop function must exist");
 const sandbox={};
 vm.runInNewContext(html.slice(first,last),sandbox);
 return sandbox.footprintCrop;
}
const crop=getCrop();
function geometry(photo,x,y){
 const r=crop(photo,x,y);
 const b={left:145,top:0,right:640,bottom:1095};
 const tolerance=.01;
 assert.ok(r.x<=b.left+tolerance,"left edge must never be exposed");
 assert.ok(r.y<=b.top+tolerance,"top edge must never be exposed");
 assert.ok(r.x+r.width>=b.right-tolerance,"right edge must never be exposed");
 assert.ok(r.y+r.height>=b.bottom-tolerance,"bottom edge must never be exposed");
 assert.ok(Math.abs(r.width/r.height-photo.width/photo.height)<1e-8,"aspect ratio preserved");
 assert.ok([r.x,r.y,r.width,r.height].every(Number.isFinite));
 return r;
}

test("02 pan controls match 06 semantics: 0..100, step 5, 50 center",()=>{
 for(const id of ["horizontal","vertical"]){
  assert.match(html,new RegExp('<input type="range" id="'+id+'" min="0" max="100" step="5" value="50"'));
  assert.match(sixth,new RegExp('<input type="range" id="'+id+'" min="0" max="100" step="5" value="50"'));
  assert.match(html,new RegExp('<output id="'+id+'Val"'));
 }
});
test("independent horizontal and vertical panning",()=>{
 const photo={width:1920,height:1080};
 const a=geometry(photo,0,50),b=geometry(photo,50,50),c=geometry(photo,100,50);
 assert.ok(a.x>b.x&&b.x>c.x);
 assert.equal(a.y,b.y);assert.equal(b.y,c.y);
 const top=geometry(photo,50,0),bottom=geometry(photo,50,100);
 assert.ok(top.y>b.y&&b.y>bottom.y);
 assert.equal(top.x,b.x);assert.equal(bottom.x,b.x);
});
test("all four extreme corners cover original cutout for landscape, portrait, square and panoramas",()=>{
 for(const p of [
  {width:1920,height:1080},{width:1080,height:1920},
  {width:1600,height:1600},{width:3264,height:2448},
  {width:4000,height:800},{width:800,height:4000}
 ]){
  for(const x of [0,50,100])for(const y of [0,50,100])geometry(p,x,y);
 }
});
test("corrupt input dimensions fail instead of producing broken Canvas image",()=>{
 assert.throws(()=>crop({width:0,height:1080},50,50),/无有效尺寸/);
 assert.throws(()=>crop({width:1280,height:0},50,50),/无有效尺寸/);
});
test("02 keeps original footprint clip, transform, ink and stable QR draw position",()=>{
 const photoBlock=html.slice(html.indexOf("function fitFootprint(photo){"),html.indexOf("function metadata(",html.indexOf("function fitFootprint(photo){")));
 assert.match(photoBlock,/c\.translate\(-90,205\);c\.scale\(\.82,\.82\)/);
 assert.match(photoBlock,/c\.clip\(FOOT_FILL\)/);
 assert.match(photoBlock,/c\.drawImage\(photo,crop\.x,crop\.y,crop\.width,crop\.height\)/);
 assert.match(photoBlock,/c\.fill\(FOOT_INK,"evenodd"\)/);
 assert.match(html,/BudaoPosterQR\.draw\(c,qr,838,1255,162,162\)/);
 assert.equal((html.match(/BudaoPosterQR\.draw\(/g)||[]).length,1);
});
test("reset returns original route photo, both axes to center and original theme/font",()=>{
 assert.match(html,/resetPhoto\.addEventListener\("click"/);
 assert.match(html,/horizontal\.value="50";vertical\.value="50"/);
 assert.match(html,/themePicker\.value="pilgrim";fontPicker\.value="song"/);
 assert.match(html,/activePhoto=assets\?\.photo\|\|null/);
 assert.match(html,/localPhoto\.value=""/);
});
test("locally uploaded photo enters identical crop and only updates preview",()=>{
 assert.match(html,/id="localPhoto" accept="image\/jpeg,image\/png,image\/webp"/);
 assert.match(html,/file\.size>24\*1024\*1024/);
 assert.match(html,/createImageBitmap\(file\)/);
 assert.match(html,/activePhoto=bitmap/);
 assert.match(html,/draw\(activePhoto\|\|assets\.photo,assets\.qr,assets\.logo\)/);
 assert.match(html,/if\(token!==photoSelectionToken\)/);
});
test("pan input updates outputs and rerenders without touching source QR binding",()=>{
 assert.match(html,/for\(const axis of \[horizontal,vertical\]\)axis\.addEventListener\("input"/);
 assert.match(html,/updatePanLabels\(\);\s*safeRedraw\(\)/);
 assert.match(html,/const SOURCE=\{photo:R\.photo,qr:R\.qr,logo:R\.logo\}/);
 assert.doesNotMatch(html,/URL\.createObjectURL\(.*qr/);
});
test("02 inline scripts compile and QR remains a separate image parameter",()=>{
 const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
 assert.ok(inline.length);
 inline.forEach(m=>assert.doesNotThrow(()=>new vm.Script(m[1])));
 assert.match(html,/function draw\(photo,qr,logo\)/);
 assert.match(html,/fitFootprint\(photo\)/);
 assert.match(html,/window\.BudaoPosterQR\.draw\(c,qr,838,1255,162,162\)/);
});
