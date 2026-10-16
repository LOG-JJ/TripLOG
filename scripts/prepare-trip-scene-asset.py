"""Save a known Image Gen original and optimize a TripLOG scene without overwriting.

The source must be the exact path returned by the corresponding generation call.
This performs lossless source preservation plus ordinary image sizing/encoding.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil

from PIL import Image, ImageOps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--kind", choices=("city", "theme"), required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument("--prompt-file", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z][a-z0-9-]*", args.id):
        raise ValueError("Use a lowercase scene identifier")
    root = Path(__file__).resolve().parent.parent
    source = Path(args.source).resolve(strict=True)
    prompt = Path(args.prompt_file).resolve(strict=True).read_text(encoding="utf-8-sig")
    original_dir = root / "artifacts/design/trip-header-20261004/assets-original"
    output_dir = root / "src/assets/trip-scenes" / ("cities" if args.kind == "city" else "themes") / "v1"
    stem = f"{args.kind}-{args.id}"
    original = original_dir / f"{stem}.png"
    record = original_dir / f"{stem}.json"
    destination = output_dir / f"{args.id}.webp"
    if any(path.exists() for path in (original, record, destination)):
        raise FileExistsError("The scene already exists; do not overwrite a generation")
    original_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    shutil.copy2(source, original)
    assert hashlib.sha256(original.read_bytes()).hexdigest() == source_hash
    with Image.open(source) as image:
        source_size = image.size
        rgba = image.convert("RGBA")
        bounds = rgba.getchannel("A").getbbox()
        if bounds:
            rgba = rgba.crop(bounds)
        sized = ImageOps.contain(rgba, (784, 464), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (800, 480), (255, 255, 255, 0))
        canvas.alpha_composite(sized, ((800 - sized.width) // 2, 480 - sized.height))
        canvas.save(destination, "WEBP", quality=85, method=6)
    metadata = {
        "id": args.id, "kind": args.kind, "mode": "built-in image_gen, text-to-image",
        "imageInputsSent": [], "prompt": prompt,
        "source": str(source), "sourceSize": source_size, "original": str(original.relative_to(root)),
        "sourceSha256": source_hash, "originalMatchesSource": True,
        "asset": str(destination.relative_to(root)).replace("\\", "/"),
        "assetSize": [800, 480], "bytes": destination.stat().st_size,
        "assetSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "overwritten": False,
    }
    record.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=True))


if __name__ == "__main__":
    main()
