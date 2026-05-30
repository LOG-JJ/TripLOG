function handlePlaceInput() {
  const query = els.itineraryPlaceInput.value.trim();
  selectedPlaceCandidate = null;
  els.itineraryLocationInput.value = query;
  clearPlaceSearchTimer();
  closeManualAddressPanel();

  if (!query) {
    setPlaceSearchStatus("입력값 그대로 저장하거나 검색 결과를 선택할 수 있습니다.");
    closePlaceSearchResults();
    updateMapPreview({ place: state.tripName || getDefaultTripName(), location: state.tripName || "대한민국" });
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

  if (force) {
    applyGoogleMapSearch(query, { revealMap: true });
  }

  if (placeSearchAbortController) placeSearchAbortController.abort();
  const controller = new AbortController();
  placeSearchAbortController = controller;
  setPlaceSearchStatus(force ? "구글맵에 위치를 반영하고 주소 후보를 찾는 중입니다..." : "주소 후보를 찾는 중입니다...");
  els.placeSearchButton.disabled = true;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    url.searchParams.set("accept-language", "ko");
    if (state.travelMode === "domestic") {
      url.searchParams.set("countrycodes", "kr");
    }
    url.searchParams.set("q", query);

    await waitForNominatimSlot();
    let response = await fetchWithTimeout(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    }, GEOCODE_TIMEOUT_MS);
    if (!response.ok) throw new Error(`place search ${response.status}`);

    let rawData = await response.json();
    let results = rawData.map(normalizePlaceSearchResult).filter(Boolean);

    // Fallback: If no results found, retry with space-separated suffixes or suffix removal
    if (results.length === 0) {
      const suffixPattern = /(호텔|리조트|리조트앤스파|콘도|펜션|텔|민박|게스트하우스|카페|식당|맛집|포구|해수욕장|해변|공원|랜드|박물관|미술관|공항|역)$/;
      let fallbackQuery = query;

      if (suffixPattern.test(query) && !query.includes(" ")) {
        // Separate compound word: "코델리아호텔" -> "코델리아 호텔"
        fallbackQuery = query.replace(suffixPattern, " $1");
      } else if (query.includes(" ")) {
        // Strip off standard trailing terms: "성산 코델리아 호텔" -> "성산 코델리아"
        fallbackQuery = query.replace(suffixPattern, "").trim();
      }

      if (fallbackQuery !== query && fallbackQuery.length >= 2) {
        url.searchParams.set("q", fallbackQuery);
        await waitForNominatimSlot();
        response = await fetchWithTimeout(url.toString(), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        }, GEOCODE_TIMEOUT_MS);
        if (response.ok) {
          let fallbackData = await response.json();
          results = fallbackData.map(normalizePlaceSearchResult).filter(Boolean);
        }
      }
    }

    const googleQuery = buildGoogleMapsSearchQuery(query);
    renderPlaceSearchResults(results, query, {
      mapSyncedByGoogle: force,
      previewedResultId: force ? buildGoogleCandidateId(googleQuery) : "",
      googleQuery,
    });

    if (force) {
      setPlaceSearchStatus(
        results.length > 0
          ? "구글맵 검색 위치를 위 지도에 띄웠습니다. 아래 주소 후보를 선택하면 해당 후보로 바꿀 수 있습니다."
          : "구글맵 검색 위치를 위 지도에 띄웠습니다. 이 검색 위치로 일정에 저장됩니다.",
        "success",
      );
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      if (force) {
        const googleQuery = buildGoogleMapsSearchQuery(query);
        renderPlaceSearchResults([], query, {
          mapSyncedByGoogle: true,
          previewedResultId: buildGoogleCandidateId(googleQuery),
          googleQuery,
        });
        setPlaceSearchStatus("구글맵 검색 위치를 위 지도에 띄웠습니다. 이 검색 위치로 일정에 저장됩니다.", "success");
      } else {
        setPlaceSearchStatus("주소 후보 검색을 사용할 수 없습니다. 검색 버튼으로 구글맵 위치를 확인할 수 있습니다.", "warning");
        closePlaceSearchResults();
      }
    }
  } finally {
    if (placeSearchAbortController === controller) {
      placeSearchAbortController = null;
      els.placeSearchButton.disabled = false;
    }
  }
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
    lat: result.lat,
    lon: result.lon,
    type: result.type || result.class || "장소",
  };
}

