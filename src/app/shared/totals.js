function sumEntries(entries) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
}

function calculateSnapshotTotal(snapshot) {
  if (!Array.isArray(snapshot?.entries)) return 0;
  return snapshot.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
}

window.TripLog.register("shared.totals", {
  sumEntries,
  calculateSnapshotTotal,
});
