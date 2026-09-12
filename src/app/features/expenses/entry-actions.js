function setFilter(filter) {
  if (!filter) return;
  activeFilter = filter;
  document.querySelectorAll(".segmented button[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === activeFilter);
  });
  render();
}

function startEdit(entry) {
  window.TripLog.features.expenses.receiptInput.reset();
  editingId = entry.id;
  state.travelMode = entry.mode === "overseas" ? "overseas" : "domestic";
  els.daySelect.value = entry.date;
  els.categorySelect.value = entry.category;
  els.descriptionInput.value = entry.description;
  els.currencySelect.value = entry.currency || "JPY";
  setCommaNumberInputValue(els.foreignAmountInput, entry.foreignAmount || "");
  setCommaNumberInputValue(els.exchangeRateInput, getEditableExchangeRate(entry));
  setCommaNumberInputValue(els.amountInput, entry.amount);
  els.noteInput.value = entry.note;
  setPaymentMethod(entry.paymentMethod || DEFAULT_PAYMENT_METHOD);
  renderModeControls();
  syncCustomSelect(els.daySelect);
  syncCustomSelect(els.categorySelect);
  syncCustomSelect(els.currencySelect);
  els.submitButton.querySelector("span").textContent = "저장";
  els.cancelEditButton.hidden = false;
  els.descriptionInput.focus();
}

function clearEditMode() {
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
  els.cancelEditButton.hidden = true;
}

function deleteEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
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
  } else {
    result.sort((a, b) => {
      const dateDiff = compareExpenseEntryDates(a, b);
      return dateDiff || a.createdAt - b.createdAt;
    });
  }

  return result;
}

function calculateTotals() {
  const byCategory = Object.fromEntries(categories.map((category) => [category.name, 0]));

  state.entries.forEach((entry) => {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + Number(entry.amount || 0);
  });

  const total = Object.values(byCategory).reduce((sum, amount) => sum + amount, 0);
  const topCategory = categories
    .map((category) => ({ ...category, amount: byCategory[category.name] || 0 }))
    .sort((a, b) => b.amount - a.amount)[0];
  const maxEntry = [...state.entries]
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0] || null;

  return {
    total,
    byCategory,
    topCategory: topCategory?.amount ? topCategory : null,
    maxEntry,
  };
}


window.TripLog.register("features.expenses.entryActions", {
  setFilter,
  startEdit,
  clearEditMode,
  deleteEntry,
  findEntry,
  getFilteredEntries,
  calculateTotals,
});
