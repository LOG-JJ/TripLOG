function renderItineraryPage() {
  const days = getTripDays();
  if (state.selectedItineraryDate !== "all" && !days.some((day) => day.date === state.selectedItineraryDate)) {
    state.selectedItineraryDate = days[0]?.date || state.startDate;
  }

  if (els.itineraryWorkspace) {
    if (state.selectedItineraryDate === "all") {
      els.itineraryWorkspace.classList.add("overview-active");
    } else {
      els.itineraryWorkspace.classList.remove("overview-active");
    }
  }

  // Sync itinerary mode segmented toggle active states
  if (els.itineraryModeToggle) {
    const isAll = state.selectedItineraryDate === "all";
    els.itineraryModeToggle.querySelectorAll("button").forEach((btn) => {
      const active = isAll ? (btn.dataset.mode === "overview") : (btn.dataset.mode === "edit");
      btn.classList.toggle("active", active);
    });
  }

  els.itineraryTripName.textContent = state.tripName || getDefaultTripName();
  els.itineraryDateRange.textContent = `${formatReadableDate(state.startDate)} - ${formatReadableDate(state.endDate)}`;
  if (els.itineraryCount) {
    els.itineraryCount.textContent = `${Number(state.itineraryItems?.length || 0).toLocaleString("ko-KR")} spots`;
  }

  renderItineraryDaySelect(days);
  renderItineraryDayStrip(days);
  renderItineraryList(days);

  // Invoke our premium itinerary visualizers!
  const currentDayItems = getFilteredItineraryItems();
  renderTimeBlockGrid(currentDayItems);
  renderTravelTimeChart(currentDayItems);
  renderPackingBag();
}

function renderItineraryDaySelect(days) {
  els.itineraryDaySelect.replaceChildren();

  days.forEach((day) => {
    const dayNum = day.label.replace(/[^0-9]/g, "");
    const option = document.createElement("option");
    option.value = day.date;
    option.textContent = `Day${dayNum} · ${day.shortDate} [${day.weekday}]`;
    els.itineraryDaySelect.appendChild(option);
  });

  if (!days.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "일정 없음";
    els.itineraryDaySelect.appendChild(option);
  }

  els.itineraryDaySelect.value = days.some((day) => day.date === state.selectedItineraryDate)
    ? state.selectedItineraryDate
    : days[0]?.date || "";
  els.itineraryDaySelect.disabled = !days.length;
  syncCustomSelect(els.itineraryDaySelect, { rebuild: true });
}

function renderItineraryDayStrip(days) {
  els.itineraryDayStrip.replaceChildren();

  days.forEach((day) => {
    const count = state.itineraryItems.filter((item) => item.date === day.date).length;
    const dayNum = day.label.replace(/[^0-9]/g, "");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `itinerary-day-chip${day.date === state.selectedItineraryDate ? " active" : ""}`;
    button.innerHTML = `
      <strong>Day${dayNum}</strong>
      <span>${day.shortDate} [${day.weekday}]</span>
      <em>${count} spots</em>
    `;
    button.addEventListener("click", () => {
      const scrollIntent = captureDayStripScrollIntent(els.itineraryDayStrip, button);
      state.selectedItineraryDate = day.date;
      state.lastActiveItineraryDate = day.date; // Remember the specific day!
      els.itineraryDaySelect.value = day.date;
      clearItineraryEditMode(false);
      saveAndRender();
      applyDayStripScrollIntent(els.itineraryDayStrip, scrollIntent);
    });
    els.itineraryDayStrip.appendChild(button);
  });
}

