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

  const getTransEmoji = (trans) => {
    switch (trans) {
      case "walk": return "🚶‍♂️";
      case "car": return "🚗";
      case "bus": return "🚌";
      case "etc": return "✈️";
      default: return "🚗";
    }
  };

  const getTransLabel = (trans) => {
    switch (trans) {
      case "walk": return "도보";
      case "car": return "자동차";
      case "bus": return "대중교통";
      case "etc": return "항공/기타";
      default: return "이동";
    }
  };

  const dayMap = new Map(days.map((day) => [day.date, day]));
  const items = getFilteredItineraryItems();
  els.itineraryList.replaceChildren();
  els.itineraryEmpty.hidden = items.length > 0;

  let lastDate = null;
  let prevItem = null;

  items.forEach((item, index) => {
    const day = dayMap.get(item.date);

    // Ensure transits array exists for robust multi-segment data structures
    if (!item.transits) {
      item.transits = [{ trans: item.trans || "none", duration: item.duration || 0, cost: item.cost || 0, memo: "" }];
    }

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

    // Render Travel Connector Box between items of the same day
    if (prevItem && prevItem.date === item.date) {
      if (state.selectedItineraryDate === "all") {
        const travelBox = document.createElement("div");
        travelBox.className = "itinerary-travel-box-readonly";
        
        let segmentsHtml = "";
        item.transits.forEach((seg, sIdx) => {
          if (seg.trans === "none" && !seg.duration && !seg.cost && !seg.memo) return;
          
          const methodLabel = getTransLabel(seg.trans);
          const methodEmoji = getTransEmoji(seg.trans);
          
          let segHtml = `<span class="travel-badge-item">`;
          segHtml += `<span class="travel-badge-method">${methodEmoji} ${methodLabel}</span>`;
          if (seg.duration > 0) segHtml += `<span class="travel-badge-duration">⏱️ ${seg.duration}분</span>`;
          if (seg.cost > 0) segHtml += `<span class="travel-badge-cost">🪙 ${formatWon(seg.cost)}</span>`;
          if (seg.memo) segHtml += `<span class="travel-badge-memo" title="${escapeHtml(seg.memo)}">📝 ${escapeHtml(seg.memo)}</span>`;
          segHtml += `</span>`;
          
          if (sIdx > 0 && segmentsHtml) {
            segmentsHtml += `<span class="travel-badge-arrow">→</span>`;
          }
          segmentsHtml += segHtml;
        });

        travelBox.innerHTML = `
          <div class="travel-connector-dot"></div>
          <div class="travel-inner-readonly">
            ${segmentsHtml || `<span class="travel-badge-item empty">⏱️ 이동 정보 없음</span>`}
          </div>
        `;
        els.itineraryList.appendChild(travelBox);
      } else {
        const travelBox = document.createElement("div");
        travelBox.className = "itinerary-travel-box-edit";
        
        let segmentsHtml = "";
        item.transits.forEach((seg, sIdx) => {
          segmentsHtml += `
            <div class="travel-segment-row" data-id="${escapeHtml(item.id)}" data-index="${sIdx}">
              <div class="travel-segment-main">
                <div class="travel-method-selector">
                  <select class="travel-trans-select" data-id="${escapeHtml(item.id)}" data-index="${sIdx}" title="이동 방법">
                    <option value="none" ${seg.trans === "none" ? "selected" : ""}>🚶‍♂️ 이동 수단</option>
                    <option value="walk" ${seg.trans === "walk" ? "selected" : ""}>🚶‍♂️ 도보</option>
                    <option value="car" ${seg.trans === "car" ? "selected" : ""}>🚗 자동차</option>
                    <option value="bus" ${seg.trans === "bus" ? "selected" : ""}>🚌 대중교통</option>
                    <option value="etc" ${seg.trans === "etc" ? "selected" : ""}>✈️ 항공/기타</option>
                  </select>
                </div>
                
                <div class="travel-time-input-group">
                  <span class="travel-input-label">⏱️</span>
                  <input type="number" class="travel-duration-input" data-id="${escapeHtml(item.id)}" data-index="${sIdx}" value="${seg.duration || ""}" min="0" placeholder="0" />
                  <span class="travel-unit">분</span>
                </div>
                
                <div class="travel-cost-input-group">
                  <span class="travel-input-label">🪙</span>
                  <input type="number" class="travel-cost-input" data-id="${escapeHtml(item.id)}" data-index="${sIdx}" value="${seg.cost || ""}" min="0" placeholder="0" />
                  <span class="travel-unit">원</span>
                </div>

                <div class="travel-segment-memo-row">
                  <input type="text" class="travel-memo-input" data-id="${escapeHtml(item.id)}" data-index="${sIdx}" value="${escapeHtml(seg.memo || "")}" placeholder="📝 비고 입력 (예: 버스 번호, 환승 정보...)" />
                </div>

                ${sIdx === item.transits.length - 1 ? `
                  <button type="button" class="travel-segment-add-btn" data-id="${escapeHtml(item.id)}" title="이동 수단 추가" aria-label="이동 수단 추가">
                    <span>+</span>
                  </button>
                ` : ""}

                ${item.transits.length > 1 ? `
                  <button type="button" class="travel-segment-delete-btn" data-id="${escapeHtml(item.id)}" data-index="${sIdx}" title="세그먼트 삭제">
                    −
                  </button>
                ` : ""}
              </div>
            </div>
          `;
        });

        travelBox.innerHTML = `
          <div class="travel-connector-dot"></div>
          <div class="travel-inner-edit">
            <div class="travel-segments-list">
              ${segmentsHtml}
            </div>
          </div>
        `;
        els.itineraryList.appendChild(travelBox);
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

      const timeDisplay = item.time ? (item.endTime ? `${item.time} ~ ${item.endTime}` : item.time) : "시간 미정";
      const transLabels = { walk: "🚶‍♂️ 도보", car: "🚗 자동차", bus: "🚌 대중교통", etc: "✈️ 항공/기타", none: "" };
      const transLabel = transLabels[item.trans] || "";

      card.innerHTML = `
        <div class="overview-compact-left">
          <span class="overview-compact-time">${timeDisplay}</span>
          ${transLabel ? `<span class="overview-compact-trans">${transLabel}</span>` : ""}
        </div>
        <div class="overview-compact-center">
          <div class="overview-compact-place-row">
            ${themeBadgeHtml}
            <strong class="overview-compact-place" data-address="${escapeHtml(item.location)}" title="클릭하여 주소 복사">${escapeHtml(item.place)}</strong>
            ${(item.voucherName || item.voucherFileName) ? `<span class="overview-compact-ticket-badge" title="${escapeHtml(item.voucherName || "연동된 바우처가 있습니다.")}">🎟️</span>` : ""}
          </div>
          ${item.memo ? `<p class="overview-compact-memo">${escapeHtml(item.memo)}</p>` : ""}
        </div>
        <div class="overview-compact-right">
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
            <div class="card-time-range-group">
              <span class="time-range-icon">🕒</span>
              <input type="text" class="inline-time-input" data-id="${escapeHtml(item.id)}" value="${escapeHtml(item.time || "")}" placeholder="시작" title="시작 시간 (HH:MM)" />
              <span class="inline-time-tilde">~</span>
              <input type="text" class="inline-endtime-input" data-id="${escapeHtml(item.id)}" value="${escapeHtml(item.endTime || "")}" placeholder="종료" title="종료 시간 (HH:MM)" />
            </div>
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
        ${(item.voucherName || item.voucherCode || item.voucherFileName) ? `
          <div class="itinerary-card-ticket-bar">
            <div class="ticket-bar-main">
              <span class="ticket-bar-emoji">🎟️</span>
              <div class="ticket-bar-info">
                <strong class="ticket-bar-name" title="${escapeHtml(item.voucherName || "연동된 바우처")}">${escapeHtml(item.voucherName || "연동된 바우처")}</strong>
                ${item.voucherCode ? `<span class="ticket-bar-code">No. ${escapeHtml(item.voucherCode)}</span>` : ""}
              </div>
              ${item.voucherFile ? `
                <button type="button" class="ticket-bar-view-btn" data-id="${escapeHtml(item.id)}" title="바우처 파일 다운로드/보기">
                  <span>📄 보기</span>
                </button>
              ` : ""}
            </div>
          </div>
        ` : ""}
        <div class="itinerary-card-footer" style="justify-content: flex-end;">
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
    prevItem = item;
  });

  // Initialize custom time pickers for schedule cards
  els.itineraryList.querySelectorAll(".inline-time-input, .inline-endtime-input").forEach(inputEl => {
    if (window.TripLog?.ui?.timePicker?.setupCustomTimePicker) {
      window.TripLog.ui.timePicker.setupCustomTimePicker(inputEl);
    }
  });

  // Attach event listeners for inline fields
  els.itineraryList.querySelectorAll(".inline-time-input").forEach(inputEl => {
    inputEl.addEventListener("change", () => {
      updateInlineItineraryField(inputEl.dataset.id, "time", inputEl.value);
    });
  });

  els.itineraryList.querySelectorAll(".inline-endtime-input").forEach(inputEl => {
    inputEl.addEventListener("change", () => {
      updateInlineItineraryField(inputEl.dataset.id, "endTime", inputEl.value);
    });
  });

  els.itineraryList.querySelectorAll(".inline-memo-input").forEach(inputEl => {
    inputEl.addEventListener("change", () => {
      updateInlineItineraryField(inputEl.dataset.id, "memo", inputEl.value.trim());
    });
  });

  // Attach segment events for Multi-Segment Travel Box
  els.itineraryList.querySelectorAll(".travel-trans-select").forEach(selectEl => {
    selectEl.addEventListener("change", () => {
      const id = selectEl.dataset.id;
      const index = Number(selectEl.dataset.index);
      if (window.TripLog?.features?.itinerary?.listActions?.updateTravelSegmentField) {
        window.TripLog.features.itinerary.listActions.updateTravelSegmentField(id, index, "trans", selectEl.value);
      }
    });
  });

  els.itineraryList.querySelectorAll(".travel-duration-input").forEach(inputEl => {
    inputEl.addEventListener("change", () => {
      const id = inputEl.dataset.id;
      const index = Number(inputEl.dataset.index);
      const val = Number(inputEl.value) || 0;
      if (window.TripLog?.features?.itinerary?.listActions?.updateTravelSegmentField) {
        window.TripLog.features.itinerary.listActions.updateTravelSegmentField(id, index, "duration", val);
      }
    });
  });

  els.itineraryList.querySelectorAll(".travel-cost-input").forEach(inputEl => {
    inputEl.addEventListener("change", () => {
      const id = inputEl.dataset.id;
      const index = Number(inputEl.dataset.index);
      const val = Number(inputEl.value) || 0;
      if (window.TripLog?.features?.itinerary?.listActions?.updateTravelSegmentField) {
        window.TripLog.features.itinerary.listActions.updateTravelSegmentField(id, index, "cost", val);
      }
    });
  });

  els.itineraryList.querySelectorAll(".travel-memo-input").forEach(inputEl => {
    inputEl.addEventListener("change", () => {
      const id = inputEl.dataset.id;
      const index = Number(inputEl.dataset.index);
      if (window.TripLog?.features?.itinerary?.listActions?.updateTravelSegmentField) {
        window.TripLog.features.itinerary.listActions.updateTravelSegmentField(id, index, "memo", inputEl.value.trim());
      }
    });
  });

  els.itineraryList.querySelectorAll(".travel-segment-delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const index = Number(btn.dataset.index);
      if (window.TripLog?.features?.itinerary?.listActions?.deleteTravelSegment) {
        window.TripLog.features.itinerary.listActions.deleteTravelSegment(id, index);
      }
    });
  });

  els.itineraryList.querySelectorAll(".travel-segment-add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (window.TripLog?.features?.itinerary?.listActions?.addTravelSegment) {
        window.TripLog.features.itinerary.listActions.addTravelSegment(id);
      }
    });
  });

  els.itineraryList.querySelectorAll(".ticket-bar-view-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.id;
      const item = window.TripLog.features.itinerary.form.findItineraryItem(itemId);
      if (item && item.voucherFile) {
        const link = document.createElement("a");
        link.href = item.voucherFile;
        link.download = item.voucherFileName || "voucher";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  });

  const selected = findItineraryItem(state.selectedItineraryId) || items[0] || state.itineraryItems[0];
  if (selected) updateMapPreview(selected);
  else updateMapPreview(buildTripMapFallbackItem());
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
