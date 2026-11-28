#!/usr/bin/env python3
"""Validated Campfire release-bundle ingestion. No network, commits or pushes."""
import argparse
import datetime as dt
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

from PIL import Image

MAX_FILE = 8 * 1024 * 1024
MAX_TOTAL = 100 * 1024 * 1024
MAX_PHOTOS = 50
ID = re.compile(r"[0-9]{6}(?:-[a-z0-9-]{1,48})?")
HEX = re.compile(r"[0-9a-f]{64}")
RATIOS = {"9/16": 9/16, "16/9": 16/9, "4/3": 4/3, "3/4": 3/4, "1/1": 1}
Image.MAX_IMAGE_PIXELS = 30_000_000

def require(condition, code):
    if not condition:
        raise ValueError(code)

def validate_bundle(bundle):
    with zipfile.ZipFile(bundle) as z:
        entries = [i for i in z.infolist() if not i.is_dir()]
        names = [i.filename for i in entries]
        require(len(names) == len(set(names)), "duplicate_zip_path")
        require(len(entries) <= MAX_PHOTOS + 12 and sum(i.file_size for i in entries) <= MAX_TOTAL, "bundle_too_large")
        require(all(i.file_size <= MAX_FILE and not i.flag_bits & 1 for i in entries), "entry_too_large_or_encrypted")
        manifests = [n for n in names if n == "manifest.json" or n.endswith("/manifest.json")]
        require(len(manifests) == 1, "manifest_missing_or_ambiguous")
        prefix = manifests[0][:-len("manifest.json")]
        album = json.loads(z.read(prefix + "album.json"))
        manifest = json.loads(z.read(manifests[0]))
        aid = album.get("id", "")
        require(isinstance(aid, str) and ID.fullmatch(aid), "invalid_album_id")
        date = dt.date.fromisoformat(album["date"])
        require(date.strftime("%y%m%d") == aid[:6], "date_id_mismatch")
        require(album.get("published") is True, "explicit_approval_required")
        for key in ("title", "location", "description", "editorialNote"):
            require(isinstance(album.get(key), str) and 0 < len(album[key]) <= 2000, "invalid_album_text")
        dt.date.fromisoformat(album["publishedOn"])
        photos = album.get("photos", [])
        require(isinstance(manifest, list) and isinstance(photos, list) and 1 <= len(photos) == len(manifest) <= MAX_PHOTOS, "photo_count_mismatch")
        files = {}
        hashes = set()
        for index, (photo, entry) in enumerate(zip(photos, manifest), 1):
            src = f"/campfire-photos/{aid}/{aid}-{index:02d}.webp"
            require(photo.get("src") == entry.get("src") == src, "invalid_photo_path_or_order")
            require(photo.get("approved") is True and photo.get("frameMode") == "uncropped", "invalid_photo_approval_or_frame")
            for key in ("alt", "caption"):
                require(isinstance(photo.get(key), str) and 0 < len(photo[key]) <= 500, "invalid_photo_text")
            raw = z.read(prefix + src[1:])
            digest = hashlib.sha256(raw).hexdigest()
            require(isinstance(entry.get("sha256"), str) and HEX.fullmatch(entry["sha256"]) and digest == entry["sha256"] and len(raw) == entry.get("bytes"), "checksum_mismatch")
            require(digest not in hashes, "duplicate_photo")
            hashes.add(digest)
            with Image.open(io.BytesIO(raw)) as im:
                require(im.format == "WEBP" and not getattr(im, "is_animated", False), "invalid_image_format")
                require(max(im.size) <= 2400 and min(im.size) >= 64, "invalid_image_dimensions")
                im.load()
                require(im.size == (entry.get("width"), entry.get("height")), "dimension_mismatch")
                require(not im.getexif() and not im.info.get("xmp"), "private_metadata_present")
                ratio = RATIOS.get(photo.get("frameRatio"))
                require(ratio is not None and abs(im.width/im.height-ratio) < 0.04, "frame_ratio_mismatch")
            files[src[1:]] = raw
        return album, files

def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()

def apply_bundle(root, album, files):
    require(git(root, "rev-parse", "--show-toplevel") == str(root), "not_repo_root")
    require(git(root, "branch", "--show-current").startswith("feat/asset-pipeline"), "release_branch_required")
    require(not git(root, "status", "--porcelain"), "dirty_checkout")
    archive_path = root / "data/campfire-archive.json"
    quality_path = root / "data/campfire-hero-quality.json"
    archive = json.loads(archive_path.read_text())
    quality = json.loads(quality_path.read_text())
    require(archive.get("version") == 2 and quality.get("version") == 1, "unsupported_archive_version")
    require(not any(a["id"] == album["id"] for a in archive["albums"]), "album_exists_no_overwrite")
    require(not any((root / p).exists() or (root / p.replace("campfire-photos/", "campfire-watermarked/", 1)).exists() for p in files), "asset_exists_no_overwrite")
    spec = importlib.util.spec_from_file_location("campfire_watermark", root / "scripts/campfire-watermark.py")
    watermark = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(watermark)
    svg = (root / "assets/budao-footprint-watermark.svg").read_bytes()
    # Generate all outputs before touching the checkout. Never execute files from the bundle.
    outputs = dict(files)
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        for path, raw in files.items():
            src = temp / path
            src.parent.mkdir(parents=True, exist_ok=True)
            src.write_bytes(raw)
            dest = temp / path.replace("campfire-photos/", "campfire-watermarked/", 1)
            watermark.make_copy(src, dest, svg)
            outputs[str(dest.relative_to(temp))] = dest.read_bytes()
            quality["scores"]["/" + path] = watermark.hero_quality_score(src)
    pos = next((i for i, a in enumerate(archive["albums"]) if a["date"] < album["date"]), len(archive["albums"]))
    archive["albums"].insert(pos, album)
    quality["scores"] = dict(sorted(quality["scores"].items()))
    for path, obj in (("data/campfire-archive.json", archive), ("data/campfire-hero-quality.json", quality)):
        outputs[path] = (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode()
    for path, raw in outputs.items():
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    subprocess.run(["node", "--test", "test/campfire-page.test.js"], cwd=root, check=True)
    return list(outputs)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--apply", action="store_true", help="apply only to clean feature branch; never push")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    album, files = validate_bundle(args.bundle)
    print(json.dumps({"album": album["id"], "count": len(files), "status": "bundle_validated"}, ensure_ascii=False))
    if args.apply:
        paths = apply_bundle(args.root.resolve(), album, files)
        print(json.dumps({"status": "local_tests_passed", "paths": paths}, ensure_ascii=False))

if __name__ == "__main__":
    main()
