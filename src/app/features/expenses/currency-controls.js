function syncExpenseCurrencyFromSettings() {
  if (!els.settingsCurrencySelect || !els.currencySelect) return;
  const currency = setPreferredCurrency(els.settingsCurrencySelect.value);
  if (currency.code && els.currencySelect.querySelector(`option[value="${currency.code}"]`)) {
    els.currencySelect.value = currency.code;
    syncCustomSelect(els.currencySelect);
  }
}

function syncSettingsCurrencyFromExpense() {
  if (!els.settingsCurrencySelect || !els.currencySelect) return;
  const currency = setPreferredCurrency(els.currencySelect.value);
  if (currency.code && els.settingsCurrencySelect.querySelector(`option[value="${currency.code}"]`)) {
    els.settingsCurrencySelect.value = currency.code;
  }
}

function syncCurrencyControlsFromPreferred() {
  if (!els.settingsCurrencySelect || !els.currencySelect) return;
  const currency = setPreferredCurrency(getPreferredCurrencyMeta().code);
  if (els.settingsCurrencySelect.querySelector(`option[value="${currency.code}"]`)) {
    els.settingsCurrencySelect.value = currency.code;
    syncCustomSelect(els.settingsCurrencySelect);
  }
  if (els.currencySelect.querySelector(`option[value="${currency.code}"]`)) {
    els.currencySelect.value = currency.code;
    syncCustomSelect(els.currencySelect);
  }
}

function syncExpenseExchangeRateFromSettings() {
  if (!els.settingsExchangeRateInput || !els.exchangeRateInput) return;
  els.exchangeRateInput.value = els.settingsExchangeRateInput.value;
}

function syncSettingsExchangeRateFromExpense() {
  if (!els.settingsExchangeRateInput || !els.exchangeRateInput) return;
  if (els.exchangeRateInput.value) {
    els.settingsExchangeRateInput.value = els.exchangeRateInput.value;
  }
}

function ensureExpenseExchangeDefaults() {
  syncCurrencyControlsFromPreferred();
  if (els.settingsExchangeRateInput?.value && !els.exchangeRateInput.value) {
    syncExpenseExchangeRateFromSettings();
  }
}

function renderModeControls() {
  const isOverseas = state.travelMode === "overseas";
  const isLodging = isLodgingSplitMode();
  updateBrandText();
  els.modeToggle?.setAttribute("data-mode", isOverseas ? "overseas" : "domestic");
  els.domesticModeButton?.classList.toggle("active", !isOverseas);
  els.overseasModeButton?.classList.toggle("active", isOverseas);
  els.domesticModeButton?.setAttribute("aria-current", String(!isOverseas));
  els.overseasModeButton?.setAttribute("aria-current", String(isOverseas));
  if (els.settingsModeCurrentLabel) {
    els.settingsModeCurrentLabel.textContent = `현재 여행: ${isOverseas ? "해외 여행" : "국내 여행"}`;
  }
  if (els.settingsModeCurrentCopy) {
    els.settingsModeCurrentCopy.textContent = isOverseas
      ? "새 여행 만들기에서 선택한 해외 여행 유형입니다. 주요 통화와 환율은 아래에서 조정하세요."
      : "새 여행 만들기에서 선택한 국내 여행 유형입니다. 다른 유형이 필요하면 새 여행을 만들 때 선택하세요.";
  }
  els.settingsCurrencyArea.hidden = !isOverseas;
  els.settingsDomesticTip.hidden = isOverseas;
  els.foreignFields.hidden = !isOverseas;
  if (isOverseas) ensureExpenseExchangeDefaults();
  els.amountLabel.textContent = isLodging ? (isOverseas ? "원화 총액" : "숙소 총액") : isOverseas ? "원화 환산" : "금액";
  els.amountInput.readOnly = isOverseas;
  els.amountInput.required = true;
  els.amountInput.placeholder = isLodging ? "총 숙소비" : isOverseas ? "자동 계산" : "0";
  els.amountInput.step = "1";
  updateExchangeRateGuide();
  syncCustomSelect(els.currencySelect, { rebuild: true });

  if (isOverseas) updateConvertedAmount();
  renderExpenseFormMode();
}

function updateConvertedAmount() {
  if (state.travelMode !== "overseas") return;
  const currency = getCurrencyMeta(els.currencySelect.value);
  const foreignAmount = Math.max(0, Number(els.foreignAmountInput.value || 0));
  const exchangeRate = Math.max(0, Number(els.exchangeRateInput.value || 0));
  const converted = Math.round((foreignAmount * exchangeRate) / currency.rateBase);
  els.amountInput.value = converted || "";
  updateLodgingPreview();
}

function updateExchangeRateGuide() {
  const currency = getCurrencyMeta(els.currencySelect.value);
  const baseLabel = formatRateBase(currency);
  els.exchangeRateLabel.textContent = `환율 (${baseLabel} 기준)`;
  els.exchangeRateInput.placeholder = `${baseLabel}당 원화`;
  els.exchangeRateInput.title = `${baseLabel}당 원화 환율을 입력하세요.`;
  if (els.settingsExchangeRateLabel) {
    const rate = Number(els.settingsExchangeRateInput?.value || els.exchangeRateInput.value || 0);
    els.settingsExchangeRateLabel.textContent = rate
      ? `${baseLabel} = ${rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`
      : `${baseLabel}당 원화`;
  }
}

window.TripLog.register("features.expenses.currencyControls", {
  syncExpenseCurrencyFromSettings,
  syncSettingsCurrencyFromExpense,
  syncCurrencyControlsFromPreferred,
  syncExpenseExchangeRateFromSettings,
  syncSettingsExchangeRateFromExpense,
  ensureExpenseExchangeDefaults,
  renderModeControls,
  updateConvertedAmount,
  updateExchangeRateGuide,
});
