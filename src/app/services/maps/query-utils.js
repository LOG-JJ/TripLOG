function buildCleanRouteQuery(item) {
  if (!item) return buildTripDestinationQuery() || "대한민국";
  let place = (item.place || "").trim();
  let location = (item.location || "").trim();
  
  if (!place && !location) return "대한민국";
  if (place && !location) return appendTripDestinationContext(place);
  if (!place && location) return appendTripDestinationContext(simplifyAddress(location));
  
  if (place.includes("로 ") || place.includes("길 ") || place.includes("동 ")) {
    return appendTripDestinationContext(simplifyAddress(place));
  }
  
  const simpleAddr = simplifyAddress(location);
  if (simpleAddr.includes(place) || place.includes(simpleAddr)) {
    return appendTripDestinationContext(simpleAddr);
  }
  
  return appendTripDestinationContext(`${place} ${simpleAddr}`);
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
  const contextHint = normalizeGeocodeContext(context) || buildTripDestinationQuery();
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
  const tripDestination = buildTripDestinationQuery();
  if (tripDestination) return tripDestination;

  return [
    state.tripName,
    ...items.map((item) => item.location),
    ...state.itineraryItems.map((item) => item.location),
  ].map(extractGeocodeContext).find(Boolean) || "";
}

function buildTripDestinationQuery() {
  const city = normalizeTripDestinationPart(state.city);
  const country = normalizeTripDestinationPart(state.country);
  const parts = [];

  [city, country].forEach((part) => {
    if (part && !parts.some((existing) => normalizePlaceAlias(existing) === normalizePlaceAlias(part))) {
      parts.push(part);
    }
  });

  if (parts.length > 0) return parts.join(" ");
  return parseDestinationFromTripName(state.tripName);
}

function buildTripMapFallbackItem() {
  const destinationQuery = buildTripDestinationQuery();
  const parsedTripDestination = parseDestinationFromTripName(state.tripName);
  const place = normalizeTripDestinationPart(state.city)
    || normalizeTripDestinationPart(state.country)
    || parsedTripDestination
    || state.tripName
    || getDefaultTripName();

  return {
    place,
    location: destinationQuery || place || "대한민국",
    mapQuery: destinationQuery || place || "대한민국",
  };
}

function appendTripDestinationContext(query, context = buildTripDestinationQuery()) {
  const normalizedQuery = (query || "").replace(/\s+/g, " ").trim();
  const normalizedContext = normalizeGeocodeContext(context);
  if (!normalizedQuery) return normalizedContext || "대한민국";
  if (!normalizedContext) return normalizedQuery;

  const queryKey = normalizePlaceAlias(normalizedQuery);
  const missingContextParts = normalizedContext
    .split(" ")
    .filter(Boolean)
    .filter((part) => !queryKey.includes(normalizePlaceAlias(part)));

  if (missingContextParts.length === 0) return normalizedQuery;
  return `${normalizedQuery} ${missingContextParts.join(" ")}`.replace(/\s+/g, " ").trim();
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
  return parseDestinationFromTripName(normalized);
}

