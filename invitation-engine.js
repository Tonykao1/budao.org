(function (root, factory) {
    const api = factory(root || {});
    if (typeof module === "object" && module.exports) module.exports = { createInvitationEngine: factory };
    if (root && root.document) {
        root.BudaoInvitationEngine = api;
        api.install();
    }
}(typeof globalThis !== "undefined" ? globalThis : this, function (runtime) {
    "use strict";

    const previewId = "budaoInvitationPreview";
    const cardWidth = 1080;
    const cardHeight = 1530;
    const logoSource = "budao-logo-mark.png?v=20260719";
    const closedStampSources = Object.freeze({
        "1": "budao-dalong-1.png?v=20260812",
        "3": "budao-dalong-3.png?v=20260812",
        "5": "budao-dalong-5.png?v=20260812"
    });
    let currentInvitation = null;
    let activeTrigger = null;
    let generationId = 0;
    let installed = false;

    function install() {
        if (installed || !runtime.document) return;
        installed = true;
        ensurePreview();
        scheduleMeetingEnhancement();
        runtime.document.addEventListener("click", function (event) {
            const trigger = event.target && event.target.closest
                ? event.target.closest(".invitation-trigger")
                : null;
            if (!trigger) return;
            const routes = runtime.BudaoActiveRoutes || [];
            const route = routes[Number(trigger.dataset.routeIndex || "-1")];
            if (route) openInvitation(route, trigger);
        });
        runtime.document.addEventListener("keydown", handleDialogKeydown);
    }

    function scheduleMeetingEnhancement() {
        enhanceMeetings();
        if (typeof runtime.setTimeout === "function") {
            runtime.setTimeout(enhanceMeetings, 800);
            runtime.setTimeout(enhanceMeetings, 2200);
        }
    }

    function enhanceMeetings() {
        const routes = runtime.BudaoActiveRoutes || [];
        const cards = runtime.document.querySelectorAll(".route-card");
        cards.forEach(function (card, index) {
            if (card.querySelector(".route-meeting")) return;
            const description = card.querySelector(".route-description");
            if (!description) return;
            const meeting = runtime.document.createElement("div");
            meeting.className = "route-meeting";
            meeting.setAttribute("aria-label", "集合地点");
            meeting.innerHTML =
                '<span class="meeting-map" aria-hidden="true"></span>' +
                '<div class="meeting-copy"><div class="meeting-label">集合地点</div>' +
                '<div class="meeting-value"></div></div>';
            meeting.querySelector(".meeting-value").textContent =
                meetingPlace(routes[index] || {}) || "集合地点待补充";
            description.insertAdjacentElement("afterend", meeting);
        });
    }

    async function openInvitation(route, trigger) {
        const preview = ensurePreview();
        const frame = preview.querySelector(".invitation-frame");
        const requestId = ++generationId;
        activeTrigger = trigger || runtime.document.activeElement || null;
        releaseCurrentInvitation();
        setPreviewState(preview, "generating", "请柬正在安静预备。", "请柬正在生成。", true);
        preview.classList.add("open");
        preview.setAttribute("aria-hidden", "false");
        runtime.document.body.classList.add("invitation-open");
        focusDialog(preview);

        try {
            const generated = await createInvitation(route);
            if (requestId !== generationId || !preview.classList.contains("open")) return;
            const url = runtime.URL.createObjectURL(generated.blob);
            releaseCurrentInvitation();
            currentInvitation = Object.assign({}, generated, { url });
            const image = runtime.document.createElement("img");
            image.src = url;
            image.alt = (generated.viewModel.title || "步道同行") + " Mode B 分享请柬";
            frame.replaceChildren(image);
            setPreviewState(preview, "ready", "", "这一程，已经预备好发出。", false);
            configureReadyActions(preview);
        } catch (error) {
            if (requestId !== generationId) return;
            releaseCurrentInvitation();
            setPreviewState(preview, "failure", "请柬暂时没有生成，请稍后再试。", "请柬暂时没有生成。", true);
        }
    }

    async function createInvitation(route) {
        const modeB = runtime.BudaoInvitationModeB;
        const artifact = runtime.BudaoInvitationShareModeB;
        if (!modeB || typeof modeB.routeToModeBViewModel !== "function") throw new Error("mode_b_unavailable");
        if (!artifact || typeof artifact.renderModeBShareArtifact !== "function" ||
            typeof artifact.selectClosedVariant !== "function") {
            throw new Error("mode_b_share_renderer_unavailable");
        }
        if (!runtime.document || typeof runtime.document.createElement !== "function") throw new Error("canvas_unavailable");

        const viewModel = modeB.routeToModeBViewModel(Object.assign({}, route, {
            image: imageSource(route),
            qrCode: qrSource(route)
        }));
        const registrationOpen = isRegistrationOpen(route);
        const closedVariant = registrationOpen ? null : artifact.selectClosedVariant(viewModel.key);
        const renderState = Object.freeze({ registrationOpen, closedVariant });
        const canvas = runtime.document.createElement("canvas");
        if (!canvas || typeof canvas.getContext !== "function") throw new Error("canvas_unavailable");
        canvas.width = cardWidth;
        canvas.height = cardHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas_context_unavailable");

        const loaded = await Promise.all([
            loadOptionalImage(viewModel.visual.source),
            registrationOpen ? loadOptionalImage(viewModel.participation.artifact) : Promise.resolve(null),
            loadOptionalImage(logoSource),
            registrationOpen ? Promise.resolve(null) : loadOptionalImage(closedStampSources[closedVariant])
        ]);
        artifact.renderModeBShareArtifact(ctx, viewModel, renderState, {
            destinationImage: loaded[0],
            qrImage: loaded[1],
            logoImage: loaded[2],
            closedStampImage: loaded[3]
        });
        const blob = await canvasToBlob(canvas);
        return { blob, viewModel, renderState };
    }

    function setPreviewState(preview, state, frameMessage, statusMessage, disabled) {
        const frame = preview.querySelector(".invitation-frame");
        preview.dataset.state = state;
        if (frameMessage) {
            frame.innerHTML = '<div class="invitation-preparing"></div>';
            frame.querySelector(".invitation-preparing").textContent = frameMessage;
        }
        preview.querySelector(".invitation-status").textContent = statusMessage;
        preview.querySelector("[data-invitation-share]").disabled = disabled;
        preview.querySelector("[data-invitation-download]").disabled = disabled;
    }

    function configureReadyActions(preview) {
        const share = preview.querySelector("[data-invitation-share]");
        const download = preview.querySelector("[data-invitation-download]");
        const supported = webShareFilesSupported();
        share.hidden = !supported;
        share.disabled = !supported;
        download.hidden = false;
        download.disabled = false;
    }

    async function shareInvitation() {
        const status = ensurePreview().querySelector(".invitation-status");
        if (!currentInvitation) {
            status.textContent = "请柬还没有预备好。";
            return;
        }
        const file = invitationFile(currentInvitation);
        if (!webShareFilesSupported(file)) {
            status.textContent = "当前浏览器不支持直接分享图片，请使用“下载图片”保存。";
            return;
        }
        try {
            await runtime.navigator.share({
                files: [file],
                title: currentInvitation.viewModel.title || "步道同行",
                text: "这一程，好像正在等你。"
            });
            status.textContent = "请柬已经发出。";
        } catch (error) {
            status.textContent = error && error.name === "AbortError"
                ? "已取消分享，请柬仍在这里。"
                : "分享未完成，可再次尝试或下载保存。";
        }
    }

    function downloadInvitation() {
        const status = ensurePreview().querySelector(".invitation-status");
        if (!currentInvitation) {
            status.textContent = "请柬还没有预备好。";
            return;
        }
        const link = runtime.document.createElement("a");
        link.href = currentInvitation.url;
        link.download = invitationFileName(currentInvitation.viewModel);
        link.setAttribute("aria-label", "下载活动请柬 PNG");
        if (typeof link.click === "function") link.click();
        status.textContent = "请柬图片已开始下载。";
    }

    function closeInvitation() {
        const preview = runtime.document.getElementById(previewId);
        if (!preview) return;
        generationId += 1;
        preview.classList.remove("open");
        preview.setAttribute("aria-hidden", "true");
        runtime.document.body.classList.remove("invitation-open");
        releaseCurrentInvitation();
        if (activeTrigger && typeof activeTrigger.focus === "function") activeTrigger.focus();
        activeTrigger = null;
    }

    function releaseCurrentInvitation() {
        if (currentInvitation && currentInvitation.url) runtime.URL.revokeObjectURL(currentInvitation.url);
        currentInvitation = null;
    }

    function ensurePreview() {
        let preview = runtime.document.getElementById(previewId);
        if (preview) return preview;
        preview = runtime.document.createElement("div");
        preview.id = previewId;
        preview.className = "invitation-preview";
        preview.setAttribute("aria-hidden", "true");
        preview.innerHTML =
            '<div class="invitation-shell" role="dialog" aria-modal="true" aria-labelledby="budaoInvitationTitle">' +
                '<h2 id="budaoInvitationTitle" class="invitation-dialog-title">活动请柬预览</h2>' +
                '<div class="invitation-frame"></div>' +
                '<div class="invitation-actions">' +
                    '<button type="button" data-invitation-close aria-label="关闭活动请柬预览">返回</button>' +
                    '<button type="button" data-invitation-download disabled>下载图片</button>' +
                    '<button type="button" data-invitation-share disabled>确认分享</button>' +
                '</div>' +
                '<p class="invitation-status" aria-live="polite" aria-atomic="true"></p>' +
            '</div>';
        preview.addEventListener("click", function (event) {
            if (event.target === preview || event.target.closest("[data-invitation-close]")) closeInvitation();
            else if (event.target.closest("[data-invitation-share]")) shareInvitation();
            else if (event.target.closest("[data-invitation-download]")) downloadInvitation();
        });
        runtime.document.body.appendChild(preview);
        return preview;
    }

    function handleDialogKeydown(event) {
        const preview = runtime.document.getElementById(previewId);
        if (!preview || !preview.classList.contains("open")) return;
        if (event.key === "Escape") {
            event.preventDefault();
            closeInvitation();
            return;
        }
        if (event.key !== "Tab") return;
        const focusable = Array.from(preview.querySelectorAll("button:not([disabled]):not([hidden])"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && runtime.document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && runtime.document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function focusDialog(preview) {
        const close = preview.querySelector("[data-invitation-close]");
        if (close && typeof close.focus === "function") close.focus();
    }

    function loadOptionalImage(src) {
        return loadImage(src).catch(function () { return null; });
    }

    function loadImage(src) {
        return new Promise(function (resolve, reject) {
            if (!src || typeof runtime.Image !== "function") {
                reject(new Error("image_unavailable"));
                return;
            }
            const image = new runtime.Image();
            image.crossOrigin = "anonymous";
            image.onload = function () { resolve(image); };
            image.onerror = function () { reject(new Error("image_load_failed")); };
            image.src = src;
        });
    }

    function canvasToBlob(canvas) {
        return new Promise(function (resolve, reject) {
            if (!canvas || typeof canvas.toBlob !== "function") {
                reject(new Error("canvas_blob_unavailable"));
                return;
            }
            canvas.toBlob(function (blob) {
                if (blob) resolve(blob);
                else reject(new Error("canvas_blob_empty"));
            }, "image/png");
        });
    }

    function invitationFile(invitation) {
        return new runtime.File([invitation.blob], invitationFileName(invitation.viewModel), { type: "image/png" });
    }

    function invitationFileName(viewModel) {
        return safeFileName(viewModel && viewModel.title || "budao-invitation") + ".png";
    }

    function webShareFilesSupported(file) {
        if (!runtime.navigator || typeof runtime.navigator.share !== "function" ||
            typeof runtime.navigator.canShare !== "function" || typeof runtime.File !== "function") return false;
        const candidate = file || new runtime.File([new runtime.Blob([])], "budao-invitation.png", { type: "image/png" });
        try {
            return runtime.navigator.canShare({ files: [candidate] });
        } catch (error) {
            return false;
        }
    }

    function imageSource(route) {
        const value = route && (route.image || route.imageUrl);
        return runtime.resolveImage ? runtime.resolveImage(value) : String(value || "").trim();
    }

    function qrSource(route) {
        const value = route && (route.qrCode || route.registrationQrCode || route.registrationQr ||
            route.activityQrCode || route.qrImage || route.qr || "");
        return runtime.resolveImage ? runtime.resolveImage(value) : String(value || "").trim();
    }

    function isRegistrationOpen(route) {
        return typeof runtime.isQrRegistrationOpen === "function"
            ? Boolean(runtime.isQrRegistrationOpen(route))
            : true;
    }

    function meetingPlace(route) {
        return String(route && (route.meetingPlace || route.meetingPoint || route.gatheringPlace ||
            route.meetingLocation || route.assemblyPoint || "") || "").trim();
    }

    function safeFileName(value) {
        return String(value || "budao-invitation").replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\s+/g, "-").slice(0, 64);
    }

    return {
        install,
        open: openInvitation,
        close: closeInvitation,
        share: shareInvitation,
        download: downloadInvitation,
        createArtifact: createInvitation,
        _state: function () { return currentInvitation; }
    };
}));
