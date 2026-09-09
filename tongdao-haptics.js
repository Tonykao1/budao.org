/*
 * Tongdao haptic language.
 * Supported mobile browsers (primarily Android) receive restrained tactile
 * feedback. Unsupported browsers such as current iOS Safari fail silently.
 */

(function installTongdaoHaptics() {
  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  function vibrate(pattern) {
    if (!canVibrate || document.hidden) return false;
    try {
      return navigator.vibrate(pattern);
    } catch (error) {
      return false;
    }
  }

  window.tongdaoHaptic = {
    short() {
      return vibrate(45);
    },
    threshold() {
      return vibrate([45, 70, 45]);
    },
    complete() {
      return vibrate(180);
    }
  };

  const originalSetRoute = setRoute;
  setRoute = function setRouteWithHaptics(route, push = true) {
    const previousRoute = state.route;
    originalSetRoute(route, push);

    // The story-to-scripture threshold is intentionally distinct.
    if (route === "word" && previousRoute === "storyQuiet") {
      window.tongdaoHaptic.threshold();
      return;
    }

    // Reaching GROW means the day's guided journey itself has completed.
    if (route === "grow") {
      window.tongdaoHaptic.complete();
    }
  };
})();
