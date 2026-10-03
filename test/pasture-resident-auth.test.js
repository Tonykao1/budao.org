const test=require('node:test');
const assert=require('node:assert/strict');
process.env.PASTURE_SESSION_SECRET='pasture-test-secret-which-is-definitely-longer-than-thirty-two-characters';
const d=require('../api/_security/pasture-auth-domain');

test('pasture resident auth keeps email private and produces stable lookup hashes',()=>{
 assert.equal(d.validEmail('walker@example.com'),true);
 assert.equal(d.validEmail('bad email'),false);
 assert.equal(d.normalizeEmail('  WALKER@EXAMPLE.COM '),'walker@example.com');
 assert.equal(d.maskEmail('walker@example.com'),'wa***@example.com');
 assert.equal(d.emailHash('WALKER@example.com'),d.emailHash('walker@example.com'));
 assert.notEqual(d.emailHash('walker@example.com'),d.emailHash('other@example.com'));
});
test('resident session cookie is HttpOnly and 180-day scoped',()=>{
 const cookie=d.serializeSessionCookie('token',false);
 assert.match(cookie,/budao_pasture_session=token/);
 assert.match(cookie,/HttpOnly/);
 assert.match(cookie,/SameSite=Lax/);
 assert.match(cookie,/Max-Age=15552000/);
});
test('resident owns exactly one validated sheep profile domain object',()=>{
 const sheep=d.validateSheep({bodyColor:d.BODY_COLORS[0],headColor:d.HEAD_COLORS[1],marking:'FACE'});
 assert.deepEqual(sheep,{bodyColor:d.BODY_COLORS[0],headColor:d.HEAD_COLORS[1],marking:'FACE'});
 assert.throws(()=>d.validateSheep({bodyColor:'#000000',headColor:d.HEAD_COLORS[0],marking:'NONE'}),/invalid_sheep/);
 assert.equal(d.BODY_COLORS.length,8);
 assert.equal(d.HEAD_COLORS.length,8);
});
test('pasture identity has independent tables from stewardship/admin identities',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const schema=fs.readFileSync(path.join(__dirname,'..','db/schema.js'),'utf8');
 for(const name of ['pastureUsers','pastureEmailVerifications','pastureSessions','pastureSheep'])assert.match(schema,new RegExp('const '+name+' = pgTable'));
 assert.match(schema,/const stewardshipUsers = pgTable/);
 assert.match(schema,/pasture_users/);
 assert.match(schema,/stewardship_users/);
});
test('migration hard-enforces one sheep per resident',()=>{
 const sql=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','db/migrations/0004_pasture_identity.sql'),'utf8');
 assert.match(sql,/pasture_sheep_user_id_uq/);
 assert.match(sql,/CREATE UNIQUE INDEX[\s\S]*pasture_sheep\(user_id\)/);
 assert.match(sql,/REFERENCES pasture_users\(id\) ON DELETE CASCADE/);
});
test('guest controls are hidden; authenticated controls remain deliberately locked',()=>{
 const css=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','pasture-preview/pasture-resident-gate.css'),'utf8');
 const js=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','pasture-preview/pasture-resident-gate.js'),'utf8');
 assert.match(css,/body:not\(\.pasture-resident-authenticated\) \.actions/);
 assert.match(js,/pasture-feature-locked/);
 assert.match(js,/aria-disabled/);
});
test('landscape and portrait both implement resident 44+1 and sky arrival',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const landscape=fs.readFileSync(path.join(__dirname,'..','tonglu.html'),'utf8');
 const portrait=fs.readFileSync(path.join(__dirname,'..','tonglu-pasture-portrait.html'),'utf8');
 assert.match(landscape,/__tongluFlockCount=o\?45:44/);
 assert.match(landscape,/residentArrivalStarted/);
 assert.match(landscape,/drawDesktopResidentSheep/);
 assert.match(portrait,/kind:'resident'/);
 assert.match(portrait,/residentArrivalStarted/);
 assert.match(portrait,/drawResidentLamb/);
});
test('sheep maker is visual-first with live preview and no dropdown customization',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const maker=fs.readFileSync(path.join(__dirname,'..','pasture-preview/pasture-sheep-maker.js'),'utf8');
 assert.doesNotMatch(maker,/<select/i);
 assert.match(maker,/pastureSheepPreview/);
 assert.match(maker,/data-sheep-body/);
 assert.match(maker,/data-sheep-head/);
 assert.match(maker,/data-sheep-mark/);
 assert.match(maker,/aria-pressed/);
 assert.match(maker,/saveSheep/);
});
test('resident sheep hand uses relaxed, ready, and grabbing states without the five-finger fork cursor',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const landscape=fs.readFileSync(path.join(__dirname,'..','tonglu.html'),'utf8');
 assert.match(landscape,/PIXEL_HAND_RELAXED/);
 assert.match(landscape,/PIXEL_HAND_READY/);
 assert.match(landscape,/PIXEL_HAND_CLOSED/);
 assert.match(landscape,/residentHandState/);
 assert.doesNotMatch(landscape,/PIXEL_HAND_OPEN=/);
 assert.match(landscape,/residentHit\(e\.clientX,e\.clientY\)/);
 assert.match(landscape,/baaa01\.mp3/);
});
