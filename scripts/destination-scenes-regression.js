const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const D = require('../src/app/data/destination-scenes');
const R = require('../src/app/shared/destination-scenes');
const domesticFixture = require('./fixtures/destination-scenes-domestic');
const worldFixture = require('./fixtures/destination-scenes-world');
const stage = worldFixture.stages[worldFixture.currentStage];
assert(stage, 'Expansion stage has an independently reviewed fixture');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(D.catalog.length, stage.catalogCount);
assert.equal(Object.keys(worldFixture.baselineCatalogSha256).length, 395);
for (const [id, expectedHash] of Object.entries(worldFixture.baselineCatalogSha256)) {
  const entry = D.catalog.find(item => item.id === id);
  assert(entry, id + ': original destination is retained');
  assert.equal(digest(entry), expectedHash, id + ': original object, aliases and image paths are unchanged');
}
assert.equal(digest(D.themes), worldFixture.baselineThemeSha256, 'Existing theme objects and paths are unchanged');
assert.deepEqual(D.catalog.map(item => item.id).sort(), [...Object.keys(worldFixture.baselineCatalogSha256), ...stage.addedIds].sort(), 'Only the approved stage destinations were added');
const domestic = D.catalog.filter(item => item.countryCodes[0] === 'KR');
assert.equal(domestic.length, 95);
assert(domestic.every(item => item.dedicated), 'Every domestic destination has separate desktop/mobile artwork');
assert.equal(domesticFixture.officialCities.length, 85);
assert.equal(new Set(domesticFixture.officialCities.map(([region, name]) => `${region}/${name}`)).size, 85, 'Official roster has no duplicate cities');
const expectedDomesticIds = [...domesticFixture.officialCities.map(row => row[2]), ...domesticFixture.retainedDestinations];
assert.equal(new Set(expectedDomesticIds).size, 95, 'Official cities, historic urban area and retained regions are distinct');
assert.deepEqual(domestic.map(item => item.id).sort(), expectedDomesticIds.sort(), 'Exact official-city and retained-destination sets: no missing or extra place');
for (const [region, name, id, canonicalInput] of domesticFixture.officialCities) {
  const entry = domestic.find(item => item.id === id);
  assert.equal(entry.canonicalInput, canonicalInput, `${region}/${name}: unambiguous canonical input`);
  assert.equal(R.resolve({ travelMode: 'domestic', city: canonicalInput }).destinationId, id, `${region}/${name}: own destination`);
}
for (const entry of domestic) {
  const version = domesticFixture.existingArtwork.includes(entry.id) ? 2 : 5;
  assert.equal(entry.src, `src/assets/trip-scenes/cities/v${version}/${entry.id}.webp`, entry.id + ': existing originals retained; new artwork is immutable');
  assert.equal(entry.mobileSrc, `src/assets/trip-scenes/cities/v${version}/${entry.id}-mobile.webp`);
}
assert.equal(domestic.filter(item => item.src.includes('/v5/')).length, 80);
const overseas = D.catalog.filter(item => item.countryCodes[0] !== 'KR');
assert.equal(overseas.length, stage.overseasCount);
assert(overseas.every(item => item.dedicated), 'Every overseas destination has its own landscape and mobile artwork');
assert.equal(D.catalog.filter(item => item.dedicated).length, stage.catalogCount);
assert.equal(Object.keys(D.themes).length, 10);
assert.equal(new Set(D.catalog.map(item => item.id)).size, stage.catalogCount);
for (const id of stage.addedIds) {
  const entry = D.catalog.find(item => item.id === id);
  assert.equal(entry.src, `src/assets/trip-scenes/cities/v6/${id}.webp`, id + ': immutable new world artwork');
  assert.equal(entry.mobileSrc, `src/assets/trip-scenes/cities/v6/${id}-mobile.webp`);
}

