const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const home=read('home.html'),manna=read('manna/index.html'),css=read('style.css');
test('MANNA public launch: single discreet entry, original primary links unchanged',()=>{
 const start=home.indexOf('<nav>');
 const end=home.indexOf('</nav>',start);
 assert.ok(start>=0&&end>start);
 const nav=home.slice(start,end);
 for(const href of ['/home.html','/test.html','/tongxing.html','/tongdao.html','/what.html','/tonglu.html'])assert.ok(nav.includes('href="'+href+'"'),href);
 assert.equal(home.split('class="manna-home-entry"').length-1,1);
 assert.equal(home.split('href="/yhzd.html"').length-1,1);
 assert.equal(home.split('href="/lsxh.html"').length-1,1);
 assert.ok(css.includes('footer .manna-home-entry'));
});
test('MANNA public launch: transparent logo, five spaces and no real checkout',()=>{
 assert.ok(manna.includes('src="/manna/assets/manna-logo-transparent.png"'));
 assert.equal(manna.split('class="space-jump').length-1,5);
 assert.ok(manna.includes('暂未开售'));
 assert.ok(!manna.includes('<form'));
 assert.ok(!manna.includes('href="/manna/workbench/"'));
 const pages=['manna/about/index.html','manna/goods/index.html',
 'manna/goods/sample-01/index.html','manna/goods/sample-02/index.html','manna/goods/sample-03/index.html'];
 for(const p of pages){
  const s=read(p);
  assert.ok(s.includes('暂未开售')||s.includes('暂未销售'),p);
  assert.ok(!s.includes('checkout.stripe.com'),p);
 }
});
