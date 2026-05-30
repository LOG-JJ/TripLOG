function buildCleanRouteQuery(item) {
  if (!item) return "대한민국";
  let place = (item.place || "").trim();
  let location = (item.location || "").trim();
  
  if (!place && !location) return "대한민국";
  if (place && !location) return place;
  if (!place && location) return simplifyAddress(location);
  
  if (place.includes("로 ") || place.includes("길 ") || place.includes("동 ")) {
    return simplifyAddress(place);
  }
  
  const simpleAddr = simplifyAddress(location);
  if (simpleAddr.includes(place) || place.includes(simpleAddr)) {
    return simpleAddr;
  }
  
  return `${place} ${simpleAddr}`;
}

function simplifyAddress(addr) {
  return addr
    .replace(/제주특별자치도/g, "제주")
    .replace(/특별자치도/g, "")
    .replace(/대한민국/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 3) // restrict to max 3 parts to prevent address query bloating and calculation failure
    .join(" ");
}

function buildGeocodeQueries(item, context = "") {
  const queries = [];
  const contextHint = normalizeGeocodeContext(context);
  const addQuery = (value) => {
    const normalized = (value || "").replace(/\s+/g, " ").trim();
    if (!normalized || normalized === "대한민국" || queries.includes(normalized)) return;
    queries.push(normalized);
  };

  if (contextHint) {
    addQuery([item?.place, contextHint].filter(Boolean).join(" "));
    addQuery([item?.location, contextHint].filter(Boolean).join(" "));
  }
  addQuery(buildMapQuery(item));
  addQuery([item?.place, item?.location].filter(Boolean).join(", "));
  addQuery(buildCleanRouteQuery(item));
  addQuery(item?.location);
  addQuery(item?.place);
  addQuery(simplifyAddress(item?.location || ""));

  return queries;
}

function buildRouteGeocodeContext(items = []) {
  return [
    state.tripName,
    ...items.map((item) => item.location),
    ...state.itineraryItems.map((item) => item.location),
  ].map(extractGeocodeContext).find(Boolean) || "";
}

function extractGeocodeContext(value) {
  const normalized = normalizeGeocodeContext(value);
  if (!normalized) return "";

  const knownRegions = [
    "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "제주",
    "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남",
    "충청북도", "충청남도", "전라북도", "전라남도", "경상북도", "경상남도",
  ];
  const matchedRegion = knownRegions.find((region) => normalized.includes(region));
  if (matchedRegion) return matchedRegion;

  const firstAddressPart = simplifyAddress(normalized).split(" ")[0] || "";
  if (/^[가-힣]{2,}(시|군|구|도)$/.test(firstAddressPart)) return firstAddressPart;
  return "";
}

function normalizeGeocodeContext(value) {
  return (value || "")
    .replace(/국내여행|해외여행|국내 여행|해외 여행|여행|일정|가계부/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getItemLatLng(item) {
  const lat = Number.parseFloat(item?.lat);
  const lon = Number.parseFloat(item?.lon);
  if (!isValidLatLng(lat, lon)) return null;
  return { lat, lon };
}

function isValidLatLng(lat, lon) {
  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && Math.abs(lat) <= 90
    && Math.abs(lon) <= 180;
}

function cacheItemCoordinates(item, coords) {
  if (!item || !coords || !isValidLatLng(coords.lat, coords.lon)) return;
  item.lat = coords.lat;
  item.lon = coords.lon;

  const savedItem = item.id ? findItineraryItem(item.id) : null;
  if (savedItem && savedItem !== item) {
    savedItem.lat = coords.lat;
    savedItem.lon = coords.lon;
  }
}

async function fetchLatLngForItineraryItem(item, { maxQueries = Infinity, context = "", near = null, ignoreSaved = false, allowNominatim = true } = {}) {
  const savedCoords = getItemLatLng(item);
  if (savedCoords && !ignoreSaved) return savedCoords;

  const knownCoords = findKnownPlaceCoordinates(item, context);
  if (knownCoords) return knownCoords;

  for (const query of buildGeocodeQueries(item, context).slice(0, maxQueries)) {
    const cachedCoords = getCachedGeocodeResult(query, context);
    if (cachedCoords) return cachedCoords;

    const photonCoords = await fetchLatLngFromPhoton(query, { context, near });
    if (photonCoords) {
      setCachedGeocodeResult(query, context, photonCoords);
      return photonCoords;
    }
  }

  if (!allowNominatim) return null;

  for (const query of buildGeocodeQueries(item, context).slice(0, maxQueries)) {
    const boundedCoords = near ? await fetchLatLngFromNominatim(query, { near, bounded: true }) : null;
    if (boundedCoords) {
      setCachedGeocodeResult(query, context, boundedCoords);
      return boundedCoords;
    }

    const coords = await fetchLatLngFromNominatim(query);
    if (coords) {
      setCachedGeocodeResult(query, context, coords);
      return coords;
    }
  }

  return null;
}

function findKnownPlaceCoordinates(item, context = "") {
  const haystack = normalizePlaceAlias([item?.place, item?.location, context].filter(Boolean).join(" "));
  if (!haystack) return null;

  const matched = knownPlaceCoordinates.find((entry) => {
    const contextMatched = !entry.context || haystack.includes(normalizePlaceAlias(entry.context));
    const aliasMatched = entry.aliases.some((alias) => haystack.includes(normalizePlaceAlias(alias)));
    return contextMatched && aliasMatched;
  });

  return matched ? { lat: matched.lat, lon: matched.lon } : null;
}

function normalizePlaceAlias(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[\s.,()\-_/·'"`]+/g, "")
    .trim();
}

function buildGeocodeCacheKey(query, context = "") {
  return `${normalizePlaceAlias(context)}::${normalizePlaceAlias(query)}`;
}

function getCachedGeocodeResult(query, context = "") {
  return geocodeResultCache.get(buildGeocodeCacheKey(query, context)) || null;
}

function setCachedGeocodeResult(query, context, coords) {
  if (!coords || !isValidLatLng(coords.lat, coords.lon)) return;
  geocodeResultCache.set(buildGeocodeCacheKey(query, context), coords);
}

window.TripLog.register("services.maps.queryUtils", {
  buildCleanRouteQuery,
  simplifyAddress,
  buildGeocodeQueries,
  buildRouteGeocodeContext,
  extractGeocodeContext,
  normalizeGeocodeContext,
  getItemLatLng,
  isValidLatLng,
  cacheItemCoordinates,
  fetchLatLngForItineraryItem,
  findKnownPlaceCoordinates,
  normalizePlaceAlias,
  buildGeocodeCacheKey,
  getCachedGeocodeResult,
  setCachedGeocodeResult,
});
