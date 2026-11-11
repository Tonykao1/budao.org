
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const daily=require("../api/_security/daily-digest");
const {utcWindow,formatDigest,runDaily,sendEmail}=daily._test;

function fixture(start="2026-11-09T00:00:00.000Z",end="2026-11-10T00:00:00.000Z"){
  const ok=data=>({state:"ok",data});
  const empty={received:0,waiting:2,praying:1,requestsReply:1,completed:1,actions:{CLAIM:1}};
  return {window:{start,end},sources:{
    prayer:ok(empty),
    calling:ok({newCount:1,changed:0,hidden:0,people:[{name:"Sam",location:"中国 · 北京 · 顺义"}]}),
    campfire:ok({visitorWritesEnabled:false,photoReactions:0,commentReactions:0,
      comments:0,replies:0,pending:0,reports:0,unresolvedReports:0,moderated:0}),
    pasture:ok({users:0,sheep:0,cards:null}),
    routes:ok({created:0,updated:0,cancelled:0,restored:0,titles:[]}),
    invitations:ok({fileChangeCommits:0,truncated:false}),
    eebee:ok({users:0,offerings:0,applications:0,handovers:0,impacts:0,
      changedOfferings:0,changedApplications:0}),
    stewardship:ok({events:[]})
  },notConnected:["一项尚未接入的功能"]};
}
function mockSql(){
  const rows=new Map();
  const sql=async(strings,...args)=>{
    const text=strings.join("?").replace(/\s+/g," ").trim();
    if(text.startsWith("CREATE TABLE")||text.startsWith("CREATE INDEX"))return [];
    if(text.startsWith("SELECT window_end FROM")){
      return [...rows.values()].filter(x=>x.status==="SENT")
        .sort((a,b)=>b.window_end.localeCompare(a.window_end))
        .map(x=>({window_end:x.window_end})).slice(0,1);
    }
    if(text.startsWith("SELECT window_start FROM budao_daily_digest_runs")){
      const prior=rows.values();
      const afterBoundary=args.length===2 ? Date.parse(args[0]) : -Infinity;
      const beforeBoundary=Date.parse(args.at(-1));
      return [...prior].filter(x=>x.status!=="SENT" &&
        Date.parse(x.window_end)>afterBoundary &&
        Date.parse(x.window_end)<beforeBoundary)
        .sort((a,b)=>a.window_start.localeCompare(b.window_start))
        .slice(0,1).map(x=>({window_start:x.window_start}));
    }
    if(text.startsWith("INSERT INTO budao_daily_digest_runs")){
      const [key,start,end,content]=args;
      if(!rows.has(key))rows.set(key,{key,window_start:start,window_end:end,
        status:"PENDING",snapshot:JSON.parse(content),lease:false});
      return [];
    }
    if(text.startsWith("UPDATE budao_daily_digest_runs")&&text.includes("status='SENDING'")){
      const row=rows.get(args[0]);
      if(!row||row.status==="SENT"||row.lease)return [];
      row.status="SENDING";row.lease=true;
      return [{snapshot:row.snapshot}];
    }
    if(text.startsWith("SELECT status FROM budao_daily_digest_runs")){
      const row=rows.get(args[0]);return row?[{status:row.status}]:[];
    }
    if(text.startsWith("UPDATE budao_daily_digest_runs")&&text.includes("status='SENT'")){
      const row=rows.get(args.at(-1));row.status="SENT";row.lease=false;return [];
    }
    if(text.startsWith("UPDATE budao_daily_digest_runs")&&text.includes("status='FAILED'")){
      const row=rows.get(args.at(-1));row.status="FAILED";row.lease=false;return [];
    }
    throw Error("unexpected SQL: "+text);
  };
  return {sql,rows};
}

