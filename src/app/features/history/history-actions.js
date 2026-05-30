function handleHistoryAction(event) {
  const button = event.target.closest("button[data-history-action]");
  if (!button) return;

  const record = historyRecords.find((item) => item.id === button.dataset.historyId);
  if (!record) return;

  if (button.dataset.historyAction === "load") {
    const ok = window.confirm("선택한 저장 기록으로 현재 화면을 덮어쓸까요?");
    if (!ok) return;
    restoreSnapshot(record.state);
    closeHistoryModal();
  }

  if (button.dataset.historyAction === "delete") {
    const ok = window.confirm("이 저장 기록을 삭제할까요?");
    if (!ok) return;
    historyRecords = historyRecords.filter((item) => item.id !== record.id);
    saveHistoryRecords();
    renderHistoryModal();
  }
}

function restoreSnapshot(snapshot) {
  const nextState = normalizeSnapshot(snapshot);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, nextState);
  editingId = null;
  activeFilter = "전체";
  els.budgetInput.value = state.totalBudget || "";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.querySelectorAll(".segmented button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === activeFilter);
  });
  render();
}

function normalizeSnapshot(snapshot) {
  const travelMode = snapshot?.travelMode === "overseas" ? "overseas" : "domestic";
  const snapshotTripName =
    typeof snapshot?.tripName === "string" && !isLegacyDefaultTripName(snapshot.tripName) ? snapshot.tripName : "";
  return {
    tripName: snapshotTripName,
    travelMode,
    startDate: snapshot?.startDate || "2026-06-09",
    endDate: snapshot?.endDate || snapshot?.startDate || "2026-06-09",
    selectedDate: snapshot?.selectedDate || snapshot?.startDate || "2026-06-09",
    selectedItineraryDate: snapshot?.selectedItineraryDate || snapshot?.selectedDate || snapshot?.startDate || "2026-06-09",
    selectedItineraryId: snapshot?.selectedItineraryId || "",
    totalBudget: Number(snapshot?.totalBudget || 0),
    entries: Array.isArray(snapshot?.entries) ? snapshot.entries : [],
    itineraryItems: Array.isArray(snapshot?.itineraryItems) ? snapshot.itineraryItems : [],
    packingList: Array.isArray(snapshot?.packingList) ? snapshot.packingList : getDefaultPackingList(),
  };
}

window.TripLog.register("features.history.actions", {
  handleHistoryAction,
  restoreSnapshot,
  normalizeSnapshot,
});
