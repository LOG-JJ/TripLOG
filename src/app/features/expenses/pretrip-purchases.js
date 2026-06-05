let activePretripPurchaseMode = "flight";
let isPretripOptionsExpanded = true;

function normalizePretripPurchaseMode(mode = "") {
  return mode === "hotel" ? "hotel" : "flight";
}

function setupPretripPurchaseForms() {
  els.pretripOptionsToggleButton?.addEventListener("click", () => {
    setPretripOptionsExpanded(!isPretripOptionsExpanded);
  });

  els.pretripPurchaseTabs?.querySelectorAll("button[data-pretrip-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      setPretripPurchaseMode(button.dataset.pretripMode);
    });
  });

  els.pretripFlightForm?.addEventListener("submit", handlePretripFlightSubmit);
  els.pretripHotelForm?.addEventListener("submit", handlePretripHotelSubmit);

  [
    els.pretripFlightDepartDateInput,
    els.pretripFlightReturnDateInput,
    els.pretripHotelCheckInInput,
    els.pretripHotelCheckOutInput,
  ].forEach((input) => {
    if (input && typeof setupCustomDatePicker === "function") setupCustomDatePicker(input);
  });

  els.pretripFlightDepartDateInput?.addEventListener("change", syncPretripPurchaseDefaults);
  els.pretripFlightReturnDateInput?.addEventListener("change", syncPretripPurchaseDefaults);
  els.pretripHotelCheckInInput?.addEventListener("change", () => handlePretripHotelDateChange("checkIn"));
  els.pretripHotelCheckOutInput?.addEventListener("change", () => handlePretripHotelDateChange("checkOut"));

  [
    els.pretripFlightDepartTimeInput,
    els.pretripFlightReturnDepartTimeInput,
  ].forEach((input) => {
    if (input && typeof setupCustomTimePicker === "function") setupCustomTimePicker(input);
  });
}

function renderPretripPurchasePanel() {
  if (!els.pretripPurchasePanel) return;

  const shouldShow = state.selectedDate === PRE_TRIP_EXPENSE_DATE && !editingId;
  els.pretripPurchasePanel.hidden = !shouldShow;
  if (!shouldShow) return;

  syncPretripPurchaseDefaults();
  setPretripPurchaseMode(activePretripPurchaseMode, { skipFocus: true });
}

function setPretripOptionsExpanded(isExpanded, { skipFocus = false } = {}) {
  isPretripOptionsExpanded = Boolean(isExpanded);
  if (!isPretripOptionsExpanded) {
    if (typeof closeAllCustomDatePickers === "function") closeAllCustomDatePickers();
    if (typeof closeAllCustomTimePickers === "function") closeAllCustomTimePickers();
  }
  syncPretripOptionsVisibility({ skipFocus });
}

function syncPretripOptionsVisibility({ skipFocus = true } = {}) {
  const isFlight = activePretripPurchaseMode === "flight";

  els.pretripPurchasePanel?.classList.toggle("is-options-collapsed", !isPretripOptionsExpanded);

  if (els.pretripOptionsToggleButton) {
    const label = isPretripOptionsExpanded ? "옵션 닫기" : "옵션 열기";
    els.pretripOptionsToggleButton.setAttribute("aria-expanded", String(isPretripOptionsExpanded));
    els.pretripOptionsToggleButton.setAttribute("aria-label", `사전구매 ${label}`);
    const text = els.pretripOptionsToggleButton.querySelector(".pretrip-options-toggle-text");
    if (text) text.textContent = label;
  }

  if (els.pretripFlightForm) els.pretripFlightForm.hidden = !isPretripOptionsExpanded || !isFlight;
  if (els.pretripHotelForm) els.pretripHotelForm.hidden = !isPretripOptionsExpanded || isFlight;

  if (isPretripOptionsExpanded && !skipFocus) {
    const focusTarget = isFlight ? els.pretripFlightAirlineInput : els.pretripHotelNameInput;
    focusTarget?.focus();
  }
}

function syncPretripPurchaseDefaults() {
  syncPretripPurchaseDateBounds();

  syncPretripDateValue(els.pretripFlightDepartDateInput, state.startDate);
  syncPretripDateValue(els.pretripFlightReturnDateInput, state.endDate);
  syncPretripDateValue(els.pretripHotelCheckInInput, state.startDate);
  syncPretripPurchaseDateBounds();
  syncPretripDateValue(els.pretripHotelCheckOutInput, state.endDate);
  syncPretripPurchaseDateBounds();
}

