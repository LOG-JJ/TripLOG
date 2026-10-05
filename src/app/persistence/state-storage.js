const LEGACY_STORAGE_KEY = window.TripLog.core.config.STORAGE_KEY;
const TRIPS_KEY = "domesticTravelExpensePlanner.trips.v2";
const ACTIVE_TRIP_ID_KEY = "domesticTravelExpensePlanner.activeTripId.v2";
const THEME_KEY = "domesticTravelExpensePlanner.theme.v3";
let repositoryReady = false;
let repositoryAccount = "";
let repositoryProject = "";
let repositoryPreferredTrip = "";
let repositoryTrips = [];
const repositoryViews = new Map();
const repositorySources = new Map();
const repositoryPending = new Map();
const repositoryFailures = new Map();
const repositoryDeletions = new Map();
let repositoryWriteTail = Promise.resolve();
let storageReadyPromise;
const highTrustSavedCoordinateSources = new Set(["coordinate-text", "google-places", "google-geocoding", "nominatim-search", "knowledge-search"]);

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

function normalizeTravelCompanion(value, items) {
  const source = value && typeof value === "object" ? value : {};
  const string = input => typeof input === "string" ? input : "";
  const ids = Array.isArray(items) ? new Set(items.filter(Boolean).map(item => item.id)) : null;
  const normalizeIds = list => [...new Set((Array.isArray(list) ? list : []).filter(id => typeof id === "string" && id && (!ids || ids.has(id))))];
  let timeZone = string(source.timeZone);
  try { if (timeZone) new Intl.DateTimeFormat("en", { timeZone }); } catch { timeZone = ""; }
  const seen = new Set();
  const reservations = (Array.isArray(source.reservations) ? source.reservations : []).filter(row => row && typeof row === "object" && typeof row.id === "string" && row.id && typeof row.title === "string" && row.title.trim()).filter(row => { if (seen.has(row.id)) return false; seen.add(row.id); return true; }).map(row => ({
    id: row.id,
    type: ["transport", "stay", "activity", "other"].includes(row.type) ? row.type : "other",
    title: row.title.trim(), date: string(row.date), endDate: string(row.endDate), time: string(row.time),
    endTime: string(row.endTime), arrivalDate: string(row.arrivalDate), transportKind: string(row.transportKind), from: string(row.from), to: string(row.to),
    reference: string(row.reference), location: string(row.location), url: string(row.url), note: string(row.note),
  }));
  // A linked transport schedule owns its route and times. Persist the same values
  // in the wallet after any itinerary edit (including quick time adjustments).
  for (const row of reservations) {
    if (row.type !== 'transport') continue;
    const linked = Array.isArray(items) && items.find(item => item?.linkedReservationId === `manual:${row.id}` && item.theme === 'transport' && item.transportReservation);
    if (!linked) continue;
    Object.assign(row, {
      title: string(linked.voucherName) || string(linked.place) || row.title,
      date: string(linked.date), time: string(linked.time), endTime: string(linked.endTime),
      transportKind: string(linked.transportReservation.kind), from: string(linked.transportReservation.from), to: string(linked.transportReservation.to), arrivalDate: string(linked.transportReservation.arrivalDate),
      reference: string(linked.voucherCode), location: string(linked.location), note: string(linked.memo),
    });
  }
  const undo = source.lastAdjustment;
  const lastAdjustment = undo && typeof undo === "object" && typeof undo.tripId === "string" && typeof undo.date === "string" && typeof undo.afterSignature === "string" && Array.isArray(undo.before)
    ? { tripId: undo.tripId, date: undo.date, afterSignature: undo.afterSignature, before: undo.before.filter(item => item && typeof item.id === "string" && typeof item.time === "string" && typeof item.endTime === "string").map(item => ({ id: item.id, time: item.time, endTime: item.endTime })) }
    : null;
  return { completedItineraryIds: normalizeIds(source.completedItineraryIds), lockedItineraryIds: normalizeIds(source.lockedItineraryIds), reservations, timeZone, lastAdjustment };
}

