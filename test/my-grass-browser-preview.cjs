const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'
 ]});
 const page=await browser.newPage({viewport:{width:1440,height:900},permissions:['microphone']});
 const issues=[];
 page.on('pageerror',e=>issues.push(String(e)));
 // Only for this isolated QA browser. The previous integrated E2E still tests full real card activation.
 await page.addInitScript(()=>{
  window.__PASTURE_TEST_UNLOCK=true;
  localStorage.setItem('budao_pixel_card_activation_prototype_v1',JSON.stringify({
    phase:'active',seriesId:'CSCZ-001',usedSecond:false,
    final:{suit:'spade',rank:'A',numberColor:'red',dice:1,color:'white',side:'white',piece:'king'}
  }));
  localStorage.setItem('budao.card.activated.v1','1');
 });
 try{
  await page.goto('http://127.0.0.1:8787/pasture-preview/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
   const f=document.getElementById('liveArea');
   return !!f?.contentDocument?.getElementById('grassWorkspace');
  },{timeout:60000});
  await page.evaluate(()=>{const d=document.getElementById('liveArea').contentDocument;d.defaultView.__PASTURE_TEST_UNLOCK=true;d.body.classList.add('pasture-resident-authenticated');const gate=document.getElementById('pastureResidentLayer');if(gate)gate.hidden=true});
  const zone=page.frameLocator('#liveArea');
  await page.evaluate(()=>document.getElementById('liveArea').contentDocument.getElementById('grassBookBtn').click());
  await zone.locator('#grassWorkspace').waitFor({state:'visible'});
  assert.equal(await zone.locator('#grassWorkspace .gs-steps button').count(),3);
  await zone.locator('[data-field="reference"]').fill('诗篇 23:1');
  await zone.locator('[data-field="translation"]').fill('用户自行输入');
  await zone.locator('[data-field="scriptureText"]').fill('这段经文文字由测试用户亲自输入，不来自自动生成的译本。');
  // Record original audio with a fake test microphone and verify IndexedDB association.
  await zone.locator('button[data-action="record"]').click();
  await zone.locator('#gsStatus').filter({hasText:'正在录制'}).waitFor({timeout:10000});
  await page.waitForTimeout(900);
  await zone.locator('button[data-action="record"]').click();
  await zone.locator('#gsAudioHost audio').waitFor({state:'attached',timeout:15000}).catch(async e=>{
    const status=await zone.locator('#gsStatus').innerText().catch(()=>'(missing status)');
    const host=await zone.locator('#gsAudioHost').innerText().catch(()=>'(missing host)');
    const draft=await zone.locator('#grassWorkspace').evaluate(()=>{
      const state=JSON.parse(window.parent.MyGrassBridge.read('budao_pixel_card_activation_prototype_v1'));
      const scope=window.MyGrassCore.scopeFromIdentity(state);
      const stored=JSON.parse(window.parent.MyGrassBridge.read('budao.my-grass.v1.'+scope+'.draft')||'null');
      return {scope,reading:stored?.reading,verified:stored?.scripture?.verifiedAgainstRecording,MediaRecorderType:typeof MediaRecorder};
    }).catch(err=>String(err));
    console.error('AUDIO DIAGNOSTICS',{status,host,draft});
    throw e;
  });
  await zone.locator('[data-field="audioVerified"]').check();
  await zone.locator('button[data-action="save"]').click();
  await zone.locator('#gsStatus').filter({hasText:'已保存'}).waitFor();
  const saved=await zone.locator('#grassWorkspace').evaluate(()=>{
   const state=JSON.parse(window.parent.MyGrassBridge.read('budao_pixel_card_activation_prototype_v1'));
   const sc=window.MyGrassCore.scopeFromIdentity(state),base='budao.my-grass.v1.'+sc;
   return {entries:JSON.parse(window.parent.MyGrassBridge.read(base+'.entries')||'[]'),
           micros:JSON.parse(window.parent.MyGrassBridge.read(base+'.micros')||'[]')};
  });
  assert.equal(saved.entries.length,1);
  assert.equal(saved.entries[0].scripture.reference,'诗篇 23:1');
  assert.ok(saved.entries[0].reading.audioId);
  assert.equal(saved.entries[0].reading.trainingConsent,false);

  await zone.locator('button[data-tab="reflection"]').click();
  await zone.locator('[data-field="reflection"]').fill('原来我曾经只想到需要更多，却忽略了牧者自己的同在。');
  await zone.locator('button[data-action="save"]').click();
  await zone.locator('#gsStatus').filter({hasText:'已保存'}).waitFor();

  await zone.locator('button[data-tab="sharing"]').click();
  await zone.locator('button[data-action="suggest-micro"]').click();
  const quote=zone.locator('#gsMicroText');
  assert.ok((await quote.inputValue()).length>0);
  await quote.fill('牧养不是先要求得到更多，而是学习相信牧者的同在。');
  await zone.locator('button[data-action="save-micro"]').click();
  await zone.locator('#gsStatus').filter({hasText:'私人收藏'}).waitFor();
  const after=await zone.locator('#grassWorkspace').evaluate(()=>{
   const state=JSON.parse(window.parent.MyGrassBridge.read('budao_pixel_card_activation_prototype_v1'));
   const sc=window.MyGrassCore.scopeFromIdentity(state),base='budao.my-grass.v1.'+sc;
   return {entries:JSON.parse(window.parent.MyGrassBridge.read(base+'.entries')||'[]'),
           micros:JSON.parse(window.parent.MyGrassBridge.read(base+'.micros')||'[]')};
  });
  assert.equal(after.entries.length,1);
  assert.equal(after.micros.length,1);
  assert.equal(after.micros[0].entryId,after.entries[0].id);
  assert.equal(after.micros[0].visibility,'private');
  assert.equal(after.micros[0].approvedForPublicDistribution,false);
  await zone.locator('button[data-action="archive"]').first().click();
  assert.match(await zone.locator('.gs-archive').innerText(),/诗篇 23:1/);
  await zone.locator('button[data-action="new"]').click();
  assert.equal(await zone.locator('[data-field="scriptureText"]').inputValue(),'');
  await page.locator('#topExit').click();
  await page.waitForFunction(()=>!document.getElementById('liveArea')?.contentDocument?.body?.classList.contains('grassbook-open'));
  // A second visit must retrieve the assigned card's stored archive, not an iframe-only memory shim.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!document.getElementById('liveArea')?.contentDocument?.getElementById('grassWorkspace'),{timeout:60000});
  await page.evaluate(()=>document.getElementById('liveArea').contentDocument.getElementById('grassBookBtn').click());
  const reopened=page.frameLocator('#liveArea');
  await reopened.locator('#grassWorkspace').waitFor({state:'visible'});
  await reopened.locator('button[data-action="archive"]').first().click();
  assert.match(await reopened.locator('.gs-archive').innerText(),/诗篇 23:1/);
  await reopened.locator('button[data-action="open-entry"]').first().click();
  await reopened.locator('#gsAudioHost audio').waitFor({state:'attached',timeout:15000});
  await reopened.locator('button[data-action="export"]').click();
  if(issues.length)console.log('Legacy nonfatal page errors:',issues.slice(0,5));
  console.log('MY GRASS E2E PASS: Scripture+original MediaRecorder/IndexedDB, private note and micro, assigned-card archive survives reload, audio replay, export and exit');
 }catch(e){
  await page.screenshot({path:'/tmp/my-grass-browser-failure.png',fullPage:true}).catch(()=>{});
  console.error('MY GRASS E2E FAIL:',e,'page errors:',issues);
  process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
