(function () {
    const previewId = "budaoInvitationPreview";
    const cardWidth = 1080;
    const cardHeight = 1530;
    let currentInvitation = null;

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

    async function openInvitation(route) {
        const preview = ensurePreview();
        const frame = preview.querySelector(".invitation-frame");
        const status = preview.querySelector(".invitation-status");

        currentInvitation = null;
        frame.innerHTML = '<div class="invitation-preparing">请柬正在安静预备。</div>';
        status.textContent = "";
        preview.classList.add("open");
        preview.setAttribute("aria-hidden", "false");
        document.body.classList.add("invitation-open");

        try {
            currentInvitation = await createInvitation(route);
            const image = document.createElement("img");

            image.src = currentInvitation.url;
            image.alt = (route.title || "步道同行") + " 邀约卡";
            frame.innerHTML = "";
            frame.appendChild(image);
            status.textContent = "这一程，已经预备好发出。";
        } catch (error) {
            frame.innerHTML = '<div class="invitation-preparing">请柬暂时没有生成，请稍后再试。</div>';
            status.textContent = "";
        }
    }

    async function createInvitation(route) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const image = await loadImage(imageSource(route)).catch(function () { return null; });
        const qr = await loadImage(qrSource(route)).catch(function () { return null; });

        canvas.width = cardWidth;
        canvas.height = cardHeight;
        drawInvitation(ctx, route, image, qr);

        const blob = await canvasToBlob(canvas);

        return {
            blob,
            route,
            url: URL.createObjectURL(blob)
        };
    }

    function drawInvitation(ctx, route, image, qr) {
        const place = meetingPlace(route);
        const location = locationLabel(route) || "同行地点待定";
        const title = route.title || "步道同行";
        const date = formatDate(route.date) || "日期待定";
        const time = route.time ? route.time + " 集合" : "时间待定";

        drawPaper(ctx);
        drawTop(ctx);
        drawStamp(ctx, image, location);
        drawLetter(ctx, route, { title, location, date, time, place });
        drawInfoPills(ctx, route, { date, time, place });
        drawQrSeal(ctx, qr);
        drawFooter(ctx);
    }

    function drawPaper(ctx) {
        ctx.fillStyle = "#fbfaf7";
        ctx.fillRect(0, 0, cardWidth, cardHeight);
        ctx.strokeStyle = "rgba(61,48,35,0.12)";
        ctx.lineWidth = 2;
        ctx.strokeRect(42, 42, cardWidth - 84, cardHeight - 84);

        ctx.fillStyle = "rgba(184,156,82,0.08)";
        ctx.beginPath();
        ctx.arc(870, 146, 96, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawTop(ctx) {
        ctx.fillStyle = "#12100d";
        drawSpacedText(ctx, "INVITATION", cardWidth / 2, 126, 62, 20, "Times New Roman", "700", "center");

        ctx.strokeStyle = "rgba(184,156,82,0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cardWidth / 2 - 44, 174);
        ctx.lineTo(cardWidth / 2 + 44, 174);
        ctx.stroke();

        ctx.fillStyle = "rgba(87,77,65,0.58)";
        drawSpacedText(ctx, "BUDAO POST", 112, 210, 18, 5, "Arial", "400", "left");
    }

    function drawStamp(ctx, image, location) {
        const x = 735;
        const y = 210;
        const w = 218;
        const h = 286;

        ctx.save();
        drawStampPaper(ctx, x, y, w, h);
        ctx.fillStyle = "#fff";
        ctx.fillRect(x + 14, y + 14, w - 28, h - 28);

        if (image) {
            drawCoverImage(ctx, image, x + 20, y + 20, w - 40, h - 40);
        } else {
            const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
            gradient.addColorStop(0, "#efe8d9");
            gradient.addColorStop(1, "#c9bda7");
            ctx.fillStyle = gradient;
            ctx.fillRect(x + 20, y + 20, w - 40, h - 40);
            ctx.fillStyle = "rgba(55,47,36,0.42)";
            drawWrappedText(ctx, location, x + 38, y + h / 2 - 20, w - 76, 22, 2);
        }

        drawPostmark(ctx, x + 114, y + 172, 132);
        ctx.restore();
    }

    function drawStampPaper(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(37,28,18,0.14)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        ctx.fillRect(x, y, w, h);
        ctx.restore();

        ctx.fillStyle = "#fbfaf7";
        for (let i = 9; i < w; i += 20) {
            circle(ctx, x + i, y, 6);
            circle(ctx, x + i, y + h, 6);
        }
        for (let i = 9; i < h; i += 20) {
            circle(ctx, x, y + i, 6);
            circle(ctx, x + w, y + i, 6);
        }
    }

    function drawPostmark(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.2);
        ctx.strokeStyle = "rgba(52,54,60,0.52)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-44, -20);
        ctx.lineTo(44, -20);
        ctx.moveTo(-44, 20);
        ctx.lineTo(44, 20);
        ctx.stroke();
        ctx.fillStyle = "rgba(52,54,60,0.62)";
        drawSpacedText(ctx, "BUDAO", 0, -4, 20, 2, "Courier New", "700", "center");
        drawSpacedText(ctx, "WALK", 0, 30, 11, 1.5, "Courier New", "700", "center");
        ctx.restore();
    }

    function drawLetter(ctx, route, data) {
        const x = 118;
        const w = 572;
        let y = 290;

        ctx.fillStyle = "#7d6f5f";
        ctx.font = "28px 'Noto Serif SC', 'Songti SC', serif";
        ctx.textAlign = "left";
        ctx.fillText("亲爱的同行者：", x, y);

        y += 86;
        ctx.fillStyle = "#17130f";
        ctx.font = "700 72px 'Noto Serif SC', 'Songti SC', serif";
        y = drawWrappedText(ctx, data.title, x, y, w, 84, 2);

        y += 28;
        ctx.fillStyle = "#7a6b5b";
        ctx.font = "28px 'Noto Serif SC', 'Songti SC', serif";
        ctx.fillText(data.location, x, y);

        y += 56;
        ctx.fillStyle = "#2b251f";
        ctx.font = "700 34px 'Noto Serif SC', 'Songti SC', serif";
        ctx.fillText(data.date + " · " + data.time, x, y);

        y += 76;
        ctx.fillStyle = "#514940";
        ctx.font = "30px 'Noto Serif SC', 'Songti SC', serif";
        y = drawWrappedText(ctx, letterText(route.description), x, y, w + 120, 54, 5, true);

        ctx.fillStyle = "#7d6f5f";
        ctx.font = "26px 'Noto Serif SC', 'Songti SC', serif";
        drawWrappedText(ctx, "若你也愿意，就在这一天，与我们一同走一段路。", x, y + 46, w + 90, 46, 2);
    }

    function drawInfoPills(ctx, route, data) {
        const pills = [
            ["日期", data.date],
            ["时间", data.time],
            ["集合", data.place || "待补充"],
            ["距离", route.distance],
            ["预计", route.duration],
            ["难度", route.difficulty],
            ["路面", route.surface],
            ["爬升", route.elevation],
            ["适合", route.suitableFor],
            ["装备", route.equipmentMinimum]
        ].filter(function (item) { return item[1]; });

        const startX = 118;
        const startY = 940;
        const gap = 18;
        const rowH = 58;
        const maxW = 690;
        let x = startX;
        let y = startY;

        ctx.font = "24px 'Noto Serif SC', 'Songti SC', serif";
        pills.forEach(function (pill) {
            const text = pill[0] + " " + pill[1];
            const width = Math.min(Math.max(ctx.measureText(text).width + 62, 150), 330);

            if (x + width > startX + maxW) {
                x = startX;
                y += rowH + gap;
            }

            drawPill(ctx, x, y, width, rowH, text);
            x += width + gap;
        });
    }

    function drawPill(ctx, x, y, w, h, text) {
        ctx.save();
        roundRect(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fill();
        ctx.strokeStyle = "rgba(184,156,82,0.34)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#4f473d";
        ctx.font = "24px 'Noto Serif SC', 'Songti SC', serif";
        ctx.textAlign = "center";
        ctx.fillText(trimToWidth(ctx, text, w - 34), x + w / 2, y + 38);
        ctx.restore();
    }

    function drawQrSeal(ctx, qr) {
        const x = 780;
        const y = 1048;
        const size = 172;

        ctx.save();
        ctx.strokeStyle = "rgba(184,156,82,0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 20, y - 20, size + 40, size + 40);

        if (qr) {
            ctx.fillStyle = "#fff";
            ctx.fillRect(x, y, size, size);
            drawContainImage(ctx, qr, x, y, size, size);
        } else {
            ctx.fillStyle = "#f8f5ef";
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = "#6c6258";
            ctx.font = "24px 'Noto Serif SC', 'Songti SC', serif";
            ctx.textAlign = "center";
            drawWrappedText(ctx, "报名码暂未放出", x + size / 2 - 68, y + 76, 136, 34, 2);
        }

        ctx.fillStyle = "#8b7860";
        drawSpacedText(ctx, "SCAN TO JOIN", x + size / 2, y + size + 54, 17, 4, "Arial", "700", "center");
        ctx.fillStyle = "#15110d";
        ctx.font = "30px 'Noto Serif SC', 'Songti SC', serif";
        ctx.textAlign = "center";
        ctx.fillText("扫码进群，即可报名", x + size / 2, y + size + 98);
        ctx.restore();
    }

    function drawFooter(ctx) {
        ctx.strokeStyle = "rgba(20,16,12,0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(118, 1385);
        ctx.lineTo(962, 1385);
        ctx.stroke();

        ctx.fillStyle = "#6f6458";
        ctx.font = "26px 'Noto Serif SC', 'Songti SC', serif";
        ctx.textAlign = "left";
        ctx.fillText("余生行走，不偏左右", 118, 1440);
        ctx.fillStyle = "#15110d";
        ctx.font = "700 38px Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("budao.org", 962, 1442);
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

    async function shareInvitation() {
        const status = ensurePreview().querySelector(".invitation-status");

        if (!currentInvitation) {
            status.textContent = "请柬还没有预备好。";
            return;
        }

        const file = new File(
            [currentInvitation.blob],
            safeFileName(currentInvitation.route.title || "budao-invitation") + ".png",
            { type: "image/png" }
        );

        if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
            try {
                await navigator.share({
                    files: [file],
                    title: currentInvitation.route.title || "步道同行",
                    text: "这一程，好像正在等你。"
                });
                status.textContent = "请柬已经发出。";
            } catch (error) {
                status.textContent = "请柬仍在这里，等你再次发出。";
            }
            return;
        }

        status.textContent = "当前浏览器不能直接分享图片。请长按或右键这张请柬保存后发出。";
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

    function letterText(text) {
        const clean = String(text || "").replace(/\s+/g, " ").trim();

        if (!clean) {
            return "这一程，已经安静预备，等待同行的人一起出发。";
        }

        return clean.length > 118 ? clean.slice(0, 116) + "…" : clean;
    }

    function loadImage(src) {
        return new Promise(function (resolve, reject) {
            if (!src) {
                reject(new Error("empty image"));
                return;
            }

            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = function () {
                resolve(image);
            };
            image.onerror = reject;
            image.src = src;
        });
    }

    function canvasToBlob(canvas) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("empty canvas"));
                }
            }, "image/png", 0.95);
        });
    }

    function drawCoverImage(ctx, image, x, y, w, h) {
        const scale = Math.max(w / image.width, h / image.height);
        const sw = w / scale;
        const sh = h / scale;
        const sx = (image.width - sw) / 2;
        const sy = (image.height - sh) / 2;

        ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
    }

    function drawContainImage(ctx, image, x, y, w, h) {
        const scale = Math.min(w / image.width, h / image.height);
        const dw = image.width * scale;
        const dh = image.height * scale;
        const dx = x + (w - dw) / 2;
        const dy = y + (h - dh) / 2;

        ctx.drawImage(image, dx, dy, dw, dh);
    }

    function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines, ellipsis) {
        const words = Array.from(String(text || ""));
        let line = "";
        let lines = [];

        words.forEach(function (char) {
            const test = line + char;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = char;
            } else {
                line = test;
            }
        });

        if (line) {
            lines.push(line);
        }

        if (maxLines && lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            if (ellipsis) {
                lines[lines.length - 1] = trimToWidth(ctx, lines[lines.length - 1] + "…", maxWidth);
            }
        }

        lines.forEach(function (lineText, index) {
            ctx.fillText(lineText, x, y + index * lineHeight);
        });

        return y + lines.length * lineHeight;
    }

    function drawSpacedText(ctx, text, x, y, size, spacing, family, weight, align) {
        ctx.font = (weight || "400") + " " + size + "px " + family;
        ctx.textAlign = "left";

        const chars = Array.from(text);
        const total = chars.reduce(function (sum, char) {
            return sum + ctx.measureText(char).width;
        }, 0) + spacing * (chars.length - 1);

        let start = align === "center" ? x - total / 2 : x;

        chars.forEach(function (char) {
            ctx.fillText(char, start, y);
            start += ctx.measureText(char).width + spacing;
        });
    }

    function trimToWidth(ctx, text, maxWidth) {
        let value = String(text || "");

        while (value.length > 1 && ctx.measureText(value).width > maxWidth) {
            value = value.slice(0, -2) + "…";
        }

        return value;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function circle(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    function safeFileName(value) {
        return String(value || "budao-invitation")
            .replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\s+/g, "-")
            .slice(0, 64);
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
