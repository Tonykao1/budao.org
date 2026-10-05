const assert = require('assert');

function hash(str){
  let h=2166136261>>>0;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function rand(seed){
  return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}
}
function chooseRestingLambs(key,count=18){
  const r=rand(hash('budao-lamb-rest-'+key));
  const target=1+(r()<0.5?0:1);
  const ids=[...Array(count).keys()];
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}
  return ids.slice(0,target).sort((a,b)=>a-b);
}

const a=chooseRestingLambs('2026-10-05');
const b=chooseRestingLambs('2026-10-05');
assert.deepStrictEqual(a,b,'same day must be stable');
assert.ok(a.length===1||a.length===2,'must rest only 1–2 lambs');
assert.ok(a.every(i=>i>=0&&i<18),'rest indices must be valid');

let sawOne=false,sawTwo=false;
for(let d=1;d<=31;d++){
  const ids=chooseRestingLambs(`2026-10-${String(d).padStart(2,'0')}`);
  if(ids.length===1)sawOne=true;
  if(ids.length===2)sawTwo=true;
}
assert.ok(sawOne&&sawTwo,'monthly samples should include both 1 and 2 resting lamb days');

console.log('pasture-lamb-rest tests passed');
