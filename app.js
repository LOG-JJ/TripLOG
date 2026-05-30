const STORAGE_KEY = "domesticTravelExpensePlanner.v1";
const HISTORY_STORAGE_KEY = "domesticTravelExpensePlanner.history.v1";
const PAGE_TRANSITION_MS = 800;
const TIME_EDGE_SCROLL_DURATION = 560;
const TIME_WHEEL_SCROLL_DURATION = 180;
const TIME_WHEEL_SCROLL_FACTOR = 0.38;
const DAY_STRIP_EDGE_SCROLL_DURATION = 460;
const DAY_STRIP_DRAG_THRESHOLD = 12;

const categories = [
  { name: "숙소", color: "#2563eb" },
  { name: "식비", color: "#f97316" },
  { name: "관광", color: "#10b981" },
  { name: "교통", color: "#7c3aed" },
  { name: "쇼핑", color: "#ec4899" },
  { name: "기타", color: "#64748b" },
];

const currencies = [
  { code: "JPY", symbol: "¥", unit: "엔", label: "엔화", rateBase: 100 },
  { code: "USD", symbol: "$", unit: "달러", label: "달러", rateBase: 1 },
  { code: "CNY", symbol: "¥", unit: "위안", label: "위안화", rateBase: 1 },
  { code: "EUR", symbol: "€", unit: "유로", label: "유로", rateBase: 1 },
  { code: "GBP", symbol: "£", unit: "파운드", label: "파운드", rateBase: 1 },
  { code: "TWD", symbol: "NT$", unit: "대만달러", label: "대만달러", rateBase: 1 },
  { code: "THB", symbol: "฿", unit: "바트", label: "바트", rateBase: 1 },
  { code: "VND", symbol: "₫", unit: "동", label: "베트남동", rateBase: 100 },
];

const state = loadState();
let historyRecords = loadHistoryRecords();
let activeFilter = "전체";
let editingId = null;
let activePage = new URLSearchParams(window.location.search).has("itinerary") ? "itinerary" : "budget";
let pageTransitionTimer = null;
let brandTextTimer = null;
let placeSearchTimer = null;
let placeSearchAbortController = null;
let isPageTransitioning = false;
let editingItineraryId = null;
let selectedPlaceCandidate = null;
const customSelects = new Map();
const customDatePickers = new Map();
const customTimePickers = new Map();
const timeListScrollAnimations = new WeakMap();
const dayStripScrollAnimations = new WeakMap();

const els = {
  pageStage: document.querySelector("#pageStage"),
  budgetPage: document.querySelector("#budgetPage"),
  itineraryPage: document.querySelector("#itineraryPage"),
  itineraryPageButton: document.querySelector("#itineraryPageButton"),
  budgetBrandIcon: document.querySelector(".brand-icon-budget"),
  itineraryBrandIcon: document.querySelector(".brand-icon-itinerary"),
  brandCopy: document.querySelector("#brandCopy"),
  brandTitle: document.querySelector("#brandTitle"),
  backToBudgetButton: document.querySelector("#backToBudgetButton"),
  tripNameInput: document.querySelector("#tripNameInput"),
  startDateInput: document.querySelector("#startDateInput"),
  endDateInput: document.querySelector("#endDateInput"),
  tripDuration: document.querySelector("#tripDuration"),
  dayStrip: document.querySelector("#dayStrip"),
  daySelect: document.querySelector("#daySelect"),
  categorySelect: document.querySelector("#categorySelect"),
  currencySelect: document.querySelector("#currencySelect"),
  brandSubtitle: document.querySelector("#brandSubtitle"),
  descriptionInput: document.querySelector("#descriptionInput"),
  amountInput: document.querySelector("#amountInput"),
  amountLabel: document.querySelector("#amountLabel"),
  foreignFields: document.querySelector("#foreignFields"),
  foreignAmountInput: document.querySelector("#foreignAmountInput"),
  exchangeRateInput: document.querySelector("#exchangeRateInput"),
  exchangeRateLabel: document.querySelector("#exchangeRateLabel"),
  lodgingFields: document.querySelector("#lodgingFields"),
  lodgingCheckInInput: document.querySelector("#lodgingCheckInInput"),
  lodgingCheckOutInput: document.querySelector("#lodgingCheckOutInput"),
  lodgingPreview: document.querySelector("#lodgingPreview"),
  noteInput: document.querySelector("#noteInput"),
  expenseForm: document.querySelector("#expenseForm"),
  submitButton: document.querySelector("#submitButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  expenseTableBody: document.querySelector("#expenseTableBody"),
  emptyState: document.querySelector("#emptyState"),
  chartCaption: document.querySelector("#chartCaption"),
  dominantCategory: document.querySelector("#dominantCategory"),
  chartAmount: document.querySelector("#chartAmount"),
  categoryList: document.querySelector("#categoryList"),
  categoryDonut: document.querySelector("#categoryDonut"),
  filterTotal: document.querySelector("#filterTotal"),
  saveStateButton: document.querySelector("#saveStateButton"),
  historyButton: document.querySelector("#historyButton"),
  sampleButton: document.querySelector("#sampleButton"),
  resetButton: document.querySelector("#resetButton"),
  pdfButton: document.querySelector("#pdfButton"),
  modeToggle: document.querySelector(".mode-toggle"),
  domesticModeButton: document.querySelector("#domesticModeButton"),
  overseasModeButton: document.querySelector("#overseasModeButton"),
  historyModal: document.querySelector("#historyModal"),
  historyCloseButton: document.querySelector("#historyCloseButton"),
  historyList: document.querySelector("#historyList"),
  historyEmpty: document.querySelector("#historyEmpty"),
  itineraryTripName: document.querySelector("#itineraryTripName"),
  itineraryDateRange: document.querySelector("#itineraryDateRange"),
  itineraryCount: document.querySelector("#itineraryCount"),
  itineraryForm: document.querySelector("#itineraryForm"),
  itineraryDaySelect: document.querySelector("#itineraryDaySelect"),
  itineraryTimeInput: document.querySelector("#itineraryTimeInput"),
  itineraryPlaceInput: document.querySelector("#itineraryPlaceInput"),
  itineraryLocationInput: document.querySelector("#itineraryLocationInput"),
  manualAddressToggleButton: document.querySelector("#manualAddressToggleButton"),
  manualAddressPanel: document.querySelector("#manualAddressPanel"),
  manualAddressInput: document.querySelector("#manualAddressInput"),
  manualAddressApplyButton: document.querySelector("#manualAddressApplyButton"),
  manualAddressCloseButton: document.querySelector("#manualAddressCloseButton"),
  placeSearchButton: document.querySelector("#placeSearchButton"),
  placeSearchResults: document.querySelector("#placeSearchResults"),
  placeSearchStatus: document.querySelector("#placeSearchStatus"),
  itineraryMemoInput: document.querySelector("#itineraryMemoInput"),
  itinerarySubmitButton: document.querySelector("#itinerarySubmitButton"),
  cancelItineraryEditButton: document.querySelector("#cancelItineraryEditButton"),
  itineraryDayStrip: document.querySelector("#itineraryDayStrip"),
  itineraryList: document.querySelector("#itineraryList"),
  itineraryEmpty: document.querySelector("#itineraryEmpty"),
  googleMapFrame: document.querySelector("#googleMapFrame"),
  googleMapsLink: document.querySelector("#googleMapsLink"),
  mapCurrentLabel: document.querySelector("#mapCurrentLabel"),
  mapCurrentPlace: document.querySelector("#mapCurrentPlace"),
  printReport: document.querySelector("#printReport"),
  categoryRowTemplate: document.querySelector("#categoryRowTemplate"),
};

init();

function init() {
  els.tripNameInput.value = state.tripName;
  els.startDateInput.value = state.startDate;
  els.endDateInput.value = state.endDate;

  els.tripNameInput.addEventListener("input", () => {
    state.tripName = els.tripNameInput.value;
    saveAndRender();
  });

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
    syncCustomSelect(els.currencySelect);
    updateExchangeRateGuide();
    updateConvertedAmount();
    updateLodgingPreview();
  });
  els.foreignAmountInput.addEventListener("input", updateConvertedAmount);
  els.exchangeRateInput.addEventListener("input", updateConvertedAmount);
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
  els.cancelItineraryEditButton.addEventListener("click", clearItineraryEditMode);
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
  setupCustomSelect(els.itineraryDaySelect);
  setupCustomTimePicker(els.itineraryTimeInput);
  renderHistoryModal();
  render();
}

