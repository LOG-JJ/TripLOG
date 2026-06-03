function exportPdf(type = "expense") {
  buildPrintReport(type);
  requestAnimationFrame(() => window.print());
}

function exportExpensePdf() {
  exportPdf("expense");
}

function exportItineraryPdf() {
  exportPdf("itinerary");
}

function exportFullPdf() {
  exportPdf("full");
}

function buildPrintReport(type = "expense") {
  const reportType = ["expense", "itinerary", "full"].includes(type) ? type : "expense";
  const safeTripName = escapeHtml(state.tripName || getDefaultTripName());
  const titleMap = {
    expense: `${safeTripName} 지출 보고서`,
    itinerary: `${safeTripName} 일정 보고서`,
    full: `${safeTripName} 전체 여행 보고서`,
  };
  const sections = {
    expense: buildExpensePrintSections(),
    itinerary: buildItineraryPrintSections(),
    full: `${buildTripSummaryPrintSections()}${buildItineraryPrintSections()}${buildExpensePrintSections()}`,
  };

  els.printReport.dataset.reportType = reportType;
  els.printReport.innerHTML = `
    ${buildPrintHeader(titleMap[reportType])}
    ${sections[reportType]}
  `;
}

function buildPrintHeader(title) {
  const dateRange = `${formatReadableDate(state.startDate)} - ${formatReadableDate(state.endDate)}`;
  return `
    <h1>${title}</h1>
    <p class="print-meta">${dateRange} · 생성 ${getPrintGeneratedAt()}</p>
  `;
}

function getPrintGeneratedAt() {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function buildTripSummaryPrintSections() {
  const days = getTripDays();
  const totals = calculateTotals();
  const destination = [state.country, state.city].filter(Boolean).join(" · ") || "-";
  const itineraryCount = Number(state.itineraryItems?.length || 0);
  const expenseCount = Number(state.entries?.length || 0);

  return `
    <div class="print-grid">
      <div class="print-card"><span>여행지</span><strong>${escapeHtml(destination)}</strong></div>
      <div class="print-card"><span>여행 기간</span><strong>${days.length}일</strong></div>
      <div class="print-card"><span>일정 수</span><strong>${itineraryCount.toLocaleString("ko-KR")}개</strong></div>
      <div class="print-card"><span>총 지출</span><strong>${formatWon(totals.total)}</strong></div>
    </div>
  `;
}

function buildExpensePrintSections() {
  const days = getTripDays();
  const totals = calculateTotals();
  const tripDayTotal = getTripDayEntryTotal(days);

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

  return `
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

function buildItineraryPrintSections() {
  const days = getTripDays();
  const items = getSortedItineraryItemsForPrint();
  const dayRows = days
    .map((day) => {
      const count = items.filter((item) => item.date === day.date).length;
      return `<tr><td>${escapeHtml(day.label)}</td><td>${escapeHtml(day.shortDate)} ${escapeHtml(day.weekday)}</td><td class="number">${count.toLocaleString("ko-KR")}개</td></tr>`;
    })
    .join("");
  const itineraryRows = items
    .map((item) => {
      const day = getExpenseDayMeta(item.date, days);
      return `
        <tr>
          <td>${escapeHtml(day.label)}</td>
          <td>${escapeHtml(day.shortDate)}</td>
          <td>${escapeHtml(formatPrintTimeRange(item))}</td>
          <td>${escapeHtml(item.place || "-")}</td>
          <td>${escapeHtml(item.location || "-")}</td>
          <td>${escapeHtml(formatPrintTransitSummary(item))}</td>
          <td>${item.memo ? escapeHtml(item.memo) : "-"}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="print-grid">
      <div class="print-card"><span>여행 기간</span><strong>${days.length}일</strong></div>
      <div class="print-card"><span>전체 일정</span><strong>${items.length.toLocaleString("ko-KR")}개</strong></div>
      <div class="print-card"><span>시작일</span><strong>${escapeHtml(formatReadableDate(state.startDate))}</strong></div>
      <div class="print-card"><span>종료일</span><strong>${escapeHtml(formatReadableDate(state.endDate))}</strong></div>
    </div>
    <h2 class="print-section-title">일자별 일정 수</h2>
    <table>
      <thead><tr><th>구분</th><th>날짜</th><th class="number">일정</th></tr></thead>
      <tbody>${dayRows || '<tr><td colspan="3">여행 기간이 설정되지 않았습니다.</td></tr>'}</tbody>
    </table>
    <h2 class="print-section-title">일정 내역</h2>
    <table>
      <thead><tr><th>구분</th><th>날짜</th><th>시간</th><th>장소</th><th>주소</th><th>이동</th><th>메모</th></tr></thead>
      <tbody>${itineraryRows || '<tr><td colspan="7">등록된 일정이 없습니다.</td></tr>'}</tbody>
    </table>
  `;
}

function getFilteredEntriesForPrint() {
  return [...state.entries].sort((a, b) => {
    const dateDiff = compareExpenseEntryDates(a, b);
    return dateDiff || a.createdAt - b.createdAt;
  });
}

function getSortedItineraryItemsForPrint() {
  return [...(state.itineraryItems || [])].sort((a, b) => {
    const dateDiff = (a.date || "").localeCompare(b.date || "");
    if (dateDiff) return dateDiff;
    const timeDiff = (a.time || "99:99").localeCompare(b.time || "99:99");
    return timeDiff || Number(a.createdAt || 0) - Number(b.createdAt || 0);
  });
}

function formatPrintTimeRange(item) {
  const start = item?.time || "";
  const end = item?.endTime || "";
  if (start && end) return `${start} - ${end}`;
  return start || end || "-";
}

function formatPrintTransitSummary(item) {
  const segments = Array.isArray(item?.transits) && item.transits.length
    ? item.transits
    : [{ trans: item?.trans || "none", duration: item?.duration || 0, cost: item?.cost || 0, memo: "" }];
  const text = segments
    .map(formatPrintTransitSegment)
    .filter(Boolean)
    .join(" / ");
  return text || "-";
}

function formatPrintTransitSegment(segment) {
  const label = getPrintTransitLabel(segment?.trans);
  const parts = [
    label,
    segment?.duration ? `${Number(segment.duration).toLocaleString("ko-KR")}분` : "",
    segment?.cost ? formatWon(segment.cost) : "",
    segment?.memo || "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function getPrintTransitLabel(trans) {
  switch (trans) {
    case "walk": return "도보";
    case "car": return "차량";
    case "train": return "기차";
    case "bus": return "버스";
    case "flight":
    case "etc": return "비행";
    default: return "";
  }
}

window.TripLog.register("features.print.export", {
  exportPdf,
  exportExpensePdf,
  exportItineraryPdf,
  exportFullPdf,
  buildPrintReport,
  buildExpensePrintSections,
  buildItineraryPrintSections,
  getFilteredEntriesForPrint,
  getSortedItineraryItemsForPrint,
});
