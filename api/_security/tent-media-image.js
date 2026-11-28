const sharp = require("sharp");
const crypto = require("node:crypto");
const path = require("node:path");
const {readFile} = require("node:fs/promises");
const limit = 2 * 1024 * 1024;

async function prepareImage(body) {
  if (typeof body.data !== "string" || body.data.length > 4 * Math.ceil(limit / 3)) throw Error("invalid_image");
  const bytes = Buffer.from(body.data, "base64");
  if (!bytes.length || bytes.length > limit || bytes.toString("base64") !== body.data) throw Error("invalid_image");
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  if (body.sha256 !== sha) throw Error("hash_mismatch");
  const input = sharp(bytes, {limitInputPixels: 24000000, failOn: "warning"});
  const meta = await input.metadata();
  if (!["jpeg","png","webp"].includes(meta.format) || (meta.pages || 1) !== 1) throw Error("invalid_image");
  const {data:master, info} = await input.rotate().resize({width:2400,height:2400,fit:"inside",withoutEnlargement:true}).webp({quality:88}).toBuffer({resolveWithObject:true});
  const edge = Math.min(info.width, info.height);
  if (edge < 32 || master.length > limit) throw Error("invalid_image");
  const width = Math.max(8, Math.round(edge * 0.09));
  const height = Math.round(width * 312 / 133);
  const margin = Math.max(2, Math.round(edge * 0.03));
  const left = info.width - width - margin, top = info.height - height - margin;
  const patch = await sharp(master).extract({left,top,width,height}).greyscale().raw().toBuffer();
  const light = patch.reduce((sum, v) => sum + v, 0) / patch.length >= 145;
  const svg = await readFile(path.join(__dirname,"../../assets/budao-footprint-watermark.svg"),"utf8");
  const stamp = await sharp(Buffer.from(svg.replace('fill="black"', 'opacity="0.6" fill="' + (light ? '#151d19' : 'white') + '"'))).resize(width,height).png().toBuffer();
  const display = await sharp(master).composite([{input:stamp,left,top}]).webp({quality:88}).toBuffer();
  if (display.length > limit) throw Error("invalid_image");
  return {sha,master,display};
}
module.exports = {prepareImage};
