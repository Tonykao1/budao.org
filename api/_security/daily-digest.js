
"use strict";
// BUDAO Daily: privacy-minimised summaries of durable, recorded ministry events.
// Prayer text, private contact, visitor identifiers and IPs never enter email.
const { neon } = require("@neondatabase/serverless");
const { sendJson } = require("./http");

const DAY_MS=86400000;
let ready;
function utcWindow(now=new Date()){
  const date=new Date(now);
  if(!Number.isFinite(date.getTime()))throw Error("invalid_time");
  const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  return {key:end.toISOString().slice(0,10),
    start:new Date(end.getTime()-DAY_MS).toISOString(),end:end.toISOString()};
}
function inWindow(value,start,end){
  if(!value)return false;
  const time=new Date(value).getTime();
  return Number.isFinite(time)&&time>=Date.parse(start)&&time<Date.parse(end);
}
function countIn(items,key,start,end){
  return Array.isArray(items)?items.filter(x=>x&&inWindow(x[key],start,end)).length:0;
}
function num(v){return Number(v)||0}
function clean(v,max=70){
  return String(v??"").replace(/[\r\n<>]/g," ").replace(/\s+/g," ").trim().slice(0,max);
}
async function source(name,read){
  try{return {name,state:"ok",data:await read()}}
  catch(error){
    console.error("BUDAO Daily source:",name,clean(error?.code||error?.name||"unknown",32));
    return {name,state:"unavailable",data:null};
  }
}
async function ensureSchema(sql){
  if(!ready)ready=(async()=>{
    await sql`CREATE TABLE IF NOT EXISTS budao_daily_digest_runs (
      window_key text PRIMARY KEY,window_start timestamptz NOT NULL,
      window_end timestamptz NOT NULL,snapshot jsonb NOT NULL,
      status text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','SENDING','SENT','FAILED')),
      attempts integer NOT NULL DEFAULT 0,lease_until timestamptz,
      sent_at timestamptz,provider_id text,last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS budao_daily_digest_status_idx
      ON budao_daily_digest_runs(status,window_end DESC)`;
  })().catch(e=>{ready=null;throw e});
  return ready;
}
async function collectDb(sql,start,end,cfg={}){
  return Promise.all([
    source("prayer",async()=>{
      const q=await sql`SELECT
        COUNT(*) FILTER (WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz) AS received,
        COUNT(*) FILTER (WHERE status='NEW') AS waiting,
        COUNT(*) FILTER (WHERE status='PRAYING') AS praying,
        COUNT(*) FILTER (WHERE wants_reply=true AND status!='COMPLETED') AS requests_reply,
        COUNT(*) FILTER (WHERE completed_at>=${start}::timestamptz AND completed_at<${end}::timestamptz) AS completed
        FROM prayer_requests`;
      const a=await sql`SELECT event_type,COUNT(*) AS n FROM prayer_audit_events
        WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz GROUP BY event_type`;
      return {received:num(q[0]?.received),waiting:num(q[0]?.waiting),
        praying:num(q[0]?.praying),requestsReply:num(q[0]?.requests_reply),
        completed:num(q[0]?.completed),
        actions:Object.fromEntries(a.map(x=>[clean(x.event_type,36),num(x.n)]))};
    }),
    source("calling",async()=>{
      const q=await sql`SELECT
        COUNT(*) FILTER (WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz) AS new_count,
        COUNT(*) FILTER (WHERE updated_at>=${start}::timestamptz AND updated_at<${end}::timestamptz AND updated_at>created_at) AS changed,
        COUNT(*) FILTER (WHERE status='HIDDEN' AND updated_at>=${start}::timestamptz AND updated_at<${end}::timestamptz) AS hidden
        FROM coworker_calling_responses`;
      const latest=await sql`SELECT display_name,country,province,city FROM coworker_calling_responses
        WHERE status='VISIBLE' AND created_at>=${start}::timestamptz AND created_at<${end}::timestamptz
        ORDER BY created_at DESC LIMIT 12`;
      return {newCount:num(q[0]?.new_count),changed:num(q[0]?.changed),
        hidden:num(q[0]?.hidden),people:latest.map(x=>({
          name:clean(x.display_name,45),
          location:[x.country,x.province,x.city].map(v=>clean(v,45)).filter(Boolean).join(" · ")
        }))};
    }),
    source("campfire",async()=>{
      const r=await sql`SELECT target_kind,COUNT(*) AS n FROM campfire_reactions
        WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz GROUP BY target_kind`;
      const c=await sql`SELECT
        COUNT(*) FILTER (WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz) AS new_count,
        COUNT(*) FILTER (WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz AND parent_id IS NOT NULL) AS replies,
        COUNT(*) FILTER (WHERE status='PENDING') AS pending
        FROM campfire_comments`;
      const reports=await sql`SELECT
        COUNT(*) FILTER (WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz) AS received,
        COUNT(*) FILTER (WHERE resolved_at IS NULL) AS unresolved FROM campfire_reports`;
      const m=await sql`SELECT COUNT(*) AS n FROM campfire_moderation_audit
        WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz`;
      const kinds=Object.fromEntries(r.map(x=>[x.target_kind,num(x.n)]));
      return {visitorWritesEnabled:cfg.campfireWrites===true,
        photoReactions:kinds.photo||0,commentReactions:kinds.comment||0,
        comments:num(c[0]?.new_count),replies:num(c[0]?.replies),
        pending:num(c[0]?.pending),reports:num(reports[0]?.received),
        unresolvedReports:num(reports[0]?.unresolved),moderated:num(m[0]?.n)};
    }),
    source("pasture",async()=>{
      const users=await sql`SELECT COUNT(*) AS n FROM pasture_users
        WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz`;
      const sheep=await sql`SELECT COUNT(*) AS n FROM pasture_sheep
        WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz`;
      const cols=await sql`SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='pasture_users' AND column_name='card_activated_at'`;
      let cards=null;
      if(cols.length){
        const activated=await sql`SELECT COUNT(*) AS n FROM pasture_users
          WHERE card_activated_at>=${start}::timestamptz AND card_activated_at<${end}::timestamptz`;
        cards=num(activated[0]?.n);
      }
      return {users:num(users[0]?.n),sheep:num(sheep[0]?.n),cards};
    }),
    source("stewardship",async()=>{
      const list=await sql`SELECT event_type,COUNT(*) AS n FROM stewardship_audit_events
        WHERE created_at>=${start}::timestamptz AND created_at<${end}::timestamptz
        GROUP BY event_type ORDER BY n DESC LIMIT 20`;
      return {events:list.map(x=>({kind:clean(x.event_type,36),count:num(x.n)}))};
    })
  ]);
}
async function githubGet(path,query=""){
  const owner=process.env.GITHUB_OWNER||"Tonykao1";
  const repo=process.env.GITHUB_REPO||"budao.org";
  const token=process.env.GITHUB_TOKEN||process.env.GH_TOKEN;
  if(!token)throw Error("github_not_configured");
  const url="https://api.github.com/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo)+"/"+path+query;
  const response=await fetch(url,{headers:{
    Accept:"application/vnd.github+json",Authorization:"Bearer "+token,
    "User-Agent":"BUDAO-Daily","X-GitHub-Api-Version":"2022-11-28"
  },signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error("github_"+response.status);
  return response.json();
}
async function githubFile(filename){
  const data=await githubGet("contents/"+filename,"?ref=main");
  if(data?.encoding!=="base64"||!data.content)throw Error("github_invalid_data");
  return JSON.parse(Buffer.from(data.content.replace(/\s+/g,""),"base64").toString("utf8"));
}
async function collectGithub(start,end){
  return Promise.all([
    source("routes",async()=>{
      const data=await githubFile("routes.json");
      if(!Array.isArray(data))throw Error("invalid_routes");
      const created=data.filter(x=>inWindow(x.createdAt,start,end));
      return {created:created.length,
        updated:data.filter(x=>inWindow(x.updatedAt,start,end)&&!inWindow(x.createdAt,start,end)).length,
        cancelled:countIn(data,"cancelledAt",start,end),
        restored:countIn(data,"restoredAt",start,end),
        titles:created.slice(0,8).map(x=>clean(x.title,90))};
    }),
    source("eebee",async()=>{
      const data=await githubFile("eebee-data.json");
      const result={};
      for(const name of ["users","offerings","applications","handovers","impacts"]){
        if(!Array.isArray(data[name]))throw Error("invalid_eebee_data");
        result[name]=countIn(data[name],"createdAt",start,end);
      }
      result.changedOfferings=countIn(data.offerings.filter(x=>!inWindow(x.createdAt,start,end)),"updatedAt",start,end);
      result.changedApplications=countIn(data.applications.filter(x=>!inWindow(x.createdAt,start,end)),"updatedAt",start,end);
      return result;
    }),
    source("invitations",async()=>{
      const commits=await githubGet("commits","?path=invitations%2F&since="+
        encodeURIComponent(start)+"&until="+encodeURIComponent(end)+"&per_page=100");
      if(!Array.isArray(commits))throw Error("invalid_invitation_history");
      return {fileChangeCommits:commits.length,truncated:commits.length>=100};
    })
  ]);
}
async function collectAll(sql,start,end,cfg={}){
  const [db,github]=await Promise.all([collectDb(sql,start,end,cfg),collectGithub(start,end)]);
  return {window:{start,end},
    sources:Object.fromEntries([...db,...github].map(v=>[v.name,v])),
    notConnected:[
      "童行、同道、路上星火：尚无独立互动事件来源",
      "网页浏览、页面停留：尚未接入统计",
      "帐篷活动报名：尚无统一报名记录（活动发布和修改已接入）",
      "网站运行异常与邮件送达状态：尚未接入汇总"
    ]};
}
function sourceMessage(row){
  return row?.state==="ok"?null:row?.state==="not_connected"?"尚未接入":"读取失败，需检查（不计作零）";
}
function localDate(value){
  return new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Singapore",hour12:false,
    year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
}
function formatDigest(data){
  const s=data.sources,p=s.prayer,c=s.calling,fire=s.campfire;
  const lines=["BUDAO Daily · 步道每日同行简报",
    "统计区间："+localDate(data.window.start)+" 至 "+localDate(data.window.end)+"（UTC+8）",
    "仅统计已记录的互动；代祷原文、私人联系方式、访客身份信息不通过邮件传送。","",
    "【今日需要关怀】"];
  if(p?.state==="ok")lines.push("代祷：待认领 "+p.data.waiting+" 项，进行中 "+p.data.praying+
    " 项，需要回复 "+p.data.requestsReply+" 项");
  else lines.push("代祷："+sourceMessage(p));
  if(c?.state==="ok")lines.push("新回应呼召："+c.data.newCount+" 位");
  else lines.push("回应呼召："+sourceMessage(c));
  if(fire?.state==="ok")lines.push("营火：待审核评论 "+fire.data.pending+" 条，待处理举报 "+fire.data.unresolvedReports+" 条");
  else lines.push("营火："+sourceMessage(fire));

  lines.push("","【代祷事项】");
  if(p?.state==="ok"){
    const activity=Object.entries(p.data.actions).map(([k,v])=>k+" "+v).join("、");
    lines.push("新增 "+p.data.received+" 项、完成 "+p.data.completed+" 项；处理动作："+(activity||"无"));
  }else lines.push(sourceMessage(p));

  lines.push("","【同工 · 回应呼召】");
  if(c?.state==="ok"){
    lines.push("新增 "+c.data.newCount+" 位、记录变更 "+c.data.changed+" 条、当前撤下记录 "+c.data.hidden+" 条");
    for(const person of c.data.people)lines.push("· "+person.name+" · "+person.location);
    if(c.data.newCount>c.data.people.length)lines.push("· 另有 "+(c.data.newCount-c.data.people.length)+" 位未逐一列出（含已撤回或超过展示上限）");
  }else lines.push(sourceMessage(c));

  lines.push("","【营火之地】");
  if(fire?.state==="ok")lines.push("照片点赞 "+fire.data.photoReactions+" 次、评论点赞 "+fire.data.commentReactions+
    " 次、新评论 "+fire.data.comments+" 条（含回复 "+fire.data.replies+
    " 条）、新举报 "+fire.data.reports+" 条、管理员处理 "+fire.data.moderated+" 次。",
    "访客互动："+(fire.data.visitorWritesEnabled?"已启用":"尚未开放（可能存在管理员操作）"));
  else lines.push(sourceMessage(fire));

  const pasture=s.pasture;
  lines.push("","【牧场】");
  if(pasture?.state==="ok")lines.push("新账户 "+pasture.data.users+" 位、新羊 "+pasture.data.sheep+
    " 只、步道卡激活 "+(pasture.data.cards===null?"尚未接入":pasture.data.cards+" 次"));
  else lines.push(sourceMessage(pasture));

  lines.push("","【同行活动与邀请函】");
  const routes=s.routes,inv=s.invitations;
  if(routes?.state==="ok"){
    lines.push("新增活动 "+routes.data.created+" 项、活动更新 "+routes.data.updated+
      " 项、取消 "+routes.data.cancelled+" 项、恢复 "+routes.data.restored+" 项");
    for(const title of routes.data.titles)lines.push("· "+title);
  }else lines.push("活动："+sourceMessage(routes));
  if(inv?.state==="ok")lines.push("邀请函文件变更 "+inv.data.fileChangeCommits+
    (inv.data.truncated?" 次以上（已达到查询上限）":" 次")+"，并非报名人数");
  else lines.push("邀请函："+sourceMessage(inv));

  lines.push("","【易彼益】");
  const e=s.eebee;
  if(e?.state==="ok")lines.push("新用户 "+e.data.users+" 位、新资源 "+e.data.offerings+
    " 项、新申请 "+e.data.applications+" 项、交接 "+e.data.handovers+
    " 次、影响记录 "+e.data.impacts+" 条、资源更新 "+e.data.changedOfferings+
    " 次、申请更新 "+e.data.changedApplications+" 次");
  else lines.push(sourceMessage(e));

  lines.push("","【系统管理】");
  const st=s.stewardship;
  if(st?.state==="ok")lines.push(st.data.events.length?
    st.data.events.map(x=>"· "+x.kind+"："+x.count+" 次").join("\n"):"本期无已记录的管理审计事件");
  else lines.push(sourceMessage(st));

  lines.push("","【尚未接入统计的互动】",...data.notConnected.map(x=>"· "+x),
    "","请登录授权后台处理私人事项，勿通过转发本邮件传递敏感内容。",
    "代祷：https://www.budao.org/tent.html",
    "呼召：https://www.budao.org/what.html",
    "营火：https://www.budao.org/yhzd.html",
    "网站：https://www.budao.org/");
  return lines.join("\n");
}
async function sendEmail(cfg,{key,snapshot}){
  const to=String(cfg.to||"").trim(),from=String(cfg.from||"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||!from||!cfg.resendKey)
    throw Error("mail_not_configured");
  const body={from,to:[to],subject:"步道每日同行简报 · "+key,text:formatDigest(snapshot)};
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{Authorization:"Bearer "+cfg.resendKey,
      "Content-Type":"application/json","Idempotency-Key":"budao-daily-"+key},
    body:JSON.stringify(body),signal:AbortSignal.timeout(15000)
  });
  let result={};
  try{result=await response.json()}catch(_){}
  if(!response.ok||!result.id)throw Error("email_api_"+response.status);
  return String(result.id);
}
function settings(){
  return {enabled:process.env.BUDAO_DAILY_DIGEST_ENABLED==="true",
    to:process.env.BUDAO_DAILY_REPORT_TO,
    from:process.env.EEBEE_EMAIL_FROM||process.env.STEWARDSHIP_EMAIL_FROM||process.env.EMAIL_FROM,
    resendKey:process.env.RESEND_API_KEY,
    campfireWrites:process.env.CAMPFIRE_GUEST_WRITES_ENABLED==="true"};
}
async function runDaily(sql,now,cfg,deps={}){
  const win=utcWindow(now);
  await ensureSchema(sql);
  const done=await sql`SELECT window_end FROM budao_daily_digest_runs
    WHERE status='SENT' AND window_end<=${win.end}::timestamptz
    ORDER BY window_end DESC LIMIT 1`;
  // When yesterday's email failed, roll its unsent window into today's
  // report rather than silently losing that day. Ignore older failed rows
  // already covered by a later successfully delivered digest.
  const missed=done.length?
    await sql`SELECT window_start FROM budao_daily_digest_runs
      WHERE status!='SENT' AND window_end>${new Date(done[0].window_end).toISOString()}::timestamptz
        AND window_end<${win.end}::timestamptz ORDER BY window_start ASC LIMIT 1`:
    await sql`SELECT window_start FROM budao_daily_digest_runs
      WHERE status!='SENT' AND window_end<${win.end}::timestamptz
      ORDER BY window_start ASC LIMIT 1`;
  let start=done.length?new Date(done[0].window_end).toISOString():
    (missed.length?new Date(missed[0].window_start).toISOString():win.start);
  if(missed.length){
    const earliest=new Date(missed[0].window_start).toISOString();
    if(earliest<start)start=earliest;
  }
  const limit=new Date(Date.parse(win.end)-45*DAY_MS).toISOString();
  if(start<limit)start=limit;
  if(start>=win.end)return {ok:true,skipped:"already_caught_up",key:win.key};

  const snapshot=await (deps.collect||collectAll)(sql,start,win.end,cfg);
  await sql`INSERT INTO budao_daily_digest_runs(window_key,window_start,window_end,snapshot)
    VALUES (${win.key},${start}::timestamptz,${win.end}::timestamptz,${JSON.stringify(snapshot)}::jsonb)
    ON CONFLICT(window_key) DO NOTHING`;
  const claim=await sql`UPDATE budao_daily_digest_runs
    SET status='SENDING',attempts=attempts+1,
      lease_until=now()+interval '5 minutes',updated_at=now()
    WHERE window_key=${win.key} AND status!='SENT'
      AND (lease_until IS NULL OR lease_until<now())
    RETURNING snapshot`;
  if(!claim.length){
    const status=await sql`SELECT status FROM budao_daily_digest_runs WHERE window_key=${win.key}`;
    return {ok:true,skipped:status[0]?.status==="SENT"?"already_sent":"in_progress",key:win.key};
  }
  const fixed=typeof claim[0].snapshot==="string"?JSON.parse(claim[0].snapshot):claim[0].snapshot;
  try{
    const providerId=await (deps.send||sendEmail)(cfg,{key:win.key,snapshot:fixed});
    await sql`UPDATE budao_daily_digest_runs
      SET status='SENT',sent_at=now(),provider_id=${providerId},lease_until=NULL,
      last_error=NULL,updated_at=now() WHERE window_key=${win.key}`;
    return {ok:true,sent:true,key:win.key,sources:Object.keys(fixed.sources).length};
  }catch(error){
    await sql`UPDATE budao_daily_digest_runs
      SET status='FAILED',lease_until=NULL,last_error=${clean(error?.message||"failed",60)},
      updated_at=now() WHERE window_key=${win.key}`;
    throw error;
  }
}
async function handler(req,res){
  if(req.method!=="GET")return sendJson(res,405,{ok:false,reason:"method_not_allowed"});
  if(!process.env.CRON_SECRET||req.headers?.authorization!=="Bearer "+process.env.CRON_SECRET)
    return sendJson(res,401,{ok:false,reason:"unauthorized"});
  if(process.env.VERCEL_ENV!=="production")
    return sendJson(res,200,{ok:true,skipped:"production_only"});
  const cfg=settings();
  if(!cfg.enabled)return sendJson(res,200,{ok:true,skipped:"not_enabled"});
  if(!cfg.to||!cfg.from||!cfg.resendKey||!process.env.DATABASE_URL)
    return sendJson(res,503,{ok:false,reason:"digest_not_configured"});
  try{
    const sql=neon(process.env.DATABASE_URL);
    return sendJson(res,200,await runDaily(sql,new Date(),cfg));
  }catch(error){
    console.error("BUDAO Daily failed:",clean(error?.code||error?.name||"unknown",32));
    return sendJson(res,503,{ok:false,reason:"daily_digest_failed"});
  }
}
module.exports=handler;
module.exports._test={utcWindow,inWindow,countIn,clean,formatDigest,collectDb,collectGithub,
  collectAll,runDaily,sendEmail,settings};
