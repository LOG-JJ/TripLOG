let activePretripPurchaseMode = "flight";
let isPretripOptionsExpanded = true;
let pretripFlightJourney = "oneway";
let pretripDraftTripId = "";
let pretripEditingEntry = null;
let pretripEntrySignature = "";
let pretripSubmitting = false;
let pretripInvalidField = null;

function normalizePretripPurchaseMode(mode = "") { return mode === "hotel" ? "hotel" : "flight"; }
function pretripElement(id) { return document.getElementById(id); }
function pretripToday() { return window.TripLog.features.redesign.model.localDate(); }
function isValidPretripDate(value) { return window.TripLog.features.travelCompanion.model.validDate(value); }

function setupPretripPurchaseForms() {
  els.pretripPurchaseTabs?.querySelectorAll("[data-pretrip-mode]").forEach(button => {
    button.addEventListener("click", () => {
      closeAllCustomDatePickers(); closeAllCustomTimePickers();
      setPretripPurchaseMode(button.dataset.pretripMode, { skipFocus: true });
    });
  });
  els.pretripFlightForm.addEventListener("submit", handlePretripFlightSubmit);
  els.pretripHotelForm.addEventListener("submit", handlePretripHotelSubmit);
  [els.pretripFlightForm, els.pretripHotelForm].forEach(form => {
    form.addEventListener("input", () => { clearPretripError(); syncPretripPurchaseSummary(); });
    form.addEventListener("change", () => { clearPretripError(); syncPretripPurchaseSummary(); });
    form.querySelectorAll("[data-pretrip-payment]").forEach(button => button.addEventListener("click", () => syncPretripPayment(form, button.dataset.pretripPayment)));
  });
  pretripElement("pretripFlightJourneyToggle").addEventListener("click", event => {
    const button = event.target.closest("[data-pretrip-journey]"); if (!button) return;
    closeAllCustomDatePickers(); closeAllCustomTimePickers();
    pretripFlightJourney = button.dataset.pretripJourney;
    clearPretripError(); syncPretripJourney(); syncPretripPurchaseDateBounds();
  });
  pretripElement("pretripFlightSwapButton").addEventListener("click", () => {
    [els.pretripFlightFromInput.value, els.pretripFlightToInput.value] = [els.pretripFlightToInput.value, els.pretripFlightFromInput.value];
    clearPretripError(); showToast("출발지와 도착지를 바꿨어요.");
  });
  [els.pretripFlightDepartDateInput, els.pretripFlightReturnDateInput, els.pretripHotelCheckInInput, els.pretripHotelCheckOutInput, els.pretripFlightPaymentDateInput, els.pretripHotelPaymentDateInput].forEach(input => setupCustomDatePicker(input));
  [els.pretripFlightDepartTimeInput, els.pretripFlightReturnDepartTimeInput].forEach(input => setupCustomTimePicker(input));
  els.pretripFlightDepartDateInput.addEventListener("change", syncPretripPurchaseDateBounds);
  els.pretripHotelCheckInInput.addEventListener("change", () => handlePretripHotelDateChange("checkIn"));
  els.pretripHotelCheckOutInput.addEventListener("change", () => handlePretripHotelDateChange("checkOut"));
}

function connectPretripPurchaseDialog() {
  pretripElement("rdReservation").addEventListener("close", () => {
    // A queued close event from an earlier opening must not reset a reopened form.
    if (pretripElement("rdReservation").open) return;
    pretripDraftTripId = ""; pretripEditingEntry = null; pretripEntrySignature = "";
    els.pretripFlightForm.reset(); els.pretripHotelForm.reset(); clearPretripError();
  });
}

function renderPretripPurchasePanel() {
  if (!els.pretripPurchasePanel) return;
  if (pretripDraftTripId && pretripDraftTripId !== state.id && pretripElement("rdReservation")?.open) {
    pretripElement("rdReservation").close(); return;
  }
  const shouldShow = state.selectedDate === PRE_TRIP_EXPENSE_DATE && !editingId;
  els.pretripPurchasePanel.hidden = !shouldShow;
  if (!shouldShow) return;
  syncPretripPurchaseDefaults();
  setPretripPurchaseMode(activePretripPurchaseMode, { skipFocus: true });
}

