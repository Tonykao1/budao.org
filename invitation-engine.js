(function () {
    const previewId = "budaoInvitationPreview";

    function install() {
        ensurePreview();

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

    function openInvitation(route) {
        const preview = ensurePreview();
        const frame = preview.querySelector(".invitation-frame");
        const status = preview.querySelector(".invitation-status");
        const title = route.title || "步道同行";
        const location = [route.country, route.city, route.region].filter(Boolean).join(" · ") || route.location || "";
        const time = [route.date, route.time ? route.time + " 集合" : ""].filter(Boolean).join(" · ");
        const qr = window.resolveImage ? window.resolveImage(route.qrCode) : route.qrCode;

        frame.innerHTML =
            '<div class="invitation-card-lite">' +
                '<div class="invitation-lite-brand">B U D A O</div>' +
                '<div class="invitation-lite-kicker">同行邀请</div>' +
                '<h2></h2>' +
                '<p class="invitation-lite-location"></p>' +
                '<p class="invitation-lite-time"></p>' +
                '<div class="invitation-lite-qr"></div>' +
                '<p class="invitation-lite-caption">扫码进群，即可报名</p>' +
                '<p class="invitation-lite-footer">余生行走，不偏左右<br><strong>budao.org</strong></p>' +
            '</div>';

        frame.querySelector("h2").textContent = title;
        frame.querySelector(".invitation-lite-location").textContent = location;
        frame.querySelector(".invitation-lite-time").textContent = time;

        const qrBox = frame.querySelector(".invitation-lite-qr");
        if (qr) {
            const img = document.createElement("img");
            img.alt = "活动二维码";
            img.src = qr;
            qrBox.appendChild(img);
        } else {
            qrBox.textContent = "报名码暂未放出";
        }

        status.textContent = "这一程，已经预备好发出。";
        preview.classList.add("open");
        preview.setAttribute("aria-hidden", "false");
        document.body.classList.add("invitation-open");
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