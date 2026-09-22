let itineraryReorderPending = false;
async function moveItineraryItem(draggedId, targetId, placement = 'before') {
  if (itineraryReorderPending || state.selectedItineraryDate === 'all') return false;
  const dragged = findItineraryItem(draggedId);
  if (!dragged || dragged.date !== state.selectedItineraryDate) return false;
  const result = window.TripLogItineraryOrder.move(state.itineraryItems, draggedId, targetId, placement);
  if (!result.changed) return false;
  const tripId = state.id;
  itineraryReorderPending = true;
  state.itineraryItems = result.items;
  state.selectedItineraryId = draggedId;
  try {
    const saved = await saveAndRender();
    if (state.id !== tripId) return saved;
    showToast(!saved ? '순서를 저장하지 못했어요. 상단 저장 상태에서 다시 시도해 주세요.'
      : window.TripLogSyncRepository.cached(tripId)?.conflicts.length ? '순서 변경을 보관했어요. 저장 상태에서 겹친 변경을 확인해 주세요.'
      : '일정 순서를 변경했어요.');
    return saved;
  } finally { itineraryReorderPending = false; }
}

function updateInlineItineraryField(id, field, value) {
  const item = findItineraryItem(id);
  if (!item) return;

  if (field === 'endTime' && item.theme === 'lodging') return;

  if (item[field] === value) return;
  item[field] = value;

  // Keep transit duration as the fixed value between adjacent places.
  if (field === "time") {
    const dayItems = getFilteredItineraryItems();
    const idx = dayItems.findIndex(x => x.id === id);
    if (idx > 0) {
      const prevItem = dayItems[idx - 1];
      const transitDuration = getTransitDurationMinutes(item);
      const calculatedEndTime = addMinutesToTime(value, -transitDuration);
      if (calculatedEndTime && prevItem.theme !== 'lodging') {
        prevItem.endTime = calculatedEndTime;
      }
    }
  }

  if (field === "endTime") {
    const dayItems = getFilteredItineraryItems();
    const idx = dayItems.findIndex(x => x.id === id);
    if (idx < dayItems.length - 1) {
      const nextItem = dayItems[idx + 1];
      const transitDuration = getTransitDurationMinutes(nextItem);
      const calculatedStartTime = addMinutesToTime(value, transitDuration);
      if (calculatedStartTime) {
        nextItem.time = calculatedStartTime;
      }
    }
  }

  if (field === "duration") {
    const dayItems = getFilteredItineraryItems();
    const idx = dayItems.findIndex(x => x.id === id);
    if (idx > 0) {
      const prevItem = dayItems[idx - 1];
      const baseTime = (prevItem.theme === 'lodging' ? '' : prevItem.endTime) || prevItem.time;
      if (baseTime) {
        const calculatedTime = addMinutesToTime(baseTime, Number(value) || 0);
        if (calculatedTime) {
          item.time = calculatedTime;
        }
      }
    }
  }

  // Synchronize travel expenses in main ledger
  syncSegmentExpense(item);

  saveAndRender();
}

function addTravelSegment(id) {
  const item = findItineraryItem(id);
  if (!item) return;

  if (!item.transits) {
    item.transits = [{ trans: item.trans || "none", duration: item.duration || 0, cost: item.cost || 0, memo: "" }];
  }
  item.transits.push({ trans: "walk", duration: 0, cost: 0, memo: "" });

  syncTransitTotals(item);

  saveAndRender();
}

function deleteTravelSegment(id, index) {
  const item = findItineraryItem(id);
  if (!item || !item.transits || item.transits.length <= index) return;

  item.transits.splice(index, 1);

  syncTransitTotals(item);
  syncSegmentExpense(item);

  saveAndRender();
}

function updateTravelSegmentField(id, index, field, value) {
  const item = findItineraryItem(id);
  if (!item) return;

  if (!item.transits) {
    item.transits = [{ trans: item.trans || "none", duration: item.duration || 0, cost: item.cost || 0, memo: "" }];
  }
  if (item.transits.length <= index) return;

  if (item.transits[index][field] === value) return;
  item.transits[index][field] = value;

  // Recalculate totals
  syncTransitTotals(item);

  // If travel duration changed, auto-update current start time from preceding item
  if (field === "duration") {
    const dayItems = getFilteredItineraryItems();
    const idx = dayItems.findIndex(x => x.id === id);
    if (idx > 0) {
      const prevItem = dayItems[idx - 1];
      const baseTime = (prevItem.theme === 'lodging' ? '' : prevItem.endTime) || prevItem.time;
      if (baseTime) {
        const calculatedTime = addMinutesToTime(baseTime, item.duration);
        if (calculatedTime) {
          item.time = calculatedTime;
        }
      }
    }
  }

  // Sync expenses
  syncSegmentExpense(item);

  saveAndRender();
}

function syncTransitTotals(item) {
  if (!item.transits || item.transits.length === 0) {
    item.transits = [{ trans: item.trans || "none", duration: item.duration || 0, cost: item.cost || 0, memo: "" }];
  }
  item.duration = item.transits.reduce((acc, x) => acc + (x.duration || 0), 0);
  item.cost = item.transits.reduce((acc, x) => acc + (x.cost || 0), 0);
  item.trans = item.transits[0]?.trans || "none";
}

function getTransitDurationMinutes(item) {
  if (!item) return 0;
  syncTransitTotals(item);
  return Math.max(0, Number(item.duration) || 0);
}

function syncSegmentExpense(item) {
  if (item.syncExpense && item.cost > 0) {
    const transLabels = { walk: "도보", car: "차량", train: "기차", bus: "버스", flight: "비행", etc: "비행", none: "이동" };
    const segmentsDesc = item.transits.map(x => transLabels[x.trans] || "이동").filter(Boolean).join("+");
    const desc = `${item.place} 이동 경비 (${segmentsDesc})`;
    
    if (item.expenseId) {
      state.entries = state.entries.map(entry => {
        if (entry.id === item.expenseId) {
          return { ...entry, date: item.date, amount: item.cost, description: desc };
        }
        return entry;
      });
    } else {
      const newEntry = createEntry(item.date, "교통", desc, item.cost, "일정 자동 연동");
      item.expenseId = newEntry.id;
      state.entries.push(newEntry);
    }
  } else if (item.expenseId && (item.cost <= 0 || !item.syncExpense)) {
    window.TripLog.persistence.stateStorage.markDeletedEntity("expense", item.expenseId);
    state.entries = state.entries.filter(entry => entry.id !== item.expenseId);
    item.expenseId = null;
  }
}

function handleItineraryListAction(event) {
  const button = event.target.closest("button[data-itinerary-action]");
  if (!button || !els.itineraryList.contains(button)) return;

  event.preventDefault();
  const item = findItineraryItem(button.dataset.id);
  if (!item) return;

  if (button.dataset.itineraryAction === "map") {
    selectItineraryItem(item.id);
  }

  if (button.dataset.itineraryAction === "edit") {
    startItineraryEdit(item);
  }

  if (button.dataset.itineraryAction === "select") selectItineraryItem(item.id);
  if (button.dataset.itineraryAction === "ticket") window.TripLog.features.itinerary.workspace?.downloadTicket?.(item);

  if (button.dataset.itineraryAction === "delete") {
    deleteItineraryItem(item.id);
  }
}

window.TripLog.register("features.itinerary.listActions", {
  moveItineraryItem,
  updateInlineItineraryField,
  handleItineraryListAction,
  addTravelSegment,
  deleteTravelSegment,
  updateTravelSegmentField,
  syncTransitTotals,
  getTransitDurationMinutes,
});
