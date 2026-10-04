"""Claim exactly one job for the parent to dispatch with collaboration tools."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

DOCS = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("agent", choices=["mobile_header_art", "trip_scene_b", "trip_scene_c", "root"])
parser.add_argument("--complete")
args = parser.parse_args()
state_path = DOCS / "dispatch-state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
batch = json.loads((DOCS / "batch.json").read_text(encoding="utf-8"))
jobs = {file.stem: json.loads(file.read_text(encoding="utf-8")) for file in (DOCS / "jobs").glob("*.json")}
def saved(identifier):
    job = jobs[identifier]
    return Path(job["original"]).is_file() and Path(job["metadata"]).is_file()
if args.complete:
    assert state["active"].get(args.agent) == args.complete, "Completion does not match this agent's assigned job"
    job = jobs[args.complete]
    record = json.loads(Path(job["metadata"]).read_text(encoding="utf-8-sig"))
    digest = hashlib.sha256(Path(job["original"]).read_bytes()).hexdigest()
    assert record["jobId"] == args.complete and record["sourceSha256"] == digest and record["savedSha256"] == digest
    assert hashlib.sha256(Path(record["sourcePath"]).read_bytes()).hexdigest() == digest
    assert record["prompt"] == job["prompt"] and record["imageInputs"] == [job["reference"]]
    state["history"].append({"agent": args.agent, "completed": args.complete, "at": datetime.now(timezone.utc).isoformat()})
    del state["active"][args.agent]
if args.agent not in state["active"]:
    order = [city["id"] + "-" + variant for city in batch["cities"] for variant in ["landscape", "mobile"]]
    if args.complete and args.complete.endswith("-landscape"):
        counterpart = jobs[args.complete]["cityId"] + "-mobile"
        order = [counterpart] + [identifier for identifier in order if identifier != counterpart]
    occupied = set(state["active"].values())
    next_id = next((identifier for identifier in order if identifier not in occupied and not saved(identifier)), None)
    if next_id:
        state["active"][args.agent] = next_id
state["updatedAt"] = datetime.now(timezone.utc).isoformat()
state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
completed = [identifier for identifier in jobs if saved(identifier)]
identifier = state["active"].get(args.agent)
print(json.dumps({"agent": args.agent, "next": identifier,
                  "job": "docs/trip-scenes-world-300-20261004/jobs/" + identifier + ".json" if identifier else None,
                  "saved": len(completed), "expected": batch["expected"], "active": state["active"]}, ensure_ascii=False))
