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
    const coords = getItemLatLng(items[i]);
    if (coords) return coords;
  }

  for (let i = 0; i < currentIndex; i++) {
    const coords = getItemLatLng(items[i]);
    if (coords) return coords;
  }

  return null;
}

function shouldRefreshCachedRouteCoords(item, coords, { near, context }) {
  if (!coords || !near || !context) return false;
  const distanceKm = calculateDistanceKm(coords, near);
  if (state.travelMode === "overseas") return distanceKm > 700;
  return isPlaceOnlyItineraryItem(item) && distanceKm > 160;
}

function isRouteCoordinateAcceptable(item, coords, { tripAnchor, context }) {
  if (!coords || !isValidLatLng(coords.lat, coords.lon)) return false;
  if (!tripAnchor || !context || state.travelMode !== "overseas" || !isPlaceOnlyItineraryItem(item)) return true;
  return calculateDistanceKm(coords, tripAnchor) <= 700;
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
  if (leafletMarkersGroup) leafletMarkersGroup.clearLayers();
  if (leafletRouteLine) {
    leafletMapInstance.removeLayer(leafletRouteLine);
    leafletRouteLine = null;
  }

  const resolvedItems = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const near = getRouteGeocodeAnchor(items, i, resolvedItems, tripAnchor);
    const savedCoords = getItemLatLng(item);
    const coords = await fetchLatLngForItineraryItem(item, {
      context: geocodeContext,
      near,
      maxQueries: 4,
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

  // Draw markers sequentially with sequential numbering
  validItems.forEach((data, index) => {
    const { item, lat, lon } = data;
    
    // Create a gorgeous custom numbered circle tag
    const numberIcon = L.divIcon({
      className: 'leaflet-custom-marker',
      html: `<div class="marker-pin" style="background-color: ${getTransitColor(item.trans)};">${index + 1}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([lat, lon], { icon: numberIcon })
      .bindPopup(`
        <div class="map-popup-card">
          <strong class="popup-place">${escapeHtml(item.place)}</strong>
          <span class="popup-time">${item.time ? `⏱️ ${item.time}` : '시간 미정'}</span>
          <p class="popup-location">${escapeHtml(item.location)}</p>
          ${item.memo ? `<p class="popup-memo">📝 ${escapeHtml(item.memo)}</p>` : ''}
        </div>
      `)
      .addTo(leafletMarkersGroup);
  });

  const routeResult = validItems.length >= 2
    ? await buildRouteLatLngs(validItems, renderToken)
    : { latlngs: [], routedSegments: 0, fallbackSegments: 0 };
  if (routeResult.cancelled) return { cancelled: true };

  const markerLatLngs = validItems.map((data) => [data.lat, data.lon]);
  const routeLatLngs = routeResult.latlngs.length >= 2 ? routeResult.latlngs : markerLatLngs;

  if (routeLatLngs.length >= 2) {
    const routeCasing = L.polyline(routeLatLngs, {
      color: '#ffffff',
      weight: 11,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    });
    const routeBase = L.polyline(routeLatLngs, {
      color: '#111827',
      weight: 7,
      opacity: 0.96,
      lineCap: 'round',
      lineJoin: 'round'
    });
    const routeAccent = L.polyline(routeLatLngs, {
      color: '#f43f5e',
      weight: 3,
      opacity: 0.98,
      dashArray: '12, 8',
      lineCap: 'round',
      lineJoin: 'round'
    });
    leafletRouteLine = L.layerGroup([routeCasing, routeBase, routeAccent]).addTo(leafletMapInstance);
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
  renderLeafletRoute,
});
