(function () {
  const publishPathPattern = /\/api\/publish-route(?:-v2)?/;
  const maxDataUrlLength = 220000;
  const targetRatio = 16 / 9;
  const widths = [1280, 1080, 960, 840, 720];
  const qualities = [0.76, 0.68, 0.6, 0.52, 0.46];
  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    const requestUrl = typeof input === "string" ? input : input && input.url || "";
    const method = init && init.method || input && input.method || "GET";

    if (!publishPathPattern.test(requestUrl) || String(method).toUpperCase() !== "POST" || !init || typeof init.body !== "string") {
      return originalFetch(input, init);
    }

    return preparePublishBody(init.body).then(function (body) {
      const nextInit = Object.assign({}, init, { body: body });
      return originalFetch(input, nextInit);
    });
  };

  function preparePublishBody(body) {
    let route;

    try {
      route = JSON.parse(body);
    } catch (error) {
      return Promise.resolve(body);
    }

    if (!route || typeof route.image !== "string" || route.image.indexOf("data:image/") !== 0) {
      return Promise.resolve(body);
    }

    return compressRouteImage(route.image).then(function (compressedImage) {
      route.image = compressedImage || "";
      route.imageAlt = route.imageAlt || route.title || "Budao route image";
      return JSON.stringify(route);
    }).catch(function () {
      if (route.image.length > maxDataUrlLength) {
        route.image = "";
      }

      return JSON.stringify(route);
    });
  }

  function compressRouteImage(dataUrl) {
    return loadImage(dataUrl).then(function (image) {
      let fallback = "";

      for (let widthIndex = 0; widthIndex < widths.length; widthIndex += 1) {
        const width = widths[widthIndex];
        const height = Math.round(width / targetRatio);

        for (let qualityIndex = 0; qualityIndex < qualities.length; qualityIndex += 1) {
          const result = renderCoverImage(image, width, height, qualities[qualityIndex]);

          if (!fallback || result.length < fallback.length) {
            fallback = result;
          }

          if (result.length <= maxDataUrlLength) {
            return result;
          }
        }
      }

      return fallback && fallback.length <= maxDataUrlLength * 1.1 ? fallback : "";
    });
  }

  function loadImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      const image = new Image();

      image.addEventListener("load", function () {
        resolve(image);
      });

      image.addEventListener("error", reject);
      image.src = dataUrl;
    });
  }

  function renderCoverImage(image, width, height, quality) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const sourceRatio = sourceWidth / sourceHeight;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    let cropX = 0;
    let cropY = 0;

    if (sourceRatio > targetRatio) {
      cropWidth = sourceHeight * targetRatio;
      cropX = (sourceWidth - cropWidth) / 2;
    } else if (sourceRatio < targetRatio) {
      cropHeight = sourceWidth / targetRatio;
      cropY = (sourceHeight - cropHeight) / 2;
    }

    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#f5f1e8";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", quality);
  }
}());