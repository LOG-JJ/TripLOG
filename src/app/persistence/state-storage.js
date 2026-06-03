const LEGACY_STORAGE_KEY = window.TripLog.core.config.STORAGE_KEY;
const TRIPS_KEY = "domesticTravelExpensePlanner.trips.v2";
const ACTIVE_TRIP_ID_KEY = "domesticTravelExpensePlanner.activeTripId.v2";
const THEME_KEY = "domesticTravelExpensePlanner.theme.v2";
const highTrustSavedCoordinateSources = new Set(["coordinate-text", "google-places", "google-geocoding"]);

const itineraryPlaceCleanupRules = {
  "제주공항 도착": { place: "제주국제공항" },
  "제주공항에서 코델리아S호텔로 이동": { place: "코델리아S호텔", memoPrefix: "제주공항에서 코델리아S호텔로 대중교통 이동." },
  "코델리아S호텔 짐 맡기기": { place: "코델리아S호텔" },
  "성산 주변 점심 식사": { place: "성산읍", memoPrefix: "성산 주변에서 점심 식사." },
  "코델리아S호텔 체크인 및 휴식": { place: "코델리아S호텔" },
  "성산 주변 저녁 식사": { place: "성산읍" },
  "코델리아S호텔 출발": { place: "코델리아S호텔", memoPrefix: "숙소 출발." },
  "성산항 도착": { place: "성산항", memoPrefix: "성산항 도착." },
  "우도 하루 여행": { place: "우도" },
  "성산항 복귀": { place: "성산항" },
  "코델리아S호텔 복귀 및 저녁 식사": { place: "코델리아S호텔" },
  "코델리아S호텔 복귀": { place: "코델리아S호텔" },
  "용눈이오름 또는 다랑쉬오름": { place: "용눈이오름" },
  "코델리아S호텔 체크아웃": { place: "코델리아S호텔" },
  "성산에서 신신호텔 천지연으로 이동": { place: "신신호텔 천지연", memoPrefix: "성산에서 신신호텔 천지연으로 대중교통 이동." },
  "신신호텔 천지연 체크인": { place: "신신호텔 천지연" },
  "서귀포 매일올레시장 저녁 식사": { place: "서귀포 매일올레시장" },
  "신신호텔 천지연 출발": { place: "신신호텔 천지연", memoPrefix: "숙소 출발." },
  "신신호텔 천지연 복귀": { place: "신신호텔 천지연" },
  "신신호텔 천지연 체크아웃 및 짐 보관": { place: "신신호텔 천지연" },
  "서귀포에서 애월로 이동": { place: "애월 한담해안산책로", memoPrefix: "서귀포에서 애월로 대중교통 이동." },
  "애월에서 신신호텔 천지연으로 복귀": { place: "신신호텔 천지연", memoPrefix: "애월에서 신신호텔 천지연으로 복귀." },
  "신신호텔 천지연 짐 찾기": { place: "신신호텔 천지연" },
  "신신호텔 천지연에서 제주공항으로 이동": { place: "제주국제공항", memoPrefix: "신신호텔 천지연에서 제주공항으로 대중교통 이동." },
  "제주공항 출발": { place: "제주국제공항" },
};

function cleanSavedItineraryPlace(item) {
  if (!item || typeof item !== "object") return item;

  const rule = getItineraryPlaceCleanupRule(item);
  const cleanedItem = rule ? {
    ...item,
    place: rule.place,
    memo: mergeItineraryMemo(rule.memoPrefix, item.memo),
  } : item;

  return cleanSavedItineraryCoordinates(cleanedItem);
}

function cleanSavedItineraryCoordinates(item) {
  const lat = Number.parseFloat(item?.lat);
  const lon = Number.parseFloat(item?.lon);
  const hasCoordinates = Number.isFinite(lat)
    && Number.isFinite(lon)
    && Math.abs(lat) <= 90
    && Math.abs(lon) <= 180;
  if (!hasCoordinates) return item;
  if (highTrustSavedCoordinateSources.has(item.coordinateSource || "")) return item;

  const cleanedItem = { ...item };
  delete cleanedItem.lat;
  delete cleanedItem.lon;
  delete cleanedItem.coordinateSignature;
  delete cleanedItem.coordinatePrecision;
  delete cleanedItem.coordinateAddress;
  delete cleanedItem.googlePlaceId;
  if (cleanedItem.coordinateSource !== "google-query-preview") {
    delete cleanedItem.coordinateSource;
  }
  return cleanedItem;
}

function getItineraryPlaceCleanupRule(item) {
  if (item.place === "점심 식사") {
    return { place: inferMealPlaceName(item) };
  }
  return itineraryPlaceCleanupRules[item.place] || null;
}

function inferMealPlaceName(item) {
  const location = item.location || "";
  if (location.includes("구좌읍")) return "구좌읍";
  if (location.includes("함덕리")) return "함덕해수욕장";
  if (location.includes("중문동")) return "중문동";
  if (location.includes("서귀동")) return "서귀동";
  if (location.includes("성산읍")) return "성산읍";
  return "식사 장소 미정";
}

