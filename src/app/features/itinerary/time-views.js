function renderTimeBlockGrid(items) {
  if (!els.itineraryTimeBlockGrid) return;
  els.itineraryTimeBlockGrid.replaceChildren();

  if (state.selectedItineraryDate === "all") {
    const placeholder = document.createElement("div");
    placeholder.className = "time-block-empty-overview";
    placeholder.innerHTML = `
      <div class="time-block-empty-overview-title">📅 전체 일정 모드 활성화됨</div>
      <div class="time-block-empty-overview-desc">
        전체 일정 모드에서는 일차별로 타임라인이 피드로 연결됩니다.<br>
        24H 아날로그 시계의 꽉 찬 컬러 스케줄을 확인하려면 상단 일차 칩(Day Chip)을 선택해 주세요.
      </div>
    `;
    els.itineraryTimeBlockGrid.appendChild(placeholder);
    return;
  }

  const clockContainer = document.createElement("div");
  clockContainer.className = "clock-dial-container";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "clock-dial-svg");
  svg.setAttribute("viewBox", "0 0 640 640");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "24시간 일정 시계");

  const cx = 320;
  const cy = 330;
  const rFace = 296;
  const rHour = 252;
  const rTickOuter = 294;
  const rScheduleIn = 164;
  const rScheduleOut = 232;
  const rScheduleMid = (rScheduleIn + rScheduleOut) / 2;
  const rTimeBadge = 218;
  const rCenter = 92;

  svg.appendChild(createClockCircle(cx, cy, rFace, "clock-face"));
  svg.appendChild(createClockCircle(cx, cy, rScheduleOut + 32, "clock-label-track"));

  for (let slot = 0; slot < 48; slot++) {
    const minutes = slot * 30;
    const angle = (minutes * 0.25 - 90) * Math.PI / 180;
    const isAnchor = minutes % 360 === 0;
    const isMajor = minutes % 120 === 0;
    const tickInnerRadius = isAnchor ? rTickOuter - 46 : isMajor ? rTickOuter - 34 : rTickOuter - 18;
    const tickStart = getClockPoint(cx, cy, tickInnerRadius, angle);
    const tickEnd = getClockPoint(cx, cy, rTickOuter, angle);

    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("class", `clock-tick-line ${isAnchor ? "clock-tick-anchor" : isMajor ? "clock-tick-major" : "clock-tick-minor"}`);
    tick.setAttribute("x1", String(tickStart.x));
    tick.setAttribute("y1", String(tickStart.y));
    tick.setAttribute("x2", String(tickEnd.x));
    tick.setAttribute("y2", String(tickEnd.y));
    svg.appendChild(tick);
  }

  for (let h = 0; h < 24; h += 2) {
    if (h % 6 === 0) continue;

    const angle = (h * 15 - 90) * Math.PI / 180;
    const labelPoint = getClockPoint(cx, cy, rHour, angle);
    const hourText = createClockText(labelPoint.x, labelPoint.y, "clock-hour-text", String(h));
    svg.appendChild(hourText);
  }

  const timedItems = items
    .map(item => ({
      item,
      startM: parseClockMinutes(item.time),
      duration: Math.max(Number(item.duration) || 60, 1),
    }))
    .filter(entry => Number.isFinite(entry.startM))
    .sort((a, b) => {
      return a.startM - b.startM;
    });

  const scheduleTrack = createClockCircle(cx, cy, rScheduleMid, "clock-schedule-track");
  scheduleTrack.setAttribute("stroke-width", String(rScheduleOut - rScheduleIn));
  svg.appendChild(scheduleTrack);

  timedItems.forEach(({ item, startM, duration }) => {
    const visualDuration = Math.max(duration, 24);
    const endM = Math.min(startM + visualDuration, 1440);
    const midM = startM + (endM - startM) / 2;
    const gap = Math.min(4, visualDuration / 7);
    const arcStartM = startM + gap;
    const arcEndM = Math.max(arcStartM + 1, endM - gap);
    const itemKind = getClockItemKind(item);

    const sector = document.createElementNS("http://www.w3.org/2000/svg", "path");
    sector.setAttribute("class", `clock-sector clock-theme-${itemKind}`);
    sector.setAttribute("d", describeClockRingArc(cx, cy, rScheduleIn, rScheduleOut, arcStartM, arcEndM));
    sector.setAttribute("fill", getClockScheduleColor(item));

    const tooltipText = `${item.time} - ${item.place} (${duration}분)`;
    sector.appendChild(createSvgTitle(tooltipText));

    sector.addEventListener("click", () => {
      startItineraryEdit(item);
    });

    svg.appendChild(sector);

    const markerAngle = (midM * 0.25 - 90) * Math.PI / 180;
    const iconPoint = getClockPoint(cx, cy, rScheduleMid, markerAngle);
    const icon = createClockCategoryIcon(itemKind, iconPoint.x, iconPoint.y, getClockIconColor(item));
    icon.appendChild(createSvgTitle(tooltipText));
    icon.addEventListener("click", () => startItineraryEdit(item));
    svg.appendChild(icon);

    const badgeAngle = (startM * 0.25 - 90) * Math.PI / 180;
    const badgePoint = getClockPoint(cx, cy, rTimeBadge, badgeAngle);
    const timeBadge = createClockTimeBadge(badgePoint.x, badgePoint.y, formatClockMinutes(startM), tooltipText);
    timeBadge.addEventListener("click", () => startItineraryEdit(item));
    svg.appendChild(timeBadge);
  });

  [0, 6, 12, 18].forEach((hour) => {
    const angle = (hour * 15 - 90) * Math.PI / 180;
    const point = getClockPoint(cx, cy, rTickOuter - 7, angle);
    svg.appendChild(createClockAnchorBadge(point.x, point.y, hour));
  });

  const now = new Date();
  const currentM = now.getHours() * 60 + now.getMinutes();
  const currentAngle = (currentM * 0.25 - 90) * Math.PI / 180;
  const handStart = getClockPoint(cx, cy, rCenter - 2, currentAngle);
  const handEnd = getClockPoint(cx, cy, rScheduleOut - 4, currentAngle);
  const hand = document.createElementNS("http://www.w3.org/2000/svg", "line");
  hand.setAttribute("class", "clock-current-hand");
  hand.setAttribute("x1", String(handStart.x));
  hand.setAttribute("y1", String(handStart.y));
  hand.setAttribute("x2", String(handEnd.x));
  hand.setAttribute("y2", String(handEnd.y));
  svg.appendChild(hand);

  const handKnob = createClockCircle(handEnd.x, handEnd.y, 15, "clock-current-knob");
  svg.appendChild(handKnob);

  const centerDisc = createClockCircle(cx, cy, rCenter, "clock-center-disc");
  svg.appendChild(centerDisc);
  svg.appendChild(createClockCircle(cx, cy, rCenter - 26, "clock-center-dots"));

  const pin = createClockText(cx, cy - 52, "clock-center-pin", "📍");
  svg.appendChild(pin);

  const centerLabel = createClockText(cx, cy - 16, "clock-center-label clock-center-caption", "현재 시간");
  svg.appendChild(centerLabel);

  const centerTime = createClockText(cx, cy + 34, "clock-center-label clock-center-main", formatClockTime(now));
  svg.appendChild(centerTime);

  const weekdayGroup = createClockWeekdayPill(cx, cy + 71, formatKoreanWeekday(now));
  svg.appendChild(weekdayGroup);

  clockContainer.appendChild(svg);
  els.itineraryTimeBlockGrid.appendChild(clockContainer);
}

