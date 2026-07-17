(function () {
  const placeholder = "集合地点待补充";

  function install() {
    injectStyles();
    enhanceMeetingField();
    patchPublishRequest();
  }

  function enhanceMeetingField() {
    const input = document.querySelector('input[name="meetingPlace"]');

    if (!input) {
      return;
    }

    const label = input.closest(".line-field") || input.parentElement;

    if (!label) {
      return;
    }

    label.classList.add("meeting-field", "wide");

    if (!input.closest(".meeting-input-wrap")) {
      const wrap = document.createElement("div");
      wrap.className = "meeting-input-wrap";
      const map = document.createElement("span");
      map.className = "meeting-map";
      map.setAttribute("aria-hidden", "true");
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(map);
      wrap.appendChild(input);
    }

    let preview = label.querySelector(".meeting-preview");

    if (!preview) {
      preview = document.createElement("div");
      preview.className = "meeting-preview";
      preview.setAttribute("aria-live", "polite");
      preview.innerHTML = "<span>将显示在超级星期六卡片中</span><strong></strong>";
      label.appendChild(preview);
    }

    function update() {
      const value = input.value.trim();
      const target = preview.querySelector("strong");

      if (target) {
        target.textContent = value || placeholder;
      }
    }

    input.addEventListener("input", update);
    window.setTimeout(update, 0);
    window.setTimeout(update, 900);
    window.setTimeout(update, 2200);
  }

  function patchPublishRequest() {
    if (window.__budaoMeetingPatchInstalled || typeof window.fetch !== "function") {
      return;
    }

    window.__budaoMeetingPatchInstalled = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : input && input.url;
      const isPublish = typeof url === "string" && url.indexOf("/api/publish-route") >= 0;
      const place = meetingPlaceValue();

      if (isPublish && init && typeof init.body === "string") {
        try {
          const route = JSON.parse(init.body);

          if (route && typeof route === "object") {
            route.meetingPlace = place || route.meetingPlace || route.meetingPoint || route.gatheringPlace || "";
            route.meetingPoint = route.meetingPlace;
            init = {
              ...init,
              body: JSON.stringify(route)
            };
          }
        } catch (error) {
          return originalFetch(input, init);
        }
      }

      return originalFetch(input, init);
    };
  }

  function meetingPlaceValue() {
    const input = document.querySelector('input[name="meetingPlace"]');

    return input ? input.value.trim() : "";
  }

  function injectStyles() {
    if (document.getElementById("budaoMeetingModuleStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "budaoMeetingModuleStyles";
    style.textContent = `
.meeting-field{gap:12px}
.meeting-input-wrap{display:grid;grid-template-columns:62px minmax(0,1fr);align-items:end;gap:18px}
.meeting-field .meeting-map{position:relative;display:block;width:62px;height:42px;overflow:hidden;border:1px solid rgba(220,210,187,.16);border-radius:14px;background:linear-gradient(140deg,transparent 0 42%,rgba(220,210,187,.22) 43% 45%,transparent 46%),linear-gradient(24deg,transparent 0 51%,rgba(220,210,187,.16) 52% 54%,transparent 55%),linear-gradient(90deg,rgba(220,210,187,.08) 1px,transparent 1px),linear-gradient(0deg,rgba(220,210,187,.07) 1px,transparent 1px),rgba(238,232,217,.035);background-size:auto,auto,18px 18px,18px 18px,auto}
.meeting-field .meeting-map::after{content:"";position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;background:rgba(236,224,197,.78);box-shadow:0 0 0 5px rgba(236,224,197,.08),0 0 18px rgba(236,224,197,.18);transform:translate(-50%,-50%)}
.meeting-preview{display:flex;min-height:58px;flex-direction:column;justify-content:center;gap:5px;padding:13px 16px;border:1px solid rgba(220,210,187,.13);border-radius:18px;background:rgba(238,232,217,.035)}
.meeting-preview span{color:rgba(226,220,205,.42);font-size:10px;letter-spacing:.22em}
.meeting-preview strong{color:rgba(238,232,217,.74);font:300 15px/1.7 ui-serif,Georgia,"Times New Roman",serif;letter-spacing:.04em}
`;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
}());