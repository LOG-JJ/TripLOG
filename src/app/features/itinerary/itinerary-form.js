let currentVoucherFile = null;
let currentVoucherFileName = null;
let voucherReadPromise = Promise.resolve(true);

function setVoucherFile(base64, name) {
  currentVoucherFile = base64;
  currentVoucherFileName = name;
  voucherReadPromise = Promise.resolve(true);
}
function setVoucherLoading(promise) { voucherReadPromise = promise.catch(() => false); }

function syncVoucherFileUi() {
  const name = currentVoucherFileName || '선택된 파일 없음';
  els.ticketFileNameDisplay.textContent = name;
  els.ticketFileNameDisplay.closest('.ticket-file-row').classList.toggle('is-long-filename', Array.from(name).length > 24);
  els.ticketFileResetBtn.style.display = 'none';
}

let itinerarySubmissionPending = false;
const itineraryDeletionsPending = new Set();
let initialPlaceCandidate = null;
let itineraryCopying = false;
function syncItinerarySubtype(value = els.itinerarySubtypeSelect.value) {
  const select = els.itinerarySubtypeSelect, theme = els.itineraryThemeSelect.value;
  if (select.dataset.theme !== theme) {
    select.dataset.theme = theme;
    select.replaceChildren(new Option('자동', ''), ...window.TripLog.shared.itineraryArt.subtypes(theme).map(row => new Option(row.label, row.id)));
  }
  select.value = window.TripLog.shared.itineraryArt.subtype({ theme, themeSubtype: value }) ? value : '';
  syncCustomSelect(select);
}
async function handleItinerarySubmit(event) {
  event.preventDefault();
  if (itinerarySubmissionPending) return;
  const tripId = state.id, itemId = editingItineraryId;
  itinerarySubmissionPending = true;
  try {
    if (!await voucherReadPromise) { showToast("첨부 파일을 읽지 못했어요. 파일을 다시 선택해 주세요."); return; }
    if (tripId !== state.id || itemId !== editingItineraryId) return;
    await saveItineraryForm(event);
  }
  finally { itinerarySubmissionPending = false; }
}

