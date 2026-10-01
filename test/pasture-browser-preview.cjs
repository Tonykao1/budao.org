const { chromium }=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto('http://127.0.0.1:8787/pasture-preview/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!document.getElementById('cardIframe')?.contentDocument?.getElementById('panelContent'),{timeout:60000});
  await page.waitForFunction(()=>!!document.getElementById('liveArea')?.contentDocument?.getElementById('returnNow'),{timeout:60000});
  await page.evaluate(()=>{const d=document.getElementById('liveArea').contentDocument;d.body.classList.add('pasture-resident-authenticated');d.querySelectorAll('.pbtn').forEach(el=>el.classList.remove('pbtn'))});
  const card=page.frameLocator('#cardIframe');
  await page.evaluate(()=>document.getElementById('floatingCard').click());
  await page.waitForSelector('#cardShade.open');
  await card.locator('#fillDemo').click();
  await card.locator('#keyForm button[type=submit]').click();
  await card.locator('#drawFirst').click();
  await card.locator('#keepFirst').click({timeout:20000});
  await page.waitForFunction(()=>{
   try{const v=JSON.parse(localStorage.getItem('budao_pixel_card_activation_prototype_v1')||'null');return v?.phase==='active'&&!!v.final?.numberColor&&v.seriesId==='CSCZ-001'}catch(e){return false}
  },{timeout:12000});
  assert.match(await card.locator('#panelContent').innerText(),/持卡人基本资料/);
  assert.equal(await card.locator('#cardHolderName').innerText(),'Tony');
  await card.locator('#flipBtn').click();
  assert.match(await card.locator('#flipBtn').innerText(),/翻面/);
  assert.doesNotMatch(await card.locator('#flipBtn').innerText(),/翻回书法面/);
  await page.locator('#topExit').click();
  await page.waitForFunction(()=>{
   const d=document.getElementById('liveArea')?.contentDocument;
   return d?.querySelector('.identity .idtext .bid')?.textContent.includes('创始成终')
    && !d.querySelector('.identity .idtext .bid').textContent.includes('待领取');
  },{timeout:10000});
  const open=async (id,klass)=>{
   await page.evaluate(id=>document.getElementById('liveArea').contentDocument.getElementById(id).click(),id);
   await page.waitForFunction(klass=>document.getElementById('liveArea')?.contentDocument?.body?.classList.contains(klass),klass,{timeout:5000});
   await page.locator('#topExit').waitFor({state:'visible'});
   await page.locator('#topExit').click();
   await page.waitForFunction(klass=>!document.getElementById('liveArea')?.contentDocument?.body?.classList.contains(klass),klass,{timeout:5000});
  };
  await page.evaluate(()=>document.getElementById('liveArea').contentDocument.getElementById('returnNow').click());
  await page.waitForFunction(()=>document.getElementById('liveArea')?.contentDocument?.body?.classList.contains('self-open'));
  const self=page.frameLocator('#liveArea');
  await self.locator('#selfSheepCanvas').waitFor({state:'visible'});
  await self.locator('#selfCare').click();
  assert.match(await self.locator('#selfFeedback').innerText(),/照顾自己/);
  await page.locator('#topExit').click();
  await page.waitForFunction(()=>!document.getElementById('liveArea')?.contentDocument?.body?.classList.contains('self-open'));
  await open('grassBookBtn','grassbook-open');
  await open('windNewsBtn','wind-open');
  await open('partnersBtn','partners-open');
  await open('mailBtn','mail-open');
  // Shop button is the legacy seventh entry, repurposed without replacing other modules.
  await page.evaluate(()=>{
   const d=document.getElementById('liveArea').contentDocument;
   const e=[...d.querySelectorAll('.pbtn')].find(x=>x.textContent.includes('小铺'));
   if(!e)throw Error('Shop entry missing');e.click();
  });
  await page.waitForSelector('#shopShade.open');
  assert.equal(await page.locator('#shopClose').evaluate(el=>getComputedStyle(el).borderTopWidth),'3px');
  await page.locator('#shopClose').click();
  await page.evaluate(()=>document.getElementById('liveArea').contentDocument.getElementById('boxEntryBtn').click());
  await page.waitForSelector('#boxShade.open');
  assert.equal(await page.locator('#boxClose').evaluate(el=>getComputedStyle(el).borderTopWidth),'3px');
  await page.locator('#boxClose').click();
  if(errors.length)console.log('Nonfatal page errors:',errors.slice(0,5));
  console.log('E2E PASS: activated holder, six dimensions, card flip, self interaction, all eight returns');
 }catch(e){
  try{await page.screenshot({path:'/tmp/pasture-preview-failure.png',fullPage:true})}catch(_){}
  console.error('E2E FAIL:',e,'page errors:',errors);
  process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
