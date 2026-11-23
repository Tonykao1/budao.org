(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PastureSheepI18n=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const dictionaries={
  'zh-CN':{
    next:'下一步',back:'返回',confirm:'确认',random:'随机看看',preview:'你的羊预览',
    woolColor:'羊毛颜色',faceColor:'脸部颜色',woolShape:'羊毛轮廓',bodyShape:'身形',ears:'耳朵',expression:'表情',marking:'记号',forelock:'额前毛',
    cloudWhite:'云白',ivory:'米白',cream:'奶油',wheat:'麦色',lightGray:'浅灰',silverGray:'银灰',warmGray:'暖灰',lightBrown:'淡褐',charcoal:'炭色',black:'黑色',
    sand:'沙色',wheatBrown:'麦褐',warmTaupe:'暖褐灰',ashGray:'灰褐',slate:'石灰',deepBrown:'深褐',
    clean:'整齐',soft:'柔和',fluffy:'蓬松',curly:'卷曲',small:'小巧',standard:'标准',round:'圆润',tall:'修长',medium:'中等',droop:'垂耳',perk:'翘耳',calm:'安静',gentleSmile:'微笑',curious:'好奇',joyful:'喜乐',none:'无',forehead:'额头',cheek:'脸颊',facePatch:'脸斑',backPatch:'背斑',socks:'浅腿',earMark:'耳记',tuft:'小簇',curl:'卷毛',side:'侧毛',cloud:'云毛'
  },
  en:{
    next:'Next',back:'Back',confirm:'Confirm',random:'Surprise me',preview:'Your sheep preview',
    woolColor:'Wool color',faceColor:'Face color',woolShape:'Wool shape',bodyShape:'Body shape',ears:'Ears',expression:'Expression',marking:'Marking',forelock:'Forelock',
    cloudWhite:'Cloud white',ivory:'Ivory',cream:'Cream',wheat:'Wheat',lightGray:'Light gray',silverGray:'Silver gray',warmGray:'Warm gray',lightBrown:'Light brown',charcoal:'Charcoal',black:'Black',
    sand:'Sand',wheatBrown:'Wheat brown',warmTaupe:'Warm taupe',ashGray:'Ash gray',slate:'Slate',deepBrown:'Deep brown',
    clean:'Clean',soft:'Soft',fluffy:'Fluffy',curly:'Curly',small:'Small',standard:'Standard',round:'Round',tall:'Tall',medium:'Medium',droop:'Droop',perk:'Perk',calm:'Calm',gentleSmile:'Gentle smile',curious:'Curious',joyful:'Joyful',none:'None',forehead:'Forehead',cheek:'Cheek',facePatch:'Face patch',backPatch:'Back patch',socks:'Light legs',earMark:'Ear mark',tuft:'Tuft',curl:'Curl',side:'Side',cloud:'Cloud'
  }
};
function locale(value){const v=String(value||'').toLowerCase();return v.startsWith('zh')?'zh-CN':'en'}
function t(key,lang){const l=locale(lang||(typeof navigator!=='undefined'?navigator.language:'en'));return dictionaries[l][key]||dictionaries.en[key]||key}
return Object.freeze({dictionaries,locale,t});
});