async function saveItineraryForm(event) {
  event.preventDefault();
  const place = els.itineraryPlaceInput.value.trim();
  const location = els.itineraryLocationInput.value.trim() || place;
  if (!place) return;
  if (!getTripDays().some(day => day.date === els.itineraryDaySelect.value)) {
    const error = document.querySelector("#itineraryFormError");
    error.textContent = "일정을 추가할 날짜를 선택해 주세요.";
    error.hidden = false;
    return;
  }
  const wasEditing = Boolean(editingItineraryId);
  const wasCopying = itineraryCopying;
  const submittedTrip = state.id;
  const submittedEditId = editingItineraryId;
  const previousItems = [...state.itineraryItems], previousEntries = [...state.entries], previousCompanion = state.travelCompanion;

  const id = editingItineraryId || createId();
  const existingItem = editingItineraryId ? findItineraryItem(editingItineraryId) : null;

  // A place edit must preserve the incoming travel recorded in its own editor.
  const trans = existingItem?.transits?.[0]?.trans || existingItem?.trans || "none";
  const theme = els.itineraryThemeSelect.value || "sightseeing";
  const transits = Array.isArray(existingItem?.transits)
    ? existingItem.transits
    : [{ trans, duration: Number(existingItem?.duration) || 0, cost: Number(existingItem?.cost) || 0, memo: "" }];
  const duration = transits.reduce((acc, segment) => acc + (Number(segment.duration) || 0), 0);
  const cost = transits.reduce((acc, segment) => acc + (Number(segment.cost) || 0), 0);
  const syncExpense = existingItem ? existingItem.syncExpense !== false : true;
  const expenseId = existingItem ? existingItem.expenseId : null;

  const voucherName = els.itineraryVoucherName.value.trim();
  const voucherCode = els.itineraryVoucherCode.value.trim();

  const candidateSelected = selectedPlaceCandidate && selectedPlaceCandidate.place === place;
  const candidateHasCoords = candidateSelected
    && Boolean(getItemLatLng(selectedPlaceCandidate));
  const existingPlaceUnchanged = existingItem?.place === place && (existingItem.location || existingItem.place) === location;
  const existingCoordsStillValid = existingItem
    && !candidateSelected
    && existingPlaceUnchanged
    && hasMatchingCoordinateSignature(existingItem);

  const item = {
    ...existingItem,
    id,
    date: els.itineraryDaySelect.value || state.selectedItineraryDate,
    time: els.itineraryTimeInput.value,
    endTime: els.itineraryEndTimeInput.value,
    place,
    location,
    mapQuery: candidateSelected ? (selectedPlaceCandidate.mapQuery || "") : (existingPlaceUnchanged ? existingItem.mapQuery || "" : ""),
    memo: els.itineraryMemoInput.value.trim(),
    theme,
    themeSubtype: els.itinerarySubtypeSelect.value,
    trans,
    transits,
    voucherName,
    voucherCode,
    voucherFile: currentVoucherFile,
    voucherFileName: currentVoucherFileName,
    duration,
    cost,
    syncExpense,
    expenseId,
    lat: candidateHasCoords ? selectedPlaceCandidate.lat : (existingCoordsStillValid ? existingItem.lat : undefined),
    lon: candidateHasCoords ? selectedPlaceCandidate.lon : (existingCoordsStillValid ? existingItem.lon : undefined),
    coordinateSource: "",
    coordinateSignature: "",
    coordinatePrecision: "",
    coordinateAddress: "",
    googlePlaceId: "",
    createdAt: existingItem ? existingItem.createdAt : Date.now(),
  };

  if (!window.TripLog.shared.itineraryArt.subtype(item)) delete item.themeSubtype;

  // Transport bookings belong to the reservation wallet. A generic schedule
  // edit preserves existing booking metadata and never creates a new booking.
  if (existingItem?.reservationStayDate && (item.date !== existingItem.date || theme !== 'lodging')) {
    delete item.reservationStayDate;
    delete item.linkedReservationId;
  }

  if (candidateSelected) {
    item.coordinateSource = selectedPlaceCandidate.source || "";
    item.coordinatePrecision = selectedPlaceCandidate.precision || "";
    item.coordinateAddress = selectedPlaceCandidate.location || "";
    item.googlePlaceId = isGoogleSearchOnlyItem(selectedPlaceCandidate) ? "" : selectedPlaceCandidate.placeId || selectedPlaceCandidate.googlePlaceId || "";
  }

  if (isValidLatLng(parseFloat(item.lat), parseFloat(item.lon))) {
    item.coordinateSignature = buildItemCoordinateSignature(item);
    item.coordinateSource = candidateHasCoords ? (selectedPlaceCandidate.source || "") : (existingItem.coordinateSource || "");
    item.coordinatePrecision = candidateHasCoords ? (selectedPlaceCandidate.precision || "") : (existingItem.coordinatePrecision || "");
    item.coordinateAddress = candidateHasCoords ? (selectedPlaceCandidate.location || "") : (existingItem.coordinateAddress || "");
    item.googlePlaceId = candidateHasCoords ? (selectedPlaceCandidate.placeId || selectedPlaceCandidate.googlePlaceId || "") : (existingItem.googlePlaceId || "");
  }

  if (existingItem) {
    // This editor owns place, schedule, memo and voucher inputs. Opening it or
    // saving an unrelated field must not turn display defaults into new writes.
    const unchanged = ['time', 'endTime', 'memo', 'themeSubtype', 'voucherName', 'voucherCode', 'voucherFile', 'voucherFileName']
      .filter(key => String(item[key] ?? '') === String(existingItem[key] ?? ''));
    if (theme === (existingItem.theme || 'sightseeing')) unchanged.push('theme');
    if (existingPlaceUnchanged && (!candidateSelected || selectedPlaceCandidate === initialPlaceCandidate)) {
      unchanged.push('place', 'location', 'lat', 'lon', 'mapQuery', 'coordinateSource', 'coordinateSignature', 'coordinatePrecision', 'coordinateAddress', 'googlePlaceId');
    }
    unchanged.push('trans', 'transits', 'duration', 'cost', 'syncExpense', 'expenseId');
    for (const key of unchanged) {
      if (Object.hasOwn(existingItem, key)) item[key] = existingItem[key];
      else delete item[key];
    }
  }

  // Place edits update the linked description/date, never the money or the
  // incoming transit settings owned by the separate movement editor.
  const latestItem = existingItem && (window.TripLogSyncRepository?.cached(submittedTrip)?.snapshot.itineraryItems.find(entry => entry.id === id) || existingItem);
  if (latestItem?.expenseId && (place !== existingItem.place || item.date !== existingItem.date)) {
    const transLabels = { walk: "도보", car: "차량", train: "기차", bus: "버스", flight: "비행", etc: "비행", none: "이동" };
    const desc = `${item.place} 이동 경비 (${getItineraryTransits(latestItem).map(segment => transLabels[segment.trans] || "이동").join("+")})`;
    state.entries = state.entries.map(entry => entry.id === latestItem.expenseId ? {
      ...entry,
      ...(item.date !== existingItem.date ? {date:item.date} : {}),
      ...(place !== existingItem.place ? {description:desc} : {}),
    } : entry);
  }

  if (editingItineraryId) {
    state.itineraryItems = state.itineraryItems.map((entry) => (entry.id === editingItineraryId ? item : entry));
  } else {
    state.itineraryItems.push(item);
  }

  state.selectedItineraryDate = item.date;
  state.lastActiveItineraryDate = item.date;
  state.selectedItineraryId = item.id;
  if (!await saveAndRender()) {
    if (state.id === submittedTrip) { state.itineraryItems = previousItems; state.entries = previousEntries; state.travelCompanion = previousCompanion; }
    showToast("기기에 저장하지 못했어요. 입력 내용은 유지됩니다.");
    return;
  }
  if (state.id !== submittedTrip) return;
  await window.TripLog.sync.drafts?.clear("itineraryForm", submittedTrip, submittedEditId);
  window.TripLog.features.itinerary.workspace?.close?.();
  clearItineraryEditMode(false);
  window.TripLog.persistence.stateStorage.applyRepositoryChange?.(submittedTrip);
  showToast(window.TripLogSyncRepository.cached(submittedTrip)?.conflicts.length ? "변경을 보관했어요. 상단 저장 상태에서 겹친 변경을 확인해 주세요." : wasEditing ? "일정을 저장했어요." : wasCopying ? "일정을 복사했어요." : "일정을 추가했어요.");
}

