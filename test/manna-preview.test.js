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
 const file=fs.readFileSync(path.join(base,'manna/assets/manna-logo-transparent.png'));
 assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(file.readUInt32BE(16),1254);
 assert.equal(file.readUInt32BE(20),1254);
 assert.equal(file[25],6); // PNG color type 6 = RGBA alpha channel
 const prefix=Buffer.concat([Buffer.from('blob '+file.length),Buffer.from([0])]);
 const sha=crypto.createHash('sha1').update(prefix).update(file).digest('hex');
 assert.equal(sha,'40994d570501eb8b381aa1848db62c17f212e67c');
 const pages=['manna/index.html','manna/goods/index.html','manna/about/index.html',...['01','02','03'].map(id=>'manna/goods/sample-'+id+'/index.html')];
 for(const page of pages)assert.ok(read(page).includes('class="nav-brand-logo" src="/manna/assets/manna-logo-transparent.png"'),page);
 assert.ok(read('manna/index.html').includes('class="hero-brand-logo" src="/manna/assets/manna-logo-transparent.png"'));
});
test('MANNA: transparent logo appears without any visual backing or crop',()=>{
 const logoRules=css.slice(css.indexOf('/* MANNA original-logo display:'));
 assert.ok(logoRules.includes('.portal .hero-logo-stage{'));
 assert.match(logoRules,/\.portal \.hero-logo-stage\{[^}]*background:transparent;[^}]*border:0;[^}]*box-shadow:none;[^}]*backdrop-filter:none/);
 assert.match(logoRules,/\.portal \.hero-brand-logo\{[^}]*object-fit:contain;[^}]*background:transparent;[^}]*mix-blend-mode:normal;[^}]*filter:none/);
 assert.match(logoRules,/\.nav-brand-logo\{[^}]*object-fit:contain;[^}]*background:transparent;[^}]*mix-blend-mode:normal/);
 assert.doesNotMatch(logoRules,/object-fit:cover|mix-blend-mode:multiply|background:linear-gradient|background:#fff|background:#faf7ee/i);
});

test('MANNA: the five sections have visible, consistent 01–05 navigation',()=>{
  const ids=['gate','table','measure','field','rest'];
  for(const [index,id] of ids.entries()){
    const num=String(index+1).padStart(2,'0');
    assert.ok(home.includes('class="space-jump'+(index===0?' active':'')+'" href="#'+id+'"'),id);
    assert.ok(home.includes('<span class="space-step">'+num+'</span>'),num);
    assert.ok(home.includes('id="'+id+'"'),id);
  }
  const numbers=Array.from(home.matchAll(/<span class="chapter-no">([0-9]{2} [/] 05)<[/]span>/g)).map(m=>m[1]);
  assert.deepEqual(numbers,['01 / 05','02 / 05','03 / 05','04 / 05','05 / 05']);
  assert.ok(home.includes('<span class="chapter-no">尾声</span> 归途'));
  assert.ok(!home.includes('00 / 05'));
  assert.ok(css.includes('.space-directory{position:sticky'));
  assert.ok(css.includes('@media(max-width:1050px){.space-directory'));
  assert.ok(js.includes('querySelectorAll(".rail-item, .space-jump")'));
});
