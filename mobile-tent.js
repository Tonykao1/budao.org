(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const loadingView = $("#loadingView");
  const loginView = $("#loginView");
  const editorView = $("#editorView");
  const previewView = $("#previewView");
  const successView = $("#successView");
  const loginForm = $("#loginForm");
  const routeForm = $("#routeForm");
  const routePicker = $("#routePicker");
  const coverFile = $("#coverFile");
  const qrFile = $("#qrFile");
  const publishButton = $("#publishButton");
  const defaultTimezone = "Asia/Shanghai";
  // Vercel preview deployments may inherit production publish credentials.
  // Refuse all mobile writes until this page reaches the reviewed main site.
  const previewOnly = /\.vercel\.app$/i.test(window.location.hostname);
  const draftPrefix = "budao.mobile-tent.draft.v1:";
  const labels = {
    title: "线路名称",
    calendarType: "活动性质",
    date: "步道日期",
    time: "集合时间",
    timezone: "时区",
    location: "地点层级",
    country: "国家",
    city: "城市",
    region: "地区",
    meetingPlace: "集合地点",
    duration: "预计耗时",
    distance: "总里程",
    elevation: "累计爬升",
    difficulty: "线路难度",
    suitableFor: "适合人群",
    equipmentMinimum: "装备下限",
    participantRequirements: "参与者要求",
    surface: "路面信息",
    description: "行程说明"
  };
  if (previewOnly) {
    $("#environmentNote").hidden = false;
    publishButton.disabled = true;
    publishButton.textContent = "预览站不开放正式发布";
  }

  const calendarTypes = {
    budao: "标准步道",
    pioneer: "线路探索",
    march: "行军",
    camp: "营会",
    fellowship: "同道"
  };

  let leader = "";
  let routes = [];
  let selectedRoute = null;
  let pendingRoute = null;
  let previewObjectUrl = "";
  let submitting = false;

  function show(view) {
    [loadingView, loginView, editorView, previewView, successView].forEach(function (item) {
      item.hidden = item !== view;
    });
    if (view !== loadingView) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function status(element, message, positive) {
    element.textContent = message || "";
    element.classList.toggle("success-msg", Boolean(positive));
  }

  function errorText(reason, fallback) {
    const descriptions = {
      invalid_credentials: "账号或密码不正确。",
      unauthorized: "登录已过期，请重新进入帐篷。",
      forbidden: "操作未通过安全校验，请刷新页面重试。",
      route_locked: "这条线路已在祭坛锁定，无法修改。请联系步道负责人。",
      commit_conflict: "刚刚有其他线路更新，请重新尝试发布。",
      payload_too_large: "内容超过系统允许的长度。",
      invalid_image: "图片文件不符合格式要求，请选择 JPEG、PNG 或 WebP。",
      image_too_large: "图片超过容量限制，请重新选择或压缩。",
      unsupported_image_type: "图片格式不支持，请尝试截图后重新选择。",
      image_upload_failed: "图片上传失败，请检查网络后重试。",
      upload_failed: "图片上传失败，请检查网络后重试。",
      upload_unavailable: "图片服务暂不可用，请稍后重试。",
      publishing_unavailable: "发布系统暂不可用，请稍后重试。",
      rate_limited: "操作过于频繁，请稍后重试。",
      missing_route: "请填写线路名称。",
      invalid_field: "某个字段格式或长度不符合要求。",
      invalid_calendar_type: "活动性质无效。",
      untrusted_image_url: "图片地址未通过安全验证，请重新上传。",
      network_failed: "网络连接失败，请稍后重试。"
    };
    return descriptions[reason] || fallback || "操作暂未完成，请重试。";
  }

  async function requestJson(url, options) {
    const response = await fetch(url, Object.assign({
      credentials: "same-origin",
      cache: "no-store"
    }, options || {}));
    let data;
    try {
      data = await response.json();
    } catch (_error) {
      data = null;
    }
    if (!response.ok || (data && data.ok === false)) {
      const error = new Error(errorText(data && data.reason, "服务器暂未响应，请稍后重试。"));
      error.reason = data && data.reason || "";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function postJson(url, data) {
    return requestJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  }

  function field(name) {
    return routeForm.elements.namedItem(name);
  }

  function readFields() {
    const payload = {};
    Object.keys(labels).forEach(function (key) {
      const element = field(key);
      if (element) payload[key] = String(element.value || "").trim();
    });
    if (!payload.calendarType) payload.calendarType = "budao";
    if (!payload.timezone) payload.timezone = defaultTimezone;
    return payload;
  }

  function putFields(payload) {
    const source = payload || {};
    Object.keys(labels).forEach(function (key) {
      const input = field(key);
      if (!input) return;
      if (input.tagName === "SELECT") {
        const value = String(source[key] || (key === "timezone" ? defaultTimezone : key === "calendarType" ? "budao" : ""));
        input.value = Array.from(input.options).some(function (option) { return option.value === value; }) ?
          value : (key === "timezone" ? defaultTimezone : "budao");
      } else {
        input.value = String(source[key] || "");
      }
    });
    routeForm.querySelectorAll("[aria-invalid]").forEach(function (input) {
      input.removeAttribute("aria-invalid");
    });
  }

  function routeId(route) {
    return String(route && (route.routeId || route.id) || "").trim();
  }

  function draftKey() {
    return draftPrefix + leader + ":" + (selectedRoute ? routeId(selectedRoute) : "new");
  }

  function writeDraft() {
    if (!leader || submitting) return;
    try {
      window.localStorage.setItem(draftKey(), JSON.stringify(readFields()));
      status($("#saveState"), "文字草稿已保存在本机", true);
    } catch (_error) {
      status($("#saveState"), "本机无法保存草稿，请勿关闭页面");
    }
  }

  function readDraft() {
    try {
      const value = window.localStorage.getItem(draftKey());
      if (!value) return null;
      const data = JSON.parse(value);
      return data && typeof data === "object" && !Array.isArray(data) ? data : null;
    } catch (_error) {
      return null;
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey());
    } catch (_error) {}
  }

  function updateImageNotes() {
    const cover = coverFile.files && coverFile.files[0];
    const qr = qrFile.files && qrFile.files[0];
    $("#coverExisting").textContent = cover ? "已选择：" + cover.name :
      (selectedRoute && selectedRoute.image ? "将保留这条线路现有封面" : "未选择封面（选填）");
    $("#qrExisting").textContent = qr ? "已选择：" + qr.name :
      (selectedRoute && selectedRoute.qrCode ? "将保留这条线路现有活动码" : "未选择活动码（选填）");
  }

  function selectRoute(value) {
    const id = String(value || "");
    selectedRoute = routes.find(function (item) { return routeId(item) === id; }) || null;
    const base = selectedRoute || {};
    const draft = readDraft();
    // Clear stale photo choices, then restore both the route picker and fields.
    // routeForm.reset() would otherwise display "new" while editing an old ID.
    routeForm.reset();
    routePicker.value = selectedRoute ? routeId(selectedRoute) : "";
    putFields(Object.assign({}, base, draft || {}));
    updateImageNotes();
    status($("#saveState"), draft ? "已恢复本机文字草稿" : "填写后自动保存文字草稿", Boolean(draft));
  }

  function setRouteOptions() {
    const previouslySelected = routePicker.value;
    routePicker.replaceChildren();
    routePicker.add(new Option("＋ 新建一条线路", ""));
    routes.forEach(function (route) {
      const label = [route.date || "未定日期", route.title || "未命名线路"].join(" · ");
      routePicker.add(new Option(label, routeId(route)));
    });
    const desired = previouslySelected && routes.some(function (route) {
      return routeId(route) === previouslySelected;
    }) ? previouslySelected : "";
    routePicker.value = desired;
    selectRoute(desired);
  }

  async function loadRoutes() {
    const list = await requestJson("/api/routes?scope=mine-all");
    if (!Array.isArray(list)) throw new Error("无法读取带领人线路，请刷新重试。");
    routes = list.filter(function (route) { return route && routeId(route); });
    setRouteOptions();
  }

  async function signedIn(username) {
    leader = username;
    $("#leaderName").textContent = username;
    show(editorView);
    try {
      await loadRoutes();
    } catch (error) {
      routes = [];
      setRouteOptions();
      status($("#saveState"), "无法加载旧线路，仍可新建；修改旧线路请稍后重试。");
    }
  }

  async function startup() {
    try {
      const session = await requestJson("/api/auth/session");
      if (!session || !session.leader) throw new Error("unauthorized");
      await signedIn(session.leader);
    } catch (_error) {
      show(loginView);
    }
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    status($("#loginMessage"), "正在验证身份…");
    try {
      const data = await postJson("/api/auth/login", {
        email: String(loginForm.elements.username.value || "").trim().toLowerCase(),
        password: loginForm.elements.password.value
      });
      loginForm.elements.password.value = "";
      status($("#loginMessage"), "");
      await signedIn(data.leader);
    } catch (error) {
      status($("#loginMessage"), error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#logoutButton").addEventListener("click", async function () {
    try {
      await postJson("/api/auth/logout", {});
    } catch (_error) {
      // UI still requires a fresh login; server cookie may expire on its own.
    }
    leader = "";
    routes = [];
    selectedRoute = null;
    routeForm.reset();
    show(loginView);
    status($("#loginMessage"), "如仍能自动登录，请在原帐篷中退出会话。");
  });

  routePicker.addEventListener("change", function () { selectRoute(routePicker.value); });
  routeForm.addEventListener("input", writeDraft);
  routeForm.addEventListener("change", writeDraft);
  coverFile.addEventListener("change", updateImageNotes);
  qrFile.addEventListener("change", updateImageNotes);

  function validateForm() {
    const values = readFields();
    for (const name of ["title", "date", "time", "location", "meetingPlace"]) {
      if (!values[name]) {
        const input = field(name);
        input.setAttribute("aria-invalid", "true");
        input.focus();
        throw new Error("请填写「" + labels[name] + "」。");
      }
      field(name).removeAttribute("aria-invalid");
    }
    const date = values.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date) {
      field("date").focus();
      throw new Error("请选择有效的活动日期。");
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time)) {
      field("time").focus();
      throw new Error("请选择有效的集合时间。");
    }
    return values;
  }

  function addDetail(parent, label, value) {
    if (!value) return;
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    parent.append(dt, dd);
  }

  function disposePreviewImage() {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = "";
  }

  function renderPreview(data) {
    disposePreviewImage();
    $("#previewTitle").textContent = data.title;
    $("#previewSummary").textContent = (calendarTypes[data.calendarType] || "同行") + " · " +
      data.date + " " + data.time + " · " + data.location;
    const details = $("#previewDetails");
    details.replaceChildren();
    [
      ["集合地点", data.meetingPlace],
      ["线路难度", data.difficulty],
      ["总里程", data.distance],
      ["累计爬升", data.elevation],
      ["预计耗时", data.duration],
      ["适合人群", data.suitableFor],
      ["装备下限", data.equipmentMinimum],
      ["路面信息", data.surface],
      ["参与者要求", data.participantRequirements],
      ["活动二维码", qrFile.files[0] ? "已选择新二维码" : selectedRoute && selectedRoute.qrCode ? "沿用现有二维码" : "未提供"]
    ].forEach(function (entry) { addDetail(details, entry[0], entry[1]); });
    $("#previewDescription").textContent = data.description || "未填写行程说明。";

    const image = coverFile.files && coverFile.files[0];
    const existing = selectedRoute && selectedRoute.image;
    const coverUrl = image ? URL.createObjectURL(image) : existing || "";
    if (image) previewObjectUrl = coverUrl;
    const wrapper = $("#previewImageWrap");
    wrapper.hidden = !coverUrl;
    $("#previewImage").src = coverUrl;
  }

  routeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    try {
      pendingRoute = validateForm();
      renderPreview(pendingRoute);
      status($("#publishMessage"), "");
      show(previewView);
    } catch (error) {
      status($("#saveState"), error.message);
    }
  });

  $("#backButton").addEventListener("click", function () {
    disposePreviewImage();
    show(editorView);
  });

  function imageFromFile(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("这张照片无法在手机浏览器中读取，请改用截图或 JPEG 图片。"));
      };
      image.src = url;
    });
  }

  function fileBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const encoded = String(reader.result || "");
        const comma = encoded.indexOf(",");
        if (comma < 0) return reject(new Error("无法读取图片文件。"));
        resolve(encoded.slice(comma + 1));
      };
      reader.onerror = function () { reject(new Error("无法读取图片文件。")); };
      reader.readAsDataURL(file);
    });
  }

  function encodeCanvas(canvas, mimeType, quality) {
    const raw = canvas.toDataURL(mimeType, quality);
    const comma = raw.indexOf(",");
    return { mimeType: raw.slice(5, raw.indexOf(";")), data: raw.slice(comma + 1) };
  }

  async function imagePayload(file, kind) {
    if (!file) return null;
    if (file.size > 20 * 1024 * 1024) throw new Error("请选择小于 20MB 的原始图片。");
    const supported = ["image/jpeg", "image/png", "image/webp"];
    if (supported.includes(file.type) && file.size <= 2 * 1024 * 1024) {
      return { mimeType: file.type, data: await fileBase64(file) };
    }
    const image = await imageFromFile(file);
    const sourceW = image.naturalWidth || image.width;
    const sourceH = image.naturalHeight || image.height;
    if (!sourceW || !sourceH) throw new Error("图片尺寸无效。");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理图片，请尝试在系统浏览器打开。");

    if (kind === "cover") {
      canvas.width = 1280;
      canvas.height = 720;
      const scale = Math.max(canvas.width / sourceW, canvas.height / sourceH);
      const sw = canvas.width / scale;
      const sh = canvas.height / scale;
      context.drawImage(image, (sourceW - sw) / 2, (sourceH - sh) / 2, sw, sh,
        0, 0, canvas.width, canvas.height);
      return encodeCanvas(canvas, "image/jpeg", 0.76);
    }

    // QR code must remain whole: downscale without cropping or distorting.
    const scale = Math.min(1, 1400 / Math.max(sourceW, sourceH));
    canvas.width = Math.max(1, Math.round(sourceW * scale));
    canvas.height = Math.max(1, Math.round(sourceH * scale));
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = encodeCanvas(canvas, "image/png");
    if (png.data.length <= 2.6 * 1024 * 1024) return png;
    return encodeCanvas(canvas, "image/jpeg", 0.88);
  }

  async function uploadFile(file, kind) {
    if (!file) return "";
    const body = await imagePayload(file, kind);
    if (!body) return "";
    if (body.data.length > 2.8 * 1024 * 1024) {
      throw new Error("图片压缩后仍然太大，请重新选择较小的图片。");
    }
    const result = await postJson("/api/upload-route-image", body);
    if (!result || !result.url) throw new Error("图片上传未返回有效地址。");
    return result.url;
  }

  publishButton.addEventListener("click", async function () {
    if (previewOnly) {
      status($("#publishMessage"), "开发预览站不能写入正式线路库，请待审核上线后使用。");
      return;
    }
    if (submitting || !pendingRoute) return;
    submitting = true;
    publishButton.disabled = true;
    const payload = Object.assign({}, pendingRoute);
    if (selectedRoute) {
      payload.id = routeId(selectedRoute);
      payload.routeId = routeId(selectedRoute);
    }
    try {
      const newCover = coverFile.files && coverFile.files[0];
      const newQr = qrFile.files && qrFile.files[0];
      status($("#publishMessage"), "正在保存图片与线路，请保持页面开启…");
      if (newCover) {
        status($("#publishMessage"), "正在上传线路封面…");
        payload.image = await uploadFile(newCover, "cover");
        payload.imageAlt = payload.title;
      } else if (selectedRoute && selectedRoute.image) {
        payload.image = selectedRoute.image;
        payload.imageAlt = selectedRoute.imageAlt || payload.title;
      }
      if (newQr) {
        status($("#publishMessage"), "正在上传活动二维码…");
        payload.qrCode = await uploadFile(newQr, "qr");
      } else if (selectedRoute && selectedRoute.qrCode) {
        payload.qrCode = selectedRoute.qrCode;
      }
      status($("#publishMessage"), "正在写入步道线路库…");
      const published = await postJson("/api/publish-route-v2", payload);
      if (!published || !published.ok) throw new Error("发布结果未确认，请检查线路后再尝试。");
      clearDraft();
      disposePreviewImage();
      show(successView);
      // Refresh selection data without making a successful publication look failed.
      try {
        await loadRoutes();
      } catch (_error) {}
    } catch (error) {
      if (error.status === 401) {
        show(loginView);
        status($("#loginMessage"), errorText("unauthorized"));
      } else {
        status($("#publishMessage"), error.message);
      }
    } finally {
      submitting = false;
      publishButton.disabled = false;
    }
  });

  $("#continueButton").addEventListener("click", function () {
    pendingRoute = null;
    show(editorView);
  });

  startup();
}());