const state = loadState();
let historyRecords = loadHistoryRecords();

window.TripLog.register("core.state", {
  state,
  get historyRecords() { return historyRecords; },
  set historyRecords(value) { historyRecords = value; },
});

window.TripLog.persistence.stateStorage.initializeRepository()
  .catch(error => { window.TripLog.sync.controller?.setLocalFailure(error); })
  .finally(() => { init(); window.TripLog.sync.statusUi.setup(); window.TripLog.sync.drafts.setup(); window.TripLog.sync.lifecycle.setup(); document.documentElement.dataset.triplogInitialized = "true"; });
