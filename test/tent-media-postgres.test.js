const test = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {randomUUID} = require("node:crypto");
const {Pool} = require("pg");
const {mutate} = require("../api/_security/tent-media-store");

test("concurrent photos cannot consume the same album revision", {skip: !process.env.TENT_MEDIA_TEST_DATABASE_URL}, async () => {
  const connectionString = process.env.TENT_MEDIA_TEST_DATABASE_URL;
  const schema = "test_media_"+randomUUID().replaceAll("-","");
  const admin = new Pool({connectionString});
  const db = new Pool({connectionString,options:"-c search_path="+schema});
  try {
    await admin.query("CREATE SCHEMA "+schema);
    for (const file of ["foundation","objects"]) {
      await db.query(readFileSync("db/migrations/20261128_tent_media_"+file+".sql","utf8"));
    }
    async function write(body,image) {
      const client = await db.connect();
      try { return await mutate(client,{id:"leader"},body,image); }
      finally { client.release(); }
    }
    const album = await write({action:"create",title:"Concurrency",location:"test",date:"2026-01-01"});
    const photo = {master:Buffer.alloc(8),display:Buffer.alloc(9),sha:"a".repeat(64)};
    const upload = {action:"upload",album:album.id,revision:album.revision,alt:"fixture",consent:true};
    const results = await Promise.allSettled([write(upload,photo),write(upload,photo)]);
    assert.deepEqual(results.map(r=>r.status).sort(),["fulfilled","rejected"]);
    assert.equal(results.find(r=>r.status==="rejected").reason.status,409);
    assert.equal((await db.query("SELECT count(*) AS n FROM tent_media_objects")).rows[0].n,"1");
    assert.equal((await db.query("SELECT count(*) AS n FROM tent_media_audit")).rows[0].n,"2");
  } finally {
    await db.end();
    try { await admin.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE"); }
    finally { await admin.end(); }
  }
});
