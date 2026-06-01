async function fetchLatLngFromPhoton(query, { context = "", near = null } = {}) {
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "8");
    if (near && isValidLatLng(near.lat, near.lon)) {
      url.searchParams.set("lat", String(near.lat));
      url.searchParams.set("lon", String(near.lon));
    } else if (normalizeGeocodeContext(context).includes("제주")) {
      url.searchParams.set("lat", "33.3616");
      url.searchParams.set("lon", "126.5292");
    }

    const res = await fetchWithTimeout(url.toString(), {
      headers: { Accept: "application/json" },
    }, GEOCODE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`photon ${res.status}`);

    const data = await res.json();
    const candidates = (data?.features || [])
      .map(normalizePhotonResult)
      .filter(Boolean);
    return pickBestGeocodeCandidate(candidates, query, context);
  } catch (e) {
    console.warn("Fast geocoding skipped:", query, e);
    return null;
  }
}

function getGoogleGeocodingApiKey() {
  const runtimeKey = String(window.TripLogGoogleMapsApiKey || window.GOOGLE_MAPS_API_KEY || "").trim();
  const savedKey = String(localStorage.getItem(GOOGLE_GEOCODING_API_KEY_STORAGE_KEY) || "").trim();
  return runtimeKey || savedKey;
}

function hasGoogleGeocodingApiKey() {
  return Boolean(getGoogleGeocodingApiKey());
}

function saveGoogleGeocodingApiKey(value) {
  const key = String(value || "").trim();
  if (!key) {
    clearGoogleGeocodingApiKey();
    return false;
  }
  localStorage.setItem(GOOGLE_GEOCODING_API_KEY_STORAGE_KEY, key);
  geocodeResultCache.clear();
  return true;
}

function clearGoogleGeocodingApiKey() {
  localStorage.removeItem(GOOGLE_GEOCODING_API_KEY_STORAGE_KEY);
  geocodeResultCache.clear();
}

async function fetchGooglePlacesTextSearchCandidates(query, { context = "", near = null, signal = null } = {}) {
  const apiKey = getGoogleGeocodingApiKey();
  if (!apiKey) return [];

  try {
    const body = {
      textQuery: appendTripDestinationContext(query, context),
      languageCode: "ko",
      maxResultCount: 5,
    };
    const expectedCountryCode = getExpectedTripCountryCode();
    if (expectedCountryCode) body.regionCode = expectedCountryCode;
    else if (state.travelMode === "domestic") body.regionCode = "KR";

    const locationBias = buildGooglePlacesLocationBias(context, near);
    if (locationBias) body.locationBias = locationBias;

    const res = await fetchWithTimeout("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri",
      },
      body: JSON.stringify(body),
    }, GEOCODE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`google places ${res.status}`);

    const data = await res.json();
    return (data.places || [])
      .map(normalizeGooglePlacesTextSearchResult)
      .filter(Boolean);
  } catch (e) {
    if (e.name !== "AbortError") console.warn("Google places search failed:", query, e);
    return [];
  }
}

async function fetchLatLngFromGooglePlacesTextSearch(query, { context = "", near = null, signal = null } = {}) {
  const candidates = await fetchGooglePlacesTextSearchCandidates(query, { context, near, signal });
  return pickBestGeocodeCandidate(candidates, query, context);
}

function buildGooglePlacesLocationBias(context = "", near = null) {
  if (near && isValidLatLng(near.lat, near.lon)) {
    return {
      circle: {
        center: { latitude: near.lat, longitude: near.lon },
        radius: 12000,
      },
    };
  }

  const contextText = normalizeGeocodeContext(context || buildTripDestinationQuery());
  if (state.travelMode === "domestic" && contextText.includes("제주")) {
    return {
      circle: {
        center: { latitude: 33.3616, longitude: 126.5292 },
        radius: 70000,
      },
    };
  }

  return null;
}

function normalizeGooglePlacesTextSearchResult(place) {
  const lat = parseFloat(place?.location?.latitude);
  const lon = parseFloat(place?.location?.longitude);
  if (!isValidLatLng(lat, lon)) return null;

  return {
    lat,
    lon,
    name: place.displayName?.text || "",
    location: place.formattedAddress || "",
    countrycode: inferCountryCodeFromAddress(place.formattedAddress),
    state: inferStateFromAddress(place.formattedAddress),
    city: "",
    district: "",
    source: "google-places",
    precision: "PLACE",
    placeId: place.id || "",
    googleMapsUri: place.googleMapsUri || "",
    types: Array.isArray(place.types) ? place.types : [],
  };
}

