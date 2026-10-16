"""Save the exact image file returned by one built-in generation call."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image

DOCS = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("job")
parser.add_argument("source")
parser.add_argument("started_at")
args = parser.parse_args()
job = json.loads((DOCS / "jobs" / (args.job + ".json")).read_text(encoding="utf-8"))
assert args.job == job["id"]
source = Path(args.source).resolve()
destination = Path(job["original"]).resolve()
assert source.is_file() and "generated_images" in source.parts
assert destination.is_relative_to(DOCS / "assets-original")
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
helper_path = Path("C:/Users/tbdk5/.codex/skills/image-creator/scripts/save_generated_image.py")
spec = importlib.util.spec_from_file_location("image_save_helper", helper_path)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
if destination.exists():
    assert hashlib.sha256(destination.read_bytes()).hexdigest() == source_hash, "Refusing to replace an existing original"
else:
    assert helper.copy_image(source, destination, overwrite=False) == destination
saved_hash = hashlib.sha256(destination.read_bytes()).hexdigest()
assert source_hash == saved_hash
with Image.open(destination) as image:
    dimensions = list(image.size)
prompt_path = Path(job["promptFile"])
prompt_text = job["prompt"] + "\n"
if prompt_path.exists():
    assert prompt_path.read_text(encoding="utf-8-sig") == prompt_text
else:
    prompt_path.write_text(prompt_text, encoding="utf-8")
record = {
    "jobId": job["id"], "sourcePath": source.as_posix(), "savedPath": destination.as_posix(),
    "actualDimensions": dimensions, "generationMode": "built-in image_gen, image-to-image",
    "prompt": job["prompt"], "imageInputs": [job["reference"]],
    "sourceSha256": source_hash, "savedSha256": saved_hash, "equality": True,
    "transparentBackground": True, "overwritten": False,
    "generationStartedAt": args.started_at, "savedAt": datetime.now(timezone.utc).isoformat(),
}
metadata = Path(job["metadata"])
if metadata.exists():
    previous = json.loads(metadata.read_text(encoding="utf-8-sig"))
    assert previous["sourceSha256"] == source_hash and previous["jobId"] == job["id"]
else:
    metadata.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"saved": job["id"], "source": source.as_posix(), "sha256": saved_hash, "dimensions": dimensions}, ensure_ascii=False))
