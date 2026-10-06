const MODES = Object.freeze(['landscape','portrait']);

const CANDIDATES = Object.freeze({
  landscape: Object.freeze([
    Object.freeze({x:52,y:212,flip:false}),
    Object.freeze({x:112,y:246,flip:true}),
    Object.freeze({x:175,y:214,flip:false}),
    Object.freeze({x:235,y:252,flip:true}),
    Object.freeze({x:298,y:218,flip:false}),
    Object.freeze({x:78,y:274,flip:true}),
    Object.freeze({x:205,y:276,flip:false}),
    Object.freeze({x:286,y:268,flip:true})
  ]),
  portrait: Object.freeze([
    Object.freeze({x:42,y:278,flip:false}),
    Object.freeze({x:52,y:338,flip:true}),
    Object.freeze({x:46,y:408,flip:false}),
    Object.freeze({x:92,y:438,flip:true}),
    Object.freeze({x:242,y:252,flip:false}),
    Object.freeze({x:250,y:316,flip:true}),
    Object.freeze({x:255,y:386,flip:false}),
    Object.freeze({x:218,y:438,flip:true})
  ])
});

function fail(code){
  const error=new Error(code);
  error.code=code.toUpperCase();
  throw error;
}

function normalizeMode(value){
  const mode=String(value||'').toLowerCase();
  if(!MODES.includes(mode)) fail('invalid_mode');
  return mode;
}

function validateDateKey(value){
  const key=String(value||'');
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if(!match) fail('invalid_date');
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day) fail('invalid_date');
  return key;
}

function boundsFor(mode){
  return mode==='portrait'
    ? {minX:35,maxX:265,minY:240,maxY:450}
    : {minX:40,maxX:310,minY:195,maxY:285};
}

function validatePosition(modeValue,input){
  const mode=normalizeMode(modeValue);
  const x=Number(input&&input.x),y=Number(input&&input.y);
  const flip=Boolean(input&&input.flip);
  const b=boundsFor(mode);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<b.minX||x>b.maxX||y<b.minY||y>b.maxY) fail('invalid_position');
  return {x,y,flip};
}

function fnv1a32(value){
  let hash=0x811c9dc5;
  const text=String(value);
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash>>>0;
}

function seedForDailyPosition(userId,dateKey,modeValue){
  const mode=normalizeMode(modeValue);
  const date=validateDateKey(dateKey);
  return fnv1a32(String(userId||'')+':'+date+':'+mode);
}

function dateOrdinal(dateKey){
  const [year,month,day]=validateDateKey(dateKey).split('-').map(Number);
  return Math.floor(Date.UTC(year,month-1,day)/86400000);
}

function generateDailyPosition(userId,dateKey,modeValue,context={}){
  const mode=normalizeMode(modeValue);
  const date=validateDateKey(dateKey);
  const candidates=(context&&Array.isArray(context.candidates)&&context.candidates.length?context.candidates:CANDIDATES[mode]);
  const baseSeed=fnv1a32(String(userId||'')+':'+mode);
  const index=((baseSeed% candidates.length)+(dateOrdinal(date)%candidates.length))%candidates.length;
  return validatePosition(mode,candidates[index]);
}

module.exports={
  MODES,
  CANDIDATES,
  normalizeMode,
  validateDateKey,
  validatePosition,
  seedForDailyPosition,
  generateDailyPosition
};
