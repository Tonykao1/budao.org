(function () {
    const width = 1080;
    const height = 1920;
    const previewId = "budaoInvitationPreview";

    const imagePipeline = {
        mode: "tent-image",
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
            imageMode: imagePipeline.mode,
            scripture: route.scripture || "",
            scriptureTheme: route.scriptureTheme || "",
            scriptureImage: route.scriptureImage || "",
            location,
            title: route.title || "步道同行",
            description: route.description || "",
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
        ctx.fillStyle = "rgba(42,36,28,0.56)";
        ctx.font = "500 31px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.letterSpacing = "18px";
        drawText(ctx, "B U D A O", width / 2, 92);
        ctx.restore();
    }

    function drawHero(ctx, image, location) {
        const x = 82;
        const y = 150;
        const w = 916;
        const h = 1040;
        const radius = 48;

        ctx.save();
        roundedRect(ctx, x, y, w, h, radius);
        ctx.clip();

        if (image) {
            drawCoverImage(ctx, image, x, y, w, h);
            const shade = ctx.createLinearGradient(0, y + h * 0.45, 0, y + h);
            shade.addColorStop(0, "rgba(0,0,0,0)");
            shade.addColorStop(1, "rgba(0,0,0,0.32)");
            ctx.fillStyle = shade;
            ctx.fillRect(x, y, w, h);
        } else {
            const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
            gradient.addColorStop(0, "#e8e0d3");
            gradient.addColorStop(0.42, "#d4c7b4");
            gradient.addColorStop(1, "#9f947f");
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, w, h);

            ctx.fillStyle = "rgba(255,250,232,0.42)";
            ctx.beginPath();
            ctx.arc(x + 230, y + 220, 150, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "rgba(255,250,232,0.28)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + 90, y + h - 270);
            ctx.bezierCurveTo(x + 270, y + h - 350, x + 520, y + h - 180, x + w - 80, y + h - 260);
            ctx.stroke();
        }

        ctx.fillStyle = "rgba(255,250,238,0.7)";
        ctx.font = "300 24px Georgia, 'Times New Roman', serif";
        ctx.textAlign = "left";
        drawText(ctx, location || "BUDAO", x + 52, y + h - 58);
        ctx.restore();
    }

    function drawMainCopy(ctx, data) {
        ctx.save();
        ctx.fillStyle = "#73695d";
        ctx.font = "300 32px Georgia, 'Times New Roman', serif";
        ctx.textAlign = "center";
        drawText(ctx, data.location, width / 2, 1268);

        ctx.fillStyle = "#211d18";
        ctx.font = "600 64px Georgia, 'Times New Roman', serif";
        wrapText(ctx, data.title, width / 2, 1354, 830, 78, 2, "center");

        ctx.fillStyle = "#625b51";
        ctx.font = "300 28px Georgia, 'Times New Roman', serif";
        wrapText(ctx, data.description, width / 2, 1490, 780, 46, 3, "center");
        ctx.restore();
    }

    function drawInfoPills(ctx, data) {
        const pills = [
            data.time ? data.time + " 集合" : "",
            data.duration,
            data.distance,
            data.difficulty ? "难度 " + data.difficulty : "",
            data.suitableFor,
            data.weather
        ].filter(Boolean).slice(0, 6);

        const startY = 1618;
        const gap = 18;
        const pillH = 50;
        const widths = pills.map(function (pill) {
            return Math.min(300, Math.max(156, measurePill(ctx, pill)));
        });

        let rows = [[]];
        let rowWidth = 0;

        pills.forEach(function (pill, index) {
            const w = widths[index];
            if (rowWidth && rowWidth + gap + w > 820) {
                rows.push([]);
                rowWidth = 0;
            }
            rows[rows.length - 1].push({ text: pill, width: w });
            rowWidth += (rowWidth ? gap : 0) + w;
        });

        ctx.save();
        ctx.font = "300 24px Arial, sans-serif";
        rows.slice(0, 2).forEach(function (row, rowIndex) {
            const total = row.reduce(function (sum, item) { return sum + item.width; }, 0) + gap * (row.length - 1);
            let x = (width - total) / 2;
            const y = startY + rowIndex * (pillH + 16);

            row.forEach(function (item) {
                roundedRect(ctx, x, y, item.width, pillH, pillH / 2);
                ctx.fillStyle = "#e9e2d7";
                ctx.fill();
                ctx.fillStyle = "#5d554c";
                ctx.textAlign = "center";
                drawText(ctx, item.text, x + item.width / 2, y + 33);
                x += item.width + gap;
            });
        });
        ctx.restore();
    }

    function drawQr(ctx, qr) {
        const size = 178;
        const x = 116;
        const y = 1738;

        ctx.save();
        roundedRect(ctx, x - 14, y - 14, size + 28, size + 28, 28);
        ctx.fillStyle = "#fffaf2";
        ctx.fill();

        if (qr) {
            drawCoverImage(ctx, qr, x, y, size, size);
        } else {
            ctx.fillStyle = "#ece5da";
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = "#83786b";
            ctx.font = "300 21px Georgia, 'Times New Roman', serif";
            ctx.textAlign = "center";
            wrapText(ctx, "报名码暂未放出", x + size / 2, y + 78, 128, 30, 2, "center");
        }

        ctx.fillStyle = "#413a31";
        ctx.font = "400 26px Georgia, 'Times New Roman', serif";
        ctx.textAlign = "left";
        drawText(ctx, "扫码报名", x + size + 42, y + 70);
        drawText(ctx, "与祂同行", x + size + 42, y + 116);
        ctx.restore();
    }

    function drawBrandBottom(ctx) {
        ctx.save();
        ctx.textAlign = "right";
        ctx.fillStyle = "#5d554b";
        ctx.font = "300 25px Georgia, 'Times New Roman', serif";
        drawText(ctx, "余生行走，不偏左右", 964, 1778);
        drawText(ctx, "每一步，都算数", 964, 1822);

        ctx.fillStyle = "#1f1c17";
        ctx.font = "600 48px Arial, sans-serif";
        drawText(ctx, "budao.org", 964, 1888);
        ctx.restore();
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