function loadState() {
  const fallback = {
    tripName: "",
    travelMode: "domestic",
    startDate: "2026-06-09",
    endDate: "2026-06-12",
    selectedDate: "2026-06-09",
    selectedItineraryDate: "2026-06-09",
    selectedItineraryId: "",
    entries: [],
    itineraryItems: [],
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    const normalizedTripName =
      isLegacyDefaultTripName(saved.tripName) && hasNoSavedRecords(saved) ? "" : typeof saved.tripName === "string" ? saved.tripName : "";
    return {
      ...fallback,
      ...saved,
      tripName: normalizedTripName,
      entries: Array.isArray(saved.entries) ? saved.entries : [],
      itineraryItems: Array.isArray(saved.itineraryItems) ? saved.itineraryItems : [],
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

function loadHistoryRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((record) => record?.id && record?.timestamp && record?.state)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch {
    return [];
  }
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function saveHistoryRecords() {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
}

function getStateSnapshot() {
  return JSON.parse(JSON.stringify(state));
}

function saveCurrentSnapshot() {
  const snapshot = getStateSnapshot();
  const record = {
    id: createId(),
    timestamp: new Date().toISOString(),
    state: snapshot,
  };

  historyRecords = [record, ...historyRecords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  try {
    saveHistoryRecords();
    renderHistoryModal();
    flashSaveStateButton();
  } catch {
    window.alert("브라우저 저장 공간이 부족해 현재 기록을 저장하지 못했습니다.");
  }
}

function flashSaveStateButton() {
  const label = els.saveStateButton.querySelector("span");
  const original = label.textContent;
  label.textContent = "저장됨";
  els.saveStateButton.classList.add("saved");
  window.setTimeout(() => {
    label.textContent = original;
    els.saveStateButton.classList.remove("saved");
  }, 1400);
}

function openHistoryModal() {
  historyRecords = loadHistoryRecords();
  renderHistoryModal();
  els.historyModal.hidden = false;
  document.body.classList.add("modal-open");
  els.historyCloseButton.focus();
}

function closeHistoryModal() {
  els.historyModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function setActivePage(page) {
  const nextPage = page === "itinerary" ? "itinerary" : "budget";
  if (nextPage === activePage && !isPageTransitioning) return;

  if (window.scrollY > 0) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  const previousPage = activePage;
  const outgoing = getPageElement(previousPage);
  const incoming = getPageElement(nextPage);
  activePage = nextPage;

  if (nextPage === "itinerary") renderItineraryPage();
  prepareIncomingPage(incoming);
  updatePageChrome({ animateBrand: true });
  startBrandIconFlip();
  renderModeControls();

  const outgoingHeight = measurePageHeight(outgoing);
  const incomingHeight = measurePageHeight(incoming);
  els.pageStage.style.height = `${outgoingHeight}px`;
  els.pageStage.classList.add("is-transitioning");
  outgoing.classList.remove("page-enter", "page-active");
  incoming.classList.remove("page-exit");

  requestAnimationFrame(() => {
    els.pageStage.style.height = `${incomingHeight}px`;
    outgoing.classList.add("page-exit");
    incoming.classList.add("page-enter", "page-active");
  });

  isPageTransitioning = true;
  window.clearTimeout(pageTransitionTimer);
  pageTransitionTimer = window.setTimeout(() => {
    outgoing.hidden = true;
    outgoing.classList.remove("page-exit", "page-enter", "page-active");
    incoming.hidden = false;
    incoming.classList.remove("page-exit", "page-enter");
    incoming.classList.add("page-active");
    els.pageStage.classList.remove("is-transitioning");
    els.pageStage.style.removeProperty("height");
    isPageTransitioning = false;
    syncPageVisibility();
  }, PAGE_TRANSITION_MS + 40);
}

function getPageElement(page) {
  return page === "itinerary" ? els.itineraryPage : els.budgetPage;
}

function measurePageHeight(pageElement) {
  return Math.max(pageElement.offsetHeight, pageElement.scrollHeight, window.innerHeight - 130);
}

function prepareIncomingPage(pageElement) {
  pageElement.hidden = false;
  pageElement.classList.remove("page-exit", "page-enter");
}

function syncPageVisibility() {
  if (isPageTransitioning) return;
  els.budgetPage.hidden = activePage !== "budget";
  els.itineraryPage.hidden = activePage !== "itinerary";
  els.budgetPage.classList.toggle("page-active", activePage === "budget");
  els.itineraryPage.classList.toggle("page-active", activePage === "itinerary");
  updatePageChrome();
}

function updatePageChrome({ animateBrand = false } = {}) {
  const isItinerary = activePage === "itinerary";
  els.itineraryPageButton.classList.toggle("active", isItinerary);
  els.itineraryPageButton.title = isItinerary ? "가계부로 돌아가기" : "여행 일정 보기";
  els.itineraryPageButton.setAttribute("aria-label", els.itineraryPageButton.title);
  els.budgetBrandIcon.classList.toggle("active", !isItinerary);
  els.itineraryBrandIcon.classList.toggle("active", isItinerary);
  els.modeToggle.classList.toggle("is-page-hidden", isItinerary);
  els.modeToggle.setAttribute("aria-hidden", String(isItinerary));
  [els.domesticModeButton, els.overseasModeButton].forEach((button) => {
    button.tabIndex = isItinerary ? -1 : 0;
  });
  updateBrandText({ animate: animateBrand });
}

function updateBrandText({ animate = false } = {}) {
  const isItinerary = activePage === "itinerary";
  const isOverseas = state.travelMode === "overseas";
  const nextTitle = isItinerary ? "여행 일정" : "여행 가계부";
  const nextSubtitle = isItinerary ? "여행 일정과 지도 정리" : isOverseas ? "해외 여행 경비 정리" : "국내 여행 경비 정리";
  const hasChanged = els.brandTitle.textContent !== nextTitle || els.brandSubtitle.textContent !== nextSubtitle;

  if (!hasChanged) return;

  if (animate) {
    els.brandCopy.classList.remove("text-swap");
  }

  els.brandTitle.textContent = nextTitle;
  els.brandSubtitle.textContent = nextSubtitle;

  if (!animate) return;

  void els.brandCopy.offsetWidth;
  els.brandCopy.classList.add("text-swap");
  window.clearTimeout(brandTextTimer);
  brandTextTimer = window.setTimeout(() => els.brandCopy.classList.remove("text-swap"), PAGE_TRANSITION_MS);
}

function startBrandIconFlip() {
  els.itineraryPageButton.classList.remove("icon-flip");
  void els.itineraryPageButton.offsetWidth;
  els.itineraryPageButton.classList.add("icon-flip");
  window.setTimeout(() => els.itineraryPageButton.classList.remove("icon-flip"), PAGE_TRANSITION_MS);
}

function updateTripDate(field, value) {
  if (!value) return;
  state[field] = value;

  if (new Date(state.startDate) > new Date(state.endDate)) {
    if (field === "startDate") state.endDate = state.startDate;
    if (field === "endDate") state.startDate = state.endDate;
  }

  const days = getTripDays();
  if (!days.some((day) => day.date === state.selectedDate)) {
    state.selectedDate = days[0]?.date || state.startDate;
  }

  if (!days.some((day) => day.date === state.selectedItineraryDate)) {
    state.selectedItineraryDate = days[0]?.date || state.startDate;
  }

  els.startDateInput.value = state.startDate;
  els.endDateInput.value = state.endDate;
  saveAndRender();
}

function getTripDays() {
  const start = parseDate(state.startDate);
  const end = parseDate(state.endDate);
  if (!start || !end || start > end) return [];

  const days = [];
  for (let cursor = start, index = 1; cursor <= end; cursor = addDays(cursor, 1), index += 1) {
    days.push({
      index,
      date: toInputDate(cursor),
      label: `${index}일차`,
      shortDate: formatShortDate(cursor),
      weekday: formatWeekday(cursor),
    });
  }
  return days;
}

function handleExpenseSubmit(event) {
  event.preventDefault();

  if (state.travelMode === "overseas") updateConvertedAmount();

  const amount = Math.max(0, Number(els.amountInput.value || 0));
  if (!amount || !els.descriptionInput.value.trim()) return;
  const isOverseas = state.travelMode === "overseas";
  const currency = getCurrencyMeta(els.currencySelect.value);
  const foreignAmount = Math.max(0, Number(els.foreignAmountInput.value || 0));
  const exchangeRate = Math.max(0, Number(els.exchangeRateInput.value || 0));

  if (isLodgingSplitMode()) {
    const lodgingPlan = getLodgingPlan();
    if (!lodgingPlan.valid) {
      window.alert(lodgingPlan.message || "숙소 체크인/체크아웃 날짜를 확인해 주세요.");
      updateLodgingPreview();
      return;
    }

    state.entries.push(
      ...createLodgingEntries({
        checkIn: lodgingPlan.checkIn,
        checkOut: lodgingPlan.checkOut,
        nights: lodgingPlan.nights,
        description: els.descriptionInput.value.trim(),
        amount,
        note: els.noteInput.value.trim(),
        isOverseas,
        currency,
        foreignAmount,
        exchangeRate,
      }),
    );

    resetExpenseFormAfterSubmit();
    saveAndRender();
    return;
  }

  const entry = {
    id: editingId || createId(),
    date: els.daySelect.value,
    category: els.categorySelect.value,
    description: els.descriptionInput.value.trim(),
    amount,
    note: els.noteInput.value.trim(),
    mode: isOverseas ? "overseas" : "domestic",
    currency: isOverseas ? currency.code : "",
    currencySymbol: isOverseas ? currency.symbol : "",
    currencyUnit: isOverseas ? currency.unit : "",
    exchangeBase: isOverseas ? currency.rateBase : 1,
    foreignAmount: isOverseas ? foreignAmount : 0,
    exchangeRate: isOverseas ? exchangeRate : 0,
    createdAt: editingId ? findEntry(editingId)?.createdAt || Date.now() : Date.now(),
  };

  if (editingId) {
    state.entries = state.entries.map((item) => (item.id === editingId ? entry : item));
    clearEditMode();
  } else {
    state.entries.push(entry);
    resetExpenseFormAfterSubmit();
  }

  saveAndRender();
}

function resetExpenseFormAfterSubmit() {
  els.expenseForm.reset();
  els.daySelect.value = state.selectedDate;
  els.categorySelect.value = "식비";
  els.currencySelect.value = "JPY";
  els.lodgingCheckInInput.value = "";
  els.lodgingCheckOutInput.value = "";
  if (state.travelMode === "overseas") {
    els.amountInput.value = "";
    els.foreignAmountInput.value = "";
    els.exchangeRateInput.value = "";
  }
  renderExpenseFormMode();
}

function setTravelMode(mode) {
  const previousMode = state.travelMode;
  state.travelMode = mode === "overseas" ? "overseas" : "domestic";
  if (previousMode !== state.travelMode) {
    if (isLegacyDefaultTripName(state.tripName)) state.tripName = "";
  }
  if (state.travelMode === "domestic") {
    els.amountInput.readOnly = false;
  } else {
    updateConvertedAmount();
  }
  saveAndRender();
}

function renderModeControls() {
  const isOverseas = state.travelMode === "overseas";
  const isLodging = isLodgingSplitMode();
  updateBrandText();
  els.domesticModeButton.classList.toggle("active", !isOverseas);
  els.overseasModeButton.classList.toggle("active", isOverseas);
  els.domesticModeButton.setAttribute("aria-pressed", String(!isOverseas));
  els.overseasModeButton.setAttribute("aria-pressed", String(isOverseas));
  els.foreignFields.hidden = !isOverseas;
  els.amountLabel.textContent = isLodging ? (isOverseas ? "원화 총액" : "숙소 총액") : isOverseas ? "원화 환산" : "금액";
  els.amountInput.readOnly = isOverseas;
  els.amountInput.required = true;
  els.amountInput.placeholder = isLodging ? "총 숙소비" : isOverseas ? "자동 계산" : "0";
  els.amountInput.step = isOverseas ? "1" : "100";
  updateExchangeRateGuide();
  syncCustomSelect(els.currencySelect, { rebuild: true });

  if (isOverseas) updateConvertedAmount();
  renderExpenseFormMode();
}

function updateConvertedAmount() {
  if (state.travelMode !== "overseas") return;
  const currency = getCurrencyMeta(els.currencySelect.value);
  const foreignAmount = Math.max(0, Number(els.foreignAmountInput.value || 0));
  const exchangeRate = Math.max(0, Number(els.exchangeRateInput.value || 0));
  const converted = Math.round((foreignAmount * exchangeRate) / currency.rateBase);
  els.amountInput.value = converted || "";
  updateLodgingPreview();
}

function updateExchangeRateGuide() {
  const currency = getCurrencyMeta(els.currencySelect.value);
  const baseLabel = formatRateBase(currency);
  els.exchangeRateLabel.textContent = `환율 (${baseLabel} 기준)`;
  els.exchangeRateInput.placeholder = `${baseLabel}당 원화`;
  els.exchangeRateInput.title = `${baseLabel}당 원화 환율을 입력하세요.`;
}

function isLodgingSplitMode() {
  return !editingId && els.categorySelect.value === "숙소";
}

function renderExpenseFormMode() {
  const isLodging = isLodgingSplitMode();
  const isOverseas = state.travelMode === "overseas";
  els.lodgingFields.hidden = !isLodging;
  els.descriptionInput.placeholder = isLodging ? "예: 호텔명 또는 숙소명" : "예: 숙소 예약금";
  els.amountLabel.textContent = isLodging ? (isOverseas ? "원화 총액" : "숙소 총액") : isOverseas ? "원화 환산" : "금액";
  els.amountInput.placeholder = isLodging ? "총 숙소비" : isOverseas ? "자동 계산" : "0";
  els.submitButton.querySelector("span").textContent = editingId ? "저장" : "추가";

  if (isLodging) {
    syncLodgingDefaults();
    updateLodgingPreview();
  }
}

function handleLodgingDateChange(changedField) {
  if (!isLodgingSplitMode()) return;
  const checkIn = parseDate(els.lodgingCheckInInput.value);
  const checkOut = parseDate(els.lodgingCheckOutInput.value);

  if (changedField === "checkIn" && checkIn && (!checkOut || checkOut <= checkIn)) {
    els.lodgingCheckOutInput.value = toInputDate(addDays(checkIn, 1));
  }

  syncLodgingDateBounds();
  updateLodgingPreview();
}

function syncLodgingDefaults(options = {}) {
  if (!isLodgingSplitMode()) return;
  const tripStart = parseDate(state.startDate);
  const tripEnd = parseDate(state.endDate);
  if (!tripStart || !tripEnd) return;

  syncLodgingDateBounds();

  const defaultCheckIn = getDefaultLodgingCheckIn();
  if (options.force || !els.lodgingCheckInInput.value) {
    els.lodgingCheckInInput.value = defaultCheckIn;
  }

  const checkIn = parseDate(els.lodgingCheckInInput.value) || parseDate(defaultCheckIn);
  const checkoutFallback = checkIn < tripEnd ? addDays(checkIn, 1) : tripEnd;
  const currentCheckOut = parseDate(els.lodgingCheckOutInput.value);
  if (options.force || !currentCheckOut || currentCheckOut <= checkIn) {
    els.lodgingCheckOutInput.value = toInputDate(checkoutFallback);
  }

  syncLodgingDateBounds();
}

function getDefaultLodgingCheckIn() {
  const selectedDate = parseDate(state.selectedDate);
  const tripStart = parseDate(state.startDate);
  const tripEnd = parseDate(state.endDate);
  if (!tripStart || !tripEnd) return state.selectedDate || state.startDate;
  if (selectedDate && selectedDate >= tripStart && selectedDate < tripEnd) return toInputDate(selectedDate);
  return toInputDate(tripStart);
}

function syncLodgingDateBounds() {
  const tripStart = parseDate(state.startDate);
  const tripEnd = parseDate(state.endDate);
  if (!tripStart || !tripEnd) return;

  const checkIn = parseDate(els.lodgingCheckInInput.value);
  const checkInMax = tripStart < tripEnd ? addDays(tripEnd, -1) : tripEnd;
  const checkOutMin = checkIn ? addDays(checkIn, 1) : addDays(tripStart, 1);

  els.lodgingCheckInInput.min = toInputDate(tripStart);
  els.lodgingCheckInInput.max = toInputDate(checkInMax);
  els.lodgingCheckOutInput.min = toInputDate(checkOutMin);
  els.lodgingCheckOutInput.max = toInputDate(tripEnd);

  [els.lodgingCheckInInput, els.lodgingCheckOutInput].forEach(syncCustomDatePicker);
}

function updateLodgingPreview() {
  if (!els.lodgingPreview) return;
  const plan = getLodgingPlan();
  const amount = Math.max(0, Number(els.amountInput.value || 0));
  els.lodgingPreview.classList.toggle("is-error", !plan.valid);

  if (!plan.valid) {
    els.lodgingPreview.innerHTML = `
      <strong>확인 필요</strong>
      <span>${escapeHtml(plan.message || "체크인/체크아웃 날짜를 확인해 주세요.")}</span>
    `;
    return;
  }

  const lastNight = addDays(parseDate(plan.checkOut), -1);
  const average = amount ? Math.round(amount / plan.nights) : 0;
  els.lodgingPreview.innerHTML = `
    <strong>${plan.nights}박 · 1박당 ${escapeHtml(formatWon(average))}</strong>
    <span>${escapeHtml(formatShortDate(parseDate(plan.checkIn)))}부터 ${escapeHtml(formatShortDate(lastNight))}까지 기록하고 체크아웃일은 0원으로 둡니다.</span>
  `;
}

function getLodgingPlan() {
  const checkIn = parseDate(els.lodgingCheckInInput.value);
  const checkOut = parseDate(els.lodgingCheckOutInput.value);
  const tripStart = parseDate(state.startDate);
  const tripEnd = parseDate(state.endDate);

  if (!checkIn || !checkOut) return { valid: false, message: "체크인과 체크아웃 날짜를 모두 선택해 주세요." };
  if (!tripStart || !tripEnd) return { valid: false, message: "전체 여행 일정을 먼저 확인해 주세요." };
  if (checkIn < tripStart || checkIn > tripEnd || checkOut < tripStart || checkOut > tripEnd) {
    return { valid: false, message: "숙소 기간은 전체 여행 일정 안에서 선택해 주세요." };
  }
  if (checkOut <= checkIn) return { valid: false, message: "체크아웃은 체크인 다음 날짜 이후여야 합니다." };

  return {
    valid: true,
    checkIn: toInputDate(checkIn),
    checkOut: toInputDate(checkOut),
    nights: getDateDiffDays(checkIn, checkOut),
  };
}

function createLodgingEntries({ checkIn, checkOut, nights, description, amount, note, isOverseas, currency, foreignAmount, exchangeRate }) {
  const groupId = createId();
  const wonParts = splitWholeAmount(amount, nights);
  const foreignParts = isOverseas ? splitDecimalAmount(foreignAmount, nights) : [];
  const createdAt = Date.now();

  return wonParts.map((nightAmount, index) => {
    const date = toInputDate(addDays(parseDate(checkIn), index));
    return {
      id: createId(),
      date,
      category: "숙소",
      description,
      amount: nightAmount,
      note: formatLodgingNote(note, checkIn, checkOut, index + 1, nights),
      mode: isOverseas ? "overseas" : "domestic",
      currency: isOverseas ? currency.code : "",
      currencySymbol: isOverseas ? currency.symbol : "",
      currencyUnit: isOverseas ? currency.unit : "",
      exchangeBase: isOverseas ? currency.rateBase : 1,
      foreignAmount: isOverseas ? foreignParts[index] || 0 : 0,
      exchangeRate: isOverseas ? exchangeRate : 0,
      lodgingGroupId: groupId,
      lodgingCheckIn: checkIn,
      lodgingCheckOut: checkOut,
      lodgingNightIndex: index + 1,
      lodgingNights: nights,
      createdAt: createdAt + index,
    };
  });
}

function formatLodgingNote(note, checkIn, checkOut, nightIndex, nights) {
  const autoNote = `${formatShortDate(parseDate(checkIn))} 체크인 · ${formatShortDate(parseDate(checkOut))} 체크아웃 · ${nightIndex}/${nights}박`;
  return note ? `${note} · ${autoNote}` : autoNote;
}

function splitWholeAmount(total, count) {
  const safeTotal = Math.max(0, Math.round(Number(total || 0)));
  const base = Math.floor(safeTotal / count);
  let remainder = safeTotal - base * count;
  return Array.from({ length: count }, () => base + (remainder-- > 0 ? 1 : 0));
}

function splitDecimalAmount(total, count) {
  const cents = Math.round(Math.max(0, Number(total || 0)) * 100);
  return splitWholeAmount(cents, count).map((value) => Number((value / 100).toFixed(2)));
}

function getDateDiffDays(start, end) {
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endDate - startDate) / 86400000);
}

function setupCustomDatePicker(input) {
  if (customDatePickers.has(input)) return;

  const shell = document.createElement("div");
  shell.className = "custom-date";
  shell.dataset.dateId = input.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-date-button";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", input.closest("label")?.querySelector("span")?.textContent || "날짜 선택");

  const value = document.createElement("span");
  value.className = "custom-date-value";

  const icon = document.createElement("span");
  icon.className = "custom-date-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>';

  const panel = document.createElement("div");
  panel.className = "custom-date-panel";
  panel.setAttribute("role", "dialog");
  panel.hidden = true;

  panel.innerHTML = `
    <div class="calendar-head">
      <button type="button" class="calendar-nav" data-calendar-action="prev" aria-label="이전 달">
        <svg viewBox="0 0 24 24" focusable="false"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <strong class="calendar-title"></strong>
      <button type="button" class="calendar-nav" data-calendar-action="next" aria-label="다음 달">
        <svg viewBox="0 0 24 24" focusable="false"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
    <div class="calendar-weekdays" aria-hidden="true">
      <span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>
    </div>
    <div class="calendar-grid" role="grid"></div>
    <div class="calendar-actions">
      <button type="button" class="calendar-soft-button" data-calendar-action="today">오늘</button>
      <button type="button" class="calendar-soft-button" data-calendar-action="close">닫기</button>
    </div>
  `;

  input.parentNode.insertBefore(shell, input);
  shell.appendChild(input);
  button.append(value, icon);
  shell.append(button, panel);
  input.classList.add("native-date-hidden");

  const selectedDate = parseDate(input.value) || new Date();
  customDatePickers.set(input, {
    shell,
    button,
    value,
    panel,
    viewDate: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    toggleCustomDatePicker(input);
  });
  button.addEventListener("keydown", (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openCustomDatePicker(input);
    }
  });

  panel.addEventListener("click", (event) => handleCalendarClick(event, input));
  panel.addEventListener("keydown", (event) => handleCalendarKeydown(event, input));
  document.addEventListener("click", (event) => {
    if (!shell.contains(event.target)) closeCustomDatePicker(input);
  });

  syncCustomDatePicker(input);
}

function syncCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control) return;

  const selectedDate = parseDate(input.value);
  control.value.textContent = selectedDate ? toInputDate(selectedDate) : "날짜 선택";
  control.button.disabled = input.disabled;
  control.button.classList.toggle("is-disabled", input.disabled);

  if (selectedDate && !control.panel.hidden) {
    control.viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  }

  renderCalendar(input);
}

function toggleCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control || control.button.disabled) return;

  if (control.panel.hidden) {
    openCustomDatePicker(input);
  } else {
    closeCustomDatePicker(input);
  }
}

function openCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control || control.button.disabled) return;

  closeAllCustomSelects();
  closeAllCustomTimePickers();
  closeAllCustomDatePickers(input);
  const selectedDate = parseDate(input.value) || new Date();
  control.viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderCalendar(input);
  control.panel.hidden = false;
  control.button.classList.add("open");
  control.button.setAttribute("aria-expanded", "true");
}

function closeCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control) return;
  control.panel.hidden = true;
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
}

function closeAllCustomDatePickers(exceptInput) {
  customDatePickers.forEach((_, input) => {
    if (input !== exceptInput) closeCustomDatePicker(input);
  });
}

function renderCalendar(input) {
  const control = customDatePickers.get(input);
  if (!control) return;

  const selectedDate = parseDate(input.value);
  const minDate = parseDate(input.min);
  const maxDate = parseDate(input.max);
  const title = control.panel.querySelector(".calendar-title");
  const grid = control.panel.querySelector(".calendar-grid");
  const year = control.viewDate.getFullYear();
  const month = control.viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const calendarStart = addDays(firstDay, -firstDay.getDay());
  const today = toInputDate(new Date());

  title.textContent = `${year}년 ${month + 1}월`;
  grid.replaceChildren();

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(calendarStart, index);
    const value = toInputDate(date);
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";
    dayButton.dataset.date = value;
    dayButton.setAttribute("role", "gridcell");
    dayButton.setAttribute("aria-label", formatReadableDate(value));
    dayButton.textContent = String(date.getDate());
    const isDisabled = Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
    dayButton.disabled = isDisabled;
    dayButton.setAttribute("aria-disabled", String(isDisabled));
    dayButton.classList.toggle("outside", date.getMonth() !== month);
    dayButton.classList.toggle("today", value === today);
    dayButton.classList.toggle("selected", selectedDate && value === toInputDate(selectedDate));
    dayButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDatePickerValue(input, value);
    });
    grid.appendChild(dayButton);
  }
}

function handleCalendarClick(event, input) {
  const action = event.target.closest("[data-calendar-action]")?.dataset.calendarAction;
  if (action) {
    handleCalendarAction(action, input);
    return;
  }

  const day = event.target.closest(".calendar-day");
  if (!day) return;
  setDatePickerValue(input, day.dataset.date);
}

function handleCalendarAction(action, input) {
  const control = customDatePickers.get(input);
  if (!control) return;

  if (action === "prev" || action === "next") {
    const amount = action === "prev" ? -1 : 1;
    control.viewDate = new Date(control.viewDate.getFullYear(), control.viewDate.getMonth() + amount, 1);
    renderCalendar(input);
  }

  if (action === "today") {
    setDatePickerValue(input, toInputDate(new Date()));
  }

  if (action === "close") {
    closeCustomDatePicker(input);
    control.button.focus();
  }
}

function handleCalendarKeydown(event, input) {
  if (event.key === "Escape") {
    const control = customDatePickers.get(input);
    closeCustomDatePicker(input);
    control?.button.focus();
  }
}

function setDatePickerValue(input, value) {
  if (isDateOutsideInputBounds(input, value)) return;
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  closeCustomDatePicker(input);
}

function isDateOutsideInputBounds(input, value) {
  const date = parseDate(value);
  const minDate = parseDate(input.min);
  const maxDate = parseDate(input.max);
  if (!date) return true;
  return Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
}

function setupCustomTimePicker(input) {
  if (customTimePickers.has(input)) return;

  const shell = document.createElement("div");
  shell.className = "custom-time";
  shell.dataset.timeId = input.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-time-button";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", input.closest("label")?.querySelector("span")?.textContent || "시간 선택");

  const value = document.createElement("span");
  value.className = "custom-time-value";

  const icon = document.createElement("span");
  icon.className = "custom-time-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 7v5l3 2" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>';

  const panel = document.createElement("div");
  panel.className = "custom-time-panel";
  panel.setAttribute("role", "dialog");
  panel.hidden = true;

  input.parentNode.insertBefore(shell, input);
  shell.appendChild(input);
  button.append(value, icon);
  shell.append(button, panel);
  input.classList.add("native-time-hidden");

  customTimePickers.set(input, { shell, button, value, panel });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    toggleCustomTimePicker(input);
  });
  button.addEventListener("keydown", (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openCustomTimePicker(input);
    }
  });
  input.addEventListener("change", () => syncCustomTimePicker(input));

  panel.addEventListener("click", (event) => handleTimePickerClick(event, input));
  panel.addEventListener("keydown", (event) => handleTimePickerKeydown(event, input));
  document.addEventListener("click", (event) => {
    if (!shell.contains(event.target)) closeCustomTimePicker(input);
  });

  syncCustomTimePicker(input);
}

function syncCustomTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  control.value.textContent = input.value || "시간 선택";
  control.button.disabled = input.disabled;
  control.button.classList.toggle("is-disabled", input.disabled);
  if (!control.panel.hidden) renderTimePicker(input);
}

function toggleCustomTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control || control.button.disabled) return;

  if (control.panel.hidden) {
    openCustomTimePicker(input);
  } else {
    closeCustomTimePicker(input);
  }
}

function openCustomTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control || control.button.disabled) return;

  closeAllCustomSelects();
  closeAllCustomDatePickers();
  closeAllCustomTimePickers(input);
  renderTimePicker(input);
  control.panel.hidden = false;
  control.button.classList.add("open");
  control.button.setAttribute("aria-expanded", "true");
  alignSelectedTimeOptions(input);
}

function closeCustomTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control) return;
  control.panel.hidden = true;
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
}

function closeAllCustomTimePickers(exceptInput) {
  customTimePickers.forEach((_, input) => {
    if (input !== exceptInput) closeCustomTimePicker(input);
  });
}

function renderTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  const selected = parseTimeValue(input.value) || { hour: "09", minute: "00" };
  const minuteOptions = new Set(Array.from({ length: 12 }, (_, index) => padNumber(index * 5)));
  minuteOptions.add(selected.minute);
  const sortedMinutes = Array.from(minuteOptions).sort((a, b) => Number(a) - Number(b));

  control.panel.replaceChildren();
  const head = document.createElement("div");
  head.className = "time-panel-head";
  head.innerHTML = `<strong>${selected.hour}:${selected.minute}</strong><span>일정 시간</span>`;

  const grid = document.createElement("div");
  grid.className = "time-panel-grid";
  grid.append(createTimeColumn("시", "hour", Array.from({ length: 24 }, (_, index) => padNumber(index)), selected.hour));
  grid.append(createTimeColumn("분", "minute", sortedMinutes, selected.minute));

  const actions = document.createElement("div");
  actions.className = "time-panel-actions";
  actions.innerHTML = `
    <button type="button" class="time-soft-button" data-time-action="clear">시간 없음</button>
    <button type="button" class="time-soft-button" data-time-action="close">확인</button>
  `;

  control.panel.append(head, grid, actions);
}

function createTimeColumn(label, part, values, selectedValue) {
  const column = document.createElement("div");
  column.className = "time-column";

  const title = document.createElement("span");
  title.textContent = label;
  column.appendChild(title);

  const list = document.createElement("div");
  list.className = "time-option-list";
  list.setAttribute("role", "listbox");
  list.addEventListener("wheel", handleTimeOptionWheel, { passive: false });
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "time-option";
    button.dataset.timePart = part;
    button.dataset.timeValue = value;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(value === selectedValue));
    button.textContent = value;
    button.classList.toggle("selected", value === selectedValue);
    list.appendChild(button);
  });
  column.appendChild(list);
  return column;
}

function handleTimePickerClick(event, input) {
  const action = event.target.closest("[data-time-action]")?.dataset.timeAction;
  if (action) {
    event.preventDefault();
    handleTimePickerAction(action, input);
    return;
  }

  const option = event.target.closest(".time-option");
  if (!option) return;
  event.preventDefault();
  setTimePickerPart(input, option.dataset.timePart, option.dataset.timeValue, option);
}

function handleTimePickerAction(action, input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  if (action === "clear") {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    refreshOpenTimePickerSelection(input);
  }

  if (action === "close") {
    closeCustomTimePicker(input);
    control.button.focus();
  }
}

function handleTimePickerKeydown(event, input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeCustomTimePicker(input);
    control.button.focus();
  }
}

function setTimePickerPart(input, part, value, sourceOption) {
  const current = parseTimeValue(input.value) || { hour: "09", minute: "00" };
  const next = {
    hour: part === "hour" ? value : current.hour,
    minute: part === "minute" ? value : current.minute,
  };
  input.value = `${next.hour}:${next.minute}`;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  refreshOpenTimePickerSelection(input);
  scrollTimeListFromEdge(sourceOption);
}

function refreshOpenTimePickerSelection(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  const selected = parseTimeValue(input.value);
  control.value.textContent = input.value || "시간 선택";

  const title = control.panel.querySelector(".time-panel-head strong");
  if (title) title.textContent = selected ? `${selected.hour}:${selected.minute}` : "--:--";

  control.panel.querySelectorAll(".time-option").forEach((option) => {
    const isSelected = Boolean(selected)
      && ((option.dataset.timePart === "hour" && option.dataset.timeValue === selected.hour)
        || (option.dataset.timePart === "minute" && option.dataset.timeValue === selected.minute));
    option.classList.toggle("selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
  });
}

function alignSelectedTimeOptions(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  requestAnimationFrame(() => {
    control.panel.querySelectorAll(".time-option.selected").forEach((option) => {
      option.scrollIntoView({ block: "nearest" });
    });
  });
}

function handleTimeOptionWheel(event) {
  const list = event.currentTarget;
  const maxScroll = list.scrollHeight - list.clientHeight;
  if (!maxScroll) return;

  const direction = Math.sign(event.deltaY);
  const isAtStart = list.scrollTop <= 0;
  const isAtEnd = list.scrollTop >= maxScroll;
  if ((direction < 0 && isAtStart) || (direction > 0 && isAtEnd)) return;

  event.preventDefault();
  animateTimeListScroll(list, event.deltaY * TIME_WHEEL_SCROLL_FACTOR, TIME_WHEEL_SCROLL_DURATION);
}

function scrollTimeListFromEdge(option) {
  const list = option?.closest(".time-option-list");
  if (!list) return;

  const visibleOptions = getVisibleTimeOptions(list);
  const firstVisible = visibleOptions[0];
  const lastVisible = visibleOptions[visibleOptions.length - 1];
  const scrollAmount = getTimeOptionStep(option);

  if (option === firstVisible) {
    animateTimeListScroll(list, -scrollAmount, TIME_EDGE_SCROLL_DURATION);
  }

  if (option === lastVisible) {
    animateTimeListScroll(list, scrollAmount, TIME_EDGE_SCROLL_DURATION);
  }
}

function getVisibleTimeOptions(list) {
  const listRect = list.getBoundingClientRect();
  return Array.from(list.querySelectorAll(".time-option")).filter((option) => {
    const optionRect = option.getBoundingClientRect();
    return optionRect.bottom > listRect.top + 2 && optionRect.top < listRect.bottom - 2;
  });
}

function getTimeOptionStep(option) {
  const list = option.closest(".time-option-list");
  const style = window.getComputedStyle(list);
  const gap = Number.parseFloat(style.rowGap || style.gap) || 4;
  return option.getBoundingClientRect().height + gap;
}

function animateTimeListScroll(list, delta, duration) {
  const maxScroll = list.scrollHeight - list.clientHeight;
  const start = list.scrollTop;
  const target = Math.max(0, Math.min(maxScroll, start + delta));
  if (Math.abs(target - start) < 1) return;

  const existingFrame = timeListScrollAnimations.get(list);
  if (existingFrame) cancelAnimationFrame(existingFrame);

  const startTime = performance.now();
  const easeOut = (progress) => 1 - Math.pow(1 - progress, 3);

  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    list.scrollTop = start + (target - start) * easeOut(progress);

    if (progress < 1) {
      timeListScrollAnimations.set(list, requestAnimationFrame(step));
    } else {
      timeListScrollAnimations.delete(list);
    }
  };

  timeListScrollAnimations.set(list, requestAnimationFrame(step));
}

function setupCustomSelect(select) {
  if (customSelects.has(select)) return;

  const shell = document.createElement("div");
  shell.className = "custom-select";
  shell.dataset.selectId = select.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", select.closest("label")?.querySelector("span")?.textContent || "선택");

  const value = document.createElement("span");
  value.className = "custom-select-value";

  const chevron = document.createElement("span");
  chevron.className = "custom-select-chevron";
  chevron.setAttribute("aria-hidden", "true");

  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  select.parentNode.insertBefore(shell, select);
  shell.appendChild(select);
  button.append(value, chevron);
  shell.append(button, menu);
  select.classList.add("native-select-hidden");

  customSelects.set(select, { shell, button, value, menu });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    toggleCustomSelect(select);
  });
  button.addEventListener("keydown", (event) => handleCustomSelectButtonKeydown(event, select));

  document.addEventListener("click", (event) => {
    if (!shell.contains(event.target)) closeCustomSelect(select);
  });

  syncCustomSelect(select, { rebuild: true });
}

function syncCustomSelect(select, options = {}) {
  const control = customSelects.get(select);
  if (!control) return;

  if (options.rebuild) {
    control.menu.replaceChildren();

    Array.from(select.options).forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "custom-select-option";
      item.dataset.value = option.value;
      item.setAttribute("role", "option");

      if (select.id === "categorySelect") {
        item.style.setProperty("--option-color", getCategory(option.value).color);
        const dot = document.createElement("span");
        dot.className = "custom-select-dot";
        item.appendChild(dot);
      }

      if (select.id === "currencySelect") {
        const currency = getCurrencyMeta(option.value);
        const icon = document.createElement("span");
        icon.className = "custom-currency-icon";
        icon.textContent = currency.symbol;
        item.appendChild(icon);
      }

      const label = document.createElement("span");
      label.textContent = select.id === "currencySelect" ? getCurrencyMeta(option.value).label : option.textContent;
      item.appendChild(label);

      if (option.disabled) item.disabled = true;

      item.addEventListener("click", () => {
        if (item.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closeCustomSelect(select);
      });
      item.addEventListener("keydown", (event) => handleCustomSelectOptionKeydown(event, select));
      control.menu.appendChild(item);
    });
  }

  const selectedOption = select.selectedOptions[0] || select.options[0];
  control.value.replaceChildren();
  if (select.id === "currencySelect" && selectedOption?.value) {
    const currency = getCurrencyMeta(selectedOption.value);
    const icon = document.createElement("span");
    icon.className = "custom-currency-icon";
    icon.textContent = currency.symbol;
    const label = document.createElement("span");
    label.textContent = currency.label;
    control.value.append(icon, label);
  } else {
    control.value.textContent = selectedOption?.textContent || "선택";
  }
  control.button.disabled = select.disabled;
  control.button.classList.toggle("is-disabled", select.disabled);

  if (select.id === "categorySelect" && selectedOption?.value) {
    control.shell.style.setProperty("--selected-color", getCategory(selectedOption.value).color);
  }

  control.menu.querySelectorAll(".custom-select-option").forEach((item) => {
    const isSelected = item.dataset.value === select.value;
    item.classList.toggle("selected", isSelected);
    item.setAttribute("aria-selected", String(isSelected));
  });
}

function toggleCustomSelect(select) {
  const control = customSelects.get(select);
  if (!control || control.button.disabled) return;

  const willOpen = control.menu.hidden;
  closeAllCustomDatePickers();
  closeAllCustomTimePickers();
  closeAllCustomSelects(select);
  control.menu.hidden = !willOpen;
  control.button.classList.toggle("open", willOpen);
  control.button.setAttribute("aria-expanded", String(willOpen));

  if (willOpen) {
    const selected = control.menu.querySelector(".custom-select-option.selected");
    selected?.scrollIntoView({ block: "nearest" });
  }
}

function closeCustomSelect(select) {
  const control = customSelects.get(select);
  if (!control) return;
  control.menu.hidden = true;
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
}

function closeAllCustomSelects(exceptSelect) {
  customSelects.forEach((_, select) => {
    if (select !== exceptSelect) closeCustomSelect(select);
  });
}

