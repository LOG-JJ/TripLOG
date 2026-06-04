function renderDailySpendTrend(days) {
  const trendDays = getExpenseDayOptions(days || []);

  if (!trendDays || trendDays.length === 0) {
    renderDailyTrendSummary([]);
    els.dailyBarChart.innerHTML = `<div class="chart-empty">여행 기간을 먼저 설정하면 일차별 지출 추이를 볼 수 있습니다.</div>`;
    return;
  }

  const dayTotals = trendDays.map(day => {
    const total = sumEntries(state.entries.filter(entry => entry.date === day.date));
    return { ...day, total, amount: total };
  });

  renderDailyTrendSummary(dayTotals, days || []);

  const totalSpent = sumEntries(dayTotals);
  if (!totalSpent) {
    els.dailyBarChart.innerHTML = `
      <div class="daily-trend-empty">
        <strong>아직 지출 추이 데이터가 없습니다.</strong>
        <span>사전구매나 여행 일차에 금액을 추가하면 이곳에 큰 막대 그래프로 바로 반영됩니다.</span>
      </div>
    `;
    return;
  }

  const maxTotal = Math.max(...dayTotals.map((day) => day.total));
  const niceMax = getNiceChartMax(maxTotal);
  const numBars = dayTotals.length;
  const containerWidth = Math.floor(els.dailyBarChart.getBoundingClientRect().width || els.dailyBarChart.clientWidth || 0);
  const compactChart = containerWidth > 0 && containerWidth < 430;
  const rowHeight = compactChart ? 58 : 64;
  const chartTextFontFamily = "'Plus Jakarta Sans', 'Pretendard', sans-serif";
  const chartNumberFontFamily = "'Outfit', 'Pretendard', sans-serif";
  const labelFontSize = compactChart ? 11 : 12;
  const dateFontSize = compactChart ? 9 : 10;
  const valueFontSize = compactChart ? 10 : 12;
  const tickFontSize = compactChart ? 9 : 10;
  const valueLabels = dayTotals.map((day) => day.total ? formatWonShort(day.total) : "0원");
  const longestValueLabel = valueLabels.reduce((longest, label) => (
    label.length > longest.length ? label : longest
  ), "0원");
  const valuePlateWidth = Math.max(
    compactChart ? 48 : 58,
    estimateDailyValueLabelWidth(longestValueLabel, valueFontSize) + (compactChart ? 16 : 22)
  );
  const valuePlateHeight = compactChart ? 18 : 20;
  const valueEdgePadding = compactChart ? 10 : 18;
  const valueTrackGap = compactChart ? 10 : 16;
  const reservedValueWidth = valuePlateWidth + valueEdgePadding + valueTrackGap + 4;
  const margin = compactChart
    ? { top: 36, right: Math.max(58, reservedValueWidth), bottom: 42, left: 62 }
    : { top: 40, right: Math.max(92, reservedValueWidth), bottom: 44, left: 82 };
  const maxChartWidth = 534;
  const minPlotWidth = compactChart ? 128 : 260;
  const minChartWidth = margin.left + margin.right + minPlotWidth;
  const chartWidth = containerWidth
    ? Math.max(minChartWidth, Math.min(maxChartWidth, Math.max(compactChart ? 286 : maxChartWidth, containerWidth - 4)))
    : maxChartWidth;
  const plotWidth = Math.max(minPlotWidth, chartWidth - margin.left - margin.right);
  const chartHeight = margin.top + numBars * rowHeight + margin.bottom;
  const barHeight = compactChart ? 24 : 28;
  const minBarWidth = compactChart ? 28 : 36;
  const valueX = chartWidth - valueEdgePadding;
  const highestDay = dayTotals.reduce((best, day) => (day.total > best.total ? day : best), dayTotals[0]);

  let svgContent = `
    <svg class="daily-trend-chart daily-trend-chart-horizontal" width="100%" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="일차별 지출 추이" style="height: ${chartHeight}px;">
      <rect x="0" y="0" width="${chartWidth}" height="${chartHeight}" rx="16" fill="#fffdf7" />
  `;

  [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
    const x = margin.left + tick * plotWidth;
    const value = Math.round(niceMax * tick);
    svgContent += `
      <line x1="${x}" y1="${margin.top - 10}" x2="${x}" y2="${chartHeight - margin.bottom + 10}" stroke="#111827" stroke-width="${tick === 0 ? 3 : 1.5}" stroke-dasharray="${tick === 0 ? "0" : "6 7"}" opacity="${tick === 0 ? "1" : "0.32"}" />
      <text class="daily-axis-text" x="${x}" y="${chartHeight - 16}" text-anchor="middle" font-family="${chartNumberFontFamily}" font-size="${tickFontSize}" font-weight="500" fill="#475569">${formatWonShort(value)}</text>
    `;
  });

  dayTotals.forEach((data, index) => {
    const y = margin.top + index * rowHeight;
    const centerY = y + rowHeight / 2;
    const barWidth = data.total ? Math.min(plotWidth, Math.max(minBarWidth, (data.total / niceMax) * plotWidth)) : 0;
    const barColors = ["#ccb7ff", "#ffd53d", "#6ee7b7", "#fda4af", "#7dd3fc", "#fdba74"];
    const fillColor = barColors[index % barColors.length];
    const isHighest = data.date === highestDay.date && data.total > 0;

    svgContent += `
      <g class="bar-group${isHighest ? " is-highest" : ""}" tabindex="0" role="img" aria-label="${data.label}: ${formatWon(data.total)}">
        <text class="daily-day-label" x="${margin.left - (compactChart ? 10 : 18)}" y="${centerY - 3}" text-anchor="end" font-family="${chartTextFontFamily}" font-size="${labelFontSize}" font-weight="600" fill="#1f2937">${data.label}</text>
        <text class="daily-date-label" x="${margin.left - (compactChart ? 10 : 18)}" y="${centerY + 14}" text-anchor="end" font-family="${chartTextFontFamily}" font-size="${dateFontSize}" font-weight="500" fill="#64748b">${escapeHtml(data.shortDate || "")}</text>
        <rect x="${margin.left}" y="${centerY - barHeight / 2}" width="${plotWidth}" height="${barHeight}" fill="#ffffff" stroke="#111827" stroke-width="2.5" rx="12" />
        ${data.total ? `<rect x="${margin.left + 5}" y="${centerY - barHeight / 2 + 5}" width="${barWidth}" height="${barHeight}" fill="#111827" rx="12" opacity="0.95" />` : ""}
        <rect x="${margin.left}" y="${centerY - barHeight / 2}" width="${data.total ? barWidth : 9}" height="${barHeight}" fill="${data.total ? fillColor : "#e5e7eb"}" stroke="#111827" stroke-width="3" rx="12" />
        <rect class="daily-value-plate" x="${valueX - valuePlateWidth}" y="${centerY - valuePlateHeight / 2}" width="${valuePlateWidth}" height="${valuePlateHeight}" rx="7" fill="#fffdf7" opacity="0.92" />
        <text class="daily-value-label" x="${valueX}" y="${centerY + 4}" text-anchor="end" font-family="${chartNumberFontFamily}" font-size="${valueFontSize}" font-weight="600" fill="#1f2937">${data.total ? formatWonShort(data.total) : "0원"}</text>
      </g>
    `;
  });

  svgContent += `</svg>`;
  els.dailyBarChart.innerHTML = svgContent;
}

