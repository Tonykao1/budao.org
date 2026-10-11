(function(root,factory){
  const DNA=(typeof module==='object'&&module.exports)?require('./pasture-sheep-dna.js'):root.PastureSheepDNA;
  const api=factory(DNA);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PastureSheepRenderer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(DNA){
  'use strict';
  if(!DNA)throw new Error('PastureSheepDNA required');

  const INK='#342f2c', LEGS='#5d5851', LIGHT='#fff7df';
  const RESIDENT_LIFE_BOOST=.40;

  function rect(x,y,w,h,color,role){return [x,y,w,h,color,role||'shape']}
  function rectsFor(input){
    const isV2=DNA.validateV2(input);
    const legacy=!isV2&&input&&typeof input==='object'&&typeof input.bodyColor==='string'&&typeof input.headColor==='string';
    const dna=isV2?input:(legacy?DNA.fromLegacy(input):DNA.normalizeV2(input));
    const wool=legacy?input.bodyColor:DNA.palettes.woolColor[dna.woolColor];
    const face=legacy?input.headColor:DNA.palettes.faceColor[dna.faceColor];
    const out=[];

    const body={
      small:{x:1,y:1,w:14,h:7,topX:4,topY:-3,topW:9,topH:11,leg1:4,leg2:10},
      standard:{x:0,y:0,w:16,h:8,topX:3,topY:-4,topW:11,topH:13,leg1:4,leg2:11},
      round:{x:-1,y:-1,w:18,h:10,topX:2,topY:-5,topW:13,topH:15,leg1:4,leg2:12},
      tall:{x:1,y:-2,w:15,h:10,topX:4,topY:-7,topW:10,topH:16,leg1:5,leg2:11}
    }[dna.bodyShape];

    out.push(rect(body.x,body.y,body.w,body.h,wool,'body'));
    out.push(rect(body.topX,body.topY,body.topW,body.topH,wool,'body'));
    if(dna.woolShape==='soft'){
      out.push(rect(body.x+2,body.y-2,4,2,wool,'wool-edge'));
      out.push(rect(body.x+9,body.y-2,5,2,wool,'wool-edge'));
    }else if(dna.woolShape==='fluffy'){
      out.push(rect(body.x-1,body.y+1,2,5,wool,'wool-edge'));
      out.push(rect(body.x+2,body.y-3,4,3,wool,'wool-edge'));
      out.push(rect(body.x+8,body.y-4,5,3,wool,'wool-edge'));
      out.push(rect(body.x+body.w-1,body.y+1,2,5,wool,'wool-edge'));
    }else if(dna.woolShape==='curly'){
      out.push(rect(body.x+1,body.y-2,3,2,wool,'wool-edge'));
      out.push(rect(body.x+6,body.y-3,3,3,wool,'wool-edge'));
      out.push(rect(body.x+12,body.y-2,3,2,wool,'wool-edge'));
      out.push(rect(body.x+4,body.y+body.h-1,3,2,wool,'wool-edge'));
    }

    const faceY=dna.bodyShape==='tall'?0:2;
    out.push(rect(13,faceY,7,7,face,'face'));
    out.push(rect(19,faceY+2,2,3,face,'muzzle'));

    if(dna.ears==='small'){
      out.push(rect(13,faceY-1,2,2,face,'ear'));
    }else if(dna.ears==='medium'){
      out.push(rect(12,faceY-1,3,2,face,'ear'));
    }else if(dna.ears==='droop'){
      out.push(rect(12,faceY,2,4,face,'ear'));
      out.push(rect(19,faceY,3,2,face,'ear'));
    }else if(dna.ears==='perk'){
      out.push(rect(13,faceY-3,2,4,face,'ear'));
      out.push(rect(18,faceY-2,2,3,face,'ear'));
    }

    if(dna.forelock==='tuft'){
      out.push(rect(14,faceY-2,2,2,wool,'forelock'));
      out.push(rect(16,faceY-3,2,3,wool,'forelock'));
    }else if(dna.forelock==='curl'){
      out.push(rect(14,faceY-2,4,2,wool,'forelock'));
      out.push(rect(16,faceY-4,2,2,wool,'forelock'));
      out.push(rect(17,faceY-3,2,1,wool,'forelock'));
    }else if(dna.forelock==='side'){
      out.push(rect(13,faceY-2,5,2,wool,'forelock'));
      out.push(rect(13,faceY,2,2,wool,'forelock'));
    }else if(dna.forelock==='cloud'){
      out.push(rect(13,faceY-3,2,3,wool,'forelock'));
      out.push(rect(15,faceY-4,3,4,wool,'forelock'));
      out.push(rect(18,faceY-3,2,3,wool,'forelock'));
    }

    if(dna.expression==='calm'){
      out.push(rect(17,faceY+2,1,1,INK,'eye'));
    }else if(dna.expression==='gentleSmile'){
      out.push(rect(17,faceY+2,1,1,INK,'eye'));
      out.push(rect(18,faceY+5,2,1,INK,'mouth'));
    }else if(dna.expression==='curious'){
      out.push(rect(17,faceY+1,1,2,INK,'eye'));
      out.push(rect(19,faceY+5,1,1,INK,'mouth'));
    }else if(dna.expression==='joyful'){
      out.push(rect(16,faceY+2,2,1,INK,'eye'));
      out.push(rect(17,faceY+5,3,1,INK,'mouth'));
    }

    out.push(rect(body.leg1,body.y+body.h-1,2,6,LEGS,'leg'));
    out.push(rect(body.leg2,body.y+body.h-1,2,6,LEGS,'leg'));

    if(dna.marking==='forehead')out.push(rect(15,faceY,2,2,LIGHT,'mark'));
    if(dna.marking==='cheek')out.push(rect(18,faceY+3,2,2,LIGHT,'mark'));
    if(dna.marking==='facePatch')out.push(rect(14,faceY+1,3,4,LIGHT,'mark'));
    if(dna.marking==='backPatch')out.push(rect(body.x+5,body.y-1,6,3,LIGHT,'mark'));
    if(dna.marking==='socks'){
      out.push(rect(body.leg1,body.y+body.h+3,2,2,LIGHT,'mark'));
      out.push(rect(body.leg2,body.y+body.bodyH+3,2,2,LIGHT,'mark'));
    }
    if(dna.marking==='earMark')out.push(rect(13,faceY-1,1,2,LIGHT,'mark'));

    return out;
  }

  function lifeSeed(input){
    const s=JSON.stringify(input||{});let h=2166136261>>>0;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
    return h>>>0;
  }
  function residentLifeState(input,now=Date.now()){
    const seed=lifeSeed(input),offset=seed%4300,t=now+offset;
    const blinkPeriod=4800+(seed%1700),chewPeriod=8200+((seed>>>5)%3800),earPeriod=10800+((seed>>>9)%5200);
    const blink=(t%blinkPeriod)<260;
    const chewPhase=t%chewPeriod;
    const chew=chewPhase<900;
    const earTwitch=(t%earPeriod)<620;
    const breath=Math.sin(t/760)*(.055+RESIDENT_LIFE_BOOST*.025);
    return{blink,chew,chewPhase,earTwitch,breath};
  }
  function shiftHex(color,amount){
    if(!/^#[0-9a-f]{6}$/i.test(color))return color;
    const n=parseInt(color.slice(1),16),target=amount>=0?255:0,a=Math.min(1,Math.abs(amount));
    const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    const mix=v=>Math.max(0,Math.min(255,Math.round(v+(target-v)*a)));
    return '#'+[mix(r),mix(g),mix(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  function residentLifeActive(){return typeof globalThis!=='undefined'&&globalThis.__tongluFlockCount === 45}
  function livingColor(role,color,state,face){
    if((role==='body'||role==='wool-edge'||role==='forelock')&&state.breath)return shiftHex(color,state.breath);
    if(role==='eye'&&state.blink)return face;
    if(role==='mouth'&&state.chew&&Math.floor(state.chewPhase/150)%2===0)return face;
    if(role==='ear'&&state.earTwitch)return shiftHex(color,.14);
    return color;
  }

  function draw(ctx,x,y,unit=1,flip=false,dna){
    const rects=rectsFor(dna);
    const life=residentLifeActive()?residentLifeState(dna):null;
    const normalized=DNA.validateV2(dna)?dna:DNA.fromLegacy(dna||{});
    const face=DNA.validateV2(dna)?DNA.palettes.faceColor[normalized.faceColor]:(dna?.headColor||'#8d836e');
    ctx.save();
    if(flip){ctx.translate(x+21*unit,0);ctx.scale(-1,1);x=0}
    ctx.imageSmoothingEnabled=false;
    for(const [rx,ry,rw,rh,color,role] of rects){
      ctx.fillStyle=life?livingColor(role,color,life,face):color;
      ctx.fillRect(Math.round(x+rx*unit),Math.round(y+ry*unit),Math.max(1,Math.round(rw*unit)),Math.max(1,Math.round(rh*unit)));
    }
    ctx.restore();
  }

  function drawMask(ctx,dna,offsetX=0,offsetY=0){
    const rects=rectsFor(dna);
    ctx.save();ctx.fillStyle='#000';
    for(const [rx,ry,rw,rh] of rects)ctx.fillRect(offsetX+rx,offsetY+ry,rw,rh);
    ctx.restore();
  }

  return Object.freeze({rectsFor,draw,drawMask,residentLifeState,RESIDENT_LIFE_BOOST});
});