function handlePretripHotelDateChange(changedField) {
  const checkIn = parseDate(els.pretripHotelCheckInInput?.value);
  const checkOut = parseDate(els.pretripHotelCheckOutInput?.value);

  if (changedField === "checkIn" && checkIn && (!checkOut || checkOut <= checkIn)) {
    els.pretripHotelCheckOutInput.value = toInputDate(addDays(checkIn, 1));
  }

  syncPretripPurchaseDefaults();
}

function syncPretripPurchaseDateBounds() {
  const tripStart = parseDate(state.startDate);
  const tripEnd = parseDate(state.endDate);
  if (!tripStart || !tripEnd) return;

  setPretripDateBounds(els.pretripFlightDepartDateInput, tripStart, tripEnd);
  setPretripDateBounds(els.pretripFlightReturnDateInput, tripStart, tripEnd);

  const hotelCheckIn = parseDate(els.pretripHotelCheckInInput?.value);
  const checkInMax = tripStart < tripEnd ? addDays(tripEnd, -1) : tripEnd;
  const checkOutMin = hotelCheckIn ? addDays(hotelCheckIn, 1) : addDays(tripStart, 1);

  setPretripDateBounds(els.pretripHotelCheckInInput, tripStart, checkInMax);
  setPretripDateBounds(els.pretripHotelCheckOutInput, checkOutMin, tripEnd);
}

function setPretripDateBounds(input, minDate, maxDate) {
  if (!input) return;
  input.min = toInputDate(minDate);
  input.max = toInputDate(maxDate);
  syncCustomDatePicker(input);
}

function syncPretripDateValue(input, fallbackValue) {
  if (!input) return;
  const nextValue = getPretripDateWithinBounds(input, fallbackValue);
  if (nextValue !== input.value) {
    input.value = nextValue;
  }
  syncCustomDatePicker(input);
}

function getPretripDateWithinBounds(input, fallbackValue) {
  const currentDate = parseDate(input.value);
  if (currentDate && !isDateOutsideInputBounds(input, input.value)) return input.value;

  const minDate = parseDate(input.min);
  const maxDate = parseDate(input.max);
  let nextDate = parseDate(fallbackValue) || minDate || maxDate;
  if (!nextDate) return input.value || "";
  if (minDate && nextDate < minDate) nextDate = minDate;
  if (maxDate && nextDate > maxDate) nextDate = maxDate;
  return toInputDate(nextDate);
}

function setPretripPurchaseMode(mode, { skipFocus = false } = {}) {
  activePretripPurchaseMode = normalizePretripPurchaseMode(mode);
  const isFlight = activePretripPurchaseMode === "flight";

  els.pretripFlightTab?.classList.toggle("active", isFlight);
  els.pretripHotelTab?.classList.toggle("active", !isFlight);
  els.pretripFlightTab?.setAttribute("aria-pressed", String(isFlight));
  els.pretripHotelTab?.setAttribute("aria-pressed", String(!isFlight));

  syncPretripOptionsVisibility({ skipFocus });
}

function openPretripPurchaseMenu(mode = "flight") {
  activePretripPurchaseMode = normalizePretripPurchaseMode(mode);
  isPretripOptionsExpanded = true;
  state.selectedDate = PRE_TRIP_EXPENSE_DATE;
  if (els.daySelect) els.daySelect.value = PRE_TRIP_EXPENSE_DATE;

  setActivePage("budget");
  setFilter(activePretripPurchaseMode === "hotel" ? "숙소" : "교통");
  renderPretripPurchasePanel();

  window.setTimeout(() => {
    els.pretripPurchasePanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    setPretripPurchaseMode(activePretripPurchaseMode);
  }, PAGE_TRANSITION_MS + 80);
}

