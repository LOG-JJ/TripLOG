# 아시아·아프리카·오세아니아 추가 후보 100곳

2026-10-17. 기존 `src/app/data/destination-scenes.js`의 국내 95·해외 300개를 읽고, 해외 확장의 절반인 100곳을 제안했다. 이 파일은 방문객 수 순위가 아닌 관광 소재 편집 계획이며, 앱 코드 수정이나 이미지 생성은 수행하지 않았다.

## 선정 방식

- 국가 편중을 줄이기 위해 현재 전용 목적지가 없는 국가를 먼저 선정했다. 아프리카는 기존 8개국 이외 46개국을 각각 1곳씩 보완하고 아스완·셰프샤우엔 2곳을 더했다.
- 아시아 34·아프리카 48·오세아니아 18곳이다. 전체 97개 국가/지역 코드에 걸치며 기존 목록에 없던 코드 77개를 추가로 대표한다.
- city 82·town 17·region 1로 분류했다. 관광 중심 소도시도 포함하지만, 섬·수도지구 전체를 도시로 허위 분류하지 않았다.
- 공식 관광청·지자체·국가유산기관·국립박물관·대사관 관광 안내와 UNESCO 세계유산/잠정목록을 우선 조사했다. 공식 관광청에서 자료가 희박한 곳은 직접 관리기관이나 공공기관의 도시 소개로 보완했다. 자유여행 후기나 일반 블로그는 최종 소재 출처로 사용하지 않았다.
- 기관 자료의 검색 결과와 본문에서 도시·소재의 존재 및 연결을 확인했다. 모든 건물의 외형을 사진으로 정밀 대조한 단계는 아니다. 생성 단계에서 지붕·창·동상·교량의 형태가 중요한 단일 건축물은 해당 공식 페이지의 사진을 실제로 확인하고 텍스트 묘사를 좁혀야 한다.
- 각 `motif`는 주요 랜드마크 또는 이름 있는 자연 지형 1개와 보조 경관을 중심으로 구성했다. 도시 주변의 대표 관광지는 도시와의 관계를 명시했고, 독립된 도시·섬·권역을 동의어로 합치지 않았다.

## 누락과 모호성 처리

- 아르메니아 예레반은 아시아 담당에 포함했다. 키프로스와 튀르키예·조지아의 추가 도시는 유럽 담당과 중복되지 않도록 이번 파일에서 제외했다.
- 북한은 UNESCO의 개성 유산 설명으로 직접 근거를 확인할 수 있는 개성을 선정했다. 남한(KR) 도시와 코드가 다르며, `Kaesong`, `Gaeseong`, `개성시`를 명시한다.
- 기존 예루살렘의 IL/PS 공동 코드는 그대로 두고, 별도 PS 목적지인 베들레헴을 추가한다. 정치적 경계 주장을 새로 정의하지 않는다.
- 캐나다 빅토리아와 구별하도록 세이셸 빅토리아는 국가가 붙은 이름·별칭만 사용했다. 트리폴리는 리비아 한정, 생루이는 세네갈 한정 별칭을 사용했다.
- 몰디브 권역과 말레시, 보라보라섬과 파페에테, 발리섬과 우붓을 분리했다. 이들의 상위 섬·나라 이름을 새 도시의 별칭으로 넣지 않았다.
- 나우루 야렌은 `region`이다. 국가에 도시가 없는데 city로 채우지 않았다. 마주로는 도시화된 정착지 `town`, 바이리키와 바이아쿠도 구체 정착지 `town`으로 제안했다. 타라와/푸나푸티 환초 전체 이름을 정착지의 단독 별칭으로 사용하지 않았다.
- 바미얀은 파괴된 불상을 복원해 그리지 않고 빈 감실을, 프리타운은 쓰러진 Cotton Tree를 온전한 나무로 추가하지 않도록 명시했다. 수아킨은 남아 있는 유적의 상태를 표현한다.
- 역사·관광 소재의 등재는 현재 입국 가능성, 현장 개방 여부, 건물 전체 보존 상태에 대한 보장이 아니다. 이 계획은 여행 가능 여부나 최신 안전 등급을 생성하지 않는다.
- 세계유산 정식 등재와 잠정목록을 구별했다. 관광청 설명 중 UNESCO 명칭이 느슨하게 쓰인 경우에도 본 계획에서 정식 등재로 확대 해석하지 않았다.

