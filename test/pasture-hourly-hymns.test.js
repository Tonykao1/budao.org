'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const hourly=require(path.join(root,'pasture-hourly-hymns.js'));
const scope={window:{}};
for(const name of ['pasture-hourly-scores.js','pasture-hourly-last-score.js','pasture-half-hour-scores.js'])
  vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),scope,{filename:name});
const songs=scope.window.BudaoPastureHymnScores;
const halfSongs=scope.window.BudaoPastureHalfHourScores;
const counts=[127,219,194,197,188,337,240,292,245,270,163,257];

test('exact 12 hymn set and twice-daily 12-hour rotation',()=>{
  assert.equal(songs.length,12);
  for(let h=0;h<24;h++) assert.equal(hourly.songIndex(new Date(2026,10,24,h)),h%12);
  assert.equal(songs[2].en,'Joy to the World');
});
test('complete validated SATB / user two-track MIDI note events',()=>{
  songs.forEach((song,i)=>{
    const voices=song.parts.map(hourly.decodeVoice);
    assert.equal(voices.length,i===11?2:4,song.en);
    const n=voices.reduce((sum,part)=>sum+part.length,0);
    assert.equal(n,counts[i],song.en);
    const lastNoteEnd=Math.max(...voices.flat().map(e=>e.tick+e.duration));
    // Original hymn scores can end with a whole-beat rest; never invent sustained notes.
    assert.ok(lastNoteEnd<=song.cycleTicks&&lastNoteEnd>=song.cycleTicks-2*song.ticks,song.en);
    assert.ok(hourly.cycleSeconds(song)>20&&hourly.cycleSeconds(song)<60);
    assert.ok(song.stanzas>0);
  });
});
test('clock gate tolerates brief foreground throttling but never delayed background catch-up',()=>{
  const due=Date.UTC(2026,10,24,9);
  assert.equal(hourly.isAcceptableClockTick(due,due),true);
  assert.equal(hourly.isAcceptableClockTick(due+1501,due),true);
  assert.equal(hourly.isAcceptableClockTick(due+11999,due),true);
  assert.equal(hourly.isAcceptableClockTick(due+12001,due),false);
  assert.equal(hourly.isAcceptableClockTick(due-1000,due),false);
});
test('pasture remembers desired state while requiring a gesture after reload',()=>{
  const s=fs.readFileSync(path.join(root,'pasture-hourly-hymns.js'),'utf8');
  assert.match(s,/已记住开启偏好/);
  assert.match(s,/restoreOnGesture/);
  assert.match(s,/dataset\.hourlyEnabled=String\(enabled\)/);
});
test('local-hour rollover and 22:00-07:00 quiet hours',()=>{
  const n=hourly.nextLocalHour(new Date(2026,10,24,11,59,59,950));
  assert.equal(n.getHours(),12);assert.equal(n.getMinutes(),0);assert.equal(n.getSeconds(),0);assert.equal(n.getMilliseconds(),0);
  for(const h of [0,6,7,21,22,23])
    assert.equal(hourly.isQuietHour(new Date(2026,10,24,h)),h>=22||h<7);
});
test('opt-in safe volume and night settings',()=>{
  assert.deepEqual(hourly.normalizeSettings(null),{volume:.32,quiet:true,desired:false});
  assert.deepEqual(hourly.normalizeSettings({volume:4,quiet:false}),{volume:1,quiet:false,desired:false});
  assert.deepEqual(hourly.normalizeSettings({volume:-1}),{volume:0,quiet:true,desired:false});
  assert.deepEqual(hourly.normalizeSettings({desired:true,volume:.4}),{volume:.4,quiet:true,desired:true});
});
test('realtime SID renderer preserves audible notes without invalid samples',()=>{
  let captured;
  const b=hourly.renderOnePass({createBuffer:(n,l,r)=>({length:l,rate:r,copyToChannel(a){captured=a;}})},songs[0]);
  assert.equal(b.rate,32000);
  assert.ok(Math.abs(b.length/32000-hourly.cycleSeconds(songs[0]))<.01);
  assert.ok(captured.some(v=>v!==0));
  assert.ok(captured.every(v=>Number.isFinite(v)&&Math.abs(v)<=1));
});
test('audio clock schedules a full hour ahead even if the tab is in background',()=>{
  assert.equal(hourly.audioStartAt(15,100000,3700000),3615);
  assert.equal(hourly.audioStartAt(15,100000,100001),15.06);
  const src=fs.readFileSync(path.join(root,'pasture-hourly-hymns.js'),'utf8');
  assert.match(src,/source\.start\(when\)/);
  assert.match(src,/win\.setTimeout\(queueUpcoming,0\)/);
  assert.doesNotMatch(src,/\|\|doc\.hidden\|\|!context/);
  assert.doesNotMatch(src,/stopNow\('hidden'\)/);
  assert.match(src,/settings\.desired=true;save\(\)/);
});
test('both pasture entrypoints link independent sound panel without changing core',()=>{
  for(const p of ['tonglu.html','pasture-live.html']){
    const h=fs.readFileSync(path.join(root,p),'utf8');
    assert.match(h,/id="pastureHymnControl"/);
    assert.match(h,/data-hourly-arm/);
    assert.match(h,/pasture-hourly-hymns.css/);
    assert.ok(h.indexOf('pasture-hourly-scores.js')<h.indexOf('pasture-hourly-last-score.js'));
    assert.ok(h.indexOf('pasture-hourly-last-score.js')<h.indexOf('pasture-half-hour-scores.js'));
    assert.ok(h.indexOf('pasture-half-hour-scores.js')<h.indexOf('pasture-hourly-hymns.js'));
    assert.match(h,/每逢整点与半点/);
    assert.match(h,/id="pastureCore"/);
  }
});

