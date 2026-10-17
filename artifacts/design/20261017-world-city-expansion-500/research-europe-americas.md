# 유럽·아메리카 관광도시 100곳 추가 조사

검토일: 2026-10-17  
산출물: [candidates-europe-americas.json](candidates-europe-americas.json)  
범위: 기존 해외 300개 목적지를 약 500개로 확장하기 위한 유럽·아메리카 담당 후보 100개. 이 단계에서는 런타임 코드와 이미지를 수정하거나 생성하지 않았다.

## 선정 결과

- 유럽 56개 도시, 아메리카 44개 도시, 합계 100개 도시.
- 후보가 속한 국가는 73개다. 기존 카탈로그에 없던 국가 35개를 먼저 포함했다.
- 기존 카탈로그는 해외 300개 목적지, 91개 국가·지역 코드였다. 기존의 홍콩·마카오·괌 등 지역 코드도 포함된 수치이므로 주권국가 수와 혼동하지 않는다.
- 신규 목적지의 `kind`는 모두 `city`다. 도시국가와 소규모 관광도시도 도시 항목으로 포함했고, 국가 전체나 대형 섬·광역권을 도시로 바꾸지 않았다.
- 미보유 국가에는 한 곳씩 넣고, 이미 다수 도시가 있는 미국은 2곳, 프랑스와 독일은 각각 3곳으로 추가를 제한했다. 영국의 5곳은 잉글랜드·웨일스·북아일랜드의 서로 다른 관광도시다.
- 미주 주권국가 35개는 기존 목적지와 이번 후보를 합하면 모두 최소 한 개 도시가 존재한다. 속령은 이 집계에 포함하지 않는다.

## 조사 방법과 근거

1. 현재 `src/app/data/destination-scenes.js`에서 해외 항목 300개와 별칭을 읽었다.
2. 국가 미보유 여부를 우선 확인하고, 도시 식별성이 있는 실제 관광 명소를 선택했다.
3. UNESCO 세계유산 자료, 국가·지역 관광청, 시 관광조직, 문화유산 관리기관과 해당 시설의 1차 자료를 웹에서 확인했다. 도시명이 아니라 다른 도시에 있는 동명 건축물을 다루는 검색 결과는 배제했다. 예를 들어 멕시코의 동명 성 미겔 성당 검색 결과 가운데 푸에블라 자료는 사용하지 않고 산미겔데아옌데를 다루는 과나후아토 관광 자료를 채택했다.
4. `motif`는 영어로 쓴 실제 식별 대상 한 곳과 보조 풍경 한 묶음이다. 이미지는 아직 생성하지 않았으며, 문장은 나중에 공통 손그림 톤의 T2I 프롬프트에 들어갈 소재다.
5. 대부분의 소재는 해당 도시 안에 있다. 우수아이아의 Les Eclaireurs 등 도심 밖의 대표 관광경관은 해당 시 관광청이 도시 관광 대상으로 명시한 경우에만 사용했다. 이 등대는 산후안데살바멘토의 “세계 끝의 등대”와 구분했다.
6. 방문 가능 시간·요금·여행 안전성은 이 자료의 판단 범위가 아니다. 시각 소재와 목적지 정체성의 근거만 사용했다.

각 행의 `motifSource`에 실제 확인한 출처의 제목과 URL을 넣었다. UNESCO가 도시 전체를 설명하면서 선택한 세부 랜드마크를 직접 설명하지 않는 경우, 해당 시 또는 국가 관광 자료를 추가 확인해 더 직접적인 출처를 사용했다. 카프아이시앵은 현지 여행 안내인 Visit Haiti의 도시 가이드를 사용했으며, 이를 정부 기관으로 표시하지 않았다. 요크 대성당과 킹스타운 대성당은 시설·교구의 직접 자료를 사용했다.

## 새로 확보한 국가

유럽: AL 알바니아, AD 안도라, BY 벨라루스, CY 키프로스, LI 리히텐슈타인, LU 룩셈부르크, MD 몰도바, MC 모나코, MK 북마케도니아, SM 산마리노, UA 우크라이나, VA 바티칸.

아메리카: AG 앤티가바부다, BB 바베이도스, BZ 벨리즈, BO 볼리비아, BS 바하마, DM 도미니카, DO 도미니카공화국, GD 그레나다, GT 과테말라, GY 가이아나, HN 온두라스, HT 아이티, JM 자메이카, KN 세인트키츠네비스, LC 세인트루시아, NI 니카라과, PY 파라과이, SR 수리남, SV 엘살바도르, TT 트리니다드토바고, UY 우루과이, VC 세인트빈센트그레나딘, VE 베네수엘라.

