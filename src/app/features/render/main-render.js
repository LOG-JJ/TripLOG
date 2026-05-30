function render() {
  const days = getTripDays();
  const totals = calculateTotals();
  const filteredEntries = getFilteredEntries();
  const filteredTotal = sumEntries(filteredEntries);

  syncPageVisibility();
  renderModeControls();
  els.tripNameInput.value = state.tripName;
  els.startDateInput.value = state.startDate;
  els.endDateInput.value = state.endDate;
  els.budgetInput.value = state.totalBudget || "";
  syncCustomDatePicker(els.startDateInput);
  syncCustomDatePicker(els.endDateInput);
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
  
  // Render new multi-tab dashboards
  renderOverviewPage();
  renderReportPage(totals, days);
  renderSettlementPage(totals);

  if (activePage === "itinerary") renderItineraryPage();
}

window.TripLog.register("features.render.main", {
  render,
});
