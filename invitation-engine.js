(function () {
    const previewId = "budaoInvitationPreview";

    function install() {
        ensurePreview();
        scheduleMeetingEnhancement();

        document.addEventListener("click", function (event) {
            const trigger = event.target.closest(".invitation-trigger");

            if (!trigger) {
                return;
            }

            const routes = window.BudaoActiveRoutes || [];
            const route = routes[Number(trigger.dataset.routeIndex || "-1")];

            if (route) {
                openInvitation(route);
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeInvitation();
            }
        });
    }

    function scheduleMeetingEnhancement() {
        enhanceMeetings();
        window.setTimeout(enhanceMeetings, 800);
        window.setTimeout(enhanceMeetings, 2200);
    }

    function enhanceMeetings() {
        const routes = window.BudaoActiveRoutes || [];
        const cards = document.querySelectorAll(".route-card");

        cards.forEach(function (card, index) {
            if (card.querySelector(".route-meeting")) {
                return;
            }

            const route = routes[index] || {};
            const description = card.querySelector(".route-description");
            const place = meetingPlace(route);

            if (!description) {
                return;
            }

            const meeting = document.createElement("div");
            meeting.className = "route-meeting";
            meeting.setAttribute("aria-label", "集合地点");
            meeting.innerHTML =
                '<span class="meeting-map" aria-hidden="true"></span>' +
                '<div class="meeting-copy">' +
                '<div class="meeting-label">集合地点</div>' +
                '<div class="meeting-value"></div>' +
                '</div>';

            meeting.querySelector(".meeting-value").textContent = place || "集合地点待补充";
            description.insertAdjacentElement("afterend", meeting);
        });
    }

    function openInvitation(route) {
        const preview = ensurePreview();
        const frame = preview.querySelector(".invitation-frame");
        const status = preview.querySelector(".invitation-status");

        frame.innerHTML = "";
        frame.appendChild(createInvitationCard(route));
        status.textContent = "这一程，已经预备好发出。";
        preview.classList.add("open");
        preview.setAttribute("aria-hidden", "false");
        document.body.classList.add("invitation-open");
    }

    function createInvitationCard(route) {
        const card = document.createElement("article");
        const image = imageSource(route);
        const qr = qrSource(route);
        const place = meetingPlace(route);
        const location = locationLabel(route);
        const title = route.title || "步道同行";
        const date = formatDate(route.date);
        const time = route.time ? route.time + " 集合" : "时间待定";

        card.className = "invitation-vatican-card";
        card.innerHTML =
            '<header class="iv-head">' +
                '<div class="iv-title">INVITATION</div>' +
                '<div class="iv-hairline" aria-hidden="true"></div>' +
            '</header>' +
            '<section class="iv-hero">' +
                '<div class="iv-stamp">' +
                    '<div class="iv-stamp-photo"></div>' +
                    '<div class="iv-postmark" aria-hidden="true">' +
                        '<span>BUDAO</span>' +
                        '<small>WALK TOGETHER</small>' +
                    '</div>' +
                '</div>' +
                '<div class="iv-seal">' +
                    '<div class="iv-qr"></div>' +
                    '<div class="iv-seal-copy">' +
                        '<span>SCAN TO JOIN</span>' +
                        '<strong>扫码进群</strong>' +
                    '</div>' +
                '</div>' +
            '</section>' +
            '<section class="iv-copy">' +
                '<p class="iv-location"></p>' +
                '<h1></h1>' +
                '<p class="iv-description"></p>' +
                '<div class="iv-meta">' +
                    '<p><span>DATE</span><strong class="iv-date"></strong></p>' +
                    '<p><span>TIME</span><strong class="iv-time"></strong></p>' +
                    '<p><span>MEETING POINT</span><strong class="iv-place"></strong></p>' +
                '</div>' +
                '<p class="iv-route-line"></p>' +
            '</section>' +
            '<footer class="iv-foot">' +
                '<div class="iv-mini-seal">B</div>' +
                '<div class="iv-walk-mark">余生行走，不偏左右</div>' +
                '<div class="iv-site">budao.org</div>' +
            '</footer>';

        setText(card, ".iv-location", location || "同行地点待定");
        setText(card, "h1", title);
        setText(card, ".iv-description", oneSentence(route.description));
        setText(card, ".iv-date", date || "日期待定");
        setText(card, ".iv-time", time);
        setText(card, ".iv-place", place || "集合地点待补充");
        setText(card, ".iv-route-line", routeLine(route));

        const photo = card.querySelector(".iv-stamp-photo");
        if (image) {
            const img = document.createElement("img");
            img.alt = route.imageAlt || title;
            img.src = image;
            img.onerror = function () {
                photo.classList.add("is-empty");
                photo.textContent = location || "BUDAO";
            };
            photo.appendChild(img);
        } else {
            photo.classList.add("is-empty");
            photo.textContent = location || "BUDAO";
        }

        const qrBox = card.querySelector(".iv-qr");
        if (qr) {
            const img = document.createElement("img");
            img.alt = "活动二维码";
            img.src = qr;
            img.onerror = function () {
                qrBox.classList.add("is-empty");
                qrBox.textContent = "报名码暂未放出";
            };
            qrBox.appendChild(img);
        } else {
            qrBox.classList.add("is-empty");
            qrBox.textContent = "报名码暂未放出";
        }

        return card;
    }

    function setText(root, selector, value) {
        const target = root.querySelector(selector);

        if (target) {
            target.textContent = value || "";
        }
    }

    function closeInvitation() {
        const preview = document.getElementById(previewId);

        if (!preview) {
            return;
        }

        preview.classList.remove("open");
        preview.setAttribute("aria-hidden", "true");
        document.body.classList.remove("invitation-open");
    }

    function shareInvitation() {
        const status = ensurePreview().querySelector(".invitation-status");

        if (navigator.share) {
            navigator.share({
                title: "步道同行",
                text: "这一程，好像正在等你。",
                url: location.href
            }).catch(function () {
                status.textContent = "请柬仍在这里，等你再次发出。";
            });
        } else {
            status.textContent = "当前浏览器可以复制页面链接发出邀请。";
        }
    }

    function ensurePreview() {
        let preview = document.getElementById(previewId);

        if (preview) {
            return preview;
        }

        preview = document.createElement("div");
        preview.id = previewId;
        preview.className = "invitation-preview";
        preview.setAttribute("aria-hidden", "true");
        preview.innerHTML =
            '<div class="invitation-shell" role="dialog" aria-modal="true" aria-label="活动请柬">' +
                '<div class="invitation-frame"></div>' +
                '<div class="invitation-actions">' +
                    '<button type="button" data-invitation-close>返回</button>' +
                    '<button type="button" data-invitation-share>确认分享</button>' +
                '</div>' +
                '<p class="invitation-status" aria-live="polite"></p>' +
            '</div>';

        preview.addEventListener("click", function (event) {
            if (event.target === preview || event.target.closest("[data-invitation-close]")) {
                closeInvitation();
            }

            if (event.target.closest("[data-invitation-share]")) {
                shareInvitation();
            }
        });

        document.body.appendChild(preview);
        return preview;
    }

    function imageSource(route) {
        const value = route && (route.image || route.imageUrl);

        return window.resolveImage ? window.resolveImage(value) : String(value || "").trim();
    }

    function qrSource(route) {
        const value = route && route.qrCode;

        return window.resolveImage ? window.resolveImage(value) : String(value || "").trim();
    }

    function meetingPlace(route) {
        return String(
            route && (
                route.meetingPlace ||
                route.meetingPoint ||
                route.gatheringPlace ||
                route.meetingLocation ||
                route.assemblyPoint ||
                ""
            ) || ""
        ).trim();
    }

    function locationLabel(route) {
        if (!route) {
            return "";
        }

        return [route.country, route.city, route.region].filter(Boolean).join(" · ") ||
            route.location ||
            "";
    }

    function formatDate(date) {
        const match = String(date || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);

        if (!match) {
            return "";
        }

        return Number(match[2]) + "月" + Number(match[3]) + "日";
    }

    function oneSentence(text) {
        const clean = String(text || "").replace(/\s+/g, " ").trim();

        if (!clean) {
            return "这一程，已经安静预备，等待同行的人一起出发。";
        }

        return clean.length > 74 ? clean.slice(0, 72) + "…" : clean;
    }

    function routeLine(route) {
        return [
            route.distance,
            route.duration,
            route.surface,
            route.elevation,
            route.difficulty,
            route.suitableFor,
            route.equipmentMinimum,
            route.weather
        ].filter(Boolean).join(" · ");
    }

    window.BudaoInvitationEngine = {
        open: openInvitation,
        share: shareInvitation
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install);
    } else {
        install();
    }
}());
