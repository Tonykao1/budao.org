(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BudaoRouteCancellation = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CODES = Object.freeze({
    WX: { label: "天气原因", icon: "🌧", message: "因天气原因，本次步道取消。" },
    SAFE: { label: "安全原因", icon: "🛡", message: "因安全考量，本次步道取消。" },
    LEAD: { label: "带领安排", icon: "👣", message: "因带领安排调整，本次步道取消。" },
    ROUTE: { label: "路线原因", icon: "🗺", message: "因路线情况调整，本次步道取消。" },
    OPS: { label: "活动安排", icon: "👥", message: "因活动安排调整，本次步道取消。" },
    EXT: { label: "外部原因", icon: "⚠️", message: "因客观原因，本次步道取消。" },
    OTHER: { label: "其他原因", icon: "···", message: "因临时调整，本次步道取消。" }
  });

  function normalizeCode(value) {
    const code = String(value || "").trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(CODES, code) ? code : "OTHER";
  }

  function publicMessage(code) {
    return CODES[normalizeCode(code)].message;
  }

  function cap(value, length) {
    return String(value || "").trim().slice(0, length);
  }

  function cleanHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(-19).map(function (item) {
      const cancelled = item && item.status === "cancelled";
      return {
        status: cancelled ? "cancelled" : "scheduled",
        code: cancelled ? normalizeCode(item.code) : "",
        at: cap(item && item.at, 64),
        by: cap(item && item.by, 120)
      };
    });
  }

  function cancelRoute(route, options) {
    const source = route && typeof route === "object" ? route : {};
    const opts = options || {};
    const code = normalizeCode(opts.code);
    const at = cap(opts.at || new Date().toISOString(), 64);
    const actor = cap(opts.actor, 120);
    const history = cleanHistory(source.statusHistory);
    history.push({ status: "cancelled", code, at, by: actor });

    return {
      ...source,
      status: "cancelled",
      cancelCode: code,
      cancelPublicNote: cap(opts.publicNote, 280),
      cancelledAt: at,
      cancelledBy: actor,
      restoredAt: "",
      statusHistory: history.slice(-20)
    };
  }

  function restoreRoute(route, options) {
    const source = route && typeof route === "object" ? route : {};
    const opts = options || {};
    const at = cap(opts.at || new Date().toISOString(), 64);
    const actor = cap(opts.actor, 120);
    const history = cleanHistory(source.statusHistory);
    history.push({ status: "scheduled", code: "", at, by: actor });

    return {
      ...source,
      status: "scheduled",
      cancelCode: "",
      cancelPublicNote: "",
      cancelledAt: "",
      cancelledBy: "",
      restoredAt: at,
      statusHistory: history.slice(-20)
    };
  }

  function displayMessage(route) {
    if (!route || route.status !== "cancelled") return "";
    return cap(route.cancelPublicNote, 280) || publicMessage(route.cancelCode);
  }

  return {
    CODES,
    normalizeCode,
    publicMessage,
    cancelRoute,
    restoreRoute,
    displayMessage
  };
}));
