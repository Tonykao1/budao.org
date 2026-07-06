(function () {
    const width = 1080;
    const height = 1920;
    const previewId = "budaoInvitationPreview";

    const imagePipeline = {
        imageSourceMode: "uploaded",
        availableModes: ["uploaded", "ai-enhanced"],
        async resolve(route) {
            return resolveImageSource(route && (route.image || route.imageUrl));
        }
    };

    let currentInvitation = null;

    function install() {
        ensurePreview();

        document.addEventListener("click", function (event) {
            const trigger = event.target.closest(".invitation-trigger");

            if (!trigger) {
                return;
            }

            const index = Number(trigger.dataset.routeIndex || "-1");
            const routes = window.BudaoActiveRoutes || [];
            const route = routes[index];

            if (!route) {
                return;
            }

            openInvitation(route);
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeInvitation();
            }
        });
    }

    async function openInvitation(route) {
        const preview = ensurePreview();
        const status = preview.querySelector(".invitation-status");
        const frame = preview.querySelector(".invitation-frame");

        status.textContent = "请柬正在安静生成。";
        frame.innerHTML = "";
        preview.classList.add("open");
        preview.setAttribute("aria-hidden", "false");
        document.body.classList.add("invitation-open");

        try {
            const result = await createInvitation(route);
            const image = document.createElement("img");

            image.src = result.url;
            image.alt = "步道活动请柬";
            frame.innerHTML = "";
            frame.appendChild(image);
            currentInvitation = result;
            status.textContent = "这一程，已经预备好发出。";
        } catch (error) {
            status.textContent = "请柬暂时没有生成，请稍后再试。";
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

    async function shareInvitation() {
        const preview = ensurePreview();
        const status = preview.querySelector(".invitation-status");

        if (!currentInvitation) {
            status.textContent = "请柬还没有预备好。";
            return;
        }

        const file = new File(
            [currentInvitation.blob],
            safeFileName(currentInvitation.route.title) + ".png",
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

        status.textContent = "当前浏览器无法直接唤起系统分享，可以长按请柬使用系统分享。";
    }

    async function createInvitation(route) {
        let canvas = createCanvas();
        let ctx = canvas.getContext("2d");

        await drawInvitation(ctx, route);

        let blob;

        try {
            blob = await canvasToBlob(canvas);
        } catch (error) {
            canvas = createCanvas();
            ctx = canvas.getContext("2d");
            await drawInvitation(ctx, route, { withoutExternalImage: true });
            blob = await canvasToBlob(canvas);
        }

        return {
            route,
            blob,
            url: URL.createObjectURL(blob)
        };
    }

    function createCanvas() {
        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    async function drawInvitation(ctx, route, options) {
        const data = normalizeInvitationData(route);
        const qrSource = resolveImageSource(route && route.qrCode);
        const qr = qrSource ? await loadImage(qrSource).catch(function () { return null; }) : null;

        drawBackground(ctx);
        drawPaperShell(ctx);
        drawBrandTop(ctx);
        drawMainCopy(ctx, data);
        drawInfoPills(ctx, data);
        drawQr(ctx, qr);
        drawBrandBottom(ctx);
    }

    function normalizeInvitationData(route) {
        const location = locationLabel(route);

        return {
            type: "route",
            imageSourceMode: route.imageSourceMode || imagePipeline.imageSourceMode,
            scripture: route.scripture || "",
            scriptureTheme: route.scriptureTheme || "",
            scriptureText: route.scriptureText || "",
            scriptureImage: route.scriptureImage || "",
            theme: route.theme || "",
            location,
            title: route.title || "步道同行",
            description: route.description || "",
            leader: route.leader || route.host || leaderName(route),
            date: route.date || "",
            time: route.time || "",
            meetingPlace: route.meetingPlace || route.meetingPoint || route.gatheringPlace || "",
            duration: route.duration || "",
            distance: route.distance || "",
            difficulty: route.difficulty || "",
            suitableFor: route.suitableFor || "",
            weather: route.weather || ""
        };
    }

    function drawBackground(ctx) {
        ctx.save();
        ctx.fillStyle = "#f3eee7";
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(width / 2, 430, 60, width / 2, 430, 720);
        glow.addColorStop(0, "rgba(255,252,244,0.82)");
        glow.addColorStop(0.58, "rgba(235,226,214,0.18)");
        glow.addColorStop(1, "rgba(243,238,231,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    function drawPaperShell(ctx) {
        ctx.save();
        ctx.shadowColor = "rgba(96,74,48,0.08)";
        ctx.shadowBlur = 54;
        ctx.shadowOffsetY = 28;
        archedPanelPath(ctx, 230, 145, 620, 1640, 270);
        ctx.fillStyle = "#fffefd";
        ctx.fill();
        ctx.restore();

        ctx.save();
        archedPanelPath(ctx, 230, 145, 620, 1640, 270);
        ctx.strokeStyle = "rgba(190,157,106,0.08)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    function drawBrandTop(ctx) {
        ctx.save();
        ctx.fillStyle = "#26231f";
        ctx.font = "400 25px 'Courier New', monospace";
        ctx.textAlign = "center";
        drawText(ctx, "B U D A O", width / 2, 290);

        ctx.strokeStyle = "#b89c52";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 24, 340);
        ctx.lineTo(width / 2 + 24, 340);
        ctx.stroke();
        ctx.restore();
    }

    function drawMainCopy(ctx, data) {
        ctx.save();
        ctx.fillStyle = "#b89c52";
        ctx.font = "300 25px 'Courier New', monospace";
        ctx.textAlign = "center";
        drawText(ctx, "同行邀请", width / 2, 455);

        ctx.fillStyle = "#24211d";
        ctx.font = "400 48px Georgia, 'Times New Roman', serif";
        wrapText(ctx, invitationTheme(data), width / 2, 585, 450, 60, 2, "center");

        ctx.fillStyle = "#77716a";
        ctx.font = "300 24px Georgia, 'Times New Roman', serif";
        wrapText(ctx, invitationVerse(data), width / 2, 760, 440, 42, 3, "center");

        ctx.strokeStyle = "rgba(184,156,82,0.48)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 34, 910);
        ctx.lineTo(width / 2 + 34, 910);
        ctx.stroke();
        ctx.restore();
    }

    function drawInfoPills(ctx, data) {
        const items = invitationInfoItems(data);

        ctx.save();
        ctx.textAlign = "center";
        items.forEach(function (item, index) {
            const y = 960 + index * 100;
            ctx.fillStyle = "#9a948c";
            ctx.font = "500 17px Inter, Arial, sans-serif";
            drawText(ctx, item.label, width / 2, y);
            ctx.fillStyle = "#28241f";
            ctx.font = "300 28px Georgia, 'Times New Roman', serif";
            drawText(ctx, item.value, width / 2, y + 42);
        });
        ctx.restore();
    }

    function drawQr(ctx, qr) {
        const size = 138;
        const x = width / 2 - size / 2;
        const y = 1378;

        ctx.save();
        roundedRect(ctx, x - 14, y - 14, size + 28, size + 28, 18);
        ctx.fillStyle = "#fffefd";
        ctx.fill();
        ctx.strokeStyle = "rgba(230,103,44,0.18)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (qr) {
            drawCoverImage(ctx, qr, x, y, size, size);
        } else {
            ctx.fillStyle = "#eee7dc";
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = "#83786b";
            ctx.font = "300 22px Georgia, 'Times New Roman', serif";
            ctx.textAlign = "center";
            wrapText(ctx, "报名码暂未放出", x + size / 2, y + 90, 142, 31, 2, "center");
        }

        ctx.fillStyle = "#77716a";
        ctx.font = "300 20px 'Courier New', monospace";
        ctx.textAlign = "center";
        drawText(ctx, "扫码进群，即可报名", width / 2, y + size + 58);
        ctx.restore();
    }

    function drawBrandBottom(ctx) {
        ctx.save();
        ctx.textAlign = "center";
        roundedRect(ctx, width / 2 - 118, 1624, 236, 58, 29);
        ctx.fillStyle = "#161616";
        ctx.fill();

        ctx.fillStyle = "#fffefd";
        ctx.font = "400 22px 'Courier New', monospace";
        drawText(ctx, "同行", width / 2, 1661);

        ctx.fillStyle = "#7d7770";
        ctx.font = "300 20px 'Courier New', monospace";
        drawText(ctx, "余生行走，不偏左右", width / 2, 1738);

        ctx.fillStyle = "#1e1a15";
        ctx.font = "600 34px Arial, sans-serif";
        drawText(ctx, "budao.org", width / 2, 1795);
        ctx.restore();
    }

    function formatInvitationDate(date) {
        const match = String(date || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);

        if (!match) {
            return "";
        }

        return Number(match[2]) + "月" + Number(match[3]) + "日";
    }

    function leaderName(route) {
        const owner = String(route && route.owner || "").trim().toLowerCase();
        const slot = String(route && route.slot || "").trim().toUpperCase();

        if (slot === "IMS" || owner === "ims@budao.org") {
            return "IMS";
        }

        if (slot === "BACBC" || owner === "bacbc@budao.org") {
            return "BACBC";
        }

        return "Budao";
    }

    function invitationTheme(data) {
        const theme = data.scriptureTheme || data.theme || data.title || "同行";

        return String(theme).replace(/\s+/g, " ").trim();
    }

    function invitationVerse(data) {
        const scriptureText = String(data.scriptureText || "").trim();
        const scripture = String(data.scripture || "").trim();

        if (scriptureText && scripture) {
            return "“" + scriptureText.replace(/^["“]|["”]$/g, "") + "”\n" + scripture;
        }

        if (scriptureText) {
            return "“" + scriptureText.replace(/^["“]|["”]$/g, "") + "”";
        }

        return invitationSentence(data.description);
    }

    function invitationInfoItems(data) {
        const date = formatInvitationDate(data.date);
        const meeting = data.meetingPlace || data.location;

        return [
            { label: "DATE", value: date || "待定" },
            { label: "TIME", value: data.time ? data.time + " 集合" : "待定" },
            { label: "LOCATION", value: meeting || "待定" },
            { label: "LEADER", value: data.leader || "Budao" }
        ];
    }

    function conciseDescription(description) {
        const text = String(description || "")
            .replace(/\s+/g, " ")
            .replace(/。.*$/, "。")
            .trim();

        return text.length > 58 ? text.slice(0, 56) + "..." : text;
    }

    function invitationSentence(description) {
        const text = conciseDescription(description);

        if (!text) {
            return "这一程，已经安静预备，等待同行的人一起出发。";
        }

        return text;
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

    function resolveImageSource(value) {
        if (typeof window.resolveImage === "function") {
            return window.resolveImage(value);
        }

        return String(value || "").trim();
    }

    function locationLabel(route) {
        if (typeof window.getLocationLabel === "function") {
            return window.getLocationLabel(route);
        }

        return [route.country, route.city, route.region].filter(Boolean).join(" · ") || route.location || "";
    }

    function loadImage(src) {
        return new Promise(function (resolve, reject) {
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
            try {
                canvas.toBlob(function (blob) {
                    blob ? resolve(blob) : reject(new Error("empty_blob"));
                }, "image/png", 0.95);
            } catch (error) {
                reject(error);
            }
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

    function roundedRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }

    function archedPanelPath(ctx, x, y, w, h, arch) {
        ctx.beginPath();
        ctx.moveTo(x, y + arch);
        ctx.bezierCurveTo(x, y + arch * 0.34, x + w * 0.2, y, x + w / 2, y);
        ctx.bezierCurveTo(x + w * 0.8, y, x + w, y + arch * 0.34, x + w, y + arch);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines, align) {
        const words = splitText(String(text || ""));
        const lines = [];
        let line = "";

        words.forEach(function (word) {
            const test = line + word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        });

        if (line) {
            lines.push(line);
        }

        const visible = lines.slice(0, maxLines);
        if (lines.length > maxLines && visible.length) {
            visible[visible.length - 1] = trimToWidth(ctx, visible[visible.length - 1] + "...", maxWidth);
        }

        ctx.textAlign = align || "left";
        visible.forEach(function (lineText, index) {
            drawText(ctx, lineText, x, y + index * lineHeight);
        });
    }

    function splitText(text) {
        const normalized = text.replace(/\s+/g, " ").trim();

        if (!normalized) {
            return [];
        }

        if (/[\u4e00-\u9fff]/.test(normalized)) {
            return normalized.split("");
        }

        return normalized.split(" ").map(function (word) {
            return word + " ";
        });
    }

    function trimToWidth(ctx, text, maxWidth) {
        let value = text;
        while (value.length > 1 && ctx.measureText(value).width > maxWidth) {
            value = value.slice(0, -4) + "...";
        }
        return value;
    }

    function drawText(ctx, text, x, y) {
        ctx.fillText(String(text || ""), x, y);
    }

    function safeFileName(value) {
        return String(value || "budao-invitation")
            .replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\s+/g, "-")
            .slice(0, 80);
    }

    window.BudaoInvitationEngine = {
        create: createInvitation,
        open: openInvitation,
        share: shareInvitation,
        imagePipeline: imagePipeline
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install);
    } else {
        install();
    }
}());