function startItineraryEdit(item, { copy = false } = {}) {
  itineraryCopying = copy;
  editingItineraryId = copy ? null : item.id;
  state.selectedItineraryDate = item.date;
  state.lastActiveItineraryDate = item.date;
  state.selectedItineraryId = item.id;

  // Rerender so that the active day tab/dropdown switches cleanly first
  saveAndRender();

  els.itineraryDaySelect.value = item.date;
  els.itineraryTimeInput.value = item.time || "";
  els.itineraryEndTimeInput.value = item.endTime || "";
  els.itineraryTransSelect.value = "none";
  els.itineraryThemeSelect.value = item.theme || "sightseeing";
  syncItinerarySubtype(item.themeSubtype || '');
  els.itineraryPlaceInput.value = item.place || "";
  els.itineraryLocationInput.value = item.location || "";
  els.manualAddressInput.value = item.location || "";
  els.itineraryMemoInput.value = item.memo || "";
  
  // Voucher binding
  els.itineraryVoucherName.value = item.voucherName || "";
  els.itineraryVoucherCode.value = item.voucherCode || "";
  currentVoucherFile = item.voucherFile || null;
  currentVoucherFileName = item.voucherFileName || null;
  voucherReadPromise = Promise.resolve(true);
  syncVoucherFileUi();

  const hasVoucher = !!(item.voucherName || item.voucherCode || item.voucherFileName);
  els.itineraryTicketSection.hidden = !hasVoucher;
  els.itineraryTicketToggleBtn.classList.toggle("open", hasVoucher);
  els.itineraryTicketToggleBtn.setAttribute("aria-expanded", String(hasVoucher));
  els.itineraryTicketToggleBtn.querySelector(".ticket-toggle-chevron").textContent = hasVoucher ? "▲" : "▼";

  selectedPlaceCandidate = item.place ? { ...item, source: item.coordinateSource || "" } : null;
  initialPlaceCandidate = selectedPlaceCandidate;
  setPlaceSearchStatus(item.location || "입력값 그대로 저장하거나 검색 결과를 선택할 수 있습니다.", item.location ? "success" : "neutral");
  closePlaceSearchResults();
  closeManualAddressPanel();
  els.itinerarySubmitButton.querySelector("span").textContent = "일정 저장";
  els.cancelItineraryEditButton.hidden = false;
  syncCustomSelect(els.itineraryDaySelect);
  syncCustomSelect(els.itineraryTransSelect);
  syncCustomSelect(els.itineraryThemeSelect);
  syncCustomTimePicker(els.itineraryTimeInput);
  syncCustomTimePicker(els.itineraryEndTimeInput);
  if (window.TripLog.features.itinerary.workspace) window.TripLog.features.itinerary.workspace.show({ edit: true });
  else { updateMapPreview(item); els.itineraryPlaceInput.focus(); }
}

