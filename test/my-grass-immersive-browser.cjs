const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const activate=()=>localStorage.setItem('budao_pixel_card_activation_prototype_v1',JSON.stringify({
 phase:'active',seriesId:'CSCZ-001',usedSecond:false,
 final:{suit:'spade',rank:'A',numberColor:'red',dice:1,color:'white',side:'white',piece:'king'}
}));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const desktop=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];desktop.on('pageerror',e=>errors.push(String(e)));
  await desktop.addInitScript(activate);
  await desktop.goto('http://127.0.0.1:8787/pasture-preview/',{waitUntil:'domcontentloaded'});
  await desktop.waitForFunction(()=>!!document.getElementById('liveArea')?.contentDocument?.getElementById('grassWorkspace'),{timeout:60000});
  await desktop.evaluate(()=>document.getElementById('liveArea').contentDocument.getElementById('grassBookBtn').click());
  const zone=desktop.frameLocator('#liveArea');
  await zone.locator('#grassWorkspace').waitFor({state:'visible'});
  const dimensions=await zone.locator('#grassWorkspace').evaluate(node=>{
    const d=node.ownerDocument,b=d.querySelector('.book-object'),r=b.getBoundingClientRect();
    const folio=d.querySelector('#grassPixelFolio'),input=d.querySelector('[data-field="scriptureText"]');
    return {width:r.width,height:r.height,canvasW:folio.width,canvasH:folio.height,
     fontSize:parseFloat(getComputedStyle(input).fontSize),
     panels:d.querySelectorAll('.gs-grid>.gs-panel').length,
     stageWidth:d.querySelector('.gs-stage').getBoundingClientRect().width,
     top:d.querySelector('.book-layer').getBoundingClientRect().top};
  });
  assert.ok(dimensions.width>=1300,JSON.stringify(dimensions));
  assert.ok(dimensions.height>=780,JSON.stringify(dimensions));
  assert.equal(dimensions.canvasH,470);
  assert.ok(Math.abs(dimensions.canvasW/dimensions.canvasH-dimensions.width/dimensions.height)<0.035,JSON.stringify(dimensions));
  assert.ok(dimensions.fontSize>=16);
  assert.equal(dimensions.panels,2);
  assert.equal(dimensions.top,0);
  assert.equal(await zone.locator('#grassWorkspace .gs-steps button').count(),3);
  assert.equal((await zone.locator('#grassWorkspace').innerText()).includes('未来可在单独授权下，以朗读文字与原声建立专属声音模型。'),false);
  await desktop.screenshot({path:'/tmp/my-grass-v04-desktop.png',fullPage:true});

  await zone.locator('[data-action="scripture-nav"]').click();
  await zone.locator('#gsBibleNav').waitFor({state:'visible'});
  assert.equal(await zone.locator('#gsNavBook option').count(),27);
  await zone.locator('[data-nav="testament"][data-value="old"]').click();
  assert.equal(await zone.locator('#gsNavBook option').count(),39);
  await zone.locator('#gsNavBook').selectOption('诗');
  assert.equal(await zone.locator('#gsNavChapter option').count(),150);
  await zone.locator('#gsNavChapter').selectOption('23');
  await zone.locator('#gsNavFrom').fill('1');
  await zone.locator('#gsNavTo').fill('6');
  await zone.locator('[data-nav="apply"]').click();
  await zone.locator('#gsBibleNav').waitFor({state:'hidden'});
  assert.equal(await zone.locator('[data-field="reference"]').inputValue(),'诗 23:1–6');
  await zone.locator('[data-field="scriptureText"]').fill('由用户亲自输入的测试经文，不是自动提供的译本。');
  await zone.locator('[data-field="translation"]').fill('个人译本标注');
  await zone.locator('button[data-action="save"]').click();
  await zone.locator('#gsStatus').filter({hasText:'已保存'}).waitFor();
  await zone.locator('button[data-tab="reflection"]').click();
  assert.match(await zone.locator('.gs-scripture-read').innerText(),/由用户亲自输入的测试经文/);
  await zone.locator('[data-field="reflection"]').fill('今天读到这段经文的时候，我再次想到真实的关怀。');
  await zone.locator('button[data-action="save"]').click();
  await zone.locator('button[data-tab="sharing"]').click();
  assert.match(await zone.locator('.gs-note-source').innerText(),/真实的关怀/);
  await desktop.locator('#topExit').click();
  await desktop.waitForFunction(()=>!document.getElementById('liveArea')?.contentDocument?.body?.classList.contains('grassbook-open'));
  assert.deepEqual(errors,[]);
  console.log('IMMERSIVE DESKTOP PASS',JSON.stringify(dimensions),'Old/New 66-book navigation, Scripture, reflection and mother-note');

  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await mobile.addInitScript(activate);
  await mobile.goto('http://127.0.0.1:8787/pasture-preview/',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>!!document.getElementById('liveArea')?.contentDocument?.getElementById('grassWorkspace'),{timeout:60000});
  await mobile.evaluate(()=>document.getElementById('liveArea').contentDocument.getElementById('grassBookBtn').click());
  const mz=mobile.frameLocator('#liveArea');
  await mz.locator('#grassWorkspace').waitFor({state:'visible'});
  const m=await mz.locator('#grassWorkspace').evaluate(node=>{
   const d=node.ownerDocument,rect=d.querySelector('.book-object').getBoundingClientRect();
   const canvas=d.querySelector('#grassPixelFolio');
   return {width:rect.width,height:rect.height,canvasW:canvas.width,canvasH:canvas.height,
    fontSize:parseFloat(getComputedStyle(d.querySelector('[data-field="scriptureText"]')).fontSize),
    columns:getComputedStyle(d.querySelector('.gs-grid')).gridTemplateColumns};
  });
  assert.ok(m.width>=370,JSON.stringify(m));
  assert.ok(m.height>=790,JSON.stringify(m));
  assert.equal(m.canvasW,320);
  assert.ok(Math.abs(m.canvasW/m.canvasH-m.width/m.height)<0.035,JSON.stringify(m));
  assert.ok(m.fontSize>=16);
  assert.equal(m.columns.split(' ').length,1);
  await mobile.screenshot({path:'/tmp/my-grass-v04-mobile.png',fullPage:true});
  console.log('IMMERSIVE MOBILE PASS',JSON.stringify(m));
 }catch(e){console.error('IMMERSIVE E2E FAIL:',e);process.exitCode=1}
 finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
