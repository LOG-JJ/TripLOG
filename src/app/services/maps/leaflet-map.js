function initLeafletMap() {
  const container = document.querySelector("#leafletMap");
  if (!container) return;
  
  // Show Leaflet container and hide Google iframe
  container.hidden = false;
  if (els.googleMapFrame) els.googleMapFrame.hidden = true;

  if (leafletMapInstance) {
    // Crucial: Invalidate size to force Leaflet to recalculate dimensions and fetch tiles!
    setTimeout(() => {
      leafletMapInstance.invalidateSize();
    }, 50);
    return;
  }

  // Initialize Map centering on Jeju Island by default
  leafletMapInstance = L.map('leafletMap', {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([33.3616, 126.5292], 10);

  // CartoDB Voyager map tiles: Cream base with colorful road lines, perfectly matching our retro theme!
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(leafletMapInstance);

  leafletMarkersGroup = L.featureGroup().addTo(leafletMapInstance);

  // Crucial: Invalidate size after initial creation too
  setTimeout(() => {
    leafletMapInstance.invalidateSize();
  }, 100);
}

function getRouteGeocodeAnchor(items, currentIndex, resolvedItems, fallbackAnchor = null) {
  const previous = resolvedItems[resolvedItems.length - 1];
  if (previous) return { lat: previous.lat, lon: previous.lon };
  if (fallbackAnchor) return fallbackAnchor;

  for (let i = currentIndex + 1; i < items.length; i++) {
    const coords = getItemLatLng(items[i], { requireSignature: true });
    if (coords) return coords;
  }

  for (let i = 0; i < currentIndex; i++) {
    const coords = getItemLatLng(items[i], { requireSignature: true });
    if (coords) return coords;
  }

  return null;
}

function shouldRefreshCachedRouteCoords(item, coords, { near, context }) {
  if (!coords) return false;
  if (!near || !context) return false;
  const distanceKm = calculateDistanceKm(coords, near);
  if (state.travelMode === "overseas") return distanceKm > 700;
  return distanceKm > 140 || (isPlaceOnlyItineraryItem(item) && distanceKm > 60);
}

function isRouteCoordinateAcceptable(item, coords, { tripAnchor, context }) {
  if (!coords || !isValidLatLng(coords.lat, coords.lon)) return false;
  if (!tripAnchor || !context) return true;
  const distanceFromTripKm = calculateDistanceKm(coords, tripAnchor);
  if (state.travelMode === "overseas") return distanceFromTripKm <= 700;
  if (normalizeGeocodeContext(context).includes("제주")) return distanceFromTripKm <= 130;
  return distanceFromTripKm <= 260;
}

function isPlaceOnlyItineraryItem(item) {
  const place = (item?.place || "").trim();
  const location = (item?.location || "").trim();
  return Boolean(place) && (!location || location === place);
}

function calculateDistanceKm(a, b) {
  if (!a || !b || !isValidLatLng(a.lat, a.lon) || !isValidLatLng(b.lat, b.lon)) return 0;
  const toRadians = (degree) => degree * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

const routeSegmentColors = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
];

function getRouteSegmentColor(index) {
  return routeSegmentColors[index % routeSegmentColors.length];
}

function buildRainbowRouteLayers(routeSegments) {
  const layers = [];

  routeSegments.forEach((segment, index) => {
    const latlngs = segment.latlngs || [];
    if (latlngs.length < 2) return;
    const color = getRouteSegmentColor(index);

    layers.push(L.polyline(latlngs, {
      color: "#ffffff",
      weight: 12,
      opacity: 0.92,
      lineCap: "round",
      lineJoin: "round",
    }));
    layers.push(L.polyline(latlngs, {
      color: "#111827",
      weight: 8,
      opacity: 0.86,
      lineCap: "round",
      lineJoin: "round",
    }));
    layers.push(L.polyline(latlngs, {
      color,
      weight: 5,
      opacity: 0.98,
      lineCap: "round",
      lineJoin: "round",
    }));
  });

  return layers;
}

function groupRouteMarkerItems(validItems) {
  const groups = [];

  validItems.forEach((data, index) => {
    const stopNumber = index + 1;
    const placeKey = normalizePlaceAlias(data.item?.place || "");
    const group = groups.find((candidate) => shouldGroupRouteMarker(candidate, data, placeKey));
    const entry = { ...data, stopNumber };

    if (group) {
      group.entries.push(entry);
      group.lat = group.entries.reduce((sum, item) => sum + item.lat, 0) / group.entries.length;
      group.lon = group.entries.reduce((sum, item) => sum + item.lon, 0) / group.entries.length;
      return;
    }

    groups.push({
      placeKey,
      lat: data.lat,
      lon: data.lon,
      entries: [entry],
    });
  });

  return groups;
}

function shouldGroupRouteMarker(group, data, placeKey) {
  const distanceKm = calculateDistanceKm(group, data);
  if (distanceKm <= 0.025) return true;
  return Boolean(placeKey && group.placeKey === placeKey && distanceKm <= 0.45);
}

function renderRouteMarkers(validItems) {
  groupRouteMarkerItems(validItems).forEach((group) => {
    const marker = L.marker([group.lat, group.lon], {
      icon: buildRouteMarkerIcon(group),
    })
      .bindPopup(buildRouteMarkerPopupHtml(group))
      .addTo(leafletMarkersGroup);
  });
}

function buildRouteMarkerIcon(group) {
  const numbers = group.entries.map((entry) => entry.stopNumber);
  const firstItem = group.entries[0]?.item || {};
  const iconWidth = Math.min(112, Math.max(34, numbers.length * 24 + 14));
  const markerClass = numbers.length > 1 ? "marker-pin marker-pin-cluster" : "marker-pin";
  const html = `
    <div class="${markerClass}" style="background-color: ${getTransitColor(firstItem.trans)};">
      ${numbers.map((number) => `<span class="marker-pin-number">${number}</span>`).join("")}
    </div>
  `;

  return L.divIcon({
    className: numbers.length > 1 ? "leaflet-custom-marker grouped" : "leaflet-custom-marker",
    html,
    iconSize: [iconWidth, 34],
    iconAnchor: [iconWidth / 2, 17],
  });
}

function buildRouteMarkerPopupHtml(group) {
  if (group.entries.length === 1) {
    const entry = group.entries[0];
    const item = entry.item;
    return `
      <div class="map-popup-card">
        <strong class="popup-place">#${entry.stopNumber} ${escapeHtml(item.place)}</strong>
        <span class="popup-time">${item.time ? `⏱️ ${item.time}` : "시간 미정"}</span>
        <p class="popup-location">${escapeHtml(item.location)}</p>
        ${item.memo ? `<p class="popup-memo">📝 ${escapeHtml(item.memo)}</p>` : ""}
      </div>
    `;
  }

  const firstPlace = group.entries[0]?.item?.place || "같은 장소";
  return `
    <div class="map-popup-card map-popup-card-grouped">
      <strong class="popup-place">${escapeHtml(firstPlace)}</strong>
      <p class="popup-location">${escapeHtml(group.entries[0]?.item?.location || "")}</p>
      <ol class="popup-stop-list">
        ${group.entries.map((entry) => {
          const item = entry.item;
          return `
            <li>
              <span class="popup-stop-number">#${entry.stopNumber}</span>
              <span class="popup-time">${item.time ? escapeHtml(item.time) : "시간 미정"}</span>
              ${item.memo ? `<p class="popup-memo">${escapeHtml(item.memo)}</p>` : ""}
            </li>
          `;
        }).join("")}
      </ol>
    </div>
  `;
}

async function renderLeafletRoute(items) {
  initLeafletMap();
  if (!leafletMapInstance) return null;
  const renderToken = ++leafletRenderToken;
  const geocodeContext = buildRouteGeocodeContext(items);
  const tripAnchor = geocodeContext
    ? await fetchLatLngForItineraryItem(buildTripMapFallbackItem(), {
      context: geocodeContext,
      maxQueries: 2,
      ignoreSaved: true,
    })
    : null;
  if (renderToken !== leafletRenderToken) return { cancelled: true };

  // Clear previous layers
  leafletMapInstance.closePopup();
  if (leafletMarkersGroup) leafletMarkersGroup.clearLayers();
  if (leafletRouteLine) {
    leafletMapInstance.removeLayer(leafletRouteLine);
    leafletRouteLine = null;
  }

  const resolvedItems = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const near = getRouteGeocodeAnchor(items, i, resolvedItems, tripAnchor);
    const savedCoords = getItemLatLng(item, { requireSignature: true });
    const coords = await fetchLatLngForItineraryItem(item, {
      context: geocodeContext,
      near,
      maxQueries: 4,
      requireSavedSignature: true,
      ignoreSaved: shouldRefreshCachedRouteCoords(item, savedCoords, { near, context: geocodeContext }),
      allowNominatim: true,
      validateCoords: (candidateCoords, candidateItem) => isRouteCoordinateAcceptable(candidateItem, candidateCoords, { tripAnchor, context: geocodeContext }),
    });
    if (renderToken !== leafletRenderToken) return { cancelled: true };

    if (coords) {
      cacheItemCoordinates(item, coords);
      resolvedItems.push({ item, lat: coords.lat, lon: coords.lon });
    } else {
      resolvedItems.push(null);
    }
  }

  const validItems = resolvedItems.filter(Boolean);

  renderRouteMarkers(validItems);

  const routeResult = validItems.length >= 2
    ? await buildRouteLatLngs(validItems, renderToken)
    : { latlngs: [], segments: [], routedSegments: 0, fallbackSegments: 0 };
  if (routeResult.cancelled) return { cancelled: true };

  const markerLatLngs = validItems.map((data) => [data.lat, data.lon]);
  const routeLatLngs = routeResult.latlngs.length >= 2 ? routeResult.latlngs : markerLatLngs;
  const routeSegments = routeResult.segments?.length > 0
    ? routeResult.segments
    : markerLatLngs.slice(0, -1).map((latlng, index) => ({
      fromIndex: index,
      toIndex: index + 1,
      latlngs: [latlng, markerLatLngs[index + 1]],
      routed: false,
    }));

  if (routeSegments.length > 0) {
    leafletRouteLine = L.layerGroup(buildRainbowRouteLayers(routeSegments)).addTo(leafletMapInstance);
  }

  // Fit bounds so everything fits beautifully on screen
  const boundsLatLngs = routeLatLngs.length > 0 ? routeLatLngs : markerLatLngs;
  if (boundsLatLngs.length > 0) {
    const bounds = L.latLngBounds(boundsLatLngs);
    leafletMapInstance.fitBounds(bounds, { padding: [40, 40] });
  }

  // Save the cached coordinates to state
  if (window.TripLog?.persistence?.stateStorage?.saveStateSilently) {
    window.TripLog.persistence.stateStorage.saveStateSilently();
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  return {
    validStops: validItems.length,
    routedSegments: routeResult.routedSegments,
    fallbackSegments: routeResult.fallbackSegments,
    failedStops: items.length - validItems.length,
  };
}

window.TripLog.register("services.maps.leafletMap", {
  initLeafletMap,
  getRouteGeocodeAnchor,
  shouldRefreshCachedRouteCoords,
  isRouteCoordinateAcceptable,
  isPlaceOnlyItineraryItem,
  calculateDistanceKm,
  routeSegmentColors,
  getRouteSegmentColor,
  buildRainbowRouteLayers,
  groupRouteMarkerItems,
  shouldGroupRouteMarker,
  renderRouteMarkers,
  buildRouteMarkerIcon,
  buildRouteMarkerPopupHtml,
  renderLeafletRoute,
});
