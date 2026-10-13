function render({ pageOnly = false } = {}) {
  syncPageVisibility();
  if (!pageOnly) {
    renderModeControls();
    renderStorageStatus();
    window.TripLog.features.collaboration.tripCollaboration.renderTripCollaboration();
    window.TripLog.features.settings.themeToggle.renderThemeControls();
    if (!window.TripLog.features.redesign.workspace.isTripEditing()) {
      els.tripNameInput.value = state.tripName;
      els.startDateInput.value = state.startDate;
      els.endDateInput.value = state.endDate;
      syncCustomDatePicker(els.startDateInput);
      syncCustomDatePicker(els.endDateInput);
    }
    renderDaySelect(getTripDays());
    syncCustomSelect(els.categorySelect, { rebuild: true });
    renderExpenseFormMode();
    renderPretripPurchasePanel();
  }
  if (activePage === 'itinerary') renderItineraryPage();
  window.TripLog.features.redesign.workspace.render({ pageOnly });
  if (!pageOnly) window.TripLog.features.travelCompanion.workspace.render();
}

window.TripLog.register('features.render.main', { render });
