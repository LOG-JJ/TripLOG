function renderHistoryModal() {
  const records = [...historyRecords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  els.historyList.replaceChildren();
  const countLabel=document.querySelector("#rdHistoryCount");
  if(countLabel)countLabel.textContent=`저장한 여행 ${records.length}개`;
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
          <span class="rd-history-period">${escapeHtml(formatHistoryDateRange(savedState))}</span>
          <div class="rd-history-stats"><span><small>일정</small><strong>${Number(savedState.itineraryItems?.length || 0).toLocaleString("ko-KR")}개</strong></span><span><small>지출</small><strong>${formatWon(calculateSnapshotTotal(savedState))}</strong></span></div>
        </div>
      </div>
      <div class="history-actions">
        <button class="load" type="button" data-history-action="load" data-history-id="${escapeHtml(record.id)}"><i class="ph ph-folder-open" aria-hidden="true"></i> 불러오기</button>
        <button class="delete" type="button" data-history-action="delete" data-history-id="${escapeHtml(record.id)}"><i class="ph ph-trash" aria-hidden="true"></i> 삭제</button>
      </div>
    `;
    els.historyList.appendChild(item);
  });
}

window.TripLog.register("features.history.render", {
  renderHistoryModal,
});
