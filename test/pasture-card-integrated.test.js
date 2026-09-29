const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm');
const base=path.join(__dirname,'..','pasture-preview');
const assembled=Array.from({length:20},(_,i)=>fs.readFileSync(path.join(base,'parts','part-'+String(i).padStart(2,'0')+'.txt'),'utf8')).join('');
const encoded=assembled.match(/const ORIGINAL=`([A-Za-z0-9+/=]+)`;/);
assert.ok(encoded,'Approved original card must remain embedded');
const original=zlib.gunzipSync(Buffer.from(encoded[1],'base64')).toString('utf8');
const begin=assembled.indexOf('function upgradeApprovedCard(original){'),end=assembled.indexOf('\nconst approvedSixCardHTML=upgradeApprovedCard(cardHTML);',begin);
assert.ok(begin>=0&&end>begin,'Actual integrated original-card upgrade function must exist');
const upgrade=new Function(assembled.slice(begin,end)+'\nreturn upgradeApprovedCard;')();
const approved=upgrade(original);
test('assembled pasture loader recognizes current, not removed, card engine',()=>{
 const loader=fs.readFileSync(path.join(base,'index.html'),'utf8');
 assert.ok(loader.includes("const approvedSixCardHTML=upgradeApprovedCard(cardHTML);"));
 assert.ok(!loader.includes("if(!html.includes('const cardDoc=cardHTML.replace(')"));
 assert.ok(assembled.includes('const cardDoc=approvedSixCardHTML.replace('));
});
test('actual integrated six-dimensional upgrade preserves every original DATA artwork byte',()=>{
 const data=h=>h.match(/^const DATA=.*$/m)?.[0];
 assert.ok(data(original));assert.equal(data(approved),data(original));
 assert.ok(approved.includes('border-radius:16px!important'));
});
test('actual integrated card script compiles and only exposes seven thousand public combinations',()=>{
 const js=approved.slice(approved.lastIndexOf('<script>')+8,approved.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(approved.includes('six.PUBLIC_LIMIT'));
 assert.ok(approved.includes('all.length')===false);
 assert.ok(approved.includes("v.numberColor+'_'+v.rank"));
 assert.ok(approved.includes('7,000'));
 assert.ok(approved.includes('7,488'));
 assert.ok(!approved.includes('五维'));
});
