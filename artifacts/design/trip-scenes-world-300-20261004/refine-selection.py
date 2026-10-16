"""Apply the documented editorial refinement only before affected generation."""
import json
from pathlib import Path
DOCS = Path(__file__).resolve().parent
ROOT = DOCS.parent.parent.parent
refinement = json.loads((DOCS / "selection-refinement.json").read_text(encoding="utf-8"))
selection = json.loads((DOCS / "selection.json").read_text(encoding="utf-8"))
details = json.loads((DOCS / "details-europe.json").read_text(encoding="utf-8"))
batch = json.loads((DOCS / "batch.json").read_text(encoding="utf-8"))
source_path = ROOT / "src/app/data/destination-scenes.js"
source = source_path.read_text(encoding="utf-8")
for change in refinement["replacement"]:
    old_id, entry = change["oldId"], change["entry"]
    for variant in ["landscape", "mobile"]:
        for suffix in [".png", ".json", ".prompt.txt"]:
            assert not (DOCS / "assets-original" / (old_id + "-" + variant + suffix)).exists()
        job_path = (DOCS / "jobs" / (old_id + "-" + variant + ".json")).resolve()
        assert job_path.is_relative_to(DOCS / "jobs")
        if job_path.exists():
            job_path.unlink()
    old_names = selection["additions"]["europe"][change["oldCountry"]]
    if change["oldEnglish"] in old_names:
        old_names.remove(change["oldEnglish"])
    new_names = selection["additions"]["europe"].setdefault("RU", [])
    if entry["englishName"] not in new_names:
        new_names.append(entry["englishName"])
    details = [entry if city["id"] == old_id else city for city in details]
    new_tail = ", ".join("'" + value.replace("'", "\\'") + "'" for value in [entry["name"], "RU", entry["kind"], entry["theme"], entry["aliases"]])
    source = source.replace("'" + old_id + "'", "'" + entry["id"] + "'").replace(change["oldTail"], new_tail)
for filename, value in [("selection.json", selection), ("details-europe.json", details)]:
    (DOCS / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
source_path.write_text(source, encoding="utf-8")
for title, url in [("UNESCO: Kremlin and Red Square, Moscow", "https://whc.unesco.org/en/list/545/"), ("UNESCO: Historic Centre of Saint Petersburg", "https://whc.unesco.org/en/list/540/")]:
    if not any(item["url"] == url for item in batch["sources"]):
        batch["sources"].append({"title": title, "url": url})
(DOCS / "batch.json").write_text(json.dumps(batch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Refined two unstarted destinations; no generated originals were changed")
