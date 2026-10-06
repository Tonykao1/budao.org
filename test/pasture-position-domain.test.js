const test=require('node:test');
const assert=require('node:assert/strict');

process.env.PASTURE_SESSION_SECRET='pasture-test-secret-which-is-definitely-longer-than-thirty-two-characters';

function load(){
  delete require.cache[require.resolve('../api/_security/pasture-position-domain.js')];
  return require('../api/_security/pasture-position-domain.js');
}

test('pasture daily position domain validates mode date and coordinates',()=>{
  const domain=load();
  assert.equal(domain.normalizeMode('landscape'),'landscape');
  assert.equal(domain.normalizeMode('portrait'),'portrait');
  assert.throws(()=>domain.normalizeMode('square'),/invalid_mode/);
  assert.equal(domain.validateDateKey('2026-10-06'),'2026-10-06');
  for(const value of ['2026-2-03','06-10-2026','2026-13-01','today']) assert.throws(()=>domain.validateDateKey(value),/invalid_date/);
  assert.deepEqual(domain.validatePosition('landscape',{x:52,y:212,flip:true}),{x:52,y:212,flip:true});
  assert.throws(()=>domain.validatePosition('landscape',{x:-1,y:212,flip:false}),/invalid_position/);
  assert.throws(()=>domain.validatePosition('portrait',{x:42,y:999,flip:false}),/invalid_position/);
});

test('same resident same day and mode gets deterministic placement',()=>{
  const domain=load();
  const a=domain.generateDailyPosition('11111111-1111-1111-1111-111111111111','2026-10-06','landscape');
  const b=domain.generateDailyPosition('11111111-1111-1111-1111-111111111111','2026-10-06','landscape');
  assert.deepEqual(a,b);
  assert.equal(domain.seedForDailyPosition('11111111-1111-1111-1111-111111111111','2026-10-06','landscape'),domain.seedForDailyPosition('11111111-1111-1111-1111-111111111111','2026-10-06','landscape'));
});

test('next day changes the deterministic daily placement',()=>{
  const domain=load();
  const a=domain.generateDailyPosition('22222222-2222-2222-2222-222222222222','2026-10-06','landscape');
  const b=domain.generateDailyPosition('22222222-2222-2222-2222-222222222222','2026-10-07','landscape');
  assert.notDeepEqual(a,b);
});

test('generated placements stay inside approved visible candidate zones for both modes',()=>{
  const domain=load();
  for(const mode of ['landscape','portrait']){
    for(let day=1;day<=24;day++){
      const date=`2026-10-${String(day).padStart(2,'0')}`;
      const pos=domain.generateDailyPosition('33333333-3333-3333-3333-333333333333',date,mode);
      assert.deepEqual(domain.validatePosition(mode,pos),pos);
      if(mode==='landscape'){
        assert.ok(pos.x>=40&&pos.x<=310);
        assert.ok(pos.y>=195&&pos.y<=285);
      }else{
        assert.ok(pos.x>=35&&pos.x<=265);
        assert.ok(pos.y>=240&&pos.y<=450);
      }
    }
  }
});
