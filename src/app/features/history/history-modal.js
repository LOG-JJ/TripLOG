function openHistoryModal() {
  historyRecords = loadHistoryRecords();
  renderHistoryModal();
  els.historyModal.hidden = false;
  document.body.classList.add("modal-open");
  els.historyCloseButton.focus();
  refreshHistoryRecordsFromDb({ renderModal: true });
}

function closeHistoryModal() {
  els.historyModal.hidden = true;
  document.body.classList.remove("modal-open");
}


window.TripLog.register("features.history.modal", {
  openHistoryModal,
  closeHistoryModal,
});