function normalizeGeocodeContext(value) {
  return (value || "")
    .replace(/국내여행|해외여행|국내 여행|해외 여행|여행|일정|가계부/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTripDestinationPart(value) {
  const normalized = normalizeGeocodeContext(value)
    .replace(/^(국가|도시)$/g, "")
    .trim();
  if (!normalized || (typeof isLegacyDefaultTripName === "function" && isLegacyDefaultTripName(normalized))) return "";
  return normalized;
}

function parseDestinationFromTripName(value) {
  const normalized = normalizeGeocodeContext(value)
    .replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, " ")
    .replace(/\d+\s*박\s*\d+\s*일/g, " ")
    .replace(/\d+\s*일/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[~–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || /^(나의|새로운|기존|첫|국내|해외)$/i.test(normalized)) return "";
  return normalized.split(" ").filter(Boolean).slice(0, 2).join(" ");
}

function extractLatLngFromText(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const text = decodeCoordinateText(raw).replace(/\+/g, " ");
  const labeled = extractLabeledLatLng(text);
  if (labeled) return labeled;

  const pairPatterns = [
    /!3d([+-]?\d{1,3}(?:\.\d+)?)!4d([+-]?\d{1,3}(?:\.\d+)?)/i,
    /@([+-]?\d{1,3}(?:\.\d+)?),\s*([+-]?\d{1,3}(?:\.\d+)?)/,
    /(?:[?&#]|^)(?:q|query|ll|center|destination|origin|daddr|saddr)=([+-]?\d{1,3}(?:\.\d+)?),\s*([+-]?\d{1,3}(?:\.\d+)?)/i,
    /(?:^|[^\d+-])([+-]?\d{1,3}\.\d{2,})\s*,\s*([+-]?\d{1,3}\.\d{2,})(?:[^\d.]|$)/,
  ];

  for (const pattern of pairPatterns) {
    const match = text.match(pattern);
    const coords = normalizeCoordinatePair(match?.[1], match?.[2]);
    if (coords) return { ...coords, source: "coordinate-text", precision: "exact" };
  }

  return null;
}

function decodeCoordinateText(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractLabeledLatLng(text) {
  const latMatch = text.match(/(?:lat(?:itude)?|위도)\D*([+-]?\d{1,3}(?:\.\d+)?)/i);
  const lonMatch = text.match(/(?:lng|lon(?:gitude)?|경도)\D*([+-]?\d{1,3}(?:\.\d+)?)/i);
  return normalizeCoordinatePair(latMatch?.[1], lonMatch?.[1])
    ? { ...normalizeCoordinatePair(latMatch?.[1], lonMatch?.[1]), source: "coordinate-text", precision: "exact" }
    : null;
}

function extractLatLngFromItineraryItem(item) {
  return extractLatLngFromText([
    item?.mapQuery,
    item?.location,
    item?.place,
  ].filter(Boolean).join(" "));
}

function normalizeCoordinatePair(firstValue, secondValue) {
  const first = Number.parseFloat(firstValue);
  const second = Number.parseFloat(secondValue);
  if (isValidLatLng(first, second)) return { lat: first, lon: second };
  if (isValidLatLng(second, first)) return { lat: second, lon: first };
  return null;
}

function getItemLatLng(item, { requireSignature = false } = {}) {
  const lat = Number.parseFloat(item?.lat);
  const lon = Number.parseFloat(item?.lon);
  if (!isValidLatLng(lat, lon)) return null;
  if (item?.coordinateSource === "google-query-preview") return null;
  if (requireSignature && !hasMatchingCoordinateSignature(item)) return null;
  return { lat, lon };
}

function isValidLatLng(lat, lon) {
  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && Math.abs(lat) <= 90
    && Math.abs(lon) <= 180;
}

function isAcceptedCoordinates(coords, item, validateCoords) {
  return !validateCoords || validateCoords(coords, item) !== false;
}

function cacheItemCoordinates(item, coords) {
  if (!item || !coords || !isValidLatLng(coords.lat, coords.lon)) return;
  item.lat = coords.lat;
  item.lon = coords.lon;
  item.coordinateSignature = buildItemCoordinateSignature(item);
  item.coordinateSource = coords.source || "";
  item.coordinatePrecision = coords.precision || "";
  item.coordinateAddress = coords.location || coords.formattedAddress || "";
  item.googlePlaceId = coords.placeId || "";

  const savedItem = item.id ? findItineraryItem(item.id) : null;
  if (savedItem && savedItem !== item) {
    savedItem.lat = coords.lat;
    savedItem.lon = coords.lon;
    savedItem.coordinateSignature = buildItemCoordinateSignature(savedItem);
    savedItem.coordinateSource = item.coordinateSource;
    savedItem.coordinatePrecision = item.coordinatePrecision;
    savedItem.coordinateAddress = item.coordinateAddress;
    savedItem.googlePlaceId = item.googlePlaceId;
  }
}

function buildItemCoordinateSignature(item) {
  return normalizePlaceAlias([
    item?.place,
    item?.location,
    buildTripDestinationQuery(),
  ].filter(Boolean).join("|"));
}

function hasMatchingCoordinateSignature(item) {
  const signature = item?.coordinateSignature || "";
  return Boolean(signature && signature === buildItemCoordinateSignature(item));
}

async function fetchLatLngForItineraryItem(item, { maxQueries = Infinity, context = "", near = null, ignoreSaved = false, requireSavedSignature = false, allowNominatim = true, validateCoords = null } = {}) {
  const directCoords = extractLatLngFromItineraryItem(item);
  if (directCoords && isAcceptedCoordinates(directCoords, item, validateCoords)) return directCoords;

  const savedCoords = getItemLatLng(item, { requireSignature: requireSavedSignature });
  const shouldRefreshSavedWithGoogle = savedCoords
    && !ignoreSaved
    && typeof hasGoogleGeocodingApiKey === "function"
    && hasGoogleGeocodingApiKey()
    && !isHighTrustCoordinateSource(item?.coordinateSource);
  if (savedCoords && !ignoreSaved && !shouldRefreshSavedWithGoogle && isAcceptedCoordinates(savedCoords, item, validateCoords)) return savedCoords;

  if (typeof fetchLatLngFromGooglePlacesTextSearch === "function") {
    for (const query of buildGeocodeQueries(item, context).slice(0, maxQueries)) {
      const googlePlaceCoords = await fetchLatLngFromGooglePlacesTextSearch(query, { context, near });
      if (googlePlaceCoords && isAcceptedCoordinates(googlePlaceCoords, item, validateCoords)) {
        setCachedGeocodeResult(query, context, googlePlaceCoords);
        return googlePlaceCoords;
      }
    }
  }

  if (typeof fetchLatLngFromGoogleGeocoding === "function") {
    for (const query of buildGeocodeQueries(item, context).slice(0, maxQueries)) {
      const googleCoords = await fetchLatLngFromGoogleGeocoding(query, { context });
      if (googleCoords && isAcceptedCoordinates(googleCoords, item, validateCoords)) {
        setCachedGeocodeResult(query, context, googleCoords);
        return googleCoords;
      }
    }
  }

  if (savedCoords && !ignoreSaved && isAcceptedCoordinates(savedCoords, item, validateCoords)) return savedCoords;

  const knownCoords = findKnownPlaceCoordinates(item, context);
  if (knownCoords && isAcceptedCoordinates(knownCoords, item, validateCoords)) return knownCoords;

  for (const query of buildGeocodeQueries(item, context).slice(0, maxQueries)) {
    const cachedCoords = getCachedGeocodeResult(query, context);
    if (cachedCoords && isAcceptedCoordinates(cachedCoords, item, validateCoords)) return cachedCoords;

    const photonCoords = await fetchLatLngFromPhoton(query, { context, near });
    if (photonCoords && isAcceptedCoordinates(photonCoords, item, validateCoords)) {
      setCachedGeocodeResult(query, context, photonCoords);
      return photonCoords;
    }
  }

  if (!allowNominatim) return null;

  for (const query of buildGeocodeQueries(item, context).slice(0, maxQueries)) {
    const boundedCoords = near ? await fetchLatLngFromNominatim(query, { near, bounded: true }) : null;
    if (boundedCoords && isAcceptedCoordinates(boundedCoords, item, validateCoords)) {
      setCachedGeocodeResult(query, context, boundedCoords);
      return boundedCoords;
    }

    const coords = await fetchLatLngFromNominatim(query);
    if (coords && isAcceptedCoordinates(coords, item, validateCoords)) {
      setCachedGeocodeResult(query, context, coords);
      return coords;
    }
  }

  return null;
}

function findKnownPlaceCoordinates(item, context = "") {
  const placeKey = normalizePlaceAlias(item?.place);
  const haystack = normalizePlaceAlias([item?.place, item?.location, context].filter(Boolean).join(" "));
  if (!placeKey && !haystack) return null;

  const candidates = knownPlaceCoordinates
    .map((entry) => ({
      entry,
      aliases: entry.aliases.map((alias) => normalizePlaceAlias(alias)).filter(Boolean),
      contextKey: normalizePlaceAlias(entry.context || ""),
    }))
    .filter((candidate) => !candidate.contextKey || haystack.includes(candidate.contextKey))
    .map((candidate) => {
      const placeAlias = candidate.aliases.find((alias) => (
        placeKey && (placeKey === alias || placeKey.includes(alias) || alias.includes(placeKey))
      ));
      const haystackAlias = candidate.aliases.find((alias) => haystack.includes(alias));
      const bestAlias = placeAlias || haystackAlias || "";
      return {
        entry: candidate.entry,
        score: (placeAlias ? 10000 : 0) + bestAlias.length,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  const matched = candidates[0]?.entry;

  return matched ? { lat: matched.lat, lon: matched.lon, source: "known-place", precision: "exact" } : null;
}

function isHighTrustCoordinateSource(source) {
  return ["coordinate-text", "google-places", "google-geocoding", "known-place"].includes(source || "");
}

function getCoordinateDistanceKm(a, b) {
  if (!a || !b || !isValidLatLng(a.lat, a.lon) || !isValidLatLng(b.lat, b.lon)) return Infinity;
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
  buildTripDestinationQuery,
  buildTripMapFallbackItem,
  appendTripDestinationContext,
  extractGeocodeContext,
  normalizeGeocodeContext,
  normalizeTripDestinationPart,
  parseDestinationFromTripName,
  extractLatLngFromText,
  decodeCoordinateText,
  extractLabeledLatLng,
  extractLatLngFromItineraryItem,
  normalizeCoordinatePair,
  getItemLatLng,
  isValidLatLng,
  isAcceptedCoordinates,
  cacheItemCoordinates,
  buildItemCoordinateSignature,
  hasMatchingCoordinateSignature,
  fetchLatLngForItineraryItem,
  isHighTrustCoordinateSource,
  findKnownPlaceCoordinates,
  getCoordinateDistanceKm,
  normalizePlaceAlias,
  buildGeocodeCacheKey,
  getCachedGeocodeResult,
  setCachedGeocodeResult,
});
