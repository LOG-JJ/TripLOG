function getNewTripMode() {
  return els.newTripOverseasButton?.classList.contains("active") ? "overseas" : "domestic";
}

let newTripCountryActiveIndex = -1;
let newTripCountryIsComposing = false;
let newTripCountrySearchTimer = 0;

function syncNewTripCountryEditor() {
  const canClear = !!els.newTripCountryInput?.value && !els.newTripCountryInput.readOnly;
  if (els.newTripCountryClearButton) els.newTripCountryClearButton.hidden = !canClear;
  els.newTripCountryCombobox?.classList.toggle('has-value', canClear);
}

function handleNewTripCountryInput(event = {}) {
  syncNewTripCountryEditor();
  if (getNewTripMode() !== 'overseas') return;
  if (newTripCountryIsComposing || event.isComposing) {
    delete els.newTripCountryInput.dataset.countryCode;
    return;
  }
  syncNewTripCountryFromInput();
  window.clearTimeout(newTripCountrySearchTimer);
  newTripCountrySearchTimer = window.setTimeout(() => {
    newTripCountrySearchTimer = 0;
    if (!els.newTripModal.hidden && document.activeElement === els.newTripCountryInput) {
      renderNewTripCountryList(els.newTripCountryInput.value);
    }
  }, 120);
}

function handleNewTripCountryCompositionStart() {
  newTripCountryIsComposing = true;
  closeNewTripCountryList();
}

function handleNewTripCountryCompositionEnd() {
  newTripCountryIsComposing = false;
  handleNewTripCountryInput();
}

function handleNewTripCountryKeydown(event) {
  // IME confirmation belongs to the text editor, not the country suggestions.
  if (getNewTripMode() !== 'overseas' || newTripCountryIsComposing || event.isComposing || event.keyCode === 229) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (els.newTripCountryList?.hidden) renderNewTripCountryList(els.newTripCountryInput.value);
    moveNewTripCountryActive(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (els.newTripCountryList?.hidden) renderNewTripCountryList(els.newTripCountryInput.value);
    moveNewTripCountryActive(-1);
  } else if (event.key === 'Enter' && !els.newTripCountryList?.hidden) {
    event.preventDefault();
    if (newTripCountryActiveIndex >= 0) selectActiveNewTripCountry();
    else closeNewTripCountryList();
  } else if (event.key === 'Escape' && !els.newTripCountryList?.hidden) {
    event.preventDefault();
    event.stopPropagation();
    closeNewTripCountryList();
  }
}

function clearNewTripCountryInput(event) {
  event?.preventDefault();
  if (!els.newTripCountryInput || els.newTripCountryInput.readOnly) return;
  newTripCountryIsComposing = false;
  els.newTripCountryInput.value = '';
  handleNewTripCountryInput();
  els.newTripCountryInput.focus({ preventScroll: true });
}

function getCountryTools() {
  return window.TripLog?.data?.countries || {};
}

function getNewTripCountryMatch(value = "") {
  return getCountryTools().findCountryByName?.(value) || null;
}

function setNewTripCountryFlag(country) {
  if (!els.newTripCountryFlag) return;
  if (!country?.flagImage) {
    els.newTripCountryFlag.textContent = country?.flag || "🌐";
    return;
  }
  els.newTripCountryFlag.innerHTML = `
    <img src="${escapeHtml(country.flagImage)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" />
    <span class="country-flag-fallback" hidden>${country.flag}</span>
  `;
}

function closeNewTripCountryList() {
  window.clearTimeout(newTripCountrySearchTimer);
  newTripCountrySearchTimer = 0;
  if (!els.newTripCountryList) return;
  els.newTripCountryList.hidden = true;
  newTripCountryActiveIndex = -1;
}

function selectNewTripCountry(country) {
  if (!country || !els.newTripCountryInput) return;
  const englishInput = /[a-z]/i.test(els.newTripCountryInput.value);
  els.newTripCountryInput.value = englishInput && country.englishName ? country.englishName : country.name;
  els.newTripCountryInput.dataset.countryCode = country.code;
  setNewTripCountryFlag(country);
  syncNewTripCountryEditor();
  els.newTripCountryInput.focus({ preventScroll: true });
  closeNewTripCountryList();
}

