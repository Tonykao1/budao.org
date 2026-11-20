(function (root, factory) {
  "use strict";
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.BudaoMobileLocation = core;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const separator = " · ";
  const limits = { country: 80, city: 80, region: 120 };

  function normalize(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  }

  function validPart(value, maximum) {
    const text = normalize(value);
    // Keep the three-level public location string unambiguous. Middle dots
    // belong exclusively to the formatter, never to individual user fields.
    return Boolean(text) && text.length <= maximum &&
      !/[·•\u0000-\u001f\u007f]/.test(text);
  }

  function compose(parts) {
    if (!parts || typeof parts !== "object") return "";
    const values = ["country", "city", "region"].map(function (name) {
      const value = normalize(parts[name]);
      return validPart(value, limits[name]) ? value : "";
    });
    return values.every(Boolean) ? values.join(separator) : "";
  }

  function parseLegacy(value) {
    if (typeof value !== "string") return null;
    const segments = value.split(/\s*·\s*/).map(normalize);
    if (segments.length !== 3) return null;
    const parts = { country: segments[0], city: segments[1], region: segments[2] };
    return compose(parts) ? parts : null;
  }

  return { compose, normalize, validPart, parseLegacy };
}));