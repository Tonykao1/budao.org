(function () {
  const core = window.BudaoRouteCancellation;
  if (!core) return;

  let applying = false;

  function install() {
    const grid = document.getElementById("routeGrid");
    if (!grid) return;

    const observer = new MutationObserver(function () {
      window.requestAnimationFrame(apply);
    });
    observer.observe(grid, { childList: true, subtree: true, characterData: true });
    window.setInterval(apply, 1000);
    apply();
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      const routes = Array.isArray(window.BudaoActiveRoutes) ? window.BudaoActiveRoutes : [];
      const cards = Array.from(document.querySelectorAll("#routeGrid .route-card"));

      cards.forEach(function (card, index) {
        applyCard(card, routes[index]);
      });
      applyNotice(routes, cards);
    } finally {
      applying = false;
    }
  }

  function applyCard(card, route) {
    const cancelled = Boolean(route && route.status === "cancelled");
    card.classList.toggle("is-cancelled", cancelled);

    let notice = card.querySelector(".route-cancel-public");
    if (!cancelled) {
      if (notice) notice.remove();
      card.querySelectorAll(".route-actions button").forEach(function (button) {
        if (button.dataset.cancelDisabled === "1") {
          button.disabled = false;
          delete button.dataset.cancelDisabled;
        }
      });
      return;
    }

    const message = core.displayMessage(route);
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "route-cancel-public";
      const content = card.querySelector(".route-content");
      if (content) content.insertBefore(notice, content.firstChild);
    }
    notice.innerHTML = "<strong>本次步道已取消</strong><p>" + escapeHtml(message) + "</p>";

    const countdown = card.querySelector(".route-countdown");
    if (countdown && countdown.textContent !== "本次步道已取消") {
      countdown.textContent = "本次步道已取消";
      countdown.classList.remove("is-long");
    }

    card.querySelectorAll(".route-actions button").forEach(function (button) {
      if (!button.disabled) button.dataset.cancelDisabled = "1";
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });
  }

  function applyNotice(routes, cards) {
    const cancelled = routes.map(function (route, index) {
      return { route: route, index: index };
    }).filter(function (item) {
      return item.route && item.route.status === "cancelled";
    });

    let notice = document.getElementById("routeChangeNotice");
    if (!cancelled.length) {
      if (notice) notice.remove();
      return;
    }

    const first = cancelled[0];
    if (!notice) {
      notice = document.createElement("button");
      notice.id = "routeChangeNotice";
      notice.className = "route-change-notice";
      notice.type = "button";
      const grid = document.getElementById("routeGrid");
      if (grid && grid.parentNode) grid.parentNode.insertBefore(notice, grid);
    }

    const date = compactDate(first.route.date);
    const relative = relativeDate(first.route.date);
    notice.textContent = date + " 步道变更 · " + relative + core.displayMessage(first.route);
    notice.onclick = function () {
      const target = cards[first.index];
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    };
  }

  function compactDate(value) {
    const match = String(value || "").match(/\d{4}-(\d{2})-(\d{2})/);
    return match ? Number(match[1]) + "." + Number(match[2]) : "本次";
  }

  function relativeDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    const eventDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((eventDay - today) / 86400000);
    if (diff === 0) return "今日 · ";
    if (diff === 1) return "明日 · ";
    return "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
}());
