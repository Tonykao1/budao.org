'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const domain=require('../api/_security/pasture-auth-domain');
const dna=require('../pasture-sheep-dna');
test('accepted V2 maker preserves all 8 identity dimensions through server validation',()=>{
 const accepted=dna.defaultV2();
 accepted.woolColor='black';accepted.faceColor='sand';
 accepted.woolShape='curly';accepted.bodyShape='round';
 accepted.ears='droop';accepted.expression='joyful';
 accepted.marking='earMark';accepted.forelock='curl';
 const stored=domain.validateSheep({appearanceVersion:2,appearance:accepted});
 assert.equal(stored.appearanceVersion,2);
 assert.deepEqual(stored.appearanceV2,accepted);
 assert.equal(stored.marking,'FACE');
 assert.equal(stored.bodyColor,dna.toLegacy(accepted).bodyColor);
 const user=domain.publicUser({id:'test-resident',emailMasked:'t***@example.com',cardActivatedAt:null},{
   id:'old-existing-sheep',...stored
 });
 assert.equal(user.sheep.id,'old-existing-sheep');
 assert.deepEqual(user.sheep.appearance,accepted);
 assert.equal(user.cardActivated,false);
});
test('invalid V2 sheep does not silently become legacy',()=>{
 assert.throws(()=>domain.validateSheep({appearanceVersion:2,appearance:{version:2,woolColor:'not-a-color'}}),/invalid_sheep/);
});
test('existing sheep is protected against any second save and schema retains V2 columns',()=>{
 const schema=read('db/schema.js'),store=read('api/_security/pasture-auth-store.js');
 assert.match(schema,/appearanceVersion: integer\("appearance_version"\)/);
 assert.match(schema,/appearanceV2: jsonb\("appearance_v2"\)/);
 assert.match(store,/ADD COLUMN IF NOT EXISTS appearance_version/);
 assert.match(store,/ADD COLUMN IF NOT EXISTS appearance_v2/);
 assert.match(store,/if \(existing\) \{[\s\S]{0,260}return \{ sheep: existing, created: false \}/);
 assert.match(read('api/_security/pasture-auth-handler.js'),/domain\.publicSheep\(sheep\)/);
});
test('preview now shows four-stage accepted V2 maker and never overwrites resident sheep',()=>{
 const maker=read('pasture-preview/pasture-sheep-maker.js');
 const entry=read('pasture-preview/index.html');
 for(const match of [/makerScreenMarkup/,/screen===1/,/screen===2/,/screen===3/,/maker-confirm/,/BASE_DIMS/,/FEATURE_DIMS/,/validateV2/,/appearanceVersion:2/,/const latest=await auth\.call\(null,'GET'\)/,/if\(latest\.user\?\.sheep\)/,/if\(user\.sheep&&!review\)/])assert.match(maker,match);
 assert.doesNotMatch(maker,/pasture-visual-choice|const bodies=\[\[/);
 assert.match(entry,/pasture-sheep-maker-v2\.css/);
});
test('V2 maker JS parses',()=>{
 const vm=require('node:vm');
 assert.doesNotThrow(()=>new vm.Script(read('pasture-preview/pasture-sheep-maker.js')));
});
