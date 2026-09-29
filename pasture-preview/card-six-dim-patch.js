/* Upgrade the exact approved raster card in place. Never replace card artwork. */
(function(root){
'use strict';
function line(src,anchor,replacement){
 const a=src.indexOf(anchor),b=a<0?-1:src.indexOf('\n',a);
 if(a<0||b<0||src.indexOf(anchor,b)>=0)throw Error('原卡片修订锚点不唯一：'+anchor);
 return src.slice(0,a)+replacement+src.slice(b);
}
function replace(src,a,b){
 const p=src.indexOf(a);
 if(p<0||src.indexOf(a,p+a.length)>=0)throw Error('原卡片修订锚点异常：'+a.slice(0,90));
 return src.slice(0,p)+b+src.slice(p+a.length);
}
function patch(html){
 const css='<style id="budao-card-six-dim-approved-art">'+
 '.card-stage,.card .side,.card .side>img,.card .side>canvas{border-radius:17px!important}'+
 '.card .side{overflow:hidden!important}'+
 '@media(max-width:540px){.card-stage,.card .side,.card .side>img,.card .side>canvas{border-radius:11px!important}}'+
 '.overlay .window-head .overline,.overlay .panel-k,.confirm .brand-k{display:none!important}'+
 '</style><script src="./six-dim-core.js"></script>';
 html=replace(html,'</head>',css+'</head>');
 html=line(html,'const $=id=>document.getElementById(id);const suits=',
 "const $=id=>document.getElementById(id);const suits=['heart','diamond','club','spade'],ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],numberColors=['red','black'],colors=['black','white'],pieces=['king','queen','rook','bishop','knight','pawn'];");
 html=line(html,'const all=[];for(const s of suits)',
 "const all=[];for(const s of suits)for(const r of ranks)for(const nc of numberColors)for(let d=1;d<=6;d++)for(const c of colors)for(const p of pieces)all.push({suit:s,rank:r,numberColor:nc,dice:d,color:c,side:c,piece:p});");
 html=line(html,'let order=all.map((v,i)=>',
 "if(!window.BudaoSix||all.length!==7488)throw Error('六维生成器未完整载入');const demoPool=Array.from({length:window.BudaoSix.PUBLIC_LIMIT},(_,slot)=>{const v=window.BudaoSix.decode(window.BudaoSix.allottedCode(slot));return {...v,color:v.side}});");
 html=line(html,'function tupleKey(v){',
 "function tupleKey(v){return [v.suit,v.rank,v.numberColor,v.dice,v.side||v.color,v.piece].join(':')}");
 html=line(html,'function unbiased(max){',
 "function unbiased(max){return window.BudaoSix.randomInt(max)}");
 html=line(html,'function readable(v){',
 "function readable(v){return suitNames[v.suit]+'　'+v.rank+'（'+(v.numberColor==='red'?'红字':'黑字')+'）　/　'+diceFaces[v.dice]+'　/　'+((v.side||v.color)==='white'?'白方':'黑方')+' · '+pieceNames[v.piece]}");
 html=replace(html,
 "let value=['active','draw2'].includes(state.phase)?state.final:state.phase==='draw1'?state.first:{suit:'club',rank:'2',dice:4,color:'white',piece:'knight'};",
 "let value=['active','draw2'].includes(state.phase)?state.final:state.phase==='draw1'?state.first:{suit:'club',rank:'2',numberColor:'black',dice:4,color:'white',side:'white',piece:'knight'};");
 // The original DATA.calligraphy, DATA.base, symbols, zones and 325x166 pixelization pipeline stay untouched.
 html=line(html,'async function renderSymbol(v){',[
  'async function renderSymbol(v){',
  ' const i=++renderSeq;',
  " const desired=v.numberColor+'_'+v.rank;",
  " const actual=DATA.assets.rank[desired]?desired:DATA.print_rank_colors[v.suit]+'_'+v.rank;",
  " if(!DATA.assets.rank[actual])throw Error('缺少数字图层：'+desired);",
  " const sel=[['rank',actual],['suit',v.suit],['dice',String(v.dice)],['chess',(v.side||v.color)+'_'+v.piece]];",
  ' const images=await Promise.all([img(DATA.base),...sel.map(([k,x])=>img(DATA.assets[k][x]))]);',
  ' if(i!==renderSeq)return;',
  ' if(desired!==actual){',
  "  const im=images[1],layer=document.createElement('canvas');",
  '  layer.width=im.naturalWidth;layer.height=im.naturalHeight;',
  "  const g=layer.getContext('2d');g.drawImage(im,0,0);",
  "  g.globalCompositeOperation='source-in';g.fillStyle=v.numberColor==='red'?'#d92d36':'#1f2527';",
  '  g.fillRect(0,0,layer.width,layer.height);images[1]=layer;',
  ' }',
  " const raw=document.createElement('canvas');raw.width=650;raw.height=331;",
  " const b=raw.getContext('2d');b.drawImage(images[0],0,0);",
  ' sel.forEach(([k,x],z)=>{const q=DATA.zones[k];b.drawImage(images[z+1],q[0],q[1])});',
  " const low=document.createElement('canvas');low.width=325;low.height=166;",
  " const lc=low.getContext('2d');lc.imageSmoothingEnabled=true;lc.drawImage(raw,0,0,325,166);",
  ' ctx.clearRect(0,0,650,331);ctx.imageSmoothingEnabled=false;ctx.drawImage(low,0,0,650,331);ctx.imageSmoothingEnabled=true;',
  '}'
 ].join('\n'));
 html=line(html,'function setValue(v){',
 "function setValue(v){value={...v,numberColor:v.numberColor||'black',color:v.side||v.color,side:v.side||v.color};renderSymbol(value);$('tupleReadout').textContent=readable(value);$('tupleReadout').classList.toggle('red',value.numberColor==='red');}");
 html=replace(html,
 "setValue({suit:'club',rank:'2',dice:4,color:'white',piece:'knight'});",
 "setValue({suit:'club',rank:'2',numberColor:'black',dice:4,color:'white',side:'white',piece:'knight'});");
 html=replace(html,
 "const save=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}};",
 "const save=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}};if((state.first&&!state.first.numberColor)||(state.final&&!state.final.numberColor)||(state.phase==='active'&&(!state.final||!(state.final.side||state.final.color)))){state={phase:'guest',first:null,final:null,usedSecond:false};save();}");
 html=replace(html,
 "state.phase='active';state.final={...state.first};state.usedSecond=false;save();",
 "state.phase='active';state.final={...state.first};state.seriesId='CSCZ-001';state.usedSecond=false;save();");
 html=replace(html,
 "state.phase='draw2';state.final=second;state.first=null;state.usedSecond=true;",
 "state.phase='draw2';state.final=second;state.seriesId='CSCZ-001';state.first=null;state.usedSecond=true;");
 html=html.replaceAll('五维','六维').replaceAll('3,744','7,488').replaceAll('3,000','7,000').replaceAll('744 位','488 组').replaceAll('4 × 13 × 6 × 2 × 6','4 × 13 × 2 × 6 × 2 × 6');
 html=html.replace('第一阶段计划开放 <strong>7,000</strong> 位，保留 488 组。','第一系列开放 <strong>7,000</strong> 组，保留 <strong>488</strong> 组。');
 // Remove, rather than merely conceal, the English labels from the card interface.
 html=html.replace(/<div class="overline">[^<]*<\/div>/g,'')
          .replace(/<div class="panel-k">[^<]*<\/div>/g,'')
          .replace(/<div class="brand-k">SECOND AND FINAL CHANCE<\/div>/g,'');

 html=html.replace('本样机不会连接真实用户。','本预览不会连接真实用户，也不会占用线上卡池。');
 return html;
}
root.patchOriginalBudaoCard=patch;
})(window);
