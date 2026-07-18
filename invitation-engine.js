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
        const logo = await loadImage("budao-logo-mark.png").catch(function () { return null; });

        canvas.width = cardWidth;
        canvas.height = cardHeight;
        drawInvitation(ctx, route, image, qr, logo);

        const blob = await canvasToBlob(canvas);

        return {
            blob,
            route,
            url: URL.createObjectURL(blob)
        };
    }

    function drawInvitation(ctx, route, image, qr, logo) {
        const place = meetingPlace(route);
        const location = locationLabel(route) || "同行地点待定";
        const title = route.title || "步道同行";
        const date = formatDate(route.date) || "日期待定";
        const time = route.time ? route.time + " 集合" : "时间待定";

        drawPaper(ctx);
        drawTop(ctx);
        drawStamp(ctx, image, location, route);
        drawLetter(ctx, route, { title, location, date, time, place });
        drawMeetingCard(ctx, place);
        drawInfoPills(ctx, route);
        drawQrSeal(ctx, qr);
        drawFooter(ctx, logo);
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

    }

    function drawStamp(ctx, image, location, route) {
        const x = 718;
        const y = 226;
        const w = 232;
        const h = 304;

        ctx.save();
        drawStampPaper(ctx, x, y, w, h);
        ctx.fillStyle = "#fff";
        ctx.fillRect(x + 16, y + 16, w - 32, h - 32);

        if (image) {
            drawCoverImage(ctx, image, x + 24, y + 24, w - 48, h - 48);
        } else {
            const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
            gradient.addColorStop(0, "#efe8d9");
            gradient.addColorStop(1, "#c9bda7");
            ctx.fillStyle = gradient;
            ctx.fillRect(x + 24, y + 24, w - 48, h - 48);
            ctx.fillStyle = "rgba(55,47,36,0.42)";
            drawWrappedText(ctx, location, x + 38, y + h / 2 - 20, w - 76, 22, 2);
        }

        drawPostmark(ctx, x + 98, y + 148, route);
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

    function drawPostmark(ctx, cx, cy, route) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.12);
        ctx.strokeStyle = "rgba(43,49,55,0.56)";
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.arc(0, 0, 66, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(43,49,55,0.36)";
        ctx.lineWidth = 3.2;
        for (let i = 0; i < 5; i += 1) {
            const y = -44 + i * 18;
            ctx.beginPath();
            ctx.moveTo(48, y + i * 1.5);
            ctx.lineTo(176 + i * 7, y - 14 + i * 2.5);
            ctx.stroke();
        }

        ctx.fillStyle = "rgba(52,54,60,0.62)";
        drawSpacedText(ctx, "BUDAO", 0, -12, 18, 2, "Courier New", "700", "center");
        drawSpacedText(ctx, postmarkDate(route && route.date), 0, 12, 11, 1, "Courier New", "700", "center");
        drawSpacedText(ctx, "WALK", 0, 34, 10, 1.5, "Courier New", "700", "center");
        ctx.restore();
    }

    function drawLetter(ctx, route, data) {
        const x = 118;
        const w = 600;
        let y = 258;

        ctx.fillStyle = "#17130f";
        ctx.font = cnFont(620, 78);
        y = drawWrappedText(ctx, data.title, x, y, w, 86, 2);

        y += 34;
        ctx.fillStyle = "#7a6b5b";
        ctx.font = cnFont(500, 29);
        ctx.fillText(data.location, x, y);

        y += 54;
        ctx.fillStyle = "#2b251f";
        ctx.font = cnFont(620, 33);
        ctx.fillText(data.date + " · " + data.time, x, y);

        y += 74;
        ctx.fillStyle = "#4b3424";
        ctx.font = cnFont(420, 26);
        ctx.fillText("这是一段被安静预备的路，也是一份邀请。", x, y);

        y += 56;
        ctx.fillStyle = "#4f4840";
        ctx.font = handwritingFont(360, 27);
        y = drawWrappedText(ctx, letterText(route.description), x, y, w - 8, 50, 3, true);

        ctx.fillStyle = "#7d6f5f";
        ctx.font = cnFont(360, 26);
        drawWrappedText(ctx, "唯有祂感动你，让我们一路同行，共步主道。", x, y + 42, w - 8, 46, 2);
    }

    function drawMeetingCard(ctx, place) {
        const x = 118;
        const y = 840;
        const w = 700;
        const h = 92;
        const value = place || "集合地点待补充";

        ctx.save();
        roundRect(ctx, x, y, w, h, 18);
        ctx.fillStyle = "rgba(255,255,255,0.58)";
        ctx.fill();
        ctx.strokeStyle = "rgba(184,156,82,0.28)";
        ctx.lineWidth = 1.7;
        ctx.stroke();

        ctx.fillStyle = "#a0917d";
        drawSpacedText(ctx, "MEETING POINT", x + 32, y + 36, 13, 2.8, "Arial", "700", "left");
        ctx.fillStyle = "#332b24";
        ctx.font = cnFont(580, 27);
        ctx.textAlign = "left";
        ctx.fillText(trimToWidth(ctx, value, w - 250), x + 32, y + 70);

        ctx.strokeStyle = "rgba(184,156,82,0.24)";
        ctx.beginPath();
        ctx.moveTo(x + w - 186, y + 22);
        ctx.lineTo(x + w - 186, y + h - 22);
        ctx.stroke();

        ctx.fillStyle = "#8d8378";
        ctx.font = systemFont(460, 17);
        ctx.textAlign = "left";
        ctx.fillText("请预留到达", x + w - 166, y + 48);
        ctx.fillText("与彼此等候的时间", x + w - 166, y + 70);
        ctx.restore();
    }

    function drawInfoPills(ctx, route) {
        const rows = [
            [
                ["距离", route.distance],
                ["预计", route.duration],
                ["难度", route.difficulty]
            ],
            [
                ["路面", route.surface],
                ["爬升", route.elevation]
            ],
            [
                ["适合", route.suitableFor]
            ],
            [
                ["装备", route.equipmentMinimum],
                ["天气", route.weather]
            ]
        ].map(function (row) {
            return row.filter(function (item) { return item[1]; });
        }).filter(function (row) { return row.length; });

        const startX = 118;
        const startY = 972;
        const gap = 16;
        const rowH = 52;
        const maxW = 590;
        let y = startY;

        ctx.font = cnFont(500, 22);
        rows.forEach(function (row) {
            const pills = row.map(function (pill) {
                const text = pill[0] + " " + pill[1];
                return {
                    text,
                    width: Math.min(Math.max(ctx.measureText(text).width + 58, 142), 302)
                };
            });
            const total = pills.reduce(function (sum, pill) {
                return sum + pill.width;
            }, 0) + gap * (pills.length - 1);
            let x = startX + Math.max(0, (maxW - total) / 2);

            pills.forEach(function (pill) {
                drawPill(ctx, x, y, pill.width, rowH, pill.text);
                x += pill.width + gap;
            });
            y += rowH + gap;
        });
    }

    function drawPill(ctx, x, y, w, h, text) {
        ctx.save();
        roundRect(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fill();
        ctx.strokeStyle = "rgba(184,156,82,0.32)";
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.fillStyle = "#4f473d";
        ctx.font = cnFont(500, 22);
        ctx.textAlign = "center";
        ctx.fillText(trimToWidth(ctx, text, w - 32), x + w / 2, y + 35);
        ctx.restore();
    }

    function drawQrSeal(ctx, qr) {
        const x = 800;
        const y = 1102;
        const size = 152;

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
            ctx.font = cnFont(400, 22);
            ctx.textAlign = "center";
            ctx.fillText("报名码", x + size / 2, y + 70);
            ctx.fillText("暂未放出", x + size / 2, y + 102);
        }

        ctx.fillStyle = "#8b7860";
        drawSpacedText(ctx, "SCAN TO JOIN", x + size / 2, y + size + 48, 15, 3.6, "Arial", "700", "center");
        ctx.fillStyle = "#15110d";
        ctx.font = cnFont(560, 28);
        ctx.textAlign = "center";
        ctx.fillText("扫码进群，即可报名", x + size / 2, y + size + 88);
        ctx.restore();
    }

    function drawFooter(ctx, logo) {
        ctx.strokeStyle = "rgba(20,16,12,0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(118, 1384);
        ctx.lineTo(962, 1384);
        ctx.stroke();

        if (logo) {
            drawContainImage(ctx, logo, 118, 1398, 108, 64);
        }

        ctx.fillStyle = "#6f6458";
        ctx.font = cnFont(400, 24);
        ctx.textAlign = "left";
        ctx.fillText("余生行走，不偏左右", 248, 1432);

        ctx.fillStyle = "#15110d";
        ctx.font = systemFont(750, 40);
        ctx.textAlign = "right";
        ctx.fillText("budao.org", 962, 1438);

        ctx.strokeStyle = "rgba(20,16,12,0.09)";
        ctx.beginPath();
        ctx.moveTo(248, 1458);
        ctx.lineTo(962, 1458);
        ctx.stroke();
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
        const value = route && (
            route.qrCode ||
            route.registrationQrCode ||
            route.registrationQr ||
            route.activityQrCode ||
            route.qrImage ||
            route.qr ||
            ""
        );

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

        return clean.length > 96 ? clean.slice(0, 94) + "…" : clean;
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

    function circleStroke(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    function cnFont(weight, size) {
        return String(weight || 400) + " " + size + 'px "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif';
    }

    function systemFont(weight, size) {
        return String(weight || 400) + " " + size + 'px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
    }

    function handwritingFont(weight, size) {
        return String(weight || 400) + " " + size + 'px "Kaiti SC", "STKaiti", "Songti SC", "PingFang SC", serif';
    }

    function postmarkDate(date) {
        const match = String(date || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

        if (!match) {
            return "POST";
        }

        return months[Number(match[2]) - 1] + " " + String(Number(match[3])).padStart(2, "0");
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
