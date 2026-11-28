"use strict";
const api = "/api/tent-media";
const statusText = document.querySelector("#status");
const labels = {draft:"草稿",submitted:"待审核",approved:"审核通过",published:"已发布",withdrawn:"已撤回"};
function element(tag,text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
async function request(body) {
  const response = await fetch(api,body ? {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)} : {cache:"no-store"});
  const data = await response.json();
  if (!response.ok) throw Error(({unauthorized:"请先登录帐篷。",revision_conflict:"相册已有更新，请核对后重试。",duplicate_photo:"相册中已有这张照片。",media_unconfigured:"媒体数据库尚未配置。",invalid_image:"请使用不超过 2 MiB 的单帧 JPG、PNG 或 WebP 照片。",photo_quota:"每本相册最多 24 张。"}[data.reason]) || data.reason || "请求失败");
  return data;
}
let busy = false;
async function change(body,form) {
  if (busy) return;
  busy = true;
  statusText.textContent = "正在保存…";
  try {
    await request(body);
    form?.reset();
    await load();
    statusText.textContent = "已保存";
  } catch (error) {
    statusText.textContent = error.message;
    await load().catch(()=>{});
  } finally { busy = false; }
}
async function load() {
  const {albums,steward} = await request();
  document.querySelector("main").hidden = false;
  const root = document.querySelector("#albums");
  root.replaceChildren();
  for (const album of albums) {
    const box = element("section","");
    root.append(box);
    box.append(element("h2",album.title),element("p",[album.date,album.location,labels[album.state]].join(" · ")));
    function button(parent,text,action,extra={}) {
      const btn = element("button",text);
      btn.onclick = () => {
        if (["withdraw","remove","publish"].includes(action) && !confirm("确认"+text+"？")) return;
        change({album:album.id,revision:album.revision,action,...extra});
      };
      parent.append(btn);
    }
    for (const photo of album.photos) {
      const row = element("article","");
      const img = document.createElement("img");
      img.src = api+"?preview="+photo.id;
      img.alt = photo.alt;
      img.loading = "lazy";
      row.append(img,element("span",photo.alt));
      if (album.mine && album.state==="draft") button(row,"移除照片","remove",{asset:photo.id});
      if (steward && album.state==="submitted") button(row,photo.approved?"取消照片批准":"批准照片","review",{asset:photo.id,approved:!photo.approved});
      box.append(row);
    }
    if (album.mine && album.state==="draft") {
      const form = document.querySelector("#upload").content.firstElementChild.cloneNode(true);
      form.onsubmit = async event => {
        event.preventDefault();
        try {
          const file = form.elements.photo.files[0];
          if (file.size > 2097152) throw Error("照片超过 2 MiB");
          const bytes = new Uint8Array(await file.arrayBuffer());
          const hash = new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
          const parts = [];
          for(let i=0;i<bytes.length;i+=8192) parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
          await change({action:"upload",album:album.id,revision:album.revision,alt:form.elements.alt.value,consent:true,data:btoa(parts.join("")),sha256:Array.from(hash,b=>b.toString(16).padStart(2,"0")).join("")},form);
        } catch (error) { statusText.textContent = error.message; }
      };
      box.append(form);
      if (album.photos.length) button(box,"提交审核","submit");
    }
    if (steward && album.state==="submitted") {
      button(box,"退回修改","return");
      if (album.photos.length && album.photos.every(p=>p.approved)) button(box,"批准相册","approve");
    }
    if (steward && album.state==="approved") button(box,"发布到营火之地","publish");
    if (steward && ["approved","submitted","published"].includes(album.state)) button(box,"撤回相册","withdraw");
  }
}
document.querySelector("#create").onsubmit = event => {
  event.preventDefault();
  change({action:"create",...Object.fromEntries(new FormData(event.target))},event.target);
};
load().catch(error => { statusText.textContent = error.message; });
