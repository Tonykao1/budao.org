/* BUDAO · 星火同行 / Sparks to Steps
   Shared memories are the moderation-approved public comments for an album.
   Private footprints are saved only after the visitor chooses to save them,
   inside the current browser. No identity, IP or geolocation collection. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STORE = "budao.sparks-to-steps.footprints.v1";
  const PHOTO = /^\/campfire-photos\/[a-zA-Z0-9/_\-.]+\.(?:jpe?g|png|webp|avif)$/i;
  const MAX_SAVED = 100;
  let current = null;
  let memoryLoading = 0;
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const valid = (item) => item && item.kind === "moment" &&
    PHOTO.test(item.image) && /^[a-zA-Z0-9_-]{2,80}$/.test(item.albumId || "");

  function readSaved() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORE) || "[]");
      if (!Array.isArray(raw)) return [];
      const seen = new Set();
      return raw.filter((record) => {
        if (!record || typeof record.src !== "string" || !PHOTO.test(record.src) ||
            seen.has(record.src)) return false;
        seen.add(record.src);
        return true;
      }).slice(0, MAX_SAVED).map((record) => ({
        src: record.src,
        title: String(record.title || "沿途记忆").slice(0, 120),
        date: /^\d{4}-\d{2}-\d{2}$/.test(record.date || "") ? record.date : "",
        alt: String(record.alt || "步道现场照片").slice(0, 150)
      }));
    } catch { return []; }
  }
  function writeSaved(rows) {
    try { window.localStorage.setItem(STORE, JSON.stringify(rows.slice(0, MAX_SAVED))); return true; }
    catch { return false; }
  }
  function permalink(item) {
    const url = new URL("/yhzd.html", window.location.origin);
    url.searchParams.set("photo", item.image);
    return url.toString();
  }
  function isSaved(item) { return readSaved().some((x) => x.src === item.image); }
  function updateSaveButton() {
    const button = $("camp-save-footprint");
    if (!button || !valid(current)) return;
    const saved = isSaved(current);
    button.textContent = saved ? "✓ 已收入我的足迹 · 点此移除" : "⌁ 收入我的足迹";
    button.setAttribute("aria-pressed", String(saved));
  }
  function status(message) {
    const node = $("camp-footprints-status");
    if (node) node.textContent = message || "";
  }
  function changeSaved() {
    if (!valid(current)) return;
    const existing = readSaved();
    const found = existing.some((record) => record.src === current.image);
    const result = found
      ? existing.filter((record) => record.src !== current.image)
      : [{ src:current.image, title:current.title, date:current.date, alt:current.alt }, ...existing];
    if (writeSaved(result)) {
      updateSaveButton();
      renderSaved();
      status(found ? "已从本机足迹中移除。" : "已保存在本设备，不会自动上传或同步。");
    } else status("本设备禁止本地保存，请检查浏览器的隐私设置。");
  }
  function renderSaved() {
    const root = $("camp-footprints-list");
    if (!root) return;
    root.replaceChildren();
    const saved = readSaved();
    if (!saved.length) {
      root.append(el("p", "camp-footprints-empty", "这里还是空白。打开一张喜欢的现场照片，选择「收入我的足迹」，就能开始自己的回忆册。"));
      return;
    }
    for (const item of saved) {
      const card = el("article", "camp-footprint-card");
      const img = el("img", "camp-footprint-photo");
      // The saved local path is whitelisted and points to the watermarked
      // display copy, not to an original master.
      img.src = item.src.replace(/^\/campfire-photos\//,"/campfire-watermarked/")
        .replace(/\.(jpe?g|png|webp|avif)$/i, ".webp");
      img.loading = "lazy";
      img.alt = item.alt;
      const body = el("div", "camp-footprint-copy");
      body.append(el("time", "", item.date), el("h4", "", item.title));
      const link = el("a", "camp-footprint-link", "再看这一刻 ↗");
      link.href = permalink({image:item.src});
      body.append(link);
      const remove = el("button", "camp-footprint-remove", "移除");
      remove.type = "button";
      remove.addEventListener("click", () => {
        const remaining = readSaved().filter((record) => record.src !== item.src);
        if (writeSaved(remaining)) {
          renderSaved(); updateSaveButton(); status("已从本设备移除。");
        } else status("操作失败，本设备无法写入收藏。");
      });
      card.append(img,body,remove);
      root.append(card);
    }
  }
  async function shareMemory() {
    if (!valid(current)) return;
    const item = current;
    const url = permalink(item);
    const title = "步道 · " + item.title + " · 那一天";
    try {
      if (navigator.share) {
        await navigator.share({title,text:"这段真实同行的记忆，愿与你分享。",url});
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareStatus("照片专属链接已复制，可以发送给同行的人。");
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
    window.prompt("复制这张照片的专属链接：", url);
  }
  function setShareStatus(message) {
    const e = $("camp-s2s-status");
    if (e) e.textContent = message;
  }

  function renderMemoryCard(record) {
    const card = el("article", "camp-album-memory");
    const top = el("div", "camp-album-memory-meta");
    top.append(el("strong", "", record.name));
    if (record.official) top.append(el("span", "camp-official", "步道回应"));
    const when = new Date(record.createdAt);
    if (Number.isFinite(when.getTime()))
      top.append(el("time", "", when.toLocaleDateString("zh-CN")));
    const text = el("p", "", record.body);
    const photoLink = el("a", "", "回到这一张 ↗");
    photoLink.href = permalink({image:record.photoId});
    photoLink.addEventListener("click", (event) => {
      // Reuse the same permalink so the correct approved photo opens.
      if (record.photoId === current?.image) { event.preventDefault(); $("camp-album-memories").hidden = true; }
    });
    card.append(top,text,photoLink);
    return card;
  }
  async function showAlbumMemories(force) {
    const panel = $("camp-album-memories");
    const toggle = $("camp-view-memories");
    if (!valid(current)) return;
    if (!force && !panel.hidden) {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      return;
    }
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    const list = $("camp-album-memories-list");
    list.replaceChildren(el("p", "camp-thread-empty", "正在翻开这一天的共同记忆……"));
    const albumId = current.albumId;
    const requestId = ++memoryLoading;
    try {
      const response = await fetch("/api/campfire?view=memories&albumId="+encodeURIComponent(albumId),
        {cache:"no-store", credentials:"same-origin"});
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error("service");
      if (requestId !== memoryLoading || current?.albumId !== albumId) return;
      list.replaceChildren();
      const memories = Array.isArray(data.memories) ? data.memories : [];
      if (!memories.length) {
        list.append(el("p", "camp-thread-empty", "这一天还没有审核公开的同行回忆。记忆可以从第一句真实的分享开始。"));
      } else {
        memories.forEach((memory) => {
          if (PHOTO.test(memory.photoId || "")) list.append(renderMemoryCard(memory));
        });
      }
    } catch {
      if (requestId === memoryLoading) list.replaceChildren(el("p", "camp-thread-empty", "共同记忆暂时无法读取，请稍后再试。"));
    }
  }

  function displayPhoto(item) {
    ++memoryLoading;
    current = valid(item) ? item : null;
    const panel = $("camp-album-memories");
    if (panel) panel.hidden = true;
    const toggle = $("camp-view-memories");
    if (toggle) toggle.setAttribute("aria-expanded","false");
    if (!current) return;
    updateSaveButton();
    // Clicking this link opens the mail application; it does not secretly
    // transmit visitor data or create a hidden identity record.
    const subject = "步道 · 共写记忆 · " + current.title;
    const message = "您好，\n\n我愿意为这张现场照片补充一段真实记忆。\n照片：" + permalink(current) +
      "\n\n我想分享的是：\n\n\n（发送前，请确认文字与照片的授权范围。）";
    const email = $("camp-invite-story");
    if (email) email.href = "mailto:hello@budao.org?subject="+encodeURIComponent(subject)+
      "&body="+encodeURIComponent(message);
    const again = $("camp-walk-again-link");
    if (again) again.href = "/test.html";
    setShareStatus("");
  }

  function mount() {
    document.addEventListener("campfire:photo-open", (event) => displayPhoto(event.detail.item));
    $("camp-share-memory")?.addEventListener("click", shareMemory);
    $("camp-save-footprint")?.addEventListener("click", changeSaved);
    $("camp-view-memories")?.addEventListener("click", () => showAlbumMemories(false));
    $("camp-footprints-toggle")?.addEventListener("click", () => {
      const panel = $("camp-footprints-panel");
      const button = $("camp-footprints-toggle");
      panel.hidden = !panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) renderSaved();
    });
    $("camp-footprints-clear")?.addEventListener("click", () => {
      if (!window.confirm("要清空这台设备上保存的全部私人足迹吗？此操作无法恢复。")) return;
      if (writeSaved([])) { renderSaved(); updateSaveButton(); status("已清空本设备的足迹。"); }
      else status("无法清空，本设备禁止本地存储。");
    });
    renderSaved();
  }
  mount();
})();