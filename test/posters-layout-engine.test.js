"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const PL = require("../posters-layout.js");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

function ctxMock(width=1080,height=1530) {
  return {
    canvas:{width,height},font:'24px sans-serif',stack:[],
    save(){this.stack.push(this.font)},
    restore(){this.font=this.stack.pop()||this.font},
    measureText(value){
      const size=Number((this.font.match(/(\d+(?:\.\d+)?)px/)||[])[1]||24);
      const width=Array.from(String(value)).reduce((w,ch)=>{
        if(/[\u3000-\u9fff]/u.test(ch))return w+size;
        if(ch===' ')return w+size*.33;
        return w+size*.55;
      },0);
      return {width,actualBoundingBoxAscent:size*.81,actualBoundingBoxDescent:size*.18};
    }
  };
}

function sample(overrides={}) {
  return {
    routeId:"layout-test",title:"箭杆岭一线天小环线",
    date:"2026-11-24",time:"08:00",country:"中国",city:"北京",region:"延庆",
    meetingPlace:"北京市鼎石学校南门",image:"/route-assets/layout-test/photo.jpg",
    qrCode:"/route-assets/layout-test/qr.png",
    description:"步道带领人线路探索，限5人。",
    participantRequirements:"报名只限5位带领人",
    distance:"6千米",elevation:"217米",difficulty:"中等",duration:"3小时",
    surface:"铺装路、台阶、土石路",suitableFor:"步道同工",
    equipmentMinimum:"徒步鞋、防风衣、帽子、手套",...overrides
  };
}
function normalize(route) {
  const win={location:{origin:"https://budao.org"}};
  vm.runInNewContext(read("posters-runtime.js"),{window:win});
  return win.BudaoPosterRuntime.normalized(route);
}

test("all six posters load one shared engine and keep original QR draw routines",()=>{
  for(let i=1;i<=6;i++){
    const name="posters/template-"+String(i).padStart(2,"0")+".html";
    const html=read(name);
    assert.match(html, /<script src="\/posters-layout\.js"><\/script>/,name);
    assert.match(html, /BudaoPosterQR\.draw/,name);
    assert.match(html, /PL\./,name);
    const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
      .map(match=>match[1]).join("\n");
    assert.doesNotThrow(()=>new Function(scripts),name);
  }
});

test("participantRequirements is source-backed and preferred over descriptive summary",()=>{
  const r=normalize(sample());
  assert.equal(r.requirements,"报名只限5位带领人");
  assert.equal(r.subtitle,"报名只限5位带领人");
  assert.equal(r.dateCN,"2026年11月24日");
  assert.equal(r.weekday,"周二");
  const fallback=normalize(sample({participantRequirements:""}));
  assert.equal(fallback.subtitle,"步道带领人线路探索，限5人");
});

test("graphemes retain combined emoji and avoid splitting surrogate pairs",()=>{
  assert.equal(PL.letters("步👩‍👩‍👦道").length,3);
});

test("title wraps before an unreadable shrink",()=>{
  const output=PL.fit(ctxMock(),"北京箭杆岭一线天小环线冬季领袖探险路径",{
    label:"路线名称",size:79,minSize:46,maxWidth:478,maxLines:2,
    family:"sans-serif",weight:700
  });
  assert.equal(output.lines.length,2);
  assert.equal(output.truncated,false);
  assert.ok(output.size>=46);
});

test("too-long critical route names cannot be silently truncated",()=>{
  assert.throws(()=>PL.fit(ctxMock(),"非常漫长的路线名称".repeat(40),{
    label:"路线名称",size:80,minSize:35,maxWidth:478,maxLines:2
  }),/路线名称过长/);
});

test("noncritical teaser text is abbreviated with an explicit ellipsis",()=>{
  const fit=PL.fit(ctxMock(),"线路说明文字".repeat(40),{
    label:"活动说明",size:24,minSize:19,maxWidth:300,maxLines:2,allowEllipsis:true
  });
  assert.equal(fit.truncated,true);
  assert.ok(fit.lines.at(-1).endsWith("…"));
});

test("missing required factual values block preflight",()=>{
  assert.throws(()=>PL.validateFacts({title:"路线"}),/date/);
  assert.equal(PL.validateFacts({
    title:"路线",date:"2026-11-24",time:"08:00",
    region:"中国 · 北京 · 延庆",meeting:"集合点",qr:"/route-assets/test/qr.png"
  }),true);
});

test("QR safe zone catches text and artwork collision at export-preflight",()=>{
  const c=ctxMock(),guard=PL.createGuard(c);
  guard.reserve("报名二维码",{x:838,y:1255,width:162,height:162},12);
  assert.doesNotThrow(()=>guard.claimText("集合地点","北京市鼎石学校南门",
    508,968,"700 30px sans-serif",{avoid:["报名二维码"]}));
  assert.throws(()=>guard.claim("越界说明",{x:826,y:1272,width:60,height:30},{
    avoid:["报名二维码"]
  }),/侵入报名二维码保护区/);
});

