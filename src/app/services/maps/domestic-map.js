// No API key or billing account. Only the visible map requests public OSM
// tiles; browser cache headers and attribution are preserved, with no prefetch.
const domesticMapViews = new Map();

function setDomesticMapStatus(view) {
  const message = view.tileError ? '지도를 불러오지 못했어요. 연결을 확인하거나 아래 네이버지도 버튼을 이용해 주세요.'
    : view.locating ? '장소 위치를 찾고 있어요…' : !view.tileLoaded ? '지도를 불러오는 중…'
    : view.incomplete ? '확인된 장소를 표시했어요. 일부 장소는 이름이나 주소를 확인해 주세요.' : '';
  view.status.textContent = message; view.status.hidden = !message;
  view.host.dataset.mapState = view.tileError ? 'error' : view.locating || !view.tileLoaded ? 'loading' : 'ready';
  view.host.setAttribute('aria-busy', String(!view.tileError && (view.locating || !view.tileLoaded)));
}

function getDomesticMapView(host) {
  if (domesticMapViews.has(host)) return domesticMapViews.get(host);
  const canvas = document.createElement('div'); canvas.className = 'triplog-domestic-map-canvas';
  canvas.setAttribute('role', 'region'); canvas.setAttribute('aria-label', '장소 지도 · OpenStreetMap');
  const status = document.createElement('p'); status.className = 'triplog-domestic-map-status';
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  host.replaceChildren(canvas, status);
  const view = { host, canvas, status, token: 0, pointKey: '', sizeKey: '', locating: false, incomplete: false, tileError: false, tileLoaded: false };
  domesticMapViews.set(host, view);
  return view;
}

function hideEmbeddedDomesticMap(host) {
  if (!host) return;
  host.hidden = true;
  const view = domesticMapViews.get(host);
  if (view) view.token++;
}

function paintDomesticMap(view, stops) {
  const points = stops.map((stop, index) => ({ ...stop, order: index + 1 })).filter(stop => getNaverRouteCoordinates(stop));
  const key = JSON.stringify(points.map(stop => [stop.place, stop.lat, stop.lon, stop.order]));
  if (view.pointKey === key) return;
  view.pointKey = key; view.markers.clearLayers();
  points.forEach(stop => {
    const label = `${stop.order}. ${stop.place || '선택한 위치'}`;
    const tooltip = document.createElement('span'); tooltip.textContent = label;
    const popup = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = label;
    const link = document.createElement('a'); link.textContent = '네이버지도에서 열기';
    link.href = buildNaverSearchUrl(stop.place || `${stop.lat},${stop.lon}`);
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    popup.append(title, document.createElement('br'), link);
    L.marker([stop.lat, stop.lon], { title: label, alt: label, keyboard: true,
      icon: L.divIcon({ className: 'triplog-domestic-marker', html: `<span class="triplog-domestic-pin">${stop.order}</span>`, iconSize: [30, 34], iconAnchor: [15, 34] }) })
      .bindTooltip(tooltip).bindPopup(popup).addTo(view.markers);
  });
  if (points.length === 1) view.map.setView([points[0].lat, points[0].lon], 14, { animate: false });
  else if (points.length > 1) view.map.fitBounds(points.map(point => [point.lat, point.lon]), { padding: [35, 35], maxZoom: 15, animate: false });
  else view.map.setView([36.2, 127.7], 6, { animate: false });
}

async function renderEmbeddedDomesticMap(host, items, { isCurrent = () => true } = {}) {
  if (!host) return false;
  host.hidden = false;
  const view = getDomesticMapView(host), token = ++view.token;
  const trip = { ...state }, current = () => token === view.token && !host.hidden && isCurrent()
    && state.id === trip.id && isDomesticMapTrip();
  if (!window.L) { view.tileError = true; setDomesticMapStatus(view); return false; }
  if (!view.map) {
    view.map = L.map(view.canvas, { zoomControl: false, scrollWheelZoom: true, zoomAnimation: false,
      fadeAnimation: false, markerZoomAnimation: false, attributionControl: true, trackResize: false });
    L.control.zoom({ zoomInTitle: '지도 확대', zoomOutTitle: '지도 축소' }).addTo(view.map);
    view.markers = L.layerGroup().addTo(view.map);
    view.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
      keepBuffer: 0, updateWhenIdle: true, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' });
    view.tiles.on('tileerror', () => { view.tileError = true; if (!host.hidden) setDomesticMapStatus(view); });
    view.tiles.on('tileload', () => { view.tileLoaded = true; view.tileError = false; if (!host.hidden) setDomesticMapStatus(view); });
    view.observer = new ResizeObserver(() => {
      const key = `${view.canvas.clientWidth},${view.canvas.clientHeight}`;
      if (!view.canvas.clientWidth || !view.canvas.clientHeight || view.sizeKey === key) return;
      view.sizeKey = key; view.map.invalidateSize({ pan: false });
    });
    view.observer.observe(view.canvas);
  }
  view.map.invalidateSize({ pan: false });
  const initial = items.map(item => getDomesticRouteStop(item, trip));
  paintDomesticMap(view, initial);
  if (!view.map.hasLayer(view.tiles)) view.tiles.addTo(view.map);
  view.locating = initial.some(stop => !getNaverRouteCoordinates(stop));
  view.incomplete = false; setDomesticMapStatus(view);
  const result = await resolveDomesticRouteStops(items, trip);
  if (!current()) return false;
  paintDomesticMap(view, result.stops);
  view.locating = false; view.incomplete = !result.complete; setDomesticMapStatus(view);
  return true;
}

window.TripLog.register('services.maps.domesticMap', { renderEmbeddedDomesticMap, hideEmbeddedDomesticMap });
