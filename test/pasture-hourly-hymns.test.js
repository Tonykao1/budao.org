'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const hourly=require(path.join(root,'pasture-hourly-hymns.js'));
const scope={window:{}};
for(const name of ['pasture-hourly-scores.js','pasture-hourly-last-score.js'])
  vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),scope,{filename:name});
const songs=scope.window.BudaoPastureHymnScores;
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
test('pasture clearly requires re-authorization after reload',()=>{
  const s=fs.readFileSync(path.join(root,'pasture-hourly-hymns.js'),'utf8');
  assert.match(s,/每次打开牧场都须点击/);
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
    assert.ok(h.indexOf('pasture-hourly-last-score.js')<h.indexOf('pasture-hourly-hymns.js'));
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
  const win={AudioContext:FakeAudio,localStorage:{getItem:()=>null,setItem(){}},
    addEventListener(){},dispatchEvent(){},
    setTimeout(fn,delay){jobs.push({fn,delay});return jobs.length;},
    clearTimeout(){}};
  const engine=hourly.init({window:win,document:doc,scores});
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
