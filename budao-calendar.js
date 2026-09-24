(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root && root.document) {
    root.BudaoCalendar = api;
    const host = root.document.getElementById("budaoCalendar");
    if (host) {
      api.mount(host, new Date());
      root.addEventListener("resize", function () {
        api.centerToday(host);
      });
    }
  }
}(typeof window !== "undefined" ? window : null, function () {
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const weekdayNames = ["日", "一", "二", "三", "四", "五", "六"];
  const stepTypeLabels = {
    pioneer: "先锋",
    budao: "步道",
    march: "行军",
    camp: "营会",
    fellowship: "同道"
  };
  const allowedStepTypes = ["pioneer", "budao", "march", "camp", "fellowship"];
  const baseStepSchedule = {
    "2026-09-04": ["fellowship"],
    "2026-09-05": ["budao", "pioneer"],
    "2026-09-11": ["pioneer"],
    "2026-09-12": ["budao"],
    "2026-09-13": ["budao"],
    "2026-09-19": ["budao"],
    "2026-09-20": ["budao"]
  };

  function dateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function stepsForDate(key, schedule) {
    const scheduled = (schedule || baseStepSchedule)[key] || [];
    return scheduled.filter(function (type, index) {
      return scheduled.indexOf(type) === index;
    });
  }

  function isDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function addStep(schedule, date, type) {
    if (!isDateKey(date) || allowedStepTypes.indexOf(type) < 0) {
      return;
    }

    if (!schedule[date]) {
      schedule[date] = [];
    }

    if (schedule[date].indexOf(type) < 0) {
      schedule[date].push(type);
    }
  }

  function mergeStepSchedule(base, events, routes) {
    const merged = {};

    Object.keys(base || {}).forEach(function (date) {
      merged[date] = (base[date] || []).slice();
    });

    (Array.isArray(events) ? events : []).forEach(function (event) {
      if (!event || event.type === "none") return;
      addStep(merged, event.date, event.type);
    });

    (Array.isArray(routes) ? routes : []).forEach(function (route) {
      if (!route) return;
      const type = allowedStepTypes.indexOf(route.calendarType) >= 0 ? route.calendarType : "budao";
      if (route.calendarType === "none") return;
      addStep(merged, route.date, type);
    });

    return merged;
  }

  function dayRecord(date, todayKey, schedule) {
    const key = dateKey(date);
    return {
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
      day: date.getDate(),
      weekday: weekdayNames[date.getDay()],
      weekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: key === todayKey,
      dateKey: key,
      steps: stepsForDate(key, schedule)
    };
  }

  function monthRecord(year, monthIndex, days, label, todayKey, schedule) {
    return {
      year,
      monthIndex,
      label,
      monthText: String(monthIndex + 1) + "月",
      monthEnglish: monthNames[monthIndex],
      days: days.map(function (date) { return dayRecord(date, todayKey, schedule); })
    };
  }

  function buildCalendarModel(now, schedule) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayKey = dateKey(today);
    const year = today.getFullYear();
    const monthIndex = today.getMonth();

    // Keep the original 44-day visual window moving with today:
    // 23 days before today + today + 20 days after today.
    // On 2026-09-17 this is exactly Aug 25–Oct 7, matching the approved layout.
    const rangeStart = new Date(year, monthIndex, today.getDate() - 23);
    const rangeEnd = new Date(year, monthIndex, today.getDate() + 20);

    function daysForMonth(targetYear, targetMonthIndex) {
      const monthStart = new Date(targetYear, targetMonthIndex, 1);
      const monthEnd = new Date(targetYear, targetMonthIndex + 1, 0);

      if (rangeEnd < monthStart || rangeStart > monthEnd) {
        return [];
      }

      const firstDay = rangeStart > monthStart ? rangeStart.getDate() : 1;
      const lastDay = rangeEnd < monthEnd ? rangeEnd.getDate() : monthEnd.getDate();
      const days = [];

      for (let day = firstDay; day <= lastDay; day += 1) {
        days.push(new Date(targetYear, targetMonthIndex, day));
      }

      return days;
    }

    const previousMonthEnd = new Date(year, monthIndex, 0);
    const nextMonthStart = new Date(year, monthIndex + 1, 1);
    const previousDays = daysForMonth(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth());
    const currentDays = daysForMonth(year, monthIndex);
    const nextDays = daysForMonth(nextMonthStart.getFullYear(), nextMonthStart.getMonth());

    return {
      previous: monthRecord(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth(), previousDays, "", todayKey, schedule || baseStepSchedule),
      current: monthRecord(year, monthIndex, currentDays, "", todayKey, schedule || baseStepSchedule),
      next: monthRecord(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), nextDays, "", todayKey, schedule || baseStepSchedule)
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderStepMarks(day) {
    const steps = (day.steps || []).slice(0, 3);
    if (!steps.length) {
      return "";
    }

    const label = steps.map(function (type) {
      return stepTypeLabels[type] || type;
    }).join("、");

    const marks = steps.map(function (type) {
      return "<span class=\"budao-calendar-step-mark budao-calendar-step-mark--" + escapeHtml(type) + "\" aria-hidden=\"true\"></span>";
    }).join("");

    return "<div class=\"budao-calendar-step-stack\" data-count=\"" + steps.length + "\" aria-label=\"" + escapeHtml(label) + "\">" + marks + "</div>";
  }

  function renderMonth(month) {
    const days = month.days.map(function (day) {
      const classes = ["budao-calendar-day"];
      if (day.weekend) classes.push("is-weekend");
      if (day.isToday) classes.push("is-today");

      return "<div class=\"" + classes.join(" ") + "\">" +
        "<div class=\"budao-calendar-weekday\">" +
          (day.isToday ? "<span class=\"budao-calendar-today-marker\" aria-hidden=\"true\"></span>" : "") +
          "<span>" + escapeHtml(day.weekday) + "</span>" +
        "</div>" +
        "<div class=\"budao-calendar-number\"><span>" + day.day + "</span></div>" +
        renderStepMarks(day) +
      "</div>";
    }).join("");

    return "<section class=\"budao-calendar-month\" style=\"--budao-calendar-days:" + month.days.length + "\">" +
      "<div class=\"budao-calendar-month-head\">" +
        "<div class=\"budao-calendar-month-name\"><strong>" + escapeHtml(month.monthText) + "</strong><small>" + escapeHtml(month.monthEnglish) + "</small></div>" +
        "<span class=\"budao-calendar-rule\"></span>" +
      "</div>" +
      "<div class=\"budao-calendar-period\">" + escapeHtml(month.label) + "</div>" +
      "<div class=\"budao-calendar-days\">" + days + "</div>" +
    "</section>";
  }

  function centeredScrollPosition(dayLeft, dayWidth, viewportWidth) {
    return dayLeft + (dayWidth / 2) - (viewportWidth / 2);
  }

  function centerToday(host) {
    const scroll = host && host.querySelector ? host.querySelector(".budao-calendar-scroll") : null;
    const today = host && host.querySelector ? host.querySelector(".budao-calendar-day.is-today") : null;

    if (!scroll || !today || !scroll.getBoundingClientRect || !today.getBoundingClientRect) {
      return;
    }

    const scrollRect = scroll.getBoundingClientRect();
    const todayRect = today.getBoundingClientRect();
    const dayLeft = todayRect.left - scrollRect.left + scroll.scrollLeft;

    scroll.scrollLeft = centeredScrollPosition(dayLeft, todayRect.width, scroll.clientWidth);
  }

  function renderCalendar(host, now, schedule) {
    const model = buildCalendarModel(now || new Date(), schedule || baseStepSchedule);
    const currentMonthLength = new Date(model.current.year, model.current.monthIndex + 1, 0).getDate();
    const visibleMonths = [
      { month: model.previous, width: function (count) { return "calc(var(--budao-calendar-flank-week-width, 245px) * " + count + " / 7)"; } },
      { month: model.current, width: function (count) { return "calc(var(--budao-calendar-current-month-width, 860px) * " + count + " / " + currentMonthLength + ")"; } },
      { month: model.next, width: function (count) { return "calc(var(--budao-calendar-flank-week-width, 245px) * " + count + " / 7)"; } }
    ].filter(function (entry) {
      return entry.month.days.length > 0;
    });
    const columns = visibleMonths.map(function (entry) {
      return entry.width(entry.month.days.length);
    }).join(" ");

    host.innerHTML = "<div class=\"budao-calendar-scroll\">" +
      "<span class=\"budao-calendar-spacer\" aria-hidden=\"true\"></span>" +
      "<div class=\"budao-calendar-strip\" style=\"grid-template-columns:" + columns + "\">" +
        visibleMonths.map(function (entry) { return renderMonth(entry.month); }).join("") +
      "</div>" +
      "<span class=\"budao-calendar-spacer\" aria-hidden=\"true\"></span>" +
    "</div>";
    centerToday(host);
    return model;
  }

  function loadJson(url) {
    if (typeof fetch !== "function") {
      return Promise.resolve([]);
    }

    return fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin"
    }).then(function (response) {
      if (!response.ok) return [];
      return response.json().catch(function () { return []; });
    }).then(function (value) {
      return Array.isArray(value) ? value : [];
    }).catch(function () {
      return [];
    });
  }

  function sameSchedule(left, right) {
    return JSON.stringify(left || {}) === JSON.stringify(right || {});
  }

  function refreshPublishedSteps(host, now) {
    if (!host || typeof fetch !== "function") {
      return Promise.resolve(null);
    }

    return Promise.all([
      loadJson("/calendar-events.json?ts=" + Date.now()),
      loadJson("/api/routes?calendar=" + Date.now())
    ]).then(function (sources) {
      const schedule = mergeStepSchedule(baseStepSchedule, sources[0], sources[1]);
      if (sameSchedule(schedule, baseStepSchedule)) {
        return buildCalendarModel(now || new Date(), schedule);
      }
      return renderCalendar(host, now || new Date(), schedule);
    }).catch(function () {
      return null;
    });
  }

  function mount(host, now) {
    const mountedAt = now || new Date();
    const model = renderCalendar(host, mountedAt, baseStepSchedule);
    refreshPublishedSteps(host, mountedAt);
    return model;
  }

  return {
    buildCalendarModel,
    mergeStepSchedule,
    centeredScrollPosition,
    centerToday,
    refreshPublishedSteps,
    mount
  };
}));
