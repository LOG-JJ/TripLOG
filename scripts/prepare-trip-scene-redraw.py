"""Prepare immutable, versioned illustrations from exact generated originals.

Raw generation PNGs and their provenance stay untouched. This performs only
transparent-edge trimming, aspect-preserving web sizing/encoding and QA sheets.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs/trip-scenes-redraw-20261004"
MANIFEST = DOCS / "prepared.json"

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def prepare():
    batch_file = DOCS / "batch.json"
    batch = json.loads(batch_file.read_text(encoding="utf-8")) if batch_file.exists() else {}
    previous = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"assets": []}
    known = {entry["id"]: entry for entry in previous["assets"]}
    entries, pending = [], []
    job_files = sorted((DOCS / "jobs").glob("*.json"))
    if batch.get("planningComplete"):
        assert len(job_files) == batch["expected"], "The complete plan must contain every expected image job"
    for file in job_files:
        job = json.loads(file.read_text(encoding="utf-8"))
        original, provenance = Path(job["original"]), Path(job["metadata"])
        if not original.exists() or not provenance.exists():
            pending.append(job["id"])
            continue
        try:
            record = json.loads(provenance.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError:
            pending.append(job["id"])
            continue
        original_hash = sha(original)
        assert record["jobId"] == job["id"], job["id"]
        assert record["sourceSha256"] == original_hash, job["id"] + ": wrong original"
        assert record["savedSha256"] == original_hash, job["id"] + ": save hash mismatch"
        assert record["prompt"] == job["prompt"], job["id"] + ": prompt mismatch"
        assert Path(job["promptFile"]).read_text(encoding="utf-8-sig").rstrip("\r\n") == job["prompt"], job["id"] + ": saved prompt text mismatch"
        assert record["imageInputs"] == [job["reference"]], job["id"] + ": unexpected reference"
        assert sha(Path(record["sourcePath"])) == original_hash, job["id"] + ": source mismatch"
        destination = (ROOT / job["asset"]).resolve()
        assert destination.is_relative_to(ROOT / "src/assets/trip-scenes")
        assert re.search(r"/v\d+/", job["asset"]), job["id"] + ": assets must be versioned"
        prior = known.get(job["id"])
        if prior and prior["originalSha256"] == original_hash and destination.exists() and sha(destination) == prior["assetSha256"]:
            entries.append(prior)
            continue
        with Image.open(original) as image:
            source_size = list(image.size)
            rgba = image.convert("RGBA")
            assert rgba.getchannel("A").getextrema()[0] == 0, job["id"] + ": no transparency"
            bounds = rgba.getchannel("A").getbbox()
            assert bounds, job["id"] + ": blank image"
            # Retain the planned left/top exterior; remove only wholly empty
            # right/bottom padding that would break contact with the card edge.
            trimmed = [rgba.width - bounds[2], rgba.height - bounds[3]]
            rgba = rgba.crop((0, 0, bounds[2], bounds[3]))
            fitted = ImageOps.fit(rgba, tuple(job["assetSize"]), Image.Resampling.LANCZOS, centering=(1, 1))
            encoded = io.BytesIO()
            fitted.save(encoded, "WEBP", quality=90, method=6)
        payload = encoded.getvalue()
        if destination.exists():
            assert destination.read_bytes() == payload, job["id"] + ": refusing an overwrite"
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(payload)
        entries.append({
            "id": job["id"], "cityId": job["cityId"], "name": job["cityName"],
            "kind": job.get("kind", "city"), "variant": job["variant"],
            "group": job.get("group", "korea" if job["cityId"].startswith("kr-") else "world"),
            "original": original.relative_to(ROOT).as_posix(),
            "provenance": provenance.relative_to(ROOT).as_posix(),
            "originalSha256": original_hash, "sourceSize": source_size,
            "trimmedEmptyRightBottom": trimmed, "asset": job["asset"],
            "assetSize": job["assetSize"], "bytes": len(payload),
            "assetSha256": hashlib.sha256(payload).hexdigest(),
        })
    assert len({entry["originalSha256"] for entry in entries}) == len(entries), "A generated original was assigned to more than one job"
    result = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "scope": batch.get("scope", "29 dedicated destinations and 10 common themes; landscape and mobile; approved Suncheon remains unchanged"),
        "expected": batch.get("expected", 78), "prepared": len(entries), "bytes": sum(e["bytes"] for e in entries),
        "assets": entries, "pending": pending,
    }
    MANIFEST.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DOCS / "progress.json").write_text(json.dumps({
        "updatedAt": result["updatedAt"], "scope": result["scope"],
        "expected": result["expected"], "prepared": result["prepared"],
        "completed": [entry["id"] for entry in entries], "pending": pending,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result

def contacts(result):
    # Fixed canonical Suncheon assets anchor the comparison, without copying
    # them into the generated batch or reporting them as newly generated.
    entries = list(result["assets"])
    batch_file = DOCS / "batch.json"
    batch = json.loads(batch_file.read_text(encoding="utf-8")) if batch_file.exists() else {}
    if batch.get("contactGroups"):
        entries.extend(batch.get("existingArtwork", []))
    else:
        for variant, suffix in [("landscape", ""), ("mobile", "-mobile")]:
            entries.append({"id": "kr-suncheon-" + variant, "cityId": "kr-suncheon", "name": "순천 · 기준",
                            "kind": "city", "variant": variant, "asset": "src/assets/trip-scenes/cities/v2/kr-suncheon" + suffix + ".webp"})
    font_path = Path("C:/Windows/Fonts/malgun.ttf")
    font = ImageFont.truetype(str(font_path), 16) if font_path.exists() else ImageFont.load_default()
    for group in batch.get("contactGroups", ["korea", "world", "themes"]):
        for variant in ["landscape", "mobile"]:
            selected = [e for e in entries if e["variant"] == variant and
                        ((bool(batch.get("contactGroups")) and e.get("group") == group) or
                         (group == "themes" and e["kind"] == "theme") or
                         (group == "korea" and e["kind"] == "city" and e["cityId"].startswith("kr-")) or
                         (group == "world" and e["kind"] == "city" and not e["cityId"].startswith("kr-")))]
            selected.sort(key=lambda e: e["cityId"])
            if not selected:
                continue
            cell_w, cell_h = (240, 172) if variant == "landscape" else (192, 266)
            columns = 5
            canvas = Image.new("RGB", (columns * cell_w, ((len(selected) + columns - 1) // columns) * cell_h), "white")
            draw = ImageDraw.Draw(canvas)
            for i, entry in enumerate(selected):
                image = Image.open(ROOT / entry["asset"]).convert("RGBA")
                image.thumbnail((cell_w - 12, cell_h - 32), Image.Resampling.LANCZOS)
                x, y = (i % columns) * cell_w, (i // columns) * cell_h
                canvas.paste(image, (x + cell_w - image.width - 6, y + cell_h - image.height - 28), image)
                draw.text((x + 8, y + cell_h - 24), entry["name"], font=font, fill="#0b1020")
            canvas.save(DOCS / ("contact-" + group + "-" + variant + ".png"))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--contacts", action="store_true")
    parser.add_argument("--batch", help="Project-relative docs directory containing this batch's jobs and originals")
    args = parser.parse_args()
    if args.batch:
        DOCS = (ROOT / args.batch).resolve()
        if not DOCS.is_relative_to(ROOT / "docs") or not (DOCS / "jobs").is_dir():
            raise ValueError("The batch must be an existing job directory under project docs")
        MANIFEST = DOCS / "prepared.json"
    result = prepare()
    if args.contacts:
        contacts(result)
    print(json.dumps({"prepared": result["prepared"], "expected": result["expected"],
                      "bytes": result["bytes"], "pending": len(result["pending"])}, ensure_ascii=False))