function getFallbackState(tripId = "trip_default") {
  return {
    id: tripId,
    tripName: "제주도 7박 8일 여행",
    country: "대한민국",
    countryCode: "KR",
    city: "제주",
    travelMode: "domestic",
    theme: "brutalist",
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
    travelCompanion: normalizeTravelCompanion(),
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
      if (!window.TripLogSyncRepository) {
        localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
        localStorage.setItem(ACTIVE_TRIP_ID_KEY, activeTripId);
      }
    }

    if (!activeTripId) {
      activeTripId = trips[0].id;
      if (!window.TripLogSyncRepository) localStorage.setItem(ACTIVE_TRIP_ID_KEY, activeTripId);
    }

    let activeTrip = trips.find(t => t.id === activeTripId);
    if (!activeTrip) {
      activeTrip = trips[0];
      activeTripId = activeTrip.id;
      if (!window.TripLogSyncRepository) localStorage.setItem(ACTIVE_TRIP_ID_KEY, activeTripId);
    }

    const cleanedActiveItineraryItems = cleanSavedItineraryItems(activeTrip.itineraryItems);
    if (JSON.stringify(cleanedActiveItineraryItems) !== JSON.stringify(activeTrip.itineraryItems || [])) {
      activeTrip = { ...activeTrip, itineraryItems: cleanedActiveItineraryItems };
      trips = trips.map((trip) => trip.id === activeTripId ? activeTrip : trip);
      if (!window.TripLogSyncRepository) localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    }

    const preferredCurrency = currencies.find((currency) => currency.code === activeTrip.currencyCode) || currencies[0];
    const fallback = getFallbackState(activeTripId);
    const savedTheme = getSavedTheme();
    return {
      ...fallback,
      ...activeTrip,
      theme: savedTheme || "brutalist",
      currencyCode: preferredCurrency.code,
      currencySymbol: activeTrip.currencySymbol || preferredCurrency.symbol,
      currencyUnit: activeTrip.currencyUnit || preferredCurrency.unit,
      exchangeBase: Number(activeTrip.exchangeBase || preferredCurrency.rateBase || 1),
      entries: Array.isArray(activeTrip.entries) ? activeTrip.entries : [],
      itineraryItems: cleanedActiveItineraryItems,
      travelCompanion: normalizeTravelCompanion(activeTrip.travelCompanion, cleanedActiveItineraryItems),
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
  return entries.length === 0 && itineraryItems.length === 0 && !saved?.travelCompanion?.reservations?.length;
}

function normalizeSettlementSettings(value = {}) {
  const splitMode = value?.splitMode === "custom" ? "custom" : "equal";
  const customShares = value?.customShares && typeof value.customShares === "object" ? value.customShares : {};
  const itemSplits = value?.itemSplits && typeof value.itemSplits === "object" ? value.itemSplits : {};
  return {
    sourceId: typeof value?.sourceId === "string" ? value.sourceId : "current",
    leaderName: typeof value?.leaderName === "string" && value.leaderName.trim() ? value.leaderName.trim().slice(0,80) : "여행 대표",
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
            role: ["owner", "member", "editor", "viewer"].includes(member.role) ? member.role : "member",
            status: member.status === "pending" ? "pending" : "accepted",
            joinedAt: typeof member.joinedAt === "string" ? member.joinedAt : "",
            ...(member.source === "supabase" ? { source: "supabase" } : {}),
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
  const saving = saveStateSilently();
  render();
  return saving;
}

function markDeletedEntity(kind, id) {
  if (!id) return;
  const deletions = repositoryDeletions.get(state.id) || [];
  deletions.push({ kind, id });
  repositoryDeletions.set(state.id, deletions);
}

function rememberRepositoryView(snapshot, source = snapshot) {
  const M = window.TripLogSyncModel;
  repositoryViews.set(snapshot.id, M.clone(snapshot));
  repositorySources.set(snapshot.id, M.clone(source));
}

function saveStateSilently() {
  const M = window.TripLogSyncModel;
  const R = window.TripLogSyncRepository;
  if (M && R && repositoryReady) {
    state.theme = normalizeThemeName(state.theme);
    state.collaboration = normalizeCollaborationSettings(state.collaboration);
    state.travelCompanion = normalizeTravelCompanion(state.travelCompanion, state.itineraryItems);
    const snapshot = M.ensureIds(state);
    const deletions = repositoryDeletions.get(snapshot.id) || [];
    repositoryDeletions.delete(snapshot.id);
    const observed = M.clone(repositoryViews.get(snapshot.id) || snapshot);
    const sourceSnapshot = M.clone(repositorySources.get(snapshot.id) || observed);
    const ranked = M.reposition(snapshot, M.encode(observed));
    const sourceEntities = M.encode(sourceSnapshot);
    const changes = M.diff(M.encode(observed), M.encode(ranked), { source: sourceEntities });
    // Consecutive queued saves observe our own optimistic writes, not unrelated
    // changes that another tab made after this view was rendered.
    rememberRepositoryView(snapshot, M.decode(M.apply(sourceEntities, changes).entities, ranked));
    repositoryPending.set(snapshot.id, (repositoryPending.get(snapshot.id) || 0) + 1);
    window.TripLog.sync.controller?.localWrite(snapshot.id, 1);
    const job = repositoryWriteTail.then(async () => {
      try {
        const failed = repositoryFailures.get(snapshot.id);
        const record = await R.save(snapshot, failed?.observed || observed, { sourceSnapshot: failed?.sourceSnapshot || sourceSnapshot, deletions: [...(failed?.deletions || []), ...deletions] });
        repositoryFailures.delete(snapshot.id);
        window.TripLog.sync.controller?.setLocalFailure(null, snapshot.id);
        const index = repositoryTrips.findIndex(t => t.id === snapshot.id);
        if (index < 0) repositoryTrips.push(record.snapshot); else repositoryTrips[index] = record.snapshot;
        // Theme is a preference; failure of this optional mirror does not undo the IDB commit.
        try { localStorage.setItem(THEME_KEY, snapshot.theme); } catch (_) { /* IndexedDB remains authoritative. */ }
        window.dispatchEvent(new CustomEvent("triplog:state-saved", { detail: { tripId: snapshot.id } }));
        return true;
      } catch (error) {
        repositoryFailures.set(snapshot.id, { snapshot, observed: repositoryFailures.get(snapshot.id)?.observed || observed, sourceSnapshot: repositoryFailures.get(snapshot.id)?.sourceSnapshot || sourceSnapshot, deletions: [...(repositoryFailures.get(snapshot.id)?.deletions || []), ...deletions] });
        window.TripLog.sync.controller?.setLocalFailure(error, snapshot.id);
        return false;
      } finally {
        repositoryPending.set(snapshot.id, Math.max(0, (repositoryPending.get(snapshot.id) || 1) - 1));
        window.TripLog.sync.controller?.localWrite(snapshot.id, -1);
        if (!repositoryPending.get(snapshot.id) && !repositoryFailures.has(snapshot.id)) applyRepositoryChange(snapshot.id);
      }
    });
    repositoryWriteTail = job.catch(() => false);
    return job;
  }
  if (R && !repositoryReady) {
    window.TripLog.sync.controller?.setLocalFailure(new Error("기기 저장소를 준비하지 못했습니다. 입력을 보관하거나 내보내 주세요."));
    return Promise.resolve(false);
  }
  try {
    let trips = JSON.parse(localStorage.getItem(TRIPS_KEY)) || [];
    const activeTripId = localStorage.getItem(ACTIVE_TRIP_ID_KEY);
    const theme = normalizeThemeName(state.theme);
    state.theme = theme;
    state.collaboration = normalizeCollaborationSettings(state.collaboration);
    state.travelCompanion = normalizeTravelCompanion(state.travelCompanion, state.itineraryItems);

    const index = trips.findIndex(t => t.id === state.id);
    if (index < 0) trips.push({ ...state }); else trips[index] = { ...trips[index], ...state };
    localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    localStorage.setItem(THEME_KEY, theme);

    // Legacy support
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("triplog:state-saved", {
      detail: { tripId: state.id },
    }));
    return Promise.resolve(true);
  } catch (e) {
    console.error("Save failed:", e);
    return Promise.resolve(false);
  }
}

function getTrips() {
  if (repositoryReady) return window.TripLogSyncModel.clone(repositoryTrips);
  try {
    return JSON.parse(localStorage.getItem(TRIPS_KEY)) || [];
  } catch {
    return [];
  }
}

function getActiveTripId() {
  if (typeof state !== "undefined" && state.id) return state.id;
  return localStorage.getItem(ACTIVE_TRIP_ID_KEY);
}

function switchTrip(tripId) {
  const trips = getTrips();
  const targetTrip = trips.find(t => t.id === tripId);
  if (!targetTrip) return;
  repositoryPreferredTrip = tripId;
  const currentTheme = normalizeThemeName(state.theme || getSavedTheme());
  const currentNavigation = state.id === tripId ? {
    selectedDate: state.selectedDate,
    selectedItineraryDate: state.selectedItineraryDate,
    lastActiveItineraryDate: state.lastActiveItineraryDate,
  } : null;

  try { sessionStorage.setItem(ACTIVE_TRIP_ID_KEY, tripId); } catch (_) { /* The active state remains tab-local. */ }

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
    travelCompanion: normalizeTravelCompanion(targetTrip.travelCompanion, targetTrip.itineraryItems || []),
    collaboration: normalizeCollaborationSettings(targetTrip.collaboration),
    settlement: normalizeSettlementSettings(targetTrip.settlement),
  });
  state.theme = currentTheme;
  if (repositoryReady) rememberRepositoryView(state, targetTrip);

  // Refreshing the same trip must preserve this device's current navigation.
  const dayDates = new Set(getTripDays().map((day) => day.date));
  state.selectedDate = currentNavigation
    && (isPreTripExpenseDate(currentNavigation.selectedDate) || dayDates.has(currentNavigation.selectedDate))
    ? currentNavigation.selectedDate : state.startDate;
  state.selectedItineraryDate = currentNavigation
    && (currentNavigation.selectedItineraryDate === "all" || dayDates.has(currentNavigation.selectedItineraryDate))
    ? currentNavigation.selectedItineraryDate : state.startDate;
  state.lastActiveItineraryDate = currentNavigation && dayDates.has(currentNavigation.lastActiveItineraryDate)
    ? currentNavigation.lastActiveItineraryDate : state.startDate;

  return saveAndRender();
}

