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
        const heroSource = options && options.withoutExternalImage ? "" : await imagePipeline.resolve(route);
        const qrSource = resolveImageSource(route && route.qrCode);
        const hero = heroSource ? await loadImage(heroSource).catch(function () { return null; }) : null;
        const qr = qrSource ? await loadImage(qrSource).catch(function () { return null; }) : null;

        drawBackground(ctx);
        drawBrandTop(ctx);
        drawHero(ctx, hero, data.location);
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
            scriptureImage: route.scriptureImage || "",
            location,
            title: route.title || "步道同行",
            description: route.description || "",
            date: route.date || "",
            time: route.time || "",
            duration: route.duration || "",
            distance: route.distance || "",
            difficulty: route.difficulty || "",
            suitableFor: route.suitableFor || "",
            weather: route.weather || ""
        };
    }

    function drawBackground(ctx) {
        ctx.save();
        ctx.fillStyle = "#f4f1eb";
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(270, 260, 20, 270, 260, 720);
        glow.addColorStop(0, "rgba(255,250,235,0.98)");
        glow.addColorStop(0.48, "rgba(229,218,199,0.42)");
        glow.addColorStop(1, "rgba(244,241,235,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    function drawBrandTop(ctx) {
        ctx.save();
        ctx.fillStyle = "rgba(38,32,25,0.58)";
        ctx.font = "500 30px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.letterSpacing = "18px";
        drawText(ctx, "B U D A O", width / 2, 82);
        ctx.restore();
    }

    function drawHero(ctx, image, location) {
        const x = 70;
        const y = 126;
        const w = 940;
        const h = 910;
        const radius = 44;

        ctx.save();
        ctx.shadowColor = "rgba(80,65,45,0.15)";
        ctx.shadowBlur = 48;
        ctx.shadowOffsetY = 28;
        roundedRect(ctx, x, y, w, h, radius);
        ctx.fillStyle = "rgba(255,250,240,0.7)";
        ctx.fill();
        ctx.restore();

        ctx.save();
        roundedRect(ctx, x, y, w, h, radius);
        ctx.clip();

        if (image) {
            drawCoverImage(ctx, image, x, y, w, h);
            const warmth = ctx.createLinearGradient(x, y, x + w, y + h);
            warmth.addColorStop(0, "rgba(255,242,210,0.2)");
            warmth.addColorStop(0.48, "rgba(244,232,211,0.06)");
            warmth.addColorStop(1, "rgba(84,66,44,0.26)");
            ctx.fillStyle = warmth;
            ctx.fillRect(x, y, w, h);

            const skySpace = ctx.createLinearGradient(0, y, 0, y + h * 0.46);
            skySpace.addColorStop(0, "rgba(250,245,232,0.36)");
            skySpace.addColorStop(1, "rgba(250,245,232,0)");
            ctx.fillStyle = skySpace;
            ctx.fillRect(x, y, w, h * 0.48);

            const shade = ctx.createLinearGradient(0, y + h * 0.56, 0, y + h);
            shade.addColorStop(0, "rgba(24,19,14,0)");
            shade.addColorStop(1, "rgba(24,19,14,0.38)");
            ctx.fillStyle = shade;
            ctx.fillRect(x, y, w, h);
        } else {
            const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
            gradient.addColorStop(0, "#efe8db");
            gradient.addColorStop(0.38, "#d8cbb8");
            gradient.addColorStop(1, "#958b78");
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, w, h);

            ctx.fillStyle = "rgba(255,250,232,0.5)";
            ctx.beginPath();
            ctx.arc(x + 260, y + 250, 180, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "rgba(255,250,232,0.34)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + 90, y + h - 320);
            ctx.bezierCurveTo(x + 280, y + h - 430, x + 560, y + h - 200, x + w - 84, y + h - 312);
            ctx.stroke();
        }

        const veil = ctx.createLinearGradient(0, y + h - 220, 0, y + h);
        veil.addColorStop(0, "rgba(0,0,0,0)");
        veil.addColorStop(1, "rgba(0,0,0,0.18)");
        ctx.fillStyle = veil;
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = "rgba(255,250,238,0.76)";
        ctx.font = "300 23px Georgia, 'Times New Roman', serif";
        ctx.textAlign = "left";
        drawText(ctx, location || "BUDAO", x + 54, y + h - 56);
        ctx.restore();
    }

    function drawMainCopy(ctx, data) {
        ctx.save();
        ctx.fillStyle = "#7a7064";
        ctx.font = "300 28px Georgia, 'Times New Roman', serif";
        ctx.textAlign = "center";
        drawText(ctx, data.location, width / 2, 1116);

        ctx.fillStyle = "#2a241c";
        ctx.font = "300 25px Georgia, 'Times New Roman', serif";
        drawText(ctx, eventMeta(data), width / 2, 1164);

        ctx.fillStyle = "#1d1914";
        ctx.font = "600 58px Georgia, 'Times New Roman', serif";
        wrapText(ctx, data.title, width / 2, 1250, 780, 68, 2, "center");

        ctx.fillStyle = "#675f55";
        ctx.font = "300 25px Georgia, 'Times New Roman', serif";
        wrapText(ctx, data.description, width / 2, 1394, 720, 40, 2, "center");
        ctx.restore();
    }

    function drawInfoPills(ctx, data) {
        const rows = balancedPillRows(data);
        const startY = 1502;
        const gap = 18;
        const pillH = 48;

        ctx.save();
        ctx.font = "300 22px Arial, sans-serif";
        rows.forEach(function (row, rowIndex) {
            const rowItems = row.map(function (pill) {
                return {
                    text: pill,
                    width: Math.min(286, Math.max(148, measurePill(ctx, pill)))
                };
            });
            const total = rowItems.reduce(function (sum, item) { return sum + item.width; }, 0) + gap * (rowItems.length - 1);
            let x = (width - total) / 2;
            const y = startY + rowIndex * (pillH + 14);

            rowItems.forEach(function (item) {
                roundedRect(ctx, x, y, item.width, pillH, pillH / 2);
                ctx.fillStyle = "rgba(255,252,244,0.72)";
                ctx.fill();
                ctx.strokeStyle = "rgba(170,139,88,0.34)";
                ctx.lineWidth = 1.4;
                ctx.stroke();
                ctx.fillStyle = "#554d43";
                ctx.textAlign = "center";
                drawText(ctx, fitText(ctx, item.text, item.width - 36), x + item.width / 2, y + 32);
                x += item.width + gap;
            });
        });
        ctx.restore();
    }

    function drawQr(ctx, qr) {
        const size = 188;
        const x = 116;
        const y = 1662;

        ctx.save();
        roundedRect(ctx, x - 16, y - 16, size + 32, size + 32, 30);
        ctx.fillStyle = "rgba(255,252,246,0.9)";
        ctx.fill();
        ctx.strokeStyle = "rgba(172,143,98,0.22)";
        ctx.lineWidth = 1.5;
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

        ctx.fillStyle = "#3f382f";
        ctx.font = "400 28px Georgia, 'Times New Roman', serif";
        ctx.textAlign = "left";
        drawText(ctx, "扫码进群，即可报名", x + size + 48, y + 94);
        ctx.restore();
    }

    function drawBrandBottom(ctx) {
        ctx.save();
        ctx.textAlign = "right";
        ctx.fillStyle = "#6a6156";
        ctx.font = "300 25px Georgia, 'Times New Roman', serif";
        drawText(ctx, "余生行走，不偏左右", 964, 1808);

        ctx.fillStyle = "#1e1a15";
        ctx.font = "600 56px Arial, sans-serif";
        drawText(ctx, "budao.org", 964, 1882);
        ctx.restore();
    }

    function eventMeta(data) {
        const pieces = [
            formatInvitationDate(data.date),
            data.time ? data.time + " 集合" : ""
        ].filter(Boolean);

        return pieces.join(" · ");
    }

    function formatInvitationDate(date) {
        const match = String(date || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);

        if (!match) {
            return "";
        }

        return Number(match[2]) + "月" + Number(match[3]) + "日";
    }

    function balancedPillRows(data) {
        const first = [
            data.time ? data.time + " 集合" : "",
            data.duration ? "预计 " + data.duration : ""
        ].filter(Boolean);

        const second = [
            data.distance,
            data.difficulty ? "难度 " + data.difficulty : "",
            data.weather
        ].filter(Boolean);

        const third = [
            data.suitableFor ? "适合 " + data.suitableFor : ""
        ].filter(Boolean);

        const rows = [first, second, third].filter(function (row) {
            return row.length > 0;
        });

        if (rows.length === 1 && rows[0].length > 3) {
            return [rows[0].slice(0, 2), rows[0].slice(2)];
        }

        return rows.slice(0, 3);
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

    function fitText(ctx, text, maxWidth) {
        const value = String(text || "");

        if (ctx.measureText(value).width <= maxWidth) {
            return value;
        }

        return trimToWidth(ctx, value, maxWidth);
    }

    function drawText(ctx, text, x, y) {
        ctx.fillText(String(text || ""), x, y);
    }

    function measurePill(ctx, text) {
        ctx.save();
        ctx.font = "300 24px Arial, sans-serif";
        const size = ctx.measureText(text).width + 52;
        ctx.restore();
        return size;
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
