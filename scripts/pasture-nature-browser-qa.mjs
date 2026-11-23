// Browser-only visual evidence for the independent digital-pasture nature overlay.
// Runs against the real local pixel landscape and portrait compositions, with
// a synthetic seasonal event clock (no production data, accounts or live writes).
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import { mkdir } from 'node:fs/promises';

const base=process.env.PASTURE_QA_URL||'http://127.0.0.1:8765';
const out='artifacts/pasture-nature-browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const failures=[];
const events=[
  {name:'butterfly',month:'2026-06-15',day:true,pick:0},
  {name:'dragonfly',month:'2026-06-15',day:true,pick:.4},
  {name:'fish',month:'2026-06-15',day:true,pick:.85},
  {name:'migration',month:'2026-10-15',day:true,pick:.5},
  {name:'firefly',month:'2026-06-15',day:false,pick:.5},
  {name:'leaf',month:'2026-10-15',day:true,pick:.85}
];
const fixture={
  latitude:39.9,longitude:116.4,timezone:'Asia/Shanghai',utc_offset_seconds:28800,
  current:{weather_code:0,cloud_cover:10,wind_speed_10m:5,is_day:1},
  daily:{sunrise:['2026-11-23T07:00','2026-11-24T07:00','2026-11-25T07:00'],
    sunset:['2026-11-23T17:00','2026-11-24T17:00','2026-11-25T17:00']}
};
try{
  for(const scene of ['landscape','portrait']){
    const ctx=await browser.newContext({
      viewport:scene==='landscape'?{width:1200,height:750}:{width:390,height:840},
      geolocation:{latitude:39.9,longitude:116.4},
      permissions:['geolocation'],deviceScaleFactor:1
    });
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://api.open-meteo.com/**',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
    await page.goto(base+'/tonglu-core.html',{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForFunction(()=>Boolean(window.BudaoPastureNature),null,{timeout:15000});
    let target=page;
    if(scene==='landscape'){
      // The v20 landscape loads through nested document.write wrappers. Merely
      // seeing #pasture is insufficient: the outer iframe can still be opacity 0.
      await page.waitForFunction(()=>{
        const frame=document.getElementById('pastureFrame');
        const cv=frame?.contentDocument?.getElementById('pasture');
        if(!cv||getComputedStyle(frame).opacity!=='1'||cv.width<400||cv.height<250)return false;
        const c=cv.getContext('2d');
        const sky=c.getImageData(100,30,1,1).data;
        const field=c.getImageData(100,235,1,1).data;
        return sky[3]>200&&field[3]>200&&
          Math.abs(sky[0]-field[0])+Math.abs(sky[1]-field[1])+Math.abs(sky[2]-field[2])>50;
      },null,{timeout:30000});
    }else{
      await page.waitForFunction(()=>{
        const cv=document.getElementById('portraitFrame')?.contentDocument?.getElementById('pasture');
        if(!cv||!cv.width||cv.height<400)return false;
        return cv.getContext('2d').getImageData(Math.round(cv.width*.2),Math.round(cv.height*.72),1,1).data[3]>200;
      },null,{timeout:25000});
      target=page.frames().find(f=>f.url().includes('tonglu-pasture-portrait.html'));
      assert.ok(target,'portrait renderer frame missing');
    }
    await page.screenshot({path:out+'/'+scene+'-baseline.png',animations:'disabled',timeout:15000});
    for(const scenario of events){
      const info=await target.evaluate(({scenario,scene})=>{
        const api=window.BudaoPastureNature;
        if(!api)throw Error('nature module missing in '+scene);
        const width=scene==='landscape'?480:300;
        const height=scene==='landscape'?300:document.getElementById('pasture').height;
        let overlay=document.getElementById('natureQaEvidence');
        if(!overlay){
          overlay=document.createElement('canvas');
          overlay.id='natureQaEvidence';
          Object.assign(overlay.style,{
            position:'fixed',inset:'0',width:'100%',height:'100%',
            zIndex:'15',pointerEvents:'none',imageRendering:'pixelated'});
          document.body.appendChild(overlay);
        }
        overlay.width=width;overlay.height=height;
        const ctx=overlay.getContext('2d');
        ctx.imageSmoothingEnabled=false;
        const dateMs=Date.parse(scenario.month+'T12:00:00Z');
        const fake={
          location:{latitude:39.9,longitude:116.4,timezone:'UTC'},
          current:{weatherCode:0,cloudCover:10,windKmh:5},
          astronomy:{sunriseToday:dateMs-3600000,sunsetToday:dateMs+3600000}
        };
        const sky={sun:{altitudeDeg:scenario.day?35:-18}};
        const seq=[0,scenario.pick,.5,.5,.5,.5,.5];
        const c=api.createController({random:()=>seq.length?seq.shift():.5});
        const options={width,height,scene,state:fake,skyState:sky};
        c.draw(ctx,{...options,now:dateMs}); // schedule a first low-frequency appearance
        const triggered=c.draw(ctx,{...options,now:dateMs+80000});
        if(!triggered)throw Error('no event triggered for '+scenario.name);
        ctx.clearRect(0,0,width,height);
        const drawn=c.draw(ctx,{...options,now:dateMs+81500});
        if(!drawn)throw Error('event not active at render time');
        const pixels=ctx.getImageData(0,0,width,height).data;
        let count=0,xMin=width,yMin=height,xMax=-1,yMax=-1;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          if(pixels[(y*width+x)*4+3]>0){count++;xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);yMin=Math.min(yMin,y);yMax=Math.max(yMax,y)}
        }
        return{kind:drawn.kind,width,height,count,xMin,yMin,xMax,yMax};
      },{scenario,scene});
      assert.equal(info.kind,scenario.name,scene+' selected wrong event');
      assert.ok(info.count>=2&&info.count<200,scene+' '+scenario.name+' bad pixel density: '+info.count);
      assert.ok(info.xMin>=0&&info.xMax<info.width&&info.yMin>=0&&info.yMax<info.height,'event out of canvas');
      if(scenario.name==='migration')assert.ok(info.yMax<(scene==='landscape'?96:info.height*.255),
        'migrating birds entered sea/mountains: '+JSON.stringify(info));
      if(scenario.name==='fish'||scenario.name==='dragonfly')assert.ok(info.yMin>(scene==='landscape'?140:info.height*.38),
        'river species entered sky/sea: '+JSON.stringify(info));
      const path=out+'/'+scene+'-'+scenario.name+'.png';
      await page.screenshot({path,animations:'disabled',timeout:15000});
      console.log('NATURE_QA',scene,scenario.name,JSON.stringify(info),'screenshot',path);
    }
    if(errors.length)failures.push({scene,pageErrors:errors});
    await ctx.close();
  }
}finally{await browser.close()}
if(failures.length)throw Error('Browser JS errors: '+JSON.stringify(failures));
console.log('NATURE_QA 12/12 screenshots and event projection checks passed');