async function createNewTrip({ tripName, country, countryCode, city, travelMode, startDate, endDate, totalBudget }) {
  const trips = getTrips();
  const newId = window.TripLogSyncModel?.uuid() || "trip_" + Date.now();
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

  if (repositoryReady) {
    try { await window.TripLogSyncRepository.update(newId, () => ({ ...window.TripLogSyncRepository.makeRecord(newTrip), accountId: repositoryAccount, projectId: repositoryProject, localRevision: 1 })); }
    catch (error) { window.TripLog.sync.controller?.setLocalFailure(error); return false; }
  }
  trips.push(newTrip);
  if (repositoryReady) {
    repositoryTrips = trips;
    rememberRepositoryView(newTrip);
  } else localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));

  return switchTrip(newId);
}

async function deleteTrip(tripId) {
  let trips = getTrips();
  const trip = trips.find(trip => trip.id === tripId);
  if (!trip) return false;
  if (trips.length <= 1) {
    showToast("마지막 여행은 삭제할 수 없어요.");
    return false;
  }

  const record = window.TripLogSyncRepository?.cached(tripId);
  const scope = record?.serverId && record.role === "owner"
    ? "공유 여행은 모든 멤버에게 읽기 전용으로 전환됩니다."
    : "이 기기의 여행 목록에서만 삭제됩니다.";
  const message = `“${trip.tripName || '새로운 여행'}” 여행을 목록에서 삭제할까요?\n${scope} 복구 기록에서 다시 열 수 있어요.`;
  if (!await (window.TripLog.features.redesign?.workspace?.confirmAction?.(message) ?? window.confirm(message))) {
    return false;
  }

  trips = getTrips();
  if (trips.length <= 1 || !trips.some(trip => trip.id === tripId)) return false;
  const latest = window.TripLogSyncRepository?.cached(tripId);
  if (latest?.serverId !== record?.serverId || latest?.role !== record?.role) {
    showToast("여행의 공유 상태가 바뀌었어요. 다시 선택해 주세요.");
    return false;
  }
  trips = trips.filter(t => t.id !== tripId);
  try {
    if (repositoryReady) {
      if (record?.serverId && record.role === "owner") {
        await window.TripLog.sync.controller.engine.control(tripId, "archive", {});
      }
      await window.TripLogSyncRepository.update(tripId, record => ({ ...record, hidden: true }), { snapshot: true, source: "before-trip-hide" });
      repositoryTrips = getTrips().filter(trip => trip.id !== tripId);
      trips = repositoryTrips;
    } else localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  } catch (_) {
    showToast("여행을 삭제하지 못했어요. 연결과 저장 상태를 확인한 뒤 다시 시도해 주세요.");
    return false;
  }

  const activeTripId = getActiveTripId();
  if (activeTripId === tripId) {
    await switchTrip(trips[0].id);
  } else {
    render();
  }
  return true;
}

