function isDomesticMapTrip(trip = state) {
  return trip.travelMode !== 'overseas';
}

function getTripMapLabel(trip = state) {
  return isDomesticMapTrip(trip) ? '네이버지도' : 'Google 지도';
}

function buildNaverSearchUrl(query) {
  return `https://map.naver.com/p/search/${encodeURIComponent(String(query || '대한민국').trim())}`;
}

function getNaverRouteCoordinates(item = {}) {
  if ([item.lat, item.lon].some(value => value === '' || value == null)) return null;
  const lat = Number(item.lat), lon = Number(item.lon);
  // Naver routing covers Korea. Never turn a missing coordinate into (0, 0).
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 31.43 && lat <= 44.35 && lon >= 122.37 && lon <= 132
    ? { lat, lon } : null;
}

function buildNaverDirectionsLink(stops, { travelMode = 'driving' } = {}) {
  const destination = stops[stops.length - 1] || {};
  const origin = stops.length > 1 ? stops[0] : null;
  const end = getNaverRouteCoordinates(destination), start = origin && getNaverRouteCoordinates(origin);
  const name = item => String(item.place || item.location || '').trim();
  if (!end || (origin && !start)) {
    return { external: buildNaverSearchUrl(name(destination)), isSearchFallback: true };
  }
  // Naver's web entry point redirects to its current desktop/mobile route UI.
  const url = new URL('https://map.naver.com/index.nhn');
  url.searchParams.set('menu', 'route');
  url.searchParams.set('pathType', travelMode === 'walking' ? '3' : travelMode === 'driving' ? '0' : '1');
  if (start) {
    url.searchParams.set('slng', start.lon); url.searchParams.set('slat', start.lat);
    url.searchParams.set('stext', name(origin) || '출발지');
  }
  url.searchParams.set('elng', end.lon); url.searchParams.set('elat', end.lat);
  url.searchParams.set('etext', name(destination) || '도착지');
  return { external: url.toString(), isSearchFallback: false };
}

function buildTripPlaceSearchUrl(query, trip = state) {
  const text = [query, trip.city, isDomesticMapTrip(trip) ? '' : trip.country].filter(Boolean).join(' ').trim();
  return isDomesticMapTrip(trip) ? buildNaverSearchUrl(text)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

window.TripLog.register('shared.mapLinks', { isDomesticMapTrip, getTripMapLabel, buildNaverSearchUrl,
  getNaverRouteCoordinates, buildNaverDirectionsLink, buildTripPlaceSearchUrl });
