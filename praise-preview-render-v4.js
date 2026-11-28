/* Shared depth-sorted pixel flock renderer, both preview orientations. */
(function(root){
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)))}
function draw(c,o,p){
 const s=p.s,adult=!o.lamb,st=p.stand??(o.rest?0:1),body=adult?24:16,leg=adult?8:6,head=p.head||0,sway=p.sway||0,step=p.step||0;
 const f=o.f||(o.style==='blackwhite'?'#eeeae2':adult?'#f3ead7':'#f6ead7'),h=o.h||(o.style==='blackwhite'?'#302d2a':adult?'#887e6e':'#b98f79');
 const gy=p.gy,gx=p.gx,sh=adult?28:21;
 rect(c,gx-sh*s*.5,gy-1,sh*s,Math.max(1,s*2),'rgba(56,93,54,.16)');
 c.save();c.translate(Math.round(gx),Math.round(gy));c.scale(p.flip?-1:1,1);
 const x=-(adult?15:10.5)*s,y=-(adult?20:14)*s+(1-st)*(adult?5:3)*s;
 const b=(adult?12:8)*s,k=(adult?4:3)*s,d=sway*s;
 const wool=(xx,yy,w,hh)=>rect(c,x+xx*s+d,y+yy*s,w*s,hh*s,f);
 wool(0,0,body,adult?12:8);wool(adult?4:3,adult?-5:-4,adult?17:11,adult?19:13);wool(adult?8:6,adult?-8:-6,adult?10:7,adult?22:15);
 if(o.style==='blackwhite'){rect(c,x+3*s+d,y-2*s,5*s,5*s,'#4a4642');rect(c,x+9*s+d,y+2*s,5*s,4*s,'#4a4642')}
 let hy=y+(adult?2:2)*s-head*s;
 rect(c,x+(adult?19:13)*s+d,hy,(adult?10:7)*s,(adult?10:7)*s,h);
 rect(c,x+(adult?27:19)*s+d,hy+2*s,(adult?3:2)*s,(adult?4:3)*s,h);
 rect(c,x+(adult?17:12)*s+d,hy+1*s,(adult?3:2)*s,(adult?3:2)*s,h);
 rect(c,x+(adult?24:17)*s+d,hy+2*s,Math.max(1,s*1.3),Math.max(1,s*1.3),'#564d47');
 const legTop=y+b,lh=Math.max(1,leg*s*st),lx1=x+(adult?5:4)*s,lx2=x+(adult?16:11)*s;
 rect(c,lx1,legTop,Math.max(1,(adult?3:2)*s),lh-Math.max(0,step)*s*1.5*st,'#5d5851');
 rect(c,lx2,legTop,Math.max(1,(adult?3:2)*s),lh-Math.max(0,-step)*s*1.5*st,'#5d5851');
 if(st<.4){rect(c,lx1,Math.min(-1,legTop+lh),Math.max(2,6*s),Math.max(1,2*s),'#5d5851');rect(c,lx2,Math.min(-1,legTop+lh),Math.max(2,5*s),Math.max(1,2*s),'#5d5851')}
 c.restore();
}
function drawFlock(ctx,layout,W,H,mode,getMotion){
 const creatures=layout.map(o=>{const m=getMotion?.(o.x/W,o.y/H,o.id,!!o.rest,o.s,mode);const p=m||{gx:o.x+(o.lamb?10.5:15)*o.s,gy:o.y+(o.lamb?(o.rest?11:14):(o.rest?15:20))*o.s,s:o.s,stand:o.rest?0:1,flip:o.flip,head:0,step:0,sway:0};return {o,p}});
 creatures.sort((a,b)=>a.p.gy-b.p.gy||a.p.gx-b.p.gx||a.o.id-b.o.id);
 creatures.forEach(({o,p})=>draw(ctx,o,p));
 return creatures.length;
}
root.BudaoPreviewRender=Object.freeze({drawFlock,draw});
})(window);