function renderDailyTrendSummary(dayTotals, tripDays = dayTotals.filter((day) => !day.isPreTrip)) {
  if (!els.dailyTrendSummary) return;
  const total = sumEntries(dayTotals);
  const tripDayTotal = sumEntries(dayTotals.filter((day) => !day.isPreTrip));
  const activeDays = dayTotals.filter((day) => day.total > 0);
  const average = tripDays.length ? Math.round(tripDayTotal / tripDays.length) : 0;
  const highestDay = dayTotals.length
    ? dayTotals.reduce((best, day) => (day.total > best.total ? day : best), dayTotals[0])
    : null;

  els.dailyTrendSummary.innerHTML = `
    <div class="daily-trend-stat">
      <span>총 지출</span>
      <strong>${formatWon(total)}</strong>
    </div>
    <div class="daily-trend-stat">
      <span>일 평균</span>
      <strong>${formatWon(average)}</strong>
    </div>
    <div class="daily-trend-stat">
      <span>최고 지출</span>
      <strong>${highestDay && highestDay.total ? `${escapeHtml(highestDay.label)} · ${formatWon(highestDay.total)}` : "아직 없음"}</strong>
    </div>
    <div class="daily-trend-stat">
      <span>지출 기록</span>
      <strong>${activeDays.length} / ${dayTotals.length}개</strong>
    </div>
  `;
}

function getNiceChartMax(value) {
  if (!value) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const scaled = value / base;
  const niceScaled = scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return niceScaled * base;
}

function formatWonShort(amount) {
  return formatWon(Math.round(amount || 0));
}

function estimateDailyValueLabelWidth(label = "", fontSize = 12) {
  return Math.ceil(Array.from(String(label)).reduce((width, char) => {
    if (/\d/.test(char)) return width + fontSize * 0.58;
    if (char === ",") return width + fontSize * 0.28;
    return width + fontSize * 0.9;
  }, 0));
}


window.TripLog.register("features.reports.dailyTrend", {
  renderDailySpendTrend,
  renderDailyTrendSummary,
  getNiceChartMax,
  formatWonShort,
  estimateDailyValueLabelWidth,
});
