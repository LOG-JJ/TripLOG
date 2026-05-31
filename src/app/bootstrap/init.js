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
    if (els.itineraryDaySelect.value) state.selectedItineraryDate = els.itineraryDaySelect.value;
    syncCustomSelect(els.itineraryDaySelect);
    saveAndRender();
  });
  els.itineraryTransSelect.addEventListener("change", () => {
    syncCustomSelect(els.itineraryTransSelect);
  });
  els.cancelItineraryEditButton.addEventListener("click", clearItineraryEditMode);
  initNavigationEvents();

  // Bidirectional auto-calculation between Time selection and Travel Duration
  els.itineraryTimeInput.addEventListener("change", () => {
    const currentTime = els.itineraryTimeInput.value;
    if (!currentTime) return;
    const prevItem = getPrecedingItineraryItem();
    if (prevItem && prevItem.time) {
      const diff = getMinutesBetweenTimes(prevItem.time, currentTime);
      els.itineraryDurationInput.value = diff || "";
    }
  });

  els.itineraryDurationInput.addEventListener("input", () => {
    const durationVal = els.itineraryDurationInput.value.trim();
    if (!durationVal) return;
    const durationMins = parseInt(durationVal, 10);
    if (isNaN(durationMins) || durationMins < 0) return;
    const prevItem = getPrecedingItineraryItem();
    if (prevItem && prevItem.time) {
      const calculatedTime = addMinutesToTime(prevItem.time, durationMins);
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
  els.domesticModeButton.addEventListener("click", () => setTravelMode("domestic"));
  els.overseasModeButton.addEventListener("click", () => setTravelMode("overseas"));
  setupDayStripDrag(els.dayStrip);
  setupDayStripDrag(els.itineraryDayStrip);

  document.querySelectorAll(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      setFilter(button.dataset.filter);
    });
  });

  setupCustomDatePicker(els.startDateInput);
  setupCustomDatePicker(els.endDateInput);
  setupCustomDatePicker(els.lodgingCheckInInput);
  setupCustomDatePicker(els.lodgingCheckOutInput);
  setupCustomSelect(els.daySelect);
  setupCustomSelect(els.categorySelect);
  setupCustomSelect(els.currencySelect);
  setupCustomSelect(els.expenseSortSelect);
  setupCustomSelect(els.settingsCurrencySelect);
  setupCustomSelect(els.itineraryDaySelect);
  setupCustomSelect(els.itineraryTransSelect);
  setupCustomSelect(document.querySelector("#settlementExpenseSourceSelect"));
  setupCustomTimePicker(els.itineraryTimeInput);
  renderHistoryModal();
  render();
}

window.TripLog.register("bootstrap.init", {
  init,
});
