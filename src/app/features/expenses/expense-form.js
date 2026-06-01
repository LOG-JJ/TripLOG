function handleExpenseSubmit(event) {
  event.preventDefault();

  if (state.travelMode === "overseas") updateConvertedAmount();

  const amount = Math.max(0, Number(els.amountInput.value || 0));
  if (!amount || !els.descriptionInput.value.trim()) return;
  const isOverseas = state.travelMode === "overseas";
  const currency = getCurrencyMeta(els.currencySelect.value);
  const foreignAmount = Math.max(0, Number(els.foreignAmountInput.value || 0));
  const exchangeRate = Math.max(0, Number(els.exchangeRateInput.value || 0));

  if (isLodgingSplitMode()) {
    const lodgingPlan = getLodgingPlan();
    if (!lodgingPlan.valid) {
      window.alert(lodgingPlan.message || "숙소 체크인/체크아웃 날짜를 확인해 주세요.");
      updateLodgingPreview();
      return;
    }

    state.entries.push(
      ...createLodgingEntries({
        checkIn: lodgingPlan.checkIn,
        checkOut: lodgingPlan.checkOut,
        nights: lodgingPlan.nights,
        description: els.descriptionInput.value.trim(),
        amount,
        note: els.noteInput.value.trim(),
        isOverseas,
        currency,
        foreignAmount,
        exchangeRate,
      }),
    );

    resetExpenseFormAfterSubmit();
    saveAndRender();
    return;
  }

  const entry = {
    id: editingId || createId(),
    date: els.daySelect.value,
    category: els.categorySelect.value,
    description: els.descriptionInput.value.trim(),
    amount,
    note: els.noteInput.value.trim(),
    mode: isOverseas ? "overseas" : "domestic",
    currency: isOverseas ? currency.code : "",
    currencySymbol: isOverseas ? currency.symbol : "",
    currencyUnit: isOverseas ? currency.unit : "",
    exchangeBase: isOverseas ? currency.rateBase : 1,
    foreignAmount: isOverseas ? foreignAmount : 0,
    exchangeRate: isOverseas ? exchangeRate : 0,
    createdAt: editingId ? findEntry(editingId)?.createdAt || Date.now() : Date.now(),
  };

  if (editingId) {
    state.entries = state.entries.map((item) => (item.id === editingId ? entry : item));
    clearEditMode();
  } else {
    state.entries.push(entry);
    resetExpenseFormAfterSubmit();
  }

  saveAndRender();
}

function resetExpenseFormAfterSubmit() {
  els.expenseForm.reset();
  els.daySelect.value = state.selectedDate;
  els.categorySelect.value = getDefaultExpenseCategory();
  els.currencySelect.value = "JPY";
  els.lodgingCheckInInput.value = "";
  els.lodgingCheckOutInput.value = "";
  if (state.travelMode === "overseas") {
    els.amountInput.value = "";
    els.foreignAmountInput.value = "";
    els.exchangeRateInput.value = "";
  }
  renderExpenseFormMode();
}

function getDefaultExpenseCategory() {
  return "식비";
}

window.TripLog.register("features.expenses.form", {
  handleExpenseSubmit,
  resetExpenseFormAfterSubmit,
  getDefaultExpenseCategory,
});