## 중복·기술 검증

앱이 실제 사용하는 `shared.destinationScenes.normalize`로 기존 395개와 새 100개의 별칭을 비교했다. Unicode 정규화·결합문자 제거·대소문자·공백과 지정 구두점 처리를 동일하게 적용했다.

- 기존 ID 충돌: 0
- 기존 별칭 충돌: 0
- 새 후보 사이 정규화 별칭 충돌: 0
- 테마는 기존 공통 테마 목록 안의 값만 사용한다.
- 입력 JSON과 기준 소스의 SHA256 및 새 국가 코드 목록은 [검증 JSON](candidate-validation-asia-africa-oceania.json)에 보존했다.

최종 합본에서는 다른 담당 후보와 다시 대조하고, 국가별 최소 1개 누락을 별도 단계에서 채운다. 무인도·남극영역 등 도시에 해당하지 않는 코드는 별도 예외 판단이 필요하다. 이 100곳만으로 앱의 모든 국가/지역 코드가 완전하게 채워졌다고 주장하지 않는다.

## 후속 제작 기준

새 이미지 생성은 독립 T2I를 기본으로 한다. 공식 사진은 외형 관찰에만 사용하며 사용자 지시 없이 이미지 입력으로 넣지 않는다. 기존 손그림·투명 배경·우측 연결 구도를 유지하고 PC 800×480 및 모바일 480×600을 각각 제작한다. 모든 피사체의 식별 윤곽은 프레임 안에 두고, 하단·우측 연결과 실제 모바일 줄바꿈은 앱 합성 후 검증한다.

## 후보별 근거

아래 링크는 각 JSON 행의 `motifSource`와 같다. 출처 문구를 장문 복제하지 않고 식별 대상만 기록했다.

