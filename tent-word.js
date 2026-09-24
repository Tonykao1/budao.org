(function () {
  const form = document.querySelector(".word-form");
  const message = document.querySelector(".word-message");
  const publishButton = document.querySelector(".word-send");
  const storageKey = "budao.tent.word";
  const publishEndpoint = window.location.protocol === "file:" ?
    "https://budao.org/api/publish-route-v2?kind=dao" :
    "/api/publish-route-v2?kind=dao";
  const libraryEndpoint = window.location.protocol === "file:" ?
    "https://budao.org/api/routes?kind=dao-mine" :
    "/api/routes?kind=dao-mine";

  let myDaoItems = [];
  let currentLibraryStatus = "PENDING_REVIEW";
  let editingReturnedDaoCode = "";
  let library;
  let libraryList;
  let libraryStatus;
  let libraryRefresh;
  let revisionBanner;

  if (!form) {
    return;
  }

  ensureDaoFields();
  markRequiredFields();
  ensureDaoLibrary();
  ensureRevisionBanner();

  function valueOf(name) {
    const field = form.elements[name];
    return field ? field.value.trim() : "";
  }

  function setValue(name, value) {
    if (form.elements[name]) {
      form.elements[name].value = value || "";
    }
  }

  function collectWordRecord() {
    return {
      devotionalDate: valueOf("devotionalDate"),
      scripture: valueOf("scripture"),
      scriptureText: valueOf("scriptureText"),
      translation: valueOf("translation") || "和合本",
      theme: valueOf("theme"),
      cardIntro: valueOf("cardIntro"),
      questions: Array.from({ length: 7 }, function (_, index) {
        return valueOf("question" + (index + 1));
      }),
      story: valueOf("story"),
      highlights: valueOf("highlights"),
      response: valueOf("response"),
      prayer: valueOf("prayer"),
      publicationTimezone: browserTimezone(),
      publicationLocale: navigator.language || "zh-CN"
    };
  }

  function readSavedWordRecord() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (error) {
      return {};
    }
  }

  function fillWordForm(record) {
    if (!record) {
      return;
    }

    const scripture = record.scripture && typeof record.scripture === "object" ? record.scripture : null;
    setValue("devotionalDate", record.devotionalDate || localDate());
    setValue("scripture", scripture ? scripture.referenceDisplay : record.scripture);
    setValue("scriptureText", record.scriptureText || scripture && scripture.text || "");
    setValue("translation", record.translation || scripture && scripture.translation || "和合本");
    setValue("theme", record.theme);
    setValue("cardIntro", record.cardIntro);
    setValue("story", record.story);
    setValue("highlights", record.highlights);
    setValue("response", record.response);
    setValue("prayer", record.prayer);

    const questions = Array.isArray(record.questions) ? record.questions : [];
    Array.from({ length: 7 }, function (_, index) {
      const question = questions[index];
      setValue("question" + (index + 1), question && typeof question === "object" ? question.text : question || "");
    });
  }

  function placeWord(text) {
    window.localStorage.setItem(storageKey, JSON.stringify(collectWordRecord()));
    if (message) {
      message.textContent = text;
    }
  }

  function publishWord() {
    const record = collectWordRecord();
    window.localStorage.setItem(storageKey, JSON.stringify(record));

    if (!form.reportValidity()) {
      if (message) message.textContent = "还有内容没有安放完整。";
      return Promise.resolve();
    }

    setPublishing(true);
    if (message) message.textContent = editingReturnedDaoCode ? "正在重新查验，并送回道池……" : "正在查验，并送入道池……";

    return sendDaoRequest(record).then(function (result) {
      const dao = result.dao || {};
      if (message) {
        const lead = result.resubmitted ? "已重新进入道池，等待查验。" : "已进入道池，等待查验。";
        message.textContent = lead + (dao.daoCode ? " 道号：" + dao.daoCode : "");
      }
      clearRevisionMode();
      currentLibraryStatus = "PENDING_REVIEW";
      return loadMyDaos().then(function () { return result; });
    }).catch(function (error) {
      if (message) message.textContent = publishFailureText(error);
    }).finally(function () {
      setPublishing(false);
    });
  }

  function sendDaoRequest(record) {
    return sendJsonRequest("POST", publishEndpoint, record);
  }

  function sendJsonRequest(method, endpoint, body) {
    return new Promise(function (resolve, reject) {
      const request = new XMLHttpRequest();
      request.open(method, endpoint, true);
      request.setRequestHeader("Accept", "application/json");
      if (method !== "GET") request.setRequestHeader("Content-Type", "application/json");

      request.onreadystatechange = function () {
        if (request.readyState !== XMLHttpRequest.DONE) return;

        let payload = {};
        try {
          payload = JSON.parse(request.responseText || "{}");
        } catch (error) {
          payload = {};
        }

        if (request.status >= 200 && request.status < 300 && payload.ok !== false) {
          resolve(payload);
          return;
        }

        const failure = new Error(payload.reason || "request_failed");
        failure.reason = payload.reason || "request_failed";
        failure.status = request.status;
        reject(failure);
      };

      request.onerror = function () {
        const failure = new Error("network_failed");
        failure.reason = "network_failed";
        failure.status = 0;
        reject(failure);
      };

      request.send(method === "GET" ? null : JSON.stringify(body || {}));
    });
  }

  function publishFailureText(error) {
    const reason = error && error.reason || "";
    const messages = {
      unauthorized: "登录已经失效，请重新进入帐篷。",
      forbidden: "这次提交没有通过安全校验，请重新进入帐篷。",
      rate_limited: "提交得太快了，请稍后再试。",
      publishing_unavailable: "道池暂时无法接收新的内容。",
      dao_storage_unavailable: "道池暂时无法写入，请稍后再试。",
      invalid_scripture_reference: "经文出处暂时无法识别，请使用例如“马太福音 7:13-14”的格式。",
      scripture_text_required: "请补全经文内容。",
      theme_required: "请补全本篇主题。",
      card_intro_required: "请写下道卡的短引言。",
      seven_questions_required: "七问必须全部完成后才能进入道池。",
      invalid_devotional_date: "请确认灵修日期。",
      invalid_timezone: "当前时区无法识别，请刷新页面后再试。",
      field_too_long: "有一项内容超过当前长度限制，请检查较长的经文、问题、故事、回应或祷告。",
      invalid_request: "这次提交的数据结构异常，请刷新页面后再试。",
      bad_json: "这次提交的数据没有被完整读取，请刷新页面后再试。",
      unknown_field: "这次提交仍被旧模块加入了不属于“道”的字段，请刷新到最新预览版后再试。",
      invalid_dao: "这次提交的数据结构不完整，请刷新预览页后再试。",
      duplicate_dao_code: "这个日期与经文已经存在一道；待查验内容不能被另一份内容覆盖。若它已退回，请从“我的道 · 已退回”继续修改。",
      dao_frozen: "这篇道已经查验通过并冻结，不能再以同一道号修改。",
      payload_too_large: "这一道的内容过长，暂时无法送入道池。",
      network_failed: "网络没有完成这次提交，请稍后再试。"
    };

    if (messages[reason]) return messages[reason];
    return reason
      ? "这一道暂时没有进入道池。错误码：" + reason + "。"
      : "这一道暂时没有进入道池，请稍后再试。";
  }

  function setPublishing(publishing) {
    if (!publishButton) return;
    publishButton.disabled = publishing;
    publishButton.setAttribute("aria-busy", publishing ? "true" : "false");
  }

  function ensureDaoFields() {
    if (!form.elements.devotionalDate) {
      const scriptureField = form.elements.scripture && form.elements.scripture.closest(".word-field");
      const label = document.createElement("label");
      label.className = "word-field";
      label.innerHTML = '<span>灵修日期</span><input name="devotionalDate" type="date" autocomplete="off">';
      if (scriptureField) scriptureField.insertAdjacentElement("beforebegin", label);
    }

    if (!form.elements.translation) {
      const scriptureTextField = form.elements.scriptureText && form.elements.scriptureText.closest(".word-field");
      const label = document.createElement("label");
      label.className = "word-field";
      label.innerHTML = '<span>圣经译本</span><input name="translation" type="text" autocomplete="off" value="和合本">';
      if (scriptureTextField) scriptureTextField.insertAdjacentElement("afterend", label);
    }

    if (!form.elements.cardIntro) {
      const themeField = form.elements.theme && form.elements.theme.closest(".word-field");
      const label = document.createElement("label");
      label.className = "word-field";
      label.innerHTML = '<span>道卡短引言</span><textarea name="cardIntro" rows="3" placeholder="把人重新带回这篇道面前的一两句话"></textarea>';
      if (themeField) themeField.insertAdjacentElement("afterend", label);
    }

    if (!valueOf("devotionalDate")) setValue("devotionalDate", localDate());
  }

  function markRequiredFields() {
    ["devotionalDate", "scripture", "scriptureText", "theme", "cardIntro"].forEach(function (name) {
      if (form.elements[name]) form.elements[name].required = true;
    });

    Array.from({ length: 7 }, function (_, index) {
      return "question" + (index + 1);
    }).forEach(function (name) {
      if (form.elements[name]) form.elements[name].required = true;
    });
  }

  function ensureDaoLibrary() {
    if (library) return library;
    library = document.createElement("section");
    library.className = "word-library";
    library.setAttribute("aria-label", "我的道");
    library.innerHTML =
      '<div class="word-library-head">' +
        '<div><h2>我的道</h2><p>待查验、退回与已经冻结的记录</p></div>' +
        '<button type="button" class="word-library-refresh">刷新</button>' +
      '</div>' +
      '<div class="word-library-tabs" role="tablist" aria-label="我的道状态">' +
        '<button type="button" role="tab" data-dao-status="PENDING_REVIEW">待查验 <small>0</small></button>' +
        '<button type="button" role="tab" data-dao-status="RETURNED">已退回 <small>0</small></button>' +
        '<button type="button" role="tab" data-dao-status="PUBLISHED">已发布 <small>0</small></button>' +
      '</div>' +
      '<p class="word-library-status" role="status">进入“道”后会读取你的记录。</p>' +
      '<div class="word-library-list" aria-live="polite"></div>';

    form.parentNode.insertBefore(library, form);
    libraryList = library.querySelector(".word-library-list");
    libraryStatus = library.querySelector(".word-library-status");
    libraryRefresh = library.querySelector(".word-library-refresh");

    library.querySelectorAll("[data-dao-status]").forEach(function (button) {
      button.addEventListener("click", function () {
        currentLibraryStatus = button.getAttribute("data-dao-status");
        renderMyDaos();
      });
    });

    if (libraryRefresh) libraryRefresh.addEventListener("click", loadMyDaos);
    renderMyDaos();
    return library;
  }

  function ensureRevisionBanner() {
    revisionBanner = document.createElement("section");
    revisionBanner.className = "word-revision-banner";
    revisionBanner.hidden = true;

    const text = document.createElement("p");
    text.className = "word-revision-text";
    const leave = document.createElement("button");
    leave.type = "button";
    leave.textContent = "退出修订";
    leave.addEventListener("click", function () {
      clearRevisionMode();
      if (message) message.textContent = "已退出退回修订；当前内容仍保留在表格中。";
    });

    revisionBanner.appendChild(text);
    revisionBanner.appendChild(leave);
    form.parentNode.insertBefore(revisionBanner, form);
  }

  function loadMyDaos() {
    ensureDaoLibrary();
    if (libraryRefresh) libraryRefresh.disabled = true;
    if (libraryStatus) libraryStatus.textContent = "正在读取你的道……";

    return sendJsonRequest("GET", libraryEndpoint).then(function (body) {
      myDaoItems = Array.isArray(body.items) ? body.items : [];
      if (myDaoItems.some(function (item) { return item.status === "RETURNED"; }) &&
          !myDaoItems.some(function (item) { return item.status === currentLibraryStatus; })) {
        currentLibraryStatus = "RETURNED";
      }
      renderMyDaos();
      return body;
    }).catch(function (error) {
      myDaoItems = [];
      renderMyDaos();
      if (!libraryStatus) return;
      libraryStatus.textContent = error.reason === "unauthorized" ?
        "尚未登录，或登录已经失效。请重新进入帐篷。" :
        "暂时无法读取“我的道”，请稍后再试。";
    }).finally(function () {
      if (libraryRefresh) libraryRefresh.disabled = false;
    });
  }

  function renderMyDaos() {
    if (!library || !libraryList) return;

    const counts = {
      PENDING_REVIEW: 0,
      RETURNED: 0,
      PUBLISHED: 0
    };
    myDaoItems.forEach(function (item) {
      if (counts[item.status] !== undefined) counts[item.status] += 1;
    });

    library.querySelectorAll("[data-dao-status]").forEach(function (button) {
      const status = button.getAttribute("data-dao-status");
      button.classList.toggle("is-active", status === currentLibraryStatus);
      button.setAttribute("aria-selected", status === currentLibraryStatus ? "true" : "false");
      const count = button.querySelector("small");
      if (count) count.textContent = String(counts[status] || 0);
    });

    libraryList.replaceChildren();
    const visible = myDaoItems.filter(function (item) { return item.status === currentLibraryStatus; });
    if (libraryStatus) {
      libraryStatus.textContent = visible.length ? "共 " + visible.length + " 篇。" : emptyStatusText(currentLibraryStatus);
    }

    visible.forEach(function (item) {
      libraryList.appendChild(daoLibraryCard(item));
    });
  }

  function daoLibraryCard(item) {
    const card = document.createElement("article");
    card.className = "word-library-card";
    card.setAttribute("data-dao-code", item.daoCode || "");

    const header = document.createElement("div");
    header.className = "word-library-card-head";
    const titleWrap = document.createElement("div");
    const code = document.createElement("p");
    code.className = "word-library-code";
    code.textContent = item.daoCode || "";
    const title = document.createElement("h3");
    title.textContent = item.theme || "未命名";
    titleWrap.appendChild(code);
    titleWrap.appendChild(title);

    const state = document.createElement("span");
    state.className = "word-library-state";
    state.textContent = statusLabel(item.status);
    header.appendChild(titleWrap);
    header.appendChild(state);
    card.appendChild(header);

    const meta = document.createElement("p");
    meta.className = "word-library-meta";
    const scripture = item.scripture && item.scripture.referenceDisplay || "";
    meta.textContent = [item.devotionalDate || "", scripture].filter(Boolean).join(" · ");
    card.appendChild(meta);

    if (item.status === "RETURNED") {
      const note = document.createElement("div");
      note.className = "word-library-review-note";
      const label = document.createElement("strong");
      label.textContent = "查验备注";
      const body = document.createElement("p");
      body.textContent = item.review && item.review.notes ? item.review.notes : "查验者没有留下文字备注。";
      note.appendChild(label);
      note.appendChild(body);
      card.appendChild(note);

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "word-library-edit";
      edit.textContent = "继续修改";
      edit.addEventListener("click", function () { beginReturnedRevision(item); });
      card.appendChild(edit);
    } else if (item.status === "PUBLISHED") {
      const frozen = document.createElement("p");
      frozen.className = "word-library-frozen";
      frozen.textContent = "内容已经冻结；新的改变需要成为一道新的道。";
      card.appendChild(frozen);
    }

    return card;
  }

  function beginReturnedRevision(item) {
    fillWordForm(item);
    editingReturnedDaoCode = item.daoCode || "";
    setIdentityLocked(true);
    window.localStorage.setItem(storageKey, JSON.stringify(collectWordRecord()));

    if (revisionBanner) {
      revisionBanner.hidden = false;
      const text = revisionBanner.querySelector(".word-revision-text");
      if (text) {
        const note = item.review && item.review.notes ? " 查验备注：“" + item.review.notes + "”" : "";
        text.textContent = "正在修订 " + editingReturnedDaoCode + "。灵修日期与经文出处已锁定，以保留原道号。" + note;
      }
    }

    if (message) message.textContent = "已把退回内容完整载入表格。修改后可直接重新发布。";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearRevisionMode() {
    editingReturnedDaoCode = "";
    setIdentityLocked(false);
    if (revisionBanner) revisionBanner.hidden = true;
  }

  function setIdentityLocked(locked) {
    ["devotionalDate", "scripture"].forEach(function (name) {
      const field = form.elements[name];
      if (!field) return;
      field.disabled = Boolean(locked);
      const label = field.closest(".word-field");
      if (label) label.classList.toggle("is-identity-locked", Boolean(locked));
    });
  }

  function statusLabel(status) {
    if (status === "RETURNED") return "已退回";
    if (status === "PUBLISHED") return "已冻结";
    return "待查验";
  }

  function emptyStatusText(status) {
    if (status === "RETURNED") return "目前没有被退回的道。";
    if (status === "PUBLISHED") return "目前还没有已经发布并冻结的道。";
    return "目前没有等待查验的道。";
  }

  function localDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function browserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
    } catch (error) {
      return "Asia/Shanghai";
    }
  }

  document.querySelectorAll('[data-tent-path="word"]').forEach(function (button) {
    button.addEventListener("click", function () {
      fillWordForm(readSavedWordRecord());
      loadMyDaos();
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    placeWord("这一程，已经暂时安放。");
  });

  if (publishButton) {
    publishButton.addEventListener("click", function () {
      publishWord();
    });
  }

  fillWordForm(readSavedWordRecord());

  window.BudaoTentWord = {
    collect: collectWordRecord,
    load: readSavedWordRecord,
    loadMine: loadMyDaos,
    publish: publishWord
  };
}());
