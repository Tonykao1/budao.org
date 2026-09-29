const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const vm=require('node:vm');
const base=path.join(__dirname,'..','pasture-preview');
const source=Array.from({length:20},(_,i)=>fs.readFileSync(path.join(base,'parts','part-'+String(i).padStart(2,'0')+'.txt'),'utf8')).join('');
const compressed=source.match(/const ORIGINAL=`([A-Za-z0-9+/=]+)`;/);
if(!compressed)throw Error('Approved original embedded card is missing');
const original=zlib.gunzipSync(Buffer.from(compressed[1],'base64')).toString('utf8');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(base,'card-six-dim-patch.js'),'utf8'),context);
const upgraded=context.window.patchOriginalBudaoCard(original);

test('six-dimension patch leaves all approved raster artwork and master geometry unchanged',()=>{
 const imgData=html=>html.match(/^const DATA=.*$/m)?.[0];
 assert.ok(imgData(original));
 assert.equal(imgData(upgraded),imgData(original),'Original encoded calligraphy and all printed source pixel art must match exactly');
 for(const fragment of [
  'id="fixedFront"','id="symbolCanvas" width="650" height="331"',
  '.card{width:100%;aspect-ratio:2/1;',
  'low.width=325;low.height=166',
  "DATA.zones[k]"
 ])assert.ok(upgraded.includes(fragment),fragment);
 assert.ok(upgraded.includes('border-radius:17px!important'));
 assert.ok(upgraded.includes('border-radius:11px!important'));
});
test('the original approved card compiles after six-dimensional upgrade',()=>{
 const code=upgraded.slice(upgraded.lastIndexOf('<script>')+8,upgraded.lastIndexOf('</script>'));
 assert.ok(code.includes('const DATA='));
 assert.doesNotThrow(()=>new vm.Script(code,{filename:'approved-six-dimension-card.js'}));
});
test('all 7488 combos, red and black number inks, 7000 public and 488 reserve are wired into the original renderer',()=>{
 for(const fragment of [
  "numberColors=['red','black']",
  'all.length!==7488',
  'window.BudaoSix.PUBLIC_LIMIT',
  "desired=v.numberColor+'_'+v.rank",
  "DATA.assets.rank[desired]",
  "g.globalCompositeOperation='source-in'",
  "v.side||v.color",
  "window.BudaoSix.randomInt(max)",
  "'CSCZ-001'",
  '7,488','7,000','488'
 ])assert.ok(upgraded.includes(fragment),fragment);
 assert.ok(!upgraded.includes('const demoPool=order.slice(0,3000)'));
 assert.ok(!upgraded.includes('return Math.floor(Math.random()*max)'));
});
test('English identification is concealed without replacing the original card or Chinese controls',()=>{
 assert.ok(upgraded.includes('.overlay .window-head .overline,.overlay .panel-k,.confirm .brand-k{display:none!important}'));
 assert.ok(upgraded.includes('id="flipBtn"'));
 assert.ok(upgraded.includes('id="previewShuffle"'));
 assert.ok(upgraded.includes('id="confirmSecond"'));
});
test('each number color is drawable, even where an original sample had only the other numeral ink',()=>{
 const line=original.match(/^const DATA=.*$/m)[0];
 const parsed=vm.runInNewContext(line+';({rank:DATA.assets.rank, print:DATA.print_rank_colors})');
 for(const suit of ['spade','heart','club','diamond'])
 for(const rank of ['A','2','3','4','5','6','7','8','9','10','J','Q','K'])
 for(const numColor of ['red','black']){
  const desired=numColor+'_'+rank;
  const fallback=parsed.print[suit]+'_'+rank;
  assert.ok(parsed.rank[desired]||parsed.rank[fallback],'missing numeral asset: '+suit+' '+desired);
 }
});
