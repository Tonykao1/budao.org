'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const B=require('../pasture-reader-bible.js');
const authDomain=require('../api/_security/pasture-auth-domain.js');
test('66-book public-domain reader has canonical chapter metadata',()=>{
 assert.equal(B.groups.old.length+B.groups.new.length,66);
 assert.equal(B.bookMeta('马可福音').chapters,16);
 assert.equal(B.bookMeta('创世记').chapters,50);
 const url=B.chapterUrl('可',1);
 assert.match(url,/^https:\/\/cdn\.jsdelivr\.net\/gh\/sangchy1972\/pd-text-corpus@0bf4ed97/);
 assert.match(url,/\/chapters\/1\.json$/);
});
test('only server-backed card activation field grants reader access',()=>{
 const base={id:'resident-1',emailMasked:'x***@example.org',createdAt:new Date(),sheep:null};
 assert.equal(authDomain.publicUser({...base,cardActivatedAt:null},null).cardActivated,false);
 assert.equal(authDomain.publicUser({...base,cardActivatedAt:new Date()},null).cardActivated,true);
 const store=read('api/_security/pasture-auth-store.js');
 assert.match(store,/ADD COLUMN IF NOT EXISTS card_activated_at/);
 assert.match(store,/u\.card_activated_at AS "cardActivatedAt"/);
 const front=read('pasture-live.js');
 assert.match(front,/result\.user\.cardActivated!==true/);
 assert.match(front,/result\.user\.id!==resident\.id/);
});
test('reader never writes private devotionals or voice recordings',()=>{
 const source=read('pasture-reader.js');
 assert.match(source,/fetch\('\/api\/pasture-auth'/);
 assert.match(source,/data\.user\?\.cardActivated===true/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|MediaRecorder|\.setItem\(/);
 assert.match(read('my-grass-reader.html'),/第一阶段：只读经文/);
 const live=read('pasture-live.js');
 assert.match(live,/pasture-founder-reader-open/);
 assert.match(live,/location\.assign\('\/my-grass-reader\.html'\)/);
});
