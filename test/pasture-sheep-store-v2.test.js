const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const domain = require('../api/_security/pasture-auth-domain');

const storeSource = fs.readFileSync('api/_security/pasture-auth-store.js','utf8');

test('pasture schema migrates sheep storage additively to V2', () => {
  assert.match(storeSource, /ALTER TABLE pasture_sheep ADD COLUMN IF NOT EXISTS appearance_version integer NOT NULL DEFAULT 1/i);
  assert.match(storeSource, /ALTER TABLE pasture_sheep ADD COLUMN IF NOT EXISTS appearance_v2 jsonb/i);
  assert.doesNotMatch(storeSource, /DROP TABLE\s+pasture_sheep/i);
});

test('public V1 sheep remains intact after V2 schema migration', () => {
  const user = {id:'u1',emailMasked:'to***@example.com',createdAt:'2026-10-11'};
  const sheep = {id:'s1',bodyColor:'#f4ecdc',headColor:'#8d836e',marking:'NONE',appearanceVersion:1,appearanceV2:null,createdAt:'2026-10-11'};
  const out = domain.publicUser(user,sheep);
  assert.equal(out.sheep.appearanceVersion, 1);
  assert.equal(out.sheep.appearance, null);
  assert.equal(out.sheep.bodyColor, sheep.bodyColor);
  assert.equal(out.sheep.headColor, sheep.headColor);
  assert.equal(out.sheep.marking, sheep.marking);
});

test('store selects V2 aliases and V2 save backfills legacy fields server-side', () => {
  assert.match(storeSource, /appearance_version AS "appearanceVersion"/);
  assert.match(storeSource, /appearance_v2 AS "appearanceV2"/);
  assert.match(storeSource, /appearance\.legacy\.bodyColor/);
  assert.match(storeSource, /appearance\.legacy\.headColor/);
  assert.match(storeSource, /appearance\.legacy\.marking/);
  assert.match(storeSource, /appearance\.v2/);
});

test('server validates exact V2 sheep enums and rejects unknown dimensions', () => {
  const valid = {
    appearanceVersion:2,
    appearance:{version:2,woolColor:'cloudWhite',faceColor:'warmTaupe',woolShape:'soft',bodyShape:'standard',ears:'medium',expression:'calm',marking:'none',forelock:'none'}
  };
  const out = domain.validateSheep(valid);
  assert.equal(out.appearanceVersion,2);
  assert.equal(out.v2.version,2);
  assert.match(out.legacy.bodyColor,/^#/);
  assert.throws(()=>domain.validateSheep({...valid,appearance:{...valid.appearance,horns:'yes'}}), e=>e.code==='INVALID_SHEEP');
  assert.throws(()=>domain.validateSheep({...valid,appearance:{...valid.appearance,ears:'horns'}}), e=>e.code==='INVALID_SHEEP');
});