function renderItineraryList(days) {
  const themeMeta = {
    sightseeing: { text: "명소", emoji: "📸", label: "📸 명소" },
    lodging: { text: "숙소", emoji: "🏨", label: "🏨 숙소" },
    food: { text: "맛집", emoji: "🍽️", label: "🍽️ 맛집" },
    shopping: { text: "쇼핑", emoji: "🛍️", label: "🛍️ 쇼핑" },
    transport: { text: "이동", emoji: "🚗", label: "🚗 이동" },
    etc: { text: "기타", emoji: "🎈", label: "🎈 기타" }
  };

  const dayMap = new Map(days.map((day) => [day.date, day]));
  const items = getFilteredItineraryItems();
  els.itineraryList.replaceChildren();
  els.itineraryEmpty.hidden = items.length > 0;

  let lastDate = null;

  items.forEach((item) => {
    const day = dayMap.get(item.date);

    // Grouping day headers in 'all' mode
    if (state.selectedItineraryDate === "all") {
      if (item.date !== lastDate) {
        lastDate = item.date;
        const subheader = document.createElement("div");
        subheader.className = "itinerary-list-day-header";

        const dayNum = day ? day.label.replace(/[^0-9]/g, "") : "";
        const label = day ? `Day${dayNum} · ${day.shortDate} [${day.weekday}]` : "일정 외";
        subheader.innerHTML = `
          <svg viewBox="0 0 24 24" focusable="false" class="itinerary-day-header-icon"><path d="M19 4H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
          <span>${label}</span>
        `;
        els.itineraryList.appendChild(subheader);
      }
    }

    const card = document.createElement("article");
    card.setAttribute("data-id", item.id);

    const themeBadgeHtml = item.theme && themeMeta[item.theme]
      ? `<span class="itinerary-card-theme-badge">${themeMeta[item.theme].label}</span>`
      : `<span class="itinerary-card-theme-badge">${themeMeta.sightseeing.label}</span>`;

    if (state.selectedItineraryDate === "all") {
      // Dynamic Static Overview-Compact Card (Address Hidden)
      card.className = `itinerary-card itinerary-card-overview-compact${item.id === state.selectedItineraryId ? " active" : ""}`;

      const transLabels = { walk: "🚶‍♂️ 도보", car: "🚗 자동차", bus: "🚌 대중교통", etc: "✈️ 항공/기타", none: "" };
      const transLabel = transLabels[item.trans] || "";

      let statsBadgeRow = "";
      if (item.duration > 0 || item.cost > 0) {
        statsBadgeRow = `
          <div class="overview-compact-badges">
            ${item.duration > 0 ? `<span class="overview-compact-badge time">⏱️ ${item.duration}분</span>` : ""}
            ${item.cost > 0 ? `<span class="overview-compact-badge cost">🪙 ${formatWon(item.cost)}</span>` : ""}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="overview-compact-left">
          <span class="overview-compact-time">${item.time || "시간 미정"}</span>
          ${transLabel ? `<span class="overview-compact-trans">${transLabel}</span>` : ""}
        </div>
        <div class="overview-compact-center">
          <div class="overview-compact-place-row">
            ${themeBadgeHtml}
            <strong class="overview-compact-place" data-address="${escapeHtml(item.location)}" title="클릭하여 주소 복사">${escapeHtml(item.place)}</strong>
          </div>
          ${item.memo ? `<p class="overview-compact-memo">${escapeHtml(item.memo)}</p>` : ""}
        </div>
        <div class="overview-compact-right">
          ${statsBadgeRow}
          <div class="overview-compact-actions">
            <button type="button" class="overview-compact-btn edit" data-itinerary-action="edit" data-id="${escapeHtml(item.id)}">수정</button>
            <button type="button" class="overview-compact-btn delete" data-itinerary-action="delete" data-id="${escapeHtml(item.id)}">삭제</button>
          </div>
        </div>
      `;

      // Copy address on clicking place name
      const placeEl = card.querySelector(".overview-compact-place");
      if (placeEl) {
        placeEl.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent selectItineraryItem selection jump
          const address = placeEl.dataset.address;
          if (address) {
            navigator.clipboard.writeText(address).then(() => {
              showToast("주소가 클립보드에 복사되었습니다 📋");
            }).catch(err => {
              console.error("복사 실패:", err);
            });
          }
        });
      }
    } else {
      // Original Editable Itinerary Card for individual days
      card.className = `itinerary-card${item.id === state.selectedItineraryId ? " active" : ""}`;
      card.setAttribute("draggable", "true");

      let statsBadgeRow = "";
      if (item.duration > 0 || item.cost > 0) {
        statsBadgeRow = `
          <div class="itinerary-card-badges">
            ${item.duration > 0 ? `<span class="time-badge">⏱️ ${item.duration}분</span>` : ""}
            ${item.cost > 0 ? `<span class="cost-badge">🪙 ${formatWon(item.cost)}</span>` : ""}
          </div>
        `;
      }

      const cardDayNum = day ? day.label.replace(/[^0-9]/g, "") : "";
      const cardDayLabel = day ? `Day${cardDayNum}` : "-";

      card.innerHTML = `
        <div class="itinerary-card-top">
          <div class="itinerary-title-group">
            <span class="day-label">${cardDayLabel}</span>
            <strong class="itinerary-card-place">${escapeHtml(item.place)}</strong>
            ${themeBadgeHtml}
          </div>
          <div class="itinerary-card-controls">
            <input type="text" class="inline-time-input" data-id="${escapeHtml(item.id)}" value="${escapeHtml(item.time || "")}" placeholder="시간 미정" title="직접 시간 입력 (24H)" />
            <select class="inline-trans-select" data-id="${escapeHtml(item.id)}" title="이동 수단">
              <option value="none" ${item.trans === "none" ? "selected" : ""}>이동 선택</option>
              <option value="walk" ${item.trans === "walk" ? "selected" : ""}>도보</option>
              <option value="car" ${item.trans === "car" ? "selected" : ""}>자동차</option>
              <option value="bus" ${item.trans === "bus" ? "selected" : ""}>대중교통</option>
              <option value="etc" ${item.trans === "etc" ? "selected" : ""}>항공/기타</option>
            </select>
          </div>
        </div>
        <button class="itinerary-card-map" type="button" data-itinerary-action="map" data-id="${escapeHtml(item.id)}" title="지도에서 보기">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" /><path d="M12 10.5h.01" /></svg>
          <span>${escapeHtml(item.location)}</span>
        </button>
        <label class="itinerary-memo-shell">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M8 4h8l2 2v14H6V6l2-2Z" /><path d="M9 10h6M9 14h6" /></svg>
          <input type="text" class="inline-memo-input" data-id="${escapeHtml(item.id)}" value="${escapeHtml(item.memo || "")}" placeholder="메모 추가..." title="메모 직접 입력" />
        </label>
        <div class="itinerary-card-footer">
          ${statsBadgeRow}
          <div class="itinerary-card-actions">
            <button type="button" data-itinerary-action="edit" data-id="${escapeHtml(item.id)}">수정</button>
            <button type="button" data-itinerary-action="delete" data-id="${escapeHtml(item.id)}">삭제</button>
          </div>
        </div>
      `;
    }

    // Click handler for selecting item / showing map preview
    card.addEventListener("click", (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "SELECT" ||
        e.target.closest(".itinerary-card-actions") ||
        e.target.closest(".overview-compact-actions") ||
        e.target.closest(".itinerary-card-map")
      ) {
        return;
      }
      selectItineraryItem(item.id);
    });

    // Drag events for card reordering
    card.addEventListener("dragstart", (e) => {
      if (state.selectedItineraryDate === "all") {
        e.preventDefault();
        return;
      }
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", item.id);
      card.classList.add("itinerary-dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("itinerary-dragging");
      els.itineraryList.querySelectorAll(".itinerary-card").forEach(c => {
        c.classList.remove("itinerary-drag-over");
      });
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      const draggingCard = els.itineraryList.querySelector(".itinerary-dragging");
      if (draggingCard && draggingCard !== card) {
        card.classList.add("itinerary-drag-over");
      }
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("itinerary-drag-over");
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("itinerary-drag-over");
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId && draggedId !== item.id) {
        swapItineraryItems(draggedId, item.id);
      }
    });

    els.itineraryList.appendChild(card);
  });

  // Attach event listeners for inline fields
  els.itineraryList.querySelectorAll(".inline-time-input").forEach(inputEl => {
    inputEl.addEventListener("input", () => {
      let raw = inputEl.value.replace(/[^0-9:]/g, "");
      if (raw.length === 4 && !raw.includes(":")) {
        raw = raw.substring(0, 2) + ":" + raw.substring(2);
      }
      inputEl.value = raw;

      if (/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(raw)) {
        updateInlineItineraryField(inputEl.dataset.id, "time", raw);
      }
    });

    inputEl.addEventListener("blur", () => {
      const normalized = parseTypedTime(inputEl.value);
      updateInlineItineraryField(inputEl.dataset.id, "time", normalized || "");
    });
  });

  els.itineraryList.querySelectorAll(".inline-memo-input").forEach(inputEl => {
    inputEl.addEventListener("change", () => {
      updateInlineItineraryField(inputEl.dataset.id, "memo", inputEl.value.trim());
    });
  });

  els.itineraryList.querySelectorAll(".inline-trans-select").forEach(selectEl => {
    selectEl.addEventListener("change", () => {
      updateInlineItineraryField(selectEl.dataset.id, "trans", selectEl.value);
    });
  });

  const selected = findItineraryItem(state.selectedItineraryId) || items[0] || state.itineraryItems[0];
  if (selected) updateMapPreview(selected);
  else updateMapPreview({ place: state.tripName || getDefaultTripName(), location: state.tripName || "대한민국" });
}

function showToast(message) {
  let toast = document.querySelector(".toss-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toss-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove("show");
  // force reflow
  void toast.offsetWidth;
  toast.classList.add("show");

  if (toast.timeoutId) clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

window.TripLog.register("features.itinerary.render", {
  renderItineraryPage,
  renderItineraryDaySelect,
  renderItineraryDayStrip,
  renderItineraryList,
  showToast,
});
