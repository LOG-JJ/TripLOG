function renderHistoryModal() {
  const records = [...historyRecords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  els.historyList.replaceChildren();
  els.historyEmpty.hidden = records.length > 0;

  records.forEach((record) => {
    const savedState = record.state || {};
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-main">
        <div class="history-title-row">
          <strong>${escapeHtml(savedState.tripName || getSnapshotDefaultTripName(savedState))}</strong>
          <span>${savedState.travelMode === "overseas" ? "해외" : "국내"}</span>
        </div>
        <p>${escapeHtml(formatHistoryTimestamp(record.timestamp))}</p>
        <div class="history-meta">
          <span>${escapeHtml(formatHistoryDateRange(savedState))}</span>
          <span>${Number(savedState.entries?.length || 0).toLocaleString("ko-KR")}건</span>
          <span>${formatWon(calculateSnapshotTotal(savedState))}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="history-load" type="button" data-history-action="load" data-history-id="${escapeHtml(record.id)}">불러오기</button>
        <button class="history-delete" type="button" data-history-action="delete" data-history-id="${escapeHtml(record.id)}">삭제</button>
      </div>
    `;
    els.historyList.appendChild(item);
  });
}

window.TripLog.register("features.history.render", {
  renderHistoryModal,
});
