/* Approved BUDAO six-dimensional pixel card artwork transformer, unchanged from reviewed Preview. */
(()=>{'use strict';
function upgradeApprovedCard(original){
 let h=original;
 const change=(from,to,label)=>{if(!h.includes(from))throw new Error('原卡局部修复缺少锚点：'+label);h=h.replace(from,to)};
 change('</style>','.card,.side,.side img,.side canvas{border-radius:16px!important}.side{overflow:hidden!important}.side img,.side canvas{border-radius:14px!important}.card-owner-info{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:12px 0;font:800 12px/1.5 "PingFang SC",sans-serif}.card-owner-info>div{padding:8px;border:1px solid #d3c3a1;background:#f8eed5;min-width:0}.card-owner-info span{display:block;color:#796c53;font-size:11px;margin-bottom:3px}.card-owner-info strong{display:block;color:#304e3a;font-size:13px;overflow-wrap:anywhere}</style>','数字卡圆角');
 // The core is loaded inside the ORIGINAL card's srcdoc, before the legacy draw script runs.
 change('</head>','<script src="/pasture-preview/six-dim-core.js"><'+'/script></head>','六维模块');
 change("const $=id=>document.getElementById(id);const suits=", "const six=window.BudaoSix;if(!six||six.CAPACITY!==7488||six.PUBLIC_LIMIT!==7000)throw Error('六维生成器未就绪');const $=id=>document.getElementById(id);const suits=", '六维初始化');
 change("if(saved&&['guest','verified','draw1','draw2','active'].includes(saved.phase))state=saved;", "if(saved&&['guest','verified','draw1','draw2','active'].includes(saved.phase)){if((saved.first&&!saved.first.numberColor)||(saved.final&&!saved.final.numberColor)||(saved.phase==='active'&&!saved.final)){state={phase:'guest',first:null,final:null,usedSecond:false,seriesId:six.SERIES.id};try{localStorage.setItem(STORAGE,JSON.stringify(state))}catch(e){}}else state=saved;}",'旧五维样机状态转换');
 h=h.replace(/const all=\[\];for\(const s of suits\)[\s\S]*?const demoPool=order\.slice\(0,3000\)\.map\(x=>x\.v\);/,
   "const all=Array.from({length:six.PUBLIC_LIMIT},(_,slot)=>{const v=six.decode(six.allottedCode(slot));return {...v,color:v.side}});const demoPool=all;");
 if(!h.includes('const demoPool=all;'))throw Error('旧五维卡池替换未通过');
 change("return [v.suit,v.rank,v.dice,v.color,v.piece].join(':')", "return [six.SERIES.id,v.suit,v.rank,v.numberColor,v.dice,v.side,v.piece].join(':')",'六维唯一键');
 change("return Math.floor(Math.random()*max)", "return six.randomInt(max)",'安全随机源');
 change("${v.rank}　/　${diceFaces[v.dice]}　/　${v.color==='white'?'白':'黑'}", "${v.rank}（${v.numberColor==='red'?'红字':'黑字'}）　/　${diceFaces[v.dice]}　/　${v.side==='white'?'白':'黑'}",'六维身份显示');
 change("DATA.print_rank_colors[v.suit]+'_'+v.rank", "v.numberColor+'_'+v.rank",'牌值颜色与花色脱钩');
 change("let sel=[['rank',v.numberColor+'_'+v.rank],['suit',v.suit],['dice',String(v.dice)],['chess',v.color+'_'+v.piece]];let images=await Promise.all([img(DATA.base),...sel.map(([k,x])=>img(DATA.assets[k][x]))]);","const desired=v.numberColor+'_'+v.rank;const sourceRank=DATA.assets.rank[desired]?desired:DATA.print_rank_colors[v.suit]+'_'+v.rank;let sel=[['rank',sourceRank],['suit',v.suit],['dice',String(v.dice)],['chess',v.color+'_'+v.piece]];let images=await Promise.all([img(DATA.base),...sel.map(([k,x])=>img(DATA.assets[k][x]))]);if(desired!==sourceRank){const im=images[1],layer=document.createElement('canvas');layer.width=im.naturalWidth;layer.height=im.naturalHeight;const g=layer.getContext('2d');g.drawImage(im,0,0);g.globalCompositeOperation='source-in';g.fillStyle=v.numberColor==='red'?'#d92d36':'#1f2527';g.fillRect(0,0,layer.width,layer.height);images[1]=layer;}",'缺少印刷样本颜色时仅给数字图层补色');
 change("$('tupleReadout').classList.toggle('red',['heart','diamond'].includes(value.suit))", "$('tupleReadout').classList.toggle('red',value.numberColor==='red')",'身份显示颜色');
 if(!h.includes("{suit:'club',rank:'2',dice:4,color:'white',piece:'knight'}"))throw Error('原卡默认值锚点缺失');
 h=h.replaceAll("{suit:'club',rank:'2',dice:4,color:'white',piece:'knight'}", "{suit:'club',rank:'2',numberColor:'black',dice:4,color:'white',side:'white',piece:'knight'}");
 h=h.replaceAll("state={phase:'verified',first:null,final:null,usedSecond:false}", "state={phase:'verified',seriesId:six.SERIES.id,first:null,final:null,usedSecond:false}");
 // The example card remains visual reference only. Never restrict suits/number inks using its sample pairing.
 // Preserve the existing approved card while naming both flip directions consistently.
 change("flipped?'↺ 翻回书法面':'↻ 翻转卡片'","flipped?'↺ 翻面':'↻ 翻面'",'翻面按钮文字');
 change("<h3>这张卡，属于你。</h3><div class=\"active-block\">","<h3>持卡人基本资料</h3><div class=\"card-owner-info\"><div><span>持卡人</span><strong id=\"cardHolderName\">${parent.getPastureHolderName?.()||\"同行者\"}</strong></div><div><span>所属系列</span><strong>创始成终</strong></div><div style=\"grid-column:1/-1\"><span>六维卡组</span><strong>${readable(state.final)}</strong></div><div><span>确认状态</span><strong>已确认 · 本机预览</strong></div><div><span>确认日期</span><strong>${state.confirmedAt?new Date(state.confirmedAt).toLocaleDateString(\"zh-CN\"):\"未记录\"}</strong></div></div><div class=\"active-block\">",'确认后显示基础资料');
 change("state.phase='active';state.final={...state.first};state.usedSecond=false;save();","state.phase='active';state.final={...state.first};state.usedSecond=false;state.confirmedAt=Date.now();save();",'首次确认记录日期');
 change("state.phase='active';save();setValue(state.final);setPanel();refreshNav();","state.phase='active';state.confirmedAt=Date.now();save();setValue(state.final);setPanel();refreshNav();",'第二次自动确认记录日期');
 h=h.replaceAll('五维','六维').replaceAll('3,744','7,488').replaceAll('3,000','7,000').replaceAll('744 位','488 位');
 h=h.replace('4 × 13 × 6 × 2 × 6 =','4 × 13 × 2 × 6 × 2 × 6 =');
 h=h.replaceAll('DIGITAL PASTURE · BUDĀO CARD / 01','数字牧场 · 步道卡')
 .replaceAll('SECOND AND FINAL CHANCE','第二次 · 最后一次机会')
 .replaceAll('IDENTITY ACCESS / NOT ACTIVATED','身份尚未激活')
 .replaceAll('IDENTITY ACCESS / CODE VERIFIED','密钥已验证')
 .replaceAll('FIRST DRAW / MAKE YOUR CHOICE','第一次抽取 · 请选择')
 .replaceAll('SECOND DRAW / FINAL CARD','第二次抽取 · 自动确认')
 .replaceAll('OFFICIAL CARD / ACTIVATED','步道卡 · 已激活')
 .replaceAll('FIRST LAYER · DEMO','第一层 · 演示')
 .replaceAll('ACTIVATED · 7 / 7','已激活 · 七项功能');
 return h;
}
window.PastureApprovedSixCard=Object.freeze({upgradeApprovedCard});
})();