function handleCustomSelectButtonKeydown(event, select) {
  if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
  event.preventDefault();
  const control = customSelects.get(select);
  if (!control || control.button.disabled) return;

  if (control.menu.hidden) toggleCustomSelect(select);
  const options = getEnabledCustomOptions(control.menu);
  const selectedIndex = Math.max(0, options.findIndex((item) => item.classList.contains("selected")));
  options[event.key === "ArrowUp" ? Math.max(0, selectedIndex - 1) : selectedIndex]?.focus();
}

function handleCustomSelectOptionKeydown(event, select) {
  const control = customSelects.get(select);
  if (!control) return;

  const options = getEnabledCustomOptions(control.menu);
  const currentIndex = options.indexOf(document.activeElement);

  if (event.key === "Escape") {
    event.preventDefault();
    closeCustomSelect(select);
    control.button.focus();
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + direction));
    options[nextIndex]?.focus();
  }
}

function getEnabledCustomOptions(menu) {
  return Array.from(menu.querySelectorAll(".custom-select-option:not(:disabled)"));
}

function handleDonutClick(event) {
  const category = categoryFromDonutPointer(event);
  if (!category) return;
  setFilter(activeFilter === category ? "전체" : category);
}

function handleDonutMove(event) {
  const category = categoryFromDonutPointer(event);
  highlightCategory(category || (activeFilter === "전체" ? null : activeFilter));
}

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
  syncCustomSelect(els.categorySelect, { rebuild: true });
  renderExpenseFormMode();
  if (activePage === "itinerary") renderItineraryPage();
}

