/* 👥 6-Tab App Navigation, Overview, Settlement, and Report Page Renderers */

// 1. Overview Page Renderer
function renderOverviewPage() {
  // 1. Render Multi-Trip Selector Dropdown
  const trips = window.TripLog.persistence.stateStorage.getTrips();
  const activeId = window.TripLog.persistence.stateStorage.getActiveTripId();
  if (els.overviewTripSelect) {
    els.overviewTripSelect.replaceChildren();
    trips.forEach(t => {
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = t.tripName || "이름 없는 여행";
      if (t.id === activeId) option.selected = true;
      els.overviewTripSelect.appendChild(option);
    });
    syncCustomSelect(els.overviewTripSelect, { rebuild: true });
  }

  // 2. Render Existing Legacy Overview Details
  const overviewModeSticker = document.querySelector("#overviewModeSticker");
  if (overviewModeSticker) {
    overviewModeSticker.textContent = state.travelMode === "domestic" ? "국내 여행" : "해외 여행";
    overviewModeSticker.className = `budget-sticker ${state.travelMode === "domestic" ? "safe" : "warning"}`;
  }

  // 3. Render Premium Travel Summary Card (카드 1: 여행 요약)
  const days = getTripDays();
  const tripDurationDays = days.length;
  const tripNights = Math.max(0, tripDurationDays - 1);
  const nightsText = tripNights > 0 ? `${tripNights}박 ${tripNights + 1}일` : "당일치기";

  const dbTripName = document.querySelector("#dbTripName");
  const dbTripDate = document.querySelector("#dbTripDate");
  if (dbTripName) {
    dbTripName.textContent = `${state.tripName || "새로운 여행"} · ${nightsText}`;
  }
  if (dbTripDate && days.length > 0) {
    const startYear = new Date(state.startDate).getFullYear();
    const startMonth = new Date(state.startDate).getMonth() + 1;
    const firstDay = days[0].shortDate;
    const lastDay = days[days.length - 1].shortDate;
    dbTripDate.textContent = `${startYear}. ${startMonth}월 (${firstDay} - ${lastDay})`;
  }

  // Bind Buttons on Travel Summary to scroll or navigate to specific lists
  const flightsBtn = document.querySelector("#dbBtnFlights");
  const hotelBtn = document.querySelector("#dbBtnHotel");
  if (flightsBtn) {
    flightsBtn.onclick = () => {
      setActivePage("budget");
      setFilter("교통");
    };
  }
  if (hotelBtn) {
    hotelBtn.onclick = () => {
      setActivePage("budget");
      setFilter("숙소");
    };
  }

  // 4. Render Essential Preparation Checklist Card (카드 2: 필수 체크리스트)
  const hasLodging = state.entries.some(e => e.category === "숙소");
  const hasFlight = state.entries.some(e => e.category === "교통" && (e.description.includes("항공") || e.description.includes("비행기")));
  let prepPercent = 30; // base prep
  if (hasLodging && hasFlight) prepPercent = 100;
  else if (hasLodging || hasFlight) prepPercent = 70;

  const dbChecklistPercent = document.querySelector("#dbChecklistPercent");
  const dbChecklistProgressFill = document.querySelector("#dbChecklistProgressFill");
  if (dbChecklistPercent) {
    dbChecklistPercent.textContent = `${prepPercent}%`;
  }
  if (dbChecklistProgressFill) {
    dbChecklistProgressFill.style.width = `${prepPercent}%`;
  }

  // 5. Render Vertical Itinerary Timelines Card (카드 3: 일차별 주요 일정)
  const timelineContainer = document.querySelector("#dbTimelineContainer");
  if (timelineContainer) {
    timelineContainer.replaceChildren();

    // Only display up to 6 days to fit cleanly into Toss Dashboard
    const displayDays = days.slice(0, 6);
    displayDays.forEach((day) => {
      const dayItems = state.itineraryItems.filter(item => item.date === day.date)
        .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

      const dayBlock = document.createElement("div");
      dayBlock.className = "timeline-day-block";

      let itemsHtml = "";
      if (dayItems.length === 0) {
        itemsHtml = `
          <div class="timeline-item empty">
            <span class="timeline-dot-node dot-empty"></span>
            <span class="timeline-text">등록된 일정이 없습니다.</span>
          </div>
        `;
      } else {
        itemsHtml = dayItems.map((item, idx) => {
          const themeEmojis = { sightseeing: "📸", lodging: "🏨", food: "🍽️", shopping: "🛍️", transport: "🚗", etc: "🎈" };
          const emoji = themeEmojis[item.theme] || "📍";
          const dotClass = idx === 0 ? "dot-checked" : "dot-normal";
          return `
            <div class="timeline-item">
              <span class="timeline-dot-node ${dotClass}"></span>
              <span class="timeline-text">
                <span class="timeline-emoji">${emoji}</span>
                <span class="timeline-place-name">${escapeHtml(item.place)}</span>
                ${item.time ? `<small class="timeline-item-time">(${item.time})</small>` : ""}
              </span>
            </div>
          `;
        }).join("");
      }

      dayBlock.innerHTML = `
        <div class="timeline-day-header">
          <span class="timeline-day-checkbox"></span>
          <strong class="timeline-day-label">Day ${day.index}</strong>
        </div>
        <div class="timeline-items-wrapper">
          ${itemsHtml}
        </div>
      `;
      timelineContainer.appendChild(dayBlock);
    });

    if (days.length === 0) {
      timelineContainer.innerHTML = `<div class="empty-timeline-info">일정 탭에서 시작일과 종료일을 지정하면 일차별 타임라인이 시작됩니다.</div>`;
    }
  }

  // 6. Render Dynamic Category Spend Pie Chart (카드 4: 전체 지출 예상)
  const totals = calculateTotals();
  const totalSpent = totals.total;
  const daysCount = days.length || 1;
  const dailyAvg = Math.round(totalSpent / daysCount);

  const dbTotalSpent = document.querySelector("#dbTotalSpent");
  const dbDailyAverage = document.querySelector("#dbDailyAverage");
  if (dbTotalSpent) dbTotalSpent.textContent = formatCurrency(totalSpent);
  if (dbDailyAverage) dbDailyAverage.textContent = formatCurrency(dailyAvg);

  const categorySums = {};
  categories.forEach(cat => { categorySums[cat.name] = 0; });
  state.entries.forEach(entry => {
    if (categorySums[entry.category] !== undefined) {
      categorySums[entry.category] += entry.amount || 0;
    } else {
      categorySums["기타"] = (categorySums["기타"] || 0) + (entry.amount || 0);
    }
  });

  const legendContainer = document.querySelector("#dbExpenseLegend");
  const sectorsContainer = document.querySelector("#dbDonutSectors");
  if (legendContainer && sectorsContainer) {
    legendContainer.replaceChildren();
    sectorsContainer.replaceChildren();

    const chartData = [];
    categories.forEach(cat => {
      const sum = categorySums[cat.name] || 0;
      const ratio = totalSpent > 0 ? (sum / totalSpent) * 100 : 0;
      if (sum > 0) {
        chartData.push({ name: cat.name, sum, ratio, color: cat.color });
      }
    });

    chartData.sort((a, b) => b.sum - a.sum);

    let strokeOffset = 0;
    chartData.forEach(item => {
      const sector = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      sector.setAttribute("cx", "18");
      sector.setAttribute("cy", "18");
      sector.setAttribute("r", "15.9155");
      sector.setAttribute("fill", "none");
      sector.setAttribute("stroke", item.color);
      sector.setAttribute("stroke-width", "4.5");
      sector.setAttribute("stroke-dasharray", `${item.ratio} ${100 - item.ratio}`);
      sector.setAttribute("stroke-dashoffset", `${100 - strokeOffset + 25}`);
      sectorsContainer.appendChild(sector);

      strokeOffset += item.ratio;

      const legendItem = document.createElement("div");
      legendItem.className = "legend-item";
      legendItem.innerHTML = `
        <span class="legend-color-dot" style="background:${item.color};"></span>
        <span class="legend-name">${item.name}</span>
        <strong class="legend-ratio">${Math.round(item.ratio)}%</strong>
      `;
      legendContainer.appendChild(legendItem);
    });

    const centerTextEl = document.querySelector("#dbDonutCenterText");
    if (centerTextEl) {
      if (chartData.length > 0) {
        centerTextEl.textContent = `${Math.round(chartData[0].ratio)}%`;
        centerTextEl.style.color = chartData[0].color;
      } else {
        centerTextEl.textContent = "0%";
        centerTextEl.style.color = "var(--muted-2)";
      }
    }
  }

  // 7. Render Packaging Suitecases Checklist Card (카드 5: 짐 싸기 상태)
  const packingList = state.packingList || [];
  const totalPacking = packingList.length;
  const packedCount = packingList.filter(item => item.checked).length;
  const packingPercent = totalPacking > 0 ? Math.round((packedCount / totalPacking) * 100) : 0;

  const dbPackingProgressFill = document.querySelector("#dbPackingProgressFill");
  const dbPackingPercentText = document.querySelector("#dbPackingPercentText");
  if (dbPackingProgressFill) {
    dbPackingProgressFill.style.width = `${packingPercent}%`;
  }
  if (dbPackingPercentText) {
    dbPackingPercentText.textContent = `${packingPercent}% 완료 - ${totalPacking}개 중 ${packedCount}개`;
  }

  // Quick list inside packaging checklist card
  const quickListEl = document.querySelector("#dbPackingQuickList");
  if (quickListEl) {
    quickListEl.replaceChildren();

    // Sort unchecked items first, display up to 4 quick checkboxes
    const sortedItems = [...packingList].sort((a, b) => a.checked - b.checked).slice(0, 4);
    sortedItems.forEach(item => {
      const itemEl = document.createElement("label");
      itemEl.className = `packing-quick-item${item.checked ? " checked" : ""}`;
      itemEl.innerHTML = `
        <input type="checkbox" ${item.checked ? "checked" : ""} />
        <span class="checkbox-custom"></span>
        <span class="packing-quick-name">${escapeHtml(item.name)}</span>
      `;

      const cb = itemEl.querySelector("input");
      cb.addEventListener("change", () => {
        state.packingList = state.packingList.map(p => p.id === item.id ? { ...p, checked: cb.checked } : p);
        saveAndRender();
      });

      quickListEl.appendChild(itemEl);
    });

    if (packingList.length === 0) {
      quickListEl.innerHTML = `<div style="font-size:12px; color:var(--muted); text-align:center; padding:10px 0;">가방 리스트가 비어 있습니다.</div>`;
    }
  }
}


window.TripLog.register("features.overview.page", {
  renderOverviewPage,
});