function handlePretripFlightSubmit(event) {
  event.preventDefault();

  const amount = Math.max(0, parseFormattedNumber(els.pretripFlightAmountInput?.value));
  const airline = els.pretripFlightAirlineInput?.value.trim() || "";
  const from = els.pretripFlightFromInput?.value.trim() || "";
  const to = els.pretripFlightToInput?.value.trim() || "";
  if (!amount || !airline || !from || !to) return;

  const flightNumber = els.pretripFlightNumberInput?.value.trim() || "";
  const departDate = els.pretripFlightDepartDateInput?.value || "";
  const departTime = els.pretripFlightDepartTimeInput?.value || "";
  const returnDate = els.pretripFlightReturnDateInput?.value || "";
  const returnDepartTime = els.pretripFlightReturnDepartTimeInput?.value || "";
  const bookingCode = els.pretripFlightBookingCodeInput?.value.trim() || "";
  const memo = els.pretripFlightNoteInput?.value.trim() || "";

  const titleParts = [airline, flightNumber].filter(Boolean).join(" ");
  const routeText = [from, to].filter(Boolean).join(" → ");
  const noteParts = [
    departDate ? `출발 ${departDate}${departTime ? ` ${departTime}` : ""}` : "",
    returnDate ? `복귀 출발 ${returnDate}${returnDepartTime ? ` ${returnDepartTime}` : ""}` : "",
    bookingCode ? `예약번호 ${bookingCode}` : "",
    memo,
  ].filter(Boolean);

  state.entries.push({
    id: createId(),
    date: PRE_TRIP_EXPENSE_DATE,
    category: "교통",
    description: `항공권 · ${titleParts || "항공편"} · ${routeText}`,
    amount,
    note: noteParts.join(" · "),
    mode: state.travelMode === "overseas" ? "overseas" : "domestic",
    currency: "",
    currencySymbol: "",
    currencyUnit: "",
    exchangeBase: 1,
    foreignAmount: 0,
    exchangeRate: 0,
    pretripType: "flight",
    flightAirline: airline,
    flightNumber,
    flightFrom: from,
    flightTo: to,
    flightDepartDate: departDate,
    flightDepartTime: departTime,
    flightReturnDate: returnDate,
    flightReturnDepartTime: returnDepartTime,
    bookingCode,
    createdAt: Date.now(),
  });

  els.pretripFlightForm.reset();
  syncPretripPurchaseDefaults();
  saveAndRender();
  if (typeof showToast === "function") showToast("항공권 사전구매가 등록되었습니다.");
}

function handlePretripHotelSubmit(event) {
  event.preventDefault();

  const amount = Math.max(0, parseFormattedNumber(els.pretripHotelAmountInput?.value));
  const hotelName = els.pretripHotelNameInput?.value.trim() || "";
  const checkIn = els.pretripHotelCheckInInput?.value || "";
  const checkOut = els.pretripHotelCheckOutInput?.value || "";
  if (!amount || !hotelName || !checkIn || !checkOut) return;

  syncPretripPurchaseDateBounds();
  if (isDateOutsideInputBounds(els.pretripHotelCheckInInput, checkIn) || isDateOutsideInputBounds(els.pretripHotelCheckOutInput, checkOut)) {
    window.alert("숙소 기간은 전체 여행 일정 안에서 선택해 주세요.");
    return;
  }

  if (checkIn >= checkOut) {
    window.alert("체크아웃은 체크인보다 늦어야 합니다.");
    return;
  }

  const roomType = els.pretripHotelRoomInput?.value.trim() || "";
  const guests = Math.max(0, Number(els.pretripHotelGuestsInput?.value || 0));
  const bookingCode = els.pretripHotelBookingCodeInput?.value.trim() || "";
  const memo = els.pretripHotelNoteInput?.value.trim() || "";
  const nights = getPretripHotelNights(checkIn, checkOut);
  const noteParts = [
    `체크인 ${checkIn}`,
    `체크아웃 ${checkOut}`,
    nights > 0 ? `${nights}박` : "",
    roomType ? `객실 ${roomType}` : "",
    guests > 0 ? `${guests}명` : "",
    bookingCode ? `예약번호 ${bookingCode}` : "",
    memo,
  ].filter(Boolean);

  state.entries.push({
    id: createId(),
    date: PRE_TRIP_EXPENSE_DATE,
    category: "숙소",
    description: `숙소 예약 · ${hotelName}`,
    amount,
    note: noteParts.join(" · "),
    mode: state.travelMode === "overseas" ? "overseas" : "domestic",
    currency: "",
    currencySymbol: "",
    currencyUnit: "",
    exchangeBase: 1,
    foreignAmount: 0,
    exchangeRate: 0,
    pretripType: "hotel",
    hotelName,
    hotelCheckIn: checkIn,
    hotelCheckOut: checkOut,
    hotelRoomType: roomType,
    hotelGuests: guests,
    bookingCode,
    createdAt: Date.now(),
  });

  els.pretripHotelForm.reset();
  syncPretripPurchaseDefaults();
  saveAndRender();
  if (typeof showToast === "function") showToast("숙소 사전구매가 등록되었습니다.");
}

function getPretripHotelNights(checkIn, checkOut) {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

window.TripLog.register("features.expenses.pretripPurchases", {
  setupPretripPurchaseForms,
  renderPretripPurchasePanel,
  setPretripPurchaseMode,
  setPretripOptionsExpanded,
  openPretripPurchaseMenu,
  syncPretripPurchaseDateBounds,
});