function renderHistoryModal() {
  const records = [...historyRecords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  els.historyList.replaceChildren();
  els.historyEmpty.hidden = records.length > 0;

  records.forEach((record) => {
    const savedState = record.state || {};
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-main">
        <div class="history-title-row">
          <strong>${escapeHtml(savedState.tripName || getSnapshotDefaultTripName(savedState))}</strong>
          <span>${savedState.travelMode === "overseas" ? "해외" : "국내"}</span>
        </div>
        <p>${escapeHtml(formatHistoryTimestamp(record.timestamp))}</p>
        <div class="history-meta">
          <span>${escapeHtml(formatHistoryDateRange(savedState))}</span>
          <span>${Number(savedState.entries?.length || 0).toLocaleString("ko-KR")}건</span>
          <span>${formatWon(calculateSnapshotTotal(savedState))}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="history-load" type="button" data-history-action="load" data-history-id="${escapeHtml(record.id)}">불러오기</button>
        <button class="history-delete" type="button" data-history-action="delete" data-history-id="${escapeHtml(record.id)}">삭제</button>
      </div>
    `;
    els.historyList.appendChild(item);
  });
}

function renderItineraryPage() {
  const days = getTripDays();
  if (!days.some((day) => day.date === state.selectedItineraryDate)) {
    state.selectedItineraryDate = days[0]?.date || state.startDate;
  }

  els.itineraryTripName.textContent = state.tripName || getDefaultTripName();
  els.itineraryDateRange.textContent = `${formatReadableDate(state.startDate)} - ${formatReadableDate(state.endDate)}`;
  els.itineraryCount.textContent = `${Number(state.itineraryItems?.length || 0).toLocaleString("ko-KR")}건`;

  renderItineraryDaySelect(days);
  renderItineraryDayStrip(days);
  renderItineraryList(days);
}

function renderItineraryDaySelect(days) {
  els.itineraryDaySelect.replaceChildren();

  days.forEach((day) => {
    const option = document.createElement("option");
    option.value = day.date;
    option.textContent = `${day.label} · ${day.shortDate}`;
    els.itineraryDaySelect.appendChild(option);
  });

  if (!days.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "일정 없음";
    els.itineraryDaySelect.appendChild(option);
  }

  els.itineraryDaySelect.value = days.some((day) => day.date === state.selectedItineraryDate)
    ? state.selectedItineraryDate
    : days[0]?.date || "";
  els.itineraryDaySelect.disabled = !days.length;
  syncCustomSelect(els.itineraryDaySelect, { rebuild: true });
}

function renderItineraryDayStrip(days) {
  els.itineraryDayStrip.replaceChildren();

  days.forEach((day) => {
    const count = state.itineraryItems.filter((item) => item.date === day.date).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `itinerary-day-chip${day.date === state.selectedItineraryDate ? " active" : ""}`;
    button.innerHTML = `
      <strong>${day.label}</strong>
      <span>${day.shortDate} ${day.weekday}</span>
      <em>${count}곳</em>
    `;
    button.addEventListener("click", () => {
      const scrollIntent = captureDayStripScrollIntent(els.itineraryDayStrip, button);
      state.selectedItineraryDate = day.date;
      els.itineraryDaySelect.value = day.date;
      clearItineraryEditMode(false);
      saveAndRender();
      applyDayStripScrollIntent(els.itineraryDayStrip, scrollIntent);
    });
    els.itineraryDayStrip.appendChild(button);
  });
}

function renderItineraryList(days) {
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const items = getFilteredItineraryItems();
  els.itineraryList.replaceChildren();
  els.itineraryEmpty.hidden = items.length > 0;

  items.forEach((item) => {
    const day = dayMap.get(item.date);
    const card = document.createElement("article");
    card.className = `itinerary-card${item.id === state.selectedItineraryId ? " active" : ""}`;
    card.innerHTML = `
      <button class="itinerary-card-map" type="button" data-itinerary-action="map" data-id="${escapeHtml(item.id)}" title="지도에서 보기">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" /><path d="M12 10.5h.01" /></svg>
      </button>
      <div class="itinerary-card-main">
        <div class="itinerary-card-head">
          <span>${day ? day.label : "-"}</span>
          <strong>${escapeHtml(item.place)}</strong>
          <em>${item.time ? escapeHtml(item.time) : "시간 미정"}</em>
        </div>
        <p>${escapeHtml(item.location)}</p>
        ${item.memo ? `<small>${escapeHtml(item.memo)}</small>` : ""}
      </div>
      <div class="itinerary-card-actions">
        <button type="button" data-itinerary-action="edit" data-id="${escapeHtml(item.id)}">수정</button>
        <button type="button" data-itinerary-action="delete" data-id="${escapeHtml(item.id)}">삭제</button>
      </div>
    `;
    els.itineraryList.appendChild(card);
  });

  const selected = findItineraryItem(state.selectedItineraryId) || items[0] || state.itineraryItems[0];
  if (selected) updateMapPreview(selected);
  else updateMapPreview({ place: state.tripName || getDefaultTripName(), location: state.tripName || "대한민국" });
}

function handleItineraryListAction(event) {
  const button = event.target.closest("button[data-itinerary-action]");
  if (!button || !els.itineraryList.contains(button)) return;

  event.preventDefault();
  const item = findItineraryItem(button.dataset.id);
  if (!item) return;

  if (button.dataset.itineraryAction === "map") {
    selectItineraryItem(item.id);
  }

  if (button.dataset.itineraryAction === "edit") {
    startItineraryEdit(item);
  }

  if (button.dataset.itineraryAction === "delete") {
    deleteItineraryItem(item.id);
  }
}

function handlePlaceInput() {
  const query = els.itineraryPlaceInput.value.trim();
  selectedPlaceCandidate = null;
  els.itineraryLocationInput.value = query;
  clearPlaceSearchTimer();
  closeManualAddressPanel();

  if (!query) {
    setPlaceSearchStatus("입력값 그대로 저장하거나 검색 결과를 선택할 수 있습니다.");
    closePlaceSearchResults();
    updateMapPreview({ place: state.tripName || getDefaultTripName(), location: state.tripName || "대한민국" });
    return;
  }

  setPlaceSearchStatus("수동 입력으로 저장됩니다. 검색 결과를 선택하면 주소가 자동 입력됩니다.");
  updateMapPreview({ place: query, location: query });

  if (query.length >= 2) {
    placeSearchTimer = window.setTimeout(() => searchPlacesFromInput({ force: false }), 520);
  } else {
    closePlaceSearchResults();
  }
}

function handlePlaceInputKeydown(event) {
  if (event.key !== "Enter" || event.isComposing) return;
  if (!els.placeSearchResults.hidden) return;
  const query = els.itineraryPlaceInput.value.trim();
  if (!query) return;
  event.preventDefault();
  searchPlacesFromInput({ force: true });
}

async function searchPlacesFromInput({ force = false } = {}) {
  const query = els.itineraryPlaceInput.value.trim();
  clearPlaceSearchTimer();

  if (query.length < 2) {
    if (force) setPlaceSearchStatus("두 글자 이상 입력하면 장소를 검색할 수 있습니다.", "warning");
    closePlaceSearchResults();
    return;
  }

  if (force) {
    applyGoogleMapSearch(query);
  }

  if (placeSearchAbortController) placeSearchAbortController.abort();
  const controller = new AbortController();
  placeSearchAbortController = controller;
  setPlaceSearchStatus(force ? "구글맵에 위치를 반영하고 주소 후보를 찾는 중입니다..." : "주소 후보를 찾는 중입니다...");
  els.placeSearchButton.disabled = true;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    url.searchParams.set("accept-language", "ko");
    url.searchParams.set("q", query);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`place search ${response.status}`);

    const results = (await response.json()).map(normalizePlaceSearchResult).filter(Boolean);
    renderPlaceSearchResults(results, query, { mapSyncedByGoogle: force });
  } catch (error) {
    if (error.name !== "AbortError") {
      setPlaceSearchStatus(
        force
          ? "주소 후보 검색은 불안정하지만 구글맵 검색으로 지도에 반영했습니다. 필요하면 주소를 직접 입력하세요."
          : "주소 후보 검색을 사용할 수 없습니다. 입력값은 구글맵 검색으로 확인할 수 있습니다.",
        force ? "success" : "warning",
      );
      closePlaceSearchResults();
      if (force) openManualAddressPanel(query, { focus: false });
    }
  } finally {
    if (placeSearchAbortController === controller) {
      placeSearchAbortController = null;
      els.placeSearchButton.disabled = false;
    }
  }
}

function normalizePlaceSearchResult(result) {
  if (!result?.display_name) return null;
  const address = result.address || {};
  const place =
    result.name ||
    address.attraction ||
    address.tourism ||
    address.amenity ||
    address.building ||
    address.shop ||
    address.road ||
    result.display_name.split(",")[0];

  return {
    id: String(result.place_id || result.osm_id || result.display_name),
    place: place.trim(),
    location: result.display_name,
    lat: result.lat,
    lon: result.lon,
    type: result.type || result.class || "장소",
  };
}

function renderPlaceSearchResults(results, query, { mapSyncedByGoogle = false } = {}) {
  els.placeSearchResults.replaceChildren();

  if (!results.length) {
    setPlaceSearchStatus(
      `"${query}" 주소 후보는 없지만 구글맵 검색으로 지도에 반영했습니다. 필요하면 주소를 직접 입력하세요.`,
      mapSyncedByGoogle ? "success" : "neutral",
    );
    closePlaceSearchResults();
    if (mapSyncedByGoogle) openManualAddressPanel(query, { focus: true });
    return;
  }

  results.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-search-result";
    button.dataset.placeId = result.id;
    button.setAttribute("role", "option");
    button.innerHTML = `
      <strong>${escapeHtml(result.place)}</strong>
      <span>${escapeHtml(result.location)}</span>
    `;
    button.addEventListener("click", () => selectPlaceSearchResult(result));
    els.placeSearchResults.appendChild(button);
  });

  els.placeSearchResults.hidden = false;
  if (mapSyncedByGoogle) {
    setPlaceSearchStatus("구글맵 검색으로 지도에 반영했습니다. 아래 주소 후보를 선택하면 장소명이 자동 정리됩니다.", "success");
    return;
  }

  setPlaceSearchStatus(`${results.length}개의 검색 결과가 있습니다. 선택하면 주소가 자동 입력됩니다.`, "success");
}

function selectPlaceSearchResult(result) {
  applyPlaceSearchResult(result);
}

function applyPlaceSearchResult(result, { closeResults = true } = {}) {
  selectedPlaceCandidate = result;
  els.itineraryPlaceInput.value = result.place;
  els.itineraryLocationInput.value = result.location;
  if (closeResults) closePlaceSearchResults();
  closeManualAddressPanel();
  setPlaceSearchStatus(result.location, "success");
  updateMapPreview(result);
}

function applyGoogleMapSearch(query) {
  selectedPlaceCandidate = {
    id: `google-query:${query}`,
    place: query,
    location: query,
    source: "google-query",
  };
  els.itineraryLocationInput.value = query;
  updateMapPreview({ place: query, location: query });
}

function toggleManualAddressPanel() {
  if (els.manualAddressPanel.hidden) {
    openManualAddressPanel(els.itineraryLocationInput.value || els.itineraryPlaceInput.value.trim(), { focus: true });
    return;
  }

  closeManualAddressPanel();
}

function openManualAddressPanel(prefill = "", { focus = false } = {}) {
  const value = (prefill || els.itineraryLocationInput.value || els.itineraryPlaceInput.value.trim()).trim();
  if (value) els.manualAddressInput.value = value;
  closePlaceSearchResults();
  els.manualAddressPanel.hidden = false;

  if (focus) {
    requestAnimationFrame(() => {
      els.manualAddressInput.focus();
      els.manualAddressInput.select();
    });
  }
}

function closeManualAddressPanel() {
  els.manualAddressPanel.hidden = true;
}

function handleManualAddressKeydown(event) {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    applyManualAddressInput();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeManualAddressPanel();
    els.itineraryPlaceInput.focus();
  }
}

function applyManualAddressInput() {
  const address = els.manualAddressInput.value.trim();
  const place = els.itineraryPlaceInput.value.trim() || address;

  if (!address) {
    setPlaceSearchStatus("직접 입력할 주소를 적어주세요.", "warning");
    els.manualAddressInput.focus();
    return;
  }

  if (!els.itineraryPlaceInput.value.trim()) {
    els.itineraryPlaceInput.value = address;
  }

  selectedPlaceCandidate = {
    id: `manual-address:${address}`,
    place,
    location: address,
    source: "manual-address",
  };
  els.itineraryLocationInput.value = address;
  updateMapPreview({ place, location: address });
  closePlaceSearchResults();
  closeManualAddressPanel();
  setPlaceSearchStatus("직접 입력한 주소를 지도와 일정 위치에 반영했습니다.", "success");
}

function closePlaceSearchResults() {
  els.placeSearchResults.hidden = true;
}

function setPlaceSearchStatus(message, tone = "neutral") {
  els.placeSearchStatus.textContent = message;
  els.placeSearchStatus.dataset.tone = tone;
}

function clearPlaceSearchTimer() {
  if (!placeSearchTimer) return;
  window.clearTimeout(placeSearchTimer);
  placeSearchTimer = null;
}

function handleItinerarySubmit(event) {
  event.preventDefault();
  const place = els.itineraryPlaceInput.value.trim();
  const location = els.itineraryLocationInput.value.trim() || place;
  if (!place) return;

  const item = {
    id: editingItineraryId || createId(),
    date: els.itineraryDaySelect.value || state.selectedItineraryDate,
    time: els.itineraryTimeInput.value,
    place,
    location,
    memo: els.itineraryMemoInput.value.trim(),
    createdAt: editingItineraryId ? findItineraryItem(editingItineraryId)?.createdAt || Date.now() : Date.now(),
  };

  if (editingItineraryId) {
    state.itineraryItems = state.itineraryItems.map((entry) => (entry.id === editingItineraryId ? item : entry));
  } else {
    state.itineraryItems.push(item);
  }

  state.selectedItineraryDate = item.date;
  state.selectedItineraryId = item.id;
  clearItineraryEditMode(false);
  saveAndRender();
}

function startItineraryEdit(item) {
  editingItineraryId = item.id;
  state.selectedItineraryDate = item.date;
  state.selectedItineraryId = item.id;
  els.itineraryDaySelect.value = item.date;
  els.itineraryTimeInput.value = item.time || "";
  els.itineraryPlaceInput.value = item.place || "";
  els.itineraryLocationInput.value = item.location || "";
  els.manualAddressInput.value = item.location || "";
  els.itineraryMemoInput.value = item.memo || "";
  selectedPlaceCandidate = item.place && item.location ? { place: item.place, location: item.location } : null;
  setPlaceSearchStatus(item.location || "입력값 그대로 저장하거나 검색 결과를 선택할 수 있습니다.", item.location ? "success" : "neutral");
  closePlaceSearchResults();
  closeManualAddressPanel();
  els.itinerarySubmitButton.querySelector("span").textContent = "일정 저장";
  els.cancelItineraryEditButton.hidden = false;
  syncCustomSelect(els.itineraryDaySelect);
  syncCustomTimePicker(els.itineraryTimeInput);
  updateMapPreview(item);
  els.itineraryPlaceInput.focus();
}

function clearItineraryEditMode(shouldRender = true) {
  editingItineraryId = null;
  els.itineraryForm.reset();
  els.itineraryDaySelect.value = state.selectedItineraryDate || state.startDate;
  els.itineraryLocationInput.value = "";
  els.manualAddressInput.value = "";
  selectedPlaceCandidate = null;
  setPlaceSearchStatus("입력값 그대로 저장하거나 검색 결과를 선택할 수 있습니다.");
  closePlaceSearchResults();
  closeManualAddressPanel();
  els.itinerarySubmitButton.querySelector("span").textContent = "일정 추가";
  els.cancelItineraryEditButton.hidden = true;
  syncCustomSelect(els.itineraryDaySelect);
  syncCustomTimePicker(els.itineraryTimeInput);
  if (shouldRender) renderItineraryPage();
}

function selectItineraryItem(id) {
  state.selectedItineraryId = id;
  const item = findItineraryItem(id);
  if (item) {
    state.selectedItineraryDate = item.date;
    updateMapPreview(item);
  }
  saveAndRender();
}

function deleteItineraryItem(id) {
  state.itineraryItems = state.itineraryItems.filter((item) => item.id !== id);
  if (editingItineraryId === id) clearItineraryEditMode(false);
  if (state.selectedItineraryId === id) state.selectedItineraryId = state.itineraryItems[0]?.id || "";
  saveAndRender();
}

function findItineraryItem(id) {
  return state.itineraryItems.find((item) => item.id === id);
}

function getFilteredItineraryItems() {
  return [...state.itineraryItems]
    .filter((item) => item.date === state.selectedItineraryDate)
    .sort((a, b) => {
      const timeDiff = (a.time || "99:99").localeCompare(b.time || "99:99");
      return timeDiff || a.createdAt - b.createdAt;
    });
}

function updateMapPreview(item) {
  const query = buildMapQuery(item);
  els.googleMapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  els.googleMapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  els.mapCurrentLabel.textContent = item.location ? item.location : "위치 미입력";
  els.mapCurrentPlace.textContent = item.place || query;
}

function buildMapQuery(item) {
  return Array.from(new Set([item.place, item.location].filter(Boolean))).join(" ").trim() || "대한민국";
}

function handleHistoryAction(event) {
  const button = event.target.closest("button[data-history-action]");
  if (!button) return;

  const record = historyRecords.find((item) => item.id === button.dataset.historyId);
  if (!record) return;

  if (button.dataset.historyAction === "load") {
    const ok = window.confirm("선택한 저장 기록으로 현재 화면을 덮어쓸까요?");
    if (!ok) return;
    restoreSnapshot(record.state);
    closeHistoryModal();
  }

  if (button.dataset.historyAction === "delete") {
    const ok = window.confirm("이 저장 기록을 삭제할까요?");
    if (!ok) return;
    historyRecords = historyRecords.filter((item) => item.id !== record.id);
    saveHistoryRecords();
    renderHistoryModal();
  }
}

function restoreSnapshot(snapshot) {
  const nextState = normalizeSnapshot(snapshot);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, nextState);
  editingId = null;
  activeFilter = "전체";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.querySelectorAll(".segmented button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === activeFilter);
  });
  render();
}

function normalizeSnapshot(snapshot) {
  const travelMode = snapshot?.travelMode === "overseas" ? "overseas" : "domestic";
  const snapshotTripName =
    typeof snapshot?.tripName === "string" && !isLegacyDefaultTripName(snapshot.tripName) ? snapshot.tripName : "";
  return {
    tripName: snapshotTripName,
    travelMode,
    startDate: snapshot?.startDate || "2026-06-09",
    endDate: snapshot?.endDate || snapshot?.startDate || "2026-06-09",
    selectedDate: snapshot?.selectedDate || snapshot?.startDate || "2026-06-09",
    selectedItineraryDate: snapshot?.selectedItineraryDate || snapshot?.selectedDate || snapshot?.startDate || "2026-06-09",
    selectedItineraryId: snapshot?.selectedItineraryId || "",
    entries: Array.isArray(snapshot?.entries) ? snapshot.entries : [],
    itineraryItems: Array.isArray(snapshot?.itineraryItems) ? snapshot.itineraryItems : [],
  };
}

function renderDayStrip(days) {
  els.dayStrip.replaceChildren();

  days.forEach((day) => {
    const total = sumEntries(state.entries.filter((entry) => entry.date === day.date));
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-chip${day.date === state.selectedDate ? " active" : ""}`;
    button.innerHTML = `
      <strong>${day.label}</strong>
      <span>${day.shortDate} ${day.weekday}</span>
      <em>${formatWon(total)}</em>
    `;
    button.addEventListener("click", () => {
      const scrollIntent = captureDayStripScrollIntent(els.dayStrip, button);
      state.selectedDate = day.date;
      els.daySelect.value = day.date;
      saveAndRender();
      applyDayStripScrollIntent(els.dayStrip, scrollIntent);
    });
    els.dayStrip.appendChild(button);
  });
}

function setupDayStripDrag(strip) {
  if (!strip) return;

  let dragState = null;

  strip.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (strip.scrollWidth <= strip.clientWidth + 1) return;

    const existingFrame = dayStripScrollAnimations.get(strip);
    if (existingFrame) {
      cancelAnimationFrame(existingFrame);
      dayStripScrollAnimations.delete(strip);
    }

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: strip.scrollLeft,
      moved: false,
      captured: false,
    };
  });

  strip.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const distance = event.clientX - dragState.startX;
    if (!dragState.moved && Math.abs(distance) >= DAY_STRIP_DRAG_THRESHOLD) {
      dragState.moved = true;
      dragState.captured = true;
      strip.setPointerCapture?.(event.pointerId);
      strip.classList.add("is-dragging");
    }

    if (!dragState.moved) return;

    event.preventDefault();
    strip.scrollLeft = dragState.startScrollLeft - distance;
  });

  const finishDrag = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const shouldSuppressClick = dragState.moved;
    if (dragState.captured) strip.releasePointerCapture?.(event.pointerId);
    strip.classList.remove("is-dragging");
    dragState = null;

    if (shouldSuppressClick) suppressNextDayStripClick(strip);
  };

  strip.addEventListener("pointerup", finishDrag);
  strip.addEventListener("pointercancel", finishDrag);
  strip.addEventListener("dragstart", (event) => event.preventDefault());
}

function suppressNextDayStripClick(strip) {
  let timer = 0;
  const blockClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    cleanup();
  };
  const cleanup = () => {
    strip.removeEventListener("click", blockClick, true);
    window.clearTimeout(timer);
  };

  strip.addEventListener("click", blockClick, true);
  timer = window.setTimeout(cleanup, 260);
}

function captureDayStripScrollIntent(strip, button) {
  if (!strip || !button || strip.scrollWidth <= strip.clientWidth + 1) {
    return { scrollLeft: strip?.scrollLeft || 0, direction: null };
  }

  const stripRect = strip.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const direction = buttonRect.left <= stripRect.left + 2
    ? "left"
    : buttonRect.right >= stripRect.right - 2
      ? "right"
      : null;

  return {
    direction,
    scrollLeft: strip.scrollLeft,
    step: getDayStripScrollStep(strip, button),
  };
}

function applyDayStripScrollIntent(strip, intent) {
  if (!strip || !intent) return;

  requestAnimationFrame(() => {
    strip.scrollLeft = intent.scrollLeft || 0;
    if (!intent.direction) return;

    const delta = intent.direction === "right" ? intent.step : -intent.step;
    animateDayStripScroll(strip, delta, DAY_STRIP_EDGE_SCROLL_DURATION);
  });
}

