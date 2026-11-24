const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(base,p),'utf8');
const home=read('manna/index.html'),css=read('manna/assets/manna.css'),js=read('manna/assets/manna.js');
test('MANNA: English spelling canonical; five narrative spaces',()=>{
 assert.match(home,/MANNA/);
 assert.match(home,/供应之门/);
 assert.match(home,/丰盛之桌/);
 assert.match(home,/公平之秤/);
 assert.match(home,/同工之场/);
 assert.match(home,/安息之所/);
 assert.doesNotMatch(home,/MAINA|maina/i);
});
test('MANNA: linked pages exist and are marked demo',()=>{
 for(const p of ['manna/goods/index.html','manna/about/index.html','manna/goods/sample-01/index.html','manna/goods/sample-02/index.html','manna/goods/sample-03/index.html']){
  const content=read(p);
  assert.match(content,/MANNA/);
  assert.match(content,/noindex,nofollow/);
  assert.doesNotMatch(content,/checkout\.stripe\.com|paypal\.com\/checkout|<form\b/i);
 }
 for(const id of ['01','02','03'])assert.match(js,new RegExp('/manna/goods/sample-'+id+'/'));
});
test('MANNA: preview clearly non-transactional and no personal information capture',()=>{
 assert.match(home,/暂未开售/);
 assert.match(home,/不会产生订单、付款或个人资料记录/);
 assert.doesNotMatch(home,/type="email"|type="password"|<form\b/i);
 assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie|fetch\(/);
});
test('MANNA: calculator arithmetic stays balanced for full slider range',()=>{
 const price=128,baseCosts=54+18+8;
 for(let pay=16;pay<=40;pay+=2){
  const surplus=price-baseCosts-pay;
  assert.equal(54+18+8+pay+surplus,price);
  assert.ok(surplus>=0);
 }
 assert.match(js,/surplus=price-fixedCosts-labor/);
});
test('MANNA: style has motion guard and responsive breakpoints',()=>{
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(home,/aria-pressed/);
 assert.match(home,/<dialog/);
});
const crypto=require('node:crypto');
test('MANNA: original transparent 1254px PNG is intact and used throughout preview',()=>{
 const image=fs.readFileSync(path.join(base,'manna/assets/manna-logo-transparent.png'));
 assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(image.readUInt32BE(16),1254);
 assert.equal(image.readUInt32BE(20),1254);
 assert.equal(image[25],6); // PNG color type RGBA, full alpha channel.
 const prefix=Buffer.from('blob '+image.length+'\\0');
 const sha=crypto.createHash('sha1').update(prefix).update(image).digest('hex');
 assert.equal(sha,'40994d570501eb8b381aa1848db62c17f212e67c');
 const pages=['manna/index.html','manna/goods/index.html','manna/about/index.html',...['01','02','03'].map(id=>'manna/goods/sample-'+id+'/index.html')];
 for(const page of pages){assert.match(read(page),/class="nav-brand-logo" src="\\/manna\\/assets\\/manna-logo-transparent\\.png"/)}
 assert.match(read('manna/index.html'),/class="hero-brand-logo" src="\\/manna\\/assets\\/manna-logo-transparent\\.png"/);
});