function normalizeImportedTripSnapshot(snapshot = {}) {
  const importedId = typeof snapshot.id === "string" && snapshot.id
    ? snapshot.id
    : `trip_shared_${Date.now()}`;
  return {
    ...getFallbackState(importedId),
    ...snapshot,
    id: importedId,
    entries: Array.isArray(snapshot.entries) ? snapshot.entries : [],
    itineraryItems: cleanSavedItineraryItems(snapshot.itineraryItems),
    travelCompanion: normalizeTravelCompanion(snapshot.travelCompanion, snapshot.itineraryItems || []),
    packingList: Array.isArray(snapshot.packingList) ? snapshot.packingList : (typeof getDefaultPackingList === "function" ? getDefaultPackingList() : []),
    companions: Array.isArray(snapshot.companions) ? snapshot.companions : [],
    collaboration: normalizeCollaborationSettings(snapshot.collaboration),
    settlement: normalizeSettlementSettings(snapshot.settlement),
  };
}

async function importSharedTripSnapshot(snapshot = {}, { makeActive = true } = {}) {
  const importedTrip = normalizeImportedTripSnapshot(snapshot);
  let trips = getTrips();
  const existingIndex = trips.findIndex((trip) => trip.id === importedTrip.id);
  if (existingIndex >= 0) {
    trips[existingIndex] = { ...trips[existingIndex], ...importedTrip };
  } else {
    trips.push(importedTrip);
  }
  if (repositoryReady) {
    const R = window.TripLogSyncRepository;
    const existing = await R.read(importedTrip.id);
    if (existing) await R.update(importedTrip.id, record => record, { snapshot: true, source: "before-history-restore" });
    if (!existing) await R.update(importedTrip.id, () => ({ ...R.makeRecord(importedTrip), accountId: repositoryAccount, projectId: repositoryProject, localRevision: 1 }));
    await R.save(importedTrip, existing?.snapshot || importedTrip);
    repositoryTrips = trips;
    rememberRepositoryView(importedTrip);
  } else localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  if (makeActive) await switchTrip(importedTrip.id);
  return importedTrip;
}