function getDayStripScrollStep(strip, button) {
  const style = window.getComputedStyle(strip);
  const gap = Number.parseFloat(style.columnGap || style.gap) || 10;
  return (button?.getBoundingClientRect().width || strip.clientWidth / 3) + gap;
}

function animateDayStripScroll(strip, delta, duration) {
  const maxScroll = strip.scrollWidth - strip.clientWidth;
  const start = strip.scrollLeft;
  const target = Math.max(0, Math.min(maxScroll, start + delta));
  if (Math.abs(target - start) < 1) return;

  const existingFrame = dayStripScrollAnimations.get(strip);
  if (existingFrame) cancelAnimationFrame(existingFrame);

  const startTime = performance.now();
  const easeOut = (progress) => 1 - Math.pow(1 - progress, 3);

  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    strip.scrollLeft = start + (target - start) * easeOut(progress);

    if (progress < 1) {
      dayStripScrollAnimations.set(strip, requestAnimationFrame(step));
    } else {
      dayStripScrollAnimations.delete(strip);
    }
  };

  dayStripScrollAnimations.set(strip, requestAnimationFrame(step));
}

function renderDaySelect(days) {
  els.daySelect.replaceChildren();

  days.forEach((day) => {
    const option = document.createElement("option");
    option.value = day.date;
    option.textContent = `${day.label} · ${day.shortDate}`;
    els.daySelect.appendChild(option);
  });

  if (days.length === 0) {
    const option = document.createElement("option");
    option.textContent = "일정 없음";
    option.value = "";
    els.daySelect.appendChild(option);
  }

  els.daySelect.value = days.some((day) => day.date === state.selectedDate) ? state.selectedDate : days[0]?.date || "";
  els.daySelect.disabled = days.length === 0;
  syncCustomSelect(els.daySelect, { rebuild: true });
}

function renderTable(entries, days) {
  const dayMap = new Map(days.map((day) => [day.date, day]));
  els.expenseTableBody.replaceChildren();

  entries.forEach((entry) => {
    const day = dayMap.get(entry.date);
    const tr = document.createElement("tr");
    const color = getCategory(entry.category).color;
    tr.innerHTML = `
      <td>${day ? day.label : "-"}</td>
      <td>${day ? day.shortDate : formatShortDate(parseDate(entry.date))}</td>
      <td><span class="tag" style="--tag-color:${color}">${escapeHtml(entry.category)}</span></td>
      <td>${escapeHtml(entry.description)}</td>
      <td class="number">${formatEntryAmountHtml(entry)}</td>
      <td>${entry.note ? escapeHtml(entry.note) : "-"}</td>
      <td class="actions-col">
        <div class="row-actions">
          <button class="row-action edit" type="button" data-action="edit" data-id="${entry.id}" title="수정">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
          </button>
          <button class="row-action delete" type="button" data-action="delete" data-id="${entry.id}" title="삭제">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M3 6h18M8 6V4h8v2M10 11v6M14 11v6M6 6l1 14h10l1-14" /></svg>
          </button>
        </div>
      </td>
    `;
    els.expenseTableBody.appendChild(tr);
  });

  els.expenseTableBody.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = findEntry(button.dataset.id);
      if (!entry) return;
      if (button.dataset.action === "edit") startEdit(entry);
      if (button.dataset.action === "delete") deleteEntry(entry.id);
    });
  });

  els.emptyState.hidden = entries.length > 0;
}

function renderCategorySummary(totals) {
  els.categoryList.replaceChildren();
  renderDonutChart(totals);

  categories.forEach((category) => {
    const amount = totals.byCategory[category.name] || 0;
    const ratio = totals.total ? Math.round((amount / totals.total) * 100) : 0;
    const node = els.categoryRowTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.category = category.name;
    node.style.setProperty("--dot", category.color);
    node.style.setProperty("--bar-width", `${ratio}%`);
    node.classList.toggle("active", activeFilter === category.name);
    node.querySelector(".category-name").textContent = category.name;
    node.querySelector(".category-amount").textContent = formatWon(amount);
    node.querySelector(".category-ratio").textContent = `${ratio}%`;
    node.addEventListener("mouseenter", () => highlightCategory(category.name));
    node.addEventListener("mouseleave", () => highlightCategory(activeFilter === "전체" ? null : activeFilter));
    node.addEventListener("click", () => {
      if (amount > 0) setFilter(activeFilter === category.name ? "전체" : category.name);
    });
    els.categoryList.appendChild(node);
  });

  highlightCategory(activeFilter === "전체" ? null : activeFilter);
}

function renderDonutChart(totals) {
  if (!totals.total) {
    els.categoryDonut.innerHTML = `
      <svg class="donut-svg" viewBox="0 0 160 128" aria-hidden="true" focusable="false">
        <ellipse class="donut-empty-shadow" cx="80" cy="72" rx="58" ry="35"></ellipse>
        <ellipse class="donut-empty-top" cx="80" cy="60" rx="58" ry="35"></ellipse>
        <ellipse class="donut-hole" cx="80" cy="60" rx="30" ry="18"></ellipse>
      </svg>
    `;
    updateChartDetail(null, 0, 0, "가장 많이 쓴 항목");
    return;
  }

  let cursor = -90;
  const gradientDefs = categories
    .map((category, index) => `
      <linearGradient id="donutTopGradient${index}" x1="38%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stop-color="${shadeColor(category.color, 38)}"></stop>
        <stop offset="50%" stop-color="${category.color}"></stop>
        <stop offset="100%" stop-color="${shadeColor(category.color, -10)}"></stop>
      </linearGradient>
      <linearGradient id="donutDepthGradient${index}" x1="38%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stop-color="${shadeColor(category.color, -14)}"></stop>
        <stop offset="100%" stop-color="${shadeColor(category.color, -36)}"></stop>
      </linearGradient>
    `)
    .join("");
  const slices = categories
    .map((category, index) => {
      const amount = totals.byCategory[category.name] || 0;
      if (!amount) return "";
      const angle = (amount / totals.total) * 360;
      const start = cursor;
      const end = cursor + Math.max(angle, 0.8);
      cursor += angle;
      const path = describeDonutSlice(80, 54, 58, 29, 32, 16, start, Math.min(end, 269.99));
      const depthPath = describeDonutSlice(80, 63, 58, 29, 32, 16, start, Math.min(end, 269.99));
      const hitPath = describePieSlice(80, 54, 64, 35, start, Math.min(end, 269.99));
      const ratio = Math.round((amount / totals.total) * 100);
      return `
        <g class="donut-slice${activeFilter === category.name ? " active" : ""}"
           data-category="${category.name}"
           data-amount="${amount}"
           data-ratio="${ratio}"
           tabindex="0"
           role="button"
           aria-label="${category.name} ${formatWon(amount)} ${ratio}%">
          <path class="donut-depth" d="${depthPath}" fill="url(#donutDepthGradient${index})"></path>
          <path class="donut-top" d="${path}" fill="url(#donutTopGradient${index})"></path>
          <path class="donut-gloss" d="${path}"></path>
          <path class="donut-hit" d="${hitPath}"></path>
        </g>
      `;
    })
    .join("");

  els.categoryDonut.innerHTML = `
    <svg class="donut-svg" viewBox="0 0 160 128" aria-hidden="false" focusable="false">
      <defs>
        ${gradientDefs}
        <radialGradient id="donutFloorGradient" cx="50%" cy="44%" r="64%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0.18"></stop>
          <stop offset="62%" stop-color="#0f172a" stop-opacity="0.10"></stop>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"></stop>
        </radialGradient>
        <linearGradient id="donutHoleSurface" x1="35%" y1="0%" x2="65%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"></stop>
          <stop offset="100%" stop-color="#edf4f8"></stop>
        </linearGradient>
        <linearGradient id="donutInnerWall" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc"></stop>
          <stop offset="100%" stop-color="#cbd5e1"></stop>
        </linearGradient>
      </defs>
      <ellipse class="donut-base-shadow" cx="82" cy="75" rx="56" ry="23" fill="url(#donutFloorGradient)"></ellipse>
      <ellipse class="donut-soft-rim" cx="80" cy="63" rx="59" ry="29"></ellipse>
      ${slices}
      <ellipse class="donut-inner-wall" cx="80" cy="63" rx="33" ry="17"></ellipse>
      <ellipse class="donut-hole-shadow" cx="80" cy="62" rx="31" ry="16"></ellipse>
      <ellipse class="donut-hole" cx="80" cy="54" rx="29" ry="14" fill="url(#donutHoleSurface)"></ellipse>
      <ellipse class="donut-hole-glow" cx="80" cy="50" rx="20" ry="7"></ellipse>
      <ellipse class="donut-rim-light" cx="80" cy="54" rx="58" ry="29"></ellipse>
    </svg>
  `;

  els.categoryDonut.querySelectorAll(".donut-slice").forEach((slice) => {
    const category = slice.dataset.category;
    const selectSlice = (event) => {
      event.stopPropagation();
      setFilter(activeFilter === category ? "전체" : category);
    };
    slice.addEventListener("mouseenter", () => highlightCategory(category));
    slice.addEventListener("focus", () => highlightCategory(category));
    slice.addEventListener("mouseleave", () => highlightCategory(activeFilter === "전체" ? null : activeFilter));
    slice.addEventListener("blur", () => highlightCategory(activeFilter === "전체" ? null : activeFilter));
    slice.addEventListener("click", selectSlice);
    slice.querySelectorAll("path").forEach((path) => path.addEventListener("click", selectSlice));
    slice.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setFilter(activeFilter === category ? "전체" : category);
      }
    });
  });

  if (!totals.total) {
    return;
  }
}

function highlightCategory(categoryName) {
  const totals = calculateTotals();
  const category = categoryName ? getCategory(categoryName) : totals.topCategory;
  const amount = category ? totals.byCategory[category.name] || 0 : 0;
  const ratio = totals.total && amount ? Math.round((amount / totals.total) * 100) : 0;
  const label = categoryName ? "선택한 항목" : "가장 많이 쓴 항목";

  els.categoryDonut.querySelectorAll(".donut-slice").forEach((slice) => {
    slice.classList.toggle("is-hovered", slice.dataset.category === category?.name);
    slice.classList.toggle("is-muted", Boolean(category?.name) && slice.dataset.category !== category.name);
    slice.classList.toggle("active", activeFilter === slice.dataset.category);
  });
  els.categoryList.querySelectorAll(".category-row").forEach((row) => {
    row.classList.toggle("is-hovered", row.dataset.category === category?.name);
    row.classList.toggle("active", activeFilter === row.dataset.category);
  });

  updateChartDetail(category, amount, ratio, label);
}

function updateChartDetail(category, amount, ratio, label) {
  els.chartCaption.textContent = label;
  els.dominantCategory.textContent = category ? category.name : "-";
  els.chartAmount.textContent = category && amount ? `${formatWon(amount)} · ${ratio}%` : "0원";
}

function categoryFromDonutPointer(event) {
  const totals = calculateTotals();
  if (!totals.total) return null;

  const rect = els.categoryDonut.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 160;
  const y = ((event.clientY - rect.top) / rect.height) * 128;
  const dx = x - 80;
  const dy = y - 54;
  const outer = (dx / 64) ** 2 + (dy / 35) ** 2;
  const inner = (dx / 29) ** 2 + (dy / 14) ** 2;
  if (outer > 1.15 || inner < 1) return null;

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < -90) angle += 360;
  const progress = angle + 90;

  let cursor = 0;
  for (const category of categories) {
    const amount = totals.byCategory[category.name] || 0;
    if (!amount) continue;
    const next = cursor + (amount / totals.total) * 360;
    if (progress >= cursor && progress <= next) return category.name;
    cursor = next;
  }

  return categories.find((category) => totals.byCategory[category.name])?.name || null;
}

function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll(".segmented button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === activeFilter);
  });
  render();
}

