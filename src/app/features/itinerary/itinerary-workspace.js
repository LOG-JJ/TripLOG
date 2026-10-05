(() => {
  const query = selector => document.querySelector(selector);
  let dialog, menu, toolsDialog, returnFocus, draftTripId, ready = false;
  const mapDraftKey = 'triplog.itineraryMapDraft.v1';
  const mapDraftFields = ['itineraryDaySelect', 'itineraryTimeInput', 'itineraryEndTimeInput',
    'itineraryThemeSelect', 'itineraryTransSelect', 'itineraryPlaceInput', 'itineraryLocationInput',
    'manualAddressInput', 'itineraryMemoInput', 'itineraryVoucherName', 'itineraryVoucherCode',
    'itineraryTransportName', 'itineraryTransportKind', 'itineraryTransportFrom', 'itineraryTransportTo', 'itineraryArrivalDate'];
  let pendingMapDraft = null, mapDraftAuthObserver;

  function clearMapDraft() {
    pendingMapDraft = null;
    mapDraftAuthObserver?.disconnect();
    try { sessionStorage.removeItem(mapDraftKey); } catch (_) { /* Storage may be unavailable. */ }
  }

  function prepareMapNavigation(event) {
    // Keep native link activation: mobile app links must not wait for a lookup,
    // window.open(), or a popup inside Google's cross-origin iframe.
    const link = els.googleMapsLink;
    if (!link.hasAttribute('href') || link.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
    link.target = matchMedia('(any-pointer: coarse)').matches ? '_self' : '_blank';
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.target !== '_self' || !dialog.open) return;
    cancelPlaceLookup();
    const external = new URL(link.href);
    const draft = {
      tripId: getActiveTripId(), savedAt: Date.now(), editingId: editingItineraryId, copying: itineraryCopying,
      fields: Object.fromEntries(mapDraftFields.map(id => [id, query(`#${id}`).value])),
      candidate: selectedPlaceCandidate, voucherFile: currentVoucherFile, voucherFileName: currentVoucherFileName,
      searchHidden: query('#itineraryPlaceSearchPanel').hidden,
      extraOpen: query('#itineraryExtraDetails').open, ticketOpen: !els.itineraryTicketSection.hidden,
      manualOpen: !els.manualAddressPanel.hidden,
      mapQuery: link.dataset.mapQuery || external.searchParams.get('query'), mapPlaceId: external.searchParams.get('query_place_id'),
      mapPlace: els.mapCurrentPlace.textContent, route: link.dataset.mapRoute === 'true' || external.pathname === '/maps/dir/',
    };
    try { sessionStorage.setItem(mapDraftKey, JSON.stringify(draft)); }
    catch (_) {
      // If storage is full/disabled, keep the live form in its existing tab.
      link.target = '_blank';
    }
  }

  function restoreMapDraft() {
    if (!pendingMapDraft || document.documentElement.dataset.auth !== 'signed-in') return;
    const draft = pendingMapDraft;
    clearMapDraft();
    if (dialog.open || draft.tripId !== getActiveTripId()
      || !Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > 24 * 60 * 60 * 1000
      || !getTripDays().some(day => day.date === draft.fields?.itineraryDaySelect)
      || (draft.editingId && !findItineraryItem(draft.editingId))) return;
    setActivePage('itinerary');
    clearItineraryEditMode(false);
    for (const id of mapDraftFields) {
      if (typeof draft.fields[id] === 'string') query(`#${id}`).value = draft.fields[id];
    }
    editingItineraryId = draft.editingId || null;
    itineraryCopying = !editingItineraryId && Boolean(draft.copying);
    selectedPlaceCandidate = draft.candidate || null;
    setVoucherFile(draft.voucherFile || null, draft.voucherFileName || null);
    els.ticketFileNameDisplay.textContent = currentVoucherFileName || '선택된 파일 없음';
    els.ticketFileResetBtn.style.display = currentVoucherFileName ? 'inline-flex' : 'none';
    [els.itineraryDaySelect, els.itineraryThemeSelect, els.itineraryTransSelect].forEach(input => syncCustomSelect(input));
    [els.itineraryTimeInput, els.itineraryEndTimeInput].forEach(input => syncCustomTimePicker(input));
    show({ edit: true, previewMap: false });
    query('#itineraryPlaceSearchPanel').hidden = Boolean(draft.searchHidden);
    query('#itineraryExtraDetails').open = Boolean(draft.extraOpen);
    els.itineraryTicketSection.hidden = !draft.ticketOpen;
    els.itineraryTicketToggleBtn.classList.toggle('open', Boolean(draft.ticketOpen));
    els.itineraryTicketToggleBtn.setAttribute('aria-expanded', String(Boolean(draft.ticketOpen)));
    els.itineraryTicketToggleBtn.querySelector('.ticket-toggle-chevron').textContent = draft.ticketOpen ? '▲' : '▼';
    els.manualAddressPanel.hidden = !draft.manualOpen;
    syncPlace();
    if (draft.route) showFullRoute();
    else if (draft.mapQuery) renderTripMapPreview({ place: draft.mapPlace, mapQuery: draft.mapQuery, placeId: draft.mapPlaceId });
    else previewRoute();
  }

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
    query("#itineraryEditorTitle").textContent = editingItineraryId ? "장소 수정" : itineraryCopying ? "일정 복사" : "장소 추가";
    els.itinerarySubmitButton.querySelector("span").textContent = editingItineraryId ? "일정 저장" : itineraryCopying ? "복사해서 추가" : "일정에 추가";
    const themeIcon = query("[data-itinerary-theme-icon]");
    if (themeIcon) themeIcon.className = `ph ph-${els.itineraryThemeSelect.value === "sightseeing" ? "bank" : (itineraryThemes[els.itineraryThemeSelect.value]?.icon || "map-pin")}`;
    const lodging = els.itineraryThemeSelect.value === 'lodging';
    const transport = els.itineraryThemeSelect.value === 'transport';
    query('#itineraryTransportFields').hidden = !transport;
    query('#itineraryTransportFields').disabled = !transport;
    els.itineraryVoucherName.closest('label').hidden = transport;
    syncCustomSelect(query('#itineraryTransportKind'));
    const startField = els.itineraryTimeInput.closest('.time-field-item');
    const endField = els.itineraryEndTimeInput.closest('.time-field-item');
    startField.querySelector(':scope > span').textContent = lodging ? '도착 시각' : transport ? '출발 시간' : '시작';
    startField.querySelector('.custom-time-button')?.setAttribute('aria-label', lodging ? '도착 시각 선택' : transport ? '출발 시간 선택' : '시작 시간 선택');
    startField.querySelector('.custom-time-value')?.setAttribute('aria-label', lodging ? '도착 시각' : transport ? '출발 시간' : '시작 시간');
    endField.hidden = lodging;
    endField.querySelector(':scope > span').textContent = transport ? '도착 시간' : '종료';
    endField.querySelector('.custom-time-button')?.setAttribute('aria-label', transport ? '도착 시간 선택' : '종료 시간 선택');
    endField.querySelector('.custom-time-value')?.setAttribute('aria-label', transport ? '도착 시간' : '종료 시간');
    els.itineraryEndTimeInput.disabled = lodging;
    syncCustomTimePicker(els.itineraryEndTimeInput);
    startField.parentElement.classList.toggle('is-lodging', lodging);
  }

  function show({ edit = false, previewMap = true } = {}) {
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
    if (previewMap) previewRoute();
  }

  function close() { if (dialog?.open) dialog.close(); }

  function cleanup() {
    hideEmbeddedDomesticMap(query('#itineraryDomesticMap'));
    clearMapDraft();
    leafletRenderToken++;
    cancelPlaceLookup();
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
    // The place summary does not fetch a second map provider's thumbnail.
    const thumbnail = query("#itineraryPlaceThumbnail");
    thumbnail.hidden = true;
    thumbnail.removeAttribute("src");
  }

  function previewRoute() {
    if (!dialog?.open) return;
    const date = els.itineraryDaySelect.value;
    const items = sortItineraryItems(state.itineraryItems.filter(item => item.date === date));
    const selected = selectedPlaceCandidate
      || items.find(item => item.id === editingItineraryId || item.id === state.selectedItineraryId)
      || items[0]
      || buildTripMapFallbackItem();
    updateMapPreview(selected);
  }

  function showFullRoute() {
    const items = sortItineraryItems(state.itineraryItems.filter(item => item.date === els.itineraryDaySelect.value));
    if (!items.length) { previewRoute(); return; }
    renderTripMapRoute(items);
  }

  function openMenu() { syncNaverMapsLink(); if (!menu.open) menu.showModal(); }

  function navigate(page) {
    menu?.close(); toolsDialog?.close(); close();
    setActivePage(page);
  }

  async function downloadTicket(item) {
    if (String(item.voucherFile || "").startsWith("triplog-attachment:")) {
      try {
        const url = await window.TripLog.sync.controller.attachmentUrl(state.id, item.voucherFile);
        const link = document.createElement("a"); link.href = url; link.download = item.voucherFileName || "여행-티켓"; link.rel = "noopener noreferrer"; link.click();
      } catch (_) { showToast("첨부 파일을 열지 못했어요. 인터넷 연결과 여행 권한을 확인해 주세요."); }
      return;
    }
    if (!/^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i.test(item.voucherFile || "")) {
      showToast("첨부 파일 형식을 확인해 주세요."); return;
    }
    const link = document.createElement("a"); link.href = item.voucherFile;
    link.download = item.voucherFileName || "여행-티켓"; link.click();
  }

  function setup() {
    if (ready) return; ready = true;
    dialog = query("#itineraryEditor"); menu = query("#itineraryMenuDialog"); toolsDialog = query("#itineraryToolsDialog");
    els.googleMapFrame.addEventListener("load", () => els.googleMapFrame.setAttribute("aria-busy", "false"));
    els.googleMapsLink.addEventListener('click', prepareMapNavigation);
    try { pendingMapDraft = JSON.parse(sessionStorage.getItem(mapDraftKey) || 'null'); } catch (_) { clearMapDraft(); }
    if (pendingMapDraft) {
      // Authentication can finish after init; restore only inside the signed-in app.
      mapDraftAuthObserver = new MutationObserver(restoreMapDraft);
      mapDraftAuthObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-auth'] });
      queueMicrotask(restoreMapDraft);
    }
    window.addEventListener('pageshow', event => {
      if (event.persisted && dialog.open) clearMapDraft(); // bfcache already retained the live form.
    });
    document.addEventListener('visibilitychange', () => {
      // App handoff can return without navigating away from this document.
      if (document.visibilityState === 'visible' && dialog.open) clearMapDraft();
    });
    [els.itineraryTimeInput, els.itineraryEndTimeInput].forEach(input => {
      const label = input === els.itineraryTimeInput ? "시작 시간" : "종료 시간";
      const shell = input.closest(".custom-time");
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
      if (event.target.closest("[data-itinerary-sync-status]")) { menu.close(); els.itineraryPageButton.click(); }
      if (event.target.closest("[data-itinerary-tools]")) {
        menu.close(); toolsDialog.showModal(); renderItineraryPage();
      }
    });
    query("#itineraryMenuButton").addEventListener("click", openMenu);
    query("#itineraryToolsClose").addEventListener("click", () => toolsDialog.close());
    query("#itineraryMapButton").addEventListener("click", () => show());
    els.itineraryViewAllButton.addEventListener("click", () => {
      const mode = state.selectedItineraryDate === "all" ? "edit" : "overview";
      els.itineraryModeToggle.querySelector(`[data-mode="${mode}"]`).click();
    });
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
      if (item && await (window.TripLog.features.redesign?.workspace?.confirmAction?.(`'${item.place}' 일정을 삭제할까요?`) ?? window.confirm(`'${item.place}' 일정을 삭제할까요?`)) && state.id===tripId && editingItineraryId===item.id) {
        query('#itineraryDeleteButton').disabled=true;els.itinerarySubmitButton.disabled=true;
        try { await deleteItineraryItem(item.id); }
        finally { query('#itineraryDeleteButton').disabled=false;els.itinerarySubmitButton.disabled=false; }
      }
    });
    // Native validation must be able to focus the place field when search is collapsed.
    els.itineraryPlaceInput.addEventListener("invalid", () => { query("#itineraryPlaceSearchPanel").hidden = false; });
    els.itineraryForm.addEventListener("input", () => { query("#itineraryFormError").hidden = true; });
    render();
  }

  window.TripLog.register("features.itinerary.workspace", { setup, render, show, close, syncPlace, previewRoute, showFullRoute, downloadTicket });
})();