function renderPlaceSearchResults(results, query, { mapSyncedByGoogle = false, previewedResultId = "", googleQuery = "" } = {}) {
  els.placeSearchResults.replaceChildren();

  // Create a high-priority direct Google Map matching candidate
  const googleMapQuery = googleQuery || buildGoogleMapsSearchQuery(query);
  const googleCandidate = {
    id: buildGoogleCandidateId(googleMapQuery),
    place: query,
    location: googleMapQuery,
    mapQuery: googleMapQuery,
    source: "google-query",
    type: "구글맵"
  };

  const finalResults = [googleCandidate, ...results];

  finalResults.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-search-result";
    button.dataset.placeId = result.id;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(result.id === previewedResultId));
    button.classList.toggle("is-previewed", result.id === previewedResultId);
    
    const isGoogle = result.source === "google-query";
    button.innerHTML = `
      <strong>
        ${isGoogle ? `<span class="tag" style="--tag-color: var(--accent-mint); margin-right: 6px; border-width: 1.5px; padding: 1px 5px; font-size: 10px; box-shadow: none;">지도 매칭</span>` : ""}
        ${escapeHtml(result.place)}
      </strong>
      <span>${isGoogle ? `${escapeHtml(result.location)} (구글맵에 나타난 위치 그대로 주소 지정)` : escapeHtml(result.location)}</span>
    `;
    button.addEventListener("click", () => selectPlaceSearchResult(result));
    button.addEventListener("mouseenter", () => previewPlaceSearchResult(result, { updateStatus: false }));
    button.addEventListener("focus", () => previewPlaceSearchResult(result, { updateStatus: false }));
    els.placeSearchResults.appendChild(button);
  });

  els.placeSearchResults.hidden = false;
  if (mapSyncedByGoogle) {
    setPlaceSearchStatus(
      results.length > 0
        ? "구글맵 검색 위치를 위 지도에 띄웠습니다. 아래 주소 후보를 선택하면 해당 후보로 바꿀 수 있습니다."
        : "구글맵 검색 위치를 위 지도에 띄웠습니다. 이 검색 위치로 일정에 저장됩니다.",
      "success",
    );
    return;
  }

  setPlaceSearchStatus("검색 결과가 있습니다. 지도 매칭 후보 또는 주소 후보를 선택하세요.", "success");
}

function selectPlaceSearchResult(result) {
  applyPlaceSearchResult(result);
}

function previewPlaceSearchResult(result, { statusMessage = "", updateStatus = true, revealMap = false } = {}) {
  selectedPlaceCandidate = result;
  els.itineraryPlaceInput.value = result.place;
  els.itineraryLocationInput.value = result.location;
  closeManualAddressPanel();
  updateMapPreview(result, { useGoogleMap: result.source === "google-query" });
  markPreviewedPlaceSearchResult(result.id);
  if (updateStatus) setPlaceSearchStatus(statusMessage || result.location, "success");
  if (revealMap) revealMapPreview();
}

function applyPlaceSearchResult(result, { closeResults = true } = {}) {
  previewPlaceSearchResult(result);
  if (closeResults) closePlaceSearchResults();
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
  const googleQuery = buildGoogleMapsSearchQuery(query);
  selectedPlaceCandidate = {
    id: buildGoogleCandidateId(googleQuery),
    place: query,
    location: googleQuery,
    mapQuery: googleQuery,
    source: "google-query",
  };
  els.itineraryLocationInput.value = googleQuery;
  updateMapPreview(selectedPlaceCandidate, { useGoogleMap: true });
  setPlaceSearchStatus("구글맵 검색 위치를 위 지도에 띄웠습니다. 이 검색 위치로 일정에 저장됩니다.", "success");
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
  normalizePlaceSearchResult,
  renderPlaceSearchResults,
  selectPlaceSearchResult,
  previewPlaceSearchResult,
  applyPlaceSearchResult,
  markPreviewedPlaceSearchResult,
  revealMapPreview,
  applyGoogleMapSearch,
  toggleManualAddressPanel,
  openManualAddressPanel,
  closeManualAddressPanel,
  handleManualAddressKeydown,
  applyManualAddressInput,
  closePlaceSearchResults,
  setPlaceSearchStatus,
  clearPlaceSearchTimer,
});
