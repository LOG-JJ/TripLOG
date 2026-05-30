const state = loadState();
let historyRecords = loadHistoryRecords();

window.TripLog.register("core.state", {
  state,
  get historyRecords() { return historyRecords; },
  set historyRecords(value) { historyRecords = value; },
});

init();
