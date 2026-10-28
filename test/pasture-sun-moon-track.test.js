const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const track=require('../pasture-sun-moon-track.js');

const hour=(day,h)=>Date.UTC(2026,9,day,h);
const astronomy={
  sunsetYesterday:hour(27,18),
  sunriseToday:hour(28,6),
  sunsetToday:hour(28,18),
  sunriseTomorrow:hour(29,6)
};

test('Sun enters on extreme left at sunrise, reaches center at noon, exits on right at sunset',()=>{
  assert.deepEqual({body:track.segmentAt(hour(28,6),astronomy).body,progress:track.segmentAt(hour(28,6),astronomy).progress},{body:'sun',progress:0});
  const noon=track.segmentAt(hour(28,12),astronomy);
  assert.equal(noon.body,'sun');
  assert.equal(noon.progress,.5);
  assert.equal(track.segmentAt(hour(28,18)-1,astronomy).body,'sun');
  const a=track.positionAt({progress:0,width:480,skyBottom:96,radiusPx:13});
  const b=track.positionAt({progress:.5,width:480,skyBottom:96,radiusPx:13});
  const c=track.positionAt({progress:1,width:480,skyBottom:96,radiusPx:13});
  assert.equal(a.x,-13);
  assert.equal(b.x,240);
  assert.equal(c.x,493);
  assert.ok(b.y<a.y&&b.y<c.y);
  assert.ok(a.y<96&&b.y>=0);
});

test('Moon enters from left at sunset, crosses midnight, and exits right before sunrise',()=>{
  assert.deepEqual({body:track.segmentAt(hour(28,18),astronomy).body,progress:track.segmentAt(hour(28,18),astronomy).progress},{body:'moon',progress:0});
  assert.equal(track.segmentAt(hour(29,0),astronomy).progress,.5);
  assert.ok(track.segmentAt(hour(29,6)-1,astronomy).progress>.999);
  assert.equal(track.segmentAt(hour(28,0),astronomy).body,'moon');
  assert.equal(track.segmentAt(hour(28,0),astronomy).progress,.5);
  const mid=track.positionAt({progress:.5,width:300,skyBottom:124,radiusPx:8});
  assert.equal(mid.x,150);
  assert.ok(mid.y>0&&mid.y<124);
  assert.equal(track.segmentAt(hour(28,6),astronomy).body,'sun');
});

test('invalid or stale sunrise sunset data does not invent solar events',()=>{
  assert.equal(track.segmentAt(NaN,astronomy),null);
  assert.equal(track.segmentAt(hour(28,12),{}),null);
  assert.equal(track.segmentAt(hour(29,8),astronomy),null);
  assert.equal(track.segmentAt(hour(28,3),{...astronomy,sunsetYesterday:null}),null);
  assert.equal(track.positionAt({progress:0,width:0,skyBottom:96,radiusPx:8}),null);
});

test('landscape and portrait use same track while preserving star projection and Moon phase renderer',()=>{
  for(const file of ['tonglu.html','tonglu-pasture-portrait.html']){
    const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    assert.match(source,/<script src="\/pasture-sun-moon-track\.js"><\/script>/);
    assert.match(source,/BudaoPastureTrack\?\.segmentAt\(now,state\.astronomy\)/);
    assert.match(source,/segment\?\.body==='sun'/);
    assert.match(source,/segment\?\.body==='moon'/);
    assert.match(source,/sky\.projectHorizontal\(/);
    assert.match(source,/sky\.starTwinkle\(/);
    assert.match(source,/\.moon\.phase\)\|\|0/);
    assert.doesNotMatch(source,/const sunXY=project\(/);
    assert.doesNotMatch(source,/const moonXY=(?:project\(|sky\.projectDiscHorizontal\()/);
  }
});

test('screen trajectories scale with canvas while crossing sky only',()=>{
  for(const width of [300,480,720]){
    const skyBottom=width===300?124:96;
    for(const radiusPx of [8,13]){
      let last=-Infinity;
      for(let i=0;i<=100;i++){
        const p=i/100;
        const {x,y}=track.positionAt({progress:p,width,skyBottom,radiusPx});
        assert.ok(x>=last);
        assert.ok(y<skyBottom);
        assert.ok(y>=0);
        last=x;
      }
    }
  }
});