test('enabled hourly playback is queued on the audio clock while the tab is hidden',async()=>{
  const jobs=[],createdSources=[],listeners={};
  const node=(name)=>({
    dataset:{},hidden:name==='stop'||name==='panel',value:'32',checked:true,
    addEventListener(type,fn){listeners[name+':'+type]=fn;},
    setAttribute(){},focus(){},textContent:'',title:''
  });
  const names=['toggle','panel','arm','preview','stop','volume','quiet','next','status'];
  const nodes=Object.fromEntries(names.map(k=>[k,node(k)]));
  const attrs={'[data-hourly-toggle]':'toggle','[data-hourly-panel]':'panel',
    '[data-hourly-arm]':'arm','[data-hourly-preview]':'preview','[data-hourly-stop]':'stop',
    '[data-hourly-volume]':'volume','[data-hourly-quiet]':'quiet',
    '[data-hourly-next]':'next','[data-hourly-status]':'status'};
  const area={querySelector:k=>nodes[attrs[k]],contains:()=>false};
  const doc={hidden:true,getElementById:id=>id==='pastureHymnControl'?area:null,
    addEventListener(){}};
  class FakeAudio{
    constructor(){this.state='running';this.currentTime=5;this.destination={};}
    resume(){return Promise.resolve();}
    close(){return Promise.resolve();}
    createBuffer(){return{copyToChannel(){}};}
    createBufferSource(){
      const s={connect(){},disconnect(){},start(time){this.startAt=time;},
        stop(time){this.stopAt=time;}};
      createdSources.push(s);return s;
    }
    createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},
      setTargetAtTime(){}},connect(){},disconnect(){}};}
  }
  // This test exercises background scheduling independent of real-world quiet hours.
  const win={AudioContext:FakeAudio,localStorage:{getItem:()=>JSON.stringify({quiet:false}),setItem(){}},
    addEventListener(){},dispatchEvent(){},
    setTimeout(fn,delay){jobs.push({fn,delay});return jobs.length;},
    clearTimeout(){}};
  const engine=hourly.init({window:win,document:doc,scores:songs,halfScores:halfSongs});
  await listeners['arm:click']();
  for(const j of jobs.filter(j=>j.delay===0))j.fn();
  assert.equal(engine.state.enabled,true);
  assert.equal(engine.state.desired,true);
  assert.ok(engine.state.queuedHour>Date.now());
  assert.equal(createdSources.length,1);
  assert.ok(createdSources[0].startAt>5);
  assert.ok(createdSources[0].stopAt>createdSources[0].startAt);
  engine.dispose();
});

// Volume II: 12 user-approved tracks at every local HH:30. Never replace Vol I.
test('every local half-hour is next slot and hourly rotation remains untouched',()=>{
  const tests=[
    [new Date(2026,10,25,0,1),0,30],
    [new Date(2026,10,25,11,29,59),11,30],
    [new Date(2026,10,25,11,30),12,0],
    [new Date(2026,10,25,23,59),0,0]
  ];
  tests.forEach(([input,h,m])=>{const slot=hourly.nextLocalSlot(input);assert.equal(slot.getHours(),h);assert.equal(slot.getMinutes(),m);assert.equal(slot.getSeconds(),0);});
  for(let h=0;h<24;h++){
    const hour=new Date(2026,10,25,h,0),half=new Date(2026,10,25,h,30);
    assert.equal(hourly.slotKind(hour),'hour');assert.equal(hourly.slotKind(half),'half');
    assert.equal(hourly.slotIndex(hour),h%12);assert.equal(hourly.slotIndex(half),h%12);
    assert.equal(hourly.songIndex(hour),h%12);
  }
});
test('exactly twelve approved Volume II SATB hymn scores with correct tune names',()=>{
  assert.equal(halfSongs.length,12);
  assert.deepEqual(Array.from(halfSongs,s=>s.number),Array.from({length:12},(_,i)=>i+13));
  assert.deepEqual(Array.from(halfSongs,s=>s.tune),['OLD 100TH','LOBE DEN HERREN','PASSION CHORALE','NUN DANKET','HAMBURG','ST. ANNE','CORONATION','EASTER HYMN','HYFRYDOL','SAGINA','DIADEMATA','AURELIA']);
  halfSongs.forEach(s=>{
    assert.equal(s.stanzas,1);
    assert.equal(s.scoreType,'SATB');
    assert.equal(s.parts.length,4);
    assert.equal(s.masterPeak,.4);
    assert.ok(s.source.length>20);
    let n=0;
    for(const part of s.parts){const events=hourly.decodeVoice(part);n+=events.length;assert.ok(events.length>=12);assert.ok(events.every(e=>e.tick+e.duration<=s.cycleTicks));}
    assert.ok(n>=90,s.en);
    assert.ok(hourly.cycleSeconds(s)>15&&hourly.cycleSeconds(s)<75,s.en);
  });
});
test('half-hour SID timbre is identical to existing waveforms and capped to approved peak',()=>{
  let samples;
  const audio=hourly.renderOnePass({createBuffer:(n,length,sr)=>({n,length,sr,copyToChannel(a){samples=a}})},halfSongs[0]);
  assert.equal(audio.sr,32000);
  assert.ok(samples.some(v=>v!==0));
  assert.ok(samples.every(Number.isFinite));
  assert.ok(Math.abs(Math.max(...samples.slice(0,10000).map(Math.abs)))<=.401);
  let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
  assert.ok(peak>=.399&&peak<=.401,'the approved 0.40 mastering target');
});


