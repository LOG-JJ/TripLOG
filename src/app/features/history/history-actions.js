async function handleHistoryAction(event) {
  const button = event.target.closest("button[data-history-action]");
  if (!button) return;

  const record = historyRecords.find((item) => item.id === button.dataset.historyId);
  if (!record) return;

  if (button.dataset.historyAction === "load") {
    const ok = await (window.TripLog.features.redesign?.workspace?.confirmAction?.("선택한 기록을 별도 여행으로 복원할까요?") ?? window.confirm("선택한 기록을 별도 여행으로 복원할까요?"));
    if (!ok) return;
    try { if (await restoreSnapshot(record.state)) closeHistoryModal(); }
    catch (error) { showToast(error.message || "복원하지 못했습니다. 기존 기록은 보존됩니다."); }
  }

  if (button.dataset.historyAction === "delete") {
    const ok = await (window.TripLog.features.redesign?.workspace?.confirmAction?.("이 저장 기록을 삭제할까요?") ?? window.confirm("이 저장 기록을 삭제할까요?"));
    if (!ok) return;
    historyRecords = historyRecords.filter((item) => item.id !== record.id);
    saveHistoryRecords();
    deleteArchiveRecord(record.id).catch((error) => console.warn("Archive delete failed:", error));
    renderHistoryModal();
  }
}

async function restoreSnapshot(snapshot) {
  const nextState = normalizeSnapshot(snapshot);
  if (window.TripLogSyncModel) {
    nextState.id = window.TripLogSyncModel.uuid();
    nextState.tripName = `${nextState.tripName || "여행"} (복원 사본)`;
    nextState.collaboration = normalizeCollaborationSettings({ ownerId: window.TripLog.sync.controller.engine.status().accountId });
  }
  editingId = null;
  editingItineraryId = null;
  activeFilter = "전체";
  // A restore creates a separate trip; pending edits on the original remain intact.
  await window.TripLog.persistence.stateStorage.importSharedTripSnapshot(nextState, { makeActive: true });
  state.selectedDate = nextState.selectedDate;
  state.selectedItineraryDate = nextState.selectedItineraryDate;
  state.selectedItineraryId = nextState.selectedItineraryId;
  if (!await saveStateSilently()) return false;
  document.querySelectorAll(".segmented button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === activeFilter);
  });
  render();
  return true;
}

function normalizeSnapshot(snapshot) {
  const travelMode = snapshot?.travelMode === "overseas" ? "overseas" : "domestic";
  const preferredCurrency = currencies.find((currency) => currency.code === snapshot?.currencyCode) || currencies[0];
  const snapshotTripName =
    typeof snapshot?.tripName === "string" && !isLegacyDefaultTripName(snapshot.tripName) ? snapshot.tripName : "";
  const restoredTripId = snapshot?.id || state.id || getActiveTripId() || "trip_default";
  return {
    id: restoredTripId,
    tripName: snapshotTripName,
    country: snapshot?.country || (travelMode === "domestic" ? "대한민국" : ""),
    countryCode: String(snapshot?.countryCode || (travelMode === "domestic" ? "KR" : "")).toUpperCase(),
    city: snapshot?.city || "",
    travelMode,
    theme: normalizeThemeName(snapshot?.theme || state.theme),
    currencyCode: preferredCurrency.code,
    currencySymbol: snapshot?.currencySymbol || preferredCurrency.symbol,
    currencyUnit: snapshot?.currencyUnit || preferredCurrency.unit,
    exchangeBase: Number(snapshot?.exchangeBase || preferredCurrency.rateBase || 1),
    exchangeRate: Number(snapshot?.exchangeRate || getDefaultExchangeRateForCurrency(preferredCurrency.code)),
    startDate: snapshot?.startDate || "2026-06-09",
    endDate: snapshot?.endDate || snapshot?.startDate || "2026-06-09",
    selectedDate: snapshot?.selectedDate || snapshot?.startDate || "2026-06-09",
    selectedItineraryDate: snapshot?.selectedItineraryDate || snapshot?.selectedDate || snapshot?.startDate || "2026-06-09",
    selectedItineraryId: snapshot?.selectedItineraryId || "",
    totalBudget: Number(snapshot?.totalBudget || 0),
    entries: Array.isArray(snapshot?.entries) ? snapshot.entries : [],
    itineraryItems: Array.isArray(snapshot?.itineraryItems) ? snapshot.itineraryItems : [],
    travelCompanion: normalizeTravelCompanion(snapshot?.travelCompanion, snapshot?.itineraryItems || []),
    packingList: Array.isArray(snapshot?.packingList) ? snapshot.packingList : getDefaultPackingList(),
    companions: Array.isArray(snapshot?.companions) ? snapshot.companions : [],
    settlement: normalizeSettlementSettings(snapshot?.settlement),
    collaboration: normalizeCollaborationSettings(snapshot?.collaboration),
    ...(snapshot?._syncRecovery ? { _syncRecovery: window.TripLogSyncModel.clone(snapshot._syncRecovery) } : {}),
  };
}

window.TripLog.register("features.history.actions", {
  handleHistoryAction,
  restoreSnapshot,
  normalizeSnapshot,
});
