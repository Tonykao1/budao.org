const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('MANNA main page has one hero product replacing demonstration samples',()=>{
 const home=read('manna/index.html');
 assert.match(home,/MANNA \/ 001 · 首款主打/);
 assert.match(home,/400 g\/㎡/);
 assert.match(home,/¥204/);
 assert.match(home,/购买通道尚未开放/);
 assert.ok(home.includes('/manna/goods/budao-gospel-fleece/'));
 assert.ok(!home.includes('sample-object selected'));
 for(const space of ['gate','table','measure','field','rest'])assert.ok(home.includes('id="'+space+'"'));
});
test('MANNA product detail is honest and photos do not include extra sleeve-footprint art',()=>{
 const s=read('manna/goods/budao-gospel-fleece/index.html');
 for(const x of ['204','包邮','400 g/㎡','56.1%','43.9%','94.2%','5.8%','购买通道暂未开放','买有所保，拿无所求。','尺码表'])assert.ok(s.includes(x),x);
 for(const x of ['budao-fleece-front.webp','budao-fleece-back.webp','budao-fleece-lining.webp'])assert.ok(s.includes(x),x);
 assert.ok(!s.includes('立即购买')&&!s.includes('checkout.stripe.com')&&!s.includes('支付成功'));
 assert.ok(!s.includes('赠品必得'));
});
test('MANNA only item in catalog; past sample URLs not advertised',()=>{
 const s=read('manna/goods/index.html');
 assert.ok(s.includes('首款主打'));
 assert.ok(!s.includes('/manna/goods/sample-01/'));
 assert.ok(!s.includes('/manna/goods/sample-02/'));
 assert.ok(!s.includes('/manna/goods/sample-03/'));
});
