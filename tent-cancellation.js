(function () {
  const core = window.BudaoRouteCancellation;
  if (!core) return;

  let route = null;
  let selectedCode = "";
  let panel;
  let stateLabel;
  let menu;
  let menuAction;
  let dialog;
  let note;
  let confirmButton;
  let dialogMessage;

  function install() {
    const room = document.querySelector(".route-room");
    if (!room || document.getElementById("routeCancelPanel")) return;

    panel = document.createElement("div");
    panel.id = "routeCancelPanel";
    panel.className = "route-cancel-panel";
    panel.hidden = true;
    panel.innerHTML = '<span class="route-cancel-state"></span><button class="route-cancel-menu-button" type="button" aria-label="步道状态操作" aria-expanded="false">•••</button><div class="route-cancel-menu" hidden><button type="button" data-route-status-action></button></div>';
    room.appendChild(panel);

    stateLabel = panel.querySelector(".route-cancel-state");
    menu = panel.querySelector(".route-cancel-menu");
    menuAction = panel.querySelector("[data-route-status-action]");

    panel.querySelector(".route-cancel-menu-button").addEventListener("click", function (event) {
      event.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      this.setAttribute("aria-expanded", open ? "true" : "false");
    });

    menuAction.addEventListener("click", function () {
      menu.hidden = true;
      if (route && route.status === "cancelled") {
        changeStatus("restore");
      } else {
        openDialog();
      }
    });

    dialog = buildDialog();
    document.body.appendChild(dialog);

    document.addEventListener("click", function () {
      if (menu) menu.hidden = true;
    });

    document.addEventListener("submit", function (event) {
      if (event.target && event.target.matches(".entry-form")) {
        window.setTimeout(refresh, 500);
        window.setTimeout(refresh, 1400);
      }
    }, true);

    document.addEventListener("click", function (event) {
      if (event.target && event.target.closest && event.target.closest('[data-tent-path="step"]')) {
        window.setTimeout(refresh, 100);
      }
    });

    window.addEventListener("budao:route-published", refresh);
    refresh();
  }

  function buildDialog() {
    const wrap = document.createElement("div");
    wrap.className = "route-cancel-backdrop";
    wrap.hidden = true;
    wrap.innerHTML = '<div class="route-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="routeCancelTitle"><h2 id="routeCancelTitle">为什么取消？</h2><div class="route-cancel-options"></div><button class="route-cancel-note-toggle" type="button">＋添加说明</button><textarea class="route-cancel-note" maxlength="280" placeholder="只在需要时补充对外说明" hidden></textarea><div class="route-cancel-actions"><button class="route-cancel-dismiss" type="button">返回</button><button class="route-cancel-confirm" type="button" disabled>确认取消</button></div><div class="route-cancel-message" aria-live="polite"></div></div>';

    const options = wrap.querySelector(".route-cancel-options");
    Object.keys(core.CODES).forEach(function (code) {
      const item = core.CODES[code];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "route-cancel-option";
      button.dataset.cancelCode = code;
      button.innerHTML = '<span aria-hidden="true">' + item.icon + '</span><span>' + item.label + '</span>';
      button.addEventListener("click", function () {
        selectedCode = code;
        options.querySelectorAll(".route-cancel-option").forEach(function (option) {
          option.classList.toggle("is-selected", option === button);
        });
        confirmButton.disabled = false;
      });
      options.appendChild(button);
    });

    note = wrap.querySelector(".route-cancel-note");
    confirmButton = wrap.querySelector(".route-cancel-confirm");
    dialogMessage = wrap.querySelector(".route-cancel-message");

    wrap.querySelector(".route-cancel-note-toggle").addEventListener("click", function () {
      note.hidden = !note.hidden;
      this.textContent = note.hidden ? "＋添加说明" : "－收起说明";
      if (!note.hidden) note.focus();
    });
    wrap.querySelector(".route-cancel-dismiss").addEventListener("click", closeDialog);
    wrap.addEventListener("click", function (event) {
      if (event.target === wrap) closeDialog();
    });
    confirmButton.addEventListener("click", function () {
      if (!selectedCode) return;
      changeStatus("cancel", selectedCode, note.value);
    });
    return wrap;
  }

  function openDialog() {
    selectedCode = "";
    note.value = "";
    note.hidden = true;
    confirmButton.disabled = true;
    dialogMessage.textContent = "";
    dialog.querySelectorAll(".route-cancel-option").forEach(function (option) {
      option.classList.remove("is-selected");
    });
    dialog.hidden = false;
  }

  function closeDialog() {
    if (dialog) dialog.hidden = true;
  }

  async function refresh() {
    try {
      const response = await fetch("/api/routes?scope=mine&budao=" + Date.now(), {
        credentials: "same-origin",
        cache: "no-store"
      });
      if (!response.ok) throw new Error("no_route");
      const routes = await response.json();
      route = Array.isArray(routes) && routes.length ? routes[0] : null;
      render();
    } catch (error) {
      route = null;
      if (panel) panel.hidden = true;
    }
  }

  function render() {
    if (!panel) return;
    panel.hidden = !route;
    if (!route) return;

    const cancelled = route.status === "cancelled";
    if (cancelled) {
      const code = core.normalizeCode(route.cancelCode);
      stateLabel.textContent = "本次取消 · " + core.CODES[code].label;
      menuAction.textContent = "恢复本次步道";
      menuAction.classList.remove("danger");
    } else {
      stateLabel.textContent = "已发布";
      menuAction.textContent = "取消本次步道";
      menuAction.classList.add("danger");
    }
  }

  async function changeStatus(action, cancelCode, publicNote) {
    if (!route) return;
    const routeId = String(route.routeId || route.id || "").trim();
    if (!routeId) return;

    const pendingText = action === "cancel" ? "正在取消…" : "正在恢复…";
    if (dialogMessage && dialog && !dialog.hidden) dialogMessage.textContent = pendingText;
    if (menuAction) menuAction.disabled = true;
    if (confirmButton) confirmButton.disabled = true;

    try {
      const response = await fetch("/api/routes?scope=mine", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId,
          action,
          cancelCode: cancelCode || "",
          publicNote: String(publicNote || "").slice(0, 280)
        })
      });
      const body = await response.json().catch(function () { return {}; });
      if (!response.ok || body.ok === false) throw new Error(body.reason || "status_failed");

      route = body.route || route;
      render();
      closeDialog();

      const routeMessage = document.querySelector(".route-message");
      if (routeMessage) {
        routeMessage.textContent = action === "cancel" ? "本次步道已取消。" : "本次步道已恢复。";
      }

      window.dispatchEvent(new CustomEvent("budao:route-status-changed", { detail: { route } }));
    } catch (error) {
      const message = error && error.message === "commit_conflict" ?
        "状态刚刚发生变化，请再试一次。" :
        "操作没有完成，请稍后再试。";
      if (dialogMessage && dialog && !dialog.hidden) dialogMessage.textContent = message;
      const routeMessage = document.querySelector(".route-message");
      if (routeMessage) routeMessage.textContent = message;
    } finally {
      if (menuAction) menuAction.disabled = false;
      if (confirmButton) confirmButton.disabled = !selectedCode;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
}());