function openNewTripModal() {
  newTripCountryIsComposing = false;
  els.newTripForm?.reset();
  const start = new Date(), end = new Date(start);
  end.setDate(end.getDate() + 2);
  els.newTripStartDateInput.value = toInputDate(start);
  els.newTripEndDateInput.value = toInputDate(end);
  els.newTripNameInput.value = "";
  setNewTripMode(state.travelMode, { resetCountry: true });
  syncNewTripDatePickers();
  els.newTripModal.hidden = false;
}

function renderNewTripCountryList(query = "") {
  if (!els.newTripCountryList || getNewTripMode() !== "overseas" || newTripCountryIsComposing) return;
  if (!query.trim()) { closeNewTripCountryList(); els.newTripCountryList.replaceChildren(); return; }
  if (!els.newTripCountryList.hidden && els.newTripCountryList.dataset.query === query) return;

  const matches = getCountryTools().searchCountries?.(query) || [];
  const countries = matches.slice(0, 8);
  const englishInput = /[a-z]/i.test(query);
  els.newTripCountryList.dataset.query = query;
  els.newTripCountryList.replaceChildren();
  newTripCountryActiveIndex = -1;

  if (!countries.length) {
    const empty = document.createElement("div");
    empty.className = "new-trip-country-empty";
    empty.textContent = "일치하는 국가가 없습니다.";
    els.newTripCountryList.appendChild(empty);
  } else {
    countries.forEach((country, index) => {
      const primary = englishInput && country.englishName ? country.englishName : country.name;
      const secondary = englishInput ? country.name : country.englishName;
      const option = document.createElement("button");
      option.type = "button";
      option.tabIndex = -1;
      option.className = 'new-trip-country-option';
      option.dataset.countryCode = country.code;
      option.innerHTML = `
        <span class="country-flag" aria-hidden="true">
          <img src="${escapeHtml(country.flagImage)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" />
          <span class="country-flag-fallback" hidden>${country.flag}</span>
        </span>
        <span class="country-name"><span lang="${englishInput?'en':'ko'}">${escapeHtml(primary)}</span>${secondary&&secondary!==primary?`<small lang="${englishInput?'ko':'en'}">${escapeHtml(secondary)}</small>`:''}</span>
        <span class="country-code">${country.code}</span>
      `;
      option.addEventListener("mousedown", (event) => event.preventDefault());
      option.addEventListener("click", () => selectNewTripCountry(country));
      option.addEventListener('keydown', event => {
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          moveNewTripCountryActive(event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Escape') {
          event.preventDefault();event.stopPropagation();
          els.newTripCountryInput.focus({preventScroll:true});closeNewTripCountryList();
        }
      });
      els.newTripCountryList.appendChild(option);
    });
    if (matches.length > countries.length) {
      const hint = document.createElement('div');
      hint.className = 'new-trip-country-empty';
      hint.textContent = '국가 이름을 더 입력하면 결과를 좁힐 수 있어요.';
      els.newTripCountryList.appendChild(hint);
    }
  }

  els.newTripCountryList.hidden = false;
}

function syncNewTripCountryFromInput() {
  if (!els.newTripCountryInput) return null;
  const country = getNewTripCountryMatch(els.newTripCountryInput.value.trim());
  if (country) {
    els.newTripCountryInput.dataset.countryCode = country.code;
    setNewTripCountryFlag(country);
  } else {
    delete els.newTripCountryInput.dataset.countryCode;
    setNewTripCountryFlag(null);
  }
  return country;
}

function moveNewTripCountryActive(delta) {
  if (!els.newTripCountryList || els.newTripCountryList.hidden) return;
  const options = [...els.newTripCountryList.querySelectorAll(".new-trip-country-option")];
  if (!options.length) return;
  newTripCountryActiveIndex = newTripCountryActiveIndex < 0
    ? (delta > 0 ? 0 : options.length - 1)
    : (newTripCountryActiveIndex + delta + options.length) % options.length;
  options.forEach((option, index) => {
    const active = index === newTripCountryActiveIndex;
    option.classList.toggle("is-active", active);
    if (active) { option.focus({preventScroll:true}); option.scrollIntoView({ block: "nearest" }); }
  });
}

function selectActiveNewTripCountry() {
  const options = [...(els.newTripCountryList?.querySelectorAll(".new-trip-country-option") || [])];
  const active = options[newTripCountryActiveIndex];
  const country = getCountryTools().findCountryByCode?.(active?.dataset.countryCode);
  if (country) selectNewTripCountry(country);
}

