(function () {
  const form = document.querySelector(".word-form");
  const message = document.querySelector(".word-message");
  const publishButton = document.querySelector(".word-send");
  const storageKey = "budao.tent.word";
  const presence = document.querySelector(".presence");

  function ensureAltarStyles() {
    if (document.getElementById("altar-cornerstone-style")) return;
    const style = document.createElement("style");
    style.id = "altar-cornerstone-style";
    style.textContent = [
      ".altar-cornerstone{position:absolute;right:50px;bottom:40px;width:74px;height:42px;border:0;background:linear-gradient(155deg,rgba(108,102,91,.12),rgba(45,43,40,.22));clip-path:polygon(9% 24%,35% 8%,79% 16%,96% 46%,83% 84%,42% 96%,10% 76%,0 48%);cursor:pointer;opacity:.38;transition:opacity .35s ease,transform .35s ease;z-index:12;color:rgba(216,209,194,.64);font:400 12px/1 serif;letter-spacing:.24em;}",
      ".altar-cornerstone span{opacity:0;transition:opacity .35s ease;white-space:nowrap;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);}",
      ".altar-cornerstone:hover,.altar-cornerstone:focus-visible{opacity:.72;transform:translateY(-1px);outline:none;}",
      ".altar-cornerstone:hover span,.altar-cornerstone:focus-visible span{opacity:.7;}",
      "@media (max-width:620px){.altar-cornerstone{right:20px;bottom:22px;width:62px;height:36px;}}"
    ].join("");
    document.head.appendChild(style);
  }

  function removeAltarCornerstone() {
    const existing = document.querySelector(".altar-cornerstone");
    if (existing) existing.remove();
  }

  function renderAltarCornerstone() {
    if (!presence || document.querySelector(".altar-cornerstone")) return;
    ensureAltarStyles();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "altar-cornerstone";
    button.setAttribute("aria-label", "祭坛");
    const label = document.createElement("span");
    label.textContent = "祭坛";
    button.appendChild(label);
    button.addEventListener("click", function () {
      window.location.href = "/altar.html";
    });
    presence.appendChild(button);
  }

  function refreshAltarCapability() {
    if (!presence || !presence.classList.contains("entrance-open")) return;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("session_unavailable");
        return response.json();
      })
      .then(function (session) {
        if (session && session.capabilities && session.capabilities.steward === true) {
          renderAltarCornerstone();
        } else {
          removeAltarCornerstone();
        }
      })
      .catch(removeAltarCornerstone);
  }

  if (presence && window.MutationObserver) {
    const observer = new MutationObserver(function () {
      if (presence.classList.contains("entrance-open")) refreshAltarCapability();
      else removeAltarCornerstone();
    });
    observer.observe(presence, { attributes: true, attributeFilter: ["class"] });
  }

  if (!form) {
    return;
  }

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
      scripture: valueOf("scripture"),
      scriptureText: valueOf("scriptureText"),
      theme: valueOf("theme"),
      questions: Array.from({ length: 7 }, function (_, index) {
        return valueOf("question" + (index + 1));
      }),
      story: valueOf("story"),
      highlights: valueOf("highlights"),
      response: valueOf("response"),
      prayer: valueOf("prayer")
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

    setValue("scripture", record.scripture);
    setValue("scriptureText", record.scriptureText);
    setValue("theme", record.theme);
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
      placeWord("这一程，已经被安静预备。");
    });
  }

  window.BudaoTentWord = {
    collect: collectWordRecord,
    load: readSavedWordRecord
  };
}());
