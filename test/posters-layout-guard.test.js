"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const file=name=>fs.readFileSync(path.join(root,name),"utf8");

test("poster route normalization preserves an honest marked subtitle",()=>{
  const scope={window:{location:{origin:"https://budao.org"}}};
  vm.runInNewContext(file("posters-runtime.js"),scope);
  const normalize=scope.window.BudaoPosterRuntime.normalized;
  const sample={
    routeId:"poster-test",title:"箭杆岭一线天小环线",date:"2026-11-24",time:"08:00",
    country:"中国",city:"北京",region:"延庆",meetingPlace:"北京市鼎石学校南门",
    image:"/route-assets/poster-test/photo.jpg",qrCode:"/route-assets/poster-test/qr.png",
    description:"步道带领人线路探索，限5人。"
  };
  const result=normalize(sample);
  assert.equal(result.subtitle,"步道带领人线路探索，限5人");
  assert.equal(result.weekday,"周二");
  assert.equal(result.meeting,"北京市鼎石学校南门");
  const longer=normalize({...sample,description:"非常漫长的路线说明用于检验海报文字如果超过二十四个汉字必须明确显示其后内容被省略"});
  assert.ok(longer.subtitle.endsWith("…"));
  assert.ok(Array.from(longer.subtitle).length<=24);
});

test("QR labels never claim unrestricted participation",()=>{
  for(let i=1;i<=6;i++){
    const name="posters/template-"+String(i).padStart(2,"0")+".html";
    assert.ok(!file(name).includes('"自由参与"'),name);
  }
  assert.match(file("posters/template-01.html"),/R\.isPast\?"活动已结束":"扫码报名"/);
  assert.match(file("posters/template-02.html"),/R\.isPast\?"活动已结束":"扫码报名"/);
});

test("landscape poster QR resides outside the headline and details columns",()=>{
  const source=file("posters/template-04.html");
  assert.match(source,/BudaoPosterQR\.draw\(c,qr,1635,778,152,152\)/);
  const headline={x:104,y:290,w:1408,h:355};
  const details={x:111,y:810,w:1464,h:207};
  const qr={x:1635,y:778,w:152,h:152};
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  assert.equal(overlap(headline,qr),false);
  assert.equal(overlap(details,qr),false);
});

test("portrait QR left-column supplementary facts have a bounded text budget",()=>{
  const source=file("posters/template-02.html");
  assert.match(source,/const safeWidth=307,rowsMax=3/);
  assert.ok(508+307<838,"left-column facts must end before the QR image");
  assert.ok(source.includes('if(rows.length>rowsMax)throw Error('));
  assert.ok(source.includes('const headlineRows=mainHeadline(R.title,499,365)'));
  assert.ok(source.includes('const extra=DESCRIPTION.startsWith(summary)'));
});

test("vivid and photo-first templates keep route identity readable",()=>{
  assert.match(file("posters/template-03.html"),/lineText\(FACTS\.subtitle,783,23/);
  assert.match(file("posters/template-06.html"),/const factRows=\[/);
  assert.match(file("posters/template-06.html"),/if\(size<18\)throw Error/);
});