test("report uses non-overlapping UTC midnight windows (08:00 Singapore)",()=>{
  const a=utcWindow(new Date("2026-11-11T00:41:00Z"));
  assert.deepEqual(a,{key:"2026-11-11",start:"2026-11-10T00:00:00.000Z",end:"2026-11-11T00:00:00.000Z"});
  const b=utcWindow(new Date("2026-11-12T00:05:00Z"));
  assert.equal(a.end,b.start);
});
test("no sensitive prayer or visitor data enters the email",()=>{
  const snapshot=fixture();
  snapshot.sources.prayer.data.bodyCiphertext="private-prayer-secret";
  snapshot.sources.prayer.data.rawPrayer="confidential-prayer";
  snapshot.sources.pasture.data.email="private-user@example.org";
  snapshot.sources.campfire.data.visitorHash="sensitive-id";
  snapshot.sources.routes.state="unavailable";
  snapshot.sources.routes.data=null;
  const text=formatDigest(snapshot);
  assert.match(text,/代祷事项/);
  assert.match(text,/待认领 2 项/);
  assert.match(text,/Sam/);
  assert.match(text,/尚未接入/);
  assert.match(text,/读取失败，需检查（不计作零）/);
  for(const s of ["private-prayer-secret","confidential-prayer","private-user@example.org","sensitive-id"])
    assert.equal(text.includes(s),false);
});
test("ledger sends once and returns sent when run repeatedly",async()=>{
  const {sql,rows}=mockSql();
  let emails=0;
  const deps={collect:async(_,start,end)=>fixture(start,end),
    send:async()=>{emails++;return "email-test-1"}};
  const first=await runDaily(sql,new Date("2026-11-11T00:15:00Z"),{},deps);
  assert.equal(first.sent,true);
  const second=await runDaily(sql,new Date("2026-11-11T00:18:00Z"),{},deps);
  assert.equal(second.skipped,"already_caught_up");
  assert.equal(emails,1);
  assert.equal(rows.get("2026-11-11").status,"SENT");
});
test("send failure is marked for retry; next digest carries forward unreported period",async()=>{
  const {sql,rows}=mockSql();
  const starts=[];
  const deps={collect:async(_,start,end)=>{
    starts.push([start,end]);return fixture(start,end);
  },send:async()=>{throw Error("provider_unavailable")}};
  await assert.rejects(()=>runDaily(sql,new Date("2026-11-11T00:03:00Z"),{},deps),/provider_unavailable/);
  assert.equal(rows.get("2026-11-11").status,"FAILED");
  let sent=0;
  const good={collect:deps.collect,send:async()=>{sent++;return "ok-id"}};
  const tomorrow=await runDaily(sql,new Date("2026-11-12T00:32:00Z"),{},good);
  assert.equal(tomorrow.sent,true);
  assert.deepEqual(starts.at(-1),["2026-11-10T00:00:00.000Z","2026-11-12T00:00:00.000Z"]);
  assert.equal(sent,1);
});
test("Resend idempotency and payload contain only the curated report",async()=>{
  const nativeFetch=global.fetch;const nativeAbort=global.AbortSignal;
  let request;
  try{
    global.fetch=async(url,options)=>{
      request={url,options};
      return {ok:true,status:200,json:async()=>({id:"msg_123"})};
    };
    const id=await sendEmail({to:"admin@example.org",from:"BUDAO <hello@budao.org>",resendKey:"test-key"},{
      key:"2026-11-11",snapshot:fixture()});
    assert.equal(id,"msg_123");
    assert.equal(request.options.headers["Idempotency-Key"],"budao-daily-2026-11-11");
    const body=JSON.parse(request.options.body);
    assert.equal(body.to[0],"admin@example.org");
    assert.match(body.text,/步道每日同行简报/);
    assert.doesNotMatch(body.text,/confidential-prayer/);
    assert.equal(body.subject,"步道每日同行简报 · 2026-11-11");
  }finally{global.fetch=nativeFetch;}
});
test("dedicated daily report uses existing dispatcher, protected cron, no extra function",()=>{
  const base=path.join(__dirname,"..");
  const config=JSON.parse(fs.readFileSync(path.join(base,"vercel.json"),"utf8"));
  assert.equal(config.rewrites.find(x=>x.source==="/api/daily-digest")?.destination,
    "/api/publish-route?service=daily-digest");
  assert.ok(config.crons.some(x=>x.path==="/api/daily-digest"&&x.schedule==="0 0 * * *"));
  const code=fs.readFileSync(path.join(base,"api/publish-route.js"),"utf8");
  assert.match(code,/service'\) === 'daily-digest'/);
  const handler=fs.readFileSync(path.join(base,"api/_security/daily-digest.js"),"utf8");
  assert.match(handler,/authorization/);
  assert.match(handler,/VERCEL_ENV/);
  assert.doesNotMatch(handler,/decryptPrayerPayload/);
});