function setNewTripMode(mode, { resetCountry = false } = {}) {
  newTripCountryIsComposing = false;
  const nextMode = mode === "overseas" ? "overseas" : "domestic";
  const isOverseas = nextMode === "overseas";

  if (els.newTripModeToggle) els.newTripModeToggle.dataset.mode = nextMode;
  els.newTripDomesticButton?.classList.toggle("active", !isOverseas);
  els.newTripOverseasButton?.classList.toggle("active", isOverseas);
  els.newTripDomesticButton?.setAttribute("aria-pressed", String(!isOverseas));
  els.newTripOverseasButton?.setAttribute("aria-pressed", String(isOverseas));

  if (els.newTripNameInput) {
    els.newTripNameInput.placeholder = isOverseas ? "예: 도쿄 5박 6일" : "예: 제주도 7박 8일";
  }

  if (els.newTripCountryInput) {
    const countryValue = els.newTripCountryInput.value.trim();
    els.newTripCountryInput.readOnly = !isOverseas;
    els.newTripCountryInput.placeholder = isOverseas ? "일본 / Japan" : "대한민국";

    if (!isOverseas) {
      els.newTripCountryInput.value = "대한민국";
      els.newTripCountryInput.dataset.countryCode = "KR";
      setNewTripCountryFlag(getCountryTools().findCountryByCode?.("KR") || { flag: "🇰🇷" });
      closeNewTripCountryList();
    } else if (resetCountry || countryValue === "대한민국") {
      els.newTripCountryInput.value = "";
      delete els.newTripCountryInput.dataset.countryCode;
      setNewTripCountryFlag(null);
    } else {
      syncNewTripCountryFromInput();
    }
  }

  if (els.newTripCityInput) {
    els.newTripCityInput.placeholder = isOverseas ? "예: 도쿄" : "예: 제주";
  }
  syncNewTripCountryEditor();
}

function syncNewTripDatePickers() {
  syncCustomDatePicker(els.newTripStartDateInput);
  syncCustomDatePicker(els.newTripEndDateInput);
}

function setupMoneyNumberInputs() {
  if (typeof setupCommaNumberInput !== "function") return;

  setupCommaNumberInputs([
    els.amountInput,
    els.pretripFlightAmountInput,
    els.pretripHotelAmountInput,
  ]);

  setupCommaNumberInputs([
    els.foreignAmountInput,
  ], { allowDecimal: true, maxFractionDigits: 2 });

  setupCommaNumberInputs([
    els.exchangeRateInput,
    els.settingsExchangeRateInput,
  ], { allowDecimal: true, maxFractionDigits: 4 });
}