function setPretripOptionsExpanded(isExpanded, { skipFocus = true } = {}) {
  isPretripOptionsExpanded = Boolean(isExpanded); syncPretripOptionsVisibility({ skipFocus });
}
function syncPretripOptionsVisibility({ skipFocus = true } = {}) {
  const flight = activePretripPurchaseMode === "flight";
  els.pretripFlightForm.hidden = !isPretripOptionsExpanded || !flight;
  els.pretripHotelForm.hidden = !isPretripOptionsExpanded || flight;
  const submit = pretripElement("pretripPurchaseSubmit");
  if (submit) {
    submit.setAttribute("form", flight ? "pretripFlightForm" : "pretripHotelForm");
    submit.textContent = `${flight ? "항공권" : "숙소"} ${pretripEditingEntry ? "수정 저장" : "저장"}`;
    submit.disabled = pretripSubmitting;
  }
  const title = pretripElement("rdReservationTitle");
  if (title) title.textContent = pretripEditingEntry ? `${flight ? "항공권" : "숙소"} 수정` : "사전구매";
  if (!skipFocus && isPretripOptionsExpanded) (flight ? els.pretripFlightAirlineInput : els.pretripHotelNameInput).focus({ preventScroll: true });
}
function syncPretripJourney() {
  const roundtrip = pretripFlightJourney === "roundtrip";
  pretripElement("pretripFlightReturnFields").hidden = !roundtrip;
  els.pretripFlightReturnDateInput.disabled = !roundtrip; els.pretripFlightReturnDateInput.required = roundtrip;
  els.pretripFlightReturnDepartTimeInput.disabled = !roundtrip;
  pretripElement("pretripFlightJourneyToggle").querySelectorAll("[data-pretrip-journey]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.pretripJourney === pretripFlightJourney)));
  syncCustomDatePicker(els.pretripFlightReturnDateInput); syncCustomTimePicker(els.pretripFlightReturnDepartTimeInput);
}
function syncPretripPayment(form, value) {
  const method = value === "cash" ? "cash" : "card";
  (form === els.pretripFlightForm ? els.pretripFlightPaymentMethodInput : els.pretripHotelPaymentMethodInput).value = method;
  form.querySelectorAll("[data-pretrip-payment]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.pretripPayment === method)));
}
function syncPretripPurchaseSummary() {
  const summary = pretripElement("pretripHotelSummary"); if (!summary) return;
  const nights = getPretripHotelNights(els.pretripHotelCheckInInput.value, els.pretripHotelCheckOutInput.value);
  const amount = parseFormattedNumber(els.pretripHotelAmountInput.value);
  summary.textContent = nights ? `${nights}박${amount > 0 ? ` · 1박 평균 ${Math.round(amount / nights).toLocaleString("ko-KR")}원` : " · 숙박 전체 금액을 입력해 주세요"}` : state.startDate === state.endDate ? "숙박을 기록하려면 여행 기간을 1박 이상으로 설정해 주세요." : "체크인·체크아웃 날짜를 선택해 주세요.";
}
function syncPretripPurchaseDefaults() {
  syncPretripPurchaseDateBounds();
  syncPretripDateValue(els.pretripFlightDepartDateInput, state.startDate);
  syncPretripDateValue(els.pretripFlightReturnDateInput, state.endDate);
  syncPretripDateValue(els.pretripHotelCheckInInput, state.startDate);
  syncPretripDateValue(els.pretripHotelCheckOutInput, state.endDate);
  syncPretripDateValue(els.pretripFlightPaymentDateInput, pretripToday());
  syncPretripDateValue(els.pretripHotelPaymentDateInput, pretripToday());
  syncPretripPurchaseDateBounds(); syncPretripPurchaseSummary();
}
function handlePretripHotelDateChange(changedField) {
  const checkIn = parseDate(els.pretripHotelCheckInInput.value), checkOut = parseDate(els.pretripHotelCheckOutInput.value);
  if (changedField === "checkIn" && checkIn && (!checkOut || checkOut <= checkIn)) {
    const next = toInputDate(addDays(checkIn, 1));
    if (next <= state.endDate) { els.pretripHotelCheckOutInput.value = next; syncCustomDatePicker(els.pretripHotelCheckOutInput); }
  }
  syncPretripPurchaseDateBounds(); syncPretripPurchaseSummary();
}
function syncPretripPurchaseDateBounds() {
  const start = parseDate(state.startDate), end = parseDate(state.endDate); if (!start || !end) return;
  setPretripDateBounds(els.pretripFlightDepartDateInput, start, end);
  const departure = parseDate(els.pretripFlightDepartDateInput.value);
  setPretripDateBounds(els.pretripFlightReturnDateInput, departure && departure > start ? departure : start, end);
  setPretripDateBounds(els.pretripHotelCheckInInput, start, start < end ? addDays(end, -1) : end);
  const checkIn = parseDate(els.pretripHotelCheckInInput.value);
  setPretripDateBounds(els.pretripHotelCheckOutInput, addDays(checkIn || start, 1), end);
}
function setPretripDateBounds(input, minDate, maxDate) {
  input.min = toInputDate(minDate); input.max = toInputDate(maxDate); syncCustomDatePicker(input);
}
function syncPretripDateValue(input, fallbackValue) {
  if (!input.value) input.value = fallbackValue || "";
  syncCustomDatePicker(input);
}
function setPretripPurchaseMode(mode, { skipFocus = true } = {}) {
  mode = normalizePretripPurchaseMode(mode);
  if (pretripEditingEntry && mode !== pretripEditingEntry.pretripType) return;
  activePretripPurchaseMode = mode;
  [els.pretripFlightTab, els.pretripHotelTab].forEach(button => {
    const active = button.dataset.pretripMode === mode;
    button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    button.disabled = Boolean(pretripEditingEntry && !active);
  });
  clearPretripError(); syncPretripOptionsVisibility({ skipFocus }); syncPretripPurchaseSummary();
}
function getPretripMemo(entry) {
  if (typeof entry?.pretripMemo === "string") return entry.pretripMemo;
  if (!entry) return "";
  const automatic = new Set([
    `출발 ${entry.flightDepartDate}${entry.flightDepartTime ? ` ${entry.flightDepartTime}` : ""}`,
    `복귀 출발 ${entry.flightReturnDate}${entry.flightReturnDepartTime ? ` ${entry.flightReturnDepartTime}` : ""}`,
    `체크인 ${entry.hotelCheckIn}`, `체크아웃 ${entry.hotelCheckOut}`,
    `${getPretripHotelNights(entry.hotelCheckIn, entry.hotelCheckOut)}박`,
    `객실 ${entry.hotelRoomType}`, `${entry.hotelGuests}명`, `예약번호 ${entry.bookingCode}`,
  ]);
  return String(entry.note || "").split(" · ").filter(part => !automatic.has(part)).join(" · ");
}
function openPretripPurchaseMenu(mode = "flight", { entry = null } = {}) {
  activePretripPurchaseMode = normalizePretripPurchaseMode(mode); isPretripOptionsExpanded = true;
  pretripDraftTripId = state.id; pretripEditingEntry = entry ? JSON.parse(JSON.stringify(entry)) : null;
  pretripEntrySignature = JSON.stringify(entry); pretripSubmitting = false;
  els.pretripFlightForm.reset(); els.pretripHotelForm.reset(); clearPretripError();
  pretripFlightJourney = entry?.flightReturnDate ? "roundtrip" : "oneway";
  if (entry) {
    const fields = entry.pretripType === "flight" ? {
      pretripFlightAirlineInput: entry.flightAirline, pretripFlightNumberInput: entry.flightNumber,
      pretripFlightFromInput: entry.flightFrom, pretripFlightToInput: entry.flightTo,
      pretripFlightDepartDateInput: entry.flightDepartDate, pretripFlightDepartTimeInput: entry.flightDepartTime,
      pretripFlightReturnDateInput: entry.flightReturnDate, pretripFlightReturnDepartTimeInput: entry.flightReturnDepartTime,
      pretripFlightBookingCodeInput: entry.bookingCode, pretripFlightNoteInput: getPretripMemo(entry),
    } : {
      pretripHotelNameInput: entry.hotelName, pretripHotelCheckInInput: entry.hotelCheckIn,
      pretripHotelCheckOutInput: entry.hotelCheckOut, pretripHotelRoomInput: entry.hotelRoomType,
      pretripHotelGuestsInput: entry.hotelGuests || "", pretripHotelAddressInput: entry.hotelAddress,
      pretripHotelBookingCodeInput: entry.bookingCode, pretripHotelNoteInput: getPretripMemo(entry),
    };
    Object.entries(fields).forEach(([id, value]) => { pretripElement(id).value = value || ""; });
    const flight = entry.pretripType === "flight";
    setCommaNumberInputValue(flight ? els.pretripFlightAmountInput : els.pretripHotelAmountInput, entry.amount);
    (flight ? els.pretripFlightPaymentDateInput : els.pretripHotelPaymentDateInput).value = window.TripLog.features.redesign.model.paymentDate(entry);
  }
  syncPretripPayment(els.pretripFlightForm, entry?.pretripType === "flight" ? entry.paymentMethod : "card");
  syncPretripPayment(els.pretripHotelForm, entry?.pretripType === "hotel" ? entry.paymentMethod : "card");
  pretripElement("pretripFlightDetails").open = Boolean(entry?.pretripType === "flight" && (entry.bookingCode || getPretripMemo(entry)));
  pretripElement("pretripHotelDetails").open = Boolean(entry?.pretripType === "hotel" && (entry.hotelAddress || entry.bookingCode || entry.hotelRoomType || entry.hotelGuests || getPretripMemo(entry)));
  syncPretripJourney(); syncPretripPurchaseDefaults();
  [els.pretripFlightDepartTimeInput, els.pretripFlightReturnDepartTimeInput].forEach(input => syncCustomTimePicker(input));
  state.selectedDate = PRE_TRIP_EXPENSE_DATE; els.daySelect.value = PRE_TRIP_EXPENSE_DATE;
  setActivePage("budget");
  setPretripPurchaseMode(activePretripPurchaseMode, { skipFocus: true });
}
function clearPretripError() {
  ["pretripFlightError", "pretripHotelError"].forEach(id => { const error = pretripElement(id); if (error) { error.hidden = true; error.textContent = ""; (id === "pretripFlightError" ? els.pretripFlightForm : els.pretripHotelForm).append(error); } });
  if (pretripInvalidField) {
    pretripInvalidField.removeAttribute("aria-invalid"); pretripInvalidField.removeAttribute("aria-describedby");
    const custom = customDatePickers.get(pretripInvalidField) || customTimePickers.get(pretripInvalidField);
    custom?.button?.removeAttribute("aria-invalid"); custom?.button?.removeAttribute("aria-describedby");
    pretripInvalidField.closest(".pp-field, .pp-amount-label")?.classList.remove("is-invalid");
  }
  pretripInvalidField = null;
}
function showPretripError(message, input) {
  clearPretripError();
  const error = pretripElement(activePretripPurchaseMode === "flight" ? "pretripFlightError" : "pretripHotelError");
  error.textContent = message; error.hidden = false;
  if (!input) { error.scrollIntoView({ block: "nearest" }); return false; }
  const fieldGroup = input.closest(".pp-grid, .pp-route") || input.closest(".pp-field, .pp-amount-label");
  fieldGroup?.after(error);
  pretripInvalidField = input; input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", error.id);
  input.closest(".pp-field, .pp-amount-label")?.classList.add("is-invalid");
  const details = input.closest("details"); if (details) details.open = true;
  const control = customDatePickers.get(input) || customTimePickers.get(input);
  const target = control?.button || input;
  target.setAttribute("aria-invalid", "true"); target.setAttribute("aria-describedby", error.id);
  target.focus({ preventScroll: true }); target.scrollIntoView({ block: "nearest" });
  error.scrollIntoView({ block: "nearest" });
  return false;
}
function validatePretripField(input, message, predicate = value => Boolean(value.trim())) {
  return predicate(input.value) || showPretripError(message, input);
}
function validatePretripDate(input, label, bounded = true) {
  const objectParticle = label.endsWith("날짜") ? "를" : "을";
  const topicParticle = label.endsWith("날짜") ? "는" : "은";
  return validatePretripField(input, `${label}${objectParticle} 선택해 주세요.`, isValidPretripDate)
    && (!bounded || !isDateOutsideInputBounds(input, input.value) || showPretripError(`${label}${topicParticle} 여행 기간 안에서 선택해 주세요.`, input));
}
function getPretripPaymentMetadata(flight, amount) {
  const mode = pretripEditingEntry?.mode || (state.travelMode === "overseas" ? "overseas" : "domestic");
  return {
    paymentDate: (flight ? els.pretripFlightPaymentDateInput : els.pretripHotelPaymentDateInput).value,
    paymentMethod: (flight ? els.pretripFlightPaymentMethodInput : els.pretripHotelPaymentMethodInput).value,
    payerKey: pretripEditingEntry?.payerKey || "leader", mode,
    currency: mode === "overseas" ? "KRW" : "", currencySymbol: mode === "overseas" ? "₩" : "",
    currencyUnit: mode === "overseas" ? "원" : "", exchangeBase: 1,
    foreignAmount: mode === "overseas" ? amount : 0, exchangeRate: mode === "overseas" ? 1 : 0,
  };
}
async function savePretripEntry(fields) {
  if (pretripDraftTripId !== state.id) return showPretripError("여행이 변경됐어요. 입력창을 다시 열어 주세요.");
  const existing = pretripEditingEntry ? findEntry(pretripEditingEntry.id) : null;
  if (pretripEditingEntry && JSON.stringify(existing) !== pretripEntrySignature) return showPretripError("예약이 다른 곳에서 변경됐어요. 다시 열어 확인해 주세요.");
  const entry = { ...(existing || {}), ...fields, id: existing?.id || createId(), date: PRE_TRIP_EXPENSE_DATE, createdAt: existing?.createdAt || Date.now() };
  const previous = state.entries, submittedTrip = state.id;
  state.entries = existing ? previous.map(row => row.id === entry.id ? entry : row) : [...previous, entry];
  if (!await saveAndRender()) {
    if (state.id === submittedTrip) { state.entries = previous; render(); } return showPretripError("저장하지 못했어요. 기기 저장 공간을 확인한 뒤 다시 시도해 주세요.");
  }
  if (state.id !== submittedTrip) return;
  pretripElement("rdReservation").close();
  window.TripLog.features.redesign.workspace.showSavedPretrip(entry);
  showToast(`${entry.pretripType === "flight" ? "항공권" : "숙소"} ${existing ? "정보를 수정했어요." : "지출과 예약을 저장했어요."}`);
  return true;
}
async function handlePretripFlightSubmit(event) {
  event.preventDefault();
  if (pretripSubmitting || !pretripElement("rdReservation")?.open) return;
  clearPretripError();
  if (!validatePretripField(els.pretripFlightAirlineInput, "항공사를 입력해 주세요.") || !validatePretripField(els.pretripFlightFromInput, "출발지를 입력해 주세요.") || !validatePretripField(els.pretripFlightToInput, "도착지를 입력해 주세요.")) return;
  syncPretripPurchaseDateBounds();
  if (!validatePretripDate(els.pretripFlightDepartDateInput, "가는 날")) return;
  if (pretripFlightJourney === "roundtrip") {
    if (!validatePretripDate(els.pretripFlightReturnDateInput, "오는 날", false)) return;
    if (els.pretripFlightReturnDateInput.value < els.pretripFlightDepartDateInput.value) return showPretripError("오는 날은 가는 날보다 앞설 수 없어요.", els.pretripFlightReturnDateInput);
    if (!validatePretripDate(els.pretripFlightReturnDateInput, "오는 날")) return;
  }
  const amount = parseFormattedNumber(els.pretripFlightAmountInput.value);
  if (!Number.isSafeInteger(amount) || amount <= 0) return showPretripError("0보다 큰 원화 결제 금액을 입력해 주세요.", els.pretripFlightAmountInput);
  if (!validatePretripDate(els.pretripFlightPaymentDateInput, "결제일", false)) return;
  const airline = els.pretripFlightAirlineInput.value.trim(), flightNumber = els.pretripFlightNumberInput.value.trim(), from = els.pretripFlightFromInput.value.trim(), to = els.pretripFlightToInput.value.trim();
  const departDate = els.pretripFlightDepartDateInput.value, departTime = els.pretripFlightDepartTimeInput.value;
  const returnDate = pretripFlightJourney === "roundtrip" ? els.pretripFlightReturnDateInput.value : "", returnTime = returnDate ? els.pretripFlightReturnDepartTimeInput.value : "";
  const bookingCode = els.pretripFlightBookingCodeInput.value.trim(), memo = els.pretripFlightNoteInput.value.trim();
  const note = [`출발 ${departDate}${departTime ? ` ${departTime}` : ""}`, returnDate ? `복귀 출발 ${returnDate}${returnTime ? ` ${returnTime}` : ""}` : "", bookingCode ? `예약번호 ${bookingCode}` : "", memo].filter(Boolean).join(" · ");
  pretripSubmitting = true; syncPretripOptionsVisibility();
  try { await savePretripEntry({ category: "교통", description: `항공권 · ${[airline, flightNumber].filter(Boolean).join(" ")} · ${from} → ${to}`, amount, note, pretripMemo: memo, ...getPretripPaymentMetadata(true, amount), pretripType: "flight", flightAirline: airline, flightNumber, flightFrom: from, flightTo: to, flightDepartDate: departDate, flightDepartTime: departTime, flightReturnDate: returnDate, flightReturnDepartTime: returnTime, bookingCode }); }
  finally { pretripSubmitting = false; syncPretripOptionsVisibility(); }
}
async function handlePretripHotelSubmit(event) {
  event.preventDefault();
  if (pretripSubmitting || !pretripElement("rdReservation")?.open) return;
  clearPretripError();
  if (!validatePretripField(els.pretripHotelNameInput, "숙소명을 입력해 주세요.")) return;
  const checkIn = els.pretripHotelCheckInInput.value, checkOut = els.pretripHotelCheckOutInput.value;
  syncPretripPurchaseDateBounds();
  if (!validatePretripDate(els.pretripHotelCheckInInput, "체크인 날짜")) return;
  if (!isValidPretripDate(checkOut) || checkOut <= checkIn) return showPretripError("체크아웃은 체크인 다음 날 이후로 선택해 주세요.", els.pretripHotelCheckOutInput);
  if (!validatePretripDate(els.pretripHotelCheckOutInput, "체크아웃 날짜")) return;
  const amount = parseFormattedNumber(els.pretripHotelAmountInput.value);
  if (!Number.isSafeInteger(amount) || amount <= 0) return showPretripError("숙박 전체 원화 결제 금액을 입력해 주세요.", els.pretripHotelAmountInput);
  if (!validatePretripDate(els.pretripHotelPaymentDateInput, "결제일", false)) return;
  const guests = Number(els.pretripHotelGuestsInput.value || 0);
  if (els.pretripHotelGuestsInput.value && (!Number.isInteger(guests) || guests < 1 || guests > 999)) return showPretripError("인원은 1~999 사이의 정수로 입력해 주세요.", els.pretripHotelGuestsInput);
  const hotelName = els.pretripHotelNameInput.value.trim(), roomType = els.pretripHotelRoomInput.value.trim(), bookingCode = els.pretripHotelBookingCodeInput.value.trim(), memo = els.pretripHotelNoteInput.value.trim();
  const note = [`체크인 ${checkIn}`, `체크아웃 ${checkOut}`, `${getPretripHotelNights(checkIn, checkOut)}박`, roomType ? `객실 ${roomType}` : "", guests ? `${guests}명` : "", bookingCode ? `예약번호 ${bookingCode}` : "", memo].filter(Boolean).join(" · ");
  pretripSubmitting = true; syncPretripOptionsVisibility();
  try { await savePretripEntry({ category: "숙소", description: `숙소 예약 · ${hotelName}`, amount, note, pretripMemo: memo, ...getPretripPaymentMetadata(false, amount), pretripType: "hotel", hotelName, hotelCheckIn: checkIn, hotelCheckOut: checkOut, hotelRoomType: roomType, hotelGuests: guests, hotelAddress: els.pretripHotelAddressInput.value.trim(), bookingCode }); }
  finally { pretripSubmitting = false; syncPretripOptionsVisibility(); }
}
function getPretripHotelNights(checkIn, checkOut) {
  if (!isValidPretripDate(checkIn) || !isValidPretripDate(checkOut)) return 0;
  return Math.max(0, Math.round((Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) / 86400000));
}
window.TripLog.register("features.expenses.pretripPurchases", {
  setupPretripPurchaseForms, renderPretripPurchasePanel, setPretripPurchaseMode,
  setPretripOptionsExpanded, openPretripPurchaseMenu, syncPretripPurchaseDateBounds,
  connectDialog: connectPretripPurchaseDialog,
});
