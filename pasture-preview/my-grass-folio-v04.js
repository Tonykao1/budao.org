/* My Grass V0.4 — original large-format pixel paper, not a stretched raster.
 * This decorative canvas does not alter the approved farm, original card or pastoral data.
 */
(function(){
 'use strict';
 const book=document.querySelector('#bookLayer .book-object');
 if(!book||document.getElementById('grassPixelFolio'))return;
 const canvas=document.createElement('canvas');
 canvas.id='grassPixelFolio';canvas.setAttribute('aria-hidden','true');
 book.insertBefore(canvas,book.firstChild);
 const c=canvas.getContext('2d',{alpha:false});
 let lastMobile=null;
 const ink={
  dark:'#382c22',shadow:'#17241c',binding:'#5b3e28',bindingHi:'#936740',
  page:'#ebd4a7',paperLight:'#f5e3ba',paperDeep:'#d3ad77',edge:'#986d42',
  gold:'#bd975b',moss:'#6d7b51',fiber:'#b79662'
 };
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x|0,y|0,w|0,h|0)};
 function random(seed){
  let value=seed>>>0;
  return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296};
 }
 function leaf(x,y,flip=1){
  rect(x+4*flip,y,3,4,ink.binding);
  rect(x+6*flip,y+4,3,4,ink.moss);
  rect(x+9*flip,y+6,6,3,ink.moss);
  rect(x+2*flip,y+9,8,3,'#839062');
  rect(x+12*flip,y+10,3,4,ink.moss);
  rect(x+1*flip,y+14,4,3,ink.gold);
 }
 function page(x,y,w,h,seed,edgeTowardCenter){
  const rng=random(seed);
  // Heavy stepped silhouette and cloth binding: intentionally squared pixels.
  rect(x+8,y+9,w,h,ink.shadow);
  rect(x-3,y-3,w+6,h+6,ink.binding);
  rect(x,y,w,h,ink.edge);
  rect(x+3,y+3,w-6,h-6,ink.page);
  rect(x+6,y+7,w-12,h-14,ink.paperLight);
  rect(x+7,y+9,w-14,h-18,ink.page);
  // Broad, discontinuous parchment tone bands, never a photographic gradient.
  for(let px=x+8;px<x+w-8;px+=3){
   const d=Math.min(px-x,x+w-px),shade=d<17?ink.paperDeep:d<35?ink.page:ink.paperLight;
   if(rng()>.23)rect(px,y+12,2,h-25,shade);
  }
  // Texture is drawn per 2–3 logical pixels; it scales naturally with the folio.
  for(let i=0;i<Math.round(w*h*.015);i++){
   const xx=x+12+Math.floor(rng()*(w-24)),yy=y+14+Math.floor(rng()*(h-28));
   const tone=rng();
   rect(xx,yy,tone>.88?3:2,tone>.65?2:1,
    tone>.93?'#c8a373':tone>.68?'#dbbc8c':'#efd9ad');
  }
  // A few paper fibers and tiny ink mottles give depth without hurting text contrast.
  for(let i=0;i<Math.round(w*h/370);i++){
   const xx=x+11+Math.floor(rng()*(w-22)),yy=y+12+Math.floor(rng()*(h-24));
   rect(xx,yy,3+Math.floor(rng()*5),1,rng()>.45?'#e8cda0':'#dfbf8d');
  }
  rect(x+9,y+6,w-18,2,'#f9edca');
  rect(x+9,y+h-9,w-18,2,ink.paperDeep);
  // The outer page corners are cut as pixels, rather than CSS border-radius.
  rect(x-3,y-3,7,4,ink.shadow);rect(x+w-4,y-3,7,4,ink.shadow);
  rect(x-3,y+h-1,7,4,ink.shadow);rect(x+w-4,y+h-1,7,4,ink.shadow);
  rect(x+6,y+6,3,7,ink.gold);rect(x+w-9,y+6,3,7,ink.gold);
  rect(x+6,y+h-13,3,7,ink.gold);rect(x+w-9,y+h-13,3,7,ink.gold);
  // Broken decorative edge strokes.
  for(let i=0;i<12;i++){
   const yy=y+24+i*Math.floor((h-48)/12);
   rect(edgeTowardCenter?x+w-7:x+4,yy,3,(i%3)+2,ink.gold);
  }
  // Botanical marks, restricted to margins so the writing area remains quiet.
  leaf(x+13,y+h-40,1);
  leaf(x+w-20,y+17,-1);
 }
 function paint(){
  const mobile=window.matchMedia('(max-width:820px)').matches;
  if(lastMobile!==mobile||canvas.width===0){
   canvas.width=mobile?420:800;canvas.height=mobile?650:470;lastMobile=mobile;
  }
  const W=canvas.width,H=canvas.height;
  c.imageSmoothingEnabled=false;
  rect(0,0,W,H,'#1c2c23');
  const rng=random(mobile?29092026:29092027);
  for(let i=0;i<700;i++){
   const xx=Math.floor(rng()*W),yy=Math.floor(rng()*H);
   rect(xx,yy,2,2,rng()>.5?'#25382a':'#16251d');
  }
  if(mobile){
   rect(19,19,W-32,H-29,'#101d17');
   page(17,13,W-37,H-36,20260929,false);
   // Thin single-page binding on the left.
   rect(19,25,5,H-58,ink.binding);
   for(let y=48;y<H-45;y+=38)rect(20,y,3,5,ink.bindingHi);
   return;
  }
  // Two sewn pages, landscape proportions native to the full-screen experience.
  rect(14,16,W-24,H-20,'#101f18');
  rect(18,13,W-34,H-23,ink.binding);
  page(19,14,371,H-32,20260929,true);
  page(410,14,371,H-32,20260930,false);
  // Central split is a physical seam, not a UI column gap.
  rect(390,17,20,H-39,'#745235');
  rect(392,24,16,H-51,'#a57b4d');
  rect(396,25,8,H-53,'#62432c');
  rect(397,31,2,H-66,'#c69b62');
  rect(405,31,2,H-66,'#412c1f');
  for(let y=30;y<H-30;y+=27){
   rect(393,y,3,5,'#bd965f');rect(405,y+3,2,4,'#c29a62');
  }
  // Page stitch and a restrained leaf emblem near the lower edge.
  for(let x=40;x<760;x+=17){
   const shift=Math.round(Math.sin(x*.3)*2);
   rect(x,H-14+shift,4,2,'#b08854');
  }
  leaf(368,H-52,1);
 }
 const observer=new MutationObserver(()=>{
  if(document.body.classList.contains('grassbook-open'))requestAnimationFrame(paint);
 });
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('resize',paint,{passive:true});
 if(window.ResizeObserver)new ResizeObserver(paint).observe(book);
 paint();
})();
