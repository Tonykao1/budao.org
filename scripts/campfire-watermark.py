#!/usr/bin/env python3
"""Generate real watermarked display copies for approved Campfire trail photos.

Original photos remain unchanged in campfire-photos/. Only photos in published
albums that have explicit photo-level approval are included. Route cover
images, unpublished albums and unapproved images are not touched.
"""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

import cairosvg
from PIL import Image, ImageChops, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parent.parent
EXTENSIONS = {".jpeg", ".jpg", ".png", ".webp", ".avif"}
MAX_EDGE = 2400
MARK_WIDTH_FRAC = 0.09
EDGE_FRAC = 0.03
OPACITY = 0.60


def approved_sources(archive: dict) -> list[Path]:
    items: list[Path] = []
    seen = set()
    for album in archive.get("albums", []):
        if not isinstance(album, dict) or album.get("published") is not True:
            continue
        for photo in album.get("photos", []):
            if not isinstance(photo, dict) or photo.get("approved") is not True:
                continue
            value = photo.get("src", "")
            if not isinstance(value, str) or not value.startswith("/campfire-photos/"):
                continue
            rel = Path(value.removeprefix("/campfire-photos/"))
            if rel.is_absolute() or ".." in rel.parts or rel.suffix.lower() not in EXTENSIONS:
                continue
            if rel not in seen:
                items.append(rel)
                seen.add(rel)
    return items


def make_copy(source: Path, dest: Path, svg: bytes) -> None:
    with Image.open(source) as original:
        base = ImageOps.exif_transpose(original)
        # Archival masters are preserved; display copies are mobile-friendly.
        if max(base.size) > MAX_EDGE:
            base.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
        base = base.convert("RGBA")

    width, height = base.size
    short = min(width, height)
    mark_width = max(8, round(short * MARK_WIDTH_FRAC))
    margin = max(2, round(short * EDGE_FRAC))
    mark_mask = Image.open(
        io.BytesIO(cairosvg.svg2png(bytestring=svg, output_width=mark_width))
    ).getchannel("A")
    mark_height = mark_mask.height
    x = width - margin - mark_width
    y = height - margin - mark_height
    if x < 0 or y < 0:
        raise ValueError(f"Photo too small to watermark: {source}")

    # Choose dark or light lines using the local photo background, not EXIF.
    local = base.crop((x, y, x + mark_width, y + mark_height)).convert("RGB").convert("L")
    brightness = ImageStat.Stat(local).mean[0]
    ink = (21, 29, 25) if brightness >= 145 else (255, 255, 255)
    mask = mark_mask.point(lambda value: round(value * OPACITY))
    stamp = Image.new("RGBA", (mark_width, mark_height), ink + (0,))
    stamp.putalpha(mask)
    base.alpha_composite(stamp, (x, y))

    dest.parent.mkdir(parents=True, exist_ok=True)
    # WebP delivery is smaller and strips unnecessary EXIF/GPS metadata.
    base.save(dest, "WEBP", quality=88, method=5)



def hero_quality_score(source: Path) -> int:
    """Technical, offline-only aesthetic proxy (not AI or a subject judgment).

    Judges image clarity, balanced exposure, tonal contrast, color richness,
    framing suitability and pixel resolution. Editor choice can override it.
    """
    with Image.open(source) as original:
        frame = ImageOps.exif_transpose(original)
        width, height = frame.size
        preview = frame.convert("RGB")
        preview.thumbnail((320, 320), Image.Resampling.LANCZOS)
    gray = ImageOps.grayscale(preview)
    value = ImageStat.Stat(gray)
    luminance, contrast = value.mean[0], value.stddev[0]
    w, h = gray.size
    if w > 1:
        edge_map = ImageChops.difference(
            gray.crop((1, 0, w, h)), gray.crop((0, 0, w - 1, h))
        )
        edge_detail = ImageStat.Stat(edge_map).mean[0]
    else:
        edge_detail = 0.0
    saturation = ImageStat.Stat(preview.convert("HSV").getchannel("S")).mean[0]
    histogram = gray.histogram()
    clipped = (sum(histogram[:12]) + sum(histogram[244:])) / max(1, w * h)
    ratio = width / max(1, height)
    framing = 1.0 if 0.75 <= ratio <= 1.65 else max(0.35, 1.0 - abs(ratio - 1.2) / 2.0)
    resolution = min(1.0, min(width, height) / 1000.0)
    exposure = max(0.0, 1.0 - abs(luminance - 128.0) / 125.0)
    color = max(0.0, 1.0 - abs(saturation - 105.0) / 140.0)
    sharpness = min(1.0, edge_detail / 13.5)
    tone = min(1.0, contrast / 52.0)
    score = (
        25 + 20 * sharpness + 15 * tone + 10 * exposure
        + 10 * color + 12 * framing + 8 * resolution
        - 12 * min(1.0, clipped / 0.35)
    )
    return max(0, min(100, round(score)))


def build(root: Path) -> tuple[int, int]:
    archive = json.loads((root / "data" / "campfire-archive.json").read_text(encoding="utf-8"))
    svg = (root / "assets" / "budao-footprint-watermark.svg").read_bytes()
    source_root = root / "campfire-photos"
    output_root = root / "campfire-watermarked"
    selected = approved_sources(archive)
    outputs = set()
    quality_scores: dict[str, int] = {}

    for relative in selected:
        original = source_root / relative
        if not original.is_file():
            raise FileNotFoundError(f"Approved photo file is missing: {original}")
        dest = (output_root / relative).with_suffix(".webp")
        if dest.resolve() in outputs:
            raise ValueError(f"Two approved photos map to the same output path: {dest}")
        outputs.add(dest.resolve())
        # Score the *original* image, without changing the archival master.
        quality_scores["/campfire-photos/" + relative.as_posix()] = hero_quality_score(original)
        # Always rebuild: checkout timestamps don't reliably reflect photo changes.
        make_copy(original, dest, svg)

    removed = 0
    if output_root.exists():
        for candidate in output_root.rglob("*"):
            if candidate.is_file() and candidate.resolve() not in outputs:
                candidate.unlink()
                removed += 1
    # Deterministic manifest lets the browser choose attractive photos immediately,
    # without uploading image pixels, using a paid model or decoding the full archive.
    report = root / "data" / "campfire-hero-quality.json"
    report.write_text(
        json.dumps({"version": 1, "scores": dict(sorted(quality_scores.items()))},
                   ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return len(selected), removed


def main() -> None:
    parser = argparse.ArgumentParser(description="Bake a uniform footprint watermark into approved Campfire photos")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    count, removed = build(args.root)
    print(f"Campfire watermarks: {count} approved photos, removed {removed} obsolete output(s).")


if __name__ == "__main__":
    main()
