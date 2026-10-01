(()=>{
'use strict';
const bodies=[['#f4ecdc','米白'],['#f2e3b3','麦穗'],['#bfd8da','浅蓝灰'],['#dec9c8','豆沙'],['#c7d5b5','青草'],['#d8d7ce','银灰'],['#f1d7bf','杏色'],['#eee8dc','云白']];
const heads=[['#8d836e','褐灰'],['#917d62','麦褐'],['#776d66','深灰'],['#866f70','棕红'],['#727a66','青灰'],['#716a64','炭灰'],['#907461','栗色'],['#746d65','石褐']];
function options(list){return list.map(([v,n])=>'<option value="'+v+'">'+n+'</option>').join('')}
async function open(){
 const auth=window.PastureResidentAuth;if(!auth)return;
 const card=auth.card;auth.layer.hidden=false;
 card.innerHTML='<h1 id="pastureResidentTitle">捏一只羊</h1><p>这是你的牧场身份。完成以后，它会从天上落进羊群，并在以后每一次牧场中出现。</p>'+
 '<label for="pastureSheepBody">羊毛</label><select id="pastureSheepBody">'+options(bodies)+'</select>'+
 '<label for="pastureSheepHead">脸</label><select id="pastureSheepHead">'+options(heads)+'</select>'+
 '<label for="pastureSheepMark">记号</label><select id="pastureSheepMark"><option value="NONE">无</option><option value="FACE">脸部浅记号</option><option value="BACK">背部浅记号</option><option value="SOCKS">浅色腿</option></select>'+
 '<div class="pasture-resident-actions"><button id="pastureSaveSheep" type="button">让它进入牧场</button></div><div class="pasture-resident-message" id="pastureResidentMessage" aria-live="polite"></div>';
 document.getElementById('pastureSaveSheep').onclick=async()=>{
  const button=document.getElementById('pastureSaveSheep');button.disabled=true;
  const message=document.getElementById('pastureResidentMessage');message.textContent='正在进入牧场……';
  try{
   const result=await auth.call({action:'saveSheep',bodyColor:document.getElementById('pastureSheepBody').value,headColor:document.getElementById('pastureSheepHead').value,marking:document.getElementById('pastureSheepMark').value});
   auth.setUser(result.user);auth.layer.hidden=true;auth.apply(!!result.created);auth.pop('你的羊已经进入牧场');
  }catch(e){message.textContent=auth.friendly(e.reason);button.disabled=false}
 };
}
window.addEventListener('pasture-needs-sheep',open);
window.PastureSheepMaker=Object.freeze({open});
})();
