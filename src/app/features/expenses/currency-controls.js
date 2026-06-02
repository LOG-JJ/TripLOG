let exchangeRateFetchToken = 0;

function syncExpenseCurrencyFromSettings() {
  if (!els.settingsCurrencySelect || !els.currencySelect) return;
  const currency = setPreferredCurrency(els.settingsCurrencySelect.value);
  state.exchangeRate = getDefaultExchangeRateForCurrency(currency.code);
  state.exchangeRateSource = "기본값";
  state.exchangeRateUpdatedAt = "";
  state.currencyAutoMatchedCountryCode = getCurrentCurrencyMatchCountryKey();
  if (currency.code && els.currencySelect.querySelector(`option[value="${currency.code}"]`)) {
    els.currencySelect.value = currency.code;
    syncCustomSelect(els.currencySelect);
  }
  syncExchangeRateInputsFromState();
  requestLatestExchangeRateForCurrency(currency, { reason: "manual" });
}

function syncSettingsCurrencyFromExpense() {
  if (!els.settingsCurrencySelect || !els.currencySelect) return;
  const currency = setPreferredCurrency(els.currencySelect.value);
  state.exchangeRate = getDefaultExchangeRateForCurrency(currency.code);
  state.exchangeRateSource = "기본값";
  state.exchangeRateUpdatedAt = "";
  if (currency.code && els.settingsCurrencySelect.querySelector(`option[value="${currency.code}"]`)) {
    els.settingsCurrencySelect.value = currency.code;
  }
  syncExchangeRateInputsFromState();
  requestLatestExchangeRateForCurrency(currency, { reason: "manual" });
}

function syncCurrencyControlsFromPreferred() {
  if (!els.settingsCurrencySelect || !els.currencySelect) return;
  const currency = setPreferredCurrency(getPreferredCurrencyMeta().code);
  if (!state.exchangeRate) {
    state.exchangeRate = getDefaultExchangeRateForCurrency(currency.code);
    state.exchangeRateSource = "기본값";
  }
  if (els.settingsCurrencySelect.querySelector(`option[value="${currency.code}"]`)) {
    els.settingsCurrencySelect.value = currency.code;
    syncCustomSelect(els.settingsCurrencySelect);
  }
  if (els.currencySelect.querySelector(`option[value="${currency.code}"]`)) {
    els.currencySelect.value = currency.code;
    syncCustomSelect(els.currencySelect);
  }
  syncExchangeRateInputsFromState();
}

function syncExpenseExchangeRateFromSettings() {
  if (!els.settingsExchangeRateInput || !els.exchangeRateInput) return;
  if (isWonCurrency(els.currencySelect?.value)) {
    setCommaNumberInputValue(els.exchangeRateInput, 1);
    return;
  }
  const rate = parseFormattedNumber(els.settingsExchangeRateInput.value);
  setCommaNumberInputValue(els.exchangeRateInput, rate || "");
  state.exchangeRate = rate;
  state.exchangeRateSource = "수동 입력";
  state.exchangeRateUpdatedAt = "";
}

function syncSettingsExchangeRateFromExpense() {
  if (!els.settingsExchangeRateInput || !els.exchangeRateInput) return;
  if (isWonCurrency(els.currencySelect?.value)) {
    setCommaNumberInputValue(els.settingsExchangeRateInput, 1);
    return;
  }
  if (els.exchangeRateInput.value) {
    const rate = parseFormattedNumber(els.exchangeRateInput.value);
    setCommaNumberInputValue(els.settingsExchangeRateInput, rate || "");
    state.exchangeRate = rate;
    state.exchangeRateSource = "수동 입력";
    state.exchangeRateUpdatedAt = "";
  }
}

