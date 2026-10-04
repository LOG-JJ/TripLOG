const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../src/app/data/destination-scenes');
const R = require('../src/app/shared/destination-scenes');
assert.equal(D.catalog.length, 113);
assert.equal(D.catalog.filter(item => item.countryCodes[0] === 'KR').length, 30);
assert.equal(D.catalog.filter(item => item.dedicated).length, 73);
assert.equal(Object.keys(D.themes).length, 10);
assert.equal(new Set(D.catalog.map(item => item.id)).size, 113);
for (const entry of D.catalog) {
  for (const countryCode of entry.countryCodes) for (const alias of entry.aliases) {
    const resolved = R.resolve({ countryCode, city: alias });
    if (entry.id === 'kr-gwangju' && alias === '광주') assert.equal(resolved.match, 'ambiguous');
    else assert.equal(resolved.destinationId, entry.id, `${countryCode}/${alias}`);
    assert(resolved.src.startsWith('src/assets/trip-scenes/'));
  }
  assert(D.themes[entry.theme], entry.id);
  assert(entry.mobileSrc.endsWith('-mobile.webp'), entry.id + ': mobile illustration is available');
  assert.equal(R.resolve({ countryCode: entry.countryCodes[0], city: entry.aliases.at(-1) }).mobileSrc, entry.mobileSrc, entry.id + ': resolved mobile art');
}
for (const theme of Object.values(D.themes)) {
  assert(theme.src.includes('/themes/v2/'), theme.id + ': revised desktop artwork');
  assert(theme.mobileSrc.endsWith('-mobile.webp'), theme.id + ': revised mobile artwork');
}
assert.equal(R.resolve({ country: '대한민국', city: ' 순천시 ' }).artworkId, 'kr-suncheon');
assert.equal(R.resolve({ countryCode: 'kr', city: 'Ｓｕｎｃｈｅｏｎ' }).destinationId, 'kr-suncheon');
assert.equal(R.resolve({ countryCode: 'VN', city: 'Đà Nẵng' }).destinationId, 'vn-da-nang');
assert.equal(R.resolve({ countryCode: 'GB', city: 'London' }).themeId, 'urban');
assert.equal(R.resolve({ countryCode: 'UK', city: 'London' }).destinationId, 'gb-london');
for (const [country, city, expected] of [
  ['포르투갈', 'Lisboa', 'pt-lisbon'], ['포르투칼', 'Oporto', 'pt-porto'],
  ['Deutschland', 'München', 'de-munich'], ['독일', 'Frankfurt am Main', 'de-frankfurt'],
  ['Switzerland', 'Zürich', 'ch-zurich'], ['스위스', 'Genève', 'ch-geneva'],
  ['Spain', 'València', 'es-valencia'], ['이탈리아', 'Firenze', 'it-florence'],
  ['Nederland', 'Amsterdam', 'nl-amsterdam'], ['Österreich', 'Wien', 'at-vienna'],
  ['카타르', 'Doha', 'qa-doha'], ['Oman', 'Muscat', 'om-muscat'],
  ['Saudi Arabia', 'Jeddah', 'sa-jeddah'], ['사우디', 'Riyadh', 'sa-riyadh'],
  ['USA', 'Washington, D.C.', 'us-washington-dc'], ['미국', 'Honolulu', 'us-honolulu'],
]) {
  const resolved = R.resolve({ country, city });
  assert.equal(resolved.destinationId, expected, country + '/' + city);
  assert.equal(resolved.artworkId, expected, city + ': own landmark artwork');
  assert(resolved.src.includes('/cities/v3/'), city + ': immutable new artwork');
}
for (const city of ['Washington', '워싱턴', 'Washington State']) {
  assert.equal(R.resolve({ countryCode: 'US', city }).artworkId, 'theme-travel', city + ': no guess between city and state');
}
for (const city of ['Sapporo', 'Osaka']) {
  assert(R.resolve({ countryCode: 'JP', city }).src.includes('/cities/v3/'), city + ': requested revised scene');
}
assert(R.resolve({ countryCode: 'FR', city: 'Paris' }).src.includes('/cities/v2/'), 'Existing Paris artwork is retained');
assert.equal(R.resolve({ travelMode: 'domestic', city: '서울' }).destinationId, 'kr-seoul');
for (const trip of [null, undefined, {}, { tripName: '제주 휴가', city: '' },
  { city: 'Suncheon' }, { countryCode: 'JP', city: '서울' }, { countryCode: 'XX', city: 'Paris' },
  { countryCode: 'KR', city: '처음 가보는 마을' }, { countryCode: 'KR', city: '<img src=x onerror=alert(1)>' },
  { countryCode: 'KR', city: { toString() { throw Error('Do not coerce malformed city'); } } }]) {
  assert.equal(R.resolve(trip).artworkId, 'theme-travel');
  assert.equal(R.resolve(trip).mobileSrc, D.themes.travel.mobileSrc);
}
assert.equal(R.resolve({ countryCode: 'JP', city: '오사카 & 교토' }).match, 'multiple');
assert.equal(R.resolve({ countryCode: 'VN', city: '호이안' }).destinationId, 'vn-hoi-an');
assert.equal(R.resolve({ countryCode: 'VN', city: '호이안' }).dedicated, false);
assert.equal(R.resolve({ countryCode: 'JP', city: '홋카이도' }).artworkId, 'theme-forest');
assert.equal(R.resolve({ countryCode: 'US', city: '하와이' }).artworkId, 'theme-island');
assert.equal(R.resolve({ countryCode: 'US', city: '오아후' }).destinationId, 'us-oahu');
assert.equal(R.resolve({ countryCode: 'US', city: '오아후' }).artworkId, 'theme-island', 'Oahu does not become an alias for Honolulu');
assert.equal(R.resolve({ countryCode: 'KR', city: '서귀포시' }).match, 'regional');
assert.equal(R.resolve({ countryCode: 'KR', city: '서귀포시' }).destinationId, 'kr-jeju');
assert.equal(R.resolve({ countryCode: 'KR', city: '광주시' }).artworkId, 'theme-travel');
assert.equal(R.resolve({ countryCode: 'KR', city: '광주광역시' }).destinationId, 'kr-gwangju');
const saved = { countryCode: 'KR', city: '순천시', tripName: '1000일 순천', itineraryItems: [{ place: '보존할 일정' }] };
const before = JSON.stringify(saved);
assert.deepEqual(R.resolve(saved), R.resolve(saved), 'A destination keeps the same artwork across renders');
assert.equal(JSON.stringify(saved), before, 'Artwork selection never edits trip data');
if (!process.argv.includes('--skip-assets')) {
  const artwork = new Set([...D.catalog.flatMap(item => [item.src, item.mobileSrc]), ...Object.values(D.themes).flatMap(item => [item.src, item.mobileSrc])]);
  assert.equal(artwork.size, 166, '73 city pairs and 10 theme pairs are active');
  for (const file of artwork) {
    const fullPath = path.resolve(__dirname, '..', file);
    assert(fs.existsSync(fullPath), `Missing deployed scene: ${file}`);
    const image = fs.readFileSync(fullPath);
    assert.equal(image.subarray(0, 4).toString(), 'RIFF');
    assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  }
}
console.log('PASS destination scenes: 113 destinations, 73 dedicated cities, 10 themes, exact country/alias matching, ambiguous/unknown/multiple/region fallbacks, deterministic non-mutating selection' + (process.argv.includes('--skip-assets') ? ' (asset generation in progress)' : ', all deployed images present'));
