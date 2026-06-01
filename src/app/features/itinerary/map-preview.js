function updateMapPreview(item, { geocodeMissing = true, useGoogleMap = false } = {}) {
  const query = buildMapQuery(item);
  const googleQuery = item.mapQuery || buildGoogleMapsSearchQuery(query);
  els.googleMapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleQuery)}`;
  els.mapCurrentLabel.textContent = item.location ? item.location : "위치 미입력";
  els.mapCurrentPlace.textContent = item.place || query;
  const renderToken = ++leafletRenderToken;

  const isGoogleQueryPreview = item.source === "google-query-preview"
    || item.coordinateSource === "google-query-preview";
  const directTextCoords = extractLatLngFromItineraryItem(item);
  const candidateCoords = item.source ? getItemLatLng(item, { requireSignature: false }) : null;
  const savedCoords = directTextCoords || candidateCoords || (isGoogleQueryPreview ? null : getItemLatLng(item, { requireSignature: true }));
  if (savedCoords) cacheItemCoordinates(item, savedCoords);

  if (useGoogleMap || isGoogleQueryPreview || item.source === "google-query") {
    if (!savedCoords) {
      renderGoogleMapPreview(item, googleQuery);
      return;
    }
  }

  if (!savedCoords && !geocodeMissing) {
    els.mapCurrentLabel.textContent = "검색 버튼을 누르면 지도에 표시됩니다";
    els.mapCurrentPlace.textContent = item.place || query;
    return;
  }

  initLeafletMap();
  if (!leafletMapInstance) return;

  // Clear previous layers
  if (leafletMarkersGroup) leafletMarkersGroup.clearLayers();
  if (leafletRouteLine) {
    leafletMapInstance.removeLayer(leafletRouteLine);
    leafletRouteLine = null;
  }

  if (!savedCoords) {
    fetchLatLngForItineraryItem(item, { maxQueries: 2, requireSavedSignature: true }).then(coords => {
      if (renderToken !== leafletRenderToken) return;
      if (coords) {
        cacheItemCoordinates(item, coords);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderSingleLeafletMarker(item, coords.lat, coords.lon);
        return;
      }

      renderGoogleMapPreview({
        ...item,
        source: "google-query-preview",
        mapQuery: googleQuery,
      }, googleQuery);
    });
  } else {
    renderSingleLeafletMarker(item, savedCoords.lat, savedCoords.lon);
  }
}

function renderGoogleMapPreview(item, googleQuery) {
  leafletRenderToken++;
  const leafletContainer = document.querySelector("#leafletMap");
  if (leafletMarkersGroup) leafletMarkersGroup.clearLayers();
  if (leafletRouteLine && leafletMapInstance) {
    leafletMapInstance.removeLayer(leafletRouteLine);
    leafletRouteLine = null;
  }

  if (leafletContainer) leafletContainer.hidden = true;
  if (els.googleMapFrame) {
    els.googleMapFrame.hidden = false;
    const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(googleQuery)}&output=embed`;
    if (els.googleMapFrame.src !== embedUrl) els.googleMapFrame.src = embedUrl;
  }

  els.googleMapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleQuery)}`;
  els.mapCurrentLabel.textContent = "구글맵 검색 위치";
  els.mapCurrentPlace.textContent = item.place || googleQuery;
}

function buildGoogleMapsRouteUrls(items) {
  const queries = items.map((item) => buildCleanRouteQuery(item)).filter(Boolean);
  const origin = queries[0] || "대한민국";
  const destination = queries[queries.length - 1] || origin;
  const waypoints = queries.slice(1, -1);

  const external = new URL("https://www.google.com/maps/dir/");
  external.searchParams.set("api", "1");
  external.searchParams.set("origin", origin);
  external.searchParams.set("destination", destination);
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

  return {
    embed: embed.toString(),
    external: external.toString(),
  };
}

function buildGoogleMapsSearchQuery(query) {
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
    className: 'leaflet-custom-marker-single',
    html: `<div class="marker-pin-single">📍</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const marker = L.marker([parsedLat, parsedLon], { icon: pinIcon })
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
  renderGoogleMapPreview,
  buildGoogleMapsRouteUrls,
  buildGoogleMapsSearchQuery,
  buildGoogleMapsSearchContext,
  buildGoogleCandidateId,
  renderSingleLeafletMarker,
  buildMapQuery,
});
