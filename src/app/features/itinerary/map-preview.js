function updateMapPreview(item, { geocodeMissing = true } = {}) {
  // Typing updates the draft only. Search/selection starts the map immediately,
  // and the external link must keep pointing to the map currently on screen.
  if (!geocodeMissing || !document.querySelector('#itineraryEditor')?.open) return;
  renderTripMapPreview(item);
}

function setPrimaryMapLink(url, { query = '', route = false, label = `${getTripMapLabel()}에서 열기` } = {}) {
  const link = els.googleMapsLink; // Keep the existing navigation/draft-restoration hook.
  if (!link) return;
  link.href = url;
  link.removeAttribute('aria-disabled');
  link.dataset.mapQuery = query;
  link.dataset.mapRoute = String(route);
  link.querySelector('span').textContent = label;
}

function buildTripMapRouteUrls(items, options = {}) {
  if (!isDomesticMapTrip()) return { ...buildGoogleMapsRouteUrls(items, options), provider: 'google' };
  const stops = items.map(item => getDomesticRouteStop(item));
  return { ...buildNaverDirectionsLink(stops, options), provider: 'naver',
    attribution: stops.some(stop => stop.source === 'nominatim') };
}

function showNaverMapPreview(items, { route = false } = {}) {
  leafletRenderToken++;
  const frame = els.googleMapFrame;
  frame.hidden = true;
  frame.removeAttribute('src');
  frame.setAttribute('aria-busy', 'false');
  document.querySelector('#leafletMap').hidden = true;
  document.querySelector('#itineraryMapEmpty').hidden = true;
  const panel = document.querySelector('#naverMapPreview');
  panel.parentElement.classList.add('has-domestic-map');
  panel.hidden = !route;
  panel.setAttribute('aria-busy', 'false');
  const heading = document.createElement('strong');
  heading.textContent = route ? '네이버지도로 동선 확인' : items[0]?.place || buildNaverMapsSearchQuery(items[0]);
  const note = document.createElement('p');
  note.textContent = route ? '이동할 구간을 선택하면 네이버지도로 연결돼요.' : '장소 정보와 길찾기를 네이버지도에서 확인하세요.';
  panel.replaceChildren(heading, note);
  if (route) {
    const list = document.createElement('ol');
    items.forEach((item, index) => {
      const row = document.createElement('li');
      const link = document.createElement('a');
      const urls = index ? buildTripMapRouteUrls([items[index - 1], item]) : null;
      link.href = urls?.external || buildNaverMapsSearchUrl(item);
      link.textContent = `${index + 1}. ${item.place || buildNaverMapsSearchQuery(item)}${index ? (urls.isSearchFallback ? ' · 장소 검색' : ' · 길찾기') : ''}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      row.appendChild(link); list.appendChild(row);
    });
    panel.appendChild(list);
    if (items.some(item => getDomesticRouteStop(item).source === 'nominatim')) {
      const credit = document.createElement('small');
      credit.append('장소 데이터 © ');
      const link = document.createElement('a');
      link.href = 'https://www.openstreetmap.org/copyright'; link.textContent = 'OpenStreetMap';
      link.target = '_blank'; link.rel = 'noopener noreferrer'; credit.appendChild(link); panel.appendChild(credit);
    }
  }
  const token = leafletRenderToken;
  renderEmbeddedDomesticMap(document.querySelector('#itineraryDomesticMap'), items, {
    isCurrent: () => token === leafletRenderToken && Boolean(document.querySelector('#itineraryEditor')?.open),
  });
}

function renderTripMapPreview(item = {}, query = '') {
  if (!isDomesticMapTrip()) { renderGoogleMapPreview(item, query); return; }
  const search = buildNaverMapsSearchQuery(item.place || item.location || item.mapQuery ? item : query);
  showNaverMapPreview([item]);
  const coords = getBestRouteCoordinates(item, { requireSignature: true });
  const coordinateOnly = (!item.place || item.place === '지도 좌표') && getNaverRouteCoordinates(coords || {});
  const external = coordinateOnly ? buildNaverDirectionsLink([{ place: '선택한 위치', ...coords }]).external : buildNaverSearchUrl(search);
  setPrimaryMapLink(external, { query: coordinateOnly ? `${coords.lat},${coords.lon}` : search });
  syncNaverMapsLink(search);
  els.mapCurrentLabel.textContent = '장소 지도';
  els.mapCurrentPlace.textContent = item.place || search;
}

function renderTripMapRoute(items) {
  if (!items.length) return;
  if (!isDomesticMapTrip()) { renderGoogleMapRoute(items); return; }
  if (items.length === 1) { renderTripMapPreview(items[0]); return; }
  showNaverMapPreview(items, { route: true });
  // Public transit has no waypoints: keep every adjacent segment available.
  const urls = buildTripMapRouteUrls(items.slice(0, 2));
  setPrimaryMapLink(urls.external, { route: true,
    label: urls.isSearchFallback ? '네이버지도에서 장소 확인' : '네이버지도에서 첫 구간 길찾기' });
  syncNaverMapsLink(items[0]);
  els.mapCurrentLabel.textContent = '전체 동선 지도';
  els.mapCurrentPlace.textContent = `${items.length}개 장소`;
  if (items.every(item => getNaverRouteCoordinates(getDomesticRouteStop(item)))) return;
  const token = leafletRenderToken, tripId = state.id;
  const panel = document.querySelector('#naverMapPreview');
  panel.setAttribute('aria-busy', 'true');
  panel.querySelector('p').textContent = '등록한 장소의 위치를 찾아 구간별 길찾기를 준비하고 있어요.';
  // Keep unresolved links inert while locating them, including the main link.
  if (urls.isSearchFallback) {
    els.googleMapsLink.removeAttribute('href');
    els.googleMapsLink.setAttribute('aria-disabled', 'true');
    els.googleMapsLink.querySelector('span').textContent = '장소 위치 확인 중…';
  }
  panel.querySelectorAll('ol a').forEach((link, index) => {
    if (index && buildTripMapRouteUrls([items[index - 1], items[index]]).isSearchFallback) link.removeAttribute('href');
  });
  resolveDomesticRouteStops(items).then(result => {
    if (token !== leafletRenderToken || tripId !== state.id || !isDomesticMapTrip() || !document.querySelector('#itineraryEditor')?.open) return;
    showNaverMapPreview(items, { route: true });
    const ready = buildTripMapRouteUrls(items.slice(0, 2));
    setPrimaryMapLink(ready.external, { route: true,
      label: ready.isSearchFallback ? '네이버지도에서 장소 확인' : '네이버지도에서 첫 구간 길찾기' });
    if (!result.complete) panel.querySelector('p').textContent = '일부 장소의 위치를 찾지 못했어요. 해당 장소의 이름이나 주소를 확인해 주세요.';
  });
}

function buildGoogleMapPreviewQuery(item = {}, fallback = '') {
  const coords = extractLatLngFromItineraryItem(item)
    || getItemLatLng(item, { requireSignature: !item.source });
  if (coords) return formatLatLngForQuery(coords);
  const mapQuery = String(item.mapQuery || fallback || '').trim();
  if (/^https?:\/\//i.test(mapQuery)) {
    try {
      const url = new URL(mapQuery);
      const search = url.searchParams.get('query') || url.searchParams.get('q');
      if (search) return buildGoogleMapsSearchQuery(appendTripDestinationContext(search));
    } catch (_) { /* Use the saved place/address below. */ }
    const place = extractGoogleMapsPlaceName(mapQuery) || item.place;
    return buildGoogleMapsSearchQuery(buildMapQuery({ ...item, place }));
  }
  return buildGoogleMapsSearchQuery(mapQuery || buildMapQuery(item));
}

function showGoogleMapFrame(url) {
  leafletRenderToken++;
  hideEmbeddedDomesticMap(document.querySelector('#itineraryDomesticMap'));
  document.querySelector('.map-frame-wrap').classList.remove('has-domestic-map');
  document.querySelector('#naverMapPreview').hidden = true;
  const leafletContainer = document.querySelector("#leafletMap");
  if (leafletContainer) leafletContainer.hidden = true;
  const frame = els.googleMapFrame;
  if (!frame) return;
  document.querySelector('#itineraryMapEmpty').hidden = true;
  frame.hidden = false;
  if (frame.getAttribute('src') === url) return;
  frame.setAttribute('aria-busy', 'true');
  frame.src = url;
}

function renderGoogleMapPreview(item, query = '') {
  const googleQuery = buildGoogleMapPreviewQuery(item, query);
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(googleQuery)}&output=embed&hl=ko`;
  showGoogleMapFrame(embedUrl);
  syncGoogleMapsLink(googleQuery, item);
  setPrimaryMapLink(els.googleMapsLink.href, { query: googleQuery });
  syncNaverMapsLink(item);
  els.mapCurrentLabel.textContent = "Google 지도";
  els.mapCurrentPlace.textContent = item.place || googleQuery;
}

function renderGoogleMapRoute(items) {
  if (!items.length) return;
  if (items.length === 1) { renderGoogleMapPreview(items[0]); return; }
  const urls = buildGoogleMapsRouteUrls(items);
  showGoogleMapFrame(urls.embed);
  setPrimaryMapLink(urls.external, { route: true });
  syncNaverMapsLink(buildNaverMapsRouteSearchQuery(items));
  els.mapCurrentLabel.textContent = 'Google 지도 전체 동선';
  els.mapCurrentPlace.textContent = `${items.length}개 장소`;
}

function syncGoogleMapsLink(query, item = {}) {
  if (!els.googleMapsLink) return;
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', buildGoogleMapsSearchQuery(query));
  const placeId = isGoogleSearchOnlyItem(item) ? "" : item.googlePlaceId || item.placeId;
  if (placeId) url.searchParams.set('query_place_id', placeId);
  els.googleMapsLink.href = url.toString();
}

function syncNaverMapsLink(query = "") {
  if (!els.naverMapsLink) return;
  const isDomestic = state.travelMode !== "overseas";
  els.naverMapsLink.hidden = !isDomestic;
  if (!isDomestic) return;
  els.naverMapsLink.href = buildNaverMapsSearchUrl(query);
}

function buildNaverMapsSearchUrl(query = "") {
  return buildNaverSearchUrl(buildNaverMapsSearchQuery(query));
}

function buildNaverMapsSearchQuery(query = "") {
  if (query && typeof query === "object") {
    const itemQuery = buildNaverMapsItemSearchQuery(query);
    return itemQuery || buildTripDestinationQuery() || '대한민국';
  }

  const cleanQuery = cleanNaverMapsSearchText(query);
  const extractedNaverPlace = extractNaverMapsPlaceName(cleanQuery);
  const extractedPlace = typeof extractGoogleMapsPlaceName === "function"
    ? extractGoogleMapsPlaceName(cleanQuery)
    : "";
  return extractedNaverPlace
    || extractedPlace
    || stripNaverMapsTripContext(cleanQuery)
    || buildTripDestinationQuery()
    || "대한민국";
}

function buildNaverMapsRouteSearchQuery(items = []) {
  const routeQueries = items
    .map(buildNaverMapsItemSearchQuery)
    .filter(Boolean);
  return routeQueries.join(" ");
}

function buildNaverMapsItemSearchQuery(item = {}) {
  const placeFromNaverUrl = extractNaverMapsPlaceName(item.mapQuery);
  const placeFromGoogleUrl = typeof extractGoogleMapsPlaceName === "function"
    ? extractGoogleMapsPlaceName(item.mapQuery)
    : "";
  const place = cleanNaverMapsSearchText(placeFromNaverUrl || placeFromGoogleUrl || item.place);
  const address = cleanNaverMapsSearchText(item.location);
  if (place) {
    if (address && address !== place && !/^https?:|^위도 /i.test(address)) {
      return address.includes(place) ? address : `${place} ${address}`;
    }
    const city = cleanNaverMapsSearchText(state.city);
    return city && !place.includes(city) ? `${place} ${city}` : place;
  }

  return address
    || cleanNaverMapsSearchText(item.mapQuery)
    || "";
}

function extractNaverMapsPlaceName(value = "") {
  const decoded = decodeCoordinateText(String(value || ""));
  const placeMatch = decoded.match(/map\.naver\.com\/p\/search\/([^?#]+)/i);
  if (!placeMatch?.[1]) return "";
  return cleanNaverMapsSearchText(decodeCoordinateText(placeMatch[1]));
}

function cleanNaverMapsSearchText(value = "") {
  return decodeCoordinateText(String(value || ""))
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNaverMapsTripContext(value = "") {
  let cleanQuery = cleanNaverMapsSearchText(value);
  const context = typeof buildTripDestinationQuery === "function"
    ? cleanNaverMapsSearchText(buildTripDestinationQuery())
    : "";
  if (!cleanQuery || !context) return cleanQuery;

  cleanQuery = cleanQuery.replace(new RegExp(`\\s+${escapeRegExp(context)}$`, "i"), "").trim();
  context.split(" ").filter(Boolean).reverse().forEach((part) => {
    cleanQuery = cleanQuery.replace(new RegExp(`\\s+${escapeRegExp(part)}$`, "i"), "").trim();
  });

  return cleanQuery;
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildGoogleMapsRouteUrls(items, { travelMode } = {}) {
  const queries = items.map(buildGoogleMapsRouteStopQuery).filter(Boolean);
  const origin = queries[0] || "대한민국";
  const destination = queries[queries.length - 1] || origin;
  const waypoints = queries.slice(1, -1);

  const external = new URL("https://www.google.com/maps/dir/");
  external.searchParams.set("api", "1");
  external.searchParams.set("origin", origin);
  external.searchParams.set("destination", destination);
  const mode = ['transit', 'walking'].includes(travelMode) ? travelMode : '';
  if (mode) external.searchParams.set('travelmode', mode);
  if (waypoints.length > 0) {
    external.searchParams.set("waypoints", waypoints.join("|"));
  }

  const embed = new URL("https://www.google.com/maps");
  embed.searchParams.set("f", "d");
  embed.searchParams.set("source", "s_d");
  embed.searchParams.set("saddr", origin);
  embed.searchParams.set("daddr", [...waypoints, destination].join(" to:"));
  embed.searchParams.set("hl", "ko");
  embed.searchParams.set("output", "embed");
  // Key-free directions embed, with an official Maps URL as the fallback.
  if (mode) embed.searchParams.set('dirflg', mode === 'walking' ? 'w' : 'r');

  return {
    embed: embed.toString(),
    external: external.toString(),
  };
}

function buildGoogleMapsRouteStopQuery(item) {
  if (isGoogleSearchOnlyItem(item)) return buildGoogleMapPreviewQuery(item);
  const coords = getBestRouteCoordinates(item, { requireSignature: true });
  return formatLatLngForQuery(coords) || buildCleanRouteQuery(item);
}

function buildGoogleMapsSearchQuery(query) {
  const coords = extractLatLngFromText(query);
  if (coords) return formatLatLngForQuery(coords);

  const cleanQuery = (query || "").replace(/\s+/g, " ").trim();
  if (!cleanQuery) return "대한민국";
  return cleanQuery;
}

function buildGoogleMapsSearchContext() {
  return buildTripDestinationQuery()
    || extractGeocodeContext(state.tripName)
    || extractGeocodeContext(state.itineraryItems.find((item) => item.location)?.location)
    || "";
}

function buildGoogleCandidateId(query) {
  return `google-query:${query}`;
}

function renderSingleLeafletMarker(item, lat, lon) {
  if (!leafletMapInstance) return;
  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  if (!isValidLatLng(parsedLat, parsedLon)) return;

  const pinIcon = L.divIcon({
    className: 'itinerary-numbered-pin active',
    html: '<span aria-hidden="true"></span>',
    iconSize: [34, 42],
    iconAnchor: [17, 42]
  });

  const marker = L.marker([parsedLat, parsedLon], { icon: pinIcon, title: item.place || "선택된 위치" })
    .bindPopup(`
      <div class="map-popup-card">
        <strong class="popup-place">${escapeHtml(item.place || "선택된 위치")}</strong>
        <p class="popup-location">${escapeHtml(item.location || "")}</p>
      </div>
    `)
    .addTo(leafletMarkersGroup);

  leafletMapInstance.setView([parsedLat, parsedLon], 14);
  marker.openPopup();
}

function buildMapQuery(item) {
  const query = Array.from(new Set([item.place, item.location].filter(Boolean))).join(" ").trim();
  return appendTripDestinationContext(query) || "대한민국";
}


window.TripLog.register("features.itinerary.mapPreview", {
  updateMapPreview,
  renderTripMapPreview,
  renderTripMapRoute,
  buildTripMapRouteUrls,
  renderGoogleMapPreview,
  buildGoogleMapPreviewQuery,
  renderGoogleMapRoute,
  buildGoogleMapsRouteUrls,
  buildGoogleMapsRouteStopQuery,
  buildGoogleMapsSearchQuery,
  buildGoogleMapsSearchContext,
  buildGoogleCandidateId,
  syncNaverMapsLink,
  buildNaverMapsSearchUrl,
  buildNaverMapsSearchQuery,
  buildNaverMapsRouteSearchQuery,
  renderSingleLeafletMarker,
  buildMapQuery,
});
