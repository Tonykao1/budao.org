/* Canonical 66-book Chinese navigation (Protestant numbering).
 * Metadata only; no unlicensed Bible translation is embedded or implied.
 * Verse counts differ by translation/versification and must be checked by the reader.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MyGrassBible=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const old=[
 ['创','创世记',50],['出','出埃及记',40],['利','利未记',27],['民','民数记',36],
 ['申','申命记',34],['书','约书亚记',24],['士','士师记',21],['得','路得记',4],
 ['撒上','撒母耳记上',31],['撒下','撒母耳记下',24],['王上','列王纪上',22],
 ['王下','列王纪下',25],['代上','历代志上',29],['代下','历代志下',36],
 ['拉','以斯拉记',10],['尼','尼希米记',13],['斯','以斯帖记',10],
 ['伯','约伯记',42],['诗','诗篇',150],['箴','箴言',31],['传','传道书',12],
 ['歌','雅歌',8],['赛','以赛亚书',66],['耶','耶利米书',52],
 ['哀','耶利米哀歌',5],['结','以西结书',48],['但','但以理书',12],
 ['何','何西阿书',14],['珥','约珥书',3],['摩','阿摩司书',9],
 ['俄','俄巴底亚书',1],['拿','约拿书',4],['弥','弥迦书',7],
 ['鸿','那鸿书',3],['哈','哈巴谷书',3],['番','西番雅书',3],
 ['该','哈该书',2],['亚','撒迦利亚书',14],['玛','玛拉基书',4]
 ];
 const newTestament=[
 ['太','马太福音',28],['可','马可福音',16],['路','路加福音',24],
 ['约','约翰福音',21],['徒','使徒行传',28],['罗','罗马书',16],
 ['林前','哥林多前书',16],['林后','哥林多后书',13],
 ['加','加拉太书',6],['弗','以弗所书',6],['腓','腓立比书',4],
 ['西','歌罗西书',4],['帖前','帖撒罗尼迦前书',5],
 ['帖后','帖撒罗尼迦后书',3],['提前','提摩太前书',6],
 ['提后','提摩太后书',4],['多','提多书',3],['门','腓利门书',1],
 ['来','希伯来书',13],['雅','雅各书',5],['彼前','彼得前书',5],
 ['彼后','彼得后书',3],['约壹','约翰一书',5],
 ['约贰','约翰二书',1],['约叁','约翰三书',1],
 ['犹','犹大书',1],['启','启示录',22]
 ];
 const groups=Object.freeze({old:Object.freeze(old.map(v=>Object.freeze(v))),
  new:Object.freeze(newTestament.map(v=>Object.freeze(v)))});
 const all=[...groups.old,...groups.new];
 function resolve(abbrOrName){
  const s=String(abbrOrName||'').trim();
  return all.find(([short,name])=>short===s||name===s)||null;
 }
 function groupOf(abbr){
  return groups.old.some(([s,name])=>abbr===s||abbr===name)?'old':'new';
 }
 function clampChapter(book,value){
  const entry=resolve(book);if(!entry)throw Error('未识别圣经书卷。');
  const n=Math.trunc(Number(value));if(!Number.isFinite(n))return 1;
  return Math.min(entry[2],Math.max(1,n));
 }
 function format(book,chapter,start=1,end=1,whole=false){
  const entry=resolve(book);if(!entry)throw Error('未识别圣经书卷。');
  const ch=clampChapter(entry[0],chapter);
  if(whole)return entry[0]+' '+ch;
  const a=Math.trunc(Number(start)),b=Math.trunc(Number(end));
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<1||b<1||a>176||b>176)
   throw Error('节数需要在1—176之间，并请按所用译本核对。');
  return a===b?entry[0]+' '+ch+':'+a:
   entry[0]+' '+ch+':'+Math.min(a,b)+'–'+Math.max(a,b);
 }
 function parse(reference){
  const s=String(reference||'').trim();
  const match=s.match(/^(.+?)\s*(\d+)(?::(\d+)(?:\s*[–—\-~至]\s*(\d+))?)?$/);
  if(!match)return null;
  const entry=resolve(match[1].trim());if(!entry)return null;
  const chapter=Number(match[2]);
  if(chapter<1||chapter>entry[2])return null;
  const whole=!match[3],start=whole?1:Number(match[3]),end=whole?1:Number(match[4]||match[3]);
  if(start<1||end<1||start>176||end>176)return null;
  return {testament:groupOf(entry[0]),book:entry[0],chapter,start,end,whole};
 }
 return Object.freeze({groups,resolve,groupOf,clampChapter,format,parse});
});
