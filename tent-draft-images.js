(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BudaoTentDraftImages = api;
}(typeof window !== "undefined" ? window : null, function () {
  function readFileAsDataUrl(file, FileReaderCtor) {
    return new Promise(function (resolve, reject) {
      let reader;
      try {
        reader = new FileReaderCtor();
        reader.addEventListener("load", function () {
          const dataUrl = String(reader.result || "");
          if (!dataUrl.startsWith("data:image/")) return reject(stageError("image_read_failed"));
          resolve(dataUrl);
        });
        reader.addEventListener("error", function () { reject(stageError("image_read_failed")); });
        reader.readAsDataURL(file);
      } catch (error) {
        reject(stageError("image_read_failed"));
      }
    });
  }

  function prepareRouteImage(file, options) {
    const FileReaderCtor = options.FileReaderCtor;
    const compressor = options.compressor;
    const compressionTimeoutMs = options.compressionTimeoutMs || 7000;
    return readFileAsDataUrl(file, FileReaderCtor).catch(function (error) {
      reportDiagnostic(options, "image read", error);
      throw error;
    }).then(function (original) {
      if (typeof compressor !== "function") {
        reportDiagnostic(options, "image compression", stageError("image_compression_unavailable"));
        return imageRecord(file, original, false);
      }
      return withTimeout(Promise.resolve().then(function () {
        return compressor(original);
      }), compressionTimeoutMs).then(function (compressed) {
        const usable = typeof compressed === "string" && compressed.startsWith("data:image/");
        if (!usable) reportDiagnostic(options, "image compression", stageError("image_compression_empty"));
        return imageRecord(file, usable ? compressed : original, usable);
      }).catch(function (error) {
        reportDiagnostic(options, "image compression", error);
        return imageRecord(file, original, false);
      });
    });
  }

  function withTimeout(promise, timeoutMs) {
    let timeoutId;
    const timeout = new Promise(function (_resolve, reject) {
      timeoutId = setTimeout(function () {
        reject(stageError("image_compression_timeout"));
      }, timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(function () {
      clearTimeout(timeoutId);
    });
  }

  function createSubmissionGuard(options) {
    let running = false;

    return function runSubmission(task) {
      if (running) return Promise.resolve({ skipped: true });

      running = true;
      options.setMessage("正在安放这条步道…");
      options.setProcessing(true);

      return Promise.resolve().then(task).finally(function () {
        running = false;
        options.setProcessing(false);
      });
    };
  }

  function persistDraft(storage, key, trails) {
    try {
      storage.setItem(key, JSON.stringify(trails));
      return { saved: true, quotaExceeded: false };
    } catch (error) {
      return { saved: false, quotaExceeded: isQuotaError(error), error };
    }
  }

  function dataUrlPayload(dataUrl) {
    const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/);
    return match ? { mimeType: match[1], data: match[2] } : null;
  }

  function ensureManagedRouteImage(route, upload) {
    if (!String(route && route.image || "").startsWith("data:")) {
      return Promise.resolve({ route, uploaded: false });
    }

    const payload = dataUrlPayload(route.image);
    if (!payload) return Promise.reject(stageError("image_upload_failed"));

    return Promise.resolve(upload(payload)).then(function (url) {
      if (typeof url !== "string" || !url.startsWith("https://")) {
        throw stageError("image_upload_failed");
      }
      return { route: { ...route, image: url }, uploaded: true };
    });
  }

  function rememberManagedRouteImage(trail, url, label) {
    if (!trail || !trail.source || typeof url !== "string" || !url.startsWith("https://")) return trail;
    trail.source.images = [];
    trail.source.existingImage = url;
    trail.source.existingImageAlt = label || trail.source.existingImageAlt || "";
    trail.source.removeExistingImage = false;
    return trail;
  }

  function imageRecord(file, dataUrl, compressed) {
    return {
      name: file && file.name || "route-image",
      type: compressed ? "image/jpeg" : file && file.type || "",
      dataUrl
    };
  }

  function isQuotaError(error) {
    return Boolean(error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014));
  }

  function stageError(reason) {
    const error = new Error(reason);
    error.reason = reason;
    return error;
  }

  function reportDiagnostic(options, stage, error) {
    if (typeof options.onDiagnostic === "function") options.onDiagnostic(stage, error);
  }

  return {
    createSubmissionGuard,
    dataUrlPayload,
    ensureManagedRouteImage,
    persistDraft,
    prepareRouteImage,
    readFileAsDataUrl,
    rememberManagedRouteImage,
    withTimeout
  };
}));
