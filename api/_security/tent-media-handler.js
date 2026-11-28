const {getAuthenticatedPublisher,isSteward} = require("./auth");
const {requireSameOrigin,requireJsonPost,sendJson} = require("./http");
const {consume} = require("./rate-limit");
const {mutate,list,uuid,fail} = require("./tent-media-store");
let pool;
function database() {
  if (!process.env.TENT_MEDIA_DATABASE_URL) fail(503,"media_unconfigured");
  pool ||= new (require("pg").Pool)({connectionString:process.env.TENT_MEDIA_DATABASE_URL,max:2,connectionTimeoutMillis:4000,idleTimeoutMillis:10000});
  return pool;
}
function handler(getPool=database) {
  return async function media(req,res) {
    const query = new URL(req.url,"https://budao.org").searchParams;
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    let client;
    try {
      const actor = getAuthenticatedPublisher(req);
      if (req.method === "GET") {
        const privateId = query.get("preview");
        if (query.has("preview") && !actor) fail(401,"unauthorized");
        if (query.has("photo") || query.has("preview")) {
          const id = privateId ?? query.get("photo");
          if (!uuid.test(id)) fail(404,"photo_missing");
          const {rows} = await getPool().query(`SELECT o.display FROM tent_media_objects o
            JOIN tent_media_assets a ON a.id=o.asset_id JOIN tent_media_albums t ON t.id=a.album_id
            WHERE a.id=$1 AND CASE WHEN $2 THEN (t.owner_id=$3 OR $4)
            ELSE (t.state='published' AND a.approved AND a.consent_confirmed) END`,
            [id,privateId !== null,actor?.id || "",isSteward(actor)]);
          if (!rows.length) fail(404,"photo_missing");
          res.setHeader("Content-Type","image/webp");
          return res.status(200).send(Buffer.from(rows[0].display));
        }
        const publicFeed = query.get("feed") === "published";
        if (!actor && !publicFeed) fail(401,"unauthorized");
        return sendJson(res,200,await list(getPool(),publicFeed ? null : actor));
      }
      if (req.method !== "POST") fail(405,"method_not_allowed");
      if (!actor) fail(401,"unauthorized");
      if (!requireSameOrigin(req)) fail(403,"forbidden");
      const parsed = requireJsonPost(req,2850000);
      if (parsed.error) fail(parsed.status,parsed.error);
      if (!consume("tent-media:"+actor.id,60,60000)) fail(429,"rate_limited");
      const b = parsed.body;
      const db = getPool();
      let image;
      if (b.action === "upload") {
        if (!uuid.test(b.album)) fail(400,"invalid_album");
        const {rows} = await db.query("SELECT revision FROM tent_media_albums WHERE id=$1 AND owner_id=$2 AND state='draft'",[b.album,actor.id]);
        if (!rows.length) fail(403,"draft_required");
        if (rows[0].revision !== b.revision) fail(409,"revision_conflict");
        try { image = await require("./tent-media-image").prepareImage(b); }
        catch (error) { fail(400,error.message === "hash_mismatch" ? "hash_mismatch" : "invalid_image"); }
      }
      client = await db.connect();
      return sendJson(res,200,await mutate(client,actor,b,image));
    } catch (error) {
      return sendJson(res,error.status || 503,{reason:error.status ? error.message : "media_unavailable"});
    } finally { client?.release(); }
  };
}
module.exports = handler();
module.exports.handler = handler;
