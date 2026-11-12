/* 步道卡六维身份规则：系列是独立命名空间；样本卡只提供视觉参考。 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BudaoSix=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SUITS=['spade','heart','club','diamond'];
  const RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const NUMBER_COLORS=['red','black'];
  const SIDES=['white','black'];
  const PIECES=['king','queen','rook','bishop','knight','pawn'];
  const CAPACITY=4*13*2*6*2*6;
  const PUBLIC_LIMIT=7000;
  const BUFFER=CAPACITY-PUBLIC_LIMIT;
  const SERIES={id:'CSCZ-001',calligraphy:'创始成终',capacity:CAPACITY,publicLimit:PUBLIC_LIMIT};
  // An arithmetic permutation, rather than simply slicing lexicographic combinations.
  // gcd(4871, 7488)=1, so 0..7487 occurs exactly once.
  const STEP=4871,SHIFT=2026;
  function assertInt(v,min,max,label){if(!Number.isInteger(v)||v<min||v>max)throw new RangeError(label)}
  function encode(c){
    if(!c||!SUITS.includes(c.suit)||!RANKS.includes(c.rank)||!NUMBER_COLORS.includes(c.numberColor)||!SIDES.includes(c.side)||!PIECES.includes(c.piece))throw new TypeError('无效六维组合');
    assertInt(c.dice,1,6,'骰子');
    return (((((SUITS.indexOf(c.suit)*13+RANKS.indexOf(c.rank))*2+NUMBER_COLORS.indexOf(c.numberColor))*6+(c.dice-1))*2+SIDES.indexOf(c.side))*6+PIECES.indexOf(c.piece));
  }
  function decode(code){
    assertInt(code,0,CAPACITY-1,'编码');
    let n=code;
    const piece=PIECES[n%6];n=Math.floor(n/6);
    const side=SIDES[n%2];n=Math.floor(n/2);
    const dice=n%6+1;n=Math.floor(n/6);
    const numberColor=NUMBER_COLORS[n%2];n=Math.floor(n/2);
    const rank=RANKS[n%13];n=Math.floor(n/13);
    return {suit:SUITS[n],rank,numberColor,dice,side,piece};
  }
  function allottedCode(slot){
    assertInt(slot,0,CAPACITY-1,'发行序号');
    return (slot*STEP+SHIFT)%CAPACITY;
  }
  function inPublicPool(code){
    assertInt(code,0,CAPACITY-1,'编码');
    // Inverse of STEP modulo CAPACITY; computed exactly with extended Euclid.
    let a=STEP,b=CAPACITY,x=1,y=0;
    while(b){const q=Math.floor(a/b);[a,b]=[b,a-q*b];[x,y]=[y,x-q*y]}
    const inverse=((x%CAPACITY)+CAPACITY)%CAPACITY;
    const slot=((((code-SHIFT)*inverse)%CAPACITY)+CAPACITY)%CAPACITY;
    return slot<PUBLIC_LIMIT;
  }
  function randomInt(upper,cryptoSource){
    assertInt(upper,1,0x100000000,'抽取范围');
    const source=cryptoSource||(typeof crypto!=='undefined'?crypto:null);
    if(!source||typeof source.getRandomValues!=='function')throw new Error('需要安全随机源');
    const ceiling=Math.floor(0x100000000/upper)*upper;
    const values=new Uint32Array(1);
    do{source.getRandomValues(values)}while(values[0]>=ceiling);
    return values[0]%upper;
  }
  function randomPublic(occupied=new Set(),cryptoSource){
    const available=[];
    for(let slot=0;slot<PUBLIC_LIMIT;slot++){const code=allottedCode(slot);if(!occupied.has(code))available.push(code)}
    if(!available.length)throw new Error('本系列公开发行池已满');
    const code=available[randomInt(available.length,cryptoSource)];
    return {code,combo:decode(code),seriesId:SERIES.id};
  }
  return Object.freeze({SUITS,RANKS,NUMBER_COLORS,SIDES,PIECES,CAPACITY,PUBLIC_LIMIT,BUFFER,SERIES,encode,decode,allottedCode,inPublicPool,randomInt,randomPublic});
});