function isEmptyDefaultSeedTrip(trip) {
  if (!trip || trip.id !== "trip_default" || !hasNoSavedRecords(trip)) return false;
  const fallback = getFallbackState("trip_default");
  return (trip.tripName || "") === fallback.tripName
    && (trip.startDate || "") === fallback.startDate
    && (trip.endDate || "") === fallback.endDate;
}

function syncTripsFromSnapshots(snapshots = [], { preferredActiveId = "", removeEmptyDefault = true } = {}) {
  if (repositoryReady) throw new Error("전체 스냅샷 덮어쓰기는 지원하지 않습니다. 항목 동기화 API를 사용해 주세요.");
  const importedTrips = (Array.isArray(snapshots) ? snapshots : [])
    .filter((snapshot) => snapshot && typeof snapshot === "object")
    .map(normalizeImportedTripSnapshot);
  if (!importedTrips.length) {
    return {
      changed: false,
      activeTripId: getActiveTripId(),
      importedCount: 0,
      removedEmptyDefault: false,
    };
  }

  const beforeTrips = getTrips();
  const beforeSignature = JSON.stringify(beforeTrips);
  const beforeActiveId = getActiveTripId();
  const importedIds = new Set(importedTrips.map((trip) => trip.id));
  let trips = [...beforeTrips];

  importedTrips.forEach((importedTrip) => {
    const existingIndex = trips.findIndex((trip) => trip.id === importedTrip.id);
    if (existingIndex >= 0) {
      trips[existingIndex] = { ...trips[existingIndex], ...importedTrip };
    } else {
      trips.push(importedTrip);
    }
  });

  let removedEmptyDefault = false;
  if (removeEmptyDefault && !importedIds.has("trip_default")) {
    const nextTrips = trips.filter((trip) => !isEmptyDefaultSeedTrip(trip));
    removedEmptyDefault = nextTrips.length !== trips.length;
    if (nextTrips.length) trips = nextTrips;
  }

  const preferredId = preferredActiveId && trips.some((trip) => trip.id === preferredActiveId)
    ? preferredActiveId
    : "";
  const activeStillExists = beforeActiveId && trips.some((trip) => trip.id === beforeActiveId);
  const activeTripId = preferredId || (activeStillExists ? beforeActiveId : importedTrips[0]?.id || trips[0]?.id || "trip_default");

  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  localStorage.setItem(ACTIVE_TRIP_ID_KEY, activeTripId);

  const changed = beforeSignature !== JSON.stringify(trips)
    || beforeActiveId !== activeTripId
    || state.id !== activeTripId;
  if (activeTripId && trips.some((trip) => trip.id === activeTripId)) {
    switchTrip(activeTripId);
  }

  return {
    changed,
    activeTripId,
    importedCount: importedTrips.length,
    removedEmptyDefault,
  };
}

