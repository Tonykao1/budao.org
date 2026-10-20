(function () {
  const core = window.BudaoRouteCancellation;
  if (!core) return;

  let scheduled = false;

  function install() {
    const grid = document.getElementById("routeGrid");
    if (!grid) return;

    const Observer = window.MutationObserver;
    if (typeof Observer === "function") {
      const observer = new Observer(scheduleApply);
      // Observe card additions/removals ONLY. Changes inside a card (such as
      // countdown updates and cancellation notices) must not recursively
      // re-trigger apply(), or the page can enter an endless microtask loop.
      observer.observe(grid, { childList: true });
    }

    window.addEventListener("budao:routes-rendered", scheduleApply);
    window.addEventListener("focus", scheduleApply);
    scheduleApply();
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(function () {
      scheduled = false;
      apply();
    });
  }

  function routeForCard(card, routes) {
    const marker = card && card.querySelector ? card.querySelector("[data-route-index]") : null;
    const index = marker ? Number(marker.dataset.routeIndex) : NaN;
    return Number.isInteger(index) && index >= 0 ? routes[index] || null : null;
  }

  function cardForRoute(route, cards, routes) {
    const routeId = String(route && (route.routeId || route.id) || "");
    return cards.find(function (card) {
      const candidate = routeForCard(card, routes);
      return candidate && String(candidate.routeId || candidate.id || "") === routeId;
    }) || null;
  }

  function apply() {
    const grid = document.getElementById("routeGrid");
    const routes = Array.isArray(window.BudaoActiveRoutes) ? window.BudaoActiveRoutes : [];
    if (!grid || !routes.length) {
      removeTopNotice();
      return;
    }

    const cards = Array.prototype.slice.call(grid.querySelectorAll(".route-card"));
    cards.forEach(function (card) {
      applyCard(card, routeForCard(card, routes));
    });
    applyTopNotice(cards, routes);
  }

  function applyCard(card, route) {
    const cancelled = Boolean(route && route.status === "cancelled");
    card.classList.toggle("is-cancelled", cancelled);

    let note = card.querySelector(".route-cancel-public");
    if (!cancelled) {
      if (note) note.remove();
      restoreActions(card);
      return;
    }

    if (!note) {
      note = document.createElement("div");
      note.className = "route-cancel-public";
      // Initialize once: rewriting innerHTML on every observer callback
      // previously emitted a new mutation, causing an infinite feedback loop.
      note.innerHTML = "<strong>本次步道已取消</strong><p></p>";
      const content = card.querySelector(".route-content");
      if (content) content.insertBefore(note, content.firstChild);
    }

    const message = note.querySelector("p");
    const nextMessage = core.displayMessage(route);
    if (message && message.textContent !== nextMessage) {
      message.textContent = nextMessage;
    }

    const countdown = card.querySelector(".route-countdown");
    if (countdown && countdown.textContent !== "本次步道已取消") {
      countdown.textContent = "本次步道已取消";
      countdown.classList.remove("is-long");
    }

    card.querySelectorAll(".route-actions button, .route-button, .invitation-trigger, .invitation-create").forEach(function (button) {
      if (!button.dataset.cancelDisabled) {
        button.dataset.cancelDisabled = button.disabled ? "was-disabled" : "enabled";
      }
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });
  }

  function restoreActions(card) {
    card.querySelectorAll("[data-cancel-disabled]").forEach(function (button) {
      if (button.dataset.cancelDisabled === "enabled") button.disabled = false;
      button.removeAttribute("data-cancel-disabled");
      button.removeAttribute("aria-disabled");
    });
  }

  function applyTopNotice(cards, routes) {
    const candidates = routes.filter(function (route) {
      return route && route.status === "cancelled" && daysFromRouteToday(route) >= 0;
    }).sort(function (left, right) {
      return String(left.date || "").localeCompare(String(right.date || ""));
    });

    if (!candidates.length) {
      removeTopNotice();
      return;
    }

    const route = candidates[0];
    const grid = document.getElementById("routeGrid");
    let notice = document.getElementById("routeChangeNotice");
    if (!notice) {
      notice = document.createElement("button");
      notice.type = "button";
      notice.id = "routeChangeNotice";
      notice.className = "route-change-notice";
      grid.parentNode.insertBefore(notice, grid);
    }

    const offset = daysFromRouteToday(route);
    const relative = offset === 0 ? "今日" : offset === 1 ? "明日" : "";
    const prefix = compactDate(route.date) + " 步道变更" + (relative ? " · " + relative : "");
    notice.textContent = prefix + " · " + core.displayMessage(route);
    notice.onclick = function () {
      const target = cardForRoute(route, cards, routes);
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
  }

  function removeTopNotice() {
    const notice = document.getElementById("routeChangeNotice");
    if (notice) notice.remove();
  }

  function compactDate(value) {
    const match = String(value || "").match(/^\d{4}-(\d{2})-(\d{2})$/);
    return match ? Number(match[1]) + "." + Number(match[2]) : String(value || "");
  }

  function localDateKey(timezone) {
    const zone = String(timezone || "Asia/Shanghai");
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date());
      const values = {};
      parts.forEach(function (part) {
        if (part.type !== "literal") values[part.type] = part.value;
      });
      return values.year + "-" + values.month + "-" + values.day;
    } catch (error) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function daysFromRouteToday(route) {
    const routeDate = String(route && route.date || "");
    const today = localDateKey(route && route.timezone);
    const routeParts = routeDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const todayParts = today.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!routeParts || !todayParts) return -1;
    const routeUtc = Date.UTC(Number(routeParts[1]), Number(routeParts[2]) - 1, Number(routeParts[3]));
    const todayUtc = Date.UTC(Number(todayParts[1]), Number(todayParts[2]) - 1, Number(todayParts[3]));
    return Math.round((routeUtc - todayUtc) / 86400000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
}());