function createClockCircle(cx, cy, r, className) {
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("class", className);
  circle.setAttribute("cx", String(cx));
  circle.setAttribute("cy", String(cy));
  circle.setAttribute("r", String(r));
  return circle;
}

function createClockText(x, y, className, textContent) {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("class", className);
  text.setAttribute("x", String(x));
  text.setAttribute("y", String(y));
  text.textContent = textContent;
  return text;
}

function createSvgTitle(textContent) {
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = textContent;
  return title;
}

function createClockAnchorBadge(x, y, hour) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", `clock-anchor-badge clock-anchor-${hour}`);

  const isTop = hour === 0;
  const width = isTop ? 48 : 58;
  const height = isTop ? 70 : 58;
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("class", "clock-anchor-rect");
  rect.setAttribute("x", String(x - width / 2));
  rect.setAttribute("y", String(y - height / 2));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("rx", "8");
  rect.setAttribute("ry", "8");
  group.appendChild(rect);

  if (isTop) {
    group.appendChild(createClockText(x, y - 12, "clock-anchor-text clock-anchor-top-main", "0"));
    group.appendChild(createClockText(x, y + 19, "clock-anchor-text clock-anchor-top-sub", "24"));
  } else {
    group.appendChild(createClockText(x, y + 2, "clock-anchor-text", String(hour)));
  }

  return group;
}

