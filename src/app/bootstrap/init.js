function getNewTripMode() {
  return els.newTripOverseasButton?.classList.contains("active") ? "overseas" : "domestic";
}

function setNewTripMode(mode, { resetCountry = false } = {}) {
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
    els.newTripCountryInput.placeholder = isOverseas ? "예: 일본" : "대한민국";

    if (!isOverseas) {
      if (resetCountry || !countryValue || countryValue === "일본") {
        els.newTripCountryInput.value = "대한민국";
      }
    } else if (resetCountry || countryValue === "대한민국") {
      els.newTripCountryInput.value = "";
    }
  }

  if (els.newTripCityInput) {
    els.newTripCityInput.placeholder = isOverseas ? "예: 도쿄" : "예: 제주";
  }
}

function syncNewTripDatePickers() {
  syncCustomDatePicker(els.newTripStartDateInput);
  syncCustomDatePicker(els.newTripEndDateInput);
}

function init() {
  els.tripNameInput.value = state.tripName;
  els.startDateInput.value = state.startDate;
  els.endDateInput.value = state.endDate;
  els.budgetInput.value = state.totalBudget || "";

  els.tripNameInput.addEventListener("input", () => {
    state.tripName = els.tripNameInput.value;
    saveAndRender();
  });

  els.budgetInput.addEventListener("input", () => {
    state.totalBudget = Number(els.budgetInput.value) || 0;
    saveAndRender();
  });

  els.expenseSearchInput.addEventListener("input", () => {
    render();
  });

  els.expenseSortSelect.addEventListener("change", () => {
    syncCustomSelect(els.expenseSortSelect);
    render();
  });

  els.itineraryRouteButton.addEventListener("click", () => {
    openFullDayRoute();
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

  // Drag and drop event listeners for Suitcase Area
  const suitcaseArea = document.querySelector("#suitcaseBackpackArea");
  if (suitcaseArea) {
    suitcaseArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      suitcaseArea.classList.add("drag-over");
    });

    suitcaseArea.addEventListener("dragleave", () => {
      suitcaseArea.classList.remove("drag-over");
    });

    suitcaseArea.addEventListener("drop", (e) => {
      e.preventDefault();
      suitcaseArea.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/plain");
      if (id) {
        setPackingItemChecked(id, true);
      }
    });
  }

  // Drag and drop event listeners for Shelf Area
  const shelfArea = document.querySelector(".packing-shelf");
  if (shelfArea) {
    shelfArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      shelfArea.classList.add("drag-over");
    });

    shelfArea.addEventListener("dragleave", () => {
      shelfArea.classList.remove("drag-over");
    });

    shelfArea.addEventListener("drop", (e) => {
      e.preventDefault();
      shelfArea.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/plain");
      if (id) {
        setPackingItemChecked(id, false);
      }
    });
  }

  els.startDateInput.addEventListener("change", () => updateTripDate("startDate", els.startDateInput.value));
  els.endDateInput.addEventListener("change", () => updateTripDate("endDate", els.endDateInput.value));
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
    syncSettingsCurrencyFromExpense();
    syncCustomSelect(els.currencySelect);
    updateExchangeRateGuide();
    updateConvertedAmount();
    updateLodgingPreview();
    saveAndRender();
  });
  els.foreignAmountInput.addEventListener("input", updateConvertedAmount);
  els.exchangeRateInput.addEventListener("input", () => {
    syncSettingsExchangeRateFromExpense();
    updateExchangeRateGuide();
    updateConvertedAmount();
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
  });
  if (typeof setupMapGeocodingSettings === "function") {
    setupMapGeocodingSettings();
  }
  els.amountInput.addEventListener("input", () => {
    if (state.travelMode === "overseas") updateConvertedAmount();
    updateLodgingPreview();
  });
  els.lodgingCheckInInput.addEventListener("change", () => handleLodgingDateChange("checkIn"));
  els.lodgingCheckOutInput.addEventListener("change", () => handleLodgingDateChange("checkOut"));
  els.expenseForm.addEventListener("submit", handleExpenseSubmit);
  els.cancelEditButton.addEventListener("click", clearEditMode);
  els.saveStateButton.addEventListener("click", saveCurrentSnapshot);
  els.historyButton.addEventListener("click", openHistoryModal);
  els.historyCloseButton.addEventListener("click", closeHistoryModal);
  els.historyModal.addEventListener("click", (event) => {
    if (event.target === els.historyModal) closeHistoryModal();
  });
  els.historyList.addEventListener("click", handleHistoryAction);
  els.itineraryList.addEventListener("click", handleItineraryListAction);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.historyModal.hidden) closeHistoryModal();
  });
  els.itineraryPageButton.addEventListener("click", () => setActivePage(activePage === "budget" ? "itinerary" : "budget"));
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

  // Bidirectional auto-calculation between Time selection and Travel Duration
  els.itineraryTimeInput.addEventListener("change", () => {
    const currentTime = els.itineraryTimeInput.value;
    if (!currentTime) return;
    const prevItem = getPrecedingItineraryItem();
    const baseTime = prevItem ? (prevItem.endTime || prevItem.time) : null;
    if (prevItem && baseTime) {
      const diff = getMinutesBetweenTimes(baseTime, currentTime);
      els.itineraryDurationInput.value = diff || "";
    }
  });

  els.itineraryDurationInput.addEventListener("input", () => {
    const durationVal = els.itineraryDurationInput.value.trim();
    if (!durationVal) return;
    const durationMins = parseInt(durationVal, 10);
    if (isNaN(durationMins) || durationMins < 0) return;
    const prevItem = getPrecedingItineraryItem();
    const baseTime = prevItem ? (prevItem.endTime || prevItem.time) : null;
    if (prevItem && baseTime) {
      const calculatedTime = addMinutesToTime(baseTime, durationMins);
      if (calculatedTime) {
        els.itineraryTimeInput.value = calculatedTime;
        syncCustomTimePicker(els.itineraryTimeInput);
      }
    }
  });

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
  els.pdfButton.addEventListener("click", exportPdf);
  els.categoryDonut.addEventListener("click", handleDonutClick);
  els.categoryDonut.addEventListener("mousemove", handleDonutMove);
  els.categoryDonut.addEventListener("mouseleave", () => highlightCategory(activeFilter === "전체" ? null : activeFilter));
  [els.newTripDomesticButton, els.newTripOverseasButton].forEach((button) => {
    button?.addEventListener("click", () => setNewTripMode(button.dataset.mode));
  });
  els.themeBrutalistButton.addEventListener("click", () => window.TripLog.features.settings.themeToggle.setTheme("brutalist"));
  els.themeTossButton.addEventListener("click", () => window.TripLog.features.settings.themeToggle.setTheme("toss"));
  setupDayStripDrag(els.dayStrip);
  setupDayStripDrag(els.itineraryDayStrip);

  // Multi-Trip Event Listeners
  if (els.overviewTripSelect) {
    els.overviewTripSelect.addEventListener("change", () => {
      const tripId = els.overviewTripSelect.value;
      if (tripId) {
        window.TripLog.persistence.stateStorage.switchTrip(tripId);
      }
    });
  }

  if (els.createNewTripButton) {
    els.createNewTripButton.addEventListener("click", () => {
      els.newTripForm?.reset();
      els.newTripStartDateInput.value = "2026-06-09";
      els.newTripEndDateInput.value = "2026-06-16";
      els.newTripNameInput.value = "";
      setNewTripMode(state.travelMode, { resetCountry: true });
      syncNewTripDatePickers();
      els.newTripModal.hidden = false;
    });
  }

  if (els.newTripCloseButton) {
    els.newTripCloseButton.addEventListener("click", () => {
      els.newTripModal.hidden = true;
    });
  }

  if (els.deleteCurrentTripButton) {
    els.deleteCurrentTripButton.addEventListener("click", () => {
      const activeId = window.TripLog.persistence.stateStorage.getActiveTripId();
      if (activeId) {
        window.TripLog.persistence.stateStorage.deleteTrip(activeId);
      }
    });
  }

  if (els.newTripForm) {
    els.newTripForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const tripName = els.newTripNameInput.value.trim();
      const travelMode = getNewTripMode();
      const country = els.newTripCountryInput.value.trim();
      const city = els.newTripCityInput.value.trim();
      const startDate = els.newTripStartDateInput.value;
      const endDate = els.newTripEndDateInput.value;

      if (startDate > endDate) {
        window.alert("종료일은 시작일보다 빨라야 할 수 없습니다.");
        return;
      }

      window.TripLog.persistence.stateStorage.createNewTrip({
        tripName,
        travelMode,
        country,
        city,
        startDate,
        endDate
      });

      els.newTripModal.hidden = true;
      els.newTripForm.reset();
    });
  }

  // Itinerary Ticket collapsible & file upload event listeners
  if (els.itineraryTicketToggleBtn) {
    els.itineraryTicketToggleBtn.addEventListener("click", () => {
      const sect = els.itineraryTicketSection;
      const isHidden = sect.hidden;
      sect.hidden = !isHidden;
      els.itineraryTicketToggleBtn.classList.toggle("open", isHidden);
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

      const maxSizeBytes = 1.5 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        showToast("⚠️ 파일 크기는 최대 1.5MB까지 업로드할 수 있습니다.");
        els.itineraryVoucherFile.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        window.TripLog.features.itinerary.form.setVoucherFile(e.target.result, file.name);
        els.ticketFileNameDisplay.textContent = file.name;
        els.ticketFileResetBtn.style.display = "inline-flex";
      };
      reader.readAsDataURL(file);
    });
  }

  if (els.ticketFileResetBtn) {
    els.ticketFileResetBtn.addEventListener("click", () => {
      window.TripLog.features.itinerary.form.setVoucherFile(null, null);
      els.itineraryVoucherFile.value = "";
      els.ticketFileNameDisplay.textContent = "선택된 파일 없음";
      els.ticketFileResetBtn.style.display = "none";
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
  setupCustomSelect(els.overviewTripSelect);
  setupCustomSelect(document.querySelector("#settlementExpenseSourceSelect"));
  setupCustomTimePicker(els.itineraryTimeInput);
  setupCustomTimePicker(els.itineraryEndTimeInput);
  renderHistoryModal();
  render();
}

window.TripLog.register("bootstrap.init", {
  init,
});
