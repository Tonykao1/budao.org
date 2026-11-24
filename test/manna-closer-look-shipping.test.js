const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('MANNA 001 offers Mainland China free shipping consistently across the three public pages',()=>{
 const home=read('manna/index.html'),goods=read('manna/goods/index.html'),detail=read('manna/goods/budao-gospel-fleece/index.html');
 for(const [name,s] of [['home',home],['goods',goods],['detail',detail]]){
  assert.ok(s.includes('中国大陆地区包邮'),name);
  assert.ok(!s.includes('包邮 · 配送范围待确认'),name);
 }
 assert.ok(!detail.includes('包邮；适用配送范围待核实'));
 assert.ok(detail.includes('其他地区的配送及费用尚未确认'));
 assert.ok(detail.includes('购买通道暂未开放'));
});
test('MANNA closer-look page features the actual flagship with correct gallery and working links',()=>{
 const goods=read('manna/goods/index.html'),home=read('manna/index.html');
 assert.ok(goods.includes('<h1>好物，值得细看。</h1>'));
 assert.ok(home.includes('好物，值得细看'));
 assert.ok(goods.includes('MANNA / 001 · 首款主打'));
 assert.ok(goods.includes('manna-first-product-list'));
 assert.ok(goods.includes('/manna/assets/budao-fleece-front-hq-v2.webp'));
 assert.ok(goods.includes('/manna/assets/budao-fleece-back-hq-v2.webp'));
 assert.ok(goods.includes('/manna/assets/budao-fleece-lining-hq-v2.webp'));
 assert.ok(goods.includes('¥204'));
 assert.ok(goods.includes('/manna/goods/budao-gospel-fleece/'));
 assert.ok(!goods.includes('/manna/goods/sample-01/'));
});
test('Shipping and product display change does not open checkout or alter size/material',()=>{
 const detail=read('manna/goods/budao-gospel-fleece/index.html');
 for(const s of ['400 g/㎡','56.1%','43.9%','94.2%','5.8%','3 日内发货','备货充足','穿着合适的卫衣'])assert.ok(detail.includes(s),s);
 assert.ok(!detail.includes('立即购买')&&!detail.includes('checkout.stripe.com'));
 const css=read('manna/assets/manna.css');
 assert.ok(css.includes('.manna-closer-look{'));
 assert.ok(css.includes('@media(max-width:780px)'));
});