function getStateSnapshot() {
  return JSON.parse(JSON.stringify(state));
}

function resetPersistedTravelData(nextState = {}) {
  if (repositoryReady) {
    // A reset creates a separate local trip. Existing trips and pending edits remain recoverable.
    const id = window.TripLogSyncModel.uuid();
    const reset = normalizeImportedTripSnapshot({ ...getFallbackState(id), ...nextState, id });
    repositoryTrips.push(reset); rememberRepositoryView(reset);
    return reset;
  }
  const resetState = {
    ...getFallbackState("trip_default"),
    ...nextState,
    id: "trip_default",
    collaboration: normalizeCollaborationSettings(nextState.collaboration),
    settlement: normalizeSettlementSettings(nextState.settlement),
    travelCompanion: normalizeTravelCompanion(nextState.travelCompanion, nextState.itineraryItems || []),
  };
  localStorage.setItem(TRIPS_KEY, JSON.stringify([resetState]));
  localStorage.setItem(ACTIVE_TRIP_ID_KEY, resetState.id);
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(resetState));
  return resetState;
}

async function initializeRepository() {
  if (storageReadyPromise) return storageReadyPromise;
  storageReadyPromise = (async () => {
    const R = window.TripLogSyncRepository, M = window.TripLogSyncModel;
    if (!R) return;
    const legacy = getTrips();
    if (!legacy.length) legacy.push(window.TripLogSyncModel.clone(state));
    let legacyAccount = "";
    try {
      const cached = JSON.parse(localStorage.getItem("domesticTravelExpensePlanner.account.v1") || "null");
      if (cached?.provider === "supabase" && typeof cached.id === "string" && !cached.id.startsWith("local_")) legacyAccount = cached.id;
    } catch (_) { /* Unknown device ownership remains unbound until authenticated reconciliation. */ }
    await R.migrate(legacy, { accountId: legacyAccount });
    repositoryTrips = (await R.all()).filter(r => !r.hidden && !r.accountId).map(r => r.snapshot);
    repositoryReady = true;
    let active;
    try { active = sessionStorage.getItem(ACTIVE_TRIP_ID_KEY); } catch (_) { /* Use the existing tab state. */ }
    const requestedTrip = typeof URLSearchParams === 'function' ? new URLSearchParams(window.location?.search || '').get('trip') : null;
    repositoryPreferredTrip = requestedTrip || active || state.id;
    const current = repositoryTrips.find(t => t.id === repositoryPreferredTrip) || repositoryTrips[0];
    if (current) { for (const key of Object.keys(state)) delete state[key]; Object.assign(state, normalizeImportedTripSnapshot(current)); }
    else await activateAccount("");
    for (const trip of repositoryTrips) rememberRepositoryView(normalizeImportedTripSnapshot(trip), trip);
    R.subscribe(applyRepositoryChange);
  })();
  window.TripLog.persistence.stateStorage.ready = storageReadyPromise;
  return storageReadyPromise;
}