키프로스는 이번 작업의 유럽 담당 범위에 배치했다. `region`은 조사·생성 묶음 구분이며 국가 코드나 정치적 지위의 대체값이 아니다. 아르메니아는 아시아 담당 조사와 중복되지 않도록 포함하지 않았다.

벨라루스는 민스크 대신 UNESCO가 성과 공원을 직접 설명하는 네스비시를 선택했다. 이는 벨라루스의 실제 관광도시이며, 국가 전체 또는 수도와 다른 도시를 같은 별칭으로 합친 것이 아니다.

## 동명이름과 별칭 처리

- 기본은 도시의 한국어 표시명과 영어 이름, 검증 가능한 표기 변형이다. 관광지 이름 자체를 도시 별칭으로 무분별하게 추가하지 않았다.
- 국가 코드와 정규화된 도시 이름의 조합을 비교했다. 현재 선택 함수는 국가를 먼저 제한하므로 다른 국가의 동명이름은 서로 다른 항목으로 유지할 수 있다.
- 앤티가바부다와 캐나다의 St John's는 표시명에 국가를 붙였다. 각 국가 코드 아래에서는 통상적인 영어 이름과 지역을 붙인 이름을 모두 허용한다.
- 니카라과의 그라나다, 에콰도르의 쿠엥카, 멕시코의 메리다, 가이아나의 조지타운, 쿠바의 트리니다드도 표시명을 한정했다.
- 캐나다 나이아가라폴스에 광역 명칭인 “Niagara” 또는 단순 “나이아가라”를 별칭으로 넣지 않았다.
- 산미겔데아옌데에는 모호한 “San Miguel”만의 별칭을 넣지 않았다.
- 모나코에 별개의 구역 명칭 “Monte Carlo”를 도시 전체의 별칭으로 넣지 않았다.
- 영국에는 ISO 코드 GB를, 도미니카와 도미니카공화국에는 각각 DM과 DO를 사용했다. 바티칸 VA와 이탈리아 IT, 모나코 MC와 프랑스 FR도 분리했다.
- `canonicalInput`은 각 행의 명시적인 한국어 표시명이며 별칭 배열에도 포함되어 있다.

## 검증 결과

저장 직후 Node로 기존 해외 300개 + 후보 100개의 ID, 국가별 정규화 별칭, 테마 키를 비교했다.

- 후보 수: 100
- 고유 ID 수: 100
- 기존 ID와의 충돌: 0
- 동일 국가 내 다른 항목과의 정규화 별칭 충돌: 0
- 유효하지 않은 테마 키: 0
- 입력 이미지: 없음
- 이미지 생성 호출: 0
- 런타임 코드 변경: 없음
- 최초 저장 JSON SHA256: `1e4f6632503124b0458269bebef645f0d2c1b9022ad1f583b6f50bc36af0a04d`

테마는 현재 앱에 존재하는 키만 사용했다. 나이아가라폴스의 소재는 폭포지만 앱에 `waterfall` 테마가 없으므로 공통 대체 그림 키는 `lake`를 사용한다. 전용 그림의 폭포 소재는 바뀌지 않는다.

## 후속 누락 보완과 생성

- 다른 담당의 100개와 합본해 해외 약 500개가 된 뒤 국가별 최소 한 곳을 다시 감사한다. 이 파일만으로 전 세계 모든 국가가 충족되었다고 간주하지 않는다.
- PR·AW·CW·SX·BM·KY·TC·VG·VI·GP·MQ·GF·GL·FO·GI 등 속령·자치령 코드는 이번 100개에 넣지 않았다. 별도의 후속 묶음에서 개별 도시·정착지로 보완한다.
- 새 국가 코드의 한국어·영어 국가 선택값과 별칭 등록은 통합 구현 단계의 범위다. 후보 JSON만으로 현재 국가 이름 해석기가 자동 확장되지는 않는다.
- 실제 생성은 공통 손그림 톤, 투명 배경, 오른쪽 배치·하단 연결을 적용한다. PC 800×480과 모바일 480×600을 각각 독립 T2I로 생성하고, 이 조사에는 이미지 참조를 사용하지 않는다.
- 강·호수·바다가 명시되지 않은 대성당·광장·성·박물관 소재에는 장식용 수면을 추가하지 않는다.
- 국가명·지역명·도시명 데이터는 저장된 사용자 여행 값을 바꾸지 않고 선택용 카탈로그와 정확한 별칭만 확장한다.

