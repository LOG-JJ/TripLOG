const LEGACY_STORAGE_KEY = window.TripLog.core.config.STORAGE_KEY;
const TRIPS_KEY = "domesticTravelExpensePlanner.trips.v2";
const ACTIVE_TRIP_ID_KEY = "domesticTravelExpensePlanner.activeTripId.v2";
const THEME_KEY = "domesticTravelExpensePlanner.theme.v1";

function getFallbackState(tripId = "trip_default") {
  return {
    id: tripId,
    tripName: "나의 첫 여행 ✈️",
    country: "대한민국",
    city: "서울",
    travelMode: "domestic",
    theme: "brutalist",
    startDate: "2026-06-09",
    endDate: "2026-06-12",
    selectedDate: "2026-06-09",
    selectedItineraryDate: "2026-06-09",
    lastActiveItineraryDate: "2026-06-09",
    selectedItineraryId: "",
    currencyCode: "JPY",
    currencySymbol: "¥",
    currencyUnit: "엔",
    exchangeBase: 100,
    entries: [],
    itineraryItems: [],
    packingList: typeof getDefaultPackingList === "function" ? getDefaultPackingList() : [],
    companions: [],
    settlement: {
      sourceId: "current",
      splitMode: "equal",
      customShares: {},
      expandedEntryKey: "",
    },
  };
}

function loadState() {
  try {
    let trips = JSON.parse(localStorage.getItem(TRIPS_KEY));
    let activeTripId = localStorage.getItem(ACTIVE_TRIP_ID_KEY);

    // Migration and initialization logic
    if (!Array.isArray(trips) || trips.length === 0) {
      trips = [];
      const legacySaved = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
      if (legacySaved && typeof legacySaved === "object") {
        const legacyTrip = {
          ...getFallbackState("trip_legacy"),
          ...legacySaved,
          id: "trip_legacy",
          tripName: legacySaved.tripName || "기존 여행",
        };
        trips.push(legacyTrip);
        activeTripId = "trip_legacy";
      } else {
        const defaultTrip = getFallbackState("trip_default");
        trips.push(defaultTrip);
        activeTripId = "trip_default";
      }
      localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
      localStorage.setItem(ACTIVE_TRIP_ID_KEY, activeTripId);
    }

    if (!activeTripId) {
      activeTripId = trips[0].id;
      localStorage.setItem(ACTIVE_TRIP_ID_KEY, activeTripId);
    }

    let activeTrip = trips.find(t => t.id === activeTripId);
    if (!activeTrip) {
      activeTrip = trips[0];
      activeTripId = activeTrip.id;
      localStorage.setItem(ACTIVE_TRIP_ID_KEY, activeTripId);
    }

    const preferredCurrency = currencies.find((currency) => currency.code === activeTrip.currencyCode) || currencies[0];
    const fallback = getFallbackState(activeTripId);
    const savedTheme = getSavedTheme();
    return {
      ...fallback,
      ...activeTrip,
      theme: savedTheme || normalizeThemeName(activeTrip.theme),
      currencyCode: preferredCurrency.code,
      currencySymbol: activeTrip.currencySymbol || preferredCurrency.symbol,
      currencyUnit: activeTrip.currencyUnit || preferredCurrency.unit,
      exchangeBase: Number(activeTrip.exchangeBase || preferredCurrency.rateBase || 1),
      entries: Array.isArray(activeTrip.entries) ? activeTrip.entries : [],
      itineraryItems: Array.isArray(activeTrip.itineraryItems) ? activeTrip.itineraryItems : [],
      packingList: Array.isArray(activeTrip.packingList) ? activeTrip.packingList : (typeof getDefaultPackingList === "function" ? getDefaultPackingList() : []),
      companions: Array.isArray(activeTrip.companions) ? activeTrip.companions : [],
      settlement: normalizeSettlementSettings(activeTrip.settlement),
    };
  } catch {
    return getFallbackState("trip_default");
  }
}

function isLegacyDefaultTripName(value) {
  return value === "국내 여행" || value === "해외 여행";
}

