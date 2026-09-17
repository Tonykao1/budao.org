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

  function dateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function dayRecord(date, todayKey) {
    return {
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
      day: date.getDate(),
      weekday: weekdayNames[date.getDay()],
      weekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: dateKey(date) === todayKey
    };
  }

  function monthRecord(year, monthIndex, days, label, todayKey) {
    return {
      year,
      monthIndex,
      label,
      monthText: String(monthIndex + 1) + "月",
      monthEnglish: monthNames[monthIndex],
      days: days.map(function (date) { return dayRecord(date, todayKey); })
    };
  }

  function buildCalendarModel(now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayKey = dateKey(today);
    const year = today.getFullYear();
    const monthIndex = today.getMonth();

    const previousMonthEnd = new Date(year, monthIndex, 0);
    const previousDays = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      previousDays.push(new Date(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth(), previousMonthEnd.getDate() - offset));
    }

    const currentMonthLength = new Date(year, monthIndex + 1, 0).getDate();
    const currentDays = [];
    for (let day = 1; day <= currentMonthLength; day += 1) {
      currentDays.push(new Date(year, monthIndex, day));
    }

    const nextMonthStart = new Date(year, monthIndex + 1, 1);
    const nextDays = [];
    for (let offset = 0; offset < 7; offset += 1) {
      nextDays.push(new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), nextMonthStart.getDate() + offset));
    }

    return {
      previous: monthRecord(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth(), previousDays, "上月最后一周", todayKey),
      current: monthRecord(year, monthIndex, currentDays, "本月", todayKey),
      next: monthRecord(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), nextDays, "下月第一周", todayKey)
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMonth(month) {
    const days = month.days.map(function (day) {
      const classes = ["budao-calendar-day"];
      if (day.weekend) classes.push("is-weekend");
      if (day.isToday) classes.push("is-today");

      return "<div class=\"" + classes.join(" ") + "\">" +
        "<div class=\"budao-calendar-weekday\">" +
          (day.isToday ? "<span class=\"budao-calendar-today-word\">今</span>" : "") +
          "<span>" + escapeHtml(day.weekday) + "</span>" +
        "</div>" +
        "<div class=\"budao-calendar-number\"><span>" + day.day + "</span></div>" +
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

  function mount(host, now) {
    const model = buildCalendarModel(now || new Date());
    host.innerHTML = "<div class=\"budao-calendar-scroll\">" +
      "<span class=\"budao-calendar-spacer\" aria-hidden=\"true\"></span>" +
      "<div class=\"budao-calendar-strip\">" +
        renderMonth(model.previous) +
        renderMonth(model.current) +
        renderMonth(model.next) +
      "</div>" +
      "<span class=\"budao-calendar-spacer\" aria-hidden=\"true\"></span>" +
    "</div>";
    centerToday(host);
    return model;
  }

  return {
    buildCalendarModel,
    centeredScrollPosition,
    centerToday,
    mount
  };
}));
