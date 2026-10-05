(function(root){
  function hash(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rand(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function scaleAtY(y,kind='adult'){
    const t=Math.max(0,Math.min(1,(y-160)/126));
    const adult=.32+t*.84;
    return kind==='lamb'?adult*.56:adult;
  }
  function box(o,kind='adult'){
    const dims=kind==='lamb'?[21,20]:[33,27];
    return{l:o.x-3*o.s,r:o.x+dims[0]*o.s,t:o.y-9*o.s,b:o.y+dims[1]*o.s};
  }
  function overlap(a,b,p=4){return!(a.r+p<b.l||a.l-p>b.r||a.b+p<b.t||a.t-p>b.b)}
  function riverConflict(o,kind='adult'){
    const b=box(o,kind),y=o.y;if(y<145)return false;
    let l=340,r=390;if(y>=190&&y<232){l=336;r=410}else if(y>=232){l=344;r=416}
    return b.r>l&&b.l<r;
  }
  function forbidden(o,kind='adult'){
    const b=box(o,kind);
    if(riverConflict(o,kind))return true;
    if(b.r>414&&b.l<448&&b.b>184&&b.t<220)return true;
    return false;
  }
  function place({key,count,kind='adult',occupied=[],styles=[]}){
    const r=rand(hash('budao-free-'+kind+'-'+key));
    const out=[];
    for(let i=0;i<count;i++){
      let chosen=null;
      for(let t=0;t<180;t++){
        const y=160+r()*126,s=scaleAtY(y,kind),x=12+r()*444;
        const cand={x,y,s,flip:r()<.5,style:styles[i]||'normal'},b=box(cand,kind);
        if(forbidden(cand,kind))continue;
        if(occupied.some(q=>overlap(b,q,kind==='lamb'?3:4)))continue;
        chosen=cand;occupied.push(b);break;
      }
      if(!chosen){
        for(let y=162;y<=284&&!chosen;y+=5)for(let x=14;x<=456&&!chosen;x+=9){
          const cand={x,y,s:scaleAtY(y,kind),flip:r()<.5,style:styles[i]||'normal'},b=box(cand,kind);
          if(!forbidden(cand,kind)&&!occupied.some(q=>overlap(b,q,2))){chosen=cand;occupied.push(b)}
        }
      }
      if(chosen)out.push(chosen);
    }
    return out;
  }
  const api={hash,rand,scaleAtY,box,overlap,riverConflict,forbidden,place};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.BudaoFlockLayout=api;
})(typeof window!=='undefined'?window:globalThis);