function mergeItineraryMemo(prefix, memo = "") {
  const normalizedMemo = String(memo || "").trim();
  const normalizedPrefix = String(prefix || "").trim();
  if (!normalizedPrefix || normalizedMemo.includes(normalizedPrefix)) return normalizedMemo;
  return [normalizedPrefix, normalizedMemo].filter(Boolean).join(" ");
}

function cleanSavedItineraryItems(items) {
  return Array.isArray(items) ? items.map(cleanSavedItineraryPlace) : [];
}

function getFallbackState(tripId = "trip_default") {
  return {
    id: tripId,
    tripName: "제주도 7박 8일 여행",
    country: "대한민국",
    countryCode: "KR",
    city: "제주",
    travelMode: "domestic",
    theme: "toss",
    startDate: "2026-06-09",
    endDate: "2026-06-16",
    selectedDate: "2026-06-09",
    selectedItineraryDate: "2026-06-09",
    lastActiveItineraryDate: "2026-06-09",
    selectedItineraryId: "",
    currencyCode: "JPY",
    currencySymbol: "¥",
    currencyUnit: "엔",
    exchangeBase: 100,
    exchangeRate: 950,
    exchangeRateUpdatedAt: "",
    exchangeRateSource: "기본값",
    currencyAutoMatchedCountryCode: "",
    entries: [],
    itineraryItems: [],
    packingList: typeof getDefaultPackingList === "function" ? getDefaultPackingList() : [],
    companions: [],
    collaboration: {
      ownerId: "",
      ownerName: "나",
      ownerEmail: "",
      inviteToken: "",
      lastInviteUrl: "",
      members: [],
      pendingInvites: [],
      privacy: {
        shareItinerary: true,
        shareExpenses: true,
        showMemberEmail: false,
        allowInviteRequests: true,
      },
    },
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

    const cleanedActiveItineraryItems = cleanSavedItineraryItems(activeTrip.itineraryItems);
    if (JSON.stringify(cleanedActiveItineraryItems) !== JSON.stringify(activeTrip.itineraryItems || [])) {
      activeTrip = { ...activeTrip, itineraryItems: cleanedActiveItineraryItems };
      trips = trips.map((trip) => trip.id === activeTripId ? activeTrip : trip);
      localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    }

    const preferredCurrency = currencies.find((currency) => currency.code === activeTrip.currencyCode) || currencies[0];
    const fallback = getFallbackState(activeTripId);
    const savedTheme = getSavedTheme();
    return {
      ...fallback,
      ...activeTrip,
      theme: savedTheme || "toss",
      currencyCode: preferredCurrency.code,
      currencySymbol: activeTrip.currencySymbol || preferredCurrency.symbol,
      currencyUnit: activeTrip.currencyUnit || preferredCurrency.unit,
      exchangeBase: Number(activeTrip.exchangeBase || preferredCurrency.rateBase || 1),
      entries: Array.isArray(activeTrip.entries) ? activeTrip.entries : [],
      itineraryItems: cleanedActiveItineraryItems,
      packingList: Array.isArray(activeTrip.packingList) ? activeTrip.packingList : (typeof getDefaultPackingList === "function" ? getDefaultPackingList() : []),
      companions: Array.isArray(activeTrip.companions) ? activeTrip.companions : [],
      collaboration: normalizeCollaborationSettings(activeTrip.collaboration),
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

function normalizeCollaborationSettings(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const privacy = source.privacy && typeof source.privacy === "object" ? source.privacy : {};
  return {
    ownerId: typeof source.ownerId === "string" ? source.ownerId : "",
    ownerName: typeof source.ownerName === "string" && source.ownerName.trim() ? source.ownerName.trim() : "나",
    ownerEmail: typeof source.ownerEmail === "string" ? source.ownerEmail : "",
    inviteToken: typeof source.inviteToken === "string" ? source.inviteToken : "",
    lastInviteUrl: typeof source.lastInviteUrl === "string" ? source.lastInviteUrl : "",
    members: Array.isArray(source.members)
      ? source.members
          .filter((member) => member && typeof member === "object")
          .map((member) => ({
            id: typeof member.id === "string" ? member.id : "",
            name: typeof member.name === "string" && member.name.trim() ? member.name.trim() : "여행 멤버",
            email: typeof member.email === "string" ? member.email : "",
            role: member.role === "owner" ? "owner" : "member",
            status: member.status === "pending" ? "pending" : "accepted",
            joinedAt: typeof member.joinedAt === "string" ? member.joinedAt : "",
          }))
      : [],
    pendingInvites: Array.isArray(source.pendingInvites)
      ? source.pendingInvites.filter((invite) => invite && typeof invite === "object")
      : [],
    privacy: {
      shareItinerary: privacy.shareItinerary !== false,
      shareExpenses: privacy.shareExpenses !== false,
      showMemberEmail: privacy.showMemberEmail === true,
      allowInviteRequests: privacy.allowInviteRequests !== false,
    },
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
    state.collaboration = normalizeCollaborationSettings(state.collaboration);

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
  Object.assign(state, {
    ...getFallbackState(tripId),
    ...targetTrip,
    itineraryItems: cleanSavedItineraryItems(targetTrip.itineraryItems),
    collaboration: normalizeCollaborationSettings(targetTrip.collaboration),
    settlement: normalizeSettlementSettings(targetTrip.settlement),
  });
  state.theme = currentTheme;

  // reset day selections
  state.selectedDate = state.startDate;
  state.selectedItineraryDate = state.startDate;
  state.lastActiveItineraryDate = state.startDate;

  saveAndRender();
}

function createNewTrip({ tripName, country, countryCode, city, travelMode, startDate, endDate, totalBudget }) {
  const trips = getTrips();
  const newId = "trip_" + Date.now();
  const normalizedTravelMode = travelMode === "overseas" ? "overseas" : "domestic";
  const normalizedCountryCode = (countryCode || (normalizedTravelMode === "domestic" ? "KR" : "")).toUpperCase();
  const matchedCurrencyCode = getCurrencyCodeForCountry(normalizedCountryCode, normalizedTravelMode);
  const matchedCurrency = currencies.find((currency) => currency.code === matchedCurrencyCode) || currencies[0];
  const newTrip = {
    ...getFallbackState(newId),
    tripName: tripName || "새로운 여행 ✈️",
    country: country || (normalizedTravelMode === "domestic" ? "대한민국" : ""),
    countryCode: normalizedCountryCode,
    city: city || (normalizedTravelMode === "domestic" ? "서울" : ""),
    travelMode: normalizedTravelMode,
    theme: normalizeThemeName(state.theme || getSavedTheme()),
    currencyCode: matchedCurrency.code,
    currencySymbol: matchedCurrency.symbol,
    currencyUnit: matchedCurrency.unit,
    exchangeBase: matchedCurrency.rateBase,
    exchangeRate: getDefaultExchangeRateForCurrency(matchedCurrency.code),
    exchangeRateSource: "국가 기본값",
    currencyAutoMatchedCountryCode: normalizedCountryCode,
    startDate: startDate || "2026-06-09",
    endDate: endDate || "2026-06-16",
    selectedDate: startDate || "2026-06-09",
    selectedItineraryDate: startDate || "2026-06-09",
    lastActiveItineraryDate: startDate || "2026-06-09",
    totalBudget: totalBudget || 0,
    entries: [],
    itineraryItems: [],
    packingList: typeof getDefaultPackingList === "function" ? getDefaultPackingList() : [],
    companions: [],
    collaboration: normalizeCollaborationSettings({}),
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

function importSharedTripSnapshot(snapshot = {}, { makeActive = true } = {}) {
  const importedId = typeof snapshot.id === "string" && snapshot.id
    ? snapshot.id
    : `trip_shared_${Date.now()}`;
  const importedTrip = {
    ...getFallbackState(importedId),
    ...snapshot,
    id: importedId,
    entries: Array.isArray(snapshot.entries) ? snapshot.entries : [],
    itineraryItems: cleanSavedItineraryItems(snapshot.itineraryItems),
    packingList: Array.isArray(snapshot.packingList) ? snapshot.packingList : (typeof getDefaultPackingList === "function" ? getDefaultPackingList() : []),
    companions: Array.isArray(snapshot.companions) ? snapshot.companions : [],
    collaboration: normalizeCollaborationSettings(snapshot.collaboration),
    settlement: normalizeSettlementSettings(snapshot.settlement),
  };
  let trips = getTrips();
  const existingIndex = trips.findIndex((trip) => trip.id === importedTrip.id);
  if (existingIndex >= 0) {
    trips[existingIndex] = { ...trips[existingIndex], ...importedTrip };
  } else {
    trips.push(importedTrip);
  }
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  if (makeActive) switchTrip(importedTrip.id);
  return importedTrip;
}

function getStateSnapshot() {
  return JSON.parse(JSON.stringify(state));
}

function resetPersistedTravelData(nextState = {}) {
  const resetState = {
    ...getFallbackState("trip_default"),
    ...nextState,
    id: "trip_default",
    collaboration: normalizeCollaborationSettings(nextState.collaboration),
    settlement: normalizeSettlementSettings(nextState.settlement),
  };
  localStorage.setItem(TRIPS_KEY, JSON.stringify([resetState]));
  localStorage.setItem(ACTIVE_TRIP_ID_KEY, resetState.id);
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(resetState));
  return resetState;
}

window.TripLog.register("persistence.stateStorage", {
  loadState,
  isLegacyDefaultTripName,
  hasNoSavedRecords,
  normalizeThemeName,
  getSavedTheme,
  cleanSavedItineraryPlace,
  cleanSavedItineraryCoordinates,
  cleanSavedItineraryItems,
  normalizeSettlementSettings,
  normalizeCollaborationSettings,
  saveAndRender,
  saveStateSilently,
  getStateSnapshot,
  resetPersistedTravelData,
  getTrips,
  getActiveTripId,
  switchTrip,
  createNewTrip,
  deleteTrip,
  importSharedTripSnapshot,
});
