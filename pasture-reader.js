(()=>{'use strict';
const $=id=>document.getElementById(id);
const status=$('status'),reader=$('reader'),book=$('book'),chapter=$('chapter'),reference=$('reference'),verses=$('verses'),prev=$('previous'),next=$('next');
const B=window.MyGrassBible;
if(!B||!Array.isArray(B.groups?.old)||!Array.isArray(B.groups?.new)){
 status.textContent='圣经经卷引擎暂不可用。请返回牧场稍后再试。';return;
}
const all=[...B.groups.old,...B.groups.new];
let pending=0;
const announce=message=>{status.hidden=false;status.textContent=message};
async function authorized(){
 const response=await fetch('/api/pasture-auth',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('居民身份暂时无法核验（HTTP '+response.status+'）');
 const data=await response.json();
 return Boolean(data?.ok===true&&data.user?.id&&data.user?.sheep&&data.user?.cardActivated===true);
}
function fillChapterList(chosen=1){
 const meta=B.bookMeta(book.value);
 chapter.replaceChildren();
 for(let i=1;i<=meta.chapters;i++){
  const option=document.createElement('option');option.value=String(i);option.textContent='第 '+i+' 章';chapter.appendChild(option);
 }
 chapter.value=String(B.clampChapter(book.value,chosen));
}
function updateNav(){
 const index=all.findIndex(item=>item[0]===book.value);
 const current=Number(chapter.value);
 prev.disabled=index===0&&current===1;
 next.disabled=index===all.length-1&&current===B.bookMeta(book.value).chapters;
}
async function renderChapter(){
 const token=++pending,abbr=book.value,ch=Number(chapter.value),meta=B.bookMeta(abbr);
 updateNav();announce('正在载入 '+meta.name+' 第 '+ch+' 章……');
 verses.replaceChildren();
 try{
  const data=await B.loadChapter(abbr,ch);
  if(token!==pending)return;
  if(!Array.isArray(data?.verses)||!data.verses.length)throw Error('本章经文尚未取得');
  const frag=document.createDocumentFragment();
  for(const verse of data.verses){
   const item=document.createElement('li'),number=document.createElement('span');
   number.className='verse-num';number.textContent=String(verse.verse);
   item.append(number,document.createTextNode(String(verse.text||'')));frag.appendChild(item);
  }
  verses.appendChild(frag);
  reference.textContent=meta.name+' · 第 '+ch+' 章';
  status.hidden=true;
 }catch(error){
  if(token!==pending)return;
  announce('经文加载失败。'+String(error?.message||'请检查网络后重试。'));
 }
}
function adjacent(step){
 const at=all.findIndex(item=>item[0]===book.value);
 const meta=B.bookMeta(book.value),ch=Number(chapter.value);
 const target=ch+step;
 if(target>=1&&target<=meta.chapters){chapter.value=String(target);renderChapter();return}
 const nextItem=all[at+step];if(!nextItem)return;
 book.value=nextItem[0];fillChapterList(step===1?1:nextItem[2]);renderChapter();
}
async function boot(){
 try{
  if(!(await authorized())){
   announce('此入口仅向持有已激活步道卡的牧场居民开放。请先返回正式站登录；已激活但仍无法进入，请反馈账户与卡片同步状态。');return;
  }
  for(const item of all){
   const option=document.createElement('option');option.value=item[0];option.textContent=item[1];book.appendChild(option);
  }
  const mark=B.resolve('马可福音');
  book.value=mark?mark[0]:all[0][0];
  fillChapterList(1);reader.hidden=false;
  book.addEventListener('change',()=>{fillChapterList(1);renderChapter()});
  chapter.addEventListener('change',renderChapter);
  prev.addEventListener('click',()=>adjacent(-1));
  next.addEventListener('click',()=>adjacent(1));
  await renderChapter();
 }catch(error){announce('暂时无法核对牧场权限。'+String(error?.message||'请稍后再试。'))}
}
boot();
})();