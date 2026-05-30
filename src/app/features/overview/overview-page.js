/* 👥 6-Tab App Navigation, Overview, Settlement, and Report Page Renderers */

// 1. Overview Page Renderer
function renderOverviewPage() {
  const overviewModeSticker = document.querySelector("#overviewModeSticker");
  if (overviewModeSticker) {
    overviewModeSticker.textContent = state.travelMode === "domestic" ? "국내 여행" : "해외 여행";
    overviewModeSticker.className = `budget-sticker ${state.travelMode === "domestic" ? "safe" : "warning"}`;
  }

  const packingList = state.packingList || [];
  const totalPacking = packingList.length;
  const packedCount = packingList.filter(item => item.checked).length;
  const packingPercent = totalPacking > 0 ? Math.round((packedCount / totalPacking) * 100) : 0;
  
  const overviewPackingProgress = document.querySelector("#overviewPackingProgress");
  const overviewPackingPercent = document.querySelector("#overviewPackingPercent");
  if (overviewPackingProgress) {
    overviewPackingProgress.textContent = `${packedCount} / ${totalPacking}`;
  }
  if (overviewPackingPercent) {
    overviewPackingPercent.textContent = `${packingPercent}%`;
    overviewPackingPercent.style.backgroundColor = packingPercent === 100 ? "#d1fae5" : "#ffe45c";
  }

  const totals = calculateTotals();
  const totalSpent = totals.total;
  const overviewTotalSpent = document.querySelector("#overviewTotalSpent");
  const overviewExpenseCount = document.querySelector("#overviewExpenseCount");
  
  if (overviewTotalSpent) {
    overviewTotalSpent.textContent = formatCurrency(totalSpent);
  }
  if (overviewExpenseCount) {
    overviewExpenseCount.textContent = `${state.entries.length}건`;
  }
}


window.TripLog.register("features.overview.page", {
  renderOverviewPage,
});
