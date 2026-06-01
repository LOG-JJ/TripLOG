function updateTripDate(field, value) {
  if (!value) return;
  state[field] = value;

  if (new Date(state.startDate) > new Date(state.endDate)) {
    if (field === "startDate") state.endDate = state.startDate;
    if (field === "endDate") state.startDate = state.endDate;
  }

  const days = getTripDays();
  if (!isPreTripExpenseDate(state.selectedDate) && !days.some((day) => day.date === state.selectedDate)) {
    state.selectedDate = days[0]?.date || state.startDate;
  }

  if (!days.some((day) => day.date === state.selectedItineraryDate)) {
    state.selectedItineraryDate = days[0]?.date || state.startDate;
  }

  els.startDateInput.value = state.startDate;
  els.endDateInput.value = state.endDate;
  saveAndRender();
}

function getTripDays(sourceState = state) {
  return getTripDaysForRange(sourceState?.startDate, sourceState?.endDate);
}

function getTripDaysForRange(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
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

function getPreTripExpenseDay() {
  return {
    index: 0,
    date: PRE_TRIP_EXPENSE_DATE,
    label: PRE_TRIP_EXPENSE_LABEL,
    shortDate: PRE_TRIP_EXPENSE_SHORT_DATE,
    weekday: PRE_TRIP_EXPENSE_WEEKDAY,
    isPreTrip: true,
  };
}

function isPreTripExpenseDate(value) {
  return value === PRE_TRIP_EXPENSE_DATE;
}

function getExpenseDayOptions(days = getTripDays()) {
  return [getPreTripExpenseDay(), ...(Array.isArray(days) ? days : [])];
}

function getExpenseDayMeta(value, days = getTripDays()) {
  if (isPreTripExpenseDate(value)) return getPreTripExpenseDay();
  const matchedDay = Array.isArray(days) ? days.find((day) => day.date === value) : null;
  if (matchedDay) return matchedDay;

  return {
    index: 0,
    date: value || "",
    label: "-",
    shortDate: formatShortDate(parseDate(value)),
    weekday: "",
    isUnknown: true,
  };
}

function getExpenseDateSortKey(value) {
  if (isPreTripExpenseDate(value)) return "0000-00-00";
  return parseDate(value) ? value : "9999-12-31";
}

function compareExpenseEntryDates(a, b) {
  return getExpenseDateSortKey(a?.date).localeCompare(getExpenseDateSortKey(b?.date));
}

function getTripDayEntryTotal(days = getTripDays(), entries = state.entries) {
  const dayDates = new Set((Array.isArray(days) ? days : []).map((day) => day.date));
  return (Array.isArray(entries) ? entries : []).reduce((sum, entry) => (
    dayDates.has(entry.date) ? sum + Number(entry.amount || 0) : sum
  ), 0);
}

function getPreTripEntryTotal(entries = state.entries) {
  return (Array.isArray(entries) ? entries : []).reduce((sum, entry) => (
    isPreTripExpenseDate(entry.date) ? sum + Number(entry.amount || 0) : sum
  ), 0);
}

window.TripLog.register("navigation.tripDates", {
  updateTripDate,
  getTripDays,
  getTripDaysForRange,
  getPreTripExpenseDay,
  isPreTripExpenseDate,
  getExpenseDayOptions,
  getExpenseDayMeta,
  getExpenseDateSortKey,
  compareExpenseEntryDates,
  getTripDayEntryTotal,
  getPreTripEntryTotal,
});