async function activateAccount(accountId, projectId = "") {
  repositoryAccount = accountId || "";
  repositoryProject = projectId;
  const R = window.TripLogSyncRepository;
  const records = await R.all();
  if (repositoryAccount !== (accountId || "") || repositoryProject !== projectId) return;
  repositoryTrips = records.filter(r => !r.hidden && (!r.accountId || r.accountId === repositoryAccount) && (!r.projectId || r.projectId === projectId)).map(r => r.snapshot);
  const current = R.cached(state.id);
  const bound = accountId && (repositoryTrips.find(t => t.id === repositoryPreferredTrip && R.cached(t.id)?.serverId) || repositoryTrips.find(t => R.cached(t.id)?.serverId));
  if (!repositoryTrips.some(t => t.id === state.id) || (bound && (current?.placeholder || (!current?.serverId && !current?.localRevision && hasNoSavedRecords(state))))) {
    let next = repositoryTrips.find(t => t.id === repositoryPreferredTrip) || bound || repositoryTrips[0];
    if (bound && (!next || (!R.cached(next.id)?.serverId && !R.cached(next.id)?.localRevision && hasNoSavedRecords(next)))) next = bound;
    if (!next) {
      next = getFallbackState(window.TripLogSyncModel.uuid()); next.tripName = "새 여행";
      await R.update(next.id, () => ({ ...R.makeRecord(next), accountId: repositoryAccount, projectId: repositoryProject, placeholder: true }));
      repositoryTrips.push(next);
    }
    if (typeof editingId !== "undefined") editingId = null;
    if (typeof editingItineraryId !== "undefined") editingItineraryId = null;
    document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, normalizeImportedTripSnapshot(next));
    rememberRepositoryView(state, next);
  }
  if (document.documentElement.dataset.triplogInitialized && typeof render === "function") render();
}

