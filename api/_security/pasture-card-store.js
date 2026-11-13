'use strict';
/* Historical founder card reconciliation. No issuance, no client-side activation.
   The legacy prototype had no trustworthy production activation ledger.
   Only an authenticated steward can attest to a reviewed historical record. */
const { neon } = require('@neondatabase/serverless');
const { getDatabaseUrl } = require('../../db/client');
let client, schemaPromise;
function db(){ if(!client) client=neon(getDatabaseUrl()); return client; }
async function ensureCardSchema(){
 if(!schemaPromise) schemaPromise=(async()=>{
  const q=db();
  await q("CREATE TABLE IF NOT EXISTS pasture_founder_claims ("+
   "id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"+
   "user_id uuid NOT NULL UNIQUE REFERENCES pasture_users(id) ON DELETE CASCADE,"+
   "series_id text NOT NULL DEFAULT 'CSCZ-001',"+
   "status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED')),"+
   "reviewed_by text,verification_reference text,"+
   "created_at timestamptz NOT NULL DEFAULT now(),"+
   "updated_at timestamptz NOT NULL DEFAULT now())");
  await q("CREATE INDEX IF NOT EXISTS pasture_founder_claims_queue_idx ON pasture_founder_claims(status,created_at)");
  await q("CREATE TABLE IF NOT EXISTS pasture_cards ("+
   "id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"+
   "user_id uuid NOT NULL UNIQUE REFERENCES pasture_users(id) ON DELETE CASCADE,"+
   "series_id text NOT NULL,"+
   "serial text,"+
   "status text NOT NULL CHECK(status IN ('ACTIVATED')),"+
   "source text NOT NULL CHECK(source IN ('HISTORIC_FOUNDER')),"+
   "verification_reference text NOT NULL,"+
   "approved_by text NOT NULL,"+
   "activated_at timestamptz NOT NULL DEFAULT now(),"+
   "created_at timestamptz NOT NULL DEFAULT now(),"+
   "UNIQUE(series_id,serial))");
  // Only one first founder card for the series, even under concurrent review.
  await q("CREATE UNIQUE INDEX IF NOT EXISTS pasture_one_founder_per_series_idx "+
          "ON pasture_cards(series_id) WHERE source='HISTORIC_FOUNDER'");
 })().catch(e=>{schemaPromise=null;throw e});
 return schemaPromise;
}
async function cardForUser(userId){
 const rows=await db()("SELECT series_id AS \"seriesId\", serial, status, source,"+
  " activated_at AS \"activatedAt\" FROM pasture_cards WHERE user_id=$1::uuid LIMIT 1",[userId]);
 return rows[0]||null;
}
async function founderClaimForUser(userId){
 const rows=await db()("SELECT status,created_at AS \"createdAt\" FROM pasture_founder_claims "+
  "WHERE user_id=$1::uuid LIMIT 1",[userId]);
 return rows[0]||null;
}
async function createFounderClaim(userId){
 const rows=await db()("INSERT INTO pasture_founder_claims(user_id) "+
  "SELECT $1::uuid WHERE NOT EXISTS (SELECT 1 FROM pasture_cards WHERE user_id=$1::uuid) "+
  "ON CONFLICT(user_id) DO NOTHING RETURNING status, created_at AS \"createdAt\"",[userId]);
 return rows[0]||await founderClaimForUser(userId);
}
async function listFounderClaims(){
 return db()("SELECT c.id,c.user_id AS \"userId\",u.email_masked AS \"emailMasked\","+
  "c.series_id AS \"seriesId\",c.status,c.created_at AS \"createdAt\" "+
  "FROM pasture_founder_claims c JOIN pasture_users u ON u.id=c.user_id "+
  "WHERE c.status='PENDING' ORDER BY c.created_at ASC LIMIT 40");
}
async function approveFounderClaim(claimId,stewardId,evidenceReference){
 // One transaction-level SQL statement: either the historic card and claim both
 // appear, or neither is marked approved. No new serial or six-dimensional
 // identity is invented. Collisions fail closed, without reissuing.
 const rows=await db()(
  "WITH target AS ("+
   "SELECT id,user_id,series_id FROM pasture_founder_claims "+
   "WHERE id=$1::uuid AND status='PENDING' FOR UPDATE),"+
  "created AS ("+
   "INSERT INTO pasture_cards(user_id,series_id,serial,status,source,verification_reference,approved_by) "+
   "SELECT user_id,series_id,NULL,'ACTIVATED','HISTORIC_FOUNDER',$3,$2 FROM target "+
   "ON CONFLICT DO NOTHING RETURNING id,user_id),"+
  "approved AS ("+
   "UPDATE pasture_founder_claims SET status='APPROVED',reviewed_by=$2,"+
   "verification_reference=$3,updated_at=now() "+
   "WHERE id IN (SELECT id FROM target) AND user_id IN (SELECT user_id FROM created) "+
   "RETURNING id,user_id) "+
  "SELECT c.id AS \"cardId\",a.id AS \"claimId\" "+
  "FROM created c JOIN approved a ON a.user_id=c.user_id",
  [claimId,stewardId,evidenceReference]);
 return rows[0]||null;
}
module.exports={ensureCardSchema,cardForUser,founderClaimForUser,createFounderClaim,
 listFounderClaims,approveFounderClaim};