function createClockTimeBadge(x, y, label, titleText) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "clock-time-badge");

  const width = 58;
  const height = 24;
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("class", "clock-time-badge-rect");
  rect.setAttribute("x", String(x - width / 2));
  rect.setAttribute("y", String(y - height / 2));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("rx", "11");
  rect.setAttribute("ry", "11");
  group.appendChild(rect);
  group.appendChild(createClockText(x, y + 1, "clock-time-badge-text", label));
  group.appendChild(createSvgTitle(titleText));
  return group;
}

function createClockWeekdayPill(x, y, label) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "clock-weekday-pill");

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("class", "clock-weekday-rect");
  rect.setAttribute("x", String(x - 45));
  rect.setAttribute("y", String(y - 15));
  rect.setAttribute("width", "90");
  rect.setAttribute("height", "31");
  rect.setAttribute("rx", "6");
  rect.setAttribute("ry", "6");
  group.appendChild(rect);
  group.appendChild(createClockText(x, y + 1, "clock-weekday-text", label));
  return group;
}

function createClockCategoryIcon(kind, x, y, color) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", `clock-sector-icon clock-icon-${kind}`);
  group.setAttribute("transform", `translate(${x} ${y})`);
  group.setAttribute("stroke", color);

  const addPath = (d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    group.appendChild(path);
    return path;
  };

  const addRect = (xValue, yValue, width, height, rx = 2) => {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(xValue));
    rect.setAttribute("y", String(yValue));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("rx", String(rx));
    group.appendChild(rect);
    return rect;
  };

  const addCircle = (cxValue, cyValue, rValue) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(cxValue));
    circle.setAttribute("cy", String(cyValue));
    circle.setAttribute("r", String(rValue));
    group.appendChild(circle);
    return circle;
  };

  switch (kind) {
    case "lodging":
      addPath("M-14 8V-9M-14 2H10a6 6 0 0 1 6 6v0M-14 8H16M-8 2v-7h11v7");
      break;
    case "food":
      addPath("M-10 -13v26M-15 -13v9a5 5 0 0 0 10 0v-9M9 -13v26M9 -13c6 5 6 13 0 17");
      break;
    case "shopping":
      addPath("M-12 -4h24l-2 18h-20L-12 -4ZM-6 -4v-3a6 6 0 0 1 12 0v3");
      break;
    case "transport":
      addPath("M-15 3l3-9h24l3 9v9H-15V3ZM-10 12v4M10 12v4M-9 4H9");
      addCircle(-9, 8, 2.4);
      addCircle(9, 8, 2.4);
      break;
    case "sightseeing":
      addRect(-13, -8, 26, 18, 4);
      addPath("M-6 -8l2-4h8l2 4");
      addCircle(0, 1, 5);
      break;
    default:
      addCircle(0, 0, 9);
      addPath("M0 -4v8M-4 0h8");
      break;
  }

  return group;
}

function parseClockMinutes(timeValue) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(timeValue || "").trim());
  if (!match) return NaN;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return NaN;

  return hour * 60 + minute;
}