function clearItineraryEditMode(shouldRender = true) {
  editingItineraryId = null;
  itineraryCopying = false;
  els.itineraryForm.reset();
  els.itineraryDaySelect.value = state.selectedItineraryDate || state.startDate;
  els.itineraryTransSelect.value = "none";
  els.itineraryThemeSelect.value = "sightseeing";
  syncItinerarySubtype('');
  els.itineraryLocationInput.value = "";
  els.manualAddressInput.value = "";
  
  // Reset voucher fields
  els.itineraryVoucherName.value = "";
  els.itineraryVoucherCode.value = "";
  els.itineraryVoucherFile.value = "";
  currentVoucherFile = null;
  currentVoucherFileName = null;
  voucherReadPromise = Promise.resolve(true);
  syncVoucherFileUi();
  
  if (els.itineraryTicketSection) {
    els.itineraryTicketSection.hidden = true;
    els.itineraryTicketToggleBtn.classList.remove("open");
    els.itineraryTicketToggleBtn.setAttribute("aria-expanded", "false");
    els.itineraryTicketToggleBtn.querySelector(".ticket-toggle-chevron").textContent = "▼";
  }

  selectedPlaceCandidate = null;
  initialPlaceCandidate = null;
  setPlaceSearchStatus("입력값 그대로 저장하거나 검색 결과를 선택할 수 있습니다.");
  closePlaceSearchResults();
  closeManualAddressPanel();
  els.itinerarySubmitButton.querySelector("span").textContent = "일정 추가";
  els.cancelItineraryEditButton.hidden = true;
  syncCustomSelect(els.itineraryDaySelect);
  syncCustomSelect(els.itineraryTransSelect);
  syncCustomSelect(els.itineraryThemeSelect);
  syncCustomTimePicker(els.itineraryTimeInput);
  syncCustomTimePicker(els.itineraryEndTimeInput);
  if (shouldRender) renderItineraryPage();
}

function selectItineraryItem(id) {
  state.selectedItineraryId = id;
  const item = findItineraryItem(id);
  if (item) {
    state.selectedItineraryDate = item.date;
    state.lastActiveItineraryDate = item.date;
    if (document.querySelector("#itineraryEditor")?.open) updateMapPreview(item);
  }
  saveAndRender();
}

async function deleteItineraryItem(id) {
  const tripId = state.id, operation = `${tripId}:${id}`;
  const item = findItineraryItem(id);
  if (!item || itineraryDeletionsPending.has(operation)) return false;
  itineraryDeletionsPending.add(operation);
  const previous = {items:state.itineraryItems,entries:state.entries,companion:state.travelCompanion,selected:state.selectedItineraryId};
  try {
    window.TripLog.persistence.stateStorage.markDeletedEntity("itinerary", id);
    if (item.expenseId) {
      window.TripLog.persistence.stateStorage.markDeletedEntity("expense", item.expenseId);
      state.entries = state.entries.filter(entry => entry.id !== item.expenseId);
    }
    state.itineraryItems = state.itineraryItems.filter(item => item.id !== id);
    if (state.selectedItineraryId === id) state.selectedItineraryId = state.itineraryItems[0]?.id || "";
    if (!await saveAndRender()) {
      if (state.id === tripId) {
        state.itineraryItems=previous.items;state.entries=previous.entries;state.travelCompanion=previous.companion;state.selectedItineraryId=previous.selected;
        render();
      }
      showToast("삭제를 저장하지 못했어요. 일정은 유지됩니다. 다시 시도해 주세요.");
      return false;
    }
    if (window.TripLogSyncRepository?.cached(tripId)?.snapshot.itineraryItems.some(item => item.id === id)) {
      showToast("다른 변경과 겹쳐 삭제하지 않았어요. 저장 상태에서 변경 내용을 확인해 주세요.");
      return false;
    }
    if (state.id === tripId && editingItineraryId === id) {
      window.TripLog.features.itinerary.workspace?.close?.();
      clearItineraryEditMode(false);
    }
    await window.TripLog.sync.drafts?.clear("itineraryForm", tripId, id);
    showToast("일정 삭제를 저장했어요.");
    return true;
  } finally {
    itineraryDeletionsPending.delete(operation);
  }
}

function findItineraryItem(id) {
  return state.itineraryItems.find((item) => item.id === id);
}

function getFilteredItineraryItems() {
  return sortItineraryItems(state.itineraryItems.filter(item => state.selectedItineraryDate === 'all' || item.date === state.selectedItineraryDate));
}

window.TripLog.register("features.itinerary.form", {
  handleItinerarySubmit,
  startItineraryEdit,
  clearItineraryEditMode,
  selectItineraryItem,
  deleteItineraryItem,
  findItineraryItem,
  getFilteredItineraryItems,
  setVoucherFile,
  setVoucherLoading,
  syncVoucherFileUi,
});