// A country/territory roster independent of the catalog prevents silent gaps.
const sorted = values => [...new Set(values)].sort();
assert.equal(worldFixture.unMemberCodes.length, 193);
assert.deepEqual(worldFixture.unObserverCodes, ['PS', 'VA']);
assert.deepEqual(sorted([...worldFixture.unMemberCodes, ...worldFixture.unObserverCodes]), worldFixture.coreAllCountryCodes);
assert.equal(worldFixture.coreAllCountryCodes.length, 195);
assert.deepEqual(worldFixture.additionalAppJurisdictions, ['TW', 'XK']);
assert.equal(worldFixture.inhabitedAdditionalAreaCodes.length, 46);
assert.deepEqual(sorted([...worldFixture.coreAllCountryCodes, ...worldFixture.additionalAppJurisdictions, ...worldFixture.inhabitedAdditionalAreaCodes]), worldFixture.requiredAllCodes);
assert.equal(worldFixture.requiredAllCodes.length, 243);
assert.deepEqual(worldFixture.requiredAllCodes.filter(code => code !== 'KR'), worldFixture.requiredOverseasCodes);
assert.equal(worldFixture.requiredOverseasCodes.length, 242);
assert.deepEqual(worldFixture.noOrdinaryTourismCityCodes, ['AQ', 'BV', 'GS', 'HM', 'IO', 'TF', 'UM']);
assert(!worldFixture.noOrdinaryTourismCityCodes.some(code => worldFixture.requiredAllCodes.includes(code)));
const countryRegistry = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/app/data/countries.js'), 'utf8'), {
  Intl, window: { TripLog: { register: (name, api) => countryRegistry[name] = api } },
});
const pickerCountries = countryRegistry['data.countries'].getCountryDatabase();
assert.equal(pickerCountries.length, 250);
assert.deepEqual(sorted([...worldFixture.requiredAllCodes, ...worldFixture.noOrdinaryTourismCityCodes]), sorted(pickerCountries.map(country => country.code)), 'Every picker country is classified exactly once');
const qualifies = (entry, code) => entry.countryCodes[0] === code && (
  ['city', 'town'].includes(entry.kind) || worldFixture.settlementExceptions.some(exception =>
    exception.code === code && exception.destinationId === entry.id && exception.kind === entry.kind)
);
assert.deepEqual(worldFixture.requiredAllCodes.filter(code => !D.catalog.some(entry => qualifies(entry, code))), stage.missingRequiredCodes, 'The current stage has exactly the documented remaining country gaps');
if (worldFixture.currentStage === 'all') assert.deepEqual(stage.missingRequiredCodes, [], 'Every required country and inhabited area has a real settlement');
assert(!qualifies(D.catalog.find(entry => entry.id === 'il-jerusalem'), 'PS'), 'A secondary country code never satisfies the independent country minimum');
for (const [code, id] of Object.entries(stage.representativeIds)) {
  const entry = D.catalog.find(item => item.id === id), labels = worldFixture.countryLabels[code];
  assert(entry && qualifies(entry, code), code + ': the approved city or settlement exists');
  assert(entry.dedicated, code + ': a generic theme does not satisfy dedicated country coverage');
  const picker = pickerCountries.find(country => country.code === code);
  assert.equal(picker.name, labels.ko, code + ': Korean picker label fixture is current');
  assert.equal(picker.englishName, labels.en, code + ': English picker label fixture is current');
  for (const input of [{ countryCode: code }, { countryCode: code.toLowerCase() }, { country: labels.ko }, { country: labels.en }]) {
    const trip = { ...input, city: entry.canonicalInput }, before = JSON.stringify(trip);
    const resolved = R.resolve(trip);
    assert.equal(resolved.destinationId, id, `${code}/${JSON.stringify(input)}: country minimum resolves its own settlement`);
    assert.equal(resolved.artworkId, id);
    assert.equal(JSON.stringify(trip), before, code + ': resolving country names never rewrites saved data');
  }
}
const countryLabels = ['ko', 'en'].map(locale => new Intl.DisplayNames([locale], { type: 'region' }));
for (const entry of D.catalog) {
  for (const countryCode of entry.countryCodes) for (const alias of entry.aliases) {
    const resolved = R.resolve({ countryCode, city: alias });
    if (entry.id === 'kr-gwangju' && alias === '광주') assert.equal(resolved.match, 'ambiguous');
    else assert.equal(resolved.destinationId, entry.id, `${countryCode}/${alias}`);
    assert(resolved.src.startsWith('src/assets/trip-scenes/'));
  }
  assert(D.themes[entry.theme], entry.id);
  assert.equal(R.resolve({ countryCode: entry.countryCodes[0], city: entry.canonicalInput }).destinationId, entry.id, entry.id + ': canonical input resolves exactly');
  assert(entry.mobileSrc.endsWith('-mobile.webp'), entry.id + ': mobile illustration is available');
  assert.equal(R.resolve({ countryCode: entry.countryCodes[0], city: entry.aliases.at(-1) }).mobileSrc, entry.mobileSrc, entry.id + ': resolved mobile art');
  for (const countryCode of entry.countryCodes) for (const labels of countryLabels) {
    const resolved = R.resolve({ country: labels.of(countryCode), city: entry.aliases.at(-1) });
    assert.equal(resolved.destinationId, entry.id, `${labels.of(countryCode)}/${entry.name}: country picker labels match`);
  }
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
assert.equal(R.resolve({ countryCode: 'VN', city: '호이안' }).dedicated, true);
assert.equal(R.resolve({ countryCode: 'JP', city: '홋카이도' }).artworkId, 'theme-forest');
assert.equal(R.resolve({ countryCode: 'US', city: '하와이' }).artworkId, 'theme-island');
assert.equal(R.resolve({ countryCode: 'US', city: '오아후' }).destinationId, 'us-oahu');
assert.equal(R.resolve({ countryCode: 'US', city: '오아후' }).artworkId, 'us-oahu', 'Oahu keeps its own artwork instead of becoming an alias for Honolulu');
for (const [country, city, expected] of [
  ['캐나다', 'Québec', 'ca-quebec-city'], ['뉴질랜드', 'Queenstown', 'nz-queenstown'],
  ['브라질', 'São Paulo', 'br-sao-paulo'], ['아르헨티나', 'Buenos Aires', 'ar-buenos-aires'],
  ['코스타리카', 'San José', 'cr-san-jose'], ['멕시코', 'Ciudad de México', 'mx-mexico-city'],
  ['모로코', 'Marrakech', 'ma-marrakesh'], ['남아공', 'Cape Town', 'za-cape-town'],
  ['인도', 'New Delhi', 'in-delhi'], ['캄보디아', 'Siem Reap', 'kh-siem-reap'],
  ['그루지야', 'Tbilisi', 'ge-tbilisi'], ['우즈베키스탄', 'Samarqand', 'uz-samarkand'],
  ['Myanmar', 'Bagan', 'mm-bagan'], ['Palestine', 'Al-Quds', 'il-jerusalem'],
  ['Israel', 'Jerusalem', 'il-jerusalem'], ['피지', 'Nadi', 'fj-nadi'],
  ['스페인', 'Santiago de Compostela', 'es-santiago-de-compostela'], ['칠레', 'Santiago', 'cl-santiago'],
]) {
  const trip = { country, city }, before = JSON.stringify(trip);
  const resolved = R.resolve(trip);
  assert.equal(resolved.destinationId, expected, country + '/' + city);
  assert.equal(resolved.artworkId, expected, city + ': dedicated artwork');
  assert(resolved.src.includes('/cities/v4/'), city + ': immutable expanded artwork');
  assert.equal(JSON.stringify(trip), before, city + ': saved country and city stay unchanged');
}
for (const trip of [{ countryCode: 'US', city: 'San Jose' }, { countryCode: 'ES', city: 'Santiago' },
  { countryCode: 'US', city: 'Victoria' }, { countryCode: 'AU', city: 'Auckland' }]) {
  assert.equal(R.resolve(trip).artworkId, 'theme-travel', 'Same-name cities are never inferred across countries');
}
for (const [city, id] of [
  ['강원도 강릉시', 'kr-gangneung'], ['강원특별자치도 강릉시', 'kr-gangneung'],
  ['Gangneung-si, Gangwon-do', 'kr-gangneung'], ['전남 여수', 'kr-yeosu'],
  ['전라남도 여수시', 'kr-yeosu'], ['전남광주통합특별시 여수시', 'kr-yeosu'],
  ['Yeosu City, Jeollanam-do', 'kr-yeosu'], ['전라북도 익산시', 'kr-iksan'],
  ['전북특별자치도 익산시', 'kr-iksan'], ['Iksan, Jeonbuk State', 'kr-iksan'],
  ['경기도 수원특례시', 'kr-suwon'], ['화성특례시', 'kr-hwaseong'],
  ['창원특례시', 'kr-changwon'], ['세종특별자치시', 'kr-sejong'],
  ['경기 광주', 'kr-gwangju-gyeonggi'], ['경기도 광주시', 'kr-gwangju-gyeonggi'],
  ['Gwangju-si, Gyeonggi', 'kr-gwangju-gyeonggi'], ['광주(경기)', 'kr-gwangju-gyeonggi'],
  ['광주광역시', 'kr-gwangju'], ['Gwangju Metropolitan City', 'kr-gwangju'],
  ['전남광주통합특별시', 'kr-jeonnam-gwangju'], ['Jeonnam-Gwangju Integrated Special City', 'kr-jeonnam-gwangju'],
  ['제주', 'kr-jeju'], ['제주도', 'kr-jeju'], ['제주특별자치도', 'kr-jeju'], ['Jeju Island', 'kr-jeju'],
  ['제주시', 'kr-jeju-city'], ['제주 제주시', 'kr-jeju-city'], ['Jeju City', 'kr-jeju-city'],
  ['Jeju-si', 'kr-jeju-city'], ['제주특별자치도 제주시', 'kr-jeju-city'],
  ['서귀포', 'kr-seogwipo'], ['서귀포시', 'kr-seogwipo'], ['Seogwipo', 'kr-seogwipo'],
  ['제주특별자치도 서귀포시', 'kr-seogwipo'], ['Seogwipo City, Jeju-do', 'kr-seogwipo'],
  ['경기도 가평군', 'kr-gapyeong'], ['강원특별자치도 평창군', 'kr-pyeongchang'],
  ['전남광주통합특별시 담양군', 'kr-damyang'], ['경상북도 울릉군', 'kr-ulleung'],
]) {
  const trip = { countryCode: 'KR', city }, before = JSON.stringify(trip);
  const resolved = R.resolve(trip);
  assert.equal(resolved.destinationId, id, city + ': exact administrative/English alias');
  assert.equal(resolved.match, 'exact', city + ': city and broad-region identities stay separate');
  assert.equal(resolved.artworkId, id, city + ': dedicated artwork');
  assert.equal(JSON.stringify(trip), before, city + ': saved destination never changes');
}
assert.equal(R.resolve({ countryCode: 'KR', city: '전남광주통합특별시' }).destinationKind, 'region');
for (const city of ['광주', '광주시', 'Gwangju', 'Gwangju-si', 'Gwangju City']) {
  const resolved = R.resolve({ countryCode: 'KR', city });
  assert.equal(resolved.match, 'ambiguous', city + ': never guess between Gyeonggi and the historic urban area');
  assert.equal(resolved.artworkId, 'theme-urban');
}
for (const city of ['경기도 강릉시', '전남 수원시', '수원화성', '동해안', '고성', '고성군', '제주도 여행', '전라남도', '경기도']) {
  assert.equal(R.resolve({ countryCode: 'KR', city }).artworkId, 'theme-travel', city + ': do not infer a city from a substring or a wrong administrative area');
}
for (const city of ['서울 / 부산', '제주시 및 서귀포시', '광주, 여수']) {
  assert.equal(R.resolve({ countryCode: 'KR', city }).match, 'multiple');
}
const saved = { countryCode: 'KR', city: '순천시', tripName: '1000일 순천', itineraryItems: [{ place: '보존할 일정' }] };
const before = JSON.stringify(saved);
assert.deepEqual(R.resolve(saved), R.resolve(saved), 'A destination keeps the same artwork across renders');
assert.equal(JSON.stringify(saved), before, 'Artwork selection never edits trip data');
const artwork = new Set([...D.catalog.flatMap(item => [item.src, item.mobileSrc]), ...Object.values(D.themes).flatMap(item => [item.src, item.mobileSrc])]);
assert.equal(artwork.size, (stage.catalogCount + 10) * 2, 'Each destination and each theme has its own desktop/mobile pair');
if (!process.argv.includes('--skip-assets')) {
  for (const file of artwork) {
    const fullPath = path.resolve(__dirname, '..', file);
    assert(fs.existsSync(fullPath), `Missing deployed scene: ${file}`);
    const image = fs.readFileSync(fullPath);
    assert.equal(image.subarray(0, 4).toString(), 'RIFF');
    assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  }
}
console.log(`PASS destination scenes: ${stage.catalogCount} dedicated destinations (95 domestic, ${stage.overseasCount} overseas); original 395 objects preserved; world stage ${worldFixture.currentStage}, ${stage.missingRequiredCodes.length} documented country gaps; 250 picker labels, exact administrative/canonical aliases and non-mutating ambiguous/unknown/multiple/region fallbacks` + (process.argv.includes('--skip-assets') ? ' (asset generation in progress; file presence not checked)' : `, all ${artwork.size} deployed images present`));
