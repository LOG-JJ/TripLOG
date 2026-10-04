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
    KR: ['대한민국', '한국', 'Korea', 'South Korea', 'Republic of Korea'], JP: ['일본', 'Japan'],
    TW: ['대만', 'Taiwan'], HK: ['홍콩', 'Hong Kong'], MO: ['마카오', 'Macau', 'Macao'],
    CN: ['중국', 'China'], VN: ['베트남', 'Vietnam', 'Viet Nam'], TH: ['태국', 'Thailand'],
    SG: ['싱가포르', 'Singapore'], MY: ['말레이시아', 'Malaysia'], ID: ['인도네시아', 'Indonesia'],
    PH: ['필리핀', 'Philippines'], FR: ['프랑스', 'France'], GB: ['영국', 'UK', 'United Kingdom'],
    IT: ['이탈리아', 'Italy'], ES: ['스페인', 'Spain'], CZ: ['체코', 'Czechia', 'Czech Republic'],
    CH: ['스위스', 'Switzerland'], TR: ['튀르키예', '터키', 'Türkiye', 'Turkey'],
    US: ['미국', 'USA', 'United States', 'United States of America'], GU: ['괌', 'Guam'],
    MP: ['북마리아나 제도', '북마리아나제도', 'Northern Mariana Islands'],
    AU: ['호주', 'Australia'], AE: ['아랍에미리트', 'UAE', 'United Arab Emirates'], MV: ['몰디브', 'Maldives'],
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
      src: item?.src || fallback.src, mobileSrc: item?.mobileSrc || '', fallbackSrc: fallback.src, universalSrc: data.themes.travel.src,
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
