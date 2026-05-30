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
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
}

function saveCurrentSnapshot() {
  const snapshot = getStateSnapshot();
  const record = {
    id: createId(),
    timestamp: new Date().toISOString(),
    state: snapshot,
  };

  historyRecords = [record, ...historyRecords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  try {
    saveHistoryRecords();
    renderHistoryModal();
    flashSaveStateButton();
  } catch {
    window.alert("브라우저 저장 공간이 부족해 현재 기록을 저장하지 못했습니다.");
  }
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
  saveCurrentSnapshot,
  flashSaveStateButton,
});
