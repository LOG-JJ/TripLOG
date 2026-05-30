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

window.TripLog.register("navigation.tripDates", {
  updateTripDate,
  getTripDays,
});
