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
  };
}

function pickBestGeocodeCandidate(candidates, query, context = "") {
  if (candidates.length === 0) return null;
  const queryKey = normalizePlaceAlias(query);
  const contextKey = normalizePlaceAlias(context);

  const scored = candidates.map((candidate) => {
    const nameKey = normalizePlaceAlias(candidate.name);
    const locationKey = normalizePlaceAlias(candidate.location);
    let score = 0;

    if (state.travelMode === "domestic") {
      score += candidate.countrycode === "KR" ? 30 : -120;
    }
    if (contextKey && locationKey.includes(contextKey)) score += 24;
    if (nameKey && queryKey.includes(nameKey)) score += 45;
    if (nameKey && nameKey.includes(queryKey)) score += 45;
    if (locationKey.includes(queryKey)) score += 20;
    if (candidate.state.includes("제주") || candidate.city.includes("제주") || candidate.district.includes("제주")) score += 12;

    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best.score > -50 ? { lat: best.candidate.lat, lon: best.candidate.lon } : null;
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
    if (state.travelMode === "domestic") {
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
    if (data && data.length > 0) {
      const result = data.find((candidate) => isValidLatLng(parseFloat(candidate.lat), parseFloat(candidate.lon)));
      if (result) return { lat: parseFloat(result.lat), lon: parseFloat(result.lon) };
    }
  } catch (e) {
    console.error("Geocoding failed for:", query, e);
  }
  return null;
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
  normalizePhotonResult,
  pickBestGeocodeCandidate,
  fetchLatLngFromNominatim,
  waitForNominatimSlot,
  fetchWithTimeout,
});