## 도시별 소재와 확인 출처

| ID | 도시 | 국가 | 영문 소재 | 근거 |
| --- | --- | --- | --- | --- |
| al-tirana | 티라나 | AL | Skanderbeg Square and the equestrian Skanderbeg monument, with the Et'hem Bey Mosque. | [Albanian National Tourism Agency — Skanderbeg Monument and Square](https://akt.gov.al/en/skanderbeg-monument-and-square/) |
| ad-andorra-la-vella | 안도라라베야 | AD | the stone Casa de la Vall, with the surrounding Pyrenean slopes. | [Visit Andorra — Must-visit spots in Andorra la Vella](https://visitandorra.com/en/culture/must-visit-spots-in-andorra-la-vella/) |
| by-nesvizh | 네스비시 | BY | the Radziwill palace complex at Nesvizh, with its landscaped parks and ponds. | [UNESCO World Heritage Centre — Nesvizh](https://whc.unesco.org/en/list/1196/) |
| cy-paphos | 파포스 | CY | the rock-cut peristyle courtyards of the Tombs of the Kings, with the low coastal landscape of Paphos. | [UNESCO World Heritage Centre — Paphos](https://whc.unesco.org/en/list/79/) |
| li-vaduz | 파두츠 | LI | Vaduz Castle on its wooded hillside, with the Rhine valley slopes. | [Liechtenstein Tourism — Vaduz Castle](https://en.tourismus.li/map/poi/schloss-vaduz-8fb7e6cf-99b5-4ffb-b600-9e4c66398e1f.html) |
| lu-luxembourg-city | 룩셈부르크시 | LU | the old Luxembourg fortifications above the Grund, with the Alzette valley. | [UNESCO World Heritage Centre — Luxembourg City](https://whc.unesco.org/en/list/699/) |
| md-chisinau | 키시너우 | MD | the Triumphal Arch, with the cathedral park. | [Moldova Travel — Chisinau City](https://moldova.travel/en/chisinau-city/) |
| mc-monaco | 모나코 | MC | the Prince's Palace on the Rock of Monaco, with the Mediterranean harbour. | [Visit Monaco — Official tourist map](https://www.visitmonaco.com/Documents-Site/Plan%20touristique%20Monaco.pdf) |
| mk-ohrid | 오흐리드 | MK | the cliffside Church of Saint John at Kaneo, with Lake Ohrid. | [UNESCO World Heritage Centre — Ohrid](https://whc.unesco.org/en/list/99/) |
| sm-san-marino | 산마리노시 | SM | the Guaita fortress tower on Mount Titano, with the stone defensive walls. | [UNESCO World Heritage Centre — City of San Marino](https://whc.unesco.org/en/list/1245/) |
| ua-lviv | 리비우 | UA | the tall Town Hall tower in Rynok Square, with the closely set historic townhouses. | [Lviv Tourism — Rynok Square](https://lviv.travel/en/places/attractions/ploshcha-rinok) |
| va-vatican-city | 바티칸시국 | VA | the dome of Saint Peter's Basilica, with the curved colonnades of Saint Peter's Square. | [UNESCO World Heritage Centre — Vatican City](https://whc.unesco.org/en/list/286/) |
| gb-york | 요크 | GB | York Minster's Gothic towers, with the narrow medieval streets. | [York Minster — Visit](https://yorkminster.org/visit/) |
| gb-liverpool | 리버풀 | GB | the Royal Liver Building's twin clock towers, with the River Mersey waterfront. | [Visit Liverpool — Pier Head and The Three Graces](https://www.visitliverpool.com/listing/pier-head-%26-the-three-graces/1774701/) |
| gb-canterbury | 캔터베리 | GB | Canterbury Cathedral's central tower, with the historic cathedral precinct. | [UNESCO World Heritage Centre — Canterbury](https://whc.unesco.org/en/list/496/) |
| gb-cardiff | 카디프 | GB | Cardiff Castle's Norman keep, with the grassy motte. | [Visit Cardiff — History and Heritage](https://www.visitcardiff.com/discover/history-heritage/) |
| gb-belfast | 벨파스트 | GB | Titanic Belfast's angular silver facades, with the historic shipyard waterfront. | [Visit Belfast — Titanic Belfast](https://visitbelfast.com/see-do/attractions/titanic-belfast/) |
| fr-carcassonne | 카르카손 | FR | the double fortified walls of the Cite de Carcassonne, with its conical-roof defensive towers. | [UNESCO World Heritage Centre — Carcassonne](https://whc.unesco.org/en/list/345/) |
| fr-arles | 아를 | FR | the oval Roman amphitheatre of Arles, with its tiers of stone arches. | [UNESCO World Heritage Centre — Arles](https://whc.unesco.org/en/list/164/) |
| fr-reims | 랭스 | FR | Reims Cathedral's twin Gothic facade towers, with the cathedral forecourt. | [UNESCO World Heritage Centre — Reims](https://whc.unesco.org/en/list/601/) |
| it-matera | 마테라 | IT | the Sassi cave dwellings of Matera, with the layered stone lanes. | [UNESCO World Heritage Centre — Matera](https://whc.unesco.org/en/list/670/) |
| it-palermo | 팔레르모 | IT | Palermo Cathedral's arcaded facade and towers, with the palm-lined forecourt. | [UNESCO World Heritage Centre — Palermo](https://whc.unesco.org/en/list/1487/) |
| it-ravenna | 라벤나 | IT | the octagonal Basilica of San Vitale, with its brick apses and green grounds. | [UNESCO World Heritage Centre — Ravenna](https://whc.unesco.org/en/list/788/) |
| it-lucca | 루카 | IT | the tree-topped Guinigi Tower, with the terracotta roofs of the old town. | [Visit Tuscany — Guinigi Tower](https://www.visittuscany.com/en/attractions/the-guinigi-tower/) |
| es-cordoba | 코르도바 | ES | the Mosque-Cathedral of Cordoba, with the Roman bridge over the Guadalquivir. | [UNESCO World Heritage Centre — Cordoba](https://whc.unesco.org/en/list/313/) |
| es-segovia | 세고비아 | ES | the towering two-tier Roman aqueduct, with the open square beneath its arches. | [UNESCO World Heritage Centre — Segovia](https://whc.unesco.org/en/list/311/) |
| es-salamanca | 살라망카 | ES | Salamanca's arcaded Plaza Mayor, with its warm sandstone facades. | [UNESCO World Heritage Centre — Salamanca](https://whc.unesco.org/en/list/381/) |
| es-cadiz | 카디스 | ES | Cadiz Cathedral's golden dome, with the Atlantic waterfront. | [Spain Tourism — Cadiz Cathedral](https://www.spain.info/en/places-of-interest/cathedral-cadiz/) |
| de-lubeck | 뤼베크 | DE | the twin round brick towers of the Holstentor, with the old-town roofline. | [Lubeck Tourism — Historic centre and Holstentor](https://www.visit-luebeck.com/old-town/poi/tourist-information-at-holstentor) |
| de-bamberg | 밤베르크 | DE | the Old Town Hall on its river island, with the bridges over the Regnitz. | [Bamberg Tourism — Island District](https://en.bamberg.info/inselstadt/?addPage=2) |
| de-trier | 트리어 | DE | the massive Roman Porta Nigra, with the historic town square. | [UNESCO World Heritage Centre — Trier](https://whc.unesco.org/en/list/367/) |
| nl-the-hague | 헤이그 | NL | the Peace Palace's red-brick clock tower, with its formal garden. | [The Hague and Partners — Peace Palace](https://denhaag.com/en/peace-palace) |
| nl-utrecht | 위트레흐트 | NL | the tall Dom Tower, with the Oudegracht canal and wharves. | [Utrecht and Partners — Top 10 sights in Utrecht](https://www.discover-utrecht.com/news/top-10-sights-in-utrecht/) |
| be-antwerp | 안트베르펜 | BE | the Cathedral of Our Lady's slender Gothic spire, with the stepped-gable houses around the Grote Markt. | [Visit Antwerpen — A budget-friendly day out in Antwerp](https://visit.antwerpen.be/en/a-budget-friendly-day-out-in-antwerp) |
| ch-lugano | 루가노 | CH | Monte San Salvatore's distinctive rounded mountain profile, with Lake Lugano's palm-lined shore. | [Lugano Region — Monte San Salvatore](https://www.luganoregion.com/en/things-to-do/sport-and-nature/nature/scenic-mountains/monte-san-salvatore) |
| at-graz | 그라츠 | AT | the clock tower on the Schlossberg, with the red roofs of Graz below. | [Graz Tourism — Clock Tower](https://www.graztourismus.at/en/sightseeing-culture/sights/clock-tower_shg_1488) |
| pt-evora | 에보라 | PT | the Roman Temple of Evora's surviving columns, with the whitewashed historic streets. | [Visit Portugal — Roman Temple of Evora](https://www.visitportugal.com/en/content/templo-romano-de-evora) |
| pt-coimbra | 코임브라 | PT | the University of Coimbra's clock tower and royal palace courtyard, with the hillside old town. | [Visit Portugal — University of Coimbra Tower](https://www.visitportugal.com/en/NR/exeres/68EE612D-44E2-4A89-A6E3-0FF98BA427E0) |
| gr-corfu-town | 코르푸타운 | GR | the Old Fortress of Corfu, with the surrounding Ionian water. | [UNESCO World Heritage Centre — Corfu Town](https://whc.unesco.org/en/list/978/) |
| gr-nafplio | 나플리오 | GR | the small Bourtzi sea fortress, with the harbour of Nafplio. | [Greek National Tourism Organisation — Nafplio](https://www.visitgreece.gr/en/mainland/Peloponnese/Nafplio) |
| pl-wroclaw | 브로츠와프 | PL | the Centennial Hall's broad ribbed dome, with its landscaped grounds. | [UNESCO World Heritage Centre — Wroclaw](https://whc.unesco.org/en/list/1165/) |
| ro-sighisoara | 시기쇼아라 | RO | the medieval Clock Tower, with the colourful citadel houses. | [Municipality of Sighisoara — Citadel towers](https://primariasighisoara.ro/portal/mures/sighisoara/portal.nsf/pagini/turnurile%2Bcetatii-00004366) |
| bg-nesebar | 네세버르 | BG | the brick-and-stone Church of Christ Pantocrator, with the compact Black Sea old town. | [Bulgaria Tourism — Cultural heritage guide, Nessebar churches](https://bulgariatravel.org/wp-content/uploads/2021/04/BG-%D0%9E%D1%82-%D1%81%D0%B2%D0%B5%D1%89%D0%B5%D0%BD%D0%B8%D1%8F-%D0%9F%D0%B5%D1%80%D0%BF%D0%B5%D1%80%D0%B8%D0%BA%D0%BE%D0%BD-%D0%B4%D0%BE-%D1%86%D0%B0%D1%80%D1%81%D1%82%D0%B2%D0%B5%D0%BD%D0%B8%D1%8F-%D0%A2%D1%8A%D1%80%D0%BD%D0%BE%D0%B2%D0%B3%D1%80%D0%B0%D0%B4.pdf) |
| hr-trogir | 트로기르 | HR | the Cathedral of Saint Lawrence and its bell tower, with the waterfront old-town roofs. | [UNESCO World Heritage Centre — Trogir](https://whc.unesco.org/en/list/810/) |
| si-piran | 피란 | SI | the campanile of Saint George's church, with the oval Tartini Square and coastal roofs. | [Portoroz and Piran Tourism — Tartini Monument](https://www.portoroz.si/en/explore-portoroz-piran/explore-piran/culture-and-history/obj/13953-tartini-monument) |
| ba-mostar | 모스타르 | BA | the single stone arch of Stari Most, with the Neretva river and stone houses. | [UNESCO World Heritage Centre — Mostar](https://whc.unesco.org/en/list/946/) |
| rs-novi-sad | 노비사드 | RS | the clock tower of Petrovaradin Fortress, with the Danube below. | [Novi Sad Tourism Organisation — Clock Tower](https://novisad.travel/en/atrakcije-na-tvrdjavi/toranj-sa-satom/) |
| hu-pecs | 페치 | HU | Pecs Cathedral's four towers, with the historic cathedral square. | [City of Pecs — Saint Peter and Saint Paul Cathedral](https://pecs.hu/en/saint-peter-and-saint-paul-cathedral/) |
| cz-karlovy-vary | 카를로비바리 | CZ | the long Mill Colonnade, with the Tepla river through the spa town. | [Karlovy Vary Tourism — Mill Colonnade](https://www.karlovyvary.cz/en/mill-colonnade) |
| sk-kosice | 코시체 | SK | Saint Elisabeth Cathedral's Gothic silhouette, with the old-town pedestrian avenue. | [Visit Kosice — St Elisabeth's Cathedral](https://visitkosice.org/en/vidiet-a-zazit/st-elisabeths-cathedral) |
| se-gothenburg | 예테보리 | SE | the Feskekorka fish market's pointed roof, with the adjacent canal. | [Goteborg and Co — Feskekorka market architecture](https://www.goteborg.com/platser/astols-rokeri/) |
| dk-aarhus | 오르후스 | DK | the half-timbered houses of Den Gamle By, with the cobbled open-air museum lanes. | [Visit Aarhus — Den Gamle By and its museums](https://www.visitaarhus.com/areas-and-cities/aarhus/culture/the-museums-in-den-gamle-by) |
| no-tromso | 트롬쇠 | NO | the white triangular Arctic Cathedral, with the Tromso Sound and mountain backdrop. | [Visit Tromso — The Arctic Cathedral](https://www.visittromso.no/arctic-cathedral) |
| ie-cork | 코크 | IE | Saint Anne's Shandon clock tower, with the colourful hillside houses. | [Pure Cork — Shandon Bells and Tower](https://www.purecork.ie/things-to-do/shandon-bells-tower) |
| fi-turku | 투르쿠 | FI | Turku Cathedral's tall brick tower, with the Aura riverbank. | [Visit Turku — The Aura Riverside](https://en.visitturku.fi/the-aura-riverside-explore-local) |
| lt-kaunas | 카우나스 | LT | the stepped modernist facade of Christ's Resurrection Basilica, with the low city roofline. | [UNESCO World Heritage Centre — Kaunas](https://whc.unesco.org/en/list/1661/) |
| ag-st-johns | 세인트존스(앤티가) | AG | Saint John's Cathedral's twin towers, with the colourful harbour town roofs. | [Antigua and Barbuda Tourism Authority — Official visitor guide, St John's](https://www.visitantiguabarbuda.com/wp-content/uploads/ANU-2020-ITA-ING.pdf) |
| bb-bridgetown | 브리지타운 | BB | the neo-Gothic Parliament Buildings, with the Careenage waterfront. | [Barbados Tourism Marketing — Key buildings of Bridgetown](https://www.visitbarbados.org/key-buildings) |
| bz-belize-city | 벨리즈시티 | BZ | the brick Saint John's Cathedral, with the surrounding tropical greenery. | [Belize Tourism Board — St John's Cathedral](https://www.travelbelize.org/attraction/st-johns-cathedral/) |
| bo-sucre | 수크레 | BO | the white bell tower of Sucre Cathedral, with the arcaded Plaza 25 de Mayo. | [UNESCO World Heritage Centre — Sucre](https://whc.unesco.org/en/list/566/) |
| bs-nassau | 나소 | BS | the Queen's Staircase cut through limestone, with the surrounding tropical foliage. | [Bahamas Ministry of Tourism — The Queen's Staircase](https://www.bahamas.com/plan-your-trip/things-to-do/the-queens-staircase) |
| dm-roseau | 로조 | DM | the historic colonial building of the Dominica Museum, with the old Roseau waterfront. | [Discover Dominica — Historic Roseau](https://legacy.discoverdominica.com/en/places/77/roseau) |
| do-santo-domingo | 산토도밍고 | DO | the Cathedral of Santa Maria la Menor, with the colonial plaza and palm trees. | [UNESCO World Heritage Centre — Santo Domingo](https://whc.unesco.org/en/list/526/) |
| gd-st-georges | 세인트조지스 | GD | Fort George above the town, with the horseshoe-shaped Carenage harbour. | [Grenada Tourism Authority — Fort George](https://www.puregrenada.com/fr/fort-george-2/) |
| gt-antigua-guatemala | 안티과과테말라 | GT | the Santa Catalina Arch, with the cone of Agua volcano behind the colonial street. | [Guatemala Tourism Institute — Sacatepequez tourist guide 2026](https://inguat.gob.gt/en/descargas-inguat-guatemala/46-guias-turisticas.html?download=1148%3Aguia-turistica-de-sacatepequez-2026&start=20) |
| gy-georgetown | 조지타운(가이아나) | GY | the white wooden Saint George's Cathedral, with the surrounding garden. | [Guyana Tourism Authority — Georgetown City Tour](https://guyanatourism.com/georgetown-city-tour/) |
| hn-comayagua | 코마야과 | HN | Comayagua Cathedral's colonial clock tower, with the central plaza. | [Honduras Tourism Institute — Comayagua and La Paz visitor guide](https://visithonduras.iht.hn/wp-content/uploads/Comayagua-La-Paz.pdf) |
| ht-cap-haitien | 카프아이시앵 | HT | the Cathedral of Our Lady of the Assumption, with the historic town square. | [Visit Haiti — Cap-Haitien City Guide](https://visithaiti.com/destinations/cap-haitien-city-guide/) |
| jm-kingston | 킹스턴 | JM | the historic Devon House mansion, with its broad green lawns and palms. | [Jamaica Tourist Board — Architecture](https://www.visitjamaica.com/discover-jamaica/music-culture/architecture/) |
| kn-basseterre | 바스테르(세인트키츠) | KN | the green Berkeley Memorial clock, with the Circus roundabout's historic buildings. | [Saint Kitts and Nevis Department of Culture — Berkeley Memorial](https://www.culture.gov.kn/wp-content/uploads/2017/06/Replica-of-Basseterre-landmark-to-be-constructed-in-Glasgow.pdf) |
| lc-castries | 캐스트리스 | LC | the Cathedral of the Immaculate Conception, with Derek Walcott Square. | [Saint Lucia Tourism Authority — Castries](https://stlucia.org/en_uk/places-to-visit/castries/) |
| ni-granada | 그라나다(니카라과) | NI | the yellow Granada Cathedral, with the colonial central plaza. | [Nicaragua Tourism Board — Heritage Cities](https://www.visitanicaragua.com/en/annual/heritage-cities/) |
| py-asuncion | 아순시온 | PY | the Palacio de los Lopez, with the Paraguay River waterfront. | [Visit Paraguay — Palacio de Gobierno](https://visitparaguay.travel/places/palacio-de-gobierno) |
| sr-paramaribo | 파라마리보 | SR | the wooden Saint Peter and Paul Cathedral, with the historic timber houses. | [UNESCO World Heritage Centre — Paramaribo](https://whc.unesco.org/en/list/940/) |
| sv-san-salvador | 산살바도르 | SV | the National Palace, with the open Gerardo Barrios square. | [El Salvador Tourism — San Salvador](https://www.elsalvador.travel/destination/san-salvador/) |
| tt-port-of-spain | 포트오브스페인 | TT | Queen's Royal College's turreted facade, with the greenery of Queen's Park Savannah. | [Tourism Trinidad — Queen's Royal College](https://visittrinidad.tt/things-to-do/sites-attractions/queens-royal-college/) |
| uy-colonia-del-sacramento | 콜로니아델사크라멘토 | UY | the white Colonia del Sacramento lighthouse rising from stone ruins, with the cobbled lanes of the historic quarter. | [Uruguay Ministry of Tourism — Colonia del Sacramento lighthouse and old town](https://uruguaynatural.com/es/experiences/escapada-entre-tradiciones-buenos-platos-y-playas/) |
| vc-kingstown | 킹스타운 | VC | Saint George's Cathedral, with the surrounding Caribbean town houses. | [Anglican Diocese of the Windward Islands — St George's Cathedral in Kingstown](https://www.anglicanswi.org/about-st-georges-cathedral/) |
| ve-coro | 코로 | VE | the earthen colonial houses of Coro, with the cobbled historic streets. | [UNESCO World Heritage Centre — Coro](https://whc.unesco.org/en/list/658/) |
| us-charleston | 찰스턴 | US | the pastel houses of Rainbow Row, with the historic East Bay Street frontage. | [Explore Charleston — Iconic portrait spots, Rainbow Row](https://www.charlestoncvb.com/blog/guide/portrait-spots-in-charleston) |
| us-st-augustine | 세인트오거스틴 | US | the star-shaped Castillo de San Marcos, with the Matanzas Bay waterfront. | [US National Park Service — Castillo de San Marcos architecture](https://www.nps.gov/casa/learn/historyculture/construction.htm) |
| ca-halifax | 핼리팩스 | CA | the Old Town Clock below Halifax Citadel, with the grassy Citadel hillside. | [Parks Canada — Halifax Citadel historic buildings](https://parks.canada.ca/lhn-nhs/ns/halifax/culture/architecture/batiments-buildings?wbdisable=true) |
| ca-st-johns | 세인트존스(캐나다) | CA | Cabot Tower on Signal Hill, with the rugged Atlantic harbour entrance. | [Parks Canada — Signal Hill National Historic Site](https://www.parks.canada.ca/culture/designation/lieu-site/signal-hill) |
| ca-niagara-falls | 나이아가라폴스(캐나다) | CA | the curved Horseshoe Falls, with the rising mist and Niagara River. | [Niagara Falls Tourism — Niagara Parks Commission](https://www.niagarafallstourism.com/play/falls-experiences/niagara-parks-commission/) |
| mx-guanajuato | 과나후아토 | MX | the yellow Basilica of Our Lady of Guanajuato, with the brightly coloured hillside houses. | [Guanajuato Tourism — Basilica of Our Lady of Guanajuato](https://guanajuato.mx/romance/templos/basilica-colegiata-de-nuestra-senora-de-guanajuato/) |
| mx-san-miguel-de-allende | 산미겔데아옌데 | MX | the pink towers of the Parroquia de San Miguel Arcangel, with the old town's terracotta roofs. | [Guanajuato Tourism — Parroquia de San Miguel Arcangel](https://guanajuato.mx/romance/templos/parroquia-de-san-miguel-arcangel/) |
| mx-puebla | 푸에블라 | MX | Puebla Cathedral's twin bell towers, with the tiled colonial facades around the Zocalo. | [UNESCO World Heritage Centre — Puebla](https://whc.unesco.org/en/list/416/) |
| mx-merida | 메리다(멕시코) | MX | the Cathedral of San Ildefonso, with the Plaza Grande's palms. | [Government of Yucatan — Merida attractions](https://www.yucatan.gob.mx/?lt=&p=merida) |
| br-olinda | 올린다 | BR | the baroque facade of Sao Bento monastery, with the colourful hillside houses. | [Municipality of Olinda — Tourism](https://olinda.pe.gov.br/pagina/olinda-turismo) |
| br-brasilia | 브라질리아 | BR | the crown-like Cathedral of Brasilia, with the reflecting pool at its base. | [UNESCO World Heritage Centre — Brasilia](https://whc.unesco.org/en/list/445/) |
| br-ouro-preto | 오루프레투 | BR | the curving facade of Sao Francisco de Assis church, with the steep colonial street. | [Visit Brasil — Ouro Preto historic architecture](https://www.visitbrasil.com/blog/conheca-ouro-preto-a-bordo-de-uma-charmosa-jardineira-dos-anos-1930/) |
| ar-ushuaia | 우수아이아 | AR | the red-and-white Les Eclaireurs lighthouse, with the Beagle Channel and distant mountains. | [Ushuaia Tourism Secretariat — Faro Les Eclaireurs](https://turismoushuaia.com/actividad/faro-les-eclaireurs/) |
| ar-mendoza | 멘도사 | AR | the fountain in Plaza Independencia, with the shaded trees of the central plaza. | [City of Mendoza — Plaza Independencia history](https://ciudaddemendoza.gob.ar/plaza-independencia-historia/) |
| ar-salta | 살타 | AR | Salta Cathedral's pink twin-tower facade, with the Plaza 9 de Julio. | [Official Salta Tourism — Religious architecture](https://visitsalta.ar/religioso/arquitectura-religiosa/) |
| pe-arequipa | 아레키파 | PE | Arequipa Cathedral's long white sillar facade, with the cone of El Misti in the distance. | [UNESCO World Heritage Centre — Arequipa](https://whc.unesco.org/en/list/1016/) |
| co-medellin | 메데인 | CO | the checker-patterned Palace of Culture Rafael Uribe Uribe, with the rounded sculptures in Plaza Botero. | [Colombia Travel — Rafael Uribe Uribe Palace of Culture](https://colombia.travel/en/medellin/rafael-uribe-uribe-palace-culture) |
| cl-valparaiso | 발파라이소 | CL | Valparaiso's hillside funicular, with the brightly coloured houses above the port. | [UNESCO World Heritage Centre — Valparaiso](https://whc.unesco.org/en/list/959/) |
| ec-cuenca | 쿠엥카(에콰도르) | EC | the blue domes of the New Cathedral, with the colonial historic centre. | [Municipal Tourism Foundation of Cuenca — World heritage city](https://www.visitcuencaecuador.com.ec/en/cuenca-a-world-heritage-gem/) |
| cu-trinidad | 트리니다드(쿠바) | CU | the yellow bell tower of the former San Francisco convent, with the cobbled colonial lanes. | [UNESCO World Heritage Centre — Trinidad](https://whc.unesco.org/en/list/460/) |
| cr-cartago | 카르타고 | CR | the Basilica of Our Lady of the Angels, with the broad church forecourt. | [Costa Rica Tourism Board — Historical walks in Cartago](https://es.visitcostarica.com/things-to-do/culture/historical-walks/cartago) |

