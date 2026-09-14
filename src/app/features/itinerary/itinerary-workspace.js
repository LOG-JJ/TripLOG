(() => {
  const query = selector => document.querySelector(selector);
  let dialog, menu, toolsDialog, returnFocus, draftTripId, ready = false;

  function render(days = getTripDays()) {
    if (!dialog) return;
    if (dialog.open && draftTripId !== getActiveTripId()) close();
    query("#itineraryEditorTripName").textContent = state.tripName || getDefaultTripName();
    const strip = query("#itineraryEditorDays");
    const left = strip.scrollLeft;
    strip.replaceChildren(...days.map(day => {
      const button = createItineraryDayButton(day, els.itineraryDaySelect.value);
      button.addEventListener("click", () => {
        els.itineraryDaySelect.value = day.date;
        syncCustomSelect(els.itineraryDaySelect);
        render(days);
        previewRoute();
      });
      return button;
    }));
    strip.scrollLeft = left;
    query("#itineraryEditActions").hidden = !editingItineraryId;
    query("#itineraryEditorTitle").textContent = editingItineraryId ? "장소 수정" : "장소 추가";
    els.itinerarySubmitButton.querySelector("span").textContent = editingItineraryId ? "일정 저장" : "일정에 추가";
    const themeIcon = query("[data-itinerary-theme-icon]");
    if (themeIcon) themeIcon.className = `ph ph-${els.itineraryThemeSelect.value === "sightseeing" ? "bank" : (itineraryThemes[els.itineraryThemeSelect.value]?.icon || "map-pin")}`;
  }

  function show({ edit = false } = {}) {
    if (!dialog) return;
    if (!dialog.open) returnFocus = document.activeElement;
    draftTripId = getActiveTripId();
    if (!edit) {
      clearItineraryEditMode(false);
      const days = getTripDays();
      els.itineraryDaySelect.value = days.some(day => day.date === state.selectedItineraryDate)
        ? state.selectedItineraryDate : state.lastActiveItineraryDate || days[0]?.date || "";
      syncCustomSelect(els.itineraryDaySelect);
    }
    query("#itineraryFormError").hidden = true;
    query("#itineraryExtraDetails").open = edit && Boolean(els.itineraryMemoInput.value || currentVoucherFileName || els.itineraryVoucherName.value || els.itineraryVoucherCode.value);
    query("#itineraryPlaceSearchPanel").hidden = edit && Boolean(els.itineraryPlaceInput.value);
    syncPlace(); render();
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add("itinerary-dialog-open");
    dialog.querySelector(".itinerary-editor-scroll").scrollTop = 0;
    query("#itineraryEditorTitle").focus({ preventScroll: true });
    requestAnimationFrame(() => {
      previewRoute();
      leafletMapInstance?.invalidateSize();
    });
  }

  function close() { if (dialog?.open) dialog.close(); }

  function cleanup() {
    leafletRenderToken++;
    placeSearchAbortController?.abort(); placeSearchAbortController = null;
    els.placeSearchButton.disabled = false;
    clearPlaceSearchTimer(); closePlaceSearchResults(); closeManualAddressPanel();
    clearItineraryEditMode(false);
    document.documentElement.classList.remove("itinerary-dialog-open");
    draftTripId = null;
    (returnFocus?.isConnected ? returnFocus : query("#itineraryAddButton"))?.focus({ preventScroll: true });
  }

  function syncPlace({ selected = false } = {}) {
    if (!dialog) return;
    const place = els.itineraryPlaceInput.value.trim();
    query("#itineraryPlaceName").textContent = place;
    const address = els.itineraryLocationInput.value;
    query("#itineraryPlaceAddress").textContent = /^위도 .+, 경도 /.test(address) ? "지도에서 선택한 위치" : address || "주소 미입력";
    query("#itineraryPlaceSummary").hidden = !place || (!query("#itineraryPlaceSearchPanel").hidden && !selected);
    if (selected && place) {
      query("#itineraryPlaceSearchPanel").hidden = true;
      query("#itineraryPlaceSummary").hidden = false;
    }
    const candidate = selectedPlaceCandidate || (editingItineraryId && findItineraryItem(editingItineraryId));
    const coords = candidate && getItemLatLng(candidate, { requireSignature: false });
    const thumbnail = query("#itineraryPlaceThumbnail");
    thumbnail.hidden = !coords;
    if (coords) {
      // Use the same real map tiles as the map; never invent a photo of a saved place.
      const zoom = 15, n = 2 ** zoom, radians = Math.max(-85, Math.min(85, coords.lat)) * Math.PI / 180;
      const x = Math.floor((coords.lon + 180) / 360 * n);
      const y = Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * n);
      thumbnail.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
    } else thumbnail.removeAttribute("src");
  }

  function previewRoute() {
    if (!dialog?.open) return;
    if (!window.L) {
      query("#itineraryMapEmpty").hidden = false;
      return;
    }
    query("#itineraryMapEmpty").hidden = true;
    const date = els.itineraryDaySelect.value;
    const items = state.itineraryItems.filter(item => item.date === date).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    const candidate = selectedPlaceCandidate;
    const points = items.map(item => ({ item, coords: getItemLatLng(item, { requireSignature: true }) })).filter(point => point.coords);
    if (candidate && getItemLatLng(candidate, { requireSignature: false })) {
      const coords = getItemLatLng(candidate, { requireSignature: false });
      const existing = points.find(point => point.item.id === editingItineraryId);
      if (existing) { existing.item = { ...existing.item, ...candidate }; existing.coords = coords; }
      else if (!points.some(point => point.item.place === candidate.place && point.coords.lat === coords.lat && point.coords.lon === coords.lon)) points.push({ item: candidate, coords });
    }
    if (!points.length) { updateMapPreview(candidate || buildTripMapFallbackItem()); return; }
    leafletRenderToken++;
    initLeafletMap();
    leafletMapInstance.invalidateSize(); leafletMarkersGroup.clearLayers();
    leafletMapInstance.eachLayer(layer => { if (layer instanceof L.Popup) leafletMapInstance.removeLayer(layer); });
    if (leafletRouteLine) { leafletMapInstance.removeLayer(leafletRouteLine); leafletRouteLine = null; }
    points.forEach((point, index) => {
      const candidateCoords = candidate && getItemLatLng(candidate, { requireSignature: false });
      const active = candidateCoords ? point.coords.lat === candidateCoords.lat && point.coords.lon === candidateCoords.lon : point.item.id === state.selectedItineraryId;
      const icon = L.divIcon({ className: `itinerary-numbered-pin${active ? " active" : ""}`, html: `<span>${index + 1}</span>`, iconSize: [34, 42], iconAnchor: [17, 42] });
      L.marker([point.coords.lat, point.coords.lon], { icon, title: point.item.place })
        .bindTooltip(escapeHtml(point.item.place || "장소"), { direction: "bottom", offset: [0, 5], className: "itinerary-map-label" })
        .on("click", () => {
          // Picking a map position changes the draft place, never the record being edited.
          applyPlaceSearchResult({ ...point.item, id: `map-selection:${index}`, lat: point.coords.lat, lon: point.coords.lon,
            source: point.item.coordinateSource || point.item.source || "coordinate-text" });
        }).addTo(leafletMarkersGroup);
    });
    const latlngs = points.map(point => [point.coords.lat, point.coords.lon]);
    if (latlngs.length > 1) leafletRouteLine = L.polyline(latlngs, { color: "#111827", weight: 3, dashArray: "5 8", opacity: 0.9 }).addTo(leafletMapInstance);
    if (latlngs.length === 1) leafletMapInstance.setView(latlngs[0], 14);
    else leafletMapInstance.fitBounds(L.latLngBounds(latlngs), { padding: [40, 46], maxZoom: 15 });
    const mapItem = candidate || points[0].item;
    syncGoogleMapsLink(buildMapQuery(mapItem)); syncNaverMapsLink(mapItem);
    if (items.length > 1) els.googleMapsLink.href = buildGoogleMapsRouteUrls(items).external;
  }

  async function showFullRoute() {
    const items = state.itineraryItems.filter(item => item.date === els.itineraryDaySelect.value)
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    if (items.length < 2) { previewRoute(); return; }
    const button = els.itineraryRouteButton;
    button.disabled = true; button.querySelector("span").textContent = "동선 확인 중";
    try {
      const result = await renderLeafletRoute(items);
      if (!dialog.open || result?.cancelled) return;
      if (!result || result.validStops < 2) showToast("장소의 주소를 확인하면 전체 동선을 볼 수 있어요.");
      else if (result.validStops < items.length) showToast(`${items.length}개 중 좌표를 확인한 ${result.validStops}개 장소를 표시했어요.`);
      else if (result.fallbackSegments) showToast("경로를 찾지 못한 구간은 방문 순서로 연결했어요.");
      els.googleMapsLink.href = buildGoogleMapsRouteUrls(items).external;
      syncNaverMapsLink(buildNaverMapsRouteSearchQuery(items));
    } catch (error) {
      if (dialog.open) { previewRoute(); showToast("동선을 불러오지 못했어요. 지도 앱에서 길찾기를 열 수 있어요."); }
    } finally {
      button.disabled = false; button.querySelector("span").textContent = "전체 동선";
    }
  }

  function openMenu() { if (!menu.open) menu.showModal(); }

  function navigate(page) {
    menu?.close(); toolsDialog?.close(); close();
    setActivePage(page);
  }

  function downloadTicket(item) {
    if (!/^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i.test(item.voucherFile || "")) {
      showToast("첨부 파일 형식을 확인해 주세요."); return;
    }
    const link = document.createElement("a"); link.href = item.voucherFile;
    link.download = item.voucherFileName || "여행-티켓"; link.click();
  }

  function setup() {
    if (ready) return; ready = true;
    dialog = query("#itineraryEditor"); menu = query("#itineraryMenuDialog"); toolsDialog = query("#itineraryToolsDialog");
    dialog.querySelectorAll(".custom-time-icon").forEach(icon => { icon.innerHTML = itineraryIcon("caret-down"); });
    [els.itineraryTimeInput, els.itineraryEndTimeInput].forEach(input => {
      const label = input === els.itineraryTimeInput ? "시작 시간" : "종료 시간";
      const shell = input.closest(".custom-time");
      const clockIcon = document.createElement("i"); clockIcon.className = "ph ph-clock"; clockIcon.setAttribute("aria-hidden", "true");
      clockIcon.addEventListener("click", () => shell.querySelector(".custom-time-icon").click());
      shell.querySelector(".custom-time-button").prepend(clockIcon);
      shell.querySelector(".custom-time-value").setAttribute("aria-label", label);
      shell.querySelector(".custom-time-button").setAttribute("aria-label", `${label} 선택`);
    });
    dialog.querySelectorAll(".custom-select-chevron").forEach(icon => { icon.className = "custom-select-chevron ph ph-caret-down"; });
    const themeIcon = document.createElement("i");
    themeIcon.dataset.itineraryThemeIcon = ""; themeIcon.setAttribute("aria-hidden", "true");
    els.itineraryThemeSelect.closest(".custom-select").querySelector(".custom-select-button").prepend(themeIcon);
    els.itineraryThemeSelect.addEventListener("change", () => render());
    menu.addEventListener("click", event => { if (event.target.closest("[data-mode]")) menu.close(); });
    query("#itineraryPage").addEventListener("click", event => {
      if (event.target.closest("[data-itinerary-add]")) show();
      if (event.target.closest("[data-itinerary-menu]")) openMenu();
      const nav = event.target.closest("[data-itinerary-target]"); if (nav) navigate(nav.dataset.itineraryTarget);
      if (event.target.closest("[data-close-itinerary-menu]")) menu.close();
      if (event.target.closest("[data-itinerary-sync]")) { menu.close(); els.itineraryPageButton.click(); }
      if (event.target.closest("[data-itinerary-tools]")) {
        menu.close(); toolsDialog.showModal(); renderItineraryPage();
      }
    });
    query("#itineraryMenuButton").addEventListener("click", openMenu);
    query("#itineraryToolsClose").addEventListener("click", () => toolsDialog.close());
    query("#itineraryMapButton").addEventListener("click", () => show());
    query("#itineraryEditorClose").addEventListener("click", close);
    dialog.addEventListener("close", cleanup);
    for (const modal of [dialog, menu, toolsDialog]) modal.addEventListener("click", event => { if (event.target === modal) modal.close(); });
    query("#itineraryChangePlace").addEventListener("click", () => {
      query("#itineraryPlaceSearchPanel").hidden = false; query("#itineraryPlaceSummary").hidden = true;
      els.itineraryPlaceInput.focus(); els.itineraryPlaceInput.select();
    });
    query("#itineraryPlaceThumbnail").addEventListener("error", event => { event.target.hidden = true; });
    query("#itineraryDeleteButton").addEventListener("click", async () => {
      const item = findItineraryItem(editingItineraryId);
      const tripId=state.id;
      if (item && await (window.TripLog.features.redesign?.workspace?.confirmAction?.(`'${item.place}' 일정을 삭제할까요?`) ?? window.confirm(`'${item.place}' 일정을 삭제할까요?`)) && state.id===tripId) { const id = item.id; close(); deleteItineraryItem(id); showToast("일정을 삭제했어요."); }
    });
    // Native validation must be able to focus the place field when search is collapsed.
    els.itineraryPlaceInput.addEventListener("invalid", () => { query("#itineraryPlaceSearchPanel").hidden = false; });
    els.itineraryForm.addEventListener("input", () => { query("#itineraryFormError").hidden = true; });
    render();
  }

  window.TripLog.register("features.itinerary.workspace", { setup, render, show, close, syncPlace, previewRoute, showFullRoute, downloadTicket });
})();
