const {randomUUID} = require("node:crypto");
const {isSteward} = require("./auth");
const {transition,canEdit} = require("./tent-media-domain");
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const assetFields = "id,position,alt_text,caption,consent_confirmed,approved";
function fail(status, reason) { throw Object.assign(new Error(reason),{status}); }
function value(s,max,required=true) {
  if (typeof s !== "string" || s.trim().length > max || (required && !s.trim())) fail(400,"invalid_text");
  return s.trim();
}
async function mutate(db,actor,b,image) {
  const q = async (sql,args=[]) => (await db.query(sql,args)).rows;
  const steward = isSteward(actor);
  const action = b.action;
  const id = action === "create" ? randomUUID() : b.album;
  if (!uuid.test(id)) fail(400,"invalid_album");
  await q("BEGIN");
  try {
    if (action === "create") {
      await q("SELECT pg_advisory_xact_lock(2601128)");
      const [counts] = await q("SELECT count(*) AS total,count(*) FILTER (WHERE owner_id=$1) AS mine FROM tent_media_albums",[actor.id]);
      if (+counts.total >= 200 || +counts.mine >= 32) fail(429,"album_quota");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !Number.isFinite(Date.parse(b.date)) || new Date(b.date).toISOString().slice(0,10)!==b.date) fail(400,"invalid_date");
      await q("INSERT INTO tent_media_albums(id,owner_id,title,location,activity_date) VALUES($1,$2,$3,$4,$5)",[id,actor.id,value(b.title,120),value(b.location,100),b.date]);
    }
    const [album] = await q("SELECT * FROM tent_media_albums WHERE id=$1 FOR UPDATE",[id]);
    if (!album || (album.owner_id !== actor.id && !steward)) fail(404,"album_missing");
    if (action !== "create" && b.revision !== album.revision) fail(409,"revision_conflict");
    const assets = await q("SELECT "+assetFields+" FROM tent_media_assets WHERE album_id=$1 ORDER BY position",[id]);
    let state = album.state;
    if (["upload","remove"].includes(action) && !canEdit(actor,album)) fail(403,"draft_required");
    if (action === "upload") {
      if (assets.length >= 24) fail(429,"photo_quota");
      if (b.consent !== true) fail(400,"consent_required");
      await q("SELECT pg_advisory_xact_lock(2601129)");
      const [usage] = await q("SELECT COALESCE(sum(octet_length(master)+octet_length(display)),0) AS bytes FROM tent_media_objects");
      if (+usage.bytes + image.master.length + image.display.length > 128 * 1024 * 1024) fail(429,"storage_quota");
      const aid = randomUUID();
      const inserted = await q("INSERT INTO tent_media_assets(id,album_id,private_object_key,sha256,mime_type,bytes,alt_text,caption,position,consent_confirmed) VALUES($1,$2,$3,$4,'image/webp',$5,$6,$7,$8,true) ON CONFLICT(album_id,sha256) DO NOTHING RETURNING id",[aid,id,aid,image.sha,image.master.length,value(b.alt,150),value(b.caption||"",180,false),(assets.at(-1)?.position ?? -1)+1]);
      if (!inserted.length) fail(409,"duplicate_photo");
      await q("INSERT INTO tent_media_objects VALUES($1,$2,$3)",[aid,image.master,image.display]);
    } else if (action === "remove" || action === "review") {
      if (!assets.some(a => a.id === b.asset)) fail(404,"photo_missing");
      if (action === "review") {
        if (!steward || state !== "submitted" || typeof b.approved !== "boolean") fail(403,"review_forbidden");
        await q("UPDATE tent_media_assets SET approved=$1 WHERE id=$2",[b.approved,b.asset]);
      } else await q("DELETE FROM tent_media_assets WHERE id=$1",[b.asset]);
    } else if (action === "publish") {
      if (!steward || state !== "approved" || !assets.length || !assets.every(a=>a.approved && a.consent_confirmed)) fail(403,"publish_forbidden");
      const [ready] = await q("SELECT count(*) AS n FROM tent_media_objects o JOIN tent_media_assets a ON a.id=o.asset_id WHERE a.album_id=$1",[id]);
      if (+ready.n !== assets.length) fail(409,"missing_display");
      state = "published";
    } else if (action !== "create") {
      state = transition(actor,album,assets,action);
      if (!state) fail(403,"invalid_transition");
      if (action === "return") await q("UPDATE tent_media_assets SET approved=false WHERE album_id=$1",[id]);
    }
    const [result] = await q("UPDATE tent_media_albums SET state=$1,revision=revision+1,updated_at=now(),published_on=CASE WHEN $1='published' THEN (now() AT TIME ZONE 'Asia/Shanghai')::date ELSE published_on END WHERE id=$2 RETURNING id,revision,state",[state,id]);
    await q("INSERT INTO tent_media_audit(id,album_id,actor_id,action,revision) VALUES($1,$2,$3,$4,$5)",[randomUUID(),id,actor.id,action,result.revision]);
    await q("COMMIT");
    return result;
  } catch (error) { await q("ROLLBACK"); throw error; }
}
async function list(db,actor) {
  const {rows} = await db.query(`SELECT t.id,t.title,t.location,t.activity_date::text AS date,t.published_on::text AS "publishedOn",t.state,t.revision,t.owner_id,
    COALESCE((SELECT json_agg(json_build_object('id',a.id,'alt',a.alt_text,'caption',a.caption,'approved',a.approved) ORDER BY a.position)
    FROM tent_media_assets a WHERE a.album_id=t.id AND ($1 OR (a.consent_confirmed AND a.approved))), '[]') AS photos
    FROM tent_media_albums t WHERE CASE WHEN $1 THEN (t.owner_id=$2 OR $3) ELSE t.state='published' END ORDER BY t.updated_at DESC`,[!!actor,actor?.id || "",isSteward(actor)]);
  if (actor) return {albums:rows.map(({owner_id,...a})=>({...a,mine:owner_id===actor.id})),steward:isSteward(actor)};
  return {albums:rows.map(({id,title,location,date,publishedOn,photos})=>({id,title,location,date,publishedOn,published:true,photos:photos.map(p=>({...p,heroEligible:false,src:"/api/tent-media?photo="+p.id}))}))};
}
module.exports = {mutate,list,uuid,fail};
