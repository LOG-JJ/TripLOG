"""Materialize the approved 300-overseas-destination illustration plan.

This records jobs only; generation is one built-in call per requested asset.
Existing job definitions and saved originals are never changed by this script.
"""
from collections import Counter
import json
from pathlib import Path

DOCS = Path(__file__).resolve().parent
ROOT = DOCS.parent.parent.parent
batch_path = DOCS / "batch.json"
batch = json.loads(batch_path.read_text(encoding="utf-8"))
selection = json.loads((DOCS / "selection.json").read_text(encoding="utf-8"))
details = []
for name in ["details-east-asia.json", "details-asia-south.json", "details-europe.json", "details-americas-africa-oceania-middle-east.json"]:
    details.extend(json.loads((DOCS / name).read_text(encoding="utf-8")))
expected = {(country, name) for countries in selection["additions"].values() for country, names in countries.items() for name in names}
actual = {(entry["countryCode"], entry["englishName"]) for entry in details}
assert len(details) == len(actual) == len(expected) == 217
assert actual == expected, {"missing": sorted(expected - actual), "unexpected": sorted(actual - expected)}
legacy = [entry for entry in batch["cities"] if not entry["isNew"]]
assert len(legacy) == 25
for entry in details:
    entry.setdefault("countryCodes", [entry["countryCode"]])
cities = legacy + details
assert len(cities) == len({entry["id"] for entry in cities}) == 242
templates = {variant: json.loads((DOCS / "jobs" / ("jp-nagoya-" + variant + ".json")).read_text(encoding="utf-8")) for variant in ["landscape", "mobile"]}
old_scene = next(entry["scene"] for entry in legacy if entry["id"] == "jp-nagoya")
created = 0
for city in cities:
    for variant, suffix in [("landscape", ""), ("mobile", "-mobile")]:
        template = templates[variant]
        identifier = city["id"] + "-" + variant
        job = dict(template)
        job.update({"id": identifier, "cityId": city["id"], "cityName": city["name"],
                    "kind": "city", "group": city["group"],
                    "prompt": template["prompt"].replace(old_scene, city["scene"], 1),
                    "original": (DOCS / "assets-original" / (identifier + ".png")).as_posix(),
                    "metadata": (DOCS / "assets-original" / (identifier + ".json")).as_posix(),
                    "promptFile": (DOCS / "assets-original" / (identifier + ".prompt.txt")).as_posix(),
                    "asset": "src/assets/trip-scenes/cities/v4/" + city["id"] + suffix + ".webp"})
        file = DOCS / "jobs" / (identifier + ".json")
        if file.exists():
            assert json.loads(file.read_text(encoding="utf-8")) == job, identifier + ": existing job differs"
        else:
            file.write_text(json.dumps(job, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            created += 1
assert len(list((DOCS / "jobs").glob("*.json"))) == 484
batch.update({"planningComplete": True, "cities": cities, "expected": 484,
              "generationMode": "I2I continuation of the user's explicitly approved current Suncheon style; independent fixed canonical reference per asset, never a chain",
              "composition": "Travel information left; destination art right; desktop 800x480 and mobile 480x600; existing small title sizes retained",
              "selectionNote": selection["selection"],
              "contactGroups": ["east-asia", "southeast-asia", "south-asia", "europe", "caucasus-central-asia", "north-america", "latin-america", "middle-east", "africa", "oceania"]})
extra_sources = [
    ("Incredible India: Agra", "https://www.incredibleindia.gov.in/en/uttar-pradesh/agra"),
    ("UNESCO: Samarkand", "https://whc.unesco.org/en/list/603"),
    ("Tourism New Zealand", "https://www.newzealand.com/au/"),
    ("Visit Brasil experiences", "https://www.visitbrasil.com/en/experiences/"),
    ("South African Tourism cities", "https://www.southafrica.net/gl/en/travel/category/south-africas-cities"),
    ("Moroccan National Tourism Office", "https://www.visitmorocco.com/en/travel"),
    ("UNESCO: Tallinn", "https://whc.unesco.org/en/list/822"),
    ("UNESCO: Kotor", "https://whc.unesco.org/en/list/125"),
    ("UNESCO: Vilnius", "https://whc.unesco.org/en/list/541"),
    ("UNESCO: Cesky Krumlov", "https://whc.unesco.org/en/list/617/"),
    ("UNESCO: Riga", "https://whc.unesco.org/en/list/852"),
    ("UNESCO: Valletta", "https://whc.unesco.org/en/list/131/"),
    ("Visit Finland: Rovaniemi", "https://www.visitfinland.com/en/places-to-go/lapland/rovaniemi/"),
    ("Visit Finland: Helsinki", "https://www.visitfinland.com/en/places-to-go/helsinki-region/helsinki-city/"),
    ("UNESCO: Old City of Jerusalem and its Walls", "https://whc.unesco.org/en/list/148"),
    ("Tourism Fiji: Nadi", "https://www.fiji.travel/places-to-go/nadi/locations/top-things-to-do-in-nadi"),
    ("Visit Costa Rica: National Theatre", "https://www.visitcostarica.com/planning-your-trip/other-activities/teatro-nacional"),
]
known_urls = {source["url"] for source in batch["sources"]}
batch["sources"].extend({"title": title, "url": url} for title, url in extra_sources if url not in known_urls)
batch_path.write_text(json.dumps(batch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"newDestinations": len(details), "newDedicated": len(cities), "imageJobs": 484, "jobsCreated": created, "newByGroup": dict(Counter(entry["group"] for entry in details))}, ensure_ascii=False))
