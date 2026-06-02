function loadHistoryRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((record) => record?.id && record?.timestamp && record?.state)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch {
    return [];
  }
}

function saveHistoryRecords() {
  writeLegacyArchiveMirror(historyRecords);
  renderStorageStatus();
}

async function refreshHistoryRecordsFromDb({ renderModal = false } = {}) {
  try {
    historyRecords = await loadArchiveRecords();
    writeLegacyArchiveMirror(historyRecords);
    renderStorageStatus();
    if (renderModal) renderHistoryModal();
    return historyRecords;
  } catch (error) {
    console.warn("Archive refresh failed:", error);
    renderStorageStatus("IndexedDB 동기화에 실패했습니다. localStorage 미러를 사용합니다.");
    return historyRecords;
  }
}

function saveCurrentSnapshot() {
  const snapshot = getStateSnapshot();
  const record = createArchiveRecord(snapshot, "manual");

  historyRecords = [record, ...historyRecords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  try {
    saveHistoryRecords();
    renderHistoryModal();
    flashSaveStateButton();
    saveArchiveRecord(record)
      .then(() => refreshHistoryRecordsFromDb({ renderModal: !els.historyModal.hidden }))
      .catch((error) => {
        console.warn("IndexedDB save failed:", error);
        renderStorageStatus("IndexedDB 저장에 실패해 localStorage 미러만 갱신했습니다.");
      });
  } catch {
    window.alert("브라우저 저장 공간이 부족해 현재 기록을 저장하지 못했습니다.");
  }
}

async function exportHistoryJson() {
  const records = await refreshHistoryRecordsFromDb();
  downloadArchiveJson(buildArchiveExportPayload(records));
  updateStorageNote("JSON 백업 파일을 생성했습니다.");
}

function requestImportHistoryJson() {
  els.settingsImportJsonInput?.click();
}

async function handleImportHistoryJson() {
  const file = els.settingsImportJsonInput?.files?.[0];
  if (!file) return;

  try {
    const imported = await importArchiveJsonFile(file);
    await refreshHistoryRecordsFromDb({ renderModal: !els.historyModal.hidden });
    updateStorageNote(`${imported.length.toLocaleString("ko-KR")}개 저장 기록을 불러왔습니다.`);
  } catch (error) {
    window.alert(error?.message || "JSON 파일을 불러오지 못했습니다.");
  } finally {
    if (els.settingsImportJsonInput) els.settingsImportJsonInput.value = "";
  }
}

async function clearAllHistoryRecords() {
  historyRecords = [];
  saveHistoryRecords();
  await clearArchiveRecords();
  renderHistoryModal();
  updateStorageNote("저장 기록을 모두 초기화했습니다.");
}

function renderStorageStatus(message = "") {
  if (!els.settingsStorageSummary && !els.settingsStorageTitle) return;
  const activeTripId = typeof getActiveTripId === "function" ? getActiveTripId() : state.id;
  const storedTrips = typeof getTrips === "function" ? getTrips() : [];
  const trips = storedTrips.length
    ? storedTrips.map((trip) => trip.id === activeTripId ? { ...trip, ...state } : trip)
    : [state];
  const savedCount = historyRecords.length;
  const entryCount = trips.reduce((sum, trip) => sum + Number(trip.entries?.length || 0), 0);
  const settlementCount = trips.filter((trip) => hasSettlementRecord(trip)).length;
  if (els.settingsStorageTitle) {
    els.settingsStorageTitle.textContent = isArchiveDbSupported() ? "IndexedDB 로컬 저장소" : "localStorage 저장소";
  }
  if (els.settingsStorageSummary) {
    els.settingsStorageSummary.textContent = message
      || `여행 ${trips.length.toLocaleString("ko-KR")}개 · 지출 ${entryCount.toLocaleString("ko-KR")}건 · 정산 ${settlementCount.toLocaleString("ko-KR")}개 · 저장 ${savedCount.toLocaleString("ko-KR")}개`;
  }
}

function hasSettlementRecord(trip) {
  const companions = Array.isArray(trip?.companions) ? trip.companions : [];
  const settlement = trip?.settlement && typeof trip.settlement === "object" ? trip.settlement : {};
  return companions.length > 0
    || Object.keys(settlement.customShares || {}).length > 0
    || Object.keys(settlement.itemSplits || {}).length > 0;
}

function updateStorageNote(message) {
  if (!els.settingsStorageNote || !message) return;
  els.settingsStorageNote.textContent = message;
  window.setTimeout(() => {
    if (els.settingsStorageNote) {
      els.settingsStorageNote.textContent = "여행, 지출, 정산 설정은 브라우저 IndexedDB에 저장되고 JSON으로 백업할 수 있습니다.";
    }
  }, 2200);
}

function flashSaveStateButton() {
  const label = els.saveStateButton.querySelector("span") || els.saveStateButton;
  const original = label.textContent;
  label.textContent = "저장됨";
  els.saveStateButton.classList.add("saved");
  window.setTimeout(() => {
    label.textContent = original;
    els.saveStateButton.classList.remove("saved");
  }, 1400);
}

window.TripLog.register("features.history.store", {
  loadHistoryRecords,
  saveHistoryRecords,
  refreshHistoryRecordsFromDb,
  saveCurrentSnapshot,
  exportHistoryJson,
  requestImportHistoryJson,
  handleImportHistoryJson,
  clearAllHistoryRecords,
  renderStorageStatus,
  flashSaveStateButton,
});
