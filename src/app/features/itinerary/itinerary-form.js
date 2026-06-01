let currentVoucherFile = null;
let currentVoucherFileName = null;

function setVoucherFile(base64, name) {
  currentVoucherFile = base64;
  currentVoucherFileName = name;
}

function handleItinerarySubmit(event) {
  event.preventDefault();
  const place = els.itineraryPlaceInput.value.trim();
  const location = els.itineraryLocationInput.value.trim() || place;
  if (!place) return;

  const id = editingItineraryId || createId();
  const existingItem = editingItineraryId ? findItineraryItem(editingItineraryId) : null;

  const trans = els.itineraryTransSelect.value || "none";
  const theme = els.itineraryThemeSelect.value || "sightseeing";
  const duration = Number(els.itineraryDurationInput.value) || 0;
  const cost = Number(els.itineraryCostInput.value) || 0;
  const syncExpense = els.itinerarySyncExpenseCheckbox.checked;
  let expenseId = existingItem ? existingItem.expenseId : null;

  const voucherName = els.itineraryVoucherName.value.trim();
  const voucherCode = els.itineraryVoucherCode.value.trim();

  const candidateSelected = selectedPlaceCandidate && selectedPlaceCandidate.place === place;
  const candidateHasCoords = candidateSelected
    && isValidLatLng(parseFloat(selectedPlaceCandidate.lat), parseFloat(selectedPlaceCandidate.lon));
  const existingCoordsStillValid = existingItem
    && !candidateSelected
    && existingItem.place === place
    && existingItem.location === location
    && hasMatchingCoordinateSignature(existingItem);

  const item = {
    id,
    date: els.itineraryDaySelect.value || state.selectedItineraryDate,
    time: els.itineraryTimeInput.value,
    endTime: els.itineraryEndTimeInput.value,
    place,
    location,
    mapQuery: candidateSelected ? (selectedPlaceCandidate.mapQuery || "") : (existingItem?.mapQuery || ""),
    memo: els.itineraryMemoInput.value.trim(),
    theme,
    trans,
    transits: existingItem && existingItem.transits ? existingItem.transits : [{ trans, duration, cost, memo: "" }],
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
    createdAt: existingItem ? existingItem.createdAt : Date.now(),
  };

  if (candidateSelected) {
    item.coordinateSource = selectedPlaceCandidate.source || "";
    item.coordinatePrecision = selectedPlaceCandidate.precision || "";
    item.coordinateAddress = selectedPlaceCandidate.location || "";
    item.googlePlaceId = selectedPlaceCandidate.placeId || "";
  }

  if (isValidLatLng(parseFloat(item.lat), parseFloat(item.lon))) {
    item.coordinateSignature = buildItemCoordinateSignature(item);
    item.coordinateSource = candidateHasCoords ? (selectedPlaceCandidate.source || "") : (existingItem.coordinateSource || "");
    item.coordinatePrecision = candidateHasCoords ? (selectedPlaceCandidate.precision || "") : (existingItem.coordinatePrecision || "");
    item.coordinateAddress = candidateHasCoords ? (selectedPlaceCandidate.location || "") : (existingItem.coordinateAddress || "");
    item.googlePlaceId = candidateHasCoords ? (selectedPlaceCandidate.placeId || "") : (existingItem.googlePlaceId || "");
  }

  // Sync with main expense ledger
  if (syncExpense && cost > 0) {
    const transLabels = { walk: "도보", car: "자동차", bus: "대중교통", etc: "항공/기타", none: "이동" };
    const desc = `${item.place} 이동 경비 (${transLabels[trans] || "이동"})`;
    if (expenseId) {
      state.entries = state.entries.map((entry) => {
        if (entry.id === expenseId) {
          return { ...entry, date: item.date, amount: cost, description: desc };
        }
        return entry;
      });
    } else {
      const newEntry = createEntry(item.date, "교통", desc, cost, "일정 자동 연동");
      item.expenseId = newEntry.id;
      state.entries.push(newEntry);
    }
  } else {
    if (expenseId) {
      state.entries = state.entries.filter((entry) => entry.id !== expenseId);
      item.expenseId = null;
    }
  }

  if (editingItineraryId) {
    state.itineraryItems = state.itineraryItems.map((entry) => (entry.id === editingItineraryId ? item : entry));
  } else {
    state.itineraryItems.push(item);
  }

  state.selectedItineraryDate = item.date;
  state.lastActiveItineraryDate = item.date;
  state.selectedItineraryId = item.id;
  clearItineraryEditMode(false);
  saveAndRender();
}

