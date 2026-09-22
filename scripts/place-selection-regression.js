const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  return { dataset: {}, classList: { toggle() {} }, setAttribute() {}, addEventListener() {},
    children: [], replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); } };
}
const c = vm.createContext({
  window: { TripLog: { core: { config: { STORAGE_KEY: 'fixture' } }, register() {} } },
  document: { createElement: element }, URL,
  state: { city: '교토', country: '일본', travelMode: 'overseas', itineraryItems: [] },
  els: { placeSearchResults: element(), placeSearchStatus: element(), googleMapsLink: {} },
  escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
});
for (const file of ['shared/map-links.js', 'services/maps/query-utils.js', 'services/maps/domestic-route.js', 'features/itinerary/map-preview.js',
  'features/itinerary/place-search.js', 'persistence/state-storage.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app', file), 'utf8'), c, { filename: file });
}

// A same-name result in another city must never replace the displayed Google search.
const query = '텐류지', googleQuery = '텐류지 교토 일본';
const otherCity = { id: 'other-city', source: 'nominatim-search', place: query,
  location: '일본 도쿄 시부야', lat: 35.6595, lon: 139.7005, type: 'temple' };
const before = JSON.stringify(otherCity);
const results = c.renderPlaceSearchResults([otherCity], query, { googleQuery });
assert.equal(results.length, 2);
assert.equal(results[0].source, 'google-query-preview');
assert.equal(c.buildGoogleMapPreviewQuery(results[0]), googleQuery);
assert.equal(results[0].lat, undefined);
assert.equal(results[1], otherCity);
assert.equal(JSON.stringify(otherCity), before);
assert.match(c.els.placeSearchResults.children[0].innerHTML, /검색한 지도 그대로 사용/);
assert.match(c.els.placeSearchResults.children[1].innerHTML, /일본 도쿄 시부야/);

// Real Google results keep their original identity/address as a separate option too.
const googlePlace = { ...otherCity, id: 'google', source: 'google-places', place: '天龍寺',
  location: '교토시 우쿄구 사가텐류지', lat: 35.0158, lon: 135.6738, placeId: 'fixture-place-id' };
const googleResults = c.renderPlaceSearchResults([googlePlace], query, { googleQuery });
assert.equal(googleResults[1], googlePlace);
assert.equal(c.buildGoogleMapPreviewQuery(googlePlace), '35.0158,135.6738');
c.syncGoogleMapsLink(c.buildGoogleMapPreviewQuery(googlePlace), googlePlace);
assert.equal(new URL(c.els.googleMapsLink.href).searchParams.get('query_place_id'), 'fixture-place-id');

// Direct coordinates remain exact, without an added search option.
const direct = c.createCoordinateTextPlaceCandidate('35.0158,135.6738');
const directResults = c.renderPlaceSearchResults([direct], '35.0158,135.6738');
assert.equal(directResults.length, 1);
assert.equal(c.buildGoogleMapPreviewQuery(directResults[0]), '35.0158,135.6738');

// Old synthetic matches can arrive from sync or drafts. Ignore the mismatched
// coordinate and place ID in every navigation path without mutating the record.
const legacy = { place: query, location: googleQuery, mapQuery: googleQuery,
  lat: otherCity.lat, lon: otherCity.lon, coordinateSource: 'map-match', googlePlaceId: 'wrong-city-id' };
legacy.coordinateSignature = c.buildItemCoordinateSignature(legacy);
const originalLegacy = JSON.stringify(legacy);
for (const item of [legacy, { ...legacy, source: 'map-match' }]) {
  assert.equal(c.getBestRouteCoordinates(item), null);
  assert.equal(c.buildGoogleMapPreviewQuery(item), googleQuery);
  assert.equal(c.buildGoogleMapsRouteStopQuery(item), googleQuery);
  c.syncGoogleMapsLink(c.buildGoogleMapPreviewQuery(item), item);
  assert.equal(new URL(c.els.googleMapsLink.href).searchParams.has('query_place_id'), false);
}
assert.equal(JSON.stringify(legacy), originalLegacy);

// Explicitly selected public-provider results survive reload with their precise
// coordinates, while old automatic geocoding remains subject to cleanup.
const normalized = c.normalizePlaceSearchResult({ place_id: 1, name: '天龍寺',
  display_name: '天龍寺, 京都市, 日本', lat: '35.0158', lon: '135.6738', type: 'temple' });
assert.equal(normalized.source, 'nominatim-search');
for (const source of ['nominatim-search', 'knowledge-search', 'google-places', 'coordinate-text']) {
  const item = { ...googlePlace, source: undefined, coordinateSource: source };
  item.coordinateSignature = c.buildItemCoordinateSignature(item);
  assert.equal(c.cleanSavedItineraryCoordinates(item).lat, googlePlace.lat);
  assert.equal(c.buildGoogleMapPreviewQuery(c.cleanSavedItineraryCoordinates(item)), '35.0158,135.6738');
  assert.equal(c.isHighTrustCoordinateSource(source), true);
}
assert.equal(c.cleanSavedItineraryCoordinates({ ...legacy, coordinateSource: 'photon' }).lat, undefined);

// Empty or partial domestic places keep a useful destination; absent/stale
// coordinates must never produce a route to an invented location.
c.state.travelMode = 'domestic'; c.state.city = '서울'; c.state.country = '대한민국';
assert.ok(!c.buildNaverMapsSearchQuery({}).includes('[object Object]'));
assert.match(c.buildNaverMapsSearchQuery({ place: '호텔', location: '서울 종로구 사직로 161' }), /사직로 161/);
const incompleteRoute = c.buildTripMapRouteUrls([{ place: '서울역' }, { place: '경복궁', lat: null, lon: '' }]);
assert.equal(incompleteRoute.isSearchFallback, true);
assert.equal(new URL(incompleteRoute.external).hostname, 'map.naver.com');
assert.ok(incompleteRoute.external.includes(encodeURIComponent('경복궁')));
assert.equal(c.getNaverRouteCoordinates({ lat: 0, lon: 0 }), null);
assert.equal(c.getNaverRouteCoordinates({ lat: 35, lon: 135 }), null);

(async () => {
  // Search-only selections must not acquire another provider's coordinates later.
  assert.equal(await c.fetchLatLngForItineraryItem(legacy), null);
  assert.equal(await c.fetchLatLngForItineraryItem(results[0]), null);
  console.log('PASS: search identity, visible provider address, explicit coordinates, legacy match guards, reload provenance and route consistency');
})().catch(error => { console.error(error); process.exitCode = 1; });
