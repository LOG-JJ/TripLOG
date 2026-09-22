// Route lookups are separate from saved place selections. A fresh lookup must
// never graft coordinates onto a legacy search-only item or edit shared data.
const domesticRouteCache = new Map();
const domesticRouteRequests = new Map();

function domesticRouteText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (/^https?:\/\//i.test(text)) return extractNaverMapsPlaceName(text) || extractGoogleMapsPlaceName(text) || '';
  return /^[-–—\s]*$|^(?:(?:식사|숙소)\s*)?(?:장소\s*)?미정$|^주소 미입력$/.test(text) ? '' : text;
}

function domesticRouteContext(item, trip) {
  return domesticRouteText(trip.city) || extractGeocodeContext(trip.tripName || '')
    || extractGeocodeContext(item.location || '');
}

function domesticRouteCacheKey(item, trip = state) {
  return JSON.stringify([trip.id, trip.travelMode, trip.city, trip.country, trip.tripName,
    domesticRouteText(item.place), domesticRouteText(item.location), domesticRouteText(item.mapQuery)]
    .map(value => String(value ?? '').trim()));
}

function getDomesticRouteStop(item, trip = state) {
  const direct = getNaverRouteCoordinates(getBestRouteCoordinates(item, { requireSignature: true }) || {});
  const cached = domesticRouteCache.get(domesticRouteCacheKey(item, trip));
  const coords = direct || (cached && Date.now() - cached.savedAt < 86400000 ? cached.coords : null);
  return { place: domesticRouteText(item.place) || domesticRouteText(item.location) || domesticRouteText(item.mapQuery),
    ...coords };
}

function buildDomesticRouteQueries(item, trip) {
  const place = domesticRouteText(item.place) || domesticRouteText(item.mapQuery);
  const address = domesticRouteText(item.location);
  const context = domesticRouteContext(item, trip);
  const appendContext = value => value && context && !normalizePlaceAlias(value).includes(normalizePlaceAlias(context))
    ? `${value}, ${context}` : value;
  const combined = address && place && !normalizePlaceAlias(address).includes(normalizePlaceAlias(place))
    ? `${place}, ${address}` : address || place;
  return [...new Set([appendContext(combined), appendContext(place || address), place || address].filter(Boolean))].slice(0, 3);
}

function pickDomesticRouteCandidate(candidates, item, trip) {
  const term = domesticRouteText(item.place) || domesticRouteText(item.location) || domesticRouteText(item.mapQuery);
  const key = normalizePlaceAlias(term);
  const context = normalizePlaceAlias(domesticRouteContext(item, trip)).replace(/(?:특별자치도|특별자치시|특별시|광역시|도|시|군)$/, '');
  const matches = candidates.filter(candidate => {
    if (!getNaverRouteCoordinates(candidate) || String(candidate.countrycode).toLowerCase() !== 'kr') return false;
    const names = [candidate.name, ...Object.values(candidate.names || {})].map(normalizePlaceAlias);
    const address = normalizePlaceAlias(candidate.location);
    // Exact names (including provider aliases), or a complete entered address.
    // Do not navigate to a similarly named restaurant or an unrelated city.
    return key && (names.includes(key) || (key.length >= 6 && address.includes(key)))
      && (!context || address.includes(context));
  });
  if (!matches.length) return null;
  const best = matches[0];
  if (matches.some(other => getCoordinateDistanceKm(best, other) > 1)) return null;
  return { lat: best.lat, lon: best.lon, source: best.source, location: best.location };
}

async function lookupDomesticRouteStop(item, trip) {
  const queries = buildDomesticRouteQueries(item, trip);
  if (!queries.length) return null;
  if (typeof hasGoogleGeocodingApiKey === 'function' && hasGoogleGeocodingApiKey()) {
    const candidates = await fetchGooglePlacesTextSearchCandidates(queries[0], { context: domesticRouteContext(item, trip) });
    const google = pickDomesticRouteCandidate(candidates, item, trip);
    if (google) return google;
  }
  for (const query of queries) {
    await waitForNominatimSlot();
    const url = new URL('https://nominatim.openstreetmap.org/search');
    for (const [name, value] of Object.entries({ q: query, format: 'jsonv2', addressdetails: '1', namedetails: '1',
      countrycodes: 'kr', limit: '6', 'accept-language': 'ko' })) url.searchParams.set(name, value);
    const response = await fetchWithTimeout(url.toString(), { headers: { Accept: 'application/json' } }, 6000);
    if (!response.ok) throw new Error('장소 조회 연결 실패');
    const data = await response.json();
    const candidates = (Array.isArray(data) ? data : []).map(row => ({ ...normalizeNominatimResult(row), names: row.namedetails }));
    const result = pickDomesticRouteCandidate(candidates, item, trip);
    if (result) return result;
  }
  return null;
}

async function resolveDomesticRouteStop(item, trip = state) {
  const existing = getDomesticRouteStop(item, trip);
  if (getNaverRouteCoordinates(existing)) return existing;
  const key = domesticRouteCacheKey(item, trip);
  if (!domesticRouteRequests.has(key)) {
    const snapshot = { ...item }, tripSnapshot = { ...trip };
    const request = lookupDomesticRouteStop(snapshot, tripSnapshot).then(coords => {
      if (coords) {
        domesticRouteCache.delete(key);
        domesticRouteCache.set(key, { coords, savedAt: Date.now() });
        if (domesticRouteCache.size > 128) domesticRouteCache.delete(domesticRouteCache.keys().next().value);
      }
      return { place: existing.place, ...coords };
    }).finally(() => domesticRouteRequests.delete(key));
    domesticRouteRequests.set(key, request);
  }
  return domesticRouteRequests.get(key);
}

async function resolveDomesticRouteStops(items, trip = state) {
  const results = await Promise.allSettled(items.map(item => resolveDomesticRouteStop(item, trip)));
  const stops = results.map((result, index) => result.status === 'fulfilled' ? result.value : getDomesticRouteStop(items[index], trip));
  return { stops, complete: stops.every(stop => Boolean(getNaverRouteCoordinates(stop))),
    failed: results.some(result => result.status === 'rejected'),
    attribution: stops.some(stop => stop.source === 'nominatim') };
}

window.TripLog.register('services.maps.domesticRoute', { getDomesticRouteStop, resolveDomesticRouteStop,
  resolveDomesticRouteStops, buildDomesticRouteQueries, pickDomesticRouteCandidate });
