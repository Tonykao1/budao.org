/* 营火之地：公开内容渲染与未来活动。纯静态读取，不收集访客信息。 */
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const make = (tag, className, content) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = String(content);
    return element;
  };
  const internalPage = (value) => (
    typeof value === "string" && /^\/[a-zA-Z0-9/_-]+\.html$/.test(value) ? value : "/home.html"
  );
  const localImage = (value) => (
    typeof value === "string" && /^\/images\/[a-zA-Z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i.test(value) ? value : ""
  );
  const setContent = (parent, children) => parent.replaceChildren(...children);
  const safeText = (value, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";

  const FALLBACK_PROGRAMS = [
    {title:"步道",eyebrow:"山野 · 同行",description:"与人同行，走进山野。",href:"/test.html",cta:"浏览步道",image:"/images/qldyt.jpg"},
    {title:"童行",eyebrow:"家庭 · 下一代",description:"让孩子自由发现，让家人彼此陪伴。",href:"/tongxing.html",cta:"了解童行",image:"/images/dkd.jpg"},
    {title:"路上星火",eyebrow:"社区 · 生命关怀",description:"看见真实的社区关怀与服事。",href:"/lsxh.html",cta:"浏览事工",image:"/images/angel-home.jpg"},
    {title:"牧场",eyebrow:"生命 · 经卷同行",description:"阅读、聆听、记录，每日成长。",href:"/tonglu.html",cta:"进入牧场",glyph:"✧"}
  ];
  const FALLBACK_VOICES = [
    "今天无论是身体还是灵里，都收获满满，感恩弟兄姐妹们的陪伴和分享。",
    "感恩这段相遇与安排，拆掉心墙，看见光。",
    "我相信人与人的每一次相遇都是奇迹。"
  ];
  let voiceList = [];
  let voiceOffset = 0;

  function renderPrograms(items) {
    const root = $("#camp-program-grid");
    if (!root) return;
    const cards = items.slice(0, 16).map((item, index) => {
      const link = make("a", "camp-program");
      link.href = internalPage(item.href);
      link.setAttribute("aria-label", safeText(item.title, 100) + " · " + safeText(item.cta, 60));
      const image = localImage(item.image);
      if (image) {
        const img = make("img", "camp-card-photo");
        img.src = image;
        img.alt = safeText(item.imageAlt, 120);
        img.loading = index === 0 ? "eager" : "lazy";
        img.decoding = "async";
        link.appendChild(img);
      } else {
        link.classList.add("camp-program--graphic");
        link.appendChild(make("span", "camp-program-icon", safeText(item.glyph || "✧", 2)));
      }
      const inner = make("div", "camp-program-content");
      inner.appendChild(make("span", "camp-program-index", safeText(item.eyebrow, 80)));
      inner.appendChild(make("h3", "", safeText(item.title, 100)));
      inner.appendChild(make("p", "", safeText(item.description, 280)));
      const action = make("span", "camp-program-bottom");
      action.appendChild(make("span", "", safeText(item.cta || "了解更多", 80)));
      action.appendChild(make("span", "", "↗"));
      inner.appendChild(action);
      link.appendChild(inner);
      return link;
    });
    setContent(root, cards);
  }

  function renderStories(items) {
    const root = $("#camp-story-grid");
    if (!root) return;
    if (!items.length) {
      const notice = make("p", "camp-loading", "故事资料暂未加载。欢迎先走进“路上星火”，认识正在服事的人。");
      const link = make("a", "", "查看路上星火 ↗");
      link.href = "/lsxh.html";
      notice.append(" ", link);
      setContent(root, [notice]);
      return;
    }
    const cards = items.slice(0, 9).map((story) => {
      const card = make("article", "camp-story");
      const src = localImage(story.image);
      if (src) {
        const cover = make("div", "camp-story-image");
        const image = make("img");
        image.src = src;
        image.alt = safeText(story.imageAlt, 120);
        image.loading = "lazy";
        image.decoding = "async";
        cover.appendChild(image);
        card.appendChild(cover);
      }
      const body = make("div", "camp-story-body");
      body.appendChild(make("p", "camp-story-place", safeText(story.location, 100)));
      body.appendChild(make("h3", "", safeText(story.title, 100)));
      body.appendChild(make("p", "", safeText(story.description, 320)));
      const link = make("a", "", "走近这个故事 ↗");
      link.href = internalPage(story.href);
      link.setAttribute("aria-label", "走近" + safeText(story.title, 100) + "的故事");
      body.appendChild(link);
      card.appendChild(body);
      return card;
    });
    setContent(root, cards);
  }

  function showVoices() {
    const root = $("#camp-voices-grid");
    if (!root) return;
    const count = Math.min(3, voiceList.length);
    const cards = Array.from({length: count}, (_, index) => {
      const value = voiceList[(voiceOffset + index) % voiceList.length];
      const article = make("article", "camp-voice");
      article.appendChild(make("span", "camp-voice-mark", "“"));
      article.appendChild(make("blockquote", "", value));
      article.appendChild(make("span", "camp-voice-label", "一次同行之后"));
      return article;
    });
    setContent(root, cards);
    const nextButton = $("#camp-next-voices");
    if (nextButton) nextButton.hidden = voiceList.length <= 3;
  }

  function setupVoices(items) {
    voiceList = items.filter((text) => typeof text === "string" && text.trim()).map((text) => text.trim().slice(0, 600));
    voiceOffset = 0;
    showVoices();
  }

  async function loadEditorial() {
    try {
      const response = await fetch("/data/campfire-content.json", {cache:"no-store"});
      if (!response.ok) throw new Error("Editorial content HTTP " + response.status);
      const data = await response.json();
      if (data.version !== 1 || !Array.isArray(data.programs) || !Array.isArray(data.stories) || !Array.isArray(data.voices)) {
        throw new Error("Unsupported editorial content schema");
      }
      renderPrograms(data.programs.length ? data.programs : FALLBACK_PROGRAMS);
      renderStories(data.stories);
      setupVoices(data.voices.length ? data.voices : FALLBACK_VOICES);
    } catch (error) {
      console.warn("Campfire editorial content unavailable; showing public entry points.", error);
      renderPrograms(FALLBACK_PROGRAMS);
      renderStories([]);
      setupVoices(FALLBACK_VOICES);
    }
  }

  function shanghaiToday() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const keyed = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return keyed.year + "-" + keyed.month + "-" + keyed.day;
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function emptyCalendar(message) {
    const root = $("#camp-upcoming-list");
    if (!root) return;
    const card = make("div", "camp-event-empty");
    card.appendChild(make("strong", "", "下一段同行，正在预备。"));
    card.appendChild(make("p", "", message));
    setContent(root, [card]);
  }

  async function loadUpcoming() {
    try {
      const response = await fetch("/routes.json", {cache:"no-store"});
      if (!response.ok) throw new Error("Routes HTTP " + response.status);
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : (Array.isArray(payload.routes) ? payload.routes : []);
      const today = shanghaiToday();
      const upcoming = rows.filter((route) => (
        route && route.status === "scheduled" && !route.cancelledAt &&
        typeof route.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(route.date) &&
        route.date >= today && safeText(route.title, 120)
      )).sort((a, b) => (a.date + " " + (a.time || "")).localeCompare(b.date + " " + (b.time || ""))).slice(0, 3);
      if (!upcoming.length) {
        emptyCalendar("目前没有已公布的未来场次。欢迎前往步道日历查看新线路。");
        return;
      }
      const nodes = upcoming.map((route) => {
        const article = make("article", "camp-upcoming-item");
        const date = make("div", "camp-event-date", route.date.slice(5).replace("-", "."));
        date.appendChild(make("small", "", route.date.slice(0,4) + " / " + safeText(route.time || "待定", 20)));
        article.appendChild(date);
        const detail = make("div");
        detail.appendChild(make("h3", "", safeText(route.title, 150)));
        detail.appendChild(make("p", "", safeText(route.location || [route.city, route.region].filter(Boolean).join(" · "), 120)));
        article.appendChild(detail);
        const link = make("a", "", "↗");
        link.href = "/test.html";
        link.setAttribute("aria-label", "前往步道日历查看" + safeText(route.title, 100));
        article.appendChild(link);
        return article;
      });
      setContent($("#camp-upcoming-list"), nodes);
    } catch (error) {
      console.warn("Campfire calendar unavailable.", error);
      emptyCalendar("暂时未能读取步道日历。你仍可以进入步道页面查看活动。");
    }
  }

  function setupShare() {
    const button = $("#camp-share");
    const status = $("#camp-share-status");
    if (!button || !status) return;
    button.addEventListener("click", async () => {
      const url = "https://budao.org/yhzd.html";
      const data = {title:"营火之地｜步道",text:"愿我们在路上相遇，也让爱继续发光。",url};
      status.textContent = "";
      if (navigator.share) {
        try {
          await navigator.share(data);
          status.textContent = "感谢你把这束光传递出去。";
          return;
        } catch (error) {
          if (error && error.name === "AbortError") return;
        }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          status.textContent = "页面链接已复制，可以分享给朋友。";
          return;
        } catch {
          // 某些浏览器禁用剪贴板，继续提供可复制的链接。
        }
      }
      window.prompt("复制营火之地的页面链接：", url);
      status.textContent = "你可以复制上面的链接与朋友分享。";
    });
  }

  $("#camp-next-voices")?.addEventListener("click", () => {
    voiceOffset = (voiceOffset + 3) % voiceList.length;
    showVoices();
  });
  setupShare();
  loadEditorial();
  loadUpcoming();
})();
