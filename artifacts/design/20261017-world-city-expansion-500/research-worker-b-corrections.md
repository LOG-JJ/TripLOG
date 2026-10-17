# Worker B landmark correction evidence

Generated illustrations are independent text-to-image calls with no image inputs. The links below support the factual text added to city-specific prompts after the requested visual QA found generic cathedral forms.

## Belize City — Saint John's Cathedral

The initial pair used unrelated ornate Gothic or twin-domed forms. The correction specifies the modest red-brown brick nave, stepped gables, white louvered arched windows and one square crenellated entrance tower.

- Landmark identity and brick material: [Belize Tourism Board](https://www.travelbelize.org/attraction/st-johns-cathedral/).
- Visible exterior corroboration: [Kaohsiung City Government sister-city page](https://sistercity.kcg.gov.tw/News_Siscity_Content.aspx?n=34DAD24511BAE1A6&s=A9401E26F95C6604&sms=EE2473A244D58774), [photograph on Wikimedia Commons](https://commons.wikimedia.org/wiki/File:ST._JOHN%27S_ANGLICAN_CATHEDRAL_IN_BELIZE.jpg).

## Santo Domingo — Catedral Primada de America

The initial pair added a tall completed bell tower and dome. The correction emphasizes the low broad west facade, triangular pediment, ornamented portal and paired arched wooden doors.

- [Dominican Republic official tourism — cathedral](https://es.godominicanrepublic.com/que-hacer/basilica-catedral-primada-de-america).
- The official page's exterior photograph was used as factual visual evidence for the text brief; it was not supplied to image generation.

## Castries — Cathedral Basilica of the Immaculate Conception

The initial pair added twin domed towers and an invented large seated statue. The correction specifies grey stone, red pitched roof, a simple front gable and rose window, pale-blue entrance porch, and one square side clock-and-bell tower. The square is represented by paths, lawn and trees.

- Landmark identity and setting: [Saint Lucia Tourism Authority — Castries](https://stlucia.org/en_uk/places-to-visit/castries/).
- Exterior appearance: [TravelAdventures photograph by Boris Kester](https://www.traveladventures.org/continents/americas/castries-cathedral01.html) and [independent exterior photo report](https://cannundrum.blogspot.com/2017/05/cathedral-basilica-of-immaculate.html). These two are photographer/travel sources, not government sources.

All six prior job files, exact generated PNGs, original provenance, WebPs and asset metadata are preserved with SHA256 in `revisions/worker-b-r1-2/supersession.json`. The replacement prompts and exact new tool source paths are retained in the current jobs and provenance.

## San Salvador — National Palace

Both initial variants added domes, including a large central dome in the mobile image. The correction specifies the broad two-storey neoclassical facade, six Corinthian columns, triangular central pediment and flat balustraded roofline. The equestrian monument is retained as a smaller part of the Gerardo Barrios square.

- Building identity and architecture: [El Salvador Ministry of Culture](https://www.cultura.gob.sv/los-centenarios-palacio-y-teatro-nacional-estan-de-aniversario/).
- Exterior evidence: [Wikimedia photograph of the National Palace](https://commons.wikimedia.org/wiki/File:Palacio_Nacional_de_El_Salvador_en_Centro_Hist%C3%B3rico.jpg).

The two initial palace variants and the second Santo Domingo mobile attempt are preserved in `revisions/worker-b-r2-1/supersession.json` (16 files). Santo Domingo's second mobile source was preserved with exact SHA but rejected before runtime conversion because 1159 x 1358 exceeded the allowed source aspect deviation. Its third independent T2I prompt reinforces a 4:5 portrait and the complete compact front elevation.

## Coro and Vigan — remove unrelated monumental backgrounds

Coro's two initial variants added large generic church buildings even though the requested subject was the earthen colonial houses and cobblestone lanes. Both were regenerated with low house rooflines only; 12 earlier files are retained in `revisions/worker-b-r1-3/supersession.json`. Vigan's landscape attempt similarly added a church beyond Calle Crisologo. Its replacement specifies capiz-shell windows, timber upper storeys, masonry lower storeys and one complete horse carriage. The approved mobile Vigan image already used that subject without the church.

## Kanchanaburi — complete bridge silhouette

The initial pair cut the right approach at the canvas edge. A distant bank-to-bank viewpoint restored both abutments. The second landscape attempt simplified all spans into straight trusses, so one further independent T2I attempt restored the recognizable curved outer trusses and straight central replacement spans while retaining both endpoints. Landmark source: [Tourism Authority of Thailand](https://www.tourismthailand.org/Attraction/bridge-over-the-river-kwai); the curved truss shape was also corroborated in exterior photographs returned by image search. No photograph was passed to image generation.

The initial bridge pair and Vigan landscape are retained in `revisions/worker-b-r1-4/supersession.json` (18 files); the second bridge landscape attempt is retained in `revisions/worker-b-r2-2/supersession.json` (6 files).

## Kinshasa — new National Museum of the DRC

The first pair resembled a generic tall pale-concrete institution with monumental carved panels. The actual 2019 MNRDC has a much lower composition using brick, screen blocks, open galleries and climate-sensitive shading. The replacement text therefore specifies broad red-brown brick rectangular volumes, patterned openwork, white supports, low rooflines and planted entrance grounds.

- First-party architect: [Junglim Architecture project record](https://junglim.com/en/natl-museum-of-drc/).
- Architect-provided construction and facade information: [SPACE, May 2026](https://www.spacem.org/eng/project/project_view.html?base_seq=Mzg1MQ%3D%3D).
- Museum identity: [Institut des Musees Nationaux du Congo](https://imnc.cd/mnrdc).
- First pair and provenance retained in `revisions/worker-b-r1-5/supersession.json` (12 files).

