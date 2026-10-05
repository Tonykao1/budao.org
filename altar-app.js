(function () {
  const ledger = document.querySelector(".route-ledger");
  const detail = document.querySelector(".route-detail");
  const message = document.querySelector(".altar-message");
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const returnTent = document.querySelector(".return-tent");
  let routes = [];
  let activeFilter = "all";
  let selectedRouteId = "";

  if (returnTent) returnTent.addEventListener("click", function () { window.location.href = "/tent.html"; });

  filters.forEach(function (button) {
    button.addEventListener("click", function () {
      activeFilter = button.dataset.filter || "all";
      filters.forEach(function (item) { item.setAttribute("aria-current", item === button ? "true" : "false"); });
      renderList();
    });
  });

  function loadRoutes() {
    message.textContent = "正在读取托付…";
    fetch("/api/routes?scope=altar", { credentials: "same-origin" })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw new Error(body.reason || "unavailable");
          return body;
        });
      })
      .then(function (body) {
        routes = Array.isArray(body.routes) ? body.routes : [];
        message.textContent = body.supervisionAvailable === false ? "路线已读取；监管状态暂时无法同步。" : "";
        renderList();
      })
      .catch(function (error) {
        if (error.message === "forbidden" || error.message === "unauthorized") {
          message.textContent = "这里暂不向当前账户开放。";
        } else {
          message.textContent = "祭坛暂时安静，请稍后再来。";
        }
      });
  }

  function matchesFilter(route) {
    const supervision = route.supervision || { status: "active", locked: false };
    if (activeFilter === "all") return true;
    if (activeFilter === "future" || activeFilter === "past") return route.phase === activeFilter;
    if (activeFilter === "needs_changes") return supervision.status === "needs_changes";
    if (activeFilter === "paused") return supervision.status === "paused";
    return true;
  }

  function statusText(route) {
    const supervision = route.supervision || {};
    if (supervision.locked) return "已锁定";
    if (supervision.status === "paused") return "已撤下";
    if (supervision.status === "needs_changes") return "待修改";
    return route.phase === "past" ? "已结束" : "已发布";
  }

  function renderList() {
    if (!ledger) return;
    ledger.textContent = "";
    const visible = routes.filter(matchesFilter);
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "altar-message";
      empty.textContent = "这里暂时没有记录。";
      ledger.appendChild(empty);
      detail.hidden = true;
      return;
    }

    visible.sort(function (a, b) {
      return String(a.date || "").localeCompare(String(b.date || "")) || String(a.time || "").localeCompare(String(b.time || ""));
    });

    visible.forEach(function (route) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "route-row";
      button.innerHTML = "<strong></strong><span></span><span></span><small></small>";
      button.children[0].textContent = route.title || "未命名路线";
      button.children[1].textContent = route.leader || route.leaderId || "";
      button.children[2].textContent = [route.date || "", route.time || ""].filter(Boolean).join(" · ");
      button.children[3].textContent = statusText(route);
      button.addEventListener("click", function () {
        selectedRouteId = route.routeId || route.id || "";
        renderDetail(route);
      });
      ledger.appendChild(button);
    });
  }

  function renderDetail(route) {
    if (!detail) return;
    const supervision = route.supervision || { status: "active", locked: false };
    detail.hidden = false;
    detail.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = route.title || "未命名路线";
    detail.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "detail-grid";
    [
      ["带领人", route.leader || route.leaderId || "—"],
      ["日期", [route.date || "—", route.time || ""].filter(Boolean).join(" · ")],
      ["地点", route.location || route.meetingPlace || "—"],
      ["距离 / 爬升", [route.distance || "—", route.elevation || "—"].join(" / ")],
      ["创建", route.createdAt || "—"],
      ["最后修改", route.updatedAt || "—"],
      ["监管状态", statusText(route)],
      ["Route ID", route.routeId || route.id || "—"]
    ].forEach(function (pair) {
      const item = document.createElement("p");
      item.textContent = pair[0] + "：" + pair[1];
      grid.appendChild(item);
    });
    detail.appendChild(grid);

    const actions = document.createElement("div");
    actions.className = "actions";
    [
      ["needs_changes", "退回修改"],
      ["pause", "暂停展示"],
      ["lock", supervision.locked ? "已锁定" : "锁定"],
      ["restore", "恢复"]
    ].forEach(function (entry) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = entry[1];
      if (entry[0] === "lock" && supervision.locked) button.disabled = true;
      button.addEventListener("click", function () { performAction(entry[0]); });
      actions.appendChild(button);
    });
    detail.appendChild(actions);

    const note = document.createElement("p");
    note.className = "audit-note";
    note.textContent = supervision.reviewedAt ? "最近监管：" + (supervision.reviewedBy || "") + " · " + supervision.reviewedAt : "尚无监管记录。";
    detail.appendChild(note);
  }

  function performAction(action) {
    if (!selectedRouteId) return;
    const reason = action === "needs_changes" || action === "pause" ? (window.prompt("留下一句简短说明（可留空）") || "") : "";
    fetch("/api/routes?scope=altar", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeId: selectedRouteId, action: action, reason: reason })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.reason || "unavailable");
        return body;
      });
    }).then(function () {
      loadRoutes();
    }).catch(function () {
      message.textContent = "这次监管动作没有保存，请稍后再试。";
    });
  }

  loadRoutes();
}());
