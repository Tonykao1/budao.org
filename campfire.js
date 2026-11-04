/* 营火之地：步道照片、真实评论、往期线路回顾。不展示其他事工。 */
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const newElement = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = String(text);
    return el;
  };
  const string = (value, length = 280) => typeof value === "string" ? value.trim().slice(0, length) : "";
  const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isPastOrToday = (date) => isDate(date) && date <= localToday();
  const fallbackQuotes = [
    "如此用心，细致又丰富的预备和带领，我们度过了一个美好又丰盛的徒步之旅！",
    "今天无论是身体还是灵里，都收获满满，感恩弟兄姐妹们的陪伴和分享。",
    "我相信人与人的每一次相遇都是奇迹。"
  ];
  let quoteList = [];
  let quoteCount = 6;
  let gallery = [];
  let coverRecords = [];
  let photoLimit = 18;
  let activeFilter = "all";
  let visiblePhotos = [];
  let lightboxIndex = 0;

  function localToday() {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone:"Asia/Shanghai", year:"numeric", month:"2-digit", day:"2-digit"
      }).formatToParts(new Date());
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return [values.year, values.month, values.day].join("-");
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function safeImage(value) {
    if (typeof value !== "string" || value.length > 500) return "";
    if (/^\/(?:campfire-photos|images|route-assets)\/[a-zA-Z0-9/_\-.]+\.(?:jpg|jpeg|png|webp|avif)$/i.test(value)) return value;
    // Existing site route images are published as GitHub raw URLs.
    if (/^https:\/\/raw\.githubusercontent\.com\/Tonykao1\/budao\.org\/main\/route-assets\/[a-zA-Z0-9/_\-.]+\.(?:jpg|jpeg|png|webp)$/i.test(value)) return value;
    return "";
  }

  function normalizeRoutes(groups) {
    const seen = new Set();
    const rows = [];
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        if (!item || !isPastOrToday(item.date) || item.status === "cancelled" || item.cancelledAt) continue;
        const title = string(item.title, 120);
        if (!title) continue;
        const key = item.date + "|" + title;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          date:item.date, title,
          location:string(item.location || [item.city,item.region].filter(Boolean).join(" · "), 100),
          image:safeImage(item.image),
          alt:string(item.imageAlt, 100)
        });
      }
    }
    rows.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "zh"));
    return rows;
  }

  function normalizeAlbums(albums) {
    if (!Array.isArray(albums)) return [];
    const photos = [];
    const ids = new Set();
    for (const album of albums) {
      // A listed album is not publicly displayed unless its editor has marked it approved.
      if (!album || album.published !== true || !isPastOrToday(album.date) || !Array.isArray(album.photos)) continue;
      const title = string(album.title, 120);
      const location = string(album.location, 100);
      for (const [index, item] of album.photos.entries()) {
        if (!item || item.approved !== true) continue;
        const src = safeImage(item.src);
        const alt = string(item.alt, 150);
        const key = (string(album.id, 80) || album.date + title) + ":" + index;
        if (!src || !alt || ids.has(key)) continue;
        ids.add(key);
        photos.push({id:key,kind:"moment",image:src,alt,title,date:album.date,location,
          caption:string(item.caption, 180) || "步道现场影像"});
      }
    }
    photos.sort((a, b) => b.date.localeCompare(a.date));
    return photos;
  }

  function buildCoverGallery(routes) {
    return routes.filter((route) => route.image).map((route) => ({
      id:"cover:" + route.date + ":" + route.title,
      kind:"cover",
      image:route.image,
      alt:"往期线路封面：" + route.title,
      title:route.title,
      date:route.date,
      location:route.location,
      caption:"往期已发布线路的封面图片，非经核实的活动现场照片。"
    }));
  }

  function kindName(item) { return item.kind === "moment" ? "步道现场" : "线路封面"; }
  function renderHero() {
    const hero = $("#camp-hero-gallery");
    if (!hero) return;
    const source = gallery.slice(0, 3);
    if (!source.length) return;
    const nodes = source.map((item) => {
      const shot = newElement("figure", "camp-hero-shot");
      const img = newElement("img");
      img.src = item.image;
      img.alt = item.alt;
      img.loading = "lazy";
      img.decoding = "async";
      shot.appendChild(img);
      shot.appendChild(newElement("figcaption", "", kindName(item) + " · " + item.title));
      return shot;
    });
    hero.replaceChildren(...nodes);
  }

  function filteredPhotos() {
    return gallery.filter((item) => activeFilter === "all" || activeFilter === item.kind);
  }

  function renderGallery() {
    const root = $("#camp-photo-grid");
    if (!root) return;
    const photos = filteredPhotos();
    visiblePhotos = photos;
    if (!photos.length) {
      const message = activeFilter === "moment"
        ? "尚未收入经确认授权的步道现场照片。可先查看往期线路封面，真实的活动相册将逐次补入。"
        : "目前没有可公开展示的这一类影像。";
      root.replaceChildren(newElement("p", "camp-empty", message));
    } else {
      const nodes = photos.slice(0, photoLimit).map((item, index) => {
        const button = newElement("button", "camp-photo-card");
        button.type = "button";
        button.setAttribute("aria-label", "放大查看：" + item.title + "，" + kindName(item));
        const wrapper = newElement("div", "camp-photo-visual");
        const image = newElement("img");
        image.src = item.image;
        image.alt = item.alt;
        image.loading = "lazy";
        image.decoding = "async";
        wrapper.appendChild(image);
        wrapper.appendChild(newElement("span", "camp-photo-kind", kindName(item)));
        const caption = newElement("div", "camp-photo-caption");
        caption.appendChild(newElement("span", "camp-photo-date", item.date.replace(/-/g, ".") + " · " + kindName(item)));
        caption.appendChild(newElement("span", "camp-photo-title", item.title));
        if (item.location) caption.appendChild(newElement("span", "camp-photo-location", item.location));
        button.append(wrapper, caption);
        button.addEventListener("click", () => openLightbox(index));
        return button;
      });
      root.replaceChildren(...nodes);
    }
    const more = $("#camp-photos-more");
    if (more) more.hidden = photoLimit >= photos.length;
  }

  function setGalleryFilter(kind) {
    activeFilter = kind;
    photoLimit = 18;
    document.querySelectorAll("[data-filter]").forEach((button) => {
      const selected = button.dataset.filter === kind;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderGallery();
  }

  function openLightbox(index) {
    const dialog = $("#camp-lightbox");
    if (!dialog || typeof dialog.showModal !== "function" || !visiblePhotos[index]) return;
    lightboxIndex = index;
    updateLightbox();
    if (!dialog.open) dialog.showModal();
  }
  function updateLightbox() {
    const item = visiblePhotos[lightboxIndex];
    if (!item) return;
    const image = $("#camp-lightbox-image");
    if (image) {
      image.src = item.image;
      image.alt = item.alt;
    }
    $("#camp-lightbox-name").textContent = item.title + " · " + kindName(item);
    $("#camp-lightbox-caption").textContent = item.date + (item.location ? " · " + item.location : "") + "｜" + item.caption;
    $("#camp-lightbox-prev").hidden = visiblePhotos.length < 2;
    $("#camp-lightbox-next").hidden = visiblePhotos.length < 2;
  }
  function shiftLightbox(delta) {
    if (!visiblePhotos.length) return;
    lightboxIndex = (lightboxIndex + delta + visiblePhotos.length) % visiblePhotos.length;
    updateLightbox();
  }

  function renderQuotes() {
    const root = $("#camp-voices-grid");
    if (!root) return;
    const nodes = quoteList.slice(0, quoteCount).map((quote) => {
      const card = newElement("article", "camp-voice-card");
      card.appendChild(newElement("span", "camp-voice-mark", "“"));
      card.appendChild(newElement("blockquote", "", quote));
      card.appendChild(newElement("span", "camp-voice-foot", "一次同行之后"));
      return card;
    });
    root.replaceChildren(...nodes);
    $("#camp-voices-more").hidden = quoteCount >= quoteList.length;
    $("#camp-voices-reset").hidden = quoteCount <= 6;
  }

  function renderHistory() {
    const root = $("#camp-history-grid");
    if (!root) return;
    if (!coverRecords.length) {
      root.replaceChildren(newElement("p", "camp-empty", "往期线路资料暂不可用。欢迎先翻阅上方留言。"));
      return;
    }
    const nodes = coverRecords.slice(0, 8).map((route) => {
      const card = newElement("article", "camp-history-item");
      if (route.image) {
        const image = newElement("img", "camp-history-thumb");
        image.src = route.image;
        image.alt = "线路封面：" + route.title;
        image.loading = "lazy";
        image.decoding = "async";
        card.appendChild(image);
      }
      const detail = newElement("div", "camp-history-detail");
      detail.appendChild(newElement("span", "camp-history-date", route.date + " · 线路资料"));
      detail.appendChild(newElement("h3", "", route.title));
      detail.appendChild(newElement("p", "", route.location || "步道"));
      card.appendChild(detail);
      return card;
    });
    root.replaceChildren(...nodes);
  }

  function normalizeQuotes(data) {
    const original = Array.isArray(data.quotes) ? data.quotes.filter((q) => typeof q === "string" && q.trim()).map((q) => q.trim().slice(0, 500)) : [];
    if (!original.length) return fallbackQuotes;
    const selected = Array.isArray(data.featuredQuoteIndexes) ? data.featuredQuoteIndexes : [];
    const indexes = selected.filter((i) => Number.isInteger(i) && i >= 0 && i < original.length);
    const order = [...new Set([...indexes, ...original.map((_, i) => i)])];
    return order.map((index) => original[index]);
  }

  async function loadArchive() {
    try {
      const response = await fetch("/data/campfire-archive.json", {cache:"no-store"});
      if (!response.ok) throw new Error("Campfire archive HTTP " + response.status);
      const data = await response.json();
      if (!data || data.version !== 2) throw new Error("Unsupported trail archive");
      quoteList = normalizeQuotes(data);
      // Actual photos must be explicitly approved, not inferred from calendar covers.
      gallery = normalizeAlbums(data.albums);
    } catch (error) {
      console.warn("Campfire editorial archive unavailable.", error);
      quoteList = fallbackQuotes;
      gallery = [];
    }
    renderQuotes();
  }

  async function loadRoutes() {
    const sources = ["/routes.json", "/route-history.json"];
    const responses = await Promise.allSettled(sources.map(async (url) => {
      const response = await fetch(url, {cache:"no-store"});
      if (!response.ok) throw new Error("Trail archive HTTP " + response.status);
      const data = await response.json();
      return Array.isArray(data) ? data : Array.isArray(data.routes) ? data.routes : [];
    }));
    const groups = responses.map((result) => result.status === "fulfilled" ? result.value : []);
    coverRecords = normalizeRoutes(groups);
    gallery.push(...buildCoverGallery(coverRecords));
    renderHero();
    renderGallery();
    renderHistory();
  }

  async function sharePage() {
    const url = "https://budao.org/yhzd.html";
    const status = $("#camp-share-status");
    if (status) status.textContent = "";
    if (navigator.share) {
      try {
        await navigator.share({title:"营火之地 · 步道",text:"一张照片，一句留言，记住我们走过的路。",url});
        if (status) status.textContent = "谢谢你把这段同行记忆分享出去。";
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      if (status) status.textContent = "链接已复制，可以分享给朋友。";
    } catch {
      window.prompt("复制营火之地的链接：", url);
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => setGalleryFilter(button.dataset.filter));
    });
    $("#camp-photos-more")?.addEventListener("click", () => {
      photoLimit += 9;
      renderGallery();
    });
    $("#camp-voices-more")?.addEventListener("click", () => {
      quoteCount += 6;
      renderQuotes();
    });
    $("#camp-voices-reset")?.addEventListener("click", () => {
      quoteCount = 6;
      renderQuotes();
      $("#camp-voices")?.scrollIntoView({block:"start",behavior:"smooth"});
    });
    $("#camp-share")?.addEventListener("click", sharePage);
    $("#camp-lightbox-close")?.addEventListener("click", () => $("#camp-lightbox").close());
    $("#camp-lightbox-prev")?.addEventListener("click", () => shiftLightbox(-1));
    $("#camp-lightbox-next")?.addEventListener("click", () => shiftLightbox(1));
    const dialog = $("#camp-lightbox");
    dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); shiftLightbox(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); shiftLightbox(1); }
    });
  }

  bindEvents();
  // Load approved photos/comments first, then join the published route-cover archive.
  loadArchive().then(loadRoutes);
})();