function inferCountryCodeFromAddress(address = "") {
  const value = String(address || "");
  if (/대한민국|한국|South Korea|Republic of Korea/i.test(value)) return "KR";
  return "";
}

function inferStateFromAddress(address = "") {
  const value = String(address || "");
  if (value.includes("제주")) return "제주";
  return "";
}

async function fetchLatLngFromGoogleGeocoding(query, { context = "", signal = null } = {}) {
  const apiKey = getGoogleGeocodingApiKey();
  if (!apiKey) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", appendTripDestinationContext(query, context));
    url.searchParams.set("language", "ko");
    const expectedCountryCode = getExpectedTripCountryCode();
    if (expectedCountryCode) {
      url.searchParams.set("components", `country:${expectedCountryCode}`);
      url.searchParams.set("region", expectedCountryCode.toLowerCase());
    } else if (state.travelMode === "domestic") {
      url.searchParams.set("components", "country:KR");
      url.searchParams.set("region", "kr");
    }
    url.searchParams.set("key", apiKey);

    const res = await fetchWithTimeout(url.toString(), {
      signal,
      headers: { Accept: "application/json" },
    }, GEOCODE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`google geocoding ${res.status}`);

    const data = await res.json();
    if (data.status !== "OK") {
      if (!["ZERO_RESULTS", "INVALID_REQUEST"].includes(data.status)) {
        console.warn("Google geocoding skipped:", data.status, data.error_message || query);
      }
      return null;
    }

    const candidates = (data.results || [])
      .map(normalizeGoogleGeocodingResult)
      .filter(Boolean);
    return pickBestGeocodeCandidate(candidates, query, context);
  } catch (e) {
    if (e.name !== "AbortError") console.warn("Google geocoding failed:", query, e);
    return null;
  }
}

function normalizeGoogleGeocodingResult(result) {
  const lat = parseFloat(result?.geometry?.location?.lat);
  const lon = parseFloat(result?.geometry?.location?.lng);
  if (!isValidLatLng(lat, lon)) return null;

  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const findComponent = (type, short = false) => {
    const component = components.find((entry) => entry.types?.includes(type));
    return component ? (short ? component.short_name : component.long_name) : "";
  };
  const name = findComponent("point_of_interest")
    || findComponent("establishment")
    || findComponent("premise")
    || result.formatted_address?.split(" ")?.[0]
    || "";

  return {
    lat,
    lon,
    name,
    location: result.formatted_address || "",
    countrycode: findComponent("country", true),
    state: findComponent("administrative_area_level_1"),
    city: findComponent("locality") || findComponent("administrative_area_level_2"),
    district: findComponent("sublocality_level_1") || findComponent("administrative_area_level_3"),
    source: "google-geocoding",
    precision: result.geometry?.location_type || "",
    placeId: result.place_id || "",
    partialMatch: Boolean(result.partial_match),
  };
}

function normalizePhotonResult(feature) {
  const [lon, lat] = feature?.geometry?.coordinates || [];
  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  if (!isValidLatLng(parsedLat, parsedLon)) return null;

  const props = feature.properties || {};
  return {
    lat: parsedLat,
    lon: parsedLon,
    name: props.name || "",
    location: [
      props.name,
      props.street,
      props.locality,
      props.district,
      props.city,
      props.state,
      props.country,
    ].filter(Boolean).join(" "),
    countrycode: props.countrycode || "",
    state: props.state || "",
    city: props.city || "",
    district: props.district || "",
    source: "photon",
  };
}

