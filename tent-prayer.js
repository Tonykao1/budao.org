(function () {
  const presence = document.querySelector(".presence");
  const entrance = document.querySelector('[data-tent-path="prayer"]');
  const room = document.querySelector(".prayer-room");
  if (!presence || !entrance || !room) return;
  const list = room.querySelector(".prayer-list");
  const message = room.querySelector(".prayer-room-message");
  const tabs = Array.from(room.querySelectorAll("[data-prayer-status]"));
  let status = "NEW";

  entrance.addEventListener("click", function () {
    presence.classList.add("prayer-open");
    presence.classList.remove("route-open", "word-open", "path-hover");
    load();
  });
  room.querySelector(".prayer-return").addEventListener("click", function () {
    presence.classList.remove("prayer-open");
    presence.classList.add("entrance-open");
  });
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      selectStatus(tab.getAttribute("data-prayer-status"));

    });
  });

  function selectStatus(next) {
    status = next;
    tabs.forEach(function (item) {
      item.setAttribute("aria-current", String(item.getAttribute("data-prayer-status") === status));
    });
    load();
  }

  function load() {
    message.textContent = "正在取回托付…";
    fetch("/api/prayer-list?status=" + encodeURIComponent(status), { credentials: "same-origin" })
      .then(readResponse).then(function (data) { render(data.items || []); })
      .catch(function () { list.textContent = ""; message.textContent = "此刻未能取回，请稍后再来。"; });
  }

  function render(items) {
    list.textContent = "";
    message.textContent = items.length ? "" : "这里暂时没有新的托付。";
    items.forEach(function (item) {
      const card = document.createElement("article");
      card.className = "prayer-card";
      const body = document.createElement("p");
      body.textContent = item.body;
      const footer = document.createElement("footer");
      const time = document.createElement("time");
      time.textContent = quietDate(item.createdAt);
      footer.appendChild(time);
      if (item.wantsReply) {
        const note = document.createElement("span");
        note.className = "prayer-reply-note";
        note.textContent = "盼望私下回应";
        footer.appendChild(note);
      }
      if (item.canViewContact) {
        const reveal = document.createElement("button");
        reveal.type = "button";
        reveal.textContent = "查看联系方式";
        reveal.addEventListener("click", function () { showContact(item.id, card, reveal); });
        footer.appendChild(reveal);
      }
      if (item.status !== "COMPLETED") {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.status === "NEW" ? "承接祷告" : "已经守望";
        button.addEventListener("click", function () { act(item.id, item.status === "NEW" ? "CLAIM" : "COMPLETE", button); });
        footer.appendChild(button);
      }
      card.appendChild(body); card.appendChild(footer); list.appendChild(card);
    });
  }

  function showContact(prayerId, card, button) {
    button.disabled = true;
    fetch("/api/prayer-action", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prayerId: prayerId, action: "CONTACT" })
    }).then(readResponse).then(function (data) {
      const contact = document.createElement("p");
      contact.className = "prayer-private-contact";
      contact.textContent = "私下回应方式：" + String(data.contact || "");
      card.appendChild(contact);
      button.remove();
    }).catch(function () {
      button.disabled = false;
      message.textContent = "未能安全取回联系方式，请稍后再试。";
    });
  }

  function act(prayerId, action, button) {
    button.disabled = true;
    fetch("/api/prayer-action", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prayerId: prayerId, action: action }) })
      .then(readResponse).then(function () {
        selectStatus(action === "CLAIM" ? "PRAYING" : "COMPLETED");
      }).catch(function () { button.disabled = false; message.textContent = "这项托付已由另一位同行者承接，或暂时无法更新。"; });
  }
  function readResponse(response) { return response.json().catch(function () { return {}; }).then(function (body) { if (!response.ok) throw new Error("request_failed"); return body; }); }
  function quietDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }); }
}());