function init() {
  els.tripNameInput.value = state.tripName;
  els.startDateInput.value = state.startDate;
  els.endDateInput.value = state.endDate;
  setupMoneyNumberInputs();
  setupPaymentMethodToggle();

  els.tripNameInput.addEventListener("input", () => {
    if (window.TripLog.features.redesign?.workspace?.isTripEditing?.()) return;
    state.tripName = els.tripNameInput.value;
    saveAndRender();
  });

  els.expenseSearchInput.addEventListener("input", () => {
    if (window.TripLog.features.expenses.workspace) window.TripLog.features.expenses.workspace.renderLedger();
    else render();
  });

  els.expenseSortSelect.addEventListener("change", () => {
    syncCustomSelect(els.expenseSortSelect);
    if (window.TripLog.features.expenses.workspace) window.TripLog.features.expenses.workspace.renderLedger();
    else render();
  });

  els.packingAddBtn.addEventListener("click", () => {
    addPackingItem();
  });

  els.packingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      addPackingItem();
    }
  });

  els.startDateInput.addEventListener("change", () => {
    if (!window.TripLog.features.redesign?.workspace?.isTripEditing?.()) updateTripDate("startDate", els.startDateInput.value);
  });
  els.endDateInput.addEventListener("change", () => {
    if (!window.TripLog.features.redesign?.workspace?.isTripEditing?.()) updateTripDate("endDate", els.endDateInput.value);
  });
  els.daySelect.addEventListener("change", () => {
    if (els.daySelect.value && state.selectedDate !== els.daySelect.value) {
      state.selectedDate = els.daySelect.value;
      saveAndRender();
      return;
    }
    if (isLodgingSplitMode()) {
      syncLodgingDefaults();
      renderExpenseFormMode();
    }
    syncCustomSelect(els.daySelect);
  });
  els.categorySelect.addEventListener("change", () => {
    syncCustomSelect(els.categorySelect);
    syncLodgingDefaults();
    renderExpenseFormMode();
  });
  els.currencySelect.addEventListener("change", () => {
    if (editingId) setCommaNumberInputValue(els.exchangeRateInput, getDefaultExchangeRateForCurrency(els.currencySelect.value));
    else syncSettingsCurrencyFromExpense();
    syncCustomSelect(els.currencySelect);
    updateExchangeRateGuide();
    updateConvertedAmount();
    updateLodgingPreview();
    window.TripLog.features.expenses.workspace?.syncEditor();
    if (!editingId) saveStateSilently();
  });
  els.foreignAmountInput.addEventListener("input", updateConvertedAmount);
  els.exchangeRateInput.addEventListener("input", () => {
    updateExchangeRateGuide();
    updateConvertedAmount();
    if (!editingId) saveStateSilently();
  });
  els.settingsCurrencySelect.addEventListener("change", () => {
    syncExpenseCurrencyFromSettings();
    syncCustomSelect(els.settingsCurrencySelect);
    updateExchangeRateGuide();
    updateConvertedAmount();
    updateLodgingPreview();
    saveAndRender();
  });
  els.settingsExchangeRateInput.addEventListener("input", () => {
    syncExpenseExchangeRateFromSettings();
    updateExchangeRateGuide();
    updateConvertedAmount();
    saveStateSilently();
  });
  if (typeof setupMapGeocodingSettings === "function") {
    setupMapGeocodingSettings();
  }
  window.TripLog.features?.collaboration?.tripCollaboration?.setupTripCollaboration?.();
  els.amountInput.addEventListener("input", () => {
    if (state.travelMode === "overseas") updateConvertedAmount();
    updateLodgingPreview();
  });
  els.lodgingCheckInInput.addEventListener("change", () => handleLodgingDateChange("checkIn"));
  els.lodgingCheckOutInput.addEventListener("change", () => handleLodgingDateChange("checkOut"));
  if (typeof setupPretripPurchaseForms === "function") {
    setupPretripPurchaseForms();
  }
  els.expenseForm.addEventListener("submit", handleExpenseSubmit);
  window.TripLog.features.expenses.receiptInput.setup();
  els.saveStateButton.addEventListener("click", saveCurrentSnapshot);
  els.historyButton.addEventListener("click", openHistoryModal);
  els.settingsExportJsonButton?.addEventListener("click", exportHistoryJson);
  els.settingsImportJsonButton?.addEventListener("click", requestImportHistoryJson);
  els.settingsImportJsonInput?.addEventListener("change", handleImportHistoryJson);
  els.historyCloseButton.addEventListener("click", closeHistoryModal);
  els.historyModal.addEventListener("click", (event) => {
    if (event.target === els.historyModal) closeHistoryModal();
  });
  els.historyList.addEventListener("click", handleHistoryAction);
  els.itineraryList.addEventListener("click", handleItineraryListAction);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.historyModal.hidden) closeHistoryModal();
  });
  els.backToBudgetButton.addEventListener("click", () => setActivePage("budget"));
  els.itineraryForm.addEventListener("submit", handleItinerarySubmit);
  els.itineraryDaySelect.addEventListener("change", () => {
    if (els.itineraryDaySelect.value) {
      state.selectedItineraryDate = els.itineraryDaySelect.value;
      if (els.itineraryDaySelect.value !== "all") {
        state.lastActiveItineraryDate = els.itineraryDaySelect.value;
      }
    }
    syncCustomSelect(els.itineraryDaySelect);
    saveAndRender();
  });
  if (els.itineraryModeToggle) {
    els.itineraryModeToggle.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.mode;
        const days = getTripDays();

        if (mode === "overview") {
          state.selectedItineraryDate = "all";
        } else {
          // Switch back to last active specific day (or first day if none)
          state.selectedItineraryDate = state.lastActiveItineraryDate || days[0]?.date || state.startDate;
        }

        clearItineraryEditMode(false);
        saveAndRender();
      });
    });
  }
  els.itineraryTransSelect.addEventListener("change", () => {
    syncCustomSelect(els.itineraryTransSelect);
  });
  els.itineraryThemeSelect.addEventListener("change", () => {
    syncCustomSelect(els.itineraryThemeSelect);
  });
  els.cancelItineraryEditButton.addEventListener("click", clearItineraryEditMode);
  initNavigationEvents();

  els.itineraryPlaceInput.addEventListener("input", handlePlaceInput);
  els.itineraryPlaceInput.addEventListener("keydown", handlePlaceInputKeydown);
  els.placeSearchButton.addEventListener("click", () => searchPlacesFromInput({ force: true }));
  els.manualAddressToggleButton.addEventListener("click", (event) => {
    event.preventDefault();
    toggleManualAddressPanel();
  });
  els.manualAddressApplyButton.addEventListener("click", (event) => {
    event.preventDefault();
    applyManualAddressInput();
  });
  els.manualAddressCloseButton.addEventListener("click", (event) => {
    event.preventDefault();
    closeManualAddressPanel();
  });
  els.manualAddressInput.addEventListener("keydown", handleManualAddressKeydown);
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".place-search-field")) {
      closePlaceSearchResults();
      closeManualAddressPanel();
    }
  });
  els.sampleButton.addEventListener("click", loadSampleData);
  els.resetButton.addEventListener("click", resetAll);
  [els.newTripDomesticButton, els.newTripOverseasButton].forEach((button) => {
    button?.addEventListener("click", () => setNewTripMode(button.dataset.mode));
  });
  if (els.newTripCountryInput) {
    els.newTripCountryInput.addEventListener("focus", () => {
      if (getNewTripMode() === "overseas") renderNewTripCountryList(els.newTripCountryInput.value);
    });
    els.newTripCountryInput.addEventListener("click", () => {
      if (getNewTripMode() === "overseas") renderNewTripCountryList(els.newTripCountryInput.value);
    });
    els.newTripCountryInput.addEventListener('input', handleNewTripCountryInput);
    els.newTripCountryInput.addEventListener('compositionstart', handleNewTripCountryCompositionStart);
    els.newTripCountryInput.addEventListener('compositionend', handleNewTripCountryCompositionEnd);
    els.newTripCountryInput.addEventListener('keydown', handleNewTripCountryKeydown);
    els.newTripCountryClearButton?.addEventListener('mousedown', event => event.preventDefault());
    els.newTripCountryClearButton?.addEventListener('click', clearNewTripCountryInput);
  }
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#newTripCountryCombobox")) closeNewTripCountryList();
  });
  setupDayStripDrag(els.itineraryDayStrip);

  if (els.newTripCloseButton) {
    els.newTripCloseButton.addEventListener("click", () => {
      closeNewTripCountryList();
      els.newTripModal.hidden = true;
    });
  }

  if (els.newTripForm) {
    els.newTripForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (els.newTripForm.dataset.saving === 'true') return;
      const tripName = els.newTripNameInput.value.trim();
      const travelMode = getNewTripMode();
      let country = els.newTripCountryInput.value.trim();
      let countryCode = els.newTripCountryInput.dataset.countryCode || "";
      const city = els.newTripCityInput.value.trim();
      const startDate = els.newTripStartDateInput.value;
      const endDate = els.newTripEndDateInput.value;

      if (travelMode === "overseas") {
        const matchedCountry = getNewTripCountryMatch(country);
        if (!matchedCountry) {
          renderNewTripCountryList(country);
          els.newTripCountryInput.focus();
          showToast("국가 목록에서 국가를 선택해주세요.");
          return;
        }
        country = matchedCountry.name;
        countryCode = matchedCountry.code;
        selectNewTripCountry(matchedCountry);
      } else {
        country = "대한민국";
        countryCode = "KR";
      }

      if (startDate > endDate) {
        window.alert("종료일은 시작일보다 빨라야 할 수 없습니다.");
        return;
      }

      const submit = els.newTripForm.querySelector('button[type="submit"]');
      els.newTripForm.dataset.saving = 'true';
      els.newTripForm.setAttribute('aria-busy', 'true');
      submit.disabled = true;
      let created;
      try {
        created = await window.TripLog.persistence.stateStorage.createNewTrip({ tripName, travelMode, country, countryCode, city, startDate, endDate });
      } finally {
        delete els.newTripForm.dataset.saving;
        els.newTripForm.setAttribute('aria-busy', 'false');
        submit.disabled = false;
      }

      if (created === false) return;
      els.newTripModal.hidden = true;
      closeNewTripCountryList();
      els.newTripForm.reset();
      window.TripLog.features.redesign?.workspace?.navigate('overview');
      showToast('새 여행을 만들었어요.');
    });
  }

  // Itinerary Ticket collapsible & file upload event listeners
  if (els.itineraryTicketToggleBtn) {
    els.itineraryTicketToggleBtn.addEventListener("click", () => {
      const sect = els.itineraryTicketSection;
      const isHidden = sect.hidden;
      sect.hidden = !isHidden;
      els.itineraryTicketToggleBtn.classList.toggle("open", isHidden);
      els.itineraryTicketToggleBtn.setAttribute("aria-expanded", String(isHidden));
      els.itineraryTicketToggleBtn.querySelector(".ticket-toggle-chevron").textContent = isHidden ? "▲" : "▼";
    });
  }

  if (els.ticketFileSelectBtn) {
    els.ticketFileSelectBtn.addEventListener("click", () => {
      els.itineraryVoucherFile.click();
    });
  }

  if (els.itineraryVoucherFile) {
    els.itineraryVoucherFile.addEventListener("change", () => {
      const file = els.itineraryVoucherFile.files[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"].includes(file.type)) {
        showToast("JPG·PNG·GIF·WebP 이미지 또는 PDF를 선택해 주세요."); els.itineraryVoucherFile.value = ""; return;
      }

      const maxSizeBytes = 1.5 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        showToast("⚠️ 파일 크기는 최대 1.5MB까지 업로드할 수 있습니다.");
        els.itineraryVoucherFile.value = "";
        return;
      }

      const reader = new FileReader();
      const tripId = state.id, itemId = editingItineraryId;
      window.TripLog.features.itinerary.form.setVoucherLoading(new Promise(resolve => {
        reader.onload = (e) => {
          if (state.id !== tripId || editingItineraryId !== itemId || els.itineraryVoucherFile.files[0] !== file) { resolve(false); return; }
          window.TripLog.features.itinerary.form.setVoucherFile(e.target.result, file.name);
          window.TripLog.features.itinerary.form.syncVoucherFileUi();
          els.itineraryMemoInput.dispatchEvent(new Event("input", { bubbles: true }));
          resolve(true);
        };
        reader.onerror = reader.onabort = () => resolve(false);
      }));
      reader.readAsDataURL(file);
    });
  }

  if (els.ticketFileResetBtn) {
    els.ticketFileResetBtn.addEventListener("click", () => {
      window.TripLog.features.itinerary.form.setVoucherFile(null, null);
      els.itineraryVoucherFile.value = "";
      window.TripLog.features.itinerary.form.syncVoucherFileUi();
    });
  }

  document.querySelectorAll(".segmented button[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      setFilter(button.dataset.filter);
    });
  });

  setupCustomDatePicker(els.startDateInput);
  setupCustomDatePicker(els.endDateInput);
  setupCustomDatePicker(els.lodgingCheckInInput);
  setupCustomDatePicker(els.lodgingCheckOutInput);
  setupCustomDatePicker(els.newTripStartDateInput);
  setupCustomDatePicker(els.newTripEndDateInput);
  setupCustomSelect(els.daySelect);
  setupCustomSelect(els.categorySelect);
  setupCustomSelect(els.currencySelect);
  setupCustomSelect(els.expenseSortSelect);
  setupCustomSelect(els.settingsCurrencySelect);
  setupCustomSelect(els.itineraryDaySelect);
  setupCustomSelect(els.itineraryTransSelect);
  setupCustomSelect(els.itineraryThemeSelect);
  setupCustomSelect(document.querySelector("#settlementExpenseSourceSelect"));
  setupCustomTimePicker(els.itineraryTimeInput);
  setupCustomTimePicker(els.itineraryEndTimeInput);
  window.TripLog.features.itinerary.workspace.setup();
  window.TripLog.features.redesign.workspace.setup();
  window.TripLog.features.travelCompanion.workspace.setup();
  window.TripLog.ui.formControls.setup();
  renderHistoryModal();
  renderStorageStatus();
  refreshHistoryRecordsFromDb({ renderModal: false });
  render();
}

window.TripLog.register("bootstrap.init", {
  init,
});
