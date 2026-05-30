function setTravelMode(mode) {
  const previousMode = state.travelMode;
  state.travelMode = mode === "overseas" ? "overseas" : "domestic";
  if (previousMode !== state.travelMode) {
    if (isLegacyDefaultTripName(state.tripName)) state.tripName = "";
  }
  if (state.travelMode === "domestic") {
    els.amountInput.readOnly = false;
  } else {
    ensureExpenseExchangeDefaults();
    updateConvertedAmount();
  }
  saveAndRender();
}

window.TripLog.register("features.settings.travelMode", {
  setTravelMode,
});
