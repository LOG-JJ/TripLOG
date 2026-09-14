const DEFAULT_PAYMENT_METHOD = "card";
const PAYMENT_METHOD_LABELS = {
  card: "카드",
  cash: "현금",
};

function normalizePaymentMethod(value) {
  return Object.hasOwn(PAYMENT_METHOD_LABELS, value) ? value : DEFAULT_PAYMENT_METHOD;
}

function getPaymentMethodLabel(value) {
  return PAYMENT_METHOD_LABELS[value] || "";
}

function getSelectedPaymentMethod() {
  return normalizePaymentMethod(els.paymentMethodInput?.value);
}

function setPaymentMethod(value = DEFAULT_PAYMENT_METHOD) {
  const normalizedValue = normalizePaymentMethod(value);
  if (els.paymentMethodInput) els.paymentMethodInput.value = normalizedValue;
  els.paymentMethodToggle?.querySelectorAll("[data-payment-method]").forEach((button) => {
    const isActive = button.dataset.paymentMethod === normalizedValue;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setupPaymentMethodToggle() {
  if (!els.paymentMethodToggle) return;
  els.paymentMethodToggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-payment-method]");
    if (!button || !els.paymentMethodToggle.contains(button)) return;
    setPaymentMethod(button.dataset.paymentMethod);
  });
  setPaymentMethod(els.paymentMethodInput?.value);
}

async function handleExpenseSubmit(event) {
  event.preventDefault();

  if (state.travelMode === "overseas") updateConvertedAmount();

  const amount = Math.max(0, parseFormattedNumber(els.amountInput.value));
  if (!amount || !els.descriptionInput.value.trim()) { showToast("내용과 0보다 큰 금액을 입력해 주세요."); return; }
  const isOverseas = state.travelMode === "overseas";
  const currency = getCurrencyMeta(els.currencySelect.value);
  const foreignAmount = Math.max(0, parseFormattedNumber(els.foreignAmountInput.value));
  const exchangeRate = Math.max(0, parseFormattedNumber(els.exchangeRateInput.value));
  const receiptInput = window.TripLog.features.expenses.receiptInput;
  const submitTrip=state.id, submitEditingId=editingId;
  if (!await receiptInput.beforeSubmit()) return;
  if(submitTrip!==state.id || submitEditingId!==editingId) { showToast("입력 중 여행이 변경됐어요. 다시 확인해 주세요."); return; }
  const receipt = receiptInput.metadata() || (editingId ? findEntry(editingId)?.receipt : null);

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
        paymentMethod: getSelectedPaymentMethod(),
        isOverseas,
        currency,
        foreignAmount,
        exchangeRate,
      }).map((entry) => ({...entry, ...(receipt ? {receipt} : {}), ...window.TripLog.features.redesign?.workspace?.expenseMetadata()})),
    );

    resetExpenseFormAfterSubmit();
    saveAndRender();
    window.TripLog.features.redesign?.workspace?.expenseSaved();
    return;
  }

  const entry = {
    ...(editingId ? findEntry(editingId) : {}),
    id: editingId || createId(),
    date: els.daySelect.value,
    category: els.categorySelect.value,
    description: els.descriptionInput.value.trim(),
    amount,
    note: els.noteInput.value.trim(),
    paymentMethod: getSelectedPaymentMethod(),
    mode: isOverseas ? "overseas" : "domestic",
    currency: isOverseas ? currency.code : "",
    currencySymbol: isOverseas ? currency.symbol : "",
    currencyUnit: isOverseas ? currency.unit : "",
    exchangeBase: isOverseas ? currency.rateBase : 1,
    foreignAmount: isOverseas ? foreignAmount : 0,
    exchangeRate: isOverseas ? exchangeRate : 0,
    createdAt: editingId ? findEntry(editingId)?.createdAt || Date.now() : Date.now(),
    ...(receipt ? { receipt } : {}),
    ...window.TripLog.features.redesign?.workspace?.expenseMetadata(),
  };

  if (editingId) {
    state.entries = state.entries.map((item) => (item.id === editingId ? entry : item));
    clearEditMode();
  } else {
    state.entries.push(entry);
    resetExpenseFormAfterSubmit();
  }

  saveAndRender();
  window.TripLog.features.redesign?.workspace?.expenseSaved();
}

function resetExpenseFormAfterSubmit() {
  window.TripLog.features.expenses.receiptInput.reset();
  els.expenseForm.reset();
  els.daySelect.value = state.selectedDate;
  els.categorySelect.value = getDefaultExpenseCategory();
  els.currencySelect.value = getExpenseDefaultCurrencyCode();
  els.lodgingCheckInInput.value = "";
  els.lodgingCheckOutInput.value = "";
  setPaymentMethod(DEFAULT_PAYMENT_METHOD);
  if (state.travelMode === "overseas") {
    setCommaNumberInputValue(els.amountInput, "");
    setCommaNumberInputValue(els.foreignAmountInput, "");
    setCommaNumberInputValue(els.exchangeRateInput, "");
  }
  renderExpenseFormMode();
}

function getDefaultExpenseCategory() {
  return "식비";
}

function getExpenseDefaultCurrencyCode() {
  const preferredCode = getPreferredCurrencyMeta().code;
  return els.currencySelect.querySelector(`option[value="${preferredCode}"]`) ? preferredCode : "JPY";
}

window.TripLog.register("features.expenses.form", {
  DEFAULT_PAYMENT_METHOD,
  getPaymentMethodLabel,
  getSelectedPaymentMethod,
  setPaymentMethod,
  setupPaymentMethodToggle,
  handleExpenseSubmit,
  resetExpenseFormAfterSubmit,
  getDefaultExpenseCategory,
  getExpenseDefaultCurrencyCode,
});
