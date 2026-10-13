(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TripLog?.register('data.itineraryArt', api);
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const base = 'src/assets/itinerary-art/v1';
  // Generic type illustrations describe an activity, never claim to depict the
  // exact building or destination. Existing city art remains in the trip header.
  const rows = [
    ['travel', '여행 기록', 'etc'], ['sightseeing', '명소', 'sightseeing'],
    ['beach', '해변', 'sightseeing'], ['island', '섬', 'sightseeing'], ['mountain', '산', 'sightseeing'],
    ['forest', '숲', 'sightseeing'], ['lake', '강·호수', 'sightseeing'], ['wetland', '습지', 'sightseeing'],
    ['desert', '사막', 'sightseeing'], ['garden', '정원·공원', 'sightseeing'], ['waterfall', '폭포', 'sightseeing'],
    ['cave', '동굴', 'sightseeing'], ['snow', '설원·스키', 'sightseeing'], ['urban', '도심', 'sightseeing'], ['oldtown', '전통 마을', 'sightseeing'],
    ['museum', '박물관', 'sightseeing'], ['gallery', '미술관', 'sightseeing'], ['castle', '성·요새', 'sightseeing'],
    ['temple', '사찰', 'sightseeing'], ['shrine', '신사', 'sightseeing'], ['church', '교회·성당', 'sightseeing'],
    ['mosque', '모스크', 'sightseeing'], ['tower', '전망대·타워', 'sightseeing'], ['monument', '기념물', 'sightseeing'],
    ['theme-park', '테마파크', 'sightseeing'], ['aquarium', '수족관', 'sightseeing'], ['zoo', '동물원', 'sightseeing'],
    ['stadium', '경기장', 'sightseeing'], ['theater', '공연장', 'sightseeing'], ['wellness', '온천·휴식', 'sightseeing'], ['hiking', '하이킹', 'sightseeing'],
    ['restaurant', '식당', 'food'], ['cafe', '카페', 'food'], ['bakery', '베이커리', 'food'], ['bar', '바', 'food'],
    ['hotel', '숙소', 'lodging'], ['resort', '리조트', 'lodging'], ['camping', '캠핑', 'lodging'], ['hostel', '호스텔', 'lodging'],
    ['shopping', '쇼핑', 'shopping'], ['market', '시장', 'shopping'], ['mall', '쇼핑몰', 'shopping'],
    ['transport', '이동', 'transport'], ['airport', '공항·항공', 'transport'], ['train', '철도', 'transport'],
    ['bus', '버스', 'transport'], ['ferry', '배·항구', 'transport'], ['car', '차량', 'transport'], ['bicycle', '자전거', 'transport'], ['walk', '도보', 'transport'],
  ];
  const catalog = Object.freeze(Object.fromEntries(rows.map(([id, label, group]) => [id, Object.freeze({ id, label, group, src: `${base}/${id}.webp` })])));
  const fallbacks = Object.freeze({ sightseeing: 'sightseeing', food: 'restaurant', lodging: 'hotel', shopping: 'shopping', transport: 'transport', etc: 'travel' });
  // Human-readable, multilingual local rules. Matching never sends a user's
  // itinerary to an image generator, geocoder, classifier, or search service.
  const keywords = {
    airport: '공항|비행기|항공편|airport|aeroporto|aeropuerto|aeroport|flughaben|flughafen|havaalanı|空港|机场|機場|مطار|аэропорт|สนามบิน|sân bay',
    train: '기차|철도|열차|기차역|역|전철|지하철|신칸센|KTX|SRT|train station|railway|railroad|subway|metro|bahnhof|gare|estacion de tren|stazione|新幹線|鉄道|電車|駅|火车|車站|地铁|قطار|вокзал|รถไฟ',
    bus: '버스|버스터미널|고속버스|bus|coach station|autobus|otobus|バス|巴士|公交|حافلة|автобус|รถบัส',
    ferry: '페리|여객선|유람선|항구|크루즈|ferry|cruise|harbour|harbor|boat terminal|porto|puerto|フェリー|クルーズ|码头|碼頭|渡轮|ميناء|паром|ท่าเรือ',
    car: '렌터카|렌트카|택시|드라이브|car rental|rent a car|taxi|cab ride|autovermietung|レンタカー|タクシー|租车|出租车|سيارة|такси',
    bicycle: '자전거|사이클링|bicycle|cycling|bike ride|velo|bicicleta|自転車|骑行|自行车|دراجة|велосипед',
    walk: '도보|산책|걷기|walking|walk|promenade|paseo|spaziergang|散歩|徒歩|步行|散步|مشي|прогулка',
    cafe: '카페|커피|찻집|cafe|café|coffee|tearoom|tea house|kaffee|cafeteria|カフェ|喫茶|珈琲|咖啡|茶馆|مقهى|кафе|คาเฟ่|cà phê',
    bakery: '베이커리|빵집|제과|bakery|boulangerie|patisserie|panaderia|bäckerei|pasteleria|ベーカリー|パン屋|面包|麵包|مخبز|пекарня|tiệm bánh',
    bar: '와인바|칵테일|맥주|펍|이자카야|bar|pub|cocktail|wine bar|biergarten|tavern|バー|居酒屋|酒吧|бар',
    restaurant: '식당|맛집|식사|아침|점심|저녁|브런치|국밥|해산물|고깃집|restaurant|breakfast|lunch|dinner|brunch|bistro|ristorante|restaurante|食堂|レストラン|食事|餐厅|餐館|早餐|午餐|晚餐|مطعم|ресторан|ร้านอาหาร|nhà hàng',
    resort: '리조트|resort|village vacances|リゾート|度假村|渡假村|منتجع|รีสอร์ท|khu nghỉ dưỡng',
    camping: '캠핑|야영|글램핑|camping|campsite|campground|glamping|キャンプ|露营|露營|تخييم|кемпинг|แคมป์',
    hostel: '호스텔|게스트하우스|hostel|guesthouse|guest house|auberge|pousada|ホステル|ゲストハウス|青旅|民宿|بيت ضيافة',
    hotel: '호텔|숙소|숙박|체크인|체크아웃|펜션|료칸|hotel|hôtel|lodging|inn|check in|check out|albergo|pension|ホテル|旅館|宿泊|酒店|宾馆|住宿|فندق|отель|โรงแรม|khách sạn',
    market: '시장|야시장|재래시장|market|night market|marche|mercado|bazaar|bazar|markt|市場|夜市|マーケット|集市|سوق|рынок|ตลาด|chợ',
    mall: '쇼핑몰|백화점|아울렛|면세점|mall|shopping centre|shopping center|department store|outlet|duty free|centro comercial|百貨店|デパート|商场|商場|购物中心|متجر متعدد|торговый центр',
    shopping: '쇼핑|기념품|shopping|souvenir|boutique|買い物|お土産|购物|購物|تسوق|покупки',
    gallery: '미술관|갤러리|전시장|art museum|art gallery|gallery|galerie|galleria|美術館|ギャラリー|美术馆|画廊|معرض فني|галерея',
    museum: '박물관|뮤지엄|museum|museo|museu|musée|muze|博物館|博物馆|ミュージアム|متحف|музей|พิพิธภัณฑ์|bảo tàng',
    shrine: '신사|神社|神宮|大社|shinto shrine|jinja|taisha|ศาลเจ้า',
    mosque: '모스크|이슬람사원|mosque|masjid|camii|cami|清真寺|مسجد|мечеть|มัสยิด',
    church: '성당|교회|대성당|church|cathedral|basilica|eglise|iglesia|catedral|kirche|domkirche|教会|大聖堂|教堂|كنيسة|собор|โบสถ์|nhà thờ',
    temple: '사찰|불교사원|절 방문|buddhist temple|pagoda|buddhist|wat|寺院|仏閣|寺庙|寺廟|วัด|chùa',
    castle: '성곽|읍성|산성|요새|궁궐|왕궁|고궁|궁|castle|palace|fortress|fort|chateau|castillo|palacio|schloss|burg|城堡|城|宫殿|宮殿|王宮|قلعة|قصر|замок|дворец|พระราชวัง',
    tower: '전망대|전망탑|타워|tower|observation deck|viewpoint|mirador|aussichtsturm|torre|展望台|タワー|观景台|觀景台|برج|башня|จุดชมวิว',
    monument: '기념비|기념탑|기념관|유적|유적지|monument|memorial|ruins|archaeological|heritage site|記念碑|遺跡|遗址|紀念碑|نصب|памятник',
    'theme-park': '테마파크|놀이공원|어뮤즈먼트|amusement park|theme park|disneyland|universal studios|parc attraction|遊園地|テーマパーク|迪士尼|游乐园|สวนสนุก',
    aquarium: '수족관|아쿠아리움|aquarium|oceanarium|acuario|acquario|水族館|水族馆|海洋馆|аквариум',
    zoo: '동물원|사파리|zoo|zoologico|safari|wildlife park|動物園|动物园|حديقة حيوان|зоопарк|สวนสัตว์',
    stadium: '경기장|야구장|축구장|스타디움|stadium|arena|ballpark|stade|estadio|スタジアム|競技場|体育场|體育場|ملعب|стадион',
    theater: '공연장|극장|콘서트|오페라|theater|theatre|concert|opera|teatro|劇場|コンサート|剧院|劇院|مسرح|театр',
    wellness: '온천|스파|마사지|사우나|hot spring|onsen|spa|sauna|wellness|thermal bath|温泉|スパ|溫泉|حمام|термы|สปา',
    beach: '해변|해수욕장|바닷가|비치|beach|plage|playa|praia|spiaggia|strand|sahil|ビーチ|海水浴場|海滩|海灘|شاطئ|пляж|ชายหาด|bãi biển',
    island: '섬 투어|아일랜드|island|isla|ilha|insel|isola|island hopping|離島|海岛|海島|جزيرة|остров|เกาะ|đảo',
    mountain: '산 정상|산악|설악산|한라산|후지산|mountain|mount|montagne|montana|berg|montagna|富士山|山頂|山岳|山脉|جبل|гора|ภูเขา|núi',
    forest: '숲|삼림|산림|forest|foret|bosque|wald|foresta|森林|森散策|غابة|лес|ป่า|rừng',
    lake: '호수|강변|호숫가|lake|river|lac|lago|fluss|fiume|湖|川沿い|河畔|بحيرة|نهر|озеро|река|ทะเลสาบ|hồ',
    wetland: '습지|갈대밭|wetland|marsh|reed field|湿地|湿原|沼泽|مستنقع',
    desert: '사막|모래언덕|desert|dunes|desierto|deserto|wüste|砂漠|沙漠|صحراء|пустыня|ทะเลทราย',
    garden: '정원|공원|수목원|식물원|garden|botanical|arboretum|park|jardin|jardim|garten|parque|giardino|庭園|植物園|公園|花园|公园|حديقة|сад|парк|สวน|công viên',
    waterfall: '폭포|waterfall|cascades|cascada|cachoeira|wasserfall|cascata|滝|瀑布|شلال|водопад|น้ำตก|thác',
    cave: '동굴|석굴|cave|cavern|grotte|cueva|grotta|höhle|洞窟|鍾乳洞|溶洞|كهف|пещера|ถ้ำ|hang động',
    snow: '스키|스노보드|설원|빙하|ski|snowboard|glacier|snow park|スキー|スノーボード|滑雪|冰川|تزلج|лыжи',
    hiking: '하이킹|트레킹|등산|hiking|trekking|trail|randonnée|senderismo|wandern|ハイキング|登山|徒步|เดินป่า',
    urban: '도심|시내|도시투어|city tour|downtown|city centre|city center|市内観光|市中心|وسط المدينة',
    oldtown: '전통마을|한옥마을|구시가지|old town|oldtown|historic district|altstadt|centro historico|旧市街|古城|古镇|المدينة القديمة',
  };
  const providerTypes = Object.freeze({ airport: 'airport', train_station: 'train', subway_station: 'train', transit_station: 'transport', bus_station: 'bus', ferry_terminal: 'ferry', car_rental: 'car', restaurant: 'restaurant', cafe: 'cafe', coffee_shop: 'cafe', bakery: 'bakery', bar: 'bar', lodging: 'hotel', hotel: 'hotel', resort_hotel: 'resort', hostel: 'hostel', campground: 'camping', shopping_mall: 'mall', department_store: 'mall', market: 'market', store: 'shopping', art_gallery: 'gallery', museum: 'museum', mosque: 'mosque', church: 'church', hindu_temple: 'sightseeing', buddhist_temple: 'temple', place_of_worship: 'sightseeing', tourist_attraction: 'sightseeing', park: 'garden', botanical_garden: 'garden', beach: 'beach', national_park: 'sightseeing', aquarium: 'aquarium', zoo: 'zoo', amusement_park: 'theme-park', stadium: 'stadium', performing_arts_theater: 'theater', spa: 'wellness', hiking_area: 'hiking', ski_resort: 'snow' });
  return Object.freeze({ version: 1, catalog, fallbacks, keywords: Object.freeze(keywords), providerTypes });
});