function pickBestGeocodeCandidate(candidates, query, context = "") {
  if (candidates.length === 0) return null;
  const queryKey = normalizePlaceAlias(query);
  const contextKey = normalizePlaceAlias(context);
  const expectedCountryCode = getExpectedTripCountryCode();

  const scored = candidates.map((candidate) => {
    const nameKey = normalizePlaceAlias(candidate.name);
    const locationKey = normalizePlaceAlias(candidate.location);
    const candidateCountryCode = (candidate.countrycode || "").toUpperCase();
    let score = 0;
    let relevance = 0;

    if (expectedCountryCode) {
      score += candidateCountryCode === expectedCountryCode ? 140 : -80;
      if (candidateCountryCode === "KR" && expectedCountryCode !== "KR") score -= 180;
    } else if (state.travelMode === "domestic") {
      score += candidateCountryCode === "KR" ? 30 : -120;
    } else {
      if (candidateCountryCode === "KR") score -= 160;
    }
    if (contextKey && locationKey.includes(contextKey)) score += 24;
    if (nameKey && queryKey.includes(nameKey)) {
      score += 45;
      relevance += 45;
    }
    if (nameKey && nameKey.includes(queryKey)) {
      score += 45;
      relevance += 45;
    }
    if (locationKey.includes(queryKey)) {
      score += 20;
      relevance += 28;
    }
    relevance += scoreGeocodeTokenMatch(candidate, query);
    score += relevance;
    score += scoreGoogleGeocodePrecision(candidate);
    if (candidate.partialMatch) score -= 24;
    if (candidate.state.includes("제주") || candidate.city.includes("제주") || candidate.district.includes("제주")) score += 12;

    return { candidate, score, relevance };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!isGeocodeCandidateAcceptable(best, query, context)) return null;

  return {
    lat: best.candidate.lat,
    lon: best.candidate.lon,
    source: best.candidate.source || "geocoding",
    precision: best.candidate.precision || "",
    location: best.candidate.location || "",
    placeId: best.candidate.placeId || "",
  };
}

function scoreGeocodeTokenMatch(candidate, query) {
  const searchable = normalizePlaceAlias([candidate.name, candidate.location].filter(Boolean).join(" "));
  const tokens = getSignificantGeocodeTokens(query);
  if (tokens.length === 0) return 0;

  const matchedTokens = tokens.filter((token) => searchable.includes(token));
  if (matchedTokens.length === 0) return 0;
  const ratio = matchedTokens.length / tokens.length;
  return Math.round(18 * matchedTokens.length + 42 * ratio);
}

function getSignificantGeocodeTokens(query) {
  const weakTokens = new Set([
    "대한민국", "한국", "제주", "제주도", "제주특별자치도", "특별자치도",
    "주소", "위치", "장소", "여행", "일정", "국내", "해외",
  ].map(normalizePlaceAlias));

  return String(query || "")
    .split(/[\s,|/()]+/)
    .map((token) => normalizePlaceAlias(token))
    .filter((token) => token.length >= 2 && !weakTokens.has(token));
}

function scoreGoogleGeocodePrecision(candidate) {
  if (candidate.source !== "google-geocoding") return 0;
  const precision = String(candidate.precision || "").toUpperCase();
  if (precision === "ROOFTOP") return 34;
  if (precision === "GEOMETRIC_CENTER" || precision === "RANGE_INTERPOLATED") return 18;
  if (precision === "APPROXIMATE") return -10;
  return 0;
}

function isGeocodeCandidateAcceptable(scoredCandidate, query, context = "") {
  if (!scoredCandidate || scoredCandidate.score <= -50) return false;
  const tokens = getSignificantGeocodeTokens(stripGeocodeContext(query, context));
  if (tokens.length === 0) return true;
  return scoredCandidate.relevance >= 28;
}

function stripGeocodeContext(query, context = "") {
  const contextParts = [
    context,
    buildTripDestinationQuery(),
    state.country,
    state.city,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/\s+/))
    .map(normalizePlaceAlias)
    .filter(Boolean);

  return String(query || "")
    .split(/\s+/)
    .filter((part) => !contextParts.includes(normalizePlaceAlias(part)))
    .join(" ");
}

