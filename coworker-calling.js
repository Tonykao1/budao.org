
(function () {
  "use strict";
  const API = "/api/eebee?service=coworker";
  const openButton = document.getElementById("respondCalling");
  const modal = document.getElementById("callingDialog");
  const closeButton = document.getElementById("callingClose");
  const form = document.getElementById("callingForm");
  const image = document.getElementById("callingCaptchaImage");
  const refresh = document.getElementById("callingRefresh");
  const feedback = document.getElementById("callingFeedback");
  const listing = document.getElementById("callingResponses");
  const listArea = document.getElementById("callingResponsesSection");
  const more = document.getElementById("callingMore");
  const adminArea = document.getElementById("callingAdmin");
  const adminList = document.getElementById("callingAdminList");
  if (!openButton || !modal || !form || !listing) return;

  let captchaToken = "";
  let entries = [];
  let adminEntries = null;
  let expanded = false;
  let highlight = "";
  const submitButton = form.querySelector("[type=submit]");

  async function request(url, options) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    let result;
    try { result = await response.json(); } catch (_) { result = {}; }
    if (!response.ok || !result.ok) {
      const err = new Error(result.reason || "service_unavailable");
      err.status = response.status;
      throw err;
    }
    return result;
  }
  function message(error) {
    const reason = String(error && error.message || error || "");
    if (reason === "invalid_captcha" || reason === "captcha_used") return "验证码不正确或已失效，请更换后重试。";
    if (reason === "rate_limited") return "操作过于频繁，请稍后再尝试。";
    if (reason === "invalid_fields_or_consent") return "请填写全部信息，并确认公开展示说明。";
    return "暂时无法完成提交，请稍后再试。";
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function region(item) {
    return [item.country, item.province, item.city].filter(Boolean).join(" · ");
  }
  function renderList() {
    listing.replaceChildren();
    listArea.hidden = entries.length === 0;
    const visible = expanded ? entries : entries.slice(0, 6);
    visible.forEach(item => {
      const article = el("article", "calling-person");
      article.appendChild(el("span","calling-dot"));
      const content = el("div","calling-person-content");
      content.appendChild(el("p","calling-location",region(item)));
      content.appendChild(el("h3","calling-name",item.name));
      content.appendChild(el("p","calling-state","已回应呼召"));
      if (item.id === highlight) article.classList.add("calling-new");
      article.appendChild(content);
      listing.appendChild(article);
    });
    more.hidden = entries.length <= 6;
    more.textContent = expanded ? "收起回应" : "阅读更多回应";
  }
  async function refreshList() {
    const result = await request(API + "&view=public");
    entries = result.items || [];
    renderList();
  }
  async function refreshCaptcha() {
    captchaToken = "";
    image.removeAttribute("src");
    image.alt = "正在加载数字验证码";
    refresh.disabled = true;
    try {
      const result = await request(API + "&view=captcha");
      captchaToken = result.captcha.token;
      image.src = result.captcha.image;
      image.alt = "请辨认图中的五位数字";
      feedback.textContent = "";
    } catch (error) {
      feedback.textContent = message(error);
    } finally {
      refresh.disabled = false;
    }
  }
  function close() {
    modal.hidden = true;
    document.body.classList.remove("calling-dialog-open");
    openButton.focus();
  }
  async function open() {
    form.reset();
    feedback.textContent = "";
    modal.hidden = false;
    document.body.classList.add("calling-dialog-open");
    form.elements.country.focus();
    await refreshCaptcha();
  }
  openButton.addEventListener("click",open);
  closeButton.addEventListener("click",close);
  modal.addEventListener("click",event => {
    if (event.target === modal) close();
  });
  document.addEventListener("keydown",event => {
    if (event.key === "Escape" && !modal.hidden) close();
  });
  refresh.addEventListener("click",refreshCaptcha);
  more.addEventListener("click",() => {
    expanded = !expanded;
    renderList();
  });

  form.addEventListener("submit",async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!captchaToken) {
      feedback.textContent = "请先完成数字验证。";
      return;
    }
    submitButton.disabled = true;
    feedback.textContent = "正在确认回应…";
    const body = {
      action: "respond",
      country: form.elements.country.value,
      province: form.elements.province.value,
      city: form.elements.city.value,
      name: form.elements.displayName.value,
      consent: form.elements.consent.checked,
      website: form.elements.website.value,
      captchaToken,
      captchaCode: form.elements.captcha.value.trim()
    };
    try {
      const result = await request(API, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(body)
      });
      highlight = result.item.id;
      modal.hidden = true;
      document.body.classList.remove("calling-dialog-open");
      await refreshList();
      listArea.scrollIntoView({behavior:"smooth",block:"center"});
      if (adminEntries) await refreshAdmin();
    } catch (error) {
      feedback.textContent = message(error);
      if (error.message === "invalid_captcha" || error.message === "captcha_used") {
        await refreshCaptcha();
        feedback.textContent = "验证码不正确或已失效，已为你更换一组数字。";
      }
    } finally {
      submitButton.disabled = false;
    }
  });

  function actionButton(text, action, item) {
    const button = el("button","calling-admin-action",text);
    button.type = "button";
    button.addEventListener("click", async () => {
      let payload = { action, id:item.id };
      if (action === "edit") {
        const country = prompt("国家 / 地区",item.country);
        if (country === null) return;
        const province = prompt("省 / 州",item.province);
        if (province === null) return;
        const city = prompt("城市 / 区域",item.city);
        if (city === null) return;
        const name = prompt("姓名",item.name);
        if (name === null) return;
        payload = {...payload,country,province,city,name};
      } else if (!confirm(action === "withdraw" ? "确认撤下这条回应？" : "确认恢复公开展示？")) {
        return;
      }
      button.disabled = true;
      try {
        await request(API,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(payload)
        });
        await Promise.all([refreshAdmin(),refreshList()]);
      } catch (error) {
        alert("未能完成操作，请重新登录或稍后再试。");
        button.disabled = false;
      }
    });
    return button;
  }
  function renderAdmin() {
    if (!adminEntries) return;
    adminArea.hidden = false;
    adminList.replaceChildren();
    adminEntries.forEach(item => {
      const row = el("div","calling-admin-row");
      row.appendChild(el("span","",region(item)+" · "+item.name+
        (item.status==="HIDDEN" ? "（已撤下）" : "")));
      row.appendChild(actionButton("修改","edit",item));
      row.appendChild(actionButton(item.status==="HIDDEN" ? "恢复" : "撤下",
        item.status==="HIDDEN" ? "restore" : "withdraw",item));
      adminList.appendChild(row);
    });
  }
  async function refreshAdmin() {
    const result = await request(API+"&view=admin");
    adminEntries = result.items || [];
    renderAdmin();
  }
  refreshList().catch(() => {
    listArea.hidden = true;
  });
  refreshAdmin().catch(() => {
    adminArea.hidden = true;
  });
})();
