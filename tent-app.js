(function () {
  const presence = document.querySelector(".presence");
  const tentButton = document.querySelector(".tent-button");
  const entryForm = document.querySelector(".entry-form");
  const loginMessage = document.querySelector(".login-message");
  const routeForm = document.querySelector(".route-form");
  const routeImages = document.getElementById("routeImages");
  const imageNote = document.querySelector(".image-note");
  const routeMessage = document.querySelector(".route-message");
  const publishWhisper = document.querySelector(".publish-whisper");
  const routePreview = document.getElementById("routePreview");
  const returnEditButton = document.querySelector(".return-edit");
  const sendTrailButton = document.querySelector(".send-trail");
  const viewPublishedButton = document.querySelector(".view-published");
  const field = document.getElementById("stars");
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const trailStorageKey = "budao.tent.trails";
  const pendingTrailStorageKey = "budao.tent.pendingPublish";
  const publishEndpoint = window.BUDAO_PUBLISH_ENDPOINT ||
    (window.location.protocol === "file:" ? "https://budao.org/api/publish-route" : "/api/publish-route");
  const admins = [
    { email: "ims@budao.org", password: "Budao2026!" },
    { email: "bacbc@budao.org", password: "Budao2026!" }
  ];
  let activeTrail = null;
  let activePreviewUrl = "";

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const random = mulberry32(20260629);

  function between(min, max) {
    return min + (max - min) * random();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function gaussian() {
    let u = 0;
    let v = 0;

    while (u === 0) u = random();
    while (v === 0) v = random();

    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function galaxyPoint() {
    const t = random();
    const curve = Math.sin((t - 0.5) * Math.PI) * 6.2;
    const centerQuiet = Math.exp(-Math.pow((t - 0.51) / 0.17, 2));
    const width = 5.4 + 11.6 * Math.pow(Math.sin(Math.PI * t), 1.1);
    const off = gaussian() * width * (1 + centerQuiet * 0.48);
    const x = -8 + t * 116 + gaussian() * 1.9;
    const y = 82 - t * 65 + curve + off;
    const distanceFromCenter = Math.abs(t - 0.51);
    const keep = centerQuiet > 0.42 && Math.abs(off) < width * 0.72 && random() < 0.74 - distanceFromCenter;

    if (keep) {
      return galaxyPoint();
    }

    return {
      x: clamp(x, -2, 102),
      y: clamp(y, -2, 102),
      band: true,
      t,
      centerQuiet,
      off
    };
  }

  function openSkyPoint() {
    let x = between(0, 100);
    let y = between(0, 100);
    const lineY = 82 - (x + 8) / 116 * 65 + Math.sin(((x + 8) / 116 - 0.5) * Math.PI) * 6.2;
    const distance = Math.abs(y - lineY);
    const center = Math.hypot(x - 50, y - 48);

    if ((distance < 10 && random() < 0.68) || (center < 17 && random() < 0.72)) {
      x = between(0, 100);
      y = between(0, 100);
    }

    return { x, y, band: false };
  }

  function colorFor(point) {
    const warmth = point.band ? between(0.05, 0.34) : between(0, 0.2);
    const blue = point.band ? between(0.1, 0.32) : between(0.15, 0.42);
    const base = between(205, 248);

    return {
      r: Math.round(base + 7 * warmth),
      g: Math.round(base + 2 - 10 * warmth),
      b: Math.round(base + 18 * blue)
    };
  }

  function starSize(point) {
    if (!point.band) {
      return between(0.45, 1.65);
    }

    const dense = Math.pow(Math.sin(Math.PI * point.t), 1.4);
    const dust = Math.abs(point.off) > 10 ? 0.74 : 1;
    return between(0.45, 1.9 + dense * 1.2) * dust;
  }

  function createStar(point, index) {
    const star = document.createElement("i");
    const color = colorFor(point);
    const size = starSize(point);
    const bright = point.band ? between(0.3, 0.88) : between(0.18, 0.64);
    const slow = reduceMotion ? 1 : between(8, 28);
    const drift = reduceMotion ? 1 : between(34, 96);
    const depth = size > 1.55 ? "near" : size < 0.75 ? "far" : "quiet";

    star.className = "star " + depth;
    star.style.setProperty("--x", point.x.toFixed(4) + "%");
    star.style.setProperty("--y", point.y.toFixed(4) + "%");
    star.style.setProperty("--s", size.toFixed(3) + "px");
    star.style.setProperty("--o", bright.toFixed(3));
    star.style.setProperty("--r", color.r);
    star.style.setProperty("--g", color.g);
    star.style.setProperty("--b", color.b);
    star.style.setProperty("--glow", between(0.18, point.band ? 0.58 : 0.34).toFixed(3));
    star.style.setProperty("--halo", between(0.04, point.band ? 0.2 : 0.11).toFixed(3));
    star.style.setProperty("--scale", between(0.84, 1.18).toFixed(3));
    star.style.setProperty("--d", slow.toFixed(2) + "s");
    star.style.setProperty("--delay", (-between(0, slow) - index * 0.017).toFixed(2) + "s");
    star.style.setProperty("--move", drift.toFixed(2) + "s");
    star.style.setProperty("--move-delay", (-between(0, drift)).toFixed(2) + "s");
    star.style.setProperty("--dx", between(-0.28, 0.28).toFixed(3) + "vw");
    star.style.setProperty("--dy", between(-0.22, 0.22).toFixed(3) + "vh");

    return star;
  }

  function density() {
    const area = window.innerWidth * window.innerHeight;
    const base = clamp(Math.round(area / 2900), 220, 560);
    return {
      galaxy: Math.round(base * 1.35),
      open: Math.round(base * 0.62)
    };
  }

  function render() {
    const fragment = document.createDocumentFragment();
    const count = density();
    field.textContent = "";

    for (let i = 0; i < count.open; i += 1) {
      fragment.appendChild(createStar(openSkyPoint(), i));
    }

    for (let i = 0; i < count.galaxy; i += 1) {
      fragment.appendChild(createStar(galaxyPoint(), i + count.open));
    }

    field.appendChild(fragment);
    root.style.setProperty("--breath", between(20, 28).toFixed(2) + "s");
  }

  let resizeTimer = 0;

  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 180);
  });

  tentButton.addEventListener("click", function () {
    if (presence.classList.contains("entering")) {
      return;
    }

    presence.classList.add("entering");

    window.setTimeout(function () {
      presence.classList.add("inside-open");
    }, reduceMotion ? 1 : 2100);
  });

  entryForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const email = valueOf(entryForm, "email").toLowerCase();
    const password = valueOf(entryForm, "password");
    const allowed = admins.some(function (admin) {
      return admin.email === email && admin.password === password;
    });

    if (!allowed) {
      loginMessage.textContent = "邮箱或密码错误。";
      return;
    }

    loginMessage.textContent = "";
    presence.classList.add("route-open");
  });

  routeImages.addEventListener("change", function () {
    const files = Array.from(routeImages.files || []);

    if (files.length === 0) {
      imageNote.textContent = "还没有选择图片";
      return;
    }

    if (files.length === 1) {
      imageNote.textContent = files[0].name;
      return;
    }

    imageNote.textContent = files.length + " 张图片已经放在这里";
  });

  routeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const trail = buildTrailRecord(routeForm);
    activeTrail = trail;
    const trails = readSavedTrails();
    const existingIndex = trails.findIndex(function (item) {
      return item.id === trail.id;
    });

    if (existingIndex >= 0) {
      trails[existingIndex] = trail;
    } else {
      trails.unshift(trail);
    }

    window.localStorage.setItem(trailStorageKey, JSON.stringify(trails));
    routeMessage.textContent = "这条步道已经暂时安放。";
    publishWhisper.textContent = "这条步道已经暂时安放。";
    presence.classList.add("saved-resting");
    presence.classList.remove("review-open", "review-closing", "publish-transition", "publish-finished");
    renderRoutePreview(trail);

    window.setTimeout(function () {
      presence.classList.remove("saved-resting");
      presence.classList.add("review-open");
    }, reduceMotion ? 1 : 1000);
  });

  returnEditButton.addEventListener("click", function () {
    presence.classList.add("review-closing");
    presence.classList.remove("review-open");

    window.setTimeout(function () {
      presence.classList.remove("review-closing", "saved-resting", "publish-transition", "publish-finished");
      routeMessage.textContent = "";
    }, reduceMotion ? 1 : 600);
  });

  sendTrailButton.addEventListener("click", function () {
    if (!activeTrail) {
      return;
    }

    presence.classList.remove("review-open", "review-closing", "saved-resting", "publish-finished");
    presence.classList.add("publish-transition");
    publishWhisper.textContent = "与你同行的人，将很快看见这段路。";

    window.setTimeout(function () {
      publishTrail(activeTrail).then(function () {
        publishWhisper.textContent = "与你同行的人，现在已经能够看见这段路。";
        presence.classList.remove("publish-transition");
        presence.classList.add("publish-finished");
      }).catch(function (error) {
        publishWhisper.textContent = error && error.reason === "deploy_pending" ?
          "部署尚未完成。请稍后查看。" :
          "这段路已经预备好，还需要被送出。";
        presence.classList.remove("publish-transition");
      });
    }, reduceMotion ? 1 : 1600);
  });

  viewPublishedButton.addEventListener("click", function () {
    window.location.href = "https://budao.org/test.html";
  });

  function valueOf(form, name) {
    const fieldElement = form.elements[name];
    return fieldElement ? fieldElement.value.trim() : "";
  }

  function slugify(value) {
    const plain = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return plain || "trail";
  }

  function readSavedTrails() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(trailStorageKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function imageNames() {
    return Array.from(routeImages.files || []).map(function (file) {
      return file.name;
    });
  }

  function firstImagePreview() {
    const file = routeImages.files && routeImages.files[0];

    if (!file) {
      return "";
    }

    if (activePreviewUrl) {
      URL.revokeObjectURL(activePreviewUrl);
    }

    activePreviewUrl = URL.createObjectURL(file);
    return activePreviewUrl;
  }

  function buildTrailRecord(form) {
    const routeName = valueOf(form, "routeName");
    const trailDate = valueOf(form, "trailDate");
    const normalizedTrailDate = normalizeDate(trailDate);
    const meetingTime = valueOf(form, "meetingTime");
    const difficulty = valueOf(form, "difficulty");
    const distance = valueOf(form, "distance");
    const elevationGain = valueOf(form, "elevationGain");
    const surfaceDescription = valueOf(form, "surfaceDescription");
    const duration = valueOf(form, "duration");
    const participantRequirements = valueOf(form, "participantRequirements");
    const itinerary = valueOf(form, "itinerary");
    const meetingPlace = valueOf(form, "meetingPlace");
    const routeId = slugify([normalizedTrailDate, meetingTime, routeName, meetingPlace].filter(Boolean).join("-"));

    return {
      id: routeId,
      routeId,
      status: "draft",
      updatedAt: new Date().toISOString(),
      source: {
        routeName,
        trailDate: normalizedTrailDate || trailDate,
        meetingTime,
        difficulty,
        distance,
        elevationGain,
        surfaceDescription,
        duration,
        participantRequirements,
        itinerary,
        meetingPlace,
        images: imageNames()
      },
      testPage: {
        countdown: {
          date: trailDate,
          time: meetingTime,
          durationText: duration,
          timezone: "Asia/Shanghai"
        },
        card: {
          location: meetingPlace,
          title: routeName,
          description: itinerary,
          info: [
            meetingTime ? meetingTime + " 集合" : "",
            duration,
            distance,
            surfaceDescription,
            elevationGain,
            difficulty ? "难度 " + difficulty : "",
            participantRequirements
          ].filter(Boolean),
          images: imageNames()
        }
      }
    };
  }

  function publishTrail(trail) {
    const route = toRouteJson(trail);

    window.localStorage.setItem(pendingTrailStorageKey, JSON.stringify(route));

    return fetch(publishEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(route)
    }).then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          throw publishError(body.reason || "network_failed");
        });
      }

      return response.json();
    }).then(function () {
      return waitForPublishedRoute(route);
    });
  }

  function waitForPublishedRoute(route) {
    const startedAt = Date.now();

    return new Promise(function (resolve, reject) {
      function check() {
        fetch("https://budao.org/routes.json?budao=" + Date.now(), {
          cache: "no-store"
        }).then(function (response) {
          if (!response.ok) {
            throw publishError("network_failed");
          }

          return response.json();
        }).then(function (routes) {
          const published = Array.isArray(routes) && routes.some(function (item) {
            return item.routeId && item.routeId === route.routeId ||
              item.title === route.title &&
              item.date === route.date &&
              item.time === route.time;
          });

          if (published) {
            window.localStorage.removeItem(pendingTrailStorageKey);
            resolve();
            return;
          }

          if (Date.now() - startedAt >= 60000) {
            reject(publishError("deploy_pending"));
            return;
          }

          window.setTimeout(check, 2000);
        }).catch(function (error) {
          if (Date.now() - startedAt >= 60000) {
            reject(error && error.reason ? error : publishError("deploy_pending"));
            return;
          }

          window.setTimeout(check, 2000);
        });
      }

      window.setTimeout(check, reduceMotion ? 1 : 2000);
    });
  }

  function publishError(reason) {
    const error = new Error(reason);
    error.reason = reason;
    return error;
  }

  function toRouteJson(trail) {
    const source = trail.source;

    return {
      location: source.meetingPlace,
      title: source.routeName,
      routeId: trail.routeId || trail.id,
      description: source.itinerary,
      time: source.meetingTime,
      duration: source.duration,
      distance: source.distance,
      surface: source.surfaceDescription,
      elevation: source.elevationGain,
      timezone: "Asia/Shanghai",
      date: source.trailDate,
      image: source.images[0] || ""
    };
  }

  function renderRoutePreview(trail) {
    const route = toRouteJson(trail);
    const previewImage = firstImagePreview();
    const image = previewImage || route.image;
    const card = document.createElement("div");

    card.className = "route-card";
    card.innerHTML = routeCardHtml(route, image);
    routePreview.textContent = "";
    routePreview.appendChild(card);
  }

  function routeCardHtml(route, image) {
    const imageHtml = image ? [
      '<div class="route-image">',
      '<img src="' + escapeAttribute(image) + '">',
      '</div>'
    ].join("") : "";

    return [
      '<div class="route-timer">',
      '<div class="timer-city">',
      escapeHtml(getTimerCity(route)),
      '</div>',
      '<div class="route-countdown">',
      routeCountdownText(route),
      '</div>',
      '</div>',
      imageHtml,
      '<div class="route-content">',
      '<div class="route-location">',
      escapeHtml(route.location),
      '</div>',
      '<h2>',
      escapeHtml(route.title),
      '</h2>',
      '<div class="route-description">',
      escapeHtml(route.description).replace(/\n/g, "<br>"),
      '</div>',
      '<div class="route-info">',
      '<span>' + escapeHtml(route.time) + ' 集合</span>',
      '<span>' + escapeHtml(route.duration) + '</span>',
      '<span>' + escapeHtml(route.distance) + '</span>',
      '<span>' + escapeHtml(route.surface) + '</span>',
      '<span>' + escapeHtml(route.elevation) + '</span>',
      '</div>',
      '<div class="route-timezone">',
      escapeHtml(route.timezone) + ' · ' + escapeHtml(getUtcLabel(route.timezone, route.date, route.time)),
      '</div>',
      '<a href="#" class="route-button">',
      '与他们同行 →',
      '</a>',
      '</div>'
    ].join("");
  }

  function routeCountdownText(route) {
    if (!route.date || !route.time) {
      return "倒计时加载中...";
    }

    const result = getEventState({
      date: route.date,
      time: route.time,
      duration: parseDuration(route.duration),
      timezone: route.timezone
    });

    if (result.state === "started") {
      return "正在同行";
    }

    if (result.state === "ended") {
      return "已完成此程";
    }

    return formatCountdown(result.diff);
  }

  function formatCountdown(diff) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return hours + "小时 " + minutes + "分 " + seconds + "秒";
  }

  function parseDuration(duration) {
    const text = String(duration || "");
    const hourMatch = text.match(/([\d.]+)\s*(小时|hour|hours|h)/i);
    const minuteMatch = text.match(/([\d.]+)\s*(分钟|minute|minutes|min|m)/i);

    if (hourMatch) {
      return Math.round(Number(hourMatch[1]) * 60);
    }

    if (minuteMatch) {
      return Math.round(Number(minuteMatch[1]));
    }

    return 180;
  }

  function getTimerCity(route) {
    return route.location || getUtcLabel(route.timezone, route.date, route.time);
  }

  function getUtcLabel(timezone, date, time) {
    if (!timezone || !date) {
      return "UTC+8";
    }

    const target = new Date(normalizeDate(date) + "T" + (time || "00:00") + ":00");
    const utcDate = new Date(target.toLocaleString("en-US", { timeZone: "UTC" }));
    const localDate = new Date(target.toLocaleString("en-US", { timeZone: timezone }));
    const offsetHours = Math.round((localDate - utcDate) / (1000 * 60 * 60));

    return "UTC" + (offsetHours >= 0 ? "+" : "") + offsetHours;
  }

  function getEventState(event) {
    const now = new Date();
    const localNow = new Date(now.toLocaleString("en-US", { timeZone: event.timezone }));
    const start = new Date(normalizeDate(event.date) + "T" + event.time + ":00");
    const end = new Date(start.getTime() + event.duration * 60 * 1000);

    if (localNow < start) {
      return {
        state: "countdown",
        diff: start - localNow
      };
    }

    if (localNow >= start && localNow < end) {
      return {
        state: "started",
        diff: end - localNow
      };
    }

    return {
      state: "ended",
      diff: 0
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function normalizeDate(date) {
    const value = String(date || "");
    const match = value.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);

    if (match) {
      return [
        match[1],
        match[2].padStart(2, "0"),
        match[3].padStart(2, "0")
      ].join("-");
    }

    return value;
  }

  render();
}());