function normalizeThemeName(themeName) {
  return themeName === "toss" ? "toss" : "brutalist";
}

function getSavedTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (!savedTheme) return "";
  return normalizeThemeName(savedTheme);
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
  saveStateSilently();
  render();
}

function saveStateSilently() {
  try {
    let trips = JSON.parse(localStorage.getItem(TRIPS_KEY)) || [];
    const activeTripId = localStorage.getItem(ACTIVE_TRIP_ID_KEY);
    const theme = normalizeThemeName(state.theme);
    state.theme = theme;

    trips = trips.map(t => t.id === activeTripId ? { ...t, ...state } : t);
    localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    localStorage.setItem(THEME_KEY, theme);

    // Legacy support
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Save failed:", e);
  }
}

function getTrips() {
  try {
    return JSON.parse(localStorage.getItem(TRIPS_KEY)) || [];
  } catch {
    return [];
  }
}

function getActiveTripId() {
  return localStorage.getItem(ACTIVE_TRIP_ID_KEY);
}

function switchTrip(tripId) {
  const trips = getTrips();
  const targetTrip = trips.find(t => t.id === tripId);
  if (!targetTrip) return;
  const currentTheme = normalizeThemeName(state.theme || getSavedTheme());

  localStorage.setItem(ACTIVE_TRIP_ID_KEY, tripId);

  // mutate global state in place!
  for (let key in state) {
    if (state.hasOwnProperty(key)) {
      delete state[key];
    }
  }
  Object.assign(state, targetTrip);
  state.theme = currentTheme;

  // reset day selections
  state.selectedDate = state.startDate;
  state.selectedItineraryDate = state.startDate;
  state.lastActiveItineraryDate = state.startDate;

  saveAndRender();
}

function createNewTrip({ tripName, country, city, travelMode, startDate, endDate, totalBudget }) {
  const trips = getTrips();
  const newId = "trip_" + Date.now();
  const normalizedTravelMode = travelMode === "overseas" ? "overseas" : "domestic";
  const newTrip = {
    ...getFallbackState(newId),
    tripName: tripName || "새로운 여행 ✈️",
    country: country || (normalizedTravelMode === "domestic" ? "대한민국" : ""),
    city: city || (normalizedTravelMode === "domestic" ? "서울" : ""),
    travelMode: normalizedTravelMode,
    theme: normalizeThemeName(state.theme || getSavedTheme()),
    startDate: startDate || "2026-06-09",
    endDate: endDate || "2026-06-12",
    selectedDate: startDate || "2026-06-09",
    selectedItineraryDate: startDate || "2026-06-09",
    lastActiveItineraryDate: startDate || "2026-06-09",
    totalBudget: totalBudget || 0,
    entries: [],
    itineraryItems: [],
    packingList: typeof getDefaultPackingList === "function" ? getDefaultPackingList() : [],
    companions: [],
  };

  trips.push(newTrip);
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));

  switchTrip(newId);
}

function deleteTrip(tripId) {
  let trips = getTrips();
  if (trips.length <= 1) {
    window.alert("최소 한 개의 여행은 존재해야 합니다.");
    return;
  }

  if (!window.confirm("정말 이 여행을 삭제하시겠습니까? 관련 모든 일정과 지출 기록이 삭제됩니다.")) {
    return;
  }

  trips = trips.filter(t => t.id !== tripId);
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));

  const activeTripId = getActiveTripId();
  if (activeTripId === tripId) {
    switchTrip(trips[0].id);
  } else {
    saveAndRender();
  }
}

function getStateSnapshot() {
  return JSON.parse(JSON.stringify(state));
}

window.TripLog.register("persistence.stateStorage", {
  loadState,
  isLegacyDefaultTripName,
  hasNoSavedRecords,
  normalizeThemeName,
  getSavedTheme,
  normalizeSettlementSettings,
  saveAndRender,
  saveStateSilently,
  getStateSnapshot,
  getTrips,
  getActiveTripId,
  switchTrip,
  createNewTrip,
  deleteTrip,
});
