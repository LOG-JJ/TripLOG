(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TripLog?.register('data.destinationScenes', api);
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const base = 'src/assets/trip-scenes';
  const themes = Object.freeze(Object.fromEntries([
    ['urban', '도심'], ['coast', '해안'], ['island', '열대 섬'], ['mountain', '산악'],
    ['forest', '숲'], ['lake', '강·호수'], ['traditional', '전통 마을'],
    ['wetland', '습지·들판'], ['desert', '사막'], ['travel', '공통 여행'],
  ].map(([id, name]) => [id, Object.freeze({
    id, name, src: `${base}/themes/v2/${id}.webp`, mobileSrc: `${base}/themes/v2/${id}-mobile.webp`,
  })])));
  // Art priorities are editorial choices, not visitor rankings. Regions and islands
  // retain their own identity instead of becoming aliases for an unrelated city.
  const primary = new Set([
    'kr-suncheon', 'kr-seoul', 'kr-busan', 'kr-jeju', 'kr-gangneung', 'kr-sokcho',
    'kr-gyeongju', 'kr-jeonju', 'kr-yeosu', 'kr-tongyeong', 'kr-geoje', 'kr-namhae',
    'kr-chuncheon', 'kr-gapyeong', 'kr-yangyang', 'jp-tokyo', 'jp-osaka', 'jp-kyoto',
    'jp-fukuoka', 'jp-sapporo', 'jp-okinawa', 'tw-taipei', 'hk-hong-kong',
    'vn-da-nang', 'vn-nha-trang', 'th-bangkok', 'th-chiang-mai', 'sg-singapore',
    'id-bali', 'fr-paris',
  ]);
  // id, display name, accepted country/territory codes, kind, scene, exact aliases.
  const rows = [
    ['kr-seoul', '서울', 'KR', 'city', 'urban', '서울시|서울특별시|Seoul'],
    ['kr-incheon', '인천', 'KR', 'city', 'coast', '인천시|인천광역시|Incheon'],
    ['kr-suwon', '수원', 'KR', 'city', 'traditional', '수원시|Suwon'],
    ['kr-gapyeong', '가평', 'KR', 'region', 'forest', '가평군|Gapyeong'],
    ['kr-gangneung', '강릉', 'KR', 'city', 'coast', '강릉시|Gangneung'],
    ['kr-sokcho', '속초', 'KR', 'city', 'mountain', '속초시|Sokcho'],
    ['kr-yangyang', '양양', 'KR', 'region', 'coast', '양양군|Yangyang'],
    ['kr-chuncheon', '춘천', 'KR', 'city', 'lake', '춘천시|Chuncheon'],
    ['kr-pyeongchang', '평창', 'KR', 'region', 'mountain', '평창군|Pyeongchang|Pyeong-chang'],
    ['kr-daejeon', '대전', 'KR', 'city', 'urban', '대전시|대전광역시|Daejeon'],
    ['kr-danyang', '단양', 'KR', 'region', 'mountain', '단양군|Danyang'],
    ['kr-jeonju', '전주', 'KR', 'city', 'traditional', '전주시|Jeonju'],
    ['kr-yeosu', '여수', 'KR', 'city', 'coast', '여수시|Yeosu'],
    ['kr-suncheon', '순천', 'KR', 'city', 'wetland', '순천시|Suncheon|전남 순천|전라남도 순천|전라남도 순천시'],
    ['kr-mokpo', '목포', 'KR', 'city', 'coast', '목포시|Mokpo'],
    ['kr-gunsan', '군산', 'KR', 'city', 'traditional', '군산시|Gunsan'],
    ['kr-damyang', '담양', 'KR', 'region', 'forest', '담양군|Damyang'],
    ['kr-boseong', '보성', 'KR', 'region', 'forest', '보성군|Boseong'],
    ['kr-gwangju', '광주', 'KR', 'city', 'urban', '광주광역시|Gwangju Metropolitan City'],
    ['kr-daegu', '대구', 'KR', 'city', 'urban', '대구시|대구광역시|Daegu'],
    ['kr-gyeongju', '경주', 'KR', 'city', 'traditional', '경주시|Gyeongju'],
    ['kr-andong', '안동', 'KR', 'city', 'traditional', '안동시|Andong'],
    ['kr-pohang', '포항', 'KR', 'city', 'coast', '포항시|Pohang'],
    ['kr-ulleung', '울릉도', 'KR', 'island', 'coast', '울릉|울릉군|Ulleung|Ulleungdo|Ulleung Island'],
    ['kr-busan', '부산', 'KR', 'city', 'coast', '부산시|부산광역시|Busan|Pusan'],
    ['kr-ulsan', '울산', 'KR', 'city', 'coast', '울산시|울산광역시|Ulsan'],
    ['kr-tongyeong', '통영', 'KR', 'city', 'coast', '통영시|Tongyeong'],
    ['kr-geoje', '거제', 'KR', 'city', 'coast', '거제시|거제도|Geoje'],
    ['kr-namhae', '남해', 'KR', 'region', 'coast', '남해군|Namhae'],
    ['kr-jeju', '제주도', 'KR', 'region', 'coast', '제주|제주특별자치도|Jeju|Jeju-do|Jeju Island'],
    ['jp-tokyo', '도쿄', 'JP', 'city', 'urban', '동경|Tokyo|東京|東京都'],
    ['jp-osaka', '오사카', 'JP', 'city', 'urban', '오사카시|Osaka|Osaka City|大阪|大阪市'],
    ['jp-kyoto', '교토', 'JP', 'city', 'traditional', '쿄토|교토시|Kyoto|京都|京都市'],
    ['jp-fukuoka', '후쿠오카', 'JP', 'city', 'coast', '후쿠오카시|Fukuoka|福岡|福岡市'],
    ['jp-sapporo', '삿포로', 'JP', 'city', 'urban', '삿포로시|Sapporo|札幌|札幌市'],
    ['jp-okinawa', '오키나와', 'JP', 'region', 'island', '오키나와현|Okinawa|沖縄|沖縄県'],
    ['jp-nagoya', '나고야', 'JP', 'city', 'urban', 'Nagoya|名古屋|名古屋市'],
    ['jp-nara', '나라', 'JP', 'city', 'traditional', '나라시|Nara|奈良|奈良市'],
    ['jp-yufuin', '유후인', 'JP', 'region', 'mountain', 'Yufuin|由布院|湯布院'],
    ['jp-hakone', '하코네', 'JP', 'region', 'mountain', 'Hakone|箱根'],
    ['tw-taipei', '타이베이', 'TW', 'city', 'urban', '대만 타이베이|타이페이|Taipei|臺北|台北|臺北市|台北市'],
    ['tw-kaohsiung', '가오슝', 'TW', 'city', 'coast', 'Kaohsiung|高雄|高雄市'],
    ['tw-taichung', '타이중', 'TW', 'city', 'urban', 'Taichung|臺中|台中|臺中市|台中市'],
    ['hk-hong-kong', '홍콩', 'HK,CN', 'region', 'urban', 'Hong Kong|Hongkong|香港'],
    ['mo-macau', '마카오', 'MO,CN', 'region', 'urban', '마카우|Macau|Macao|澳門|澳门'],
    ['cn-shanghai', '상하이', 'CN', 'city', 'urban', '상해|Shanghai|上海|上海市'],
    ['cn-beijing', '베이징', 'CN', 'city', 'traditional', '북경|Beijing|Peking|北京|北京市'],
    ['cn-qingdao', '칭다오', 'CN', 'city', 'coast', '청도|Qingdao|青岛|青島|青岛市'],
    ['cn-zhangjiajie', '장자제', 'CN', 'region', 'mountain', '장가계|Zhangjiajie|张家界|張家界'],
    ['vn-da-nang', '다낭', 'VN', 'city', 'coast', 'Da Nang|Danang|Đà Nẵng'],
    ['vn-nha-trang', '나트랑', 'VN', 'city', 'coast', '냐짱|Nha Trang|Nhatrang'],
    ['vn-hanoi', '하노이', 'VN', 'city', 'traditional', 'Hanoi|Ha Noi|Hà Nội'],
    ['vn-ho-chi-minh', '호찌민', 'VN', 'city', 'urban', '호치민|사이공|Ho Chi Minh|Ho Chi Minh City|Hồ Chí Minh|Saigon|Sai Gon'],
    ['vn-hoi-an', '호이안', 'VN', 'city', 'traditional', 'Hoi An|Hoian|Hội An'],
    ['vn-phu-quoc', '푸꾸옥', 'VN', 'island', 'island', '푸쿠옥|Phu Quoc|Phú Quốc'],
    ['th-bangkok', '방콕', 'TH', 'city', 'traditional', 'Bangkok|Krung Thep|กรุงเทพมหานคร'],
    ['th-chiang-mai', '치앙마이', 'TH', 'city', 'traditional', 'Chiang Mai|Chiangmai|เชียงใหม่'],
    ['th-phuket', '푸껫', 'TH', 'island', 'island', '푸켓|Phuket|ภูเก็ต'],
    ['th-pattaya', '파타야', 'TH', 'city', 'coast', 'Pattaya|พัทยา'],
    ['sg-singapore', '싱가포르', 'SG', 'region', 'urban', 'Singapore|新加坡'],
    ['my-kota-kinabalu', '코타키나발루', 'MY', 'city', 'coast', 'Kota Kinabalu|코타 키나발루'],
    ['id-bali', '발리', 'ID', 'island', 'island', '발리섬|Bali|Bali Island'],
    ['ph-cebu', '세부', 'PH', 'region', 'island', 'Cebu|Cebu Island'],
    ['ph-boracay', '보라카이', 'PH', 'island', 'island', 'Boracay|Boracay Island'],
    ['fr-paris', '파리', 'FR', 'city', 'urban', 'Paris'],
    ['gb-london', '런던', 'GB', 'city', 'urban', 'London'],
    ['it-rome', '로마', 'IT', 'city', 'traditional', 'Rome|Roma'],
    ['it-venice', '베네치아', 'IT', 'city', 'urban', '베니스|Venice|Venezia'],
    ['es-barcelona', '바르셀로나', 'ES', 'city', 'urban', 'Barcelona'],
    ['cz-prague', '프라하', 'CZ', 'city', 'traditional', 'Prague|Praha'],
    ['ch-interlaken', '인터라켄', 'CH', 'city', 'mountain', 'Interlaken'],
    ['tr-istanbul', '이스탄불', 'TR', 'city', 'traditional', 'Istanbul|İstanbul'],
    ['us-new-york', '뉴욕', 'US', 'city', 'urban', 'New York|New York City|NYC'],
    ['us-san-francisco', '샌프란시스코', 'US', 'city', 'urban', 'San Francisco'],
    ['us-oahu', '오아후', 'US', 'island', 'island', '오아후섬|Oahu|Oʻahu|Oahu Island'],
    ['gu-guam', '괌', 'GU,US', 'island', 'island', 'Guam'],
    ['mp-saipan', '사이판', 'MP,US', 'island', 'island', 'Saipan'],
    ['au-sydney', '시드니', 'AU', 'city', 'coast', 'Sydney'],
    ['ae-dubai', '두바이', 'AE', 'city', 'desert', 'Dubai|دبي'],
    ['mv-maldives', '몰디브', 'MV', 'region', 'island', 'Maldives|Maldives Islands'],
  ];
  // Keep revised paintings immutable so the on-demand cache can retain older
  // releases without serving a previous illustration to an updated header.
  const catalog = Object.freeze(rows.map(([id, name, codes, kind, theme, aliases]) => Object.freeze({
    id, name, countryCodes: Object.freeze(codes.split(',')), kind, theme,
    aliases: Object.freeze([name, ...aliases.split('|')]), dedicated: primary.has(id),
    src: primary.has(id) ? `${base}/cities/v2/${id}.webp` : themes[theme].src,
    mobileSrc: primary.has(id) ? `${base}/cities/v2/${id}-mobile.webp` : themes[theme].mobileSrc,
  })));
  return Object.freeze({ catalog, themes, version: 3 });
});
