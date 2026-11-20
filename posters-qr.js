(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BudaoPosterQR = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // Detect the printed QR block inside messenger screenshot images. Never
  // synthesize or recolor the QR: all drawn pixels come from its source image.
  // An uncertain detection uses the complete image, without stretching.
  const cache = new WeakMap();

  function dimensions(source) {
    return {
      width: Number(source && (source.naturalWidth || source.width)) || 0,
      height: Number(source && (source.naturalHeight || source.height)) || 0
    };
  }

  function longestDenseSpan(counts, threshold, allowableGap) {
    let start = -1, lastDense = -1, best = null;
    function record() {
      if (start < 0 || lastDense < 0) return;
      const candidate = { start, end: lastDense + 1, length: lastDense + 1 - start };
      if (!best || candidate.length > best.length) best = candidate;
    }
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] >= threshold) {
        if (start < 0) start = i;
        lastDense = i;
      } else if (start >= 0 && i - lastDense > allowableGap) {
        record();
        start = -1;
        lastDense = -1;
      }
    }
    record();
    return best;
  }

  function locatePixels(data, width, height) {
    if (!data || width < 70 || height < 70 || data.length < width * height * 4) return null;
    const cornerPoints = [[1,1], [width-2,1], [1,height-2], [width-2,height-2]];
    const bg = [0, 0, 0];
    for (const [x,y] of cornerPoints) {
      const p = (y*width+x)*4;
      for (let ch=0;ch<3;ch++) bg[ch] += data[p+ch]/4;
    }
    const cornerSpread = cornerPoints.reduce((acc,[x,y]) => {
      const p=(y*width+x)*4;
      return Math.max(acc,Math.abs(data[p]-bg[0]),Math.abs(data[p+1]-bg[1]),Math.abs(data[p+2]-bg[2]));
    },0);
    if (cornerSpread > 35) return null;
    const mask=new Uint8Array(width*height),rows=new Uint32Array(height);
    for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const k=y*width+x,p=k*4;
      const diff=Math.abs(data[p]-bg[0])+Math.abs(data[p+1]-bg[1])+Math.abs(data[p+2]-bg[2]);
      if (diff>105 && data[p+3]>160) {mask[k]=1;rows[y]++;}
    }
    const row=longestDenseSpan(rows,Math.max(8,Math.floor(width*.085)),Math.max(2,Math.round(height*.02)));
    if (!row || row.length<height*.19) return null;
    const cols=new Uint32Array(width);
    for(let y=row.start;y<row.end;y++) for(let x=0;x<width;x++) if(mask[y*width+x])cols[x]++;
    const col=longestDenseSpan(cols,Math.max(8,Math.floor(row.length*.12)),Math.max(2,Math.round(width*.02)));
    if (!col || col.length<width*.24) return null;
    const ratio=col.length/row.length;
    if(ratio<.78||ratio>1.22) return null;
    // Enough independent dark/light transitions must occur across the block:
    // a scenic photograph or colored logo should not be mistaken for a QR.
    const middleYs=[.23,.37,.53,.68,.82].map(t=>Math.floor(row.start+row.length*t));
    let transitions=0;
    for(const y of middleYs){
      let changes=0,last=mask[y*width+col.start];
      for(let x=col.start+1;x<col.end;x++){
        const bit=mask[y*width+x];
        if(bit!==last){changes++;last=bit;}
      }
      transitions+=changes;
    }
    if(transitions<40) return null;
    // Add ample source-image quiet-zone pixels around all four edges.
    const box=Math.ceil(Math.max(col.length,row.length)*1.19);
    if(box>Math.min(width,height))return null;
    const cx=(col.start+col.end)/2, cy=(row.start+row.end)/2;
    const x=Math.max(0,Math.min(width-box,Math.floor(cx-box/2)));
    const y=Math.max(0,Math.min(height-box,Math.floor(cy-box/2)));
    return {x,y,width:box,height:box};
  }

  function inspect(source) {
    if(!source || typeof source!=="object") throw Error("无效的报名二维码图片");
    if(cache.has(source))return cache.get(source);
    const size=dimensions(source);
    if(size.width<80||size.height<80)throw Error("原始报名二维码图片太小");
    const square=Math.abs(size.width-size.height)/Math.max(size.width,size.height)<.065;
    let result={mode:square?"original":"full",source:size,
      warning:square?"":"二维码原图为长方形；未能可靠识别二维码区域，已按原比例展示完整截图，请检查扫码"};
    if(!square && typeof document!=="undefined" && document.createElement){
      try{
        const scale=Math.min(1,300/Math.max(size.width,size.height));
        const w=Math.max(1,Math.floor(size.width*scale)),h=Math.max(1,Math.floor(size.height*scale));
        const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext("2d",{willReadFrequently:true});
        if(ctx){
          ctx.imageSmoothingEnabled=false;
          ctx.drawImage(source,0,0,w,h);
          const pixels=ctx.getImageData(0,0,w,h);
          const crop=locatePixels(pixels.data,w,h);
          if(crop){
            const fx=size.width/w,fy=size.height/h;
            result={mode:"detected",source:size,
              crop:{x:crop.x*fx,y:crop.y*fy,width:crop.width*fx,height:crop.height*fy},
              warning:""};
          }
        }
      }catch(_error){
        // Do not block preview: an uninspectable image is drawn uncropped.
      }
    }
    cache.set(source,result);
    return result;
  }

  function draw(ctx,source,x,y,width,height) {
    if(!ctx||!source||![x,y,width,height].every(Number.isFinite) || width<=0||height<=0){
      throw Error("二维码绘制参数无效");
    }
    const qr=inspect(source);
    ctx.save();
    ctx.fillStyle="#ffffff";
    ctx.fillRect(x,y,width,height);
    ctx.imageSmoothingEnabled=false;
    if(qr.mode==="detected"){
      const c=qr.crop;
      ctx.drawImage(source,c.x,c.y,c.width,c.height,x,y,width,height);
    }else{
      const ratio=qr.source.width/qr.source.height;
      const fitWidth=ratio>=width/height?width:height*ratio;
      const fitHeight=ratio>=width/height?width/ratio:height;
      ctx.drawImage(source,x+(width-fitWidth)/2,y+(height-fitHeight)/2,fitWidth,fitHeight);
    }
    ctx.restore();
    return qr;
  }

  return Object.freeze({inspect,draw,locatePixels});
}));