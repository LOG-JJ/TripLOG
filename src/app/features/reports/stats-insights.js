function renderStatsInsights(totals, days) {
  if (state.entries.length === 0) {
    els.statMaxExpenseItem.textContent = "-";
    els.statMaxExpenseAmount.textContent = "0원";
    els.statDailyAverage.textContent = "0원";
    return;
  }
  
  const maxEntry = [...state.entries].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  if (maxEntry) {
    els.statMaxExpenseItem.textContent = maxEntry.description || maxEntry.category;
    els.statMaxExpenseAmount.textContent = formatWon(maxEntry.amount);
  } else {
    els.statMaxExpenseItem.textContent = "-";
    els.statMaxExpenseAmount.textContent = "0원";
  }
  
  const activeDays = days.length || 1;
  const dailyAvg = Math.round(totals.total / activeDays);
  els.statDailyAverage.textContent = formatWon(dailyAvg);
}


window.TripLog.register("features.reports.statsInsights", {
  renderStatsInsights,
});
