/* BUDAO Poster Layout Engine v1.
 * Pure layout/validation utilities shared by six art-directed Canvas posters.
 * No pixels or QR images are modified by this module.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BudaoPosterLayout = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function () {
  "use strict";
  const EPSILON = 0.5;
  const asText = value => value == null ? "" : String(value).trim();
  function letters(value) {
    const source = asText(value);
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
      return Array.from(segmenter.segment(source), item => item.segment);
    }
    return Array.from(source);
  }
  function getFont(options, size) {
    const o = options || {};
    return (o.weight || 400) + " " + size + "px " +
      (o.family || '"PingFang SC","Noto Sans CJK SC",sans-serif');
  }
  function measured(ctx, text, font) {
    if (!ctx || typeof ctx.measureText !== "function") throw Error("Canvas 文字测量上下文不可用");
    ctx.save();
    try {
      ctx.font = font;
      const m = ctx.measureText(asText(text));
      return {width:m.width, ascent:m.actualBoundingBoxAscent, descent:m.actualBoundingBoxDescent};
    } finally { ctx.restore(); }
  }
  function wrap(ctx, value, font, maxWidth) {
    if (!(maxWidth > 0)) throw Error("文字区域宽度必须大于零");
    const words = letters(value), lines = [];
    if (!words.length) return [];
    ctx.save();
    try {
      ctx.font = font;
      let row = "";
      for (const letter of words) {
        if (letter === "\n") { lines.push(row); row = ""; continue; }
        if (ctx.measureText(letter).width > maxWidth + EPSILON) throw Error("文字中存在比当前排版栏更宽的字符");
        if (row && ctx.measureText(row + letter).width > maxWidth + EPSILON) {
          lines.push(row.trimEnd());
          row = /^\s$/.test(letter) ? "" : letter;
        } else row += letter;
      }
      if (row || !lines.length) lines.push(row.trimEnd());
      return lines;
    } finally { ctx.restore(); }
  }
  function addEllipsis(ctx, row, font, maxWidth) {
    let text = asText(row);
    while (text && measured(ctx, text + "…", font).width > maxWidth + EPSILON) {
      text = letters(text).slice(0, -1).join("");
    }
    if (measured(ctx, "…", font).width > maxWidth + EPSILON) throw Error("当前排版栏无法显示省略号");
    return text + "…";
  }
  function fit(ctx, value, options) {
    const o = options || {}, source = asText(value);
    const label = asText(o.label) || "文字";
    const size = o.size ?? 32, minimum = o.minSize ?? Math.min(size, 18),
      maxLines = o.maxLines ?? 1, maxWidth = o.maxWidth;
    if (!Number.isFinite(size) || !Number.isFinite(minimum) || minimum <= 0 || size < minimum ||
        !Number.isInteger(maxLines) || maxLines < 1 || !(maxWidth > 0)) {
      throw Error(label + "的排版参数不合法");
    }
    if (!source) {
      if (o.required) throw Error(label + "不能为空");
      return {size, font:getFont(o,size), lines:[], truncated:false, height:0};
    }
    for (let px = size; px >= minimum; px -= 1) {
      const font = getFont(o,px), rows = wrap(ctx, source, font, maxWidth);
      if (rows.length <= maxLines) return {
        size:px, font, lines:rows, truncated:false,
        height:rows.length * (o.lineHeight || px * 1.25),
        widths:rows.map(row=>measured(ctx,row,font).width)
      };
    }
    if (!o.allowEllipsis) throw Error(label + "过长，无法在当前模板的可读字号内完整排入");
    const font = getFont(o,minimum), full = wrap(ctx,source,font,maxWidth),
      sliced = full.slice(0,maxLines);
    if (!sliced.length) throw Error(label + "无法排入");
    sliced[sliced.length-1] = addEllipsis(ctx,sliced[sliced.length-1],font,maxWidth);
    return {
      size:minimum,font,lines:sliced,truncated:true,
      height:sliced.length*(o.lineHeight || minimum*1.25),
      widths:sliced.map(row=>measured(ctx,row,font).width)
    };
  }
  function rect(x,y,width,height) {
    if (![x,y,width,height].every(Number.isFinite) || width<=0 || height<=0) {
      throw Error("Canvas 排版保护区坐标不合法");
    }
    return {x,y,width,height};
  }
  function intersects(a,b,padding=0) {
    return a.x < b.x+b.width+padding-EPSILON &&
      a.x+a.width > b.x-padding+EPSILON &&
      a.y < b.y+b.height+padding-EPSILON &&
      a.y+a.height > b.y-padding+EPSILON;
  }
  function rotateRect(value, angle, cx, cy) {
    if (!angle) return value;
    const rad=angle*Math.PI/180, c=Math.cos(rad),s=Math.sin(rad);
    const coords=[
      [value.x,value.y],
      [value.x+value.width,value.y],
      [value.x,value.y+value.height],
      [value.x+value.width,value.y+value.height]
    ].map(([x,y])=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c]);
    const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
    const x=Math.min(...xs),y=Math.min(...ys);
    return rect(x,y,Math.max(...xs)-x,Math.max(...ys)-y);
  }
  function textRect(ctx, value, options) {
    const o=options||{}, font=o.font || getFont(o,o.size||24);
    const m=measured(ctx,value,font);
    const fallback=Number((font.match(/(\d+(?:\.\d+)?)px/)||[])[1]) || 24;
    const ascent=Number.isFinite(m.ascent)?m.ascent:fallback*.85;
    const descent=Number.isFinite(m.descent)?m.descent:fallback*.22;
    const x=o.align==="center"?o.x-m.width/2:o.align==="right"?o.x-m.width:o.x;
    const box=rect(x,o.y-ascent,Math.max(m.width,.1),Math.max(ascent+descent,.1));
    return rotateRect(box,o.angle||0,o.pivotX ?? o.x,o.pivotY ?? o.y);
  }
  function createGuard(ctx, options) {
    const o=options||{}, W=o.width || ctx.canvas?.width,H=o.height || ctx.canvas?.height;
    if (!(W>0 && H>0)) throw Error("Canvas 宽高不合法");
    const zones=new Map(),claims=[];
    function within(name,box){
      if (box.x < -EPSILON || box.y < -EPSILON ||
          box.x+box.width > W+EPSILON || box.y+box.height > H+EPSILON) {
        throw Error(name + "超出 Canvas 画布范围");
      }
    }
    function reserve(name,box,padding=0){
      const b=rect(box.x,box.y,box.width,box.height);
      within(name,b);
      zones.set(name,{...b,padding});return b;
    }
    function claim(name,box,options){
      const cfg=options||{},b=rect(box.x,box.y,box.width,box.height);
      within(name,b);
      for(const reserved of cfg.avoid||[]){
        const z=zones.get(reserved);
        if(!z)throw Error(name+"缺少保护区："+reserved);
        if(intersects(b,z,z.padding + (cfg.padding||0))) throw Error(name+"侵入"+reserved+"保护区");
      }
      if(cfg.avoidOtherClaims){
        for(const prior of claims)if(intersects(b,prior.box,cfg.padding||0)){
          throw Error(name+"与"+prior.name+"发生信息碰撞");
        }
      }
      claims.push({name,box:b});return b;
    }
    function claimText(name,text,x,y,font,options){
      const opts=options||{};
      return claim(name,textRect(ctx,text,{x,y,font,align:opts.align,angle:opts.angle,pivotX:opts.pivotX,pivotY:opts.pivotY}),opts);
    }
    return Object.freeze({reserve,claim,claimText,zones,claims,assertInCanvas:within});
  }
  function validateFacts(record){
    const data=record||{};
    for(const key of ["title","date","time","region","meeting","qr"]){
      if(!asText(data[key])) throw Error("海报缺少重要活动信息："+key);
    }
    return true;
  }
  return Object.freeze({
    letters,measured,wrap,fit,rect,intersects,rotateRect,textRect,createGuard,validateFacts
  });
});
