function renderTimeBlockGrid(items) {
  if (!els.itineraryTimeBlockGrid) return;
  els.itineraryTimeBlockGrid.replaceChildren();

  // 1. 전체 일정 모드인 경우
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

  // 2. 개별 일차 모드 - 시계 컨테이너 생성
  const clockContainer = document.createElement("div");
  clockContainer.className = "clock-dial-container";

  // SVG 엘리먼트 생성
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "clock-dial-svg");
  svg.setAttribute("viewBox", "0 0 200 200");

  const cx = 100;
  const cy = 100;
  
  // 극대화된 베젤리스 반지름 세팅 (viewBox의 끝단인 96까지 꽉 채움!)
  const rOut = 96;

  // 시계 테두리 원
  const outerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  outerCircle.setAttribute("cx", String(cx));
  outerCircle.setAttribute("cy", String(cy));
  outerCircle.setAttribute("r", String(rOut));
  outerCircle.setAttribute("fill", "#ffffff");
  outerCircle.setAttribute("stroke", "var(--line)");
  outerCircle.setAttribute("stroke-width", "1.5");
  svg.appendChild(outerCircle);

  // 24H 눈금선 및 시간 텍스트 배치
  for (let h = 0; h < 24; h++) {
    const angle = (h * 15 - 90) * Math.PI / 180;
    
    // 눈금선
    const x1 = cx + (rOut - 6) * Math.cos(angle);
    const y1 = cy + (rOut - 6) * Math.sin(angle);
    const x2 = cx + rOut * Math.cos(angle);
    const y2 = cy + rOut * Math.sin(angle);
    
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("class", "clock-tick-line");
    tick.setAttribute("x1", String(x1));
    tick.setAttribute("y1", String(y1));
    tick.setAttribute("x2", String(x2));
    tick.setAttribute("y2", String(y2));
    tick.setAttribute("stroke", "var(--line)");
    tick.setAttribute("stroke-width", h % 6 === 0 ? "1.5" : "0.7");
    svg.appendChild(tick);

    // 짝수 단위 시간 라벨 배치
    if (h % 2 === 0) {
      const xt = cx + (rOut - 12) * Math.cos(angle);
      const yt = cy + (rOut - 12) * Math.sin(angle);
      
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", "clock-hour-text");
      text.setAttribute("x", String(xt));
      text.setAttribute("y", String(yt + 0.6));
      text.textContent = h === 0 ? "0시" : `${h}시`;
      svg.appendChild(text);
    }
  }

  // 일정 필터링 및 시간순 정렬
  const timedItems = items
    .filter(item => item.time)
    .sort((a, b) => {
      const [ah, am] = a.time.split(":").map(Number);
      const [bh, bm] = b.time.split(":").map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    });

  // 고리형 띠 영역 튜닝 (rSectorIn=76부터 rSectorOut=90까지 초슬림 밀착형 링 밴드)
  const rSectorIn = 76;
  const rSectorOut = 90;
  const rText = 62; // 고리 바로 안쪽의 아주 쾌적하게 넓어진 흰색 여백 영역

  timedItems.forEach(item => {
    const [itemH, itemM] = item.time.split(":").map(Number);
    const startM = itemH * 60 + itemM;
    
    let duration = Number(item.duration) || 60; // 기본 1시간
    let endM = startM + duration;
    if (endM > 1440) endM = 1440;

    const angleStart = (startM * 0.25 - 90) * Math.PI / 180;
    const angleEnd = (endM * 0.25 - 90) * Math.PI / 180;

    // 부채꼴 패스 좌표 계산
    const xOut1 = cx + rSectorOut * Math.cos(angleStart);
    const yOut1 = cy + rSectorOut * Math.sin(angleStart);
    const xOut2 = cx + rSectorOut * Math.cos(angleEnd);
    const yOut2 = cy + rSectorOut * Math.sin(angleEnd);

    const xIn1 = cx + rSectorIn * Math.cos(angleStart);
    const yIn1 = cy + rSectorIn * Math.sin(angleStart);
    const xIn2 = cx + rSectorIn * Math.cos(angleEnd);
    const yIn2 = cy + rSectorIn * Math.sin(angleEnd);

    const largeArcFlag = duration > 720 ? "1" : "0";
    
    const dStr = `
      M ${xOut1} ${yOut1} 
      A ${rSectorOut} ${rSectorOut} 0 ${largeArcFlag} 1 ${xOut2} ${yOut2} 
      L ${xIn2} ${yIn2} 
      A ${rSectorIn} ${rSectorIn} 0 ${largeArcFlag} 0 ${xIn1} ${yIn1} 
      Z
    `.trim().replace(/\s+/g, " ");

    const sector = document.createElementNS("http://www.w3.org/2000/svg", "path");
    sector.setAttribute("class", "clock-sector");
    sector.setAttribute("d", dStr);
    
    const color = getTransitColor(item.trans);
    sector.setAttribute("fill", color);
    sector.setAttribute("stroke", "var(--line)");
    sector.setAttribute("stroke-width", "1.0");

    // 툴팁 타이틀 설정
    const tooltipText = `${item.time} - ${item.place} (${duration}분)`;
    const titleEl = document.createElementNS("http://www.w3.org/2000/svg", "title");
    titleEl.textContent = tooltipText;
    sector.appendChild(titleEl);

    // 일정 편집 연동
    sector.addEventListener("click", () => {
      startItineraryEdit(item);
    });

    svg.appendChild(sector);

    // ----------------------------------------------------
    // 방사형 회전 라벨(Radial Rotated Labels) 렌더러
    // ----------------------------------------------------
    let themeEmoji = "🎈";
    switch (item.theme) {
      case "sightseeing": themeEmoji = "📸"; break;
      case "lodging": themeEmoji = "🏨"; break;
      case "food": themeEmoji = "🍽️"; break;
      case "shopping": themeEmoji = "🛍️"; break;
      case "transport": themeEmoji = "🚗"; break;
    }

    let labelText = themeEmoji;
    if (duration >= 45) {
      // 5글자 수준의 귀여운 텍스트 매핑
      const shortPlace = item.place.length > 5 ? item.place.substring(0, 5) + "." : item.place;
      labelText = `${themeEmoji} ${shortPlace}`;
    }

    // 부채꼴 중간 각도 계산
    const angleMid = ((startM + endM) / 2 * 0.25 - 90) * Math.PI / 180;
    const xt = cx + rText * Math.cos(angleMid);
    const yt = cy + rText * Math.sin(angleMid);

    const textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textLabel.setAttribute("class", "clock-sector-label");
    textLabel.setAttribute("x", String(xt));
    textLabel.setAttribute("y", String(yt + 0.6));
    textLabel.textContent = labelText;

    // 회전 각도 계산 (라디안 -> 디그리)
    const angleDeg = ((startM + endM) / 2 * 0.25 - 90);
    let rotAngle = angleDeg;

    // 텍스트가 시계 하단 및 좌측에서 거꾸로 서서 뒤집혀 보이지 않도록 180도 보정
    // 보통 90도(6시 방향) ~ 270도(18시 방향) 각도 영역에 해당
    if (rotAngle > 90 && rotAngle < 270) {
      rotAngle += 180;
    }

    // 방사형 transform 회전 탑재
    textLabel.setAttribute("transform", `rotate(${rotAngle}, ${xt}, ${yt})`);
    svg.appendChild(textLabel);
  });

  // 시계 중심 다이어리 데코 서클 얹기 (반지름 12로 초소형화하여 화사한 눈금 영역 확보)
  const centerDisc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  centerDisc.setAttribute("class", "clock-center-disc");
  centerDisc.setAttribute("cx", String(cx));
  centerDisc.setAttribute("cy", String(cy));
  centerDisc.setAttribute("r", "12");
  centerDisc.setAttribute("stroke-width", "1.5");
  svg.appendChild(centerDisc);

  // 시계 중심 큐트 라벨
  const centerLabel1 = document.createElementNS("http://www.w3.org/2000/svg", "text");
  centerLabel1.setAttribute("class", "clock-center-label");
  centerLabel1.setAttribute("x", String(cx));
  centerLabel1.setAttribute("y", "98.5");
  centerLabel1.textContent = "My";
  centerLabel1.style.fontSize = "6px";
  svg.appendChild(centerLabel1);

  const centerLabel2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
  centerLabel2.setAttribute("class", "clock-center-label");
  centerLabel2.setAttribute("x", String(cx));
  centerLabel2.setAttribute("y", "105.5");
  centerLabel2.textContent = "Trip";
  centerLabel2.style.fontSize = "5px";
  centerLabel2.style.fill = "var(--accent-pink)";
  svg.appendChild(centerLabel2);

  // 실시간 시계 바늘 드로잉
  const now = new Date();
  const currentTotalMin = now.getHours() * 60 + now.getMinutes();
  const currentAngle = (currentTotalMin * 0.25 - 90) * Math.PI / 180;
  
  const hx = cx + 13 * Math.cos(currentAngle);
  const hy = cy + 13 * Math.sin(currentAngle);

  const hourHand = document.createElementNS("http://www.w3.org/2000/svg", "line");
  hourHand.setAttribute("class", "clock-hand");
  hourHand.setAttribute("x1", String(cx));
  hourHand.setAttribute("y1", String(cy));
  hourHand.setAttribute("x2", String(hx));
  hourHand.setAttribute("y2", String(hy));
  svg.appendChild(hourHand);

  // 중심 핀 고정 (2px 초소형화)
  const centerPin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  centerPin.setAttribute("cx", String(cx));
  centerPin.setAttribute("cy", String(cy));
  centerPin.setAttribute("r", "2");
  centerPin.setAttribute("fill", "var(--line)");
  svg.appendChild(centerPin);

  clockContainer.appendChild(svg);
  els.itineraryTimeBlockGrid.appendChild(clockContainer);

  // 일정이 없을 때 하단에만 작게 가이드 노출
  if (timedItems.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "clock-empty-state";
    emptyState.style.marginTop = "12px";
    emptyState.innerHTML = `
      <strong>⏱️ 등록된 일정이 없습니다</strong>
      <span>상단 폼에서 시간과 소요 시간을 추가해 보세요. 시계 속에 예쁜 컬러 스케줄 조각들이 깔끔하게 채워집니다!</span>
    `;
    els.itineraryTimeBlockGrid.appendChild(emptyState);
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
