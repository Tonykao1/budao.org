const ALLOWED_MIME = new Map([
  ["image/jpeg", { extension: "jpg", signature: isJpeg }],
  ["image/png", { extension: "png", signature: isPng }],
  ["image/webp", { extension: "webp", signature: isWebp }]
]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 12_000;

function validateRouteImageUpload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "invalid_request" };
  const keys = Object.keys(input);
  if (keys.length !== 2 || !keys.includes("mimeType") || !keys.includes("data")) return { error: "invalid_request" };
  if (typeof input.mimeType !== "string" || typeof input.data !== "string") return { error: "invalid_request" };

  const format = ALLOWED_MIME.get(input.mimeType.toLowerCase());
  if (!format) return { error: "unsupported_image_type" };
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.data) || input.data.length % 4 !== 0) return { error: "invalid_image" };

  let bytes;
  try {
    bytes = Buffer.from(input.data, "base64");
  } catch (error) {
    return { error: "invalid_image" };
  }

  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return { error: "image_too_large" };
  if (!format.signature(bytes)) return { error: "invalid_image" };

  const dimensions = imageDimensions(bytes, input.mimeType.toLowerCase());
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 ||
      dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
    return { error: "invalid_image" };
  }

  return { value: { bytes, extension: format.extension, mimeType: input.mimeType.toLowerCase(), dimensions } };
}

function managedImagePath(slot, randomName, extension) {
  return "route-assets/" + slot.toLowerCase() + "/" + randomName + "." + extension;
}

function managedImageUrl({ owner, repo, branch, path }) {
  return "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch + "/" + path;
}

function isManagedRouteImageUrl(value, slot, options = {}) {
  const owner = options.owner || process.env.GITHUB_OWNER || "Tonykao1";
  const repo = options.repo || process.env.GITHUB_REPO || "budao.org";
  const branch = options.branch || process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
  const prefix = "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch +
    "/route-assets/" + String(slot || "").toLowerCase() + "/";
  return typeof value === "string" && value.startsWith(prefix) &&
    /^[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(value.slice(prefix.length));
}

function isJpeg(bytes) {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

function isPng(bytes) {
  return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR";
}

function isWebp(bytes) {
  return bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

function imageDimensions(bytes, mimeType) {
  if (mimeType === "image/png") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (mimeType === "image/webp") return webpDimensions(bytes);
  return jpegDimensions(bytes);
}

function jpegDimensions(bytes) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function webpDimensions(bytes) {
  const kind = bytes.toString("ascii", 12, 16);
  if (kind === "VP8X" && bytes.length >= 30) {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (kind === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (kind === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
      height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6))
    };
  }
  return null;
}

module.exports = {
  ALLOWED_MIME,
  MAX_IMAGE_BYTES,
  isManagedRouteImageUrl,
  managedImagePath,
  managedImageUrl,
  validateRouteImageUpload
};
