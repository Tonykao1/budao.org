import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from PIL import Image

spec = importlib.util.spec_from_file_location("ingest", Path(__file__).resolve().parents[1] / "scripts/campfire-bundle-ingest.py")
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)

class BundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.bundle = Path(self.temp.name) / "album.zip"
        image = io.BytesIO()
        Image.new("RGB", (160, 90), "green").save(image, "WEBP")
        self.raw = image.getvalue()
        self.src = "/campfire-photos/260421/260421-01.webp"
        self.album = {"id":"260421","date":"2026-04-21","title":"测试","location":"测试","description":"测试","editorialNote":"测试","published":True,"publishedOn":"2026-11-28","photos":[{"src":self.src,"alt":"测试","caption":"测试","approved":True,"frameMode":"uncropped","frameRatio":"16/9"}]}
        self.manifest = [{"src":self.src,"sha256":hashlib.sha256(self.raw).hexdigest(),"bytes":len(self.raw),"width":160,"height":90}]

    def write(self, raw=None):
        with zipfile.ZipFile(self.bundle, "w") as z:
            z.writestr("album.json", json.dumps(self.album))
            z.writestr("manifest.json", json.dumps(self.manifest))
            z.writestr(self.src[1:], self.raw if raw is None else raw)

    def test_accepts_valid_bundle(self):
        self.write()
        album, files = ingest.validate_bundle(self.bundle)
        self.assertEqual(album["id"], "260421")
        self.assertEqual(files[self.src[1:]], self.raw)

    def test_checksum_mismatch(self):
        self.write(b"wrong")
        with self.assertRaisesRegex(ValueError, "checksum_mismatch"):
            ingest.validate_bundle(self.bundle)

    def test_missing_photo_manifest(self):
        self.manifest.clear()
        self.write()
        with self.assertRaisesRegex(ValueError, "photo_count_mismatch"):
            ingest.validate_bundle(self.bundle)

    def test_unapproved_photo(self):
        self.album["photos"][0]["approved"] = False
        self.write()
        with self.assertRaisesRegex(ValueError, "invalid_photo_approval_or_frame"):
            ingest.validate_bundle(self.bundle)

    def test_path_traversal(self):
        self.album["photos"][0]["src"] = "/campfire-photos/../bad.webp"
        self.manifest[0]["src"] = self.album["photos"][0]["src"]
        self.write()
        with self.assertRaisesRegex(ValueError, "invalid_photo_path_or_order"):
            ingest.validate_bundle(self.bundle)

    def test_wrong_date(self):
        self.album["date"] = "2026-04-22"
        self.write()
        with self.assertRaisesRegex(ValueError, "date_id_mismatch"):
            ingest.validate_bundle(self.bundle)

    def test_wrong_ratio(self):
        self.album["photos"][0]["frameRatio"] = "9/16"
        self.write()
        with self.assertRaisesRegex(ValueError, "frame_ratio_mismatch"):
            ingest.validate_bundle(self.bundle)

if __name__ == "__main__":
    unittest.main()
