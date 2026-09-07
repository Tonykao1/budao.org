(function () {
  const form = document.querySelector(".word-form");
  const message = document.querySelector(".word-message");
  const publishButton = document.querySelector(".word-send");
  const storageKey = "budao.tent.word";
  const publishEndpoint = window.location.protocol === "file:" ?
    "https://budao.org/api/publish-route-v2?kind=dao" :
    "/api/publish-route-v2?kind=dao";

  if (!form) {
    return;
  }

  ensureDaoFields();
  markRequiredFields();

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

    setValue("devotionalDate", record.devotionalDate || localDate());
    setValue("scripture", record.scripture);
    setValue("scriptureText", record.scriptureText);
    setValue("translation", record.translation || "和合本");
    setValue("theme", record.theme);
    setValue("cardIntro", record.cardIntro);
    setValue("story", record.story);
    setValue("highlights", record.highlights);
    setValue("response", record.response);
    setValue("prayer", record.prayer);

    const questions = Array.isArray(record.questions) ? record.questions : [];
    questions.slice(0, 7).forEach(function (question, index) {
      setValue("question" + (index + 1), question);
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
    if (message) message.textContent = "正在查验，并送入道池……";

    return fetch(publishEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(record)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok || body.ok === false) {
          const error = new Error(body.reason || "publish_failed");
          error.reason = body.reason || "publish_failed";
          error.status = response.status;
          throw error;
        }
        return body;
      });
    }).then(function (result) {
      const dao = result.dao || {};
      if (message) {
        message.textContent = "已进入道池，等待查验。" + (dao.daoCode ? " 道号：" + dao.daoCode : "");
      }
    }).catch(function (error) {
      if (message) message.textContent = publishFailureText(error);
    }).finally(function () {
      setPublishing(false);
    });
  }

  function publishFailureText(error) {
    const reason = error && error.reason || "";
    const messages = {
      unauthorized: "登录已经失效，请重新进入帐篷。",
      forbidden: "这次提交没有通过安全校验，请重新进入帐篷。",
      rate_limited: "提交得太快了，请稍后再试。",
      publishing_unavailable: "道池暂时无法接收新的内容。",
      invalid_scripture_reference: "经文出处暂时无法识别，请使用例如“马太福音 7:13-14”的格式。",
      scripture_text_required: "请补全经文内容。",
      theme_required: "请补全本篇主题。",
      card_intro_required: "请写下道卡的短引言。",
      seven_questions_required: "七问必须全部完成后才能进入道池。",
      invalid_devotional_date: "请确认灵修日期。",
      invalid_timezone: "当前时区无法识别，请刷新页面后再试。",
      duplicate_dao_code: "这个日期与经文已经存在一道；正式发布后的内容不可覆盖，请核对后建立新的道。",
      commit_conflict: "刚刚有其他内容同时进入道池，请再提交一次。",
      payload_too_large: "这一道的内容过长，暂时无法送入道池。"
    };

    return messages[reason] || "这一道暂时没有进入道池，请稍后再试。";
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
    publish: publishWord
  };
}());
