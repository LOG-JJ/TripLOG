const placeSearchResultCache = new Map();
const PLACE_LOOKUP_BUDGET_MS = 2500;

function cancelPlaceLookup() {
  placeSearchAbortController?.abort();
  placeSearchAbortController = null;
  els.placeSearchButton.disabled = false;
  els.placeSearchButton.removeAttribute('aria-busy');
}

function handlePlaceInput() {
  cancelPlaceLookup();
  const query = els.itineraryPlaceInput.value.trim();
  selectedPlaceCandidate = null;
  els.itineraryLocationInput.value = query;
  clearPlaceSearchTimer();
  closeManualAddressPanel();

  if (!query) {
    setPlaceSearchStatus("입력값 그대로 저장하거나 검색 결과를 선택할 수 있습니다.");
    closePlaceSearchResults();
    updateMapPreview(buildTripMapFallbackItem());
    return;
  }

  setPlaceSearchStatus("수동 입력으로 저장됩니다. 검색 결과를 선택하면 주소가 자동 입력됩니다.");
  updateMapPreview({ place: query, location: query }, { geocodeMissing: false });
  closePlaceSearchResults();
}

function handlePlaceInputKeydown(event) {
  if (event.key !== "Enter" || event.isComposing) return;
  if (!els.placeSearchResults.hidden) return;
  const query = els.itineraryPlaceInput.value.trim();
  if (!query) return;
  event.preventDefault();
  searchPlacesFromInput({ force: true });
}

async function searchPlacesFromInput({ force = false } = {}) {
  const query = els.itineraryPlaceInput.value.trim();
  clearPlaceSearchTimer();
  if (query.length < 2) {
    if (force) setPlaceSearchStatus("두 글자 이상 입력하면 장소를 검색할 수 있습니다.", "warning");
    closePlaceSearchResults();
    return;
  }
  cancelPlaceLookup();
  const controller = new AbortController();
  placeSearchAbortController = controller;
  const googleQuery = appendTripDestinationContext(query);
  const key = [buildGoogleMapsSearchContext(), query].join('|');
  // The Google search stays independent of other providers' address candidates.
  renderPlaceSearchResults([], query, { googleQuery });
  if (force) previewGoogleMapSearch(query, { revealMap: true });
  setPlaceSearchStatus(`${getTripMapLabel()}에서 확인할 장소를 준비하고 있어요. 주소 후보도 확인 중입니다.`);
  els.placeSearchButton.setAttribute('aria-busy', 'true');
  let timer, timedOut = false;
  const isCurrent = () => placeSearchAbortController === controller
    && els.itineraryPlaceInput.value.trim() === query;
  try {
    const results = placeSearchResultCache.get(key) || await Promise.race([
      fetchPlaceSearchResults(query, controller),
      new Promise(resolve => { timer = setTimeout(() => { timedOut = true; resolve([]); controller.abort(); }, PLACE_LOOKUP_BUDGET_MS); }),
    ]);
    if (!isCurrent()) return;
    if (timedOut) {
      setPlaceSearchStatus(`${getTripMapLabel()}에서 위치를 확인해 주세요. 입력한 장소로 바로 저장할 수 있어요.`);
      return;
    }
    if (controller.signal.aborted) return;
    if (results.length) {
      placeSearchResultCache.set(key, results);
      if (placeSearchResultCache.size > 40) placeSearchResultCache.delete(placeSearchResultCache.keys().next().value);
    }
    renderPlaceSearchResults(results, query, { googleQuery, previewedResultId: buildGoogleCandidateId(googleQuery) });
    setPlaceSearchStatus(results.some(hasPlaceSearchCoordinates)
      ? '검색한 지도를 그대로 사용하거나, 주소를 확인하고 다른 후보를 선택하세요.'
      : `${getTripMapLabel()}에서 위치를 확인한 뒤 장소를 선택해 주세요.`, 'success');
  } catch (error) {
    if (isCurrent() && error.name !== 'AbortError') {
      setPlaceSearchStatus('주소 후보를 불러오지 못했지만, 입력한 장소로 바로 저장할 수 있어요.');
    }
  } finally {
    clearTimeout(timer);
    if (placeSearchAbortController === controller) {
      placeSearchAbortController = null;
      els.placeSearchButton.removeAttribute('aria-busy');
    }
  }
}