function startItineraryEdit(item) {
  editingItineraryId = item.id;
  state.selectedItineraryDate = item.date;
  state.lastActiveItineraryDate = item.date;
  state.selectedItineraryId = item.id;

  // Rerender so that the active day tab/dropdown switches cleanly first
  saveAndRender();

  els.itineraryDaySelect.value = item.date;
  els.itineraryTimeInput.value = item.time || "";
  els.itineraryEndTimeInput.value = item.endTime || "";
  els.itineraryTransSelect.value = item.trans || "none";
  els.itineraryThemeSelect.value = item.theme || "sightseeing";
  els.itineraryDurationInput.value = item.duration || "";
  els.itineraryCostInput.value = item.cost || "";
  els.itinerarySyncExpenseCheckbox.checked = item.syncExpense !== false;
  els.itineraryPlaceInput.value = item.place || "";
  els.itineraryLocationInput.value = item.location || "";
  els.manualAddressInput.value = item.location || "";
  els.itineraryMemoInput.value = item.memo || "";
  
  // Voucher binding
  els.itineraryVoucherName.value = item.voucherName || "";
  els.itineraryVoucherCode.value = item.voucherCode || "";
  currentVoucherFile = item.voucherFile || null;
  currentVoucherFileName = item.voucherFileName || null;
  if (currentVoucherFileName) {
    els.ticketFileNameDisplay.textContent = currentVoucherFileName;
    els.ticketFileResetBtn.style.display = "inline-flex";
  } else {
    els.ticketFileNameDisplay.textContent = "선택된 파일 없음";
    els.ticketFileResetBtn.style.display = "none";
  }

  const hasVoucher = !!(item.voucherName || item.voucherCode || item.voucherFileName);
  els.itineraryTicketSection.hidden = !hasVoucher;
  els.itineraryTicketToggleBtn.classList.toggle("open", hasVoucher);
  els.itineraryTicketToggleBtn.querySelector(".ticket-toggle-chevron").textContent = hasVoucher ? "▲" : "▼";

  selectedPlaceCandidate = item.place && item.location ? { place: item.place, location: item.location } : null;
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
  updateMapPreview(item);
  els.itineraryPlaceInput.focus();
}

function clearItineraryEditMode(shouldRender = true) {
  editingItineraryId = null;
  els.itineraryForm.reset();
  els.itineraryDaySelect.value = state.selectedItineraryDate || state.startDate;
  els.itineraryTransSelect.value = "none";
  els.itineraryThemeSelect.value = "sightseeing";
  els.itineraryDurationInput.value = "";
  els.itineraryCostInput.value = "";
  els.itinerarySyncExpenseCheckbox.checked = true;
  els.itineraryLocationInput.value = "";
  els.manualAddressInput.value = "";
  
  // Reset voucher fields
  els.itineraryVoucherName.value = "";
  els.itineraryVoucherCode.value = "";
  els.itineraryVoucherFile.value = "";
  els.ticketFileNameDisplay.textContent = "선택된 파일 없음";
  els.ticketFileResetBtn.style.display = "none";
  currentVoucherFile = null;
  currentVoucherFileName = null;
  
  if (els.itineraryTicketSection) {
    els.itineraryTicketSection.hidden = true;
    els.itineraryTicketToggleBtn.classList.remove("open");
    els.itineraryTicketToggleBtn.querySelector(".ticket-toggle-chevron").textContent = "▼";
  }

  selectedPlaceCandidate = null;
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
    updateMapPreview(item);
  }
  saveAndRender();
}

function deleteItineraryItem(id) {
  const item = findItineraryItem(id);
  if (item && item.expenseId) {
    state.entries = state.entries.filter((entry) => entry.id !== item.expenseId);
  }
  state.itineraryItems = state.itineraryItems.filter((item) => item.id !== id);
  if (editingItineraryId === id) clearItineraryEditMode(false);
  if (state.selectedItineraryId === id) state.selectedItineraryId = state.itineraryItems[0]?.id || "";
  saveAndRender();
}

function findItineraryItem(id) {
  return state.itineraryItems.find((item) => item.id === id);
}

function getFilteredItineraryItems() {
  if (state.selectedItineraryDate === "all") {
    return [...state.itineraryItems].sort((a, b) => {
      const dateDiff = (a.date || "").localeCompare(b.date || "");
      if (dateDiff !== 0) return dateDiff;
      const timeDiff = (a.time || "99:99").localeCompare(b.time || "99:99");
      return timeDiff || a.createdAt - b.createdAt;
    });
  }
  return [...state.itineraryItems]
    .filter((item) => item.date === state.selectedItineraryDate)
    .sort((a, b) => {
      const timeDiff = (a.time || "99:99").localeCompare(b.time || "99:99");
      return timeDiff || a.createdAt - b.createdAt;
    });
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
});
