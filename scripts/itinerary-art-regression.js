const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const art = require('../src/app/shared/itinerary-art');
const data = require('../src/app/data/itinerary-art');
const root = path.resolve(__dirname, '..');
const cases = [
  ['Cafe de Flore', 'food', 'cafe'], ['CAFÉ DU PORT', 'food', 'cafe'], ['카페 호텔 파크', 'food', 'cafe'],
  ['Aéroport international', 'transport', 'airport'], ['東京駅', 'transport', 'train'], ['مطار دبي', 'transport', 'airport'],
  ['Museo Nacional', 'sightseeing', 'museum'], ['Musée national', 'sightseeing', 'museum'], ['美術館', 'sightseeing', 'gallery'],
  ['متحف المدينة', 'sightseeing', 'museum'], ['Городской музей', 'sightseeing', 'museum'], ['พิพิธภัณฑ์', 'sightseeing', 'museum'],
  ['Bảo tàng', 'sightseeing', 'museum'], ['Restaurante del Sol', 'food', 'restaurant'], ['Bäckerei am Markt', 'food', 'bakery'],
  ['Playa del Sol', 'sightseeing', 'beach'], ['海水浴場', 'sightseeing', 'beach'], ['شاطئ البحر', 'sightseeing', 'beach'],
  ['순천만국가정원', 'sightseeing', 'garden'], ['순천만습지', 'sightseeing', 'wetland'], ['중앙시장', 'shopping', 'market'],
  ['Hostel Central', 'lodging', 'hostel'], ['Airport Hotel', 'lodging', 'hotel'], ['Waterside Resort', 'lodging', 'resort'],
  ['Barcelona', 'etc', 'travel'], ['Scarborough', 'transport', 'transport'], ['Park Hyatt', 'lodging', 'hotel'],
  ['Hotel Cafe', 'etc', 'travel'], ['알 수 없는 장소', 'sightseeing', 'sightseeing'], ['', 'food', 'restaurant'],
  ['순천역', 'transport', 'train'], ['낙안읍성', 'sightseeing', 'castle'], ['경복궁', 'sightseeing', 'castle'],
  ['Sri Temple', 'sightseeing', 'sightseeing'], ['मंदिर', 'sightseeing', 'sightseeing'],
];
cases.forEach(([place, theme, expected]) => assert.equal(art.resolve({ place, theme }).id, expected, `${place} -> ${expected}`));
assert.equal(art.resolve({ place: '식당', theme: 'food', trans: 'flight', transits: [{ trans: 'train' }] }).id, 'restaurant', 'Incoming transport never classifies the destination');
assert.equal(art.resolve({ place: '이름 없는 예약', theme: 'transport', transportReservation: { kind: 'flight' } }).id, 'airport');
assert.equal(art.resolve({ place: '이름 없는 장소', theme: 'sightseeing', placeTypes: ['tourist_attraction', 'art_gallery'] }).id, 'gallery');
assert.equal(art.resolve({ place: '중앙 박물관', theme: 'sightseeing', placeTypes: ['tourist_attraction'] }).id, 'museum', 'A broad provider type does not hide a precise name');
assert.equal(art.resolve({ place: '국립공원', theme: 'sightseeing', placeTypes: ['national_park'] }).id, 'garden', 'A national park is not assumed to be forest');
assert.equal(art.resolve({ place: 'Unknown', theme: 'sightseeing', placeTypes: ['hindu_temple'] }).id, 'sightseeing', 'Unknown religious architecture uses a neutral fallback');
assert.equal(art.resolve({ place: 'Park Cafe', theme: 'food', placeTypes: ['museum'] }).id, 'cafe', 'User category takes precedence over conflicting imported metadata');
for (const value of [null, undefined, '', 0, [], { theme: '__proto__', placeTypes: ['__proto__', 'constructor'], transportReservation: { kind: 'constructor' } }]) {
  assert.equal(art.resolve(value).id, 'travel');
}
const item = Object.freeze({ place: 'カフェ', theme: 'food', transits: Object.freeze([]) });
const baseline = JSON.stringify(item), selected = art.resolve(item);
for (const countryCode of ['KR', 'JP', 'US', 'FR', 'BR', 'ZA', 'EG', 'AE', 'IN', 'TH', 'VN', 'AU', 'NZ', 'ZZ', '']) {
  assert.deepEqual(art.resolve(item, { countryCode }), selected, 'Type coverage never depends on a supported-country list');
}
assert.equal(JSON.stringify(item), baseline);
assert.equal(Object.keys(art.catalog).length, 50);
for (const [id, row] of Object.entries(art.catalog)) {
  assert.equal(row.id, id);
  assert(/^src\/assets\/itinerary-art\/v1\/[a-z-]+\.webp$/.test(row.src));
  assert(fs.existsSync(path.join(root, row.src)), `Missing final asset ${row.src}`);
  const resolved = art.resolve({ place: data.keywords[id]?.split('|')[0] || '', theme: row.group });
  assert(fs.existsSync(path.join(root, resolved.src)));
  assert(fs.existsSync(path.join(root, resolved.fallbackSrc)));
  assert(fs.existsSync(path.join(root, resolved.universalSrc)));
}
console.log('PASS itinerary artwork: 50 real assets, multilingual type selection, category precedence, stable country-independent fallbacks, malformed metadata and no state mutation.');
