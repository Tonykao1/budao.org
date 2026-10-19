'use strict';
const { neon }=require('@neondatabase/serverless');
const { getDatabaseUrl }=require('../../db/client');

function queryDb(env=process.env){return neon(getDatabaseUrl(env))}

// Counters live in PostgreSQL, not a serverless instance's in-memory Map.
async function consumeActivationAttempt(userId,env=process.env){
 const query=queryDb(env);
 const rows=await query`
  INSERT INTO pasture_card_attempts AS a(user_id,attempts,window_started_at)
  VALUES (${userId},1,now())
  ON CONFLICT(user_id) DO UPDATE SET
    attempts=CASE WHEN a.window_started_at<now()-interval '15 minutes'
        THEN 1 ELSE a.attempts+1 END,
    window_started_at=CASE WHEN a.window_started_at<now()-interval '15 minutes'
        THEN now() ELSE a.window_started_at END
  RETURNING attempts
 `;
 return Number(rows[0]?.attempts||0)<=5;
}

async function redeemSecretDigest(userId,digest,env=process.env){
 const query=queryDb(env);
 try{
  // The partial UNIQUE index allows one ACTIVE card per resident. One SQL
  // statement rolls back the claimed card and entitlement together on error.
  const rows=await query`
   WITH claimed AS (
     UPDATE pasture_cards SET status='ACTIVATED', activated_at=now(),
       activated_by_user_id=${userId}
     WHERE secret_digest=${digest} AND status='ISSUED'
       AND EXISTS(SELECT 1 FROM pasture_users
         WHERE id=${userId} AND status='ACTIVE' AND card_activated_at IS NULL)
     RETURNING id,serial
   ), enabled AS (
     UPDATE pasture_users
        SET card_activated_at=now(),updated_at=now()
      WHERE id=${userId} AND status='ACTIVE' AND card_activated_at IS NULL
        AND EXISTS(SELECT 1 FROM claimed)
      RETURNING id
   )
   SELECT (SELECT serial FROM claimed LIMIT 1) AS serial,
          EXISTS(SELECT 1 FROM enabled) AS enabled
  `;
  return rows[0]?.enabled===true?rows[0].serial:null;
 }catch(error){
  if(error?.code==='23505')return null; // concurrent unique-key claim loses
  throw error;
 }
}

// Admin-only offline issuance: the database never sees the plaintext code.
async function issueCardRecord({serial,secretDigest,secretVersion,batchId},env=process.env){
 const query=queryDb(env);
 await query`
  INSERT INTO pasture_cards(serial,secret_digest,secret_version,batch_id,status)
  VALUES(${serial},${secretDigest},${secretVersion},${batchId},'ISSUED')
 `;
 return serial;
}

// Admin-only offline revocation: revoked codes cannot become usable again.
async function revokeCard(serial,env=process.env){
 const query=queryDb(env);
 const rows=await query`
  WITH revoked AS (
   UPDATE pasture_cards SET status='REVOKED',revoked_at=now()
    WHERE serial=${serial} AND status IN ('ISSUED','ACTIVATED')
   RETURNING id,activated_by_user_id
  ), disabled AS (
   UPDATE pasture_users SET card_activated_at=NULL,updated_at=now()
    WHERE id IN (SELECT activated_by_user_id FROM revoked)
   RETURNING id
  )
  SELECT EXISTS(SELECT 1 FROM revoked) AS revoked,
    EXISTS(SELECT 1 FROM disabled) AS resident_disabled
 `;
 return {revoked:rows[0]?.revoked===true,residentDisabled:rows[0]?.resident_disabled===true};
}
module.exports={consumeActivationAttempt,redeemSecretDigest,issueCardRecord,revokeCard};
