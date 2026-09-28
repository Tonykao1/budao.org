(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BudaoPrayerBox = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function buildPrayerPayload(values, idempotencyKey) {
    const wantsReply = values.wantsReply === true;
    return {
      body: String(values.body || "").normalize("NFC").trim(),
      visibility: values.visibility === "TRUSTED_TEAM" ? "TRUSTED_TEAM" : "LEADERS_ONLY",
      wantsReply,
      contact: wantsReply ? String(values.contact || "").normalize("NFC").trim() : "",
      website: String(values.website || ""),
      idempotencyKey
    };
  }

  function createSubmitController(options) {
    let busy = false;
    return {
      async submit(values, idempotencyKey) {
        if (busy) return { ignored: true };
        busy = true;
        options.setBusy(true);
        try {
          const response = await options.fetchImpl("/api/prayer-submit", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPrayerPayload(values, idempotencyKey))
          });
          const body = await response.json().catch(function () { return {}; });
          if (!response.ok || !body.ok) throw new Error("not_delivered");
          options.showSuccess();
          return { ok: true };
        } catch (error) {
          options.showError("暂时没有送达，请稍后再试。");
          return { ok: false };
        } finally {
          busy = false;
          options.setBusy(false);
        }
      }
    };
  }

  function createIdempotencyKey(cryptoObject) {
    if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
      return cryptoObject.randomUUID().replace(/-/g, "");
    }
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    return Array.from(bytes, function (value) { return value.toString(16).padStart(2, "0"); }).join("");
  }

  function init(documentObject, windowObject) {
    const trigger = documentObject.getElementById("prayerBoxTrigger");
    const shell = documentObject.getElementById("prayerBox");
    if (!trigger || !shell) return;

    const panel = shell.querySelector(".prayer-box-panel");
    const closeButtons = shell.querySelectorAll(".prayer-box-close, .prayer-box-backdrop, .prayer-box-return");
    const formView = shell.querySelector(".prayer-box-form-view");
    const successView = shell.querySelector(".prayer-box-success");
    const form = shell.querySelector(".prayer-box-form");
    const bodyInput = form.elements.body;
    const contactWrap = shell.querySelector(".prayer-box-contact");
    const message = shell.querySelector(".prayer-box-message");
    const submitButton = shell.querySelector(".prayer-box-submit");
    let idempotencyKey = "";
    let completed = false;

    function values() {
      return {
        body: bodyInput.value,
        visibility: form.elements.visibility.value,
        wantsReply: form.elements.wantsReply.checked,
        contact: form.elements.contact.value,
        website: form.elements.website.value
      };
    }

    function hasDraft() {
      const current = values();
      return Boolean(current.body.trim() || current.contact.trim());
    }

    function updateSubmitState() {
      submitButton.disabled = !bodyInput.value.trim() ||
        (form.elements.wantsReply.checked && !form.elements.contact.value.trim());
    }

    function open() {
      completed = false;
      formView.hidden = false;
      successView.hidden = true;
      shell.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      windowObject.requestAnimationFrame(function () { bodyInput.focus(); });
    }

    function close() {
      if (!completed && hasDraft() && !windowObject.confirm("要放下尚未送出的内容吗？")) return;
      shell.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
    }

    const controller = createSubmitController({
      fetchImpl: windowObject.fetch.bind(windowObject),
      setBusy: function (busy) {
        if (busy) submitButton.disabled = true;
        else updateSubmitState();
        submitButton.textContent = busy ? "正在送达…" : "提交祷告";
        form.setAttribute("aria-busy", busy ? "true" : "false");
      },
      showError: function (text) { message.textContent = text; },
      showSuccess: function () {
        completed = true;
        formView.hidden = true;
        successView.hidden = false;
        successView.querySelector(".prayer-box-return").focus();
      }
    });

    trigger.addEventListener("click", open);
    closeButtons.forEach(function (button) { button.addEventListener("click", close); });
    bodyInput.addEventListener("input", updateSubmitState);
    form.elements.contact.addEventListener("input", updateSubmitState);
    form.elements.wantsReply.addEventListener("change", function () {
      contactWrap.hidden = !form.elements.wantsReply.checked;
      if (contactWrap.hidden) form.elements.contact.value = "";
      updateSubmitState();
    });
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      message.textContent = "";
      if (!idempotencyKey) idempotencyKey = createIdempotencyKey(windowObject.crypto);
      const result = await controller.submit(values(), idempotencyKey);
      if (result.ok) {
        form.reset();
        contactWrap.hidden = true;
        idempotencyKey = "";
        updateSubmitState();
      }
    });
    shell.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
    });
    panel.addEventListener("click", function (event) { event.stopPropagation(); });
  }

  if (typeof document !== "undefined" && typeof window !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { init(document, window); });
    } else {
      init(document, window);
    }
  }

  return { buildPrayerPayload, createSubmitController, createIdempotencyKey, init };
});
