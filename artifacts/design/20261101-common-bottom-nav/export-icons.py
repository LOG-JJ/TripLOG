from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
import json,hashlib
root=Path.cwd();source=root/'vendor/phosphor-2.1.1/Phosphor.woff2';font=TTFont(source);glyphs=font.getGlyphSet();cmap=font.getBestCmap()
out=root/'src/assets/navigation';out.mkdir(parents=True,exist_ok=True)
records=[]
for name,code in [('house',0xe2c2),('calendar-blank',0xe10a),('suitcase-rolling',0xe9b0),('wallet',0xe68a),('chart-bar',0xe150)]:
    glyph=glyphs[cmap[code]];bounds=BoundsPen(glyphs);glyph.draw(bounds);x0,y0,x1,y1=bounds.bounds
    pen=SVGPathPen(glyphs);glyph.draw(pen)
    def n(v):return format(v,'.8g')
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n(x1-x0)} {n(y1-y0)}"><!-- Phosphor Icons 2.1.1, MIT. Original glyph from vendor/phosphor-2.1.1/Phosphor.woff2; license: vendor/phosphor-2.1.1/LICENSE. --><g transform="translate({n(-x0)} {n(y1)}) scale(1 -1)" fill="currentColor"><path d="{pen.getCommands()}"/></g></svg>\n'
    file=out/f'{name}.svg';file.write_text(svg,encoding='utf-8');records.append({'name':name,'codepoint':hex(code),'sourceGlyph':cmap[code],'originalBounds':[x0,y0,x1,y1],'saved':str(file.relative_to(root)),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
manifest={'source':str(source.relative_to(root)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'method':'Identical export for all glyphs: exact original paths, tight viewBox, no item-specific scale/offset','icons':records}
(Path(__file__).parent/'icon-provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(manifest))
