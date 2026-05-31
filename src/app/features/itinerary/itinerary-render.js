function renderItineraryPage() {
  const days = getTripDays();
  if (!days.some((day) => day.date === state.selectedItineraryDate)) {
    state.selectedItineraryDate = days[0]?.date || state.startDate;
  }

  els.itineraryTripName.textContent = state.tripName || getDefaultTripName();
  els.itineraryDateRange.textContent = `${formatReadableDate(state.startDate)} - ${formatReadableDate(state.endDate)}`;
  if (els.itineraryCount) {
    els.itineraryCount.textContent = `${Number(state.itineraryItems?.length || 0).toLocaleString("ko-KR")}건`;
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
    const option = document.createElement("option");
    option.value = day.date;
    option.textContent = `${day.label} · ${day.shortDate}`;
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = `itinerary-day-chip${day.date === state.selectedItineraryDate ? " active" : ""}`;
    button.innerHTML = `
      <strong>${day.label}</strong>
      <span>${day.shortDate} ${day.weekday}</span>
      <em>${count}곳</em>
    `;
    button.addEventListener("click", () => {
      const scrollIntent = captureDayStripScrollIntent(els.itineraryDayStrip, button);
      state.selectedItineraryDate = day.date;
      els.itineraryDaySelect.value = day.date;
      clearItineraryEditMode(false);
      saveAndRender();
      applyDayStripScrollIntent(els.itineraryDayStrip, scrollIntent);
    });
    els.itineraryDayStrip.appendChild(button);
  });
}

function renderItineraryList(days) {
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const items = getFilteredItineraryItems();
  els.itineraryList.replaceChildren();
  els.itineraryEmpty.hidden = items.length > 0;

  items.forEach((item) => {
    const day = dayMap.get(item.date);
    const card = document.createElement("article");
    card.className = `itinerary-card${item.id === state.selectedItineraryId ? " active" : ""}`;
    card.setAttribute("draggable", "true");
    card.setAttribute("data-id", item.id);
    
    let statsBadgeRow = "";
    if (item.duration > 0 || item.cost > 0) {
      statsBadgeRow = `
        <div class="itinerary-card-badges">
          ${item.duration > 0 ? `<span class="time-badge">⏱️ ${item.duration}분</span>` : ""}
          ${item.cost > 0 ? `<span class="cost-badge">🪙 ${formatWon(item.cost)}</span>` : ""}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="itinerary-card-top">
        <div class="itinerary-title-group">
          <span class="day-label">${day ? day.label : "-"}</span>
          <strong class="itinerary-card-place">${escapeHtml(item.place)}</strong>
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

    // Click handler for selecting item / showing map preview
    card.addEventListener("click", (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "SELECT" ||
        e.target.closest(".itinerary-card-actions") ||
        e.target.closest(".itinerary-card-map")
      ) {
        return;
      }
      selectItineraryItem(item.id);
    });

    // Drag events for card reordering
    card.addEventListener("dragstart", (e) => {
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

window.TripLog.register("features.itinerary.render", {
  renderItineraryPage,
  renderItineraryDaySelect,
  renderItineraryDayStrip,
  renderItineraryList,
});
