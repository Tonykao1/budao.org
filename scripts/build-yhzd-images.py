#!/usr/bin/env python3
"""Build responsive, metadata-free images for 营火之地.

Usage:
  python3 scripts/build-yhzd-images.py

Drop original JPEG/PNG/HEIC-converted files into assets-src/yhzd/.
The script preserves each photo's composition: it resizes only, never crops.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    raise SystemExit(
        "Pillow is required. Install once with: python3 -m pip install Pillow"
    )

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets-src" / "yhzd"
OUTPUT_DIR = ROOT / "images" / "yhzd"
WIDTHS = (480, 960)
TARGET_BYTES = {480: 70_000, 960: 180_000}
QUALITIES = (78, 74, 70, 66, 62, 58, 54, 50)
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}


def image_id(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest[:12]


def resize_only(image: Image.Image, target_width: int) -> Image.Image:
    width, height = image.size
    if width <= target_width:
        return image.copy()
    target_height = round(height * target_width / width)
    return image.resize((target_width, target_height), Image.Resampling.LANCZOS)


def save_webp(image: Image.Image, path: Path, max_bytes: int) -> None:
    for quality in QUALITIES:
        image.save(path, "WEBP", quality=quality, method=6)
        if path.stat().st_size <= max_bytes:
            return


def main() -> int:
    if not SOURCE_DIR.exists():
        SOURCE_DIR.mkdir(parents=True, exist_ok=True)
        print(f"Created {SOURCE_DIR}. Add original photos there, then run again.")
        return 0

    sources = sorted(
        p for p in SOURCE_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in EXTENSIONS
    )

    if not sources:
        print(f"No source photos found in {SOURCE_DIR}.")
        return 0

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {"version": 1, "images": []}
    seen_ids: set[str] = set()

    for source in sources:
        uid = image_id(source)
        if uid in seen_ids:
            continue
        seen_ids.add(uid)

        with Image.open(source) as raw:
            # Applies EXIF orientation before metadata is intentionally discarded.
            image = ImageOps.exif_transpose(raw).convert("RGB")

        width, height = image.size
        orientation = "portrait" if height > width else "landscape"
        record = {
            "id": uid,
            "orientation": orientation,
            "width": width,
            "height": height,
        }

        for target_width in WIDTHS:
            resized = resize_only(image, target_width)
            output_name = f"firefly-{uid}-{target_width}.webp"
            output_path = OUTPUT_DIR / output_name
            save_webp(resized, output_path, TARGET_BYTES[target_width])
            record[str(target_width)] = {
                "src": f"/images/yhzd/{output_name}",
                "width": resized.width,
                "height": resized.height,
            }

        manifest["images"].append(record)

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Built {len(manifest['images'])} photos -> {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
