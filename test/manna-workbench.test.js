const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('manna/workbench/index.html'),css=read('manna/workbench/workbench.css'),js=read('manna/workbench/workbench.js');
test('workbench: standalone preview without any persistent write or checkout',()=>{
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.match(html,/数据只保存在当前页面生效|内容仅在当前页面生效/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon/);
 assert.doesNotMatch(html,/<form\b|type="submit"/i);
 assert.doesNotMatch(js,/api\/products|checkout|payments/);
 assert.doesNotMatch(read('manna/index.html'),/href="\/manna\/workbench\//);
});
test('workbench: all stages and simulated roles visible',()=>{
 for(const value of ['basics','images','fairness','delivery','history']){
  assert.match(html,new RegExp('data-tab="'+value+'"'));
  assert.match(html,new RegExp('id="editor-'+value+'"'));
 }
 for(const id of ['switch-editor','switch-reviewer','submit-review','save-draft','reset-demo','create-product'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const step of ['draft','review','approved','published'])assert.ok(js.includes('status:"'+step+'"')||js.includes('p.status="'+step+'"')||js.includes('p.status==="'+step+'"'),step);
 assert.match(html,/角色模拟/);
 assert.match(html,/不会出现在|不会上传|不连接商品数据库/);
});
test('workbench: photos can only be previewed on device',()=>{
 assert.match(html,/accept="image\/jpeg,image\/png,image\/webp"/);
 assert.match(js,/URL\.createObjectURL\(file\)/);
 assert.match(js,/URL\.revokeObjectURL/);
 assert.match(js,/8\*1024\*1024/);
 assert.match(js,/5-p\.images\.length/);
});
test('workbench: price verification is computationally balanced',()=>{
 const price=128,cost=54+24+18+8;
 assert.equal(cost,104);
 assert.equal(price-cost,24);
 assert.match(js,/Math\.round\(total\*100\)<=Math\.round\(price\*100\)/);
 assert.match(js,/c\.remainder<0/);
});
test('workbench: visual and accessibility foundations',()=>{
 assert.match(html,/aria-selected="true"/);
 assert.match(html,/role="tablist"/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/manna-logo-transparent\.png/);
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.studio-logo\{[^}]*object-fit:contain;[^}]*background:transparent/);
 new Function(js);
});
