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
        일정별 상세 시간대 분포를 확인하려면 상단 일차 칩(Day Chip)을 선택해 주세요.
      </div>
    `;
    els.itineraryTimeBlockGrid.appendChild(placeholder);
    return;
  }

  for (let h = 0; h < 24; h++) {
    const hourStr = String(h).padStart(2, "0");
    const block = document.createElement("div");
    block.className = "time-hour-block";
    
    const activeItems = items.filter(item => {
      if (!item.time) return false;
      const [itemH, itemM] = item.time.split(":").map(Number);
      if (itemH === h) return true;
      
      const startMin = itemH * 60 + itemM;
      let endMin = startMin;
      if (item.endTime) {
        const [endH, endM] = item.endTime.split(":").map(Number);
        endMin = endH * 60 + endM;
        if (endMin < startMin) endMin += 1440; // Wrap midnight
      } else if (item.duration > 0) {
        endMin = startMin + item.duration;
      }

      if (endMin > startMin) {
        const currentHourStartMin = h * 60;
        const currentHourEndMin = (h + 1) * 60;
        return startMin < currentHourEndMin && endMin > currentHourStartMin;
      }
      return false;
    });

    const hourLabel = document.createElement("span");
    hourLabel.className = "hour-label";
    hourLabel.textContent = `${hourStr}:00`;
    block.appendChild(hourLabel);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "hour-items-container";

    if (activeItems.length > 0) {
      block.classList.add("has-items");
      activeItems.forEach(item => {
        const itemBadge = document.createElement("div");
        itemBadge.className = "hour-item-badge";
        const color = getTransitColor(item.trans);
        itemBadge.style.backgroundColor = color;
        itemBadge.textContent = item.place;
        itemBadge.title = `${item.time} - ${item.place} (${item.memo || "메모 없음"})`;
        itemBadge.addEventListener("click", () => {
          startItineraryEdit(item);
        });
        itemsContainer.appendChild(itemBadge);
      });
    }
    
    block.appendChild(itemsContainer);
    els.itineraryTimeBlockGrid.appendChild(block);
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
