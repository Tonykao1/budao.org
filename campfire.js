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
  let photoLimit = 72;
  let activeFilter = "all";
  let visiblePhotos = [];
  let lightboxIndex = 0;
  let heroScores = Object.create(null);
  const HERO_VISIT_KEY = "budao.campfire.hero.last.v2";
  let heroScrollCancel = null;

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
        photos.push({id:key,kind:"moment",albumId:string(album.id,80),image:src,alt,title,date:album.date,location,
          caption:string(item.caption, 180) || "步道现场影像",
          heroEligible:item.heroEligible !== false,
          heroScore:typeof item.heroScore === "number" && Number.isFinite(item.heroScore)
            ? Math.max(0, Math.min(100, item.heroScore)) : null});
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

  // Every approved on-site photo has an automatically generated, real watermark
  // in /campfire-watermarked/. The original archive always retains the master
  // photo path, and route cover images bypass this transformation entirely.
  function setCampfirePhoto(img, item, holder) {
    if (holder) holder.classList.remove("camp-watermark-fallback");
    img.onerror = null;
    if (item.kind === "moment" && item.image.startsWith("/campfire-photos/")) {
      const marked = item.image
        .replace(/^\/campfire-photos\//, "/campfire-watermarked/")
        .replace(/\.(?:jpe?g|png|webp|avif)$/i, ".webp");
      img.onerror = () => {
        // A newly approved photo may briefly precede its automated build.
        // Maintain an image and overlay the footprint until the next deploy.
        img.onerror = null;
        if (holder) holder.classList.add("camp-watermark-fallback");
        img.src = item.image;
      };
      img.src = marked;
    } else {
      img.src = item.image;
    }
  }
  function albumKey(item) {
    return item.albumId ? "album:" + item.albumId : "event:" + item.date + "|" + item.title;
  }

  function heroPhotoScore(item) {
    // Published, approved images only. An editor may explicitly rank or exclude a photo.
    if (item.heroScore !== null && item.heroScore !== undefined) return item.heroScore;
    const technical = heroScores[item.image];
    const base = typeof technical === "number" && Number.isFinite(technical) ? technical : 56;
    const scene = item.alt + " " + item.caption;
    // A small storytelling tie-breaker; the main technical score is baked from pixels.
    const scenic = /云海|晚霞|日落|夕阳|山峦|远山|山脊|秋色|彩霞|光影|湖泊|山谷|星空/.test(scene) ? 5 : 0;
    const together = /同行|山路|步道|相遇|徒步|小径/.test(scene) ? 3 : 0;
    const lessSuitable = /餐桌|食物|螃蟹|石像/.test(scene) ? 5 : 0;
    return Math.max(0, Math.min(100, base + scenic + together - lessSuitable));
  }

  function weightedHeroPick(options, weight) {
    const weights = options.map((item) => Math.max(0.001, weight(item)));
    let roll = Math.random() * weights.reduce((sum, value) => sum + value, 0);
    for (let i = 0; i < options.length; i++) {
      roll -= weights[i];
      if (roll < 0) return options[i];
    }
    return options[options.length - 1];
  }

  function previousHeroSelection() {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(HERO_VISIT_KEY));
      return saved && Array.isArray(saved.albums) && Array.isArray(saved.photos)
        ? saved : {albums:[],photos:[]};
    } catch {
      return {albums:[],photos:[]};
    }
  }

  function selectHeroPhotos() {
    const groups = new Map();
    for (const item of gallery) {
      // Route covers must never be passed off as real journeys on the hero.
      if (item.kind !== "moment" || item.heroEligible === false) continue;
      const key = albumKey(item);
      if (!groups.has(key)) groups.set(key, {key, date:item.date, photos:[]});
      groups.get(key).photos.push(item);
    }
    const albums = [...groups.values()].sort((a,b) => b.date.localeCompare(a.date));
    const previous = previousHeroSelection();
    const fresh = albums.filter((album) => !previous.albums.includes(album.key));
    // With six or more albums, successive visits show three different events.
    const pool = fresh.length >= 3 ? fresh : albums;
    const picks = [];
    const remaining = pool.slice();
    while (remaining.length && picks.length < 3) {
      const selected = weightedHeroPick(remaining, (album) => {
        const top = Math.max(...album.photos.map(heroPhotoScore));
        const recent = albums.findIndex((entry) => entry.key === album.key);
        return 0.8 + top / 150 + 0.12 * (1 - recent / Math.max(1,albums.length));
      });
      picks.push(selected);
      remaining.splice(remaining.indexOf(selected), 1);
    }
    const result = picks.map((album) => {
      const ranked = album.photos.slice().sort((a,b) => heroPhotoScore(b) - heroPhotoScore(a));
      const bestScore = heroPhotoScore(ranked[0]);
      // Prefer only the high-scoring candidates, not a random snapshot.
      const shortlist = ranked.filter((item) => heroPhotoScore(item) >= bestScore - 12).slice(0,4);
      const unseen = shortlist.filter((item) => !previous.photos.includes(item.image));
      const candidates = unseen.length ? unseen : shortlist;
      return weightedHeroPick(candidates, (item) =>
        Math.exp((heroPhotoScore(item) - bestScore) / 6));
    });
    try {
      window.sessionStorage.setItem(HERO_VISIT_KEY, JSON.stringify({
        albums:picks.map((album) => album.key), photos:result.map((item) => item.image)
      }));
    } catch {
      // Private/locked-down browsers still get a randomized selection.
    }
    return result;
  }

  function glideToAlbum(heading, reducedMotion) {
    // Stop an earlier gallery glide before starting another (or jumping directly).
    if (heroScrollCancel) heroScrollCancel();
    if (reducedMotion || typeof window.requestAnimationFrame !== "function") {
      heading.scrollIntoView({behavior:"auto", block:"start"});
      return;
    }

    // Keep the editor's scroll margin, and never run past the document's end.
    const startY = window.scrollY || document.documentElement.scrollTop || 0;
    const margin = parseFloat(window.getComputedStyle(heading).scrollMarginTop) || 0;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const targetY = Math.max(0, Math.min(maxY, startY + heading.getBoundingClientRect().top - margin));
    const distance = targetY - startY;
    if (Math.abs(distance) < 2) return;

    // Cubic ease-out: a smooth downward glide that gently loses speed near arrival,
    // without bounce, scaling or overshoot. Adjust duration to travel distance.
    const duration = Math.min(1250, Math.max(680, 610 + Math.abs(distance) * 0.18));
    const html = document.documentElement;
    const oldScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    let frame = 0;
    let started = null;
    let running = true;
    const cancel = () => {
      if (!running) return;
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("keydown", cancel);
      html.style.scrollBehavior = oldScrollBehavior;
      if (heroScrollCancel === cancel) heroScrollCancel = null;
    };
    heroScrollCancel = cancel;
    // Manual wheel/touch/key interactions must regain control immediately.
    window.addEventListener("wheel", cancel, {passive:true});
    window.addEventListener("touchstart", cancel, {passive:true});
    window.addEventListener("pointerdown", cancel, {passive:true});
    window.addEventListener("keydown", cancel);

    const tick = (now) => {
      if (!running) return;
      if (started === null) started = now;
      const t = Math.min(1, (now - started) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      window.scrollTo(0, startY + distance * ease);
      if (t < 1) frame = window.requestAnimationFrame(tick);
      else cancel();
    };
    frame = window.requestAnimationFrame(tick);
  }

  function scrollToHeroAlbum(item) {
    if (item.kind !== "moment") return;
    // A real-photo hero only links to the real-photo album, never to route covers.
    if (activeFilter !== "moment") setGalleryFilter("moment");
    const key = albumKey(item);
    const targetIndex = visiblePhotos.findIndex((entry) => albumKey(entry) === key);
    if (targetIndex < 0) return;
    if (targetIndex >= photoLimit) {
      photoLimit = Math.ceil((targetIndex + 1) / 9) * 9;
      renderGallery();
    }
    const groups = document.querySelectorAll("#camp-photo-grid .camp-album-heading");
    const heading = [...groups].find((element) => element.dataset.albumKey === key);
    if (!heading) return;
    document.querySelectorAll("#camp-photo-grid .camp-album-heading").forEach((element) => {
      element.classList.toggle("is-target", element === heading);
    });
    const prefersReducedMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.focus({preventScroll:true});
    glideToAlbum(heading, prefersReducedMotion);
  }

  function renderHero() {
    const hero = $("#camp-hero-gallery");
    if (!hero) return;
    const source = selectHeroPhotos();
    if (!source.length) return;
    // The default top photo is not yet armed: first click always selects,
    // second click on that same photo navigates to its complete album.
    let frontIndex = source.length > 1 ? 1 : 0;
    let armedIndex = -1;
    const nodes = source.map((item, index) => {
      const shot = newElement("figure", "camp-hero-shot");
      shot.tabIndex = 0;
      shot.setAttribute("role", "button");
      const img = newElement("img");
      setCampfirePhoto(img, item, shot);
      img.alt = item.alt;
      img.loading = "lazy";
      img.decoding = "async";
      shot.appendChild(img);
      shot.appendChild(newElement("figcaption", "", kindName(item) + " · " + item.title));
      const activate = () => {
        if (armedIndex === index) {
          scrollToHeroAlbum(item);
          return;
        }
        armedIndex = index;
        frontIndex = index;
        nodes.forEach((node, nodeIndex) => {
          const selected = nodeIndex === frontIndex;
          node.classList.toggle("is-front", selected);
          node.setAttribute("aria-pressed", String(selected));
          node.setAttribute("aria-label", selected
            ? "再次点击查看" + source[nodeIndex].title + "的全部现场照片"
            : "将" + source[nodeIndex].title + "的照片置于最上层");
        });
      };
      shot.addEventListener("click", activate);
      shot.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
      return shot;
    });
    nodes.forEach((node, index) => {
      node.classList.toggle("is-front", index === frontIndex);
      node.setAttribute("aria-pressed", String(index === frontIndex));
      node.setAttribute("aria-label", "将" + source[index].title + "的照片置于最上层");
      node.title = "点击置顶，再点击进入" + source[index].title + "影集";
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
      const nodes = [];
      let currentAlbum = "";
      photos.slice(0, photoLimit).forEach((item, index) => {
        if (item.kind === "moment") {
          const key = albumKey(item);
          if (key !== currentAlbum) {
            const heading = newElement("div", "camp-album-heading");
            heading.dataset.albumKey = key;
            heading.tabIndex = -1;
            heading.appendChild(newElement("span", "camp-album-date", item.date.replace(/-/g, ".") + " · 真实同行"));
            heading.appendChild(newElement("h3", "", item.title));
            nodes.push(heading);
          }
          currentAlbum = key;
        } else {
          currentAlbum = "";
        }
        const button = newElement("article", "camp-photo-card");
        button.tabIndex = 0;
        button.setAttribute("role", "button");
        button.setAttribute("aria-label", "放大查看：" + item.title + "，" + kindName(item));
        const wrapper = newElement("div", "camp-photo-visual");
        const image = newElement("img");
        setCampfirePhoto(image, item, wrapper);
        image.alt = item.alt;
        image.loading = "lazy";
        image.decoding = "async";
        wrapper.appendChild(image);
        wrapper.appendChild(newElement("span", "camp-photo-kind", kindName(item)));
        const caption = newElement("div", "camp-photo-caption");
        caption.appendChild(newElement("span", "camp-photo-date", item.date.replace(/-/g, ".") + " · " + kindName(item)));
        caption.appendChild(newElement("span", "camp-photo-title", item.title));
        if (item.location) caption.appendChild(newElement("span", "camp-photo-location", item.location));
        if (item.kind === "moment") {
          const sparkBar = newElement("div", "camp-photo-sparkbar");
          const spark = newElement("button", "camp-card-spark", "✧ 留下一颗火星");
          spark.type = "button";
          spark.dataset.photoId = item.image;
          spark.setAttribute("aria-label", "为这张步道现场照片留下火光");
          spark.addEventListener("click", (event) => {
            event.stopPropagation();
            window.CampfireSignals?.sparkPhoto(item.image, spark);
          });
          window.CampfireSignals?.setSparkButton(spark, item.image, false);
          sparkBar.appendChild(spark);
          caption.appendChild(sparkBar);
        }
        button.append(wrapper, caption);
        button.addEventListener("click", (event) => {
          if (event.target.closest("button")) return;
          openLightbox(index);
        });
        button.addEventListener("keydown", (event) => {
          if (event.target !== button) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openLightbox(index);
          }
        });
        nodes.push(button);
      });
      root.replaceChildren(...nodes);
    }
    const more = $("#camp-photos-more");
    if (more) more.hidden = photoLimit >= photos.length;
  }

  function setGalleryFilter(kind) {
    activeFilter = kind;
    photoLimit = 72;
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
      setCampfirePhoto(image, item, image.parentElement);
      image.alt = item.alt;
    }
    $("#camp-lightbox-name").textContent = item.title + " · " + kindName(item);
    $("#camp-lightbox-caption").textContent = item.date + (item.location ? " · " + item.location : "") + "｜" + item.caption;
    $("#camp-lightbox-prev").hidden = visiblePhotos.length < 2;
    $("#camp-lightbox-next").hidden = visiblePhotos.length < 2;
    document.dispatchEvent(new CustomEvent("campfire:photo-open", {detail:{item}}));
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

  async function loadHeroScores() {
    try {
      const response = await fetch("/data/campfire-hero-quality.json", {cache:"no-store"});
      if (!response.ok) throw new Error("Quality manifest HTTP " + response.status);
      const data = await response.json();
      if (!data || data.version !== 1 || !data.scores || typeof data.scores !== "object")
        throw new Error("Unsupported quality manifest");
      heroScores = Object.create(null);
      for (const [source, value] of Object.entries(data.scores)) {
        if (source.startsWith("/campfire-photos/") && Number.isFinite(value))
          heroScores[source] = Math.max(0, Math.min(100, value));
      }
    } catch {
      // The editorial text/approval fallback works until a photo build finishes.
      heroScores = Object.create(null);
    }
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
  // Re-entering through the browser back/forward cache should produce new memories.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && gallery.some((item) => item.kind === "moment")) renderHero();
  });
  // Load approved photos/comments first, then join the published route-cover archive.
  Promise.all([loadArchive(), loadHeroScores()]).then(loadRoutes).then(() => {
    // A photo permalink is accepted only if it matches a currently approved,
    // published onsite photo. It can never open a route cover or private asset.
    const photoId = new URLSearchParams(window.location.search).get("photo");
    if (!photoId) return;
    const target = visiblePhotos.findIndex((item) => item.kind === "moment" && item.image === photoId);
    if (target !== -1) openLightbox(target);
  });
})();
