const test=require('node:test');
const assert=require('node:assert/strict');
const card=require('../pasture-preview/six-dim-core.js');

test('六维总容量与发行储备严格为 7488 / 7000 / 488',()=>{
 assert.equal(card.CAPACITY,7488);
 assert.equal(card.PUBLIC_LIMIT,7000);
 assert.equal(card.BUFFER,488);
 assert.equal(card.SERIES.id,'CSCZ-001');
 assert.equal(card.SERIES.calligraphy,'创始成终');
});
test('全部六维组合一一映射，且都能够往返解码',()=>{
 const seen=new Set();
 for(const suit of card.SUITS)for(const rank of card.RANKS)
 for(const numberColor of card.NUMBER_COLORS)for(let dice=1;dice<=6;dice++)
 for(const side of card.SIDES)for(const piece of card.PIECES){
  const combo={suit,rank,numberColor,dice,side,piece};
  const code=card.encode(combo);
  assert.deepEqual(card.decode(code),combo);
  assert.ok(!seen.has(code),'duplicate '+code);seen.add(code);
 }
 assert.equal(seen.size,7488);
});
test('独立配色：黑桃+红字+黑方，黑桃+黑字+白方均合法',()=>{
 const a={suit:'spade',rank:'A',numberColor:'red',dice:5,side:'black',piece:'king'};
 const b={...a,numberColor:'black',side:'white'};
 assert.notEqual(card.encode(a),card.encode(b));
 assert.deepEqual(card.decode(card.encode(a)),a);
});
test('置换序列不重复：前7000个开放，余488个缓冲',()=>{
 const available=new Set(),buffer=new Set();
 for(let i=0;i<7488;i++){
  const c=card.allottedCode(i);
  assert.ok(c>=0&&c<7488);
  if(i<7000){available.add(c);assert.equal(card.inPublicPool(c),true)}
  else{buffer.add(c);assert.equal(card.inPublicPool(c),false)}
 }
 assert.equal(available.size,7000);assert.equal(buffer.size,488);
 assert.equal(new Set([...available,...buffer]).size,7488);
});
test('公开池抽取避开已占位组合',()=>{
 const all=new Set(Array.from({length:7000},(_,i)=>card.allottedCode(i)));
 const last=card.allottedCode(6999);
 all.delete(last);
 const deterministic={getRandomValues(values){values[0]=0;return values}};
 const result=card.randomPublic(all,deterministic);
 assert.equal(result.code,last);
 assert.equal(result.combo.numberColor,card.decode(last).numberColor);
 assert.throws(()=>card.randomPublic(new Set([...all,last]),deterministic),/已满/);
});
test('无安全随机源时拒绝使用 Math.random 发行',()=>{
 assert.throws(()=>card.randomInt(10,{}),/安全随机源/);
});