function getExpectedTripCountryCode() {
  const country = normalizePlaceAlias(state.country);
  const tripContext = normalizePlaceAlias([state.country, state.city, state.tripName].filter(Boolean).join(" "));
  const haystack = `${country} ${tripContext}`;

  const countryCodes = [
    { code: "JP", aliases: ["일본", "japan", "日本", "도쿄", "동경", "오사카", "교토", "후쿠오카", "삿포로", "오키나와", "나고야", "히로시마", "나라", "고베", "요코하마", "하코네", "Tokyo", "Osaka", "Kyoto", "Fukuoka", "Sapporo", "Okinawa", "Nagoya", "Hiroshima", "Yokohama"] },
    { code: "US", aliases: ["미국", "usa", "unitedstates", "america"] },
    { code: "CN", aliases: ["중국", "china", "中国"] },
    { code: "TW", aliases: ["대만", "taiwan", "台灣", "台湾"] },
    { code: "TH", aliases: ["태국", "thailand"] },
    { code: "VN", aliases: ["베트남", "vietnam"] },
    { code: "GB", aliases: ["영국", "uk", "unitedkingdom", "britain"] },
    { code: "FR", aliases: ["프랑스", "france"] },
    { code: "IT", aliases: ["이탈리아", "italy"] },
    { code: "ES", aliases: ["스페인", "spain"] },
    { code: "DE", aliases: ["독일", "germany"] },
    { code: "KR", aliases: ["대한민국", "한국", "korea", "southkorea"] },
  ];

  return countryCodes.find((entry) => entry.aliases.some((alias) => haystack.includes(normalizePlaceAlias(alias))))?.code || "";
}

async function fetchLatLngFromNominatim(query, { near = null, bounded = false } = {}) {
  try {
    await waitForNominatimSlot();
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("accept-language", "ko");
    url.searchParams.set("dedupe", "1");
    const expectedCountryCode = getExpectedTripCountryCode();
    if (expectedCountryCode) {
      url.searchParams.set("countrycodes", expectedCountryCode.toLowerCase());
    } else if (state.travelMode === "domestic") {
      url.searchParams.set("countrycodes", "kr");
    }
    if (near && bounded && isValidLatLng(near.lat, near.lon)) {
      const radius = 0.8;
      url.searchParams.set("viewbox", `${near.lon - radius},${near.lat + radius},${near.lon + radius},${near.lat - radius}`);
      url.searchParams.set("bounded", "1");
    }
    url.searchParams.set("q", query);

    const res = await fetchWithTimeout(url.toString(), {
      headers: { Accept: "application/json" },
    }, GEOCODE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const data = await res.json();
    const candidates = (Array.isArray(data) ? data : [])
      .map(normalizeNominatimResult)
      .filter(Boolean);
    const best = pickBestGeocodeCandidate(candidates, query, buildTripDestinationQuery());
    if (best) return best;
  } catch (e) {
    console.error("Geocoding failed for:", query, e);
  }
  return null;
}

function normalizeNominatimResult(result) {
  const lat = parseFloat(result?.lat);
  const lon = parseFloat(result?.lon);
  if (!isValidLatLng(lat, lon)) return null;

  const address = result.address || {};
  return {
    lat,
    lon,
    name: result.name || result.display_name?.split(",")?.[0] || "",
    location: result.display_name || "",
    countrycode: address.country_code || "",
    state: address.state || "",
    city: address.city || address.county || "",
    district: address.suburb || address.town || address.village || address.neighbourhood || "",
    source: "nominatim",
  };
}

async function waitForNominatimSlot() {
  const elapsed = Date.now() - lastNominatimRequestAt;
  const waitMs = Math.max(0, 1050 - elapsed);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastNominatimRequestAt = Date.now();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal;
  const abortFromParent = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", abortFromParent);
  }
}

window.TripLog.register("services.maps.geocoding", {
  fetchLatLngFromPhoton,
  getGoogleGeocodingApiKey,
  hasGoogleGeocodingApiKey,
  saveGoogleGeocodingApiKey,
  clearGoogleGeocodingApiKey,
  fetchGooglePlacesTextSearchCandidates,
  fetchLatLngFromGooglePlacesTextSearch,
  buildGooglePlacesLocationBias,
  normalizeGooglePlacesTextSearchResult,
  inferCountryCodeFromAddress,
  inferStateFromAddress,
  fetchLatLngFromGoogleGeocoding,
  normalizeGoogleGeocodingResult,
  normalizePhotonResult,
  pickBestGeocodeCandidate,
  scoreGeocodeTokenMatch,
  getSignificantGeocodeTokens,
  scoreGoogleGeocodePrecision,
  isGeocodeCandidateAcceptable,
  stripGeocodeContext,
  getExpectedTripCountryCode,
  fetchLatLngFromNominatim,
  normalizeNominatimResult,
  waitForNominatimSlot,
  fetchWithTimeout,
});
