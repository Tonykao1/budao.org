'use strict';

// Per-card secret and server-side verifier. Public six-axis art and card serials
// are identifiers only, NEVER inputs capable of predicting the secret.
const crypto=require('node:crypto');
const ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, no I/L/O/U
const CODE_LENGTH=20; // 20 independent 5-bit choices = 100 bits
const CARD_CODE_VERSION='v1';

function verifierSecret(env=process.env){
 const secret=String(env.PASTURE_CARD_PEPPER||'');
 if(Buffer.byteLength(secret,'utf8')<32){
  const error=new Error('pasture_card_verifier_not_configured');
  error.code='PASTURE_CARD_NOT_CONFIGURED';throw error;
 }
 return secret;
}
function normalizeCode(input){
 if(typeof input!=='string'||input.length>80)return null;
 const normalized=input.toUpperCase().replace(/[\s-]/g,'').replace(/[O]/g,'0').replace(/[IL]/g,'1');
 return normalized.length===CODE_LENGTH&&/^[0-9A-HJKMNP-TV-Z]{20}$/.test(normalized)?normalized:null;
}
function generateCode(){
 const bytes=crypto.randomBytes(CODE_LENGTH);
 const raw=Array.from(bytes,b=>ALPHABET[b&31]).join('');
 return {raw,printed:raw.match(/.{1,5}/g).join('-')};
}
function generateSerial(){
 const bytes=crypto.randomBytes(10);
 return 'BD-'+Array.from(bytes,b=>ALPHABET[b&31]).join('');
}
function hashCode(input,env=process.env){
 const normalized=normalizeCode(input);
 if(!normalized)return null;
 return crypto.createHmac('sha256',verifierSecret(env))
  .update('budao:pasture:card:'+CARD_CODE_VERSION+':'+normalized,'utf8')
  .digest('hex');
}
function createIssuedCard(env=process.env){
 // Verify configuration BEFORE generating material that must not leak.
 verifierSecret(env);
 const code=generateCode();
 return {
  serial:generateSerial(),
  password:code.printed, // one-time offline output; MUST NEVER be returned by the public API
  secretDigest:hashCode(code.raw,env),
  secretVersion:CARD_CODE_VERSION
 };
}
module.exports={ALPHABET,CODE_LENGTH,CARD_CODE_VERSION,verifierSecret,normalizeCode,generateCode,generateSerial,hashCode,createIssuedCard};