async function fetchPlaceSearchResults(query, controller) {
  const coordinateCandidate = createCoordinateTextPlaceCandidate(query);
  if (coordinateCandidate) return [coordinateCandidate];

  const googleResults = await fetchGooglePlacesPlaceSearchResults(query, controller);
  if (controller.signal.aborted) return [];
  if (googleResults.some(hasPlaceSearchCoordinates)) return googleResults;

  for (const searchQuery of buildPlaceSearchQueries(query)) {
    const results = await fetchNominatimPlaceSearchResults(searchQuery, controller);
    if (controller.signal.aborted) return [];
    if (results.some(hasPlaceSearchCoordinates)) return results;
  }

  return controller.signal.aborted ? [] : fetchKnowledgePlaceSearchResults(query, controller);
}

function createCoordinateTextPlaceCandidate(query) {
  const coords = extractLatLngFromText(query);
  if (!coords) return null;
  const placeName = extractGoogleMapsPlaceName(query) || "지도 좌표";

  return {
    id: `coordinate-text:${coords.lat},${coords.lon}`,
    place: placeName,
    location: `위도 ${coords.lat}, 경도 ${coords.lon}`,
    mapQuery: `${coords.lat},${coords.lon}`,
    lat: coords.lat,
    lon: coords.lon,
    type: "직접 좌표",
    source: "coordinate-text",
    precision: "exact",
  };
}

function extractGoogleMapsPlaceName(value) {
  const decoded = decodeCoordinateText(value);
  const placeMatch = decoded.match(/\/maps\/place\/([^/@?]+)/i);
  if (!placeMatch?.[1]) return "";
  return placeMatch[1]
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchGooglePlacesPlaceSearchResults(query, controller) {
  if (typeof fetchGooglePlacesTextSearchCandidates !== "function") return [];
  const candidates = await fetchGooglePlacesTextSearchCandidates(query, {
    context: buildGoogleMapsSearchContext(),
    signal: controller.signal,
  });

  return candidates.map((candidate) => ({
    id: `google-places:${candidate.placeId || candidate.location || `${candidate.lat},${candidate.lon}`}`,
    place: candidate.name || query,
    location: candidate.location || query,
    mapQuery: candidate.googleMapsUri || [candidate.name, candidate.location].filter(Boolean).join(" "),
    lat: candidate.lat,
    lon: candidate.lon,
    type: "Google 지도",
    source: "google-places",
    precision: candidate.precision,
    placeId: candidate.placeId,
  }));
}

async function fetchNominatimPlaceSearchResults(query, controller) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", "ko");
  url.searchParams.set("dedupe", "1");
  const expectedCountryCode = typeof getExpectedTripCountryCode === "function" ? getExpectedTripCountryCode() : "";
  if (expectedCountryCode) {
    url.searchParams.set("countrycodes", expectedCountryCode.toLowerCase());
  } else if (state.travelMode === "domestic") {
    url.searchParams.set("countrycodes", "kr");
  }
  url.searchParams.set("q", query);

  await waitForNominatimSlot();
  const response = await fetchWithTimeout(url.toString(), {
    signal: controller.signal,
    headers: { Accept: "application/json" },
  }, GEOCODE_TIMEOUT_MS);
  if (!response.ok) throw new Error(`place search ${response.status}`);

  const rawData = await response.json();
  return rawData.map(normalizePlaceSearchResult).filter(Boolean);
}

async function fetchKnowledgePlaceSearchResults(query, controller) {
  const candidates = await fetchWikipediaCoordinateCandidates(query, controller);
  const rankedCandidates = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const results = [];

  for (const candidate of rankedCandidates) {
    const reverseLocation = await fetchReversePlaceLocation(candidate, controller);
    results.push({
      id: `knowledge:${candidate.pageId}`,
      place: candidate.title,
      location: reverseLocation || buildKnowledgePlaceLocation(candidate),
      lat: candidate.lat,
      lon: candidate.lon,
      type: candidate.description || "좌표 검색",
      source: "knowledge-search",
    });
  }

  return results;
}

