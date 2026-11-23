(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PastureSheepDNA=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const enums=Object.freeze({
    woolColor:Object.freeze(['cloudWhite','ivory','cream','wheat','lightGray','silverGray','warmGray','lightBrown','charcoal','black']),
    faceColor:Object.freeze(['ivory','sand','wheatBrown','warmTaupe','ashGray','slate','deepBrown','charcoal']),
    woolShape:Object.freeze(['clean','soft','fluffy','curly']),
    bodyShape:Object.freeze(['small','standard','round','tall']),
    ears:Object.freeze(['small','medium','droop','perk']),
    expression:Object.freeze(['calm','gentleSmile','curious','joyful']),
    marking:Object.freeze(['none','forehead','cheek','facePatch','backPatch','socks','earMark']),
    forelock:Object.freeze(['none','tuft','curl','side','cloud'])
  });
  const dimensions=Object.freeze(Object.keys(enums));
  const defaults=Object.freeze({
    version:2,woolColor:'cloudWhite',faceColor:'warmTaupe',woolShape:'soft',bodyShape:'standard',ears:'medium',expression:'calm',marking:'none',forelock:'none'
  });
  const palettes=Object.freeze({
    woolColor:Object.freeze({cloudWhite:'#eee8dc',ivory:'#f4ecdc',cream:'#f1e2c8',wheat:'#f2e3b3',lightGray:'#d8d7ce',silverGray:'#c9ced0',warmGray:'#c8c0b4',lightBrown:'#c5a783',charcoal:'#625f5b',black:'#353331'}),
    faceColor:Object.freeze({ivory:'#e8dcc6',sand:'#c9b28f',wheatBrown:'#a98d67',warmTaupe:'#8d836e',ashGray:'#817a74',slate:'#716d69',deepBrown:'#665044',charcoal:'#4e4a47'})
  });
  const darkWool=new Set(['charcoal','black']);
  const darkFace=new Set(['slate','deepBrown','charcoal']);
  const legacyMarks=Object.freeze({none:'NONE',forehead:'FACE',cheek:'FACE',facePatch:'FACE',backPatch:'BACK',socks:'SOCKS',earMark:'FACE'});

  function cloneDefault(){return {...defaults}}
  function validateV2(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==2)return false;
    const keys=Object.keys(input).sort();
    const expected=['version',...dimensions].sort();
    if(keys.length!==expected.length||keys.some((k,i)=>k!==expected[i]))return false;
    return dimensions.every(key=>enums[key].includes(input[key]));
  }
  function normalizeV2(input){
    const out=cloneDefault();
    if(!input||typeof input!=='object'||Array.isArray(input))return out;
    for(const key of dimensions){if(enums[key].includes(input[key]))out[key]=input[key]}
    return out;
  }
  function pick(values,randomFn){
    const r=Number(randomFn());
    const safe=Number.isFinite(r)?Math.max(0,Math.min(.999999999,r)):0;
    return values[Math.floor(safe*values.length)];
  }
  function randomV2(randomFn=Math.random){
    const out={version:2};
    for(const key of dimensions)out[key]=pick(enums[key],randomFn);
    if(darkWool.has(out.woolColor)&&darkFace.has(out.faceColor))out.faceColor=pick(['ivory','sand','wheatBrown','warmTaupe','ashGray'],randomFn);
    return out;
  }
  function toLegacy(input){
    const v2=normalizeV2(input);
    return {bodyColor:palettes.woolColor[v2.woolColor],headColor:palettes.faceColor[v2.faceColor],marking:legacyMarks[v2.marking]||'NONE'};
  }
  function fromLegacy(input){
    const wool=Object.entries(palettes.woolColor).find(([,v])=>String(v).toLowerCase()===String(input?.bodyColor||'').toLowerCase());
    const face=Object.entries(palettes.faceColor).find(([,v])=>String(v).toLowerCase()===String(input?.headColor||'').toLowerCase());
    const mark=String(input?.marking||'NONE').toUpperCase();
    return {...defaults,woolColor:wool?.[0]||defaults.woolColor,faceColor:face?.[0]||defaults.faceColor,marking:mark==='BACK'?'backPatch':mark==='SOCKS'?'socks':mark==='FACE'?'facePatch':'none'};
  }

  return Object.freeze({version:2,enums,dimensions,palettes,defaultV2:cloneDefault,validateV2,normalizeV2,randomV2,toLegacy,fromLegacy});
});
