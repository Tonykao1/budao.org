"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const zlib=require("node:zlib");
const test=require("node:test");
const root=path.join(__dirname,"..");
const qr=require("../posters-qr");

function imageData(width,height,color=[255,255,255]) {
  const result=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<result.length;i+=4){
    result[i]=color[0];result[i+1]=color[1];result[i+2]=color[2];result[i+3]=255;
  }
  return result;
}
function pixel(bytes,width,x,y,r,g,b){
  const i=(y*width+x)*4;
  bytes[i]=r;bytes[i+1]=g;bytes[i+2]=b;
}
function syntheticScreenshot(){
  const w=220,h=300,bytes=imageData(w,h);
  // The header, avatar and footer must NOT be confused with the QR body.
  for(let y=12;y<44;y++)for(let x=9;x<42;x++)pixel(bytes,w,x,y,90,75,65);
  for(let y=262;y<267;y++)for(let x=49;x<169;x++)pixel(bytes,w,x,y,179,180,184);
  for(let y=93;y<223;y++)for(let x=45;x<175;x++){
    const dark=((Math.floor((x-45)/4)*13+Math.floor((y-93)/4)*17)%9)<5;
    if(dark)pixel(bytes,w,x,y,241,89,34);
  }
  return {w,h,bytes};
}

function decodeRGBA(file) {
  const png=fs.readFileSync(file);
  assert.equal(png.subarray(1,4).toString("ascii"),"PNG");
  let width=0,height=0,depth=0,colorType=0;
  const chunks=[];
  for(let p=8;p+12<=png.length;){
    const len=png.readUInt32BE(p);
    const type=png.toString("ascii",p+4,p+8);
    const chunk=png.subarray(p+8,p+8+len);
    if(type==="IHDR"){
      width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);
      depth=chunk[8];colorType=chunk[9];
    }
    if(type==="IDAT")chunks.push(chunk);
    p+=len+12;
    if(type==="IEND")break;
  }
  assert.equal(depth,8);
  assert.ok([2,6].includes(colorType),"route screenshot must be RGB or RGBA");
  const channelCount=colorType===6?4:3;
  const stride=width*channelCount,unpacked=zlib.inflateSync(Buffer.concat(chunks));
  const out=new Uint8ClampedArray(width*height*4),previous=Buffer.alloc(stride);
  let offset=0;
  for(let y=0;y<height;y++){
    const filter=unpacked[offset++],row=Buffer.alloc(stride);
    for(let i=0;i<stride;i++){
      const raw=unpacked[offset++],a=i>=channelCount?row[i-channelCount]:0;
      const b=previous[i],c=i>=channelCount?previous[i-channelCount]:0;
      let guess=0;
      if(filter===1)guess=a;
      else if(filter===2)guess=b;
      else if(filter===3)guess=Math.floor((a+b)/2);
      else if(filter===4){
        const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
        guess=pa<=pb&&pa<=pc?a:pb<=pc?b:c;
      } else assert.equal(filter,0,"unknown PNG filter");
      row[i]=(raw+guess)&255;
    }
    for(let x=0;x<width;x++){
      const si=x*channelCount,di=(y*width+x)*4;
      out[di]=row[si];out[di+1]=row[si+1];out[di+2]=row[si+2];
      out[di+3]=channelCount===4?row[si+3]:255;
    }
    row.copy(previous);
  }
  return {width,height,data:out};
}
function downsample(image,limit=300){
  const ratio=Math.min(1,limit/Math.max(image.width,image.height));
  const width=Math.floor(image.width*ratio),height=Math.floor(image.height*ratio);
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=Math.min(image.width-1,Math.floor((x+.5)*image.width/width));
    const sy=Math.min(image.height-1,Math.floor((y+.5)*image.height/height));
    const src=(sy*image.width+sx)*4,dst=(y*width+x)*4;
    data[dst]=image.data[src];data[dst+1]=image.data[src+1];
    data[dst+2]=image.data[src+2];data[dst+3]=image.data[src+3];
  }
  return {width,height,data};
}

test("all six posters use the same non-distorting source QR adapter",()=>{
  for(let i=1;i<=6;i++){
    const file=path.join(root,"posters","template-"+String(i).padStart(2,"0")+".html");
    const source=fs.readFileSync(file,"utf8");
    assert.match(source,/src="\/posters-qr\.js"/);
    assert.match(source,/BudaoPosterQR\.draw\(/);
    assert.doesNotMatch(source,/Math\.abs\((?:qr|q|bitmap|bmp)\.width-(?:qr|q|bitmap|bmp)\.height\)\s*>\s*2/);
  }
  assert.match(fs.readFileSync(path.join(root,"posters-runtime.js"),"utf8"),/\/api\/routes\?scope=calendar/);
});

test("synthetic messenger screenshot's QR is identified without cutting off QR pixels",()=>{
  const {w,h,bytes}=syntheticScreenshot();
  const crop=qr.locatePixels(bytes,w,h);
  assert.ok(crop,"QR region should be detected");
  assert.ok(crop.x<=45&&crop.x+crop.width>=175);
  assert.ok(crop.y<=93&&crop.y+crop.height>=223);
  assert.ok(crop.y>44,"the avatar/header must be excluded");
  assert.equal(crop.width,crop.height);
});

test("actual 奥森南园 original WeChat PNG is 938x1340 and its QR region is safely detectable",()=>{
  const image=decodeRGBA(path.join(root,"route-assets/moses/b4519a0143702bfed6a29e946fc09acd.png"));
  assert.equal(image.width,938);
  assert.equal(image.height,1340);
  const sample=downsample(image);
  const crop=qr.locatePixels(sample.data,sample.width,sample.height);
  assert.ok(crop,"the actual published non-square screenshot must have a reliable QR crop");
  const ratioX=image.width/sample.width,ratioY=image.height/sample.height;
  const actual={x:crop.x*ratioX,y:crop.y*ratioY,w:crop.width*ratioX,h:crop.height*ratioY};
  assert.ok(actual.x<=190&&actual.x+actual.w>=740,JSON.stringify(actual));
  assert.ok(actual.y<=438&&actual.y+actual.h>=990,JSON.stringify(actual));
  assert.ok(actual.y>220,JSON.stringify(actual));
});

test("uncertain images stay uncropped and are never stretched out of aspect ratio",()=>{
  const qrSource={width:938,height:1340};
  const commands=[];
  const ctx={
    save(){},restore(){},fillRect(){},
    drawImage(...args){commands.push(args);},
    set fillStyle(_v){},set imageSmoothingEnabled(_v){}
  };
  const state=qr.draw(ctx,qrSource,30,40,200,200);
  assert.equal(state.mode,"full");
  assert.ok(state.warning);
  assert.equal(commands.length,1);
  const args=commands[0];
  assert.equal(args.length,5);
  assert.ok(Math.abs(args[3]/args[4]-938/1340)<.00001);
  assert.ok(args[1]>=30&&args[2]>=40);
  assert.ok(args[1]+args[3]<=230&&args[2]+args[4]<=240);
  assert.equal(qr.inspect({width:500,height:500}).mode,"original");
});

test("photo-like and blank images are not falsely cropped",()=>{
  const blank=imageData(220,300);
  assert.equal(qr.locatePixels(blank,220,300),null);
  const band=imageData(220,300);
  for(let y=80;y<210;y++)for(let x=30;x<188;x++)pixel(band,220,x,y,12,16,20);
  assert.equal(qr.locatePixels(band,220,300),null);
});
