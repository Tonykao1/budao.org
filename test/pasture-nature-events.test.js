'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const nature=require('../pasture-nature-events.js');
const MS=Date.parse('2026-06-15T10:00:00Z');
function state({latitude=40,code=0,wind=5,cloud=12}={}){
  return{location:{latitude,longitude:116.4,timezone:'UTC'},
    current:{weatherCode:code,windKmh:wind,cloudCover:cloud},
    astronomy:{sunriseToday:MS-3600000,sunsetToday:MS+3600000}};
}
function sky(day=true){return{sun:{altitudeDeg:day?30:-15}}}
function canvas(){
  const ops=[];
  const ctx={save(){ops.push(['save'])},restore(){ops.push(['restore'])},
    beginPath(){ops.push(['beginPath'])},rect(...v){ops.push(['clipRect',...v])},
    clip(){ops.push(['clip'])},fillRect(...v){ops.push(['pixel',...v])},
    set fillStyle(v){this.color=v},set globalAlpha(v){this.alpha=v}};
  return{ctx,ops};
}
test('season uses local date and reverses hemisphere without artificial winter in tropics',()=>{
  const jan=Date.parse('2026-01-15T12:00:00Z');
  assert.equal(nature.seasonAt(jan,40,'UTC'),'winter');
  assert.equal(nature.seasonAt(jan,-40,'UTC'),'summer');
  assert.equal(nature.seasonAt(jan,3,'UTC'),'tropical');
  assert.equal(nature.seasonAt(Date.parse('2026-10-10T12:00:00Z'),40,'UTC'),'autumn');
});
test('daytime events match season, weather and wind',()=>{
  assert.deepEqual(nature.eligibleKinds(state(),sky(),MS),['butterfly','dragonfly','fish']);
  assert.deepEqual(nature.eligibleKinds(state(),sky(false),MS),['firefly']);
  assert.deepEqual(nature.eligibleKinds(state({code:61}),sky(),MS),[]);
  assert.deepEqual(nature.eligibleKinds(state({code:71}),sky(),MS),[]);
  assert.deepEqual(nature.eligibleKinds(state({code:45}),sky(),MS),[]);
  assert.deepEqual(nature.eligibleKinds(state({wind:35}),sky(),MS),[]);
  assert.deepEqual(nature.eligibleKinds(state(),null,MS),['butterfly','dragonfly','fish']);
  assert.deepEqual(nature.eligibleKinds({location:state().location,current:{}},null,MS),[]);
});
test('migrations and falling leaves belong to autumn daylight, not night',()=>{
  const oct=Date.parse('2026-10-08T10:00:00Z');
  const s=state();
  assert.deepEqual(nature.eligibleKinds(s,sky(),oct),['fish','migration','leaf']);
  assert.deepEqual(nature.eligibleKinds(s,sky(false),oct),[]);
});
test('river anchors remain in source river and portrait version stays viewport-bounded',()=>{
  for(const t of [.43,.55,.72]){
    const l=nature.riverAt(t,'landscape',480,300);
    assert.ok(l.x>335&&l.x<410&&l.y>=154&&l.y<308);
    const p=nature.riverAt(t,'portrait',300,600);
    assert.ok(p.x>120&&p.x<260&&p.y>240&&p.y<610);
  }
});
test('sparse scheduler never runs two visible events and creates an idle gap',()=>{
  const c=nature.createController({random:()=>.25}),{ctx,ops}=canvas();
  const options={width:480,height:300,scene:'landscape',state:state(),skyState:sky()};
  assert.equal(c.draw(ctx,{...options,now:MS}),null);
  const a=c.draw(ctx,{...options,now:MS+40000});
  assert.ok(a&&nature.KINDS.includes(a.kind));
  assert.ok(ops.some(x=>x[0]==='pixel'));
  assert.equal(c.draw(ctx,{...options,now:MS+41000}).kind,a.kind);
  assert.equal(c.draw(ctx,{...options,now:MS+50000}),null);
  assert.equal(c.status().active,null);
  assert.equal(c.draw(ctx,{...options,now:MS+60000}),null);
});
test('migratory birds are clipped to sky, never sea or mountain',()=>{
  const spring=Date.parse('2026-04-15T10:00:00Z');
  const c=nature.createController({random:()=>.99}),{ctx,ops}=canvas();
  const options={width:480,height:300,scene:'landscape',state:state(),skyState:sky()};
  c.draw(ctx,{...options,now:spring});
  const event=c.draw(ctx,{...options,now:spring+80000});
  assert.equal(event.kind,'migration');
  assert.ok(ops.some(x=>x[0]==='clipRect'&&x[1]===0&&x[2]===0&&x[3]===480&&x[4]===95));
});
test('disabled event controller and unknown daylight never render',()=>{
  const {ctx,ops}=canvas(),c=nature.createController({enabled:false,random:()=>0});
  assert.equal(c.draw(ctx,{now:MS+100000,width:480,height:300,scene:'landscape',state:state(),skyState:sky()}),null);
  assert.equal(ops.length,0);
  const d=nature.createController({random:()=>0});
  const unknown={location:{latitude:40,timezone:'UTC'},current:{weatherCode:0}};
  d.draw(ctx,{now:MS,width:480,height:300,scene:'landscape',state:unknown});
  assert.equal(d.draw(ctx,{now:MS+90000,width:480,height:300,scene:'landscape',state:unknown}),null);
});