async function fetchWikipediaCoordinateCandidates(query, controller) {
  const url = new URL("https://ko.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("prop", "coordinates|description|pageprops");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "6");
  url.searchParams.set("colimit", "12");
  url.searchParams.set("coprimary", "all");

  const response = await fetchWithTimeout(url.toString(), {
    signal: controller.signal,
    headers: { Accept: "application/json" },
  }, GEOCODE_TIMEOUT_MS);
  if (!response.ok) return [];

  const data = await response.json();
  return Object.values(data?.query?.pages || {})
    .map((page) => normalizeWikipediaCoordinateCandidate(page, query))
    .filter(Boolean);
}

function normalizeWikipediaCoordinateCandidate(page, query) {
  const coordinate = (page?.coordinates || []).find((entry) => entry.primary !== undefined)
    || page?.coordinates?.[0];
  const lat = parseFloat(coordinate?.lat);
  const lon = parseFloat(coordinate?.lon);
  if (!isValidLatLng(lat, lon)) return null;

  const title = String(page.title || "").trim();
  if (!title) return null;

  return {
    pageId: page.pageid,
    title,
    description: String(page.description || "").trim(),
    lat,
    lon,
    score: scoreKnowledgeCandidate(page, query),
  };
}

function scoreKnowledgeCandidate(page, query) {
  const queryKey = normalizePlaceAlias(query);
  const titleKey = normalizePlaceAlias(page.title);
  const descriptionKey = normalizePlaceAlias(page.description);
  let score = 0;

  if (titleKey === queryKey) score += 120;
  else if (titleKey.includes(queryKey) || queryKey.includes(titleKey)) score += 55;
  score += Math.max(0, 30 - Number(page.index || 0) * 3);

  if (queryKey.endsWith(normalizePlaceAlias("역"))) {
    if (titleKey.endsWith(normalizePlaceAlias("역"))) score += 25;
    if (descriptionKey.includes(normalizePlaceAlias("철도역"))) score += 20;
  }

  const destinationKey = normalizePlaceAlias(buildTripDestinationQuery());
  if (destinationKey && descriptionKey.includes(destinationKey)) score += 15;
  return score;
}

async function fetchReversePlaceLocation(candidate, controller) {
  await waitForNominatimSlot();
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ko");
  url.searchParams.set("lat", String(candidate.lat));
  url.searchParams.set("lon", String(candidate.lon));

  const response = await fetchWithTimeout(url.toString(), {
    signal: controller.signal,
    headers: { Accept: "application/json" },
  }, GEOCODE_TIMEOUT_MS);
  if (!response.ok) return "";

  const data = await response.json();
  return formatReversePlaceAddress(data?.address, candidate.title) || data?.display_name || "";
}

function formatReversePlaceAddress(address = {}, title = "") {
  const parts = [
    title,
    address.railway,
    address.road,
    address.neighbourhood,
    address.quarter,
    address.suburb,
    address.city,
    address.state,
    address.postcode,
    address.country,
  ];

  const seen = new Set();
  return parts
    .map((part) => String(part || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((part) => {
      const key = normalizePlaceAlias(part);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}

function buildKnowledgePlaceLocation(candidate) {
  return [candidate.title, candidate.description].filter(Boolean).join(", ");
}

function buildPlaceSearchQueries(query) {
  const normalized = (query || "").replace(/\s+/g, " ").trim();
  return normalized ? [normalized] : [];
}

function normalizePlaceSearchResult(result) {
  if (!result?.display_name) return null;
  const address = result.address || {};
  const place =
    result.name ||
    address.attraction ||
    address.tourism ||
    address.amenity ||
    address.building ||
    address.shop ||
    address.road ||
    result.display_name.split(",")[0];

  return {
    id: String(result.place_id || result.osm_id || result.display_name),
    place: place.trim(),
    location: result.display_name,
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
    type: result.type || result.class || "장소",
    source: "nominatim-search",
  };
}

function renderPlaceSearchResults(results, query, { previewedResultId = "", googleQuery = "" } = {}) {
  els.placeSearchResults.replaceChildren();

  const googleMapQuery = googleQuery || buildGoogleMapsSearchQuery(query);
  const hasCoordinateTextCandidate = results.some((result) => result.source === "coordinate-text");
  // A matching name does not identify the place shown inside Google's iframe.
  // Never graft a different provider's coordinates onto this search option.
  const googleCandidate = hasCoordinateTextCandidate ? null : createGoogleMapSearchCandidate(query, googleMapQuery);
  const finalResults = hasCoordinateTextCandidate
    ? results
    : googleCandidate
      ? [googleCandidate, ...results]
      : results;

  finalResults.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-search-result";
    button.dataset.placeId = result.id;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(result.id === previewedResultId));
    button.classList.toggle("is-previewed", result.id === previewedResultId);
    
    const sourceLabel = getPlaceSearchSourceLabel(result);
    button.innerHTML = `
      <strong>
        ${sourceLabel ? `<span class="tag" style="--tag-color: var(--accent-sky); margin-right: 6px; border-width: 1.5px; padding: 1px 5px; font-size: 10px; box-shadow: none;">${sourceLabel}</span>` : ""}
        ${escapeHtml(result.place)}
      </strong>
      <span>${escapeHtml(result.location)}${result.source === "google-query-preview" ? " · 검색한 지도 그대로 사용" : ""}</span>
    `;
    button.addEventListener("click", () => selectPlaceSearchResult(result));
    els.placeSearchResults.appendChild(button);
  });

  els.placeSearchResults.hidden = false;
  setPlaceSearchStatus(
    finalResults.length > 0
      ? "검색 결과가 있습니다. 지도 검색 후보나 정확한 주소 후보를 선택하세요."
      : "검색 결과가 없습니다. 직접 주소를 입력해주세요.",
    finalResults.length > 0 ? "success" : "warning",
  );
  return finalResults;
}

function getPlaceSearchSourceLabel(result) {
  if (result.source === "google-query-preview") return `${getTripMapLabel()} 검색`;
  if (result.source === "google-places") return "Google";
  if (result.source === "nominatim-search") return "주소 후보";
  if (result.source === "coordinate-text") return "좌표";
  if (result.source === "knowledge-search") return "지식";
  return "";
}

function createGoogleMapSearchCandidate(query, googleMapQuery) {
  const cleanQuery = googleMapQuery || buildGoogleMapsSearchQuery(query);
  if (!cleanQuery) return null;
  return {
    id: buildGoogleCandidateId(cleanQuery),
    place: query,
    location: cleanQuery,
    mapQuery: cleanQuery,
    source: "google-query-preview",
    type: "지도 검색",
  };
}

function hasPlaceSearchCoordinates(result) {
  return isValidLatLng(parseFloat(result?.lat), parseFloat(result?.lon));
}

function selectPlaceSearchResult(result) {
  applyPlaceSearchResult(result);
}

function previewPlaceSearchResult(result, { statusMessage = "", updateStatus = true, revealMap = false } = {}) {
  selectedPlaceCandidate = result;
  els.itineraryPlaceInput.value = result.place;
  els.itineraryLocationInput.value = result.location;
  closeManualAddressPanel();
  updateMapPreview(result);
  markPreviewedPlaceSearchResult(result.id);
  if (updateStatus) setPlaceSearchStatus(statusMessage || result.location, "success");
  if (revealMap) revealMapPreview();
}

function applyPlaceSearchResult(result, { closeResults = true } = {}) {
  cancelPlaceLookup();
  previewPlaceSearchResult(result);
  if (closeResults) closePlaceSearchResults();
  window.TripLog.features.itinerary.workspace?.syncPlace?.({ selected: true });
}

function markPreviewedPlaceSearchResult(id) {
  els.placeSearchResults.querySelectorAll(".place-search-result").forEach((button) => {
    const isPreviewed = button.dataset.placeId === id;
    button.classList.toggle("is-previewed", isPreviewed);
    button.setAttribute("aria-selected", String(isPreviewed));
  });
}

function revealMapPreview() {
  const mapSection = document.querySelector(".map-section-top");
  if (!mapSection) return;

  const rect = mapSection.getBoundingClientRect();
  const isMostlyVisible = rect.top >= 80 && rect.bottom <= window.innerHeight - 24;
  if (isMostlyVisible) return;

  mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function applyGoogleMapSearch(query, { revealMap = false } = {}) {
  previewGoogleMapSearch(query, { revealMap });
}

function previewGoogleMapSearch(query, { revealMap = false } = {}) {
  const googleQuery = appendTripDestinationContext(query);
  selectedPlaceCandidate = createGoogleMapSearchCandidate(query, googleQuery);
  els.itineraryLocationInput.value = query;
  renderTripMapPreview(selectedPlaceCandidate, googleQuery);
  if (revealMap) revealMapPreview();
}

function toggleManualAddressPanel() {
  if (els.manualAddressPanel.hidden) {
    openManualAddressPanel(els.itineraryLocationInput.value || els.itineraryPlaceInput.value.trim(), { focus: true });
    return;
  }

  closeManualAddressPanel();
}

function openManualAddressPanel(prefill = "", { focus = false } = {}) {
  const value = (prefill || els.itineraryLocationInput.value || els.itineraryPlaceInput.value.trim()).trim();
  if (value) els.manualAddressInput.value = value;
  closePlaceSearchResults();
  els.manualAddressPanel.hidden = false;

  if (focus) {
    requestAnimationFrame(() => {
      els.manualAddressInput.focus();
      els.manualAddressInput.select();
    });
  }
}

function closeManualAddressPanel() {
  els.manualAddressPanel.hidden = true;
}

function handleManualAddressKeydown(event) {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    applyManualAddressInput();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeManualAddressPanel();
    els.itineraryPlaceInput.focus();
  }
}

function applyManualAddressInput() {
  cancelPlaceLookup();
  const address = els.manualAddressInput.value.trim();
  const place = els.itineraryPlaceInput.value.trim() || address;

  if (!address) {
    setPlaceSearchStatus("직접 입력할 주소를 적어주세요.", "warning");
    els.manualAddressInput.focus();
    return;
  }

  if (!els.itineraryPlaceInput.value.trim()) {
    els.itineraryPlaceInput.value = address;
  }

  selectedPlaceCandidate = {
    id: `manual-address:${address}`,
    place,
    location: address,
    source: "manual-address",
  };
  els.itineraryLocationInput.value = address;
  updateMapPreview({ place, location: address });
  closePlaceSearchResults();
  closeManualAddressPanel();
  setPlaceSearchStatus("직접 입력한 주소를 지도와 일정 위치에 반영했습니다.", "success");
}

function closePlaceSearchResults() {
  els.placeSearchResults.hidden = true;
}

function setPlaceSearchStatus(message, tone = "neutral") {
  els.placeSearchStatus.textContent = message;
  els.placeSearchStatus.dataset.tone = tone;
}

function clearPlaceSearchTimer() {
  if (!placeSearchTimer) return;
  window.clearTimeout(placeSearchTimer);
  placeSearchTimer = null;
}

window.TripLog.register("features.itinerary.placeSearch", {
  handlePlaceInput,
  handlePlaceInputKeydown,
  searchPlacesFromInput,
  fetchPlaceSearchResults,
  createCoordinateTextPlaceCandidate,
  extractGoogleMapsPlaceName,
  fetchGooglePlacesPlaceSearchResults,
  fetchNominatimPlaceSearchResults,
  fetchKnowledgePlaceSearchResults,
  fetchWikipediaCoordinateCandidates,
  normalizeWikipediaCoordinateCandidate,
  scoreKnowledgeCandidate,
  fetchReversePlaceLocation,
  formatReversePlaceAddress,
  buildKnowledgePlaceLocation,
  buildPlaceSearchQueries,
  normalizePlaceSearchResult,
  renderPlaceSearchResults,
  getPlaceSearchSourceLabel,
  createGoogleMapSearchCandidate,
  hasPlaceSearchCoordinates,
  selectPlaceSearchResult,
  previewPlaceSearchResult,
  applyPlaceSearchResult,
  markPreviewedPlaceSearchResult,
  revealMapPreview,
  applyGoogleMapSearch,
  previewGoogleMapSearch,
  toggleManualAddressPanel,
  openManualAddressPanel,
  closeManualAddressPanel,
  handleManualAddressKeydown,
  applyManualAddressInput,
  closePlaceSearchResults,
  setPlaceSearchStatus,
  clearPlaceSearchTimer,
});