function ensureExpenseExchangeDefaults() {
  autoMatchCurrencyFromCountry();
  syncCurrencyControlsFromPreferred();
  if (!els.exchangeRateInput.value) {
    syncExchangeRateInputsFromState();
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

  if (!isOverseas) {
    const currency = setPreferredCurrency("KRW");
    state.exchangeRate = 1;
    state.exchangeRateSource = "국내 원화";
    state.currencyAutoMatchedCountryCode = "KR";
    if (els.settingsCurrencySelect?.querySelector('option[value="KRW"]')) els.settingsCurrencySelect.value = "KRW";
    if (els.currencySelect?.querySelector('option[value="KRW"]')) els.currencySelect.value = "KRW";
    syncExchangeRateInputsFromState();
  }
  els.foreignFields.hidden = !isOverseas;
  syncAmountFieldPlacement(isOverseas);
  if (isOverseas) ensureExpenseExchangeDefaults();
  els.amountLabel.textContent = isLodging ? (isOverseas ? "원화 총액" : "숙소 총액") : isOverseas ? "원화 환산" : "금액";
  els.amountInput.readOnly = isOverseas;
  els.amountInput.required = true;
  els.amountInput.placeholder = isLodging ? "총 숙소비" : isOverseas ? "자동 계산" : "0";
  els.amountInput.step = "1";
  updateExchangeRateGuide();
  syncCustomSelect(els.currencySelect, { rebuild: true });
  syncCustomSelect(els.settingsCurrencySelect, { rebuild: true });

  if (isOverseas) updateConvertedAmount();
  renderExpenseFormMode();
}

function syncAmountFieldPlacement(isOverseas) {
  const amountField = els.amountInput?.closest("label");
  const anchor = document.querySelector("#amountFieldAnchor");
  const foreignAmountField = els.foreignAmountInput?.closest("label");
  if (!amountField || !anchor || !els.foreignFields) return;

  if (isOverseas) {
    amountField.classList.add("foreign-amount-converted-field");
    els.foreignFields.insertBefore(amountField, foreignAmountField || null);
    return;
  }

  amountField.classList.remove("foreign-amount-converted-field");
  anchor.after(amountField);
}

function updateConvertedAmount() {
  if (state.travelMode !== "overseas") return;
  const currency = getCurrencyMeta(els.currencySelect.value);
  const foreignAmount = Math.max(0, parseFormattedNumber(els.foreignAmountInput.value));
  const exchangeRate = isWonCurrency(currency) ? 1 : Math.max(0, parseFormattedNumber(els.exchangeRateInput.value));
  if (isWonCurrency(currency)) {
    setCommaNumberInputValue(els.exchangeRateInput, 1);
  }
  const converted = Math.round((foreignAmount * exchangeRate) / currency.rateBase);
  setCommaNumberInputValue(els.amountInput, converted || "");
  updateLodgingPreview();
}

function updateExchangeRateGuide() {
  const currency = getCurrencyMeta(els.currencySelect.value);
  const isWon = isWonCurrency(currency);
  const baseLabel = formatRateBase(currency);
  syncWonCurrencyFieldState(isWon);

  if (isWon) {
    els.exchangeRateLabel.textContent = "환율 (원화 기준)";
    els.exchangeRateInput.placeholder = "1";
    els.exchangeRateInput.title = "원화 결제는 환율 없이 그대로 기록합니다.";
    if (state.travelMode === "overseas") {
      els.amountLabel.textContent = isLodgingSplitMode() ? "원화 총액" : "원화 환산";
      els.amountInput.placeholder = "자동 반영";
    }
    if (els.settingsExchangeRateLabel) {
      els.settingsExchangeRateLabel.textContent = "1원 = 1원";
    }
    renderCurrencySettingsSummary(currency, 1);
    return;
  }

  els.exchangeRateLabel.textContent = `환율 (${baseLabel} 기준)`;
  els.exchangeRateInput.placeholder = `${baseLabel}당 원화`;
  els.exchangeRateInput.title = `${baseLabel}당 원화 환율을 입력하세요.`;
  if (els.settingsExchangeRateLabel) {
    const rate = parseFormattedNumber(els.settingsExchangeRateInput?.value || els.exchangeRateInput.value);
    els.settingsExchangeRateLabel.textContent = rate
      ? `${baseLabel} = ${rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`
      : `${baseLabel}당 원화`;
  }
  renderCurrencySettingsSummary(currency);
}

function syncWonCurrencyFieldState(isWon = isWonCurrency(els.currencySelect?.value)) {
  const exchangeField = els.exchangeRateInput?.closest("label");
  const foreignAmountLabel = els.foreignAmountInput?.closest("label")?.querySelector("span");
  if (exchangeField) exchangeField.hidden = false;
  if (els.exchangeRateInput) {
    els.exchangeRateInput.disabled = Boolean(isWon);
    if (isWon) setCommaNumberInputValue(els.exchangeRateInput, 1);
  }
  if (els.foreignAmountInput) {
    els.foreignAmountInput.step = isWon ? "1" : "0.01";
    els.foreignAmountInput.placeholder = "0";
  }
  if (foreignAmountLabel) {
    foreignAmountLabel.textContent = "해외 결제액";
  }
  els.foreignFields?.classList.toggle("is-won-currency", Boolean(isWon));
}

function getCurrentCurrencyMatchCountryKey() {
  return state.travelMode === "overseas"
    ? String(state.countryCode || state.country || "").trim().toUpperCase()
    : "KR";
}

function autoMatchCurrencyFromCountry({ force = false } = {}) {
  const countryKey = getCurrentCurrencyMatchCountryKey();
  if (!force && state.currencyAutoMatchedCountryCode === countryKey && state.currencyCode) {
    const currency = getCurrencyMeta(state.currencyCode);
    if (state.travelMode === "overseas" && !isWonCurrency(currency) && !state.exchangeRateUpdatedAt) {
      requestLatestExchangeRateForCurrency(currency, { reason: "auto" });
    }
    return getCurrencyMeta(state.currencyCode);
  }

  const currency = getCurrencyMeta(getCurrencyCodeForCountry(state.countryCode, state.travelMode));
  setPreferredCurrency(currency.code);
  state.exchangeRate = getDefaultExchangeRateForCurrency(currency.code);
  state.exchangeRateSource = state.travelMode === "overseas" ? "국가 기본값" : "국내 원화";
  state.exchangeRateUpdatedAt = "";
  state.currencyAutoMatchedCountryCode = countryKey;
  syncCurrencyControlsFromPreferred();
  if (state.travelMode === "overseas") requestLatestExchangeRateForCurrency(currency, { reason: "auto" });
  return currency;
}

function syncExchangeRateInputsFromState() {
  const currency = getCurrencyMeta(state.currencyCode || els.settingsCurrencySelect?.value || "JPY");
  const rate = isWonCurrency(currency) ? 1 : Number(state.exchangeRate || getDefaultExchangeRateForCurrency(currency.code));
  if (els.settingsExchangeRateInput) setCommaNumberInputValue(els.settingsExchangeRateInput, rate);
  if (els.exchangeRateInput && !isWonCurrency(currency)) setCommaNumberInputValue(els.exchangeRateInput, rate);
  if (isWonCurrency(currency) && els.exchangeRateInput) setCommaNumberInputValue(els.exchangeRateInput, 1);
}

function requestLatestExchangeRateForCurrency(currency = getCurrencyMeta(state.currencyCode), { reason = "auto" } = {}) {
  if (state.travelMode !== "overseas" || isWonCurrency(currency)) {
    updateExchangeRateGuide();
    return;
  }

  const token = ++exchangeRateFetchToken;
  if (els.settingsCurrencyAutoStatus) {
    const countryName = [state.country, state.city].filter(Boolean).join(" · ") || "설정 국가";
    els.settingsCurrencyAutoStatus.textContent = `${countryName} 기준 ${currency.label} 환율을 불러오는 중입니다.`;
  }

  fetchLatestExchangeRateToKrw(currency.code)
    .then((result) => {
      if (token !== exchangeRateFetchToken || state.currencyCode !== currency.code) return;
      state.exchangeRate = result.rate;
      state.exchangeRateSource = result.source;
      state.exchangeRateUpdatedAt = result.date || new Date().toISOString().slice(0, 10);
      syncExchangeRateInputsFromState();
      updateExchangeRateGuide();
      updateConvertedAmount();
      saveStateSilently();
    })
    .catch((error) => {
      if (token !== exchangeRateFetchToken) return;
      console.warn("Exchange rate fetch failed:", error);
      state.exchangeRate = Number(state.exchangeRate || getDefaultExchangeRateForCurrency(currency.code));
      state.exchangeRateSource = "기본값";
      syncExchangeRateInputsFromState();
      updateExchangeRateGuide();
      if (els.settingsCurrencyAutoStatus) {
        els.settingsCurrencyAutoStatus.textContent = "실시간 환율을 불러오지 못해 기본 환율을 사용합니다. 필요하면 직접 수정하세요.";
      }
      if (reason === "manual") saveStateSilently();
    });
}

function renderCurrencySettingsSummary(currency = getCurrencyMeta(state.currencyCode), rateValue = Number(state.exchangeRate || 0)) {
  const isOverseas = state.travelMode === "overseas";
  const rate = isWonCurrency(currency) ? 1 : Number(rateValue || state.exchangeRate || getDefaultExchangeRateForCurrency(currency.code));
  const destination = [state.country, state.city].filter(Boolean).join(" · ");
  if (els.settingsTravelModeBadge) {
    els.settingsTravelModeBadge.textContent = `${isOverseas ? "해외 여행" : "국내 여행"}${destination ? ` · ${destination}` : ""}`;
  }
  if (els.settingsCurrencySummary) {
    els.settingsCurrencySummary.textContent = `${currency.code} · ${currency.label}`;
  }
  if (els.settingsExchangeSummary) {
    els.settingsExchangeSummary.textContent = isWonCurrency(currency)
      ? "1원 = 1원"
      : `${formatRateBase(currency)} = ${rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`;
  }
  if (els.settingsCurrencyAutoStatus) {
    const source = state.exchangeRateSource || (isOverseas ? "국가 기본값" : "국내 원화");
    const updatedAt = state.exchangeRateUpdatedAt ? ` · ${state.exchangeRateUpdatedAt}` : "";
    els.settingsCurrencyAutoStatus.textContent = `${state.country || "설정 국가"} 기준 자동 매칭 · ${source}${updatedAt}`;
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
  syncWonCurrencyFieldState,
  autoMatchCurrencyFromCountry,
  requestLatestExchangeRateForCurrency,
  renderCurrencySettingsSummary,
});
