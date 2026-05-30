function handleItinerarySubmit(event) {
  event.preventDefault();
  const place = els.itineraryPlaceInput.value.trim();
  const location = els.itineraryLocationInput.value.trim() || place;
  if (!place) return;

  const id = editingItineraryId || createId();
  const existingItem = editingItineraryId ? findItineraryItem(editingItineraryId) : null;
  
  const trans = els.itineraryTransSelect.value || "none";
  const duration = Number(els.itineraryDurationInput.value) || 0;
  const cost = Number(els.itineraryCostInput.value) || 0;
  const syncExpense = els.itinerarySyncExpenseCheckbox.checked;
  let expenseId = existingItem ? existingItem.expenseId : null;

  const item = {
    id,
    date: els.itineraryDaySelect.value || state.selectedItineraryDate,
    time: els.itineraryTimeInput.value,
    place,
    location,
    memo: els.itineraryMemoInput.value.trim(),
    trans,
    duration,
    cost,
    syncExpense,
    expenseId,
    lat: selectedPlaceCandidate && selectedPlaceCandidate.place === place ? selectedPlaceCandidate.lat : (existingItem && existingItem.place === place ? existingItem.lat : undefined),
    lon: selectedPlaceCandidate && selectedPlaceCandidate.place === place ? selectedPlaceCandidate.lon : (existingItem && existingItem.place === place ? existingItem.lon : undefined),
    createdAt: existingItem ? existingItem.createdAt : Date.now(),
  };

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
  state.selectedItineraryId = item.id;
  clearItineraryEditMode(false);
  saveAndRender();
}

function startItineraryEdit(item) {
  editingItineraryId = item.id;
  state.selectedItineraryDate = item.date;
  state.selectedItineraryId = item.id;
  els.itineraryDaySelect.value = item.date;
  els.itineraryTimeInput.value = item.time || "";
  els.itineraryTransSelect.value = item.trans || "none";
  els.itineraryDurationInput.value = item.duration || "";
  els.itineraryCostInput.value = item.cost || "";
  els.itinerarySyncExpenseCheckbox.checked = item.syncExpense !== false;
  els.itineraryPlaceInput.value = item.place || "";
  els.itineraryLocationInput.value = item.location || "";
  els.manualAddressInput.value = item.location || "";
  els.itineraryMemoInput.value = item.memo || "";
  selectedPlaceCandidate = item.place && item.location ? { place: item.place, location: item.location } : null;
  setPlaceSearchStatus(item.location || "입력값 그대로 저장하거나 검색 결과를 선택할 수 있습니다.", item.location ? "success" : "neutral");
  closePlaceSearchResults();
  closeManualAddressPanel();
  els.itinerarySubmitButton.querySelector("span").textContent = "일정 저장";
  els.cancelItineraryEditButton.hidden = false;
  syncCustomSelect(els.itineraryDaySelect);
  syncCustomSelect(els.itineraryTransSelect);
  syncCustomTimePicker(els.itineraryTimeInput);
  updateMapPreview(item);
  els.itineraryPlaceInput.focus();
}

function clearItineraryEditMode(shouldRender = true) {
  editingItineraryId = null;
  els.itineraryForm.reset();
  els.itineraryDaySelect.value = state.selectedItineraryDate || state.startDate;
  els.itineraryTransSelect.value = "none";
  els.itineraryDurationInput.value = "";
  els.itineraryCostInput.value = "";
  els.itinerarySyncExpenseCheckbox.checked = true;
  els.itineraryLocationInput.value = "";
  els.manualAddressInput.value = "";
  selectedPlaceCandidate = null;
  setPlaceSearchStatus("입력값 그대로 저장하거나 검색 결과를 선택할 수 있습니다.");
  closePlaceSearchResults();
  closeManualAddressPanel();
  els.itinerarySubmitButton.querySelector("span").textContent = "일정 추가";
  els.cancelItineraryEditButton.hidden = true;
  syncCustomSelect(els.itineraryDaySelect);
  syncCustomSelect(els.itineraryTransSelect);
  syncCustomTimePicker(els.itineraryTimeInput);
  if (shouldRender) renderItineraryPage();
}

function selectItineraryItem(id) {
  state.selectedItineraryId = id;
  const item = findItineraryItem(id);
  if (item) {
    state.selectedItineraryDate = item.date;
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
});
