function exportPdf() {
  buildPrintReport();
  requestAnimationFrame(() => window.print());
}

function buildPrintReport() {
  const days = getTripDays();
  const totals = calculateTotals();
  const tripDayTotal = getTripDayEntryTotal(days);
  const safeTripName = escapeHtml(state.tripName || getDefaultTripName());
  const dateRange = `${formatReadableDate(state.startDate)} - ${formatReadableDate(state.endDate)}`;
  const generatedAt = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const categoryRows = categories
    .map((category) => {
      const amount = totals.byCategory[category.name] || 0;
      const ratio = totals.total ? Math.round((amount / totals.total) * 100) : 0;
      return `<tr><td>${category.name}</td><td class="number">${formatWon(amount)}</td><td class="number">${ratio}%</td></tr>`;
    })
    .join("");

  const expenseRows = getFilteredEntriesForPrint()
    .map((entry) => {
      const day = getExpenseDayMeta(entry.date, days);
      return `
        <tr>
          <td>${escapeHtml(day.label)}</td>
          <td>${escapeHtml(day.shortDate)}</td>
          <td>${escapeHtml(entry.category)}</td>
          <td>${escapeHtml(entry.description)}</td>
          <td class="number">${escapeHtml(formatEntryAmountText(entry))}</td>
          <td>${entry.note ? escapeHtml(entry.note) : "-"}</td>
        </tr>
      `;
    })
    .join("");

  els.printReport.innerHTML = `
    <h1>${safeTripName} 경비 정산</h1>
    <p class="print-meta">${dateRange} · 생성 ${generatedAt}</p>
    <div class="print-grid">
      <div class="print-card"><span>총 지출</span><strong>${formatWon(totals.total)}</strong></div>
      <div class="print-card"><span>여행 기간</span><strong>${days.length}일</strong></div>
      <div class="print-card"><span>기록 수</span><strong>${state.entries.length}건</strong></div>
      <div class="print-card"><span>일차 평균</span><strong>${formatWon(days.length ? Math.round(tripDayTotal / days.length) : 0)}</strong></div>
    </div>
    <h2 class="print-section-title">항목별 합계</h2>
    <table>
      <thead><tr><th>항목</th><th class="number">금액</th><th class="number">비율</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>
    <h2 class="print-section-title">지출 내역</h2>
    <table>
      <thead><tr><th>구분</th><th>날짜</th><th>항목</th><th>내용</th><th class="number">금액</th><th>비고</th></tr></thead>
      <tbody>${expenseRows || '<tr><td colspan="6">기록된 경비가 없습니다.</td></tr>'}</tbody>
    </table>
  `;
}

function getFilteredEntriesForPrint() {
  return [...state.entries].sort((a, b) => {
    const dateDiff = compareExpenseEntryDates(a, b);
    return dateDiff || a.createdAt - b.createdAt;
  });
}

window.TripLog.register("features.print.export", {
  exportPdf,
  buildPrintReport,
  getFilteredEntriesForPrint,
});