function startEdit(entry) {
  editingId = entry.id;
  state.travelMode = isForeignEntry(entry) ? "overseas" : "domestic";
  els.daySelect.value = entry.date;
  els.categorySelect.value = entry.category;
  els.descriptionInput.value = entry.description;
  els.currencySelect.value = entry.currency || "JPY";
  els.foreignAmountInput.value = entry.foreignAmount || "";
  els.exchangeRateInput.value = getEditableExchangeRate(entry);
  els.amountInput.value = entry.amount;
  els.noteInput.value = entry.note;
  renderModeControls();
  syncCustomSelect(els.daySelect);
  syncCustomSelect(els.categorySelect);
  syncCustomSelect(els.currencySelect);
  els.submitButton.querySelector("span").textContent = "저장";
  els.cancelEditButton.hidden = false;
  els.descriptionInput.focus();
}

function clearEditMode() {
  editingId = null;
  els.expenseForm.reset();
  els.daySelect.value = state.selectedDate;
  els.categorySelect.value = "식비";
  els.currencySelect.value = "JPY";
  els.foreignAmountInput.value = "";
  els.exchangeRateInput.value = "";
  els.amountInput.value = "";
  renderModeControls();
  syncCustomSelect(els.daySelect);
  syncCustomSelect(els.categorySelect);
  syncCustomSelect(els.currencySelect);
  els.submitButton.querySelector("span").textContent = "추가";
  els.cancelEditButton.hidden = true;
}

function deleteEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  if (editingId === id) clearEditMode();
  saveAndRender();
}

function findEntry(id) {
  return state.entries.find((entry) => entry.id === id);
}

function getFilteredEntries() {
  const sorted = [...state.entries].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    return dateDiff || a.createdAt - b.createdAt;
  });
  return activeFilter === "전체" ? sorted : sorted.filter((entry) => entry.category === activeFilter);
}

function calculateTotals() {
  const byCategory = Object.fromEntries(categories.map((category) => [category.name, 0]));

  state.entries.forEach((entry) => {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + Number(entry.amount || 0);
  });

  const total = Object.values(byCategory).reduce((sum, amount) => sum + amount, 0);
  const topCategory = categories
    .map((category) => ({ ...category, amount: byCategory[category.name] || 0 }))
    .sort((a, b) => b.amount - a.amount)[0];

  return {
    total,
    byCategory,
    topCategory: topCategory?.amount ? topCategory : null,
  };
}

function loadSampleData() {
  state.tripName = "제주도 국내여행";
  state.travelMode = "domestic";
  state.startDate = "2026-06-09";
  state.endDate = "2026-06-12";
  state.selectedDate = "2026-06-09";
  state.selectedItineraryDate = "2026-06-09";
  const sampleLodgingEntries = createLodgingEntries({
    checkIn: "2026-06-10",
    checkOut: "2026-06-12",
    nights: 2,
    description: "숙소 2박",
    amount: 240000,
    note: "사전 결제",
    isOverseas: false,
    currency: getCurrencyMeta("JPY"),
    foreignAmount: 0,
    exchangeRate: 0,
  });
  state.entries = [
    createEntry("2026-06-09", "교통", "렌터카 예약", 120000, "공항 픽업"),
    createEntry("2026-06-09", "식비", "흑돼지 저녁", 68000, ""),
    createEntry("2026-06-10", "관광", "성산일출봉 입장료", 10000, "2인"),
    ...sampleLodgingEntries,
    createEntry("2026-06-11", "쇼핑", "기념품", 35000, ""),
    createEntry("2026-06-12", "기타", "여행자보험", 12000, ""),
  ];
  state.itineraryItems = [
    createItineraryItem("2026-06-09", "10:30", "제주국제공항", "제주특별자치도 제주시 공항로 2", "렌터카 픽업"),
    createItineraryItem("2026-06-10", "09:40", "성산일출봉", "제주특별자치도 서귀포시 성산읍 성산리 1", "오전 산책"),
    createItineraryItem("2026-06-11", "15:00", "협재해수욕장", "제주특별자치도 제주시 한림읍 협재리 2497-1", "카페 들르기"),
  ];
  state.selectedItineraryId = state.itineraryItems[0]?.id || "";
  clearEditMode();
  clearItineraryEditMode(false);
  saveAndRender();
}

function resetAll() {
  const ok = window.confirm("모든 여행 경비 기록을 초기화할까요?");
  if (!ok) return;

  state.tripName = "";
  state.travelMode = "domestic";
  state.startDate = "2026-06-09";
  state.endDate = "2026-06-12";
  state.selectedDate = "2026-06-09";
  state.selectedItineraryDate = "2026-06-09";
  state.selectedItineraryId = "";
  state.entries = [];
  state.itineraryItems = [];
  clearEditMode();
  clearItineraryEditMode(false);
  saveAndRender();
}

function exportPdf() {
  buildPrintReport();
  requestAnimationFrame(() => window.print());
}

function buildPrintReport() {
  const days = getTripDays();
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const totals = calculateTotals();
  const safeTripName = escapeHtml(state.tripName || getDefaultTripName());
  const dateRange = `${formatReadableDate(state.startDate)} - ${formatReadableDate(state.endDate)}`;
  const generatedAt = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const categoryRows = categories
    .map((category) => {
      const amount = totals.byCategory[category.name] || 0;
      const ratio = totals.total ? Math.round((amount / totals.total) * 100) : 0;
      return `<tr><td>${category.name}</td><td class="number">${formatWon(amount)}</td><td class="number">${ratio}%</td></tr>`;
    })
    .join("");

  const expenseRows = getFilteredEntriesForPrint()
    .map((entry) => {
      const day = dayMap.get(entry.date);
      return `
        <tr>
          <td>${day ? day.label : "-"}</td>
          <td>${day ? day.shortDate : formatShortDate(parseDate(entry.date))}</td>
          <td>${escapeHtml(entry.category)}</td>
          <td>${escapeHtml(entry.description)}</td>
          <td class="number">${escapeHtml(formatEntryAmountText(entry))}</td>
          <td>${entry.note ? escapeHtml(entry.note) : "-"}</td>
        </tr>
      `;
    })
    .join("");

  els.printReport.innerHTML = `
    <h1>${safeTripName} 경비 정산</h1>
    <p class="print-meta">${dateRange} · 생성 ${generatedAt}</p>
    <div class="print-grid">
      <div class="print-card"><span>총 지출</span><strong>${formatWon(totals.total)}</strong></div>
      <div class="print-card"><span>여행 기간</span><strong>${days.length}일</strong></div>
      <div class="print-card"><span>기록 수</span><strong>${state.entries.length}건</strong></div>
      <div class="print-card"><span>하루 평균</span><strong>${formatWon(days.length ? Math.round(totals.total / days.length) : 0)}</strong></div>
    </div>
    <h2 class="print-section-title">항목별 합계</h2>
    <table>
      <thead><tr><th>항목</th><th class="number">금액</th><th class="number">비율</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>
    <h2 class="print-section-title">지출 내역</h2>
    <table>
      <thead><tr><th>일차</th><th>날짜</th><th>항목</th><th>내용</th><th class="number">금액</th><th>비고</th></tr></thead>
      <tbody>${expenseRows || '<tr><td colspan="6">기록된 경비가 없습니다.</td></tr>'}</tbody>
    </table>
  `;
}

function getFilteredEntriesForPrint() {
  return [...state.entries].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    return dateDiff || a.createdAt - b.createdAt;
  });
}

function createEntry(date, category, description, amount, note) {
  return {
    id: createId(),
    date,
    category,
    description,
    amount,
    note,
    mode: "domestic",
    createdAt: Date.now() + Math.floor(Math.random() * 1000),
  };
}

function createItineraryItem(date, time, place, location, memo) {
  return {
    id: createId(),
    date,
    time,
    place,
    location,
    memo,
    createdAt: Date.now() + Math.floor(Math.random() * 1000),
  };
}

function isForeignEntry(entry) {
  return entry?.mode === "overseas" && Number(entry.foreignAmount || 0) > 0;
}

function getCurrencyMeta(code) {
  return currencies.find((currency) => currency.code === code) || currencies[0];
}

function getEntryCurrency(entry) {
  const fallback = getCurrencyMeta(entry.currency);
  return {
    ...fallback,
    symbol: entry.currencySymbol || fallback.symbol,
    unit: entry.currencyUnit || fallback.unit,
    rateBase: Number(entry.exchangeBase || fallback.rateBase || 1),
  };
}

function getEditableExchangeRate(entry) {
  if (!isForeignEntry(entry)) return "";
  if (entry.exchangeBase) return entry.exchangeRate || "";

  const currency = getCurrencyMeta(entry.currency);
  const foreignAmount = Number(entry.foreignAmount || 0);
  const amount = Number(entry.amount || 0);
  if (!foreignAmount || !amount) return entry.exchangeRate || "";
  return Number(((amount / foreignAmount) * currency.rateBase).toFixed(4));
}

function getDefaultTripName() {
  return state.travelMode === "overseas" ? "해외 여행" : "국내 여행";
}

function getSnapshotDefaultTripName(snapshot) {
  return snapshot?.travelMode === "overseas" ? "해외 여행" : "국내 여행";
}

function formatRateBase(currency) {
  return `${formatForeignNumber(currency.rateBase || 1)}${currency.unit}`;
}

function formatForeignNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  });
}

function formatForeignAmount(entry) {
  const currency = getEntryCurrency(entry);
  return `${formatForeignNumber(entry.foreignAmount)}${currency.unit}`;
}

function formatEntryAmountText(entry) {
  if (!isForeignEntry(entry)) return formatWon(entry.amount);
  return `${formatForeignAmount(entry)} (${formatWon(entry.amount)})`;
}

function formatEntryAmountHtml(entry) {
  if (!isForeignEntry(entry)) return escapeHtml(formatWon(entry.amount));
  const currency = getEntryCurrency(entry);
  return `
    <span class="foreign-amount" title="환율 ${escapeHtml(formatWon(entry.exchangeRate))} / ${escapeHtml(formatRateBase(currency))} 기준">
      <span class="currency-pill">${escapeHtml(currency.symbol)}</span>
      <span>${escapeHtml(formatForeignAmount(entry))}</span>
      <em>(${escapeHtml(formatWon(entry.amount))})</em>
    </span>
  `;
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCategory(name) {
  return categories.find((category) => category.name === name) || categories.at(-1);
}

function describeDonutSlice(cx, cy, outerRx, outerRy, innerRx, innerRy, startAngle, endAngle) {
  const startOuter = pointOnEllipse(cx, cy, outerRx, outerRy, startAngle);
  const endOuter = pointOnEllipse(cx, cy, outerRx, outerRy, endAngle);
  const startInner = pointOnEllipse(cx, cy, innerRx, innerRy, startAngle);
  const endInner = pointOnEllipse(cx, cy, innerRx, innerRy, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRx} ${outerRy} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRx} ${innerRy} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
}

function describePieSlice(cx, cy, rx, ry, startAngle, endAngle) {
  const start = pointOnEllipse(cx, cy, rx, ry, startAngle);
  const end = pointOnEllipse(cx, cy, rx, ry, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${rx} ${ry} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function pointOnEllipse(cx, cy, rx, ry, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: roundPathNumber(cx + rx * Math.cos(radians)),
    y: roundPathNumber(cy + ry * Math.sin(radians)),
  };
}

function roundPathNumber(value) {
  return Number(value.toFixed(3));
}

function shadeColor(color, amount) {
  const hex = color.replace("#", "");
  const number = Number.parseInt(hex, 16);
  const red = clampColor((number >> 16) + amount);
  const green = clampColor(((number >> 8) & 255) + amount);
  const blue = clampColor((number & 255) + amount);
  return `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`;
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}

function sumEntries(entries) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
}

function calculateSnapshotTotal(snapshot) {
  if (!Array.isArray(snapshot?.entries)) return 0;
  return snapshot.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function parseTimeValue(value) {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value || "")) return null;
  const [hour, minute] = value.split(":");
  return { hour, minute };
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(date) {
  if (!date) return "-";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatReadableDate(value) {
  const date = parseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function formatHistoryTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "저장 시간 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatHistoryDateRange(snapshot) {
  return `${formatReadableDate(snapshot?.startDate)} - ${formatReadableDate(snapshot?.endDate)}`;
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);
}

function formatWon(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
