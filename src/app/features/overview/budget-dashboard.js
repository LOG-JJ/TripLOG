function renderBudgetDashboard(totals) {
  const budget = Number(state.totalBudget || 0);
  if (budget <= 0) {
    els.budgetDashboard.hidden = true;
    return;
  }
  els.budgetDashboard.hidden = false;
  
  const spent = totals.total;
  const percent = Math.min(100, Math.round((spent / budget) * 100));
  const remaining = Math.max(0, budget - spent);
  
  els.budgetProgressPercent.textContent = `${percent}%`;
  els.budgetSpentText.textContent = formatWon(spent);
  els.budgetRemainingText.textContent = formatWon(remaining);
  els.budgetProgressBarFill.style.width = `${percent}%`;
  
  const sticker = els.budgetStatusSticker;
  sticker.className = "budget-sticker";
  if (percent >= 100) {
    sticker.textContent = "예산 초과!";
    sticker.classList.add("danger");
  } else if (percent >= 80) {
    sticker.textContent = "지출 경고";
    sticker.classList.add("warning");
  } else {
    sticker.textContent = "예산 안전";
    sticker.classList.add("safe");
  }
}

window.TripLog.register("features.overview.budgetDashboard", {
  renderBudgetDashboard,
});
