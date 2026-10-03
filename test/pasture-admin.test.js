const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
process.env.PASTURE_SESSION_SECRET='pasture-test-secret-which-is-definitely-longer-than-thirty-two-characters';
process.env.PASTURE_EMAIL_ENCRYPTION_SECRET='pasture-email-encryption-secret-which-is-definitely-long-enough';
const d=require('../api/_security/pasture-auth-domain');

test('full resident email can be encrypted for storage and decrypted only with the pasture encryption secret',()=>{
  const sealed=d.encryptEmail('Walker@Example.com');
  assert.equal(typeof sealed.emailCiphertext,'string');
  assert.equal(typeof sealed.emailNonce,'string');
  assert.equal(typeof sealed.emailTag,'string');
  assert.equal(sealed.emailCiphertext.includes('walker@example.com'),false);
  assert.equal(d.decryptEmail(sealed),'walker@example.com');
});

test('pasture user schema has encrypted email columns without replacing lookup hash and masked email',()=>{
  const schema=fs.readFileSync(path.join(__dirname,'..','db/schema.js'),'utf8');
  assert.match(schema,/emailHash: text\("email_hash"\)/);
  assert.match(schema,/emailMasked: text\("email_masked"\)/);
  assert.match(schema,/emailCiphertext: text\("email_ciphertext"\)/);
  assert.match(schema,/emailNonce: text\("email_nonce"\)/);
  assert.match(schema,/emailTag: text\("email_tag"\)/);
});

test('pasture admin endpoint and page require a dedicated resident-admin allowlist without adding a serverless function',()=>{
  const api=fs.readFileSync(path.join(__dirname,'..','api/_security/pasture-admin-handler.js'),'utf8');
  const page=fs.readFileSync(path.join(__dirname,'..','admin/pasture.html'),'utf8');
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'..','vercel.json'),'utf8'));
  const rewrites=new Map(config.rewrites.map((x)=>[x.source,x.destination]));
  assert.match(api,/PASTURE_ADMIN_USER_IDS/);
  assert.match(api,/getAuthenticatedPublisher/);
  assert.match(api,/decryptEmail/);
  assert.match(page,/数字牧场居民/);
  assert.match(page,/\/api\/pasture-admin/);
  assert.equal(rewrites.get('/api/pasture-admin'),'/api/auth/session?view=pasture-residents');
  assert.equal(fs.existsSync(path.join(__dirname,'..','api/pasture-admin.js')),false);
});
