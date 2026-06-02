let activePretripPurchaseMode = "flight";

function normalizePretripPurchaseMode(mode = "") {
  return mode === "hotel" ? "hotel" : "flight";
}

function setupPretripPurchaseForms() {
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

function syncPretripPurchaseDefaults() {
  if (els.pretripFlightDepartDateInput && !els.pretripFlightDepartDateInput.value) {
    els.pretripFlightDepartDateInput.value = state.startDate || "";
    syncCustomDatePicker(els.pretripFlightDepartDateInput);
  }

  if (els.pretripFlightReturnDateInput && !els.pretripFlightReturnDateInput.value) {
    els.pretripFlightReturnDateInput.value = state.endDate || "";
    syncCustomDatePicker(els.pretripFlightReturnDateInput);
  }

  if (els.pretripHotelCheckInInput && !els.pretripHotelCheckInInput.value) {
    els.pretripHotelCheckInInput.value = state.startDate || "";
    syncCustomDatePicker(els.pretripHotelCheckInInput);
  }

  if (els.pretripHotelCheckOutInput && !els.pretripHotelCheckOutInput.value) {
    els.pretripHotelCheckOutInput.value = state.endDate || "";
    syncCustomDatePicker(els.pretripHotelCheckOutInput);
  }
}

function setPretripPurchaseMode(mode, { skipFocus = false } = {}) {
  activePretripPurchaseMode = normalizePretripPurchaseMode(mode);
  const isFlight = activePretripPurchaseMode === "flight";

  els.pretripFlightTab?.classList.toggle("active", isFlight);
  els.pretripHotelTab?.classList.toggle("active", !isFlight);
  els.pretripFlightTab?.setAttribute("aria-pressed", String(isFlight));
  els.pretripHotelTab?.setAttribute("aria-pressed", String(!isFlight));

  if (els.pretripFlightForm) els.pretripFlightForm.hidden = !isFlight;
  if (els.pretripHotelForm) els.pretripHotelForm.hidden = isFlight;

  if (!skipFocus) {
    const focusTarget = isFlight ? els.pretripFlightAirlineInput : els.pretripHotelNameInput;
    focusTarget?.focus();
  }
}

function openPretripPurchaseMenu(mode = "flight") {
  activePretripPurchaseMode = normalizePretripPurchaseMode(mode);
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
  openPretripPurchaseMenu,
});
