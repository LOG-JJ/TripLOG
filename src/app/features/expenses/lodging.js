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

window.TripLog.register("features.expenses.lodging", {
  isLodgingSplitMode,
  renderExpenseFormMode,
  handleLodgingDateChange,
  syncLodgingDefaults,
  getDefaultLodgingCheckIn,
  syncLodgingDateBounds,
  updateLodgingPreview,
  getLodgingPlan,
  createLodgingEntries,
  formatLodgingNote,
  splitWholeAmount,
  splitDecimalAmount,
  getDateDiffDays,
});
