const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 let resident=null;
 await page.route('**/api/pasture-auth',async route=>{
   const req=route.request(),method=req.method();
   if(method==='GET'){
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,user:resident})});
   }
   let body={};try{body=req.postDataJSON()}catch(e){}
   if(body.action==='requestCode'){
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,sent:true,expiresInSeconds:600})});
   }
   if(body.action==='verifyCode'){
     resident={id:'00000000-0000-4000-8000-000000000045',emailMasked:'wa***@example.com',createdAt:new Date().toISOString(),sheep:null};
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,user:resident,needsSheep:true})});
   }
   if(body.action==='saveSheep'){
     resident={...resident,sheep:{id:'10000000-0000-4000-8000-000000000045',bodyColor:body.bodyColor,headColor:body.headColor,marking:body.marking,createdAt:new Date().toISOString()}};
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,created:true,user:resident})});
   }
   return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,reason:'unknown_action'})});
 });
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 try{
   await page.goto('http://127.0.0.1:8787/pasture-preview/',{waitUntil:'domcontentloaded'});
   await page.waitForSelector('#pastureResidentLayer:not([hidden])',{timeout:60000});
   await page.waitForFunction(()=>!!document.getElementById('liveArea')?.contentDocument?.querySelector('.actions'),{timeout:60000});
   const zone=page.frameLocator('#liveArea');
   await zone.locator('.actions').waitFor({state:'attached'});
   assert.equal(await zone.locator('.actions').evaluate(el=>getComputedStyle(el).display),'none');

   const scene=zone.frameLocator('.scene');
   await scene.locator('#environmentLayer').waitFor({state:'attached',timeout:60000});
   await page.waitForFunction(()=>document.getElementById('liveArea')?.contentDocument?.querySelector('.scene')?.contentWindow?.__tongluFlockCount===44,{timeout:30000});

   await page.locator('#pastureEmail').fill('walker@example.com');
   await page.locator('#pastureSendCode').click();
   await page.locator('#pastureCode').fill('123456');
   await page.locator('#pastureVerify').click();
   await page.waitForSelector('#pastureSheepBody',{timeout:10000});
   await page.selectOption('#pastureSheepBody','#bfd8da');
   await page.selectOption('#pastureSheepHead','#776d66');
   await page.selectOption('#pastureSheepMark','FACE');
   await page.locator('#pastureSaveSheep').click();
   await page.waitForSelector('#pastureResidentLayer',{state:'hidden',timeout:10000});

   await page.waitForFunction(()=>{
     const d=document.getElementById('liveArea')?.contentDocument;
     return d?.body?.classList.contains('pasture-resident-authenticated');
   },{timeout:10000});
   assert.notEqual(await zone.locator('.actions').evaluate(el=>getComputedStyle(el).display),'none');
   const buttons=zone.locator('.pbtn');
   assert.ok(await buttons.count()>=7);
   for(let i=0;i<await buttons.count();i++)assert.equal(await buttons.nth(i).getAttribute('aria-disabled'),'true');

   await page.waitForFunction(()=>document.getElementById('liveArea')?.contentDocument?.querySelector('.scene')?.contentWindow?.__tongluFlockCount===45,{timeout:10000});
   const layout=await page.evaluate(()=>document.getElementById('liveArea').contentDocument.querySelector('.scene').contentWindow.__tongluResidentLayout);
   assert.ok(layout&&layout.x>=0&&layout.y>=0&&layout.s>0,JSON.stringify(layout));

   const arrivalWasSeen=await page.waitForFunction(()=>document.getElementById('liveArea')?.contentDocument?.querySelector('.scene')?.contentWindow?.__tongluResidentArrivalActive===true,{timeout:1200}).then(()=>true).catch(()=>false);
   assert.equal(arrivalWasSeen,true,'new sheep must visibly enter from the sky');
   await page.waitForFunction(()=>document.getElementById('liveArea')?.contentDocument?.querySelector('.scene')?.contentWindow?.__tongluResidentArrivalActive===false,{timeout:4000});

   await zone.locator('#grassBookBtn').click({force:true});
   await page.waitForTimeout(150);
   const grassOpen=await zone.locator('body').evaluate(el=>el.classList.contains('grassbook-open'));
   assert.equal(grassOpen,false,'authenticated buttons are visible but all remain locked');
   assert.match(await page.locator('#pastureResidentToast').innerText(),/正在生长/);

   const unexpected=pageErrors.filter(v=>!v.includes('catch(...) is not a function'));
   assert.deepEqual(unexpected,[],JSON.stringify(pageErrors));
   console.log('PASTURE RESIDENT PASS: guest has 44/no buttons; verified resident gets locked buttons + guaranteed animated 45th sheep');
 }catch(e){
   await page.screenshot({path:'/tmp/pasture-resident-failure.png',fullPage:true}).catch(()=>{});
   console.error('PASTURE RESIDENT FAIL',e,pageErrors);
   process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
