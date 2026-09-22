function render({ pageOnly = false } = {}) {
  syncPageVisibility();
  if (pageOnly) {
    if (activePage === "itinerary") renderItineraryPage();
    window.TripLog.features.redesign?.workspace?.render({ pageOnly: true });
    return;
  }
  const days = getTripDays();
  const totals = calculateTotals();
  const filteredEntries = getFilteredEntries();
  const filteredTotal = sumEntries(filteredEntries);

  renderModeControls();
  if (typeof renderStorageStatus === "function") renderStorageStatus();
  window.TripLog.features?.collaboration?.tripCollaboration?.renderTripCollaboration?.();
  window.TripLog.features.settings.themeToggle.renderThemeControls();
  if (!window.TripLog.features.redesign?.workspace?.isTripEditing?.()) {
    els.tripNameInput.value = state.tripName;
    els.startDateInput.value = state.startDate;
    els.endDateInput.value = state.endDate;
    setCommaNumberInputValue(els.budgetInput, state.totalBudget || "");
    syncCustomDatePicker(els.startDateInput);
    syncCustomDatePicker(els.endDateInput);
  }
  els.tripDuration.value = `${days.length}일`;
  els.tripDuration.textContent = `${days.length}일`;
  els.dominantCategory.textContent = totals.topCategory ? totals.topCategory.name : "-";
  els.filterTotal.textContent = formatWon(filteredTotal);

  renderDayStrip(days);
  renderDaySelect(days);
  renderTable(filteredEntries, days);
  renderCategorySummary(totals);
  renderBudgetDashboard(totals);
  renderDailySpendTrend(days);
  renderStatsInsights(totals, days);
  syncCustomSelect(els.categorySelect, { rebuild: true });
  renderExpenseFormMode();
  if (typeof renderPretripPurchasePanel === "function") renderPretripPurchasePanel();
  
  // Render new multi-tab dashboards
  renderOverviewPage();
  renderReportPage(totals, days);
  renderSettlementPage(totals);

  if (activePage === "start" || activePage === "itinerary") renderItineraryPage();
  window.TripLog.features.redesign?.workspace?.render();
  window.TripLog.features.travelCompanion?.workspace?.render();
}

window.TripLog.register("features.render.main", {
  render,
});
