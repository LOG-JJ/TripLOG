"""Assemble actual header screenshots for same-size visual QA; never edit artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
PREVIOUS = HERE.parent / 'trip-scenes-expansion-20261004' / 'browser-cities'
CURRENT = HERE.parent.parent / 'tmp' / '20261004-world-300-captures' / 'browser-cities'
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 17)

def board(name, entries, columns=2):
    images = [(label, Image.open(path).convert('RGB')) for label, path in entries]
    width = max(im.width for _, im in images)
    height = max(im.height for _, im in images)
    cw, ch = width + 24, height + 48
    canvas = Image.new('RGB', (columns*cw, ((len(images)+columns-1)//columns)*ch), '#f5f6f8')
    draw = ImageDraw.Draw(canvas)
    for i, (label, im) in enumerate(images):
        x, y = (i % columns)*cw+12, (i//columns)*ch
        draw.text((x, y+9), label, fill='#101828', font=font)
        canvas.paste(im, (x, y+36))
    canvas.save(HERE / name)

for width in [390, 1440]:
    board(f'comparison-canonical-{width}.png', [
        ('이전 승인 헤더 · 순천', PREVIOUS / f'kr-suncheon-{width}.png'),
        ('현재 헤더 · 순천', CURRENT / f'kr-suncheon-{width}.png'),
    ], columns=1 if width == 1440 else 2)

highlights = [('jp-nara','나라'),('lv-riga','리가'),('ca-quebec-city','퀘벡시티'),
              ('br-rio-de-janeiro','리우데자네이루'),('za-cape-town','케이프타운'),
              ('nz-queenstown','퀸스타운'),('pf-bora-bora','보라보라'),('om-salalah','살랄라')]
for width in [320,390,599,1440]:
    board(f'rendered-highlights-{width}.png', [(name, CURRENT / f'{key}-{width}.png') for key,name in highlights], columns=2)
print('Saved 2 canonical comparisons and 4 regional header boards at native screenshot scale.')