test('approved V4.1 motion and rendering are byte-identical to frozen preview blobs',()=>{
 const crypto=require('node:crypto');
 for(const [name,expected] of [['pasture-praise-motion.js','73e0edc9166240945740dec90bf1fd341f45a725'],['pasture-praise-render.js','1cf47453db38aa1d86289a6148af2512690c5eee']]){
  const bytes=fs.readFileSync(path.join(root,name));
  const hash=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  assert.equal(hash,expected,name);
 }
});
function praiseBridgeFixture(){
 let time=0;
 const layout=Array.from({length:44},(_,id)=>({id,x:id*3,y:180,s:.5,rest:id===0}));
 const plan={count:44,moving:43,formed:42};
 const calls=[];
 const w={performance:{now:()=>time},setTimeout(){},addEventListener(){},
  BudaoHourlyHymns:{},BudaoPastureHymnScores:[{}],BudaoPastureHalfHourScores:[{}],
  __budaoPastureHourlyHymns:{playback:null},
  BudaoPraisePreview:{
   prepare:()=>({beat:.5}),buildShape:()=>plan,
   formationFactor:()=>.8,timing:()=>({edge:10}),
   formationPose:(_m,t,d,_p,id)=>({gx:80+id,gy:180,stand:1,step:.8,head:0,sway:0,t,d}),
   halfPose:(_m,t,d,o,g)=>{calls.push([t,d,o.id,g.mode]);return {gx:o.x,gy:o.y,stand:o.rest?0:1,step:.8,head:1,sway:1}},
   pathPose:(_p,id,f)=>({gx:id*3+f*100,gy:180,stand:1,step:.8,head:0,sway:0})
  }};
 vm.runInNewContext(fs.readFileSync(path.join(root,'pasture-praise-live.js'),'utf8'),{window:w,console});
 return {w,layout,calls,frame:(l=layout,mode='landscape')=>w.BudaoPasturePraise.frame(mode,480,300,l),
  play:(kind,elapsed,id=1)=>{w.__budaoPastureHourlyHymns.playback={id,kind,index:0,hour:21,elapsed,duration:60}},
  stop:()=>{w.__budaoPastureHourlyHymns.playback=null},time:t=>{time=t}};
}
test('V4.1 bridge accepts same 44-member path plan as approved preview',()=>{
 const f=praiseBridgeFixture();f.play('hour',.5);const frame=f.frame();
 assert.equal(Object.keys(frame.poses).length,44);
 assert.equal(frame.poses[0].t,.5);assert.equal(frame.poses[0].d,60);
});
test('half-hour joins after audio begins, retries incomplete flock, samples exact approved halfPose',()=>{
 const f=praiseBridgeFixture();f.play('half',2.2);
 assert.equal(f.frame(f.layout.slice(0,43)),null);
 const frame=f.frame();assert.equal(Object.keys(frame.poses).length,44);
 assert.deepEqual(f.calls[0],[2.2,60,0,'landscape']);
 assert.equal(frame.poses[0].head,1);
 f.stop();f.frame();f.time(125);assert.equal(f.frame().poses[0].head,.75);
 f.time(500);assert.equal(f.frame(),null);
});
test('late hourly frame starts at home and converges on original approved path without teleporting',()=>{
 const f=praiseBridgeFixture();f.play('hour',3);
 assert.equal(f.frame().poses[0].gx,0);
 f.play('hour',8);assert.equal(f.frame().poses[0].gx,40);
 f.play('hour',13);assert.equal(f.frame().poses[0].gx,80);
 f.stop();f.frame();f.time(1000);assert.ok(f.frame().poses[0].gx<80);
});
