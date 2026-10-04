(function (root, factory) {
  'use strict';
  const data = typeof module === 'object' && module.exports
    ? require('../data/destination-scenes') : root.TripLog.data.destinationScenes;
  const api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TripLog?.register('shared.destinationScenes', api);
})(typeof window === 'undefined' ? globalThis : window, function (data) {
  'use strict';
  const normalize = value => typeof value === 'string' ? value.normalize('NFKC').normalize('NFD')
    .replace(/\p{M}/gu, '').normalize('NFC').toLocaleLowerCase('en')
    .replace(/đ/g, 'd').replace(/[\s._'’ʻ-]+/g, '') : '';
  const countryNames = {
    AE: ['아랍에미리트', 'UAE', 'United Arab Emirates'],
    AR: ['아르헨티나', 'Argentina'],
    AT: ['오스트리아', 'Austria', 'Österreich'],
    AU: ['호주', 'Australia', '오스트레일리아'],
    AZ: ['아제르바이잔', 'Azerbaijan'],
    BA: ['보스니아 헤르체고비나', 'Bosnia & Herzegovina', 'Bosnia and Herzegovina', '보스니아헤르체고비나'],
    BE: ['벨기에', 'Belgium'],
    BG: ['불가리아', 'Bulgaria'],
    BH: ['바레인', 'Bahrain'],
    BR: ['브라질', 'Brazil'],
    BT: ['부탄', 'Bhutan'],
    CA: ['캐나다', 'Canada'],
    CH: ['스위스', 'Switzerland'],
    CL: ['칠레', 'Chile'],
    CN: ['중국', 'China'],
    CO: ['콜롬비아', 'Colombia'],
    CR: ['코스타리카', 'Costa Rica'],
    CU: ['쿠바', 'Cuba'],
    CZ: ['체코', 'Czechia', 'Czech Republic'],
    DE: ['독일', 'Germany', 'Deutschland'],
    DK: ['덴마크', 'Denmark'],
    EC: ['에콰도르', 'Ecuador'],
    EE: ['에스토니아', 'Estonia'],
    EG: ['이집트', 'Egypt'],
    ES: ['스페인', 'Spain'],
    FI: ['핀란드', 'Finland'],
    FJ: ['피지', 'Fiji'],
    FR: ['프랑스', 'France'],
    GB: ['영국', 'UK', 'United Kingdom'],
    GE: ['조지아', 'Georgia', '그루지야'],
    GR: ['그리스', 'Greece'],
    GU: ['괌', 'Guam'],
    HK: ['홍콩', 'Hong Kong', '홍콩(중국 특별행정구)', 'Hong Kong SAR China'],
    HR: ['크로아티아', 'Croatia'],
    HU: ['헝가리', 'Hungary'],
    ID: ['인도네시아', 'Indonesia'],
    IE: ['아일랜드', 'Ireland'],
    IL: ['이스라엘', 'Israel'],
    IN: ['인도', 'India'],
    IS: ['아이슬란드', 'Iceland'],
    IT: ['이탈리아', 'Italy'],
    JO: ['요르단', 'Jordan'],
    JP: ['일본', 'Japan'],
    KE: ['케냐', 'Kenya'],
    KH: ['캄보디아', 'Cambodia'],
    KR: ['대한민국', '한국', 'Korea', 'South Korea', 'Republic of Korea'],
    KW: ['쿠웨이트', 'Kuwait'],
    LA: ['라오스', 'Laos', 'Lao People\'s Democratic Republic'],
    LK: ['스리랑카', 'Sri Lanka'],
    LT: ['리투아니아', 'Lithuania'],
    LV: ['라트비아', 'Latvia'],
    MA: ['모로코', 'Morocco'],
    ME: ['몬테네그로', 'Montenegro'],
    MM: ['미얀마', 'Myanmar (Burma)', 'Myanmar', 'Burma', '버마'],
    MN: ['몽골', 'Mongolia'],
    MO: ['마카오', 'Macau', 'Macao', '마카오(중국 특별행정구)', 'Macao SAR China'],
    MP: ['북마리아나 제도', '북마리아나제도', 'Northern Mariana Islands'],
    MT: ['몰타', 'Malta'],
    MV: ['몰디브', 'Maldives'],
    MX: ['멕시코', 'Mexico'],
    MY: ['말레이시아', 'Malaysia'],
    NA: ['나미비아', 'Namibia'],
    NL: ['네덜란드', 'Netherlands', 'Nederland'],
    NO: ['노르웨이', 'Norway'],
    NP: ['네팔', 'Nepal'],
    NZ: ['뉴질랜드', 'New Zealand'],
    OM: ['오만', 'Oman', 'عمان'],
    PA: ['파나마', 'Panama'],
    PE: ['페루', 'Peru'],
    PF: ['프랑스령 폴리네시아', 'French Polynesia', '프렌치 폴리네시아'],
    PH: ['필리핀', 'Philippines'],
    PL: ['폴란드', 'Poland'],
    PS: ['팔레스타인 지구', 'Palestinian Territories', '팔레스타인', 'Palestine', 'State of Palestine'],
    PT: ['포르투갈', '포르투칼', 'Portugal'],
    QA: ['카타르', 'Qatar', 'قطر'],
    RO: ['루마니아', 'Romania'],
    RS: ['세르비아', 'Serbia'],
    RU: ['러시아', 'Russia'],
    SA: ['사우디아라비아', '사우디', 'Saudi Arabia', 'Kingdom of Saudi Arabia', 'السعودية'],
    SE: ['스웨덴', 'Sweden'],
    SG: ['싱가포르', 'Singapore'],
    SI: ['슬로베니아', 'Slovenia'],
    SK: ['슬로바키아', 'Slovakia'],
    TH: ['태국', 'Thailand'],
    TN: ['튀니지', 'Tunisia'],
    TR: ['튀르키예', '터키', 'Türkiye', 'Turkey'],
    TW: ['대만', 'Taiwan'],
    TZ: ['탄자니아', 'Tanzania'],
    US: ['미국', 'USA', 'United States', 'United States of America'],
    UZ: ['우즈베키스탄', 'Uzbekistan'],
    VN: ['베트남', 'Vietnam', 'Viet Nam'],
    ZA: ['남아프리카', 'South Africa', '남아프리카공화국', '남아공'],
    ZW: ['짐바브웨', 'Zimbabwe'],
  };
  const countries = new Map(Object.entries(countryNames).flatMap(([code, names]) => [code, ...names].map(name => [normalize(name), code])));
  const aliases = new Map();
  data.catalog.forEach(item => item.aliases.forEach(alias => {
    const key = normalize(alias), entries = aliases.get(key) || [];
    if (!entries.includes(item)) entries.push(item);
    aliases.set(key, entries);
  }));
  function country(trip) {
    const code = typeof trip.countryCode === 'string' ? trip.countryCode.trim().toUpperCase() : '';
    if (code) return { code: code === 'UK' ? 'GB' : code, explicit: true };
    const name = normalize(trip.country);
    if (name) return { code: countries.get(name) || '', explicit: true };
    return { code: trip.travelMode === 'domestic' ? 'KR' : '', explicit: trip.travelMode === 'domestic' };
  }
  function result(item, match = 'exact', theme = 'travel') {
    const fallback = data.themes[item?.theme || theme] || data.themes.travel;
    return {
      destinationId: item?.id || '', destinationName: item?.name || '', destinationKind: item?.kind || '',
      match, themeId: fallback.id, dedicated: Boolean(item?.dedicated),
      artworkId: item?.dedicated ? item.id : `theme-${fallback.id}`,
      src: item?.src || fallback.src, mobileSrc: item?.mobileSrc || fallback.mobileSrc || '', fallbackSrc: fallback.src, universalSrc: data.themes.travel.src,
    };
  }
  function resolve(trip = {}) {
    const destination = trip && typeof trip === 'object' ? trip : {};
    const place = normalize(destination.city), nation = country(destination);
    if (!place) return result(null, 'unknown');
    if (!nation.explicit || !nation.code) return result(null, 'unknown');
    // Two different Gwangju cities share the short Korean/English name. Preserve
    // the ambiguity until an administrative qualifier identifies the destination.
    if (nation.code === 'KR' && ['광주', 'gwangju'].includes(place)) return result(null, 'ambiguous', 'urban');
    const found = (aliases.get(place) || []).filter(item => !nation.explicit || item.countryCodes.includes(nation.code));
    if (found.length === 1) return result(found[0]);
    if (found.length > 1) return result(null, 'ambiguous');
    // These are explicit parent relationships, not city-name aliases. They never
    // replace saved destinations, and broad regions never acquire a city landmark.
    if (nation.code === 'KR' && ['제주시', '서귀포', '서귀포시', 'jejusi', 'seogwipo', 'seogwiposi'].includes(place)) {
      return result(data.catalog.find(item => item.id === 'kr-jeju'), 'regional');
    }
    if (nation.code === 'JP' && ['홋카이도', '북해도', 'hokkaido', '北海道'].includes(place)) return result(null, 'regional', 'forest');
    if (nation.code === 'US' && ['하와이', 'hawaii', 'hawaiianislands'].includes(place)) return result(null, 'regional', 'island');
    if (/[,&/;+＆]|\s(?:and|및)\s/i.test(String(destination.city || ''))) return result(null, 'multiple');
    return result(null, 'unknown');
  }
  return Object.freeze({ resolve, normalize, catalog: data.catalog, themes: data.themes });
});