| ID | 목적지 | 국가/지역 코드 | 구분 | 소재 확인 출처 |
| --- | --- | --- | --- | --- |
| af-bamiyan | 바미얀 / Bamiyan | AF | city | [UNESCO World Heritage Centre — Cultural Landscape and Archaeological Remains of the Bamiyan Valley](https://whc.unesco.org/en/list/208/) |
| pk-lahore | 라호르 / Lahore | PK | city | [UNESCO World Heritage Centre — Fort and Shalamar Gardens in Lahore](https://whc.unesco.org/en/list/171/) |
| bd-dhaka | 다카 / Dhaka | BD | city | [Bangladesh Tourism Board — Beautiful Bangladesh Tourist Handbook](https://tourismboard.gov.bd/sites/default/files/files/tourismboard.portal.gov.bd/page/aa3dacc5_f200_47c7_8445_12aff09f9450/BTB%20Tourist%20Handbook%20%281%29.pdf) |
| bn-bandar-seri-begawan | 반다르스리브가완 / Bandar Seri Begawan | BN | city | [Brunei Tourism — Omar Ali Saifuddien Mosque](https://www.bruneitourism.com/places/omar-ali-saifuddien-mosque/) |
| tl-dili | 딜리 / Dili | TL | city | [Timor-Leste Tourism — Cristo Rei](https://timorleste.tl/destinations/cristo-rei) |
| kz-almaty | 알마티 / Almaty | KZ | city | [Kazakhstan Travel — Almaty](https://www.kazakhstan.travel/en/regions/almaty) |
| kg-bishkek | 비슈케크 / Bishkek | KG | city | [Bishkek City Hall — Reopening of Ala-Too Square](https://www.bishkek.gov.kg/ru/post/30036) |
| tj-dushanbe | 두샨베 / Dushanbe | TJ | city | [Travel Tajikistan — Monument of Ismoil Somoni](https://traveltajikistan.tj/en/monument-of-ismoil-somoni/) |
| tm-ashgabat | 아시가바트 / Ashgabat | TM | city | [Government of Turkmenistan — Independence Monument in Ashgabat](https://turkmenistan.gov.tm/index.php/en/post/66608/president-turkmenistan-took-part-flower-laying-ceremony-independence-monument) |
| am-yerevan | 예레반 / Yerevan | AM | city | [Visit Yerevan — Cascade Complex](https://www.visityerevan.am/places/details/51/en/) |
| ir-isfahan | 이스파한 / Isfahan | IR | city | [UNESCO World Heritage Centre — Meidan Emam, Esfahan](https://whc.unesco.org/en/list/115/) |
| iq-erbil | 아르빌 / Erbil | IQ | city | [UNESCO World Heritage Centre — Erbil Citadel](https://whc.unesco.org/en/list/1437/) |
| lb-byblos | 비블로스 / Byblos | LB | city | [UNESCO World Heritage Centre — Byblos](https://whc.unesco.org/en/list/295/) |
| sy-damascus | 다마스쿠스 / Damascus | SY | city | [UNESCO World Heritage Centre — Ancient City of Damascus](https://whc.unesco.org/en/list/20/) |
| ye-sanaa | 사나 / Sanaa | YE | city | [UNESCO World Heritage Centre — Old City of Sana’a](https://whc.unesco.org/en/list/385/) |
| kp-kaesong | 개성 / Kaesong | KP | city | [UNESCO World Heritage Centre — Historic Monuments and Sites in Kaesong](https://whc.unesco.org/en/list/1278/) |
| ps-bethlehem | 베들레헴 / Bethlehem | PS | city | [UNESCO World Heritage Centre — Birthplace of Jesus: Church of the Nativity and the Pilgrimage Route, Bethlehem](https://whc.unesco.org/en/list/1433/) |
| jp-himeji | 히메지 / Himeji | JP | city | [UNESCO World Heritage Centre — Himeji-jo](https://whc.unesco.org/en/list/661/) |
| jp-matsumoto | 마쓰모토 / Matsumoto | JP | city | [Japan National Tourism Organization — Matsumoto Castle](https://www.japan.travel/en/spot/1356/) |
| cn-nanjing | 난징 / Nanjing | CN | city | [Nanjing City Wall — Official Tour Guide](https://english.njcitywall.cn/?obj=youlan) |
| cn-dunhuang | 둔황 / Dunhuang | CN | city | [UNESCO World Heritage Centre — Mogao Caves](https://whc.unesco.org/en/list/440/) |
| vn-sa-pa | 사파 / Sa Pa | VN | town | [Vietnam Tourism — Sa Pa](https://vietnam.travel/places-to-go/northern-midlands-mountains/sapa) |
| th-kanchanaburi | 칸차나부리 / Kanchanaburi | TH | city | [Tourism Authority of Thailand — Bridge Over the River Kwai](https://www.tourismthailand.org/Attraction/bridge-over-the-river-kwai) |
| my-kuching | 쿠칭 / Kuching | MY | city | [Sarawak Tourism Board — Kuching Waterfront](https://www.sarawaktourism.com/web/places-to-visit/town-view/kuching/major-attractions/kuching-waterfront) |
| id-bandung | 반둥 / Bandung | ID | city | [Wonderful Indonesia — Gedung Sate](https://www.indonesia.travel/id/id/travel-ideas/heritage/gedung-sate) |
| id-ubud | 우붓 / Ubud | ID | town | [Wonderful Indonesia — Istana Ubud](https://www.indonesia.travel/id/en/destination/bali-nusa-tenggara/bali/istana-ubud) |
| ph-vigan | 비간 / Vigan | PH | city | [UNESCO World Heritage Centre — Historic City of Vigan](https://whc.unesco.org/en/list/502/) |
| mm-yangon | 양곤 / Yangon | MM | city | [Myanmar Ministry of Hotels and Tourism — Yangon](https://tourism.gov.mm/en/regions/yangon) |
| in-amritsar | 암리차르 / Amritsar | IN | city | [Incredible India — Sri Harmandir Sahib Golden Temple](https://www.incredibleindia.gov.in/en/punjab/amritsar/sri-harmandir-sahib-golden-temple) |
| bt-thimphu | 팀푸 / Thimphu | BT | city | [Bhutan Tourism Services Portal — Thimphu and Tashichho Dzong setting](https://services.bhutan.travel/search/hotel/tashi-yoedling) |
| uz-bukhara | 부하라 / Bukhara | UZ | city | [UNESCO World Heritage Centre — Historic Centre of Bukhara](https://whc.unesco.org/en/list/602/) |
| mv-male | 말레 / Male | MV | city | [Visit Maldives — Hukuru Miskiy and Munnaaru, Malé City](https://visitmaldives.com/en/places/hukuru-miskiiy) |
| ae-sharjah | 샤르자 / Sharjah | AE | city | [Visit Sharjah — Al Noor Mosque](https://www.visitsharjah.com/en/activities/culture/al-noor-mosque/) |
| sa-alula | 알울라 / AlUla | SA | town | [UNESCO World Heritage Centre — Hegra Archaeological Site](https://whc.unesco.org/en/list/1293/) |
| dz-algiers | 알제 / Algiers | DZ | city | [UNESCO World Heritage Centre — Kasbah of Algiers](https://whc.unesco.org/en/list/565/) |
| ao-luanda | 루안다 / Luanda | AO | city | [Embassy of Angola — Discover Angola](https://www.angola.org/en/turismo) |
| bj-ouidah | 위다 / Ouidah | BJ | city | [Ouidah City Hall — La porte du non-retour](https://ouidah.mairie.bj/site-touristique/la-porte-du-non-retour) |
| bw-maun | 마운 / Maun | BW | town | [Botswana Tourism Organisation — Maun](https://botswanatourism.co.bw/explore/maun) |
| bf-bobo-dioulasso | 보보디울라소 / Bobo-Dioulasso | BF | city | [Burkina Faso Ministry of Communication — Bobo-Dioulasso tourism sites](https://www.communication.gov.bf/fileadmin/user_upload/storages/fichier/brochure_programme_snc_2024.pdf) |
| bi-bujumbura | 부줌부라 / Bujumbura | BI | city | [Burundi Tourism — Bujumbura and Lake Tanganyika](https://tourisme.gov.bi/en/home/) |
| cm-limbe | 림베 / Limbe | CM | city | [Cameroon National Institute of Statistics — South West regional yearbook, tourism chapter](https://ins-cameroun.cm/wp-content/uploads/2025/07/Annuaire-statistique-regional_SW-edit_2023_02.07.24_Revu.pdf) |
| cv-mindelo | 민델루 / Mindelo | CV | city | [Cabo Verde Ministry of Culture — Museu do Mar, Torre de Belém](https://www.mf.gov.cv/documents/20126/0/TDR%2B-%2BMuseu%2Bdo%2BMAR_EN%2BFINAL.pdf/ae335680-eeac-2b2a-75d6-ec707854571d?t=1725637194539) |
| cf-bangui | 방기 / Bangui | CF | city | [UNESCO Tentative List — Bangui hills, plain, Ubangi River and built heritage](https://whc.unesco.org/fr/listesindicatives/4011/) |
| td-ndjamena | 은자메나 / N'Djamena | TD | city | [Embassy of Chad in Côte d’Ivoire — Tourism monuments and sites](https://www.ambatchad.ci/fr/tourisme) |
| km-moroni | 모로니 / Moroni | KM | city | [Comoros National Tourism Office — Ngazidja](https://comorostourism.com/ile/ngazidja?_locale=fr) |
| cg-brazzaville | 브라자빌 / Brazzaville | CG | city | [Embassy of the Republic of Congo — Sites to Visit](https://www.ambacongo-us.org/fr/le-congo/visitez-le-congo/les-sites-%C3%A0-visiter) |
| cd-kinshasa | 킨샤사 / Kinshasa | CD | city | [Institut des Musées Nationaux du Congo — Musée National de la RDC](https://imnc.cd/mnrdc) |
| ci-grand-bassam | 그랑바삼 / Grand-Bassam | CI | city | [UNESCO World Heritage Centre — Historic Town of Grand-Bassam](https://whc.unesco.org/en/list/1322/) |
| dj-djibouti-city | 지부티시 / Djibouti City | DJ | city | [Djibouti National Tourism Agency — Djibouti City](https://guide.visitdjibouti.dj/djibouti/) |
| gq-malabo | 말라보 / Malabo | GQ | city | [Government of Equatorial Guinea — Malabo Cathedral restoration](https://www.guineaecuatorialpress.com/noticias/visita_de_supervision_del_jefe_de_estado_a_la_catedral_metropolitana_de_malabo) |
| er-asmara | 아스마라 / Asmara | ER | city | [UNESCO World Heritage Centre — Asmara: A Modernist African City](https://whc.unesco.org/en/list/1550/) |
| sz-lobamba | 로밤바 / Lobamba | SZ | town | [Eswatini Tourism Authority — Lobamba](https://www.thekingdomofeswatini.com/central-eswatini/lobamba/) |
| et-lalibela | 랄리벨라 / Lalibela | ET | town | [UNESCO World Heritage Centre — Rock-Hewn Churches, Lalibela](https://whc.unesco.org/en/list/18/) |
| ga-libreville | 리브르빌 / Libreville | GA | city | [Libreville Léon-Mba International Airport — Stay in Libreville](https://www.libreville-aeroport.com/en/stay-in-libreville/) |
| gm-banjul | 반줄 / Banjul | GM | city | [Banjul City Council — 2025 Voluntary Local Review](https://gold.uclg.org/sites/default/files/uploaded/banjul_2025.pdf) |
| gh-cape-coast | 케이프코스트 / Cape Coast | GH | city | [UNESCO World Heritage Centre — Forts and Castles, Volta, Greater Accra, Central and Western Regions](https://whc.unesco.org/en/list/34/) |
| gn-conakry | 코나크리 / Conakry | GN | city | [Government of Guinea — Grand Mosque Fayçal of Conakry](https://gouvernement.gov.gn/la-grande-mosquee-faycal-rouverte-la-proprete-des-lieux-fortement-exigee-par-le-president-de-la-transition/) |
| gw-bissau | 비사우 / Bissau | GW | city | [UCCLA Union of Portuguese-speaking Capital Cities — Bissau](https://www.uccla.pt/membro/membro-efetivo/bissau) |
| ls-maseru | 마세루 / Maseru | LS | city | [Government of Lesotho — Tourism](https://www.gov.ls/about-lesotho/tourism/) |
| lr-monrovia | 몬로비아 / Monrovia | LR | city | [Liberia Tourism — Providence Island](https://enjoyliberia.travel/pages/providence-island/) |
| ly-tripoli-libya | 트리폴리(리비아) / Tripoli, Libya | LY | city | [Libyan National Museum — Red Castle, Tripoli](https://museum.ly/) |
| mg-antananarivo | 안타나나리보 / Antananarivo | MG | city | [ORTANA Regional Tourism Office — Rovan’Antananarivo](https://tourisme-antananarivo.com/en/activities/rova-antananarivo/) |
| mw-zomba | 좀바 / Zomba | MW | city | [Malawi Department of Tourism — Zomba](https://visitmalawi.mw/zomba/) |
| ml-djenne | 젠네 / Djenne | ML | town | [UNESCO World Heritage Centre — Old Towns of Djenné](https://whc.unesco.org/en/list/116/) |
| mr-chinguetti | 칭게티 / Chinguetti | MR | town | [UNESCO World Heritage Centre — Ancient Ksour of Ouadane, Chinguetti, Tichitt and Oualata](https://whc.unesco.org/en/list/750/) |
| mu-port-louis | 포트루이스 / Port Louis | MU | city | [UNESCO World Heritage Centre — Aapravasi Ghat](https://whc.unesco.org/en/list/1227/) |
| mz-ilha-de-mocambique | 모잠비크섬 도시 / Ilha de Mocambique | MZ | town | [UNESCO World Heritage Centre — Island of Mozambique](https://whc.unesco.org/en/list/599/) |
| ne-agadez | 아가데즈 / Agadez | NE | city | [UNESCO World Heritage Centre — Historic Centre of Agadez](https://whc.unesco.org/en/list/1268/) |
| ng-osogbo | 오쇼그보 / Osogbo | NG | city | [UNESCO World Heritage Centre — Osun-Osogbo Sacred Grove](https://whc.unesco.org/en/list/1118/) |
| rw-kigali | 키갈리 / Kigali | RW | city | [Visit Rwanda — Meet in Rwanda and Kigali Convention Centre](https://visitrwanda.com/meet-in-rwanda/) |
| st-sao-tome | 상투메시 / Sao Tome City | ST | city | [São Tomé and Príncipe Tourism — Northern São Tomé](https://turismo.gov.st/en/northern-sao-tome) |
| sn-saint-louis-senegal | 생루이(세네갈) / Saint-Louis, Senegal | SN | city | [UNESCO World Heritage Centre — Island of Saint-Louis](https://whc.unesco.org/en/list/956/) |
| sc-victoria-seychelles | 빅토리아(세이셸) / Victoria, Seychelles | SC | city | [Tourism Seychelles — Historical Sites and Heritage Locations](https://seychelles.com/blog-details/2049/highlights/seychelles-historical-sites-and-heritage-locations) |
| sl-freetown | 프리타운 / Freetown | SL | city | [Sierra Leone Ministry of Tourism — Cultural Heritage](https://tourism.gov.sl/cultural-heritage/) |
| so-mogadishu | 모가디슈 / Mogadishu | SO | city | [Somalia Ministry of Information, Culture and Tourism — Benadir](https://mail.tourism.gov.so/about) |
| sd-suakin | 수아킨 / Suakin | SD | town | [UNESCO Tentative List — Suakin](https://whc.unesco.org/en/tentativelists/646/) |
| ss-juba | 주바 / Juba | SS | city | [South Sudan Ministry of Foreign Affairs — Tourism](https://mofaic.gov.ss/tourism/) |
| tg-lome | 로메 / Lome | TG | city | [Togo Tourism — La Cathédrale de Lomé](https://togotourisme.tg/detailsite?slug=la-cathedrale-de-lome&type=site) |
| ug-entebbe | 엔테베 / Entebbe | UG | city | [Uganda Prime Minister’s Office — Entebbe Botanical Gardens](https://opm.go.ug/entebbe-botanical-gardens-transferred-to-ministry-of-tourism/) |
| zm-livingstone | 리빙스턴 / Livingstone | ZM | city | [Livingstone City Council — Tourist Capital of Zambia](https://www.livingstonecouncil.gov.zm/) |
| eg-aswan | 아스완 / Aswan | EG | city | [Egypt Ministry of Tourism and Antiquities — Philae](https://egymonuments.gov.eg/en/archaeological-sites/philae/) |
| ma-chefchaouen | 셰프샤우엔 / Chefchaouen | MA | city | [Moroccan National Tourist Office — Chefchaouen](https://www.visitmorocco.com/en/travel/chefchaouen) |
| fm-kolonia | 콜로니아 / Kolonia | FM | town | [FSM Office of National Archives, Culture and Historic Preservation — Spanish Wall](https://nach.gov.fm/spanish-wall-ni-ahlek-kolonia/) |
| ki-bairiki | 바이리키 / Bairiki | KI | town | [Kiribati Tourism Authority — Things To Do, Tarawa and maritime landscape](https://kiribatitourism.gov.ki/things-to-do) |
| mh-majuro | 마주로 / Majuro | MH | town | [Pacific Tourism Organisation — Alele Museum in Marshall Islands](https://southpacificislands.travel/alele-museum-in-marshall-islands/) |
| nr-yaren | 야렌 / Yaren | NR | region | [Government of Nauru — Parliament of Naoero](https://www.nauru.gov.nr/parliament-of-naoero.aspx) |
| pw-koror | 코로르 / Koror | PW | city | [Belau National Museum — Official Website](https://palaunationalmuseum.pw/) |
| pg-port-moresby | 포트모르즈비 / Port Moresby | PG | city | [Papua New Guinea Tourism Promotion Authority — Port Moresby](https://papuanewguinea.travel/port-moresby-ncd/) |
| ws-apia | 아피아 / Apia | WS | city | [Samoa Tourism Authority — Apia](https://www.samoa.travel/discover/the-islands-of-samoa/upolu-island/apia/) |
| sb-honiara | 호니아라 / Honiara | SB | city | [American Battle Monuments Commission — Guadalcanal Memorial](https://www.abmc.gov/cemeteries-memorials/about-guadalcanal-memorial/) |
| to-nukualofa | 누쿠알로파 / Nuku'alofa | TO | city | [Tonga Tourism — Tongatapu and Nuku’alofa](https://www.tongatourism.travel/our-islands/tongatapu) |
| tv-vaiaku | 바이아쿠 / Vaiaku | TV | town | [Tuvalu Government Tourism Department — Vaiaku, Funafuti](https://tourism.gov.tv/) |
| vu-port-vila | 포트빌라 / Port Vila | VU | city | [Vanuatu Tourism Office — Cultural Centre and National Museum](https://www.vanuatu.travel/en/things-to-do/culture/vanuatu-cultural-center) |
| fj-suva | 수바 / Suva | FJ | city | [Tourism Fiji — A Visit to the Fiji Museum in Suva](https://www.fiji.travel/places-to-go/suva-and-surrounds/locations/a-visit-to-the-fiji-museum-in-suva) |
| pf-papeete | 파페에테 / Papeete | PF | city | [Tahiti Tourisme — Papeete Market](https://www.tahititourisme.com/service/papeete-market/) |
| nz-wellington | 웰링턴 / Wellington | NZ | city | [WellingtonNZ — Wellington Cable Car](https://www.wellingtonnz.com/visit/see-and-do/wellington-cable-car) |
| nc-noumea | 누메아 / Noumea | NC | city | [New Caledonia Tourism — Tjibaou Cultural Centre](https://www.newcaledonia.travel/destination/noumea/tjibaou-cultural-centre/) |
| ck-avarua | 아바루아 / Avarua | CK | town | [Cook Islands Tourism — Avarua CICC](https://cookislands.travel/avarua-cicc) |
| nu-alofi | 알로피 / Alofi | NU | town | [Niue Tourism Office — Niue Island Guide 2024](https://www.niueisland.com/library/files/niueislandguide2024%281%29.pdf) |
| as-pago-pago | 파고파고 / Pago Pago | AS | town | [American Samoa Department of Port Administration — Port of Pago Pago](https://portadministration.as.gov/seaports/port-of-pago-pago) |
