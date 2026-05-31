function loadState() {
  const fallback = {
    tripName: "",
    travelMode: "domestic",
    startDate: "2026-06-09",
    endDate: "2026-06-12",
    selectedDate: "2026-06-09",
    selectedItineraryDate: "2026-06-09",
    selectedItineraryId: "",
    currencyCode: "JPY",
    currencySymbol: "¥",
    currencyUnit: "엔",
    exchangeBase: 100,
    entries: [],
    itineraryItems: [],
    packingList: getDefaultPackingList(),
    companions: [],
    settlement: {
      sourceId: "current",
      splitMode: "equal",
      customShares: {},
      expandedEntryKey: "",
    },
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    const normalizedTripName =
      isLegacyDefaultTripName(saved.tripName) && hasNoSavedRecords(saved) ? "" : typeof saved.tripName === "string" ? saved.tripName : "";
    const preferredCurrency = currencies.find((currency) => currency.code === saved.currencyCode) || currencies[0];
    return {
      ...fallback,
      ...saved,
      tripName: normalizedTripName,
      currencyCode: preferredCurrency.code,
      currencySymbol: saved.currencySymbol || preferredCurrency.symbol,
      currencyUnit: saved.currencyUnit || preferredCurrency.unit,
      exchangeBase: Number(saved.exchangeBase || preferredCurrency.rateBase || 1),
      entries: Array.isArray(saved.entries) ? saved.entries : [],
      itineraryItems: Array.isArray(saved.itineraryItems) ? saved.itineraryItems : [],
      packingList: Array.isArray(saved.packingList) ? saved.packingList : getDefaultPackingList(),
      companions: Array.isArray(saved.companions) ? saved.companions : [],
      settlement: normalizeSettlementSettings(saved.settlement),
    };
  } catch {
    return fallback;
  }
}

function isLegacyDefaultTripName(value) {
  return value === "국내 여행" || value === "해외 여행";
}

function hasNoSavedRecords(saved) {
  const entries = Array.isArray(saved?.entries) ? saved.entries : [];
  const itineraryItems = Array.isArray(saved?.itineraryItems) ? saved.itineraryItems : [];
  return entries.length === 0 && itineraryItems.length === 0;
}

function normalizeSettlementSettings(value = {}) {
  const splitMode = value?.splitMode === "custom" ? "custom" : "equal";
  const customShares = value?.customShares && typeof value.customShares === "object" ? value.customShares : {};
  const itemSplits = value?.itemSplits && typeof value.itemSplits === "object" ? value.itemSplits : {};
  return {
    sourceId: typeof value?.sourceId === "string" ? value.sourceId : "current",
    splitMode,
    customShares,
    itemSplits,
    expandedEntryKey: typeof value?.expandedEntryKey === "string" ? value.expandedEntryKey : "",
  };
}


function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}


function getStateSnapshot() {
  return JSON.parse(JSON.stringify(state));
}

window.TripLog.register("persistence.stateStorage", {
  loadState,
  isLegacyDefaultTripName,
  hasNoSavedRecords,
  normalizeSettlementSettings,
  saveAndRender,
  getStateSnapshot,
});
