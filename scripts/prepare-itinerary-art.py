"""Encode verified source illustrations without modifying their content/originals."""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
archive = root / 'artifacts/design/itinerary-art-world-20261012'
source_dir = archive / 'assets-original'
target_dir = root / 'src/assets/itinerary-art/v1'
parser = argparse.ArgumentParser()
parser.add_argument('--partial', action='store_true')
args = parser.parse_args()
reused = {
    'beach': 'trip-scenes/themes/v2/coast.webp', 'island': 'trip-scenes/themes/v2/island.webp',
    'mountain': 'trip-scenes/themes/v2/mountain.webp', 'forest': 'trip-scenes/themes/v2/forest.webp',
    'lake': 'trip-scenes/themes/v2/lake.webp', 'wetland': 'trip-scenes/themes/v2/wetland.webp',
    'desert': 'trip-scenes/themes/v2/desert.webp', 'urban': 'trip-scenes/themes/v2/urban.webp',
    'oldtown': 'trip-scenes/themes/v2/traditional.webp', 'garden': 'export-art/sightseeing.webp',
    'hotel': 'export-art/lodging.webp', 'cafe': 'export-art/food.webp',
}
generated = 'travel sightseeing waterfall cave snow museum gallery castle temple shrine church mosque tower monument theme-park aquarium zoo stadium theater wellness hiking restaurant bakery bar resort camping hostel shopping market mall transport airport train bus ferry car bicycle walk'.split()
expected = set(reused) | set(generated)
target_dir.mkdir(parents=True, exist_ok=True)
manifest = []
missing = []
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
for name in sorted(expected):
    is_new = name in generated
    source = (source_dir / f'{name}.png' if is_new else
              archive / 'assets-reused' / Path(reused[name]).name if reused[name].startswith('export-art/') else
              root / 'src/assets' / reused[name])
    prompt_file = source_dir / f'{name}.prompt.json'
    if not source.exists() or (is_new and not prompt_file.exists()):
        missing.append(name)
        continue
    digest = sha(source)
    if is_new:
        record = json.loads(prompt_file.read_text(encoding='utf-8-sig'))
        original = Path(record['original_path'])
        assert sha(original) == digest, f'ImageGen original mismatch: {name}'
    target = target_dir / f'{name}.webp'
    with Image.open(source) as opened:
        image = opened.convert('RGBA')
        image.thumbnail((360, 240), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=90, method=6)
        dimensions = list(image.size)
    manifest.append({'id': name, 'src': target.relative_to(root).as_posix(),
                     'source': source.relative_to(root).as_posix(), 'sourceSha256': digest,
                     'sha256': sha(target), 'bytes': target.stat().st_size, 'dimensions': dimensions,
                     'origin': 'ImageGen T2I' if is_new else 'Existing approved TripLOG asset',
                     'processing': 'Proportional resize and WebP encoding only; alpha preserved'})
if missing and not args.partial:
    raise RuntimeError(f'Missing artwork: {missing}')
(archive / 'asset-manifest.json').write_text(json.dumps({'expectedTypes': len(expected), 'missing': missing, 'assets': manifest}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'ready': len(manifest), 'missing': missing, 'runtimeBytes': sum(x['bytes'] for x in manifest)}, ensure_ascii=False))
