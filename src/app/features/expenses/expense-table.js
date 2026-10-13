function renderDaySelect(days) {
  els.daySelect.replaceChildren();
  const options = getExpenseDayOptions(days);

  options.forEach((day) => {
    const option = document.createElement("option");
    option.value = day.date;
    option.textContent = formatExpenseDayOptionLabel(day);
    els.daySelect.appendChild(option);
  });

  if (options.length === 0) {
    const option = document.createElement("option");
    option.textContent = "일정 없음";
    option.value = "";
    els.daySelect.appendChild(option);
  }

  const hasSelectedDate = options.some((day) => day.date === state.selectedDate);
  els.daySelect.value = hasSelectedDate ? state.selectedDate : days[0]?.date || PRE_TRIP_EXPENSE_DATE;
  els.daySelect.disabled = options.length === 0;
  syncCustomSelect(els.daySelect, { rebuild: true });
}

function formatExpenseDayOptionLabel(day) {
  if (day.isPreTrip) return day.label;
  const dayNumber = day.index || String(day.label || "").replace(/[^0-9]/g, "");
  const shortDate = /^\d{4}-\d{2}-\d{2}$/.test(day.date || '')
    ? `${Number(day.date.slice(5, 7))}.${Number(day.date.slice(8, 10))}` : day.shortDate;
  return `Day ${dayNumber} · ${shortDate}`;
}



window.TripLog.register("features.expenses.table", {
  renderDaySelect,
});
