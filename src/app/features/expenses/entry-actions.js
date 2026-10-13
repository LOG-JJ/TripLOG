function setFilter(filter) {
  if (!filter) return;
  activeFilter = filter;
  document.querySelectorAll(".segmented button[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === activeFilter);
  });
  render();
}

function startEdit(entry, options = {}) {
  if (!entry) return;
  const reservation = ['flight', 'hotel'].includes(entry.pretripType);
  window.TripLog.features.expenses.workspace?.captureTripPreferences();
  window.TripLog.features.expenses.receiptInput.reset();
  editingId = entry.id;
  state.selectedDate = entry.date;
  state.travelMode = entry.mode === "overseas" ? "overseas" : "domestic";
  els.daySelect.value = entry.date;
  els.categorySelect.value = entry.category;
  els.descriptionInput.value = entry.description;
  els.currencySelect.value = entry.currency || (reservation ? "KRW" : "JPY");
  const wonReservation = reservation && els.currencySelect.value === "KRW";
  setCommaNumberInputValue(els.foreignAmountInput, wonReservation ? entry.amount : entry.foreignAmount || "");
  setCommaNumberInputValue(els.exchangeRateInput, wonReservation ? 1 : getEditableExchangeRate(entry));
  setCommaNumberInputValue(els.amountInput, entry.amount);
  els.noteInput.value = reservation ? getPretripMemo(entry) : entry.note || "";
  setPaymentMethod(entry.paymentMethod || DEFAULT_PAYMENT_METHOD);
  renderModeControls();
  syncCustomSelect(els.daySelect);
  syncCustomSelect(els.categorySelect);
  syncCustomSelect(els.currencySelect);
  els.submitButton.querySelector("span").textContent = "저장";
  els.descriptionInput.focus();
  window.TripLog.features.redesign.workspace.openExpenseEditor(entry, options);
}

function clearEditMode() {
  window.TripLog.features.expenses.workspace?.restoreTripPreferences();
  window.TripLog.features.expenses.receiptInput.reset();
  editingId = null;
  els.expenseForm.reset();
  els.daySelect.value = state.selectedDate;
  els.categorySelect.value = getDefaultExpenseCategory();
  els.currencySelect.value = getExpenseDefaultCurrencyCode();
  setCommaNumberInputValue(els.foreignAmountInput, "");
  setCommaNumberInputValue(els.exchangeRateInput, "");
  setCommaNumberInputValue(els.amountInput, "");
  setPaymentMethod(DEFAULT_PAYMENT_METHOD);
  renderModeControls();
  syncCustomSelect(els.daySelect);
  syncCustomSelect(els.categorySelect);
  syncCustomSelect(els.currencySelect);
  els.submitButton.querySelector("span").textContent = "추가";
}

function deleteEntry(id) {
  window.TripLog.persistence.stateStorage.markDeletedEntity("expense", id);
  state.entries = state.entries.filter((entry) => entry.id !== id);
  state.itineraryItems = state.itineraryItems.map(item => item.expenseId === id ? { ...item, expenseId: null, syncExpense: false } : item);
  if (editingId === id) clearEditMode();
  saveAndRender();
}

function findEntry(id) {
  return state.entries.find((entry) => entry.id === id);
}

function getFilteredEntries() {
  const query = (els.expenseSearchInput?.value || "").trim().toLowerCase();
  const sortOption = els.expenseSortSelect?.value || "default";

  let result = activeFilter === "전체"
    ? [...state.entries]
    : state.entries.filter((entry) => entry.category === activeFilter);

  if (query) {
    result = result.filter((entry) => 
      (entry.description || "").toLowerCase().includes(query) ||
      (entry.note || "").toLowerCase().includes(query) ||
      (entry.category || "").toLowerCase().includes(query) ||
      getPaymentMethodLabel(entry.paymentMethod).includes(query)
    );
  }

  if (sortOption === "amountDesc") {
    result.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  } else if (sortOption === "amountAsc") {
    result.sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
  } else if (sortOption === "descAsc") {
    result.sort((a, b) => (a.description || "").localeCompare(b.description || ""));
  } else if (sortOption === 'default' || sortOption === 'dateAsc') {
    const paymentDate = entry => window.TripLog.features.redesign?.model?.paymentDate(entry) || entry.date || '';
    const direction = sortOption === 'dateAsc' ? 1 : -1;
    result.sort((a, b) => direction * (paymentDate(a).localeCompare(paymentDate(b)) || (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)));
  } else {
    result.sort((a, b) => {
      const dateDiff = compareExpenseEntryDates(a, b);
      return dateDiff || a.createdAt - b.createdAt;
    });
  }

  return result;
}

function calculateTotals() { return window.TripLog.shared.travelCosts.summarize(state); }


window.TripLog.register("features.expenses.entryActions", {
  setFilter,
  startEdit,
  clearEditMode,
  deleteEntry,
  findEntry,
  getFilteredEntries,
  calculateTotals,
});