function applyRepositoryChange(localId) {
  if (!repositoryReady || repositoryPending.get(localId) || repositoryFailures.has(localId)) return;
  const M = window.TripLogSyncModel, record = window.TripLogSyncRepository.cached(localId);
  if (!record || record.hidden || (record.accountId && record.accountId !== repositoryAccount) || (record.projectId && record.projectId !== repositoryProject)) return;
  const index = repositoryTrips.findIndex(t => t.id === localId);
  if (index < 0) repositoryTrips.push(record.snapshot); else repositoryTrips[index] = record.snapshot;
  if (state.id !== localId) return;
  const selected = Object.fromEntries(["theme", "selectedDate", "selectedItineraryDate", "lastActiveItineraryDate", "selectedItineraryId"].map(k => [k, state[k]]));
  const previous = M.clone(state);
  const next = normalizeImportedTripSnapshot(record.snapshot);
  const source = M.clone(record.snapshot);
  const previousSource = repositorySources.get(localId);
  // Open editors retain the version they began editing. Only fields the user changes
  // become patches, so a remote edit cannot be silently accepted as the edit baseline.
  for (const [field, id] of [["itineraryItems", typeof editingItineraryId !== "undefined" ? editingItineraryId : null], ["entries", typeof editingId !== "undefined" ? editingId : null]]) {
    const edited = id && previous[field]?.find(row => row.id === id);
    if (edited) {
      const index = next[field].findIndex(row => row.id === id);
      if (index >= 0) next[field][index] = edited; else next[field].push(edited);
      const original = previousSource?.[field]?.find(row => row.id === id) || edited;
      const sourceIndex = source[field].findIndex(row => row.id === id);
      if (sourceIndex >= 0) source[field][sourceIndex] = M.clone(original); else source[field].push(M.clone(original));
    }
  }
  Object.assign(state, next, selected);
  rememberRepositoryView(state, source);
  if (M.equal(previous, state) || typeof render !== "function") return;
  const active = document.activeElement;
  const scopes = [...document.querySelectorAll("dialog[open], form:focus-within")];
  const values = [...new Set(scopes.flatMap(scope => [...scope.querySelectorAll("input[id],textarea[id],select[id]")]))].map(el => ({ id: el.id, value: el.value, checked: el.checked, start: el.selectionStart, end: el.selectionEnd }));
  const scroll = { x: window.scrollX, y: window.scrollY };
  render();
  for (const saved of values) {
    const el = document.getElementById(saved.id);
    if (!el || el.type === "file") continue;
    el.value = saved.value; el.checked = saved.checked;
    if (active?.id === saved.id) { el.focus({ preventScroll: true }); try { el.setSelectionRange(saved.start, saved.end); } catch (_) { /* Select and date inputs have no selection range. */ } }
  }
  window.scrollTo(scroll.x, scroll.y);
}

window.TripLog.register("persistence.stateStorage", {
  initializeRepository,
  applyRepositoryChange,
  activateAccount,
  unsavedSnapshots: () => [...repositoryFailures.values()].map(failure => window.TripLogSyncModel.clone(failure.snapshot)),
  loadState,
  isLegacyDefaultTripName,
  hasNoSavedRecords,
  normalizeThemeName,
  getSavedTheme,
  cleanSavedItineraryPlace,
  cleanSavedItineraryCoordinates,
  cleanSavedItineraryItems,
  normalizeSettlementSettings,
  normalizeTravelCompanion,
  normalizeCollaborationSettings,
  saveAndRender,
  markDeletedEntity,
  whenSaved: () => repositoryWriteTail,
  saveStateSilently,
  getStateSnapshot,
  resetPersistedTravelData,
  getTrips,
  getActiveTripId,
  switchTrip,
  createNewTrip,
  deleteTrip,
  importSharedTripSnapshot,
  syncTripsFromSnapshots,
});