function getClockPoint(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function describeClockRingArc(cx, cy, rIn, rOut, startM, endM) {
  const angleStart = (startM * 0.25 - 90) * Math.PI / 180;
  const angleEnd = (endM * 0.25 - 90) * Math.PI / 180;
  const outerStart = getClockPoint(cx, cy, rOut, angleStart);
  const outerEnd = getClockPoint(cx, cy, rOut, angleEnd);
  const innerStart = getClockPoint(cx, cy, rIn, angleStart);
  const innerEnd = getClockPoint(cx, cy, rIn, angleEnd);
  const largeArcFlag = endM - startM > 720 ? "1" : "0";

  return `
    M ${outerStart.x} ${outerStart.y}
    A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}
    L ${innerEnd.x} ${innerEnd.y}
    A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}
    Z
  `.trim().replace(/\s+/g, " ");
}

function formatClockMinutes(minutes) {
  const safeMinutes = Math.max(0, Math.min(1439, Math.round(minutes)));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatClockTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatKoreanWeekday(date) {
  return ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][date.getDay()];
}

function getClockItemKind(item) {
  if (item.theme && item.theme !== "etc") return item.theme;
  if (item.trans && item.trans !== "none") return "transport";
  return "etc";
}

function getClockScheduleColor(item) {
  switch (getClockItemKind(item)) {
    case "sightseeing": return "var(--clock-schedule-sightseeing)";
    case "lodging": return "var(--clock-schedule-lodging)";
    case "food": return "var(--clock-schedule-food)";
    case "shopping": return "var(--clock-schedule-shopping)";
    case "transport": return "var(--clock-schedule-transport)";
    default: return getTransitColor(item.trans);
  }
}

function getClockIconColor(item) {
  switch (getClockItemKind(item)) {
    case "sightseeing": return "var(--clock-icon-sightseeing)";
    case "lodging": return "var(--clock-icon-lodging)";
    case "food": return "var(--clock-icon-food)";
    case "shopping": return "var(--clock-icon-shopping)";
    case "transport": return "var(--clock-icon-transport)";
    default: return "var(--muted)";
  }
}

function getTransitColor(trans) {
  switch (trans) {
    case "walk": return "#d1fae5"; // emerald light
    case "car": return "#fee2e2";  // rose light
    case "bus": return "#fef3c7";  // amber light
    case "etc": return "#e0f2fe";  // sky light
    default: return "#f3f4f6";     // gray light
  }
}

function renderTravelTimeChart(items) {
  if (!els.itineraryDurationChart) return;
  els.itineraryDurationChart.replaceChildren();

  if (state.selectedItineraryDate === "all") {
    const placeholder = document.createElement("div");
    placeholder.className = "time-block-empty-overview";
    placeholder.innerHTML = `
      <div class="time-block-empty-overview-title">⏱️ 전체 이동 분석 정지</div>
      <div class="time-block-empty-overview-desc">
        전체 일정 모드에서는 소요 시간 차트가 제공되지 않습니다.<br>
        개별 일차(Day Chip)를 선택하면 해당 일의 이동 분석 차트가 표시됩니다.
      </div>
    `;
    els.itineraryDurationChart.appendChild(placeholder);

    const reportDuration = document.querySelector("#reportItineraryDurationChart");
    if (reportDuration) {
      reportDuration.replaceChildren();
      reportDuration.innerHTML = `
        <div style="text-align: center; color: var(--muted); padding: 24px; font-size: 0.95rem; font-family: var(--font);">
          보고서에서는 개별 일자별 이동 분석 차트가 제공됩니다.
        </div>
      `;
    }
    return;
  }

  const activeItems = items.filter(item => item.duration > 0);

  if (activeItems.length === 0) {
    els.itineraryDurationChart.innerHTML = `
      <div class="empty-chart-text">소요 시간이 입력된 일정이 없습니다.</div>
    `;
    return;
  }

  const maxDuration = Math.max(...activeItems.map(item => item.duration), 1);

  const chartWrap = document.createElement("div");
  chartWrap.className = "duration-bar-list";

  activeItems.forEach(item => {
    const barRow = document.createElement("div");
    barRow.className = "duration-bar-row";

    const label = document.createElement("span");
    label.className = "duration-bar-label";
    label.textContent = item.place;
    label.title = item.place;

    const progressWrap = document.createElement("div");
    progressWrap.className = "duration-progress-wrap";

    const fill = document.createElement("div");
    fill.className = "duration-progress-fill";
    fill.style.width = `${(item.duration / maxDuration) * 100}%`;
    const color = getTransitColor(item.trans);
    fill.style.backgroundColor = color;

    const val = document.createElement("span");
    val.className = "duration-bar-value";
    val.textContent = `${item.duration}분`;

    progressWrap.appendChild(fill);
    barRow.appendChild(label);
    barRow.appendChild(progressWrap);
    barRow.appendChild(val);

    chartWrap.appendChild(barRow);
  });

  els.itineraryDurationChart.appendChild(chartWrap);
  const reportDuration = document.querySelector("#reportItineraryDurationChart");
  if (reportDuration) {
    reportDuration.replaceChildren();
    reportDuration.appendChild(chartWrap.cloneNode(true));
  }
}

window.TripLog.register("features.itinerary.timeViews", {
  renderTimeBlockGrid,
  getTransitColor,
  renderTravelTimeChart,
});