test("out-of-canvas boxes are rejected before export",()=>{
  const guard=PL.createGuard(ctxMock());
  assert.throws(()=>guard.claim("超出版面",{x:1000,y:1400,width:150,height:60}),/超出 Canvas/);
});

test("rotated title bounding box uses its four transformed corners",()=>{
  const r=PL.rotateRect({x:0,y:0,width:100,height:20},90,0,0);
  assert.ok(r.x < -19.9);
  assert.ok(r.height > 99.9);
});

test("04 cinematic title/details no longer intersect registered QR zone",()=>{
  const c=ctxMock(1920,1080),guard=PL.createGuard(c);
  guard.reserve("报名二维码",{x:1635,y:778,width:152,height:152},22);
  assert.doesNotThrow(()=>guard.claim("主标题",{x:104,y:290,width:1408,height:350},{avoid:["报名二维码"]}));
  assert.doesNotThrow(()=>guard.claim("活动详情",{x:111,y:810,width:1464,height:207},{avoid:["报名二维码"]}));
  assert.match(read("posters/template-04.html"),/BudaoPosterQR\.draw\(c,qr,1635,778,152,152\)/);
});

test("critical metadata never falls back to misleading unrestricted participation",()=>{
  const one=read("posters/template-01.html"),two=read("posters/template-02.html");
  assert.doesNotMatch(one,/"自由参与"/);
  assert.doesNotMatch(two,/"自由参与"/);
  assert.match(two,/label:"路线"\+label/);
  assert.match(read("posters/template-06.html"),/layoutGuard\.claimText/);
});


test("05 ceremonial poster keeps the complete route title on one line for all three fonts",()=>{
  const html=read("posters/template-05.html");
  assert.doesNotMatch(html,/function titleRows\(/);
  const start=html.indexOf("function bigTitle(");
  const end=html.indexOf("function details(",start);
  assert.ok(start>=0&&end>start);
  const titleFunction=html.slice(start,end);
  assert.match(titleFunction,/maxLines:1/);
  assert.doesNotMatch(titleFunction,/\b(?:split|slice|ellipsis)\b/);
  for(const font of ["song","sans","kai"]){
    const c=ctxMock();
    const painted=[],regions=[];
    const sandbox={
      c,PL,
      E:{titleFont:{value:font}},
      titleFaces:{
        song:{family:"serif",weight:700,tracking:0},
        sans:{family:"sans-serif",weight:700,tracking:5},
        kai:{family:"serif",weight:500,tracking:1.5}
      },
      write:(value,x,y,size,options)=>painted.push({value,x,y,size,options})
    };
    vm.runInNewContext(titleFunction,sandbox);
    const title="箭杆岭一线天小环线";
    vm.runInNewContext("bigTitle({paper:'#fff'},{title:'"+title+"'},layoutGuard)",{
      ...sandbox,layoutGuard:{claim:(name,box)=>regions.push({name,box})}
    });
    assert.equal(painted.length,1,font+" should render only one title");
    assert.equal(painted[0].value,title,font+" should not clip the route name");
    assert.equal(painted[0].options.align,"center");
    assert.equal(regions.length,1);
    assert.ok(regions[0].box.x>=118,"title should remain within the photograph");
    assert.ok(regions[0].box.x+regions[0].box.width<=962,"title should fit its safe column");
    assert.equal(regions[0].box.y>=610,true);
  }
});

test("05 ceremonial poster fails safely for an impossible single-line route name",()=>{
  const html=read("posters/template-05.html");
  const titleFunction=html.slice(html.indexOf("function bigTitle("),html.indexOf("function details("));
  const sandbox={
    c:ctxMock(),PL,E:{titleFont:{value:"song"}},
    titleFaces:{song:{family:"serif",weight:700,tracking:0}},
    write:()=>{throw Error("should not draw an impossible title")}
  };
  vm.runInNewContext(titleFunction,sandbox);
  assert.throws(()=>sandbox.bigTitle({paper:"#fff"},{title:"特别长的步道活动标题".repeat(20)}),/活动名称.*过长/);
});

test("05 ceremonial QR remains original and unchanged by one-line typography",()=>{
  const html=read("posters/template-05.html");
  assert.match(html,/const size=184,x=802,qy=1174;/);
  assert.match(html,/BudaoPosterQR\.draw\(c,qr,x,qy,size,size\)/);
  assert.match(html,/await createImageBitmap\(blob\)/);
  assert.match(html,/bigTitle\(P,record,layoutGuard\)/);
});
