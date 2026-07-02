(function () {
  const presence = document.querySelector(".presence");
  const tentButton = document.querySelector(".tent-button");
  const entryForm = document.querySelector(".entry-form");
  const loginMessage = document.querySelector(".login-message");
  const routeForm = document.querySelector(".route-form");
  const routeImages = document.getElementById("routeImages");
  const routeQrCode = document.getElementById("routeQrCode");
  const imageNote = document.querySelector(".image-note");
  const clearImageButton = ensureClearImageButton();
  const qrNote = document.querySelector(".qr-note");
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
    { email: "IMS@budao.org", password: "Budao2026!" },
    { email: "BACBC@budao.org", password: "Budao2026!" }
  ];
  const slotRouteDefaults = {
    IMS: {
      id: "budao-ims",
      routeId: "budao-ims",
      owner: "IMS@budao.org",
      slot: "IMS",
      country: "中国",
      city: "北京",
      region: "海淀",
      location: "中国 · 北京 · 海淀",
      title: "东郊湿地公园",
      description: "在城市边缘的湿地里，放慢脚步，沿着水边与林间小路同行。适合一次轻松、安静、彼此照看的半日步道。",
      date: "2026-07-11",
      time: "08:30",
      duration: "3小时",
      distance: "6千米",
      elevation: "平缓",
      surface: "公园步道 / 木栈道 / 平路",
      timezone: "Asia/Shanghai",
      difficulty: "轻松",
      suitableFor: "初次参与者 / 亲子",
      equipmentMinimum: "舒适步行鞋 / 饮水",
      meetingPlace: "",
      participantRequirements: ""
    },
    BACBC: {
      id: "budao-bacbc",
      routeId: "budao-bacbc",
      owner: "BACBC@budao.org",
      slot: "BACBC",
      country: "美国",
      city: "加州",
      region: "奥克兰",
      location: "美国 · 加州 · 奥克兰",
      title: "Reinhardt Redwood Regional Park",
      description: "10点停车在 Canyon Meadow Staging，出发进入山谷。Bridle Trail 到头后有两个选择：身体条件普通者从 Stream 返回；体力较好的伙伴从 Chown 上山，经 French 与 Orchard 返回 Bridle。大家在 Orchard Picnic 会合，一起午餐。",
      date: "2026-07-04",
      time: "10:00",
      duration: "2-3小时",
      distance: "1.8-3.0英里",
      elevation: "180-700英尺",
      surface: "土路、自然路面",
      timezone: "America/Los_Angeles",
      difficulty: "适中",
      suitableFor: "初次参与者 / 有徒步经验者",
      equipmentMinimum: "徒步鞋 / 饮水 / 午餐",
      meetingPlace: "Canyon Meadow Staging",
      participantRequirements: ""
    }
  };
  let activeTrail = null;
  let activePreviewUrl = "";
  let currentUserEmail = "";

  function slotForEmail(email) {
    const normalized = normalizeEmail(email);

    if (normalized === "ims@budao.org") {
      return "IMS";
    }

    if (normalized === "bacbc@budao.org") {
      return "BACBC";
    }

    return "";
  }

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
    const allowed = admins.find(function (admin) {
      return admin.email.toLowerCase() === email && admin.password === password;
    });

    if (!allowed) {
      loginMessage.textContent = "邮箱或密码错误。";
      return;
    }

    currentUserEmail = allowed.email;
    loginMessage.textContent = "";
    presence.classList.add("route-open");
    loadOwnedRouteForCurrentUser();
  });

  routeImages.addEventListener("change", function () {
    const files = Array.from(routeImages.files || []);

    if (files.length === 0) {
      updateRetainedImageState(currentExistingImage(), currentExistingImageAlt());
      return;
    }

    if (files.length === 1) {
      imageNote.textContent = files[0].name;
      return;
    }

    imageNote.textContent = files.length + " 张图片已经放在这里";
  });

  clearImageButton.addEventListener("click", function () {
    routeImages.value = "";

    if (activeTrail && activeTrail.source) {
      activeTrail.source.images = [];
      activeTrail.source.existingImage = "";
      activeTrail.source.existingImageAlt = "";
      activeTrail.source.removeExistingImage = true;
    }

    updateRetainedImageState("", "");
  });

  routeQrCode.addEventListener("change", function () {
    const file = routeQrCode.files && routeQrCode.files[0];

    qrNote.textContent = file ? file.name : "还没有选择活动码";
  });

  routeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    routeMessage.textContent = "";

    buildTrailRecord(routeForm).then(function (trail) {
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
    }).catch(function () {
      routeMessage.textContent = "图片暂时无法安放。";
    });
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
        window.setTimeout(function () {
          window.location.href = "https://budao.org/test.html";
        }, reduceMotion ? 1 : 1200);
      }).catch(function (error) {
        publishWhisper.textContent = publishFailureText(error);
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

  function findSavedTrail(routeId, title, location) {
    return readSavedTrails().find(function (trail) {
      if (trail.routeId && routeId && trail.routeId === routeId) {
        return true;
      }

      const source = trail.source || {};
      return source.routeName === title &&
        (source.routeLocation || source.meetingPlace || "") === location;
    }) || null;
  }

  function loadOwnedRouteForCurrentUser() {
    readPublishedRoutes().then(function (routes) {
      const owned = routeForCurrentSlot(routes);

      fillRouteFormFromRoute(owned);
    }).catch(function () {
      const currentSlot = slotForEmail(currentUserEmail);
      const localTrail = readSavedTrails().find(function (trail) {
        const source = trail.source || {};

        return source.slot === currentSlot ||
          (source.owner && slotForEmail(source.owner) === currentSlot);
      });

      if (localTrail) {
        fillRouteFormFromTrail(localTrail);
        return;
      }

      fillRouteFormFromRoute(routeForCurrentSlot([]));
    });
  }

  function readPublishedRoutes() {
    return fetch("https://budao.org/api/routes?budao=" + Date.now(), {
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("api_routes_unavailable");
      }

      return response.json();
    }).catch(function () {
      return fetch("https://budao.org/routes.json?budao=" + Date.now(), {
        cache: "no-store"
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("routes_unavailable");
        }

        return response.json();
      });
    }).then(function (routes) {
      return Array.isArray(routes) ? routes : [];
    });
  }

  function routeForCurrentSlot(routes) {
    const currentSlot = slotForEmail(currentUserEmail);
    const owned = routes.find(function (route) {
      return route.slot === currentSlot ||
        slotForEmail(route.owner) === currentSlot;
    });

    return owned || slotRouteDefaults[currentSlot];
  }

  function fillRouteFormFromRoute(route) {
    setValue(routeForm, "routeName", route.title || "");
    setValue(routeForm, "trailDate", route.date || "");
    setValue(routeForm, "meetingTime", route.time || "");
    setValue(routeForm, "difficulty", route.difficulty || "");
    setValue(routeForm, "suitableFor", route.suitableFor || "");
    setValue(routeForm, "equipmentMinimum", route.equipmentMinimum || "");
    setValue(routeForm, "distance", route.distance || "");
    setValue(routeForm, "elevationGain", route.elevation || "");
    setValue(routeForm, "routeLocation", locationForForm(route));
    setValue(routeForm, "timezone", route.timezone || "Asia/Shanghai");
    setValue(routeForm, "duration", route.duration || "");
    setValue(routeForm, "meetingPlace", route.meetingPlace || "");
    setValue(routeForm, "surfaceDescription", route.surface || "");
    setValue(routeForm, "participantRequirements", route.participantRequirements || "");
    setValue(routeForm, "itinerary", route.description || "");
    updateRetainedImageState(route.image || route.imageUrl || "", route.imageAlt || "");
    qrNote.textContent = route.qrCode ? "已保留活动码" : "还没有选择活动码";

    activeTrail = trailFromRoute(route);
    routeMessage.textContent = "已为你取回上次安放的步道。";
  }

  function fillRouteFormFromTrail(trail) {
    const source = trail.source || {};

    setValue(routeForm, "routeName", source.routeName || "");
    setValue(routeForm, "trailDate", source.trailDate || "");
    setValue(routeForm, "meetingTime", source.meetingTime || "");
    setValue(routeForm, "difficulty", source.difficulty || "");
    setValue(routeForm, "suitableFor", source.suitableFor || "");
    setValue(routeForm, "equipmentMinimum", source.equipmentMinimum || "");
    setValue(routeForm, "distance", source.distance || "");
    setValue(routeForm, "elevationGain", source.elevationGain || "");
    setValue(routeForm, "routeLocation", source.routeLocation || "");
    setValue(routeForm, "timezone", source.timezone || "Asia/Shanghai");
    setValue(routeForm, "duration", source.duration || "");
    setValue(routeForm, "meetingPlace", source.meetingPlace || "");
    setValue(routeForm, "surfaceDescription", source.surfaceDescription || "");
    setValue(routeForm, "participantRequirements", source.participantRequirements || "");
    setValue(routeForm, "itinerary", source.itinerary || "");
    updateRetainedImageState(source.existingImage || "", source.existingImageAlt || "");
    qrNote.textContent = source.qrCode ? "已保留活动码" : "还没有选择活动码";

    activeTrail = trail;
    routeMessage.textContent = "已为你取回上次安放的步道。";
  }

  function trailFromRoute(route) {
    const routeId = route.routeId || route.id || slugify([route.date, route.time, route.title, route.location].filter(Boolean).join("-"));

    return {
      id: route.id || routeId,
      routeId,
      status: "draft",
      createdAt: route.createdAt || "",
      updatedAt: route.updatedAt || "",
      source: {
        owner: route.owner || currentUserEmail,
        routeName: route.title || "",
        slot: route.slot || slotForEmail(route.owner || currentUserEmail),
        trailDate: route.date || "",
        meetingTime: route.time || "",
        difficulty: route.difficulty || "",
        suitableFor: route.suitableFor || "",
        equipmentMinimum: route.equipmentMinimum || "",
        distance: route.distance || "",
        elevationGain: route.elevation || "",
        routeLocation: locationForForm(route),
        timezone: route.timezone || "Asia/Shanghai",
        surfaceDescription: route.surface || "",
        duration: route.duration || "",
        participantRequirements: route.participantRequirements || "",
        itinerary: route.description || "",
        meetingPlace: route.meetingPlace || "",
        images: [],
        existingImage: route.image || route.imageUrl || "",
        existingImageAlt: route.imageAlt || "",
        removeExistingImage: false,
        qrCode: route.qrCode || ""
      }
    };
  }

  function locationForForm(route) {
    return [route.country, route.city, route.region].filter(Boolean).join(" · ") ||
      route.location ||
      "";
  }

  function setValue(form, name, value) {
    if (form.elements[name]) {
      form.elements[name].value = value;
    }
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function ensureClearImageButton() {
    const existing = document.querySelector(".image-clear");

    if (existing) {
      return existing;
    }

    const button = document.createElement("button");

    button.className = "image-clear";
    button.type = "button";
    button.hidden = true;
    button.textContent = "移除已保留图片";
    button.style.justifySelf = "start";
    button.style.border = "0";
    button.style.padding = "0";
    button.style.background = "transparent";
    button.style.color = "rgba(225, 219, 206, 0.48)";
    button.style.cursor = "pointer";
    button.style.font = "inherit";
    button.style.fontSize = "12px";
    button.style.letterSpacing = "0.12em";

    imageNote.insertAdjacentElement("afterend", button);
    return button;
  }

  function currentExistingImage() {
    return activeTrail && activeTrail.source ? activeTrail.source.existingImage || "" : "";
  }

  function currentExistingImageAlt() {
    return activeTrail && activeTrail.source ? activeTrail.source.existingImageAlt || "" : "";
  }

  function updateRetainedImageState(image, label) {
    const hasImage = Boolean(resolveImage(image));

    imageNote.textContent = hasImage ?
      "已保留路线图片" + (label ? "：" + label : "") :
      "还没有选择图片";
    clearImageButton.hidden = !hasImage;
  }

  function imageFiles() {
    return Array.from(routeImages.files || []);
  }

  function readImageDataUrls() {
    return Promise.all(imageFiles().map(function (file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();

        reader.addEventListener("load", function () {
          resolve({
            name: file.name,
            type: file.type,
            dataUrl: reader.result
          });
        });

        reader.addEventListener("error", reject);
        reader.readAsDataURL(file);
      });
    }));
  }

  function readQrCodeDataUrl() {
    const file = routeQrCode.files && routeQrCode.files[0];

    if (!file) {
      return Promise.resolve("");
    }

    return new Promise(function (resolve, reject) {
      const reader = new FileReader();

      reader.addEventListener("load", function () {
        resolve(reader.result || "");
      });

      reader.addEventListener("error", reject);
      reader.readAsDataURL(file);
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
    const suitableFor = valueOf(form, "suitableFor");
    const equipmentMinimum = valueOf(form, "equipmentMinimum");
    const distance = valueOf(form, "distance");
    const elevationGain = valueOf(form, "elevationGain");
    const routeLocation = valueOf(form, "routeLocation");
    const timezone = valueOf(form, "timezone") || "Asia/Shanghai";
    const surfaceDescription = valueOf(form, "surfaceDescription");
    const duration = valueOf(form, "duration");
    const participantRequirements = valueOf(form, "participantRequirements");
    const itinerary = valueOf(form, "itinerary");
    const meetingPlace = valueOf(form, "meetingPlace");
    const location = routeLocation || meetingPlace;
    const slot = slotForEmail(currentUserEmail);
    const routeId = slot ? "budao-" + slot.toLowerCase() : slugify([normalizedTrailDate, meetingTime, routeName, location].filter(Boolean).join("-"));

    return Promise.all([readImageDataUrls(), readQrCodeDataUrl()]).then(function (assets) {
      const images = assets[0];
      const qrCode = assets[1];
      const now = new Date().toISOString();
      const previous = findSavedTrail(routeId, routeName, location) ||
        activeTrailFor(routeName, normalizedTrailDate || trailDate, meetingTime, location);
      const previousQrCode = previous && previous.source ? previous.source.qrCode : "";
      const removeExistingImage = activeTrail && activeTrail.source && activeTrail.source.removeExistingImage;

      return {
        id: previous && previous.id ? previous.id : routeId,
        routeId: previous && previous.routeId ? previous.routeId : routeId,
        status: "draft",
        createdAt: previous && previous.createdAt ? previous.createdAt : now,
        updatedAt: now,
        source: {
          owner: currentUserEmail,
          routeName,
          slot,
          trailDate: normalizedTrailDate || trailDate,
          meetingTime,
          difficulty,
          suitableFor,
          equipmentMinimum,
          distance,
          elevationGain,
          routeLocation: location,
          timezone,
          surfaceDescription,
          duration,
          participantRequirements,
          itinerary,
          meetingPlace,
          images,
          existingImage: removeExistingImage ? "" : previous && previous.source ? previous.source.existingImage : "",
          existingImageAlt: removeExistingImage ? "" : previous && previous.source ? previous.source.existingImageAlt : "",
          removeExistingImage,
          qrCode: qrCode || previousQrCode
        },
        testPage: {
          countdown: {
            date: normalizedTrailDate || trailDate,
            time: meetingTime,
            durationText: duration,
            timezone
          },
          card: {
            location,
            title: routeName,
            description: itinerary,
            info: [
              meetingTime ? meetingTime + " 集合" : "",
              duration,
              distance,
              surfaceDescription,
              elevationGain,
              difficulty ? "难度 " + difficulty : "",
              suitableFor,
              equipmentMinimum ? "装备 " + equipmentMinimum : "",
              participantRequirements
            ].filter(Boolean),
            images
          }
        }
      };
    });
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
          throw publishError(body.error || body.reason || "network_failed");
        });
      }

      return response.json();
    }).then(function (result) {
      if (result && result.ok === false) {
        throw publishError(result.error || result.reason || "network_failed");
      }

      if (result && result.shareImageUrl) {
        window.localStorage.setItem("budao.tent.lastShareImageUrl", result.shareImageUrl);
      }

      return waitForPublishedRoute(route);
    });
  }

  function activeTrailFor(title, date, time, location) {
    if (!activeTrail || !activeTrail.source) {
      return null;
    }

    const source = activeTrail.source;

    if (source.routeName === title) {
      return activeTrail;
    }

    return null;
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

  function publishFailureText(error) {
    if (error && error.reason === "route_limit_reached") {
      return "你已经安放了两条步道。";
    }

    if (error && error.reason === "deploy_pending") {
      return "部署尚未完成。请稍后查看。";
    }

    return "这段路已经预备好，还需要被送出。";
  }

  function resolveImage(value) {
    const image = String(value || "").trim();

    if (!image) {
      return "";
    }

    if (image.indexOf("data:image/") === 0 ||
      image.indexOf("blob:") === 0 ||
      image.indexOf("http://") === 0 ||
      image.indexOf("https://") === 0) {
      return image;
    }

    if (image.indexOf("/") === 0 || /^[^:/?#]+(?:[/?#].*)?$/.test(image)) {
      return image;
    }

    return "";
  }

  window.replaceBrokenImage = function (image) {
    const placeholder = document.createElement("span");

    placeholder.className = "route-image-placeholder";
    image.replaceWith(placeholder);
  };

  function toRouteJson(trail) {
    const source = trail.source;
    const location = source.routeLocation || source.meetingPlace;
    const locationParts = parseLocationParts(location);
    const uploadedImage = source.images[0] && source.images[0].dataUrl ? source.images[0].dataUrl : "";
    const image = resolveImage(uploadedImage || source.existingImage || "");

    return {
      id: trail.id || trail.routeId,
      location,
      title: source.routeName,
      routeId: trail.routeId || trail.id,
      owner: currentUserEmail,
      slot: source.slot || slotForEmail(currentUserEmail),
      country: locationParts.country,
      city: locationParts.city,
      region: locationParts.region,
      description: source.itinerary,
      time: source.meetingTime,
      duration: source.duration,
      distance: source.distance,
      surface: source.surfaceDescription,
      elevation: source.elevationGain,
      difficulty: source.difficulty,
      suitableFor: source.suitableFor,
      equipmentMinimum: source.equipmentMinimum,
      timezone: source.timezone || "Asia/Shanghai",
      date: source.trailDate,
      image,
      qrCode: resolveImage(source.qrCode || ""),
      imageAlt: source.images[0] && source.images[0].name ? source.images[0].name : source.existingImageAlt || "",
      createdAt: trail.createdAt || "",
      updatedAt: trail.updatedAt || new Date().toISOString()
    };
  }

  function parseLocationParts(location) {
    const parts = String(location || "")
      .split(/[·,，/]+/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);

    return {
      country: parts[0] || "",
      city: parts[1] || "",
      region: parts.slice(2).join(" · ")
    };
  }

  function renderRoutePreview(trail) {
    const route = toRouteJson(trail);
    const previewImage = firstImagePreview();
    const image = resolveImage(previewImage || route.image);
    const card = document.createElement("div");

    card.className = "route-card";
    card.innerHTML = routeCardHtml(route, image);
    routePreview.textContent = "";
    routePreview.appendChild(card);
  }

  function routeCardHtml(route, image) {
    const imageHtml = [
      '<div class="route-image">',
      image ? '<img src="' + escapeAttribute(resolveImage(image)) + '" alt="' + escapeAttribute(route.imageAlt || route.title) + '" onerror="replaceBrokenImage(this)">' : '<span class="route-image-placeholder"></span>',
      '</div>'
    ].join("");

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
      route.difficulty ? '<span>' + escapeHtml("难度 " + route.difficulty) + '</span>' : '',
      route.suitableFor ? '<span>' + escapeHtml(route.suitableFor) + '</span>' : '',
      route.equipmentMinimum ? '<span>' + escapeHtml("装备 " + route.equipmentMinimum) + '</span>' : '',
      '</div>',
      '<div class="route-timezone">',
      escapeHtml(route.timezone) + ' · ' + escapeHtml(getUtcLabel(route.timezone, route.date, route.time)),
      '</div>',
      '<a href="#" class="route-button">',
      '与祂同行',
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
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const time = [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0")
    ].join(":");

    return days > 0 ? days + "天 " + time : time;
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
      .replace(/\"/g, "&quot;")
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
