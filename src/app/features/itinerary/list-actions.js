function swapItineraryItems(draggedId, targetId) {
  const draggedItem = state.itineraryItems.find(item => item.id === draggedId);
  const targetItem = state.itineraryItems.find(item => item.id === targetId);
  if (!draggedItem || !targetItem) return;
  
  const tempTime = draggedItem.time;
  draggedItem.time = targetItem.time;
  targetItem.time = tempTime;

  const tempEndTime = draggedItem.endTime;
  draggedItem.endTime = targetItem.endTime;
  targetItem.endTime = tempEndTime;
  
  const tempCreatedAt = draggedItem.createdAt;
  draggedItem.createdAt = targetItem.createdAt;
  targetItem.createdAt = tempCreatedAt;
  
  [draggedItem, targetItem].forEach(item => {
    if (item.syncExpense && item.expenseId && item.cost > 0) {
      state.entries = state.entries.map(entry => {
        if (entry.id === item.expenseId) {
          const transLabels = { walk: "도보", car: "차량", train: "기차", bus: "버스", flight: "비행", etc: "비행", none: "이동" };
          const desc = `${item.place} 이동 경비 (${transLabels[item.trans] || "이동"})`;
          return { ...entry, date: item.date, description: desc };
        }
        return entry;
      });
    }
  });
  
  saveAndRender();
}

function updateInlineItineraryField(id, field, value) {
  const item = findItineraryItem(id);
  if (!item) return;

  if (item[field] === value) return;
  item[field] = value;

  // Bidirectional calculations for start time, end time, and travel duration
  if (field === "time") {
    const dayItems = getFilteredItineraryItems();
    const idx = dayItems.findIndex(x => x.id === id);
    if (idx > 0) {
      const prevItem = dayItems[idx - 1];
      const baseTime = prevItem.endTime || prevItem.time;
      if (baseTime) {
        const diff = getMinutesBetweenTimes(baseTime, value);
        if (!item.transits) {
          item.transits = [{ trans: item.trans || "none", duration: item.duration || 0, cost: item.cost || 0, memo: "" }];
        }
        if (item.transits.length > 0) {
          item.transits[0].duration = diff || 0;
        }
        syncTransitTotals(item);
      }
    }
  }

  if (field === "endTime") {
    const dayItems = getFilteredItineraryItems();
    const idx = dayItems.findIndex(x => x.id === id);
    if (idx < dayItems.length - 1) {
      const nextItem = dayItems[idx + 1];
      if (nextItem.time) {
        const diff = getMinutesBetweenTimes(value, nextItem.time);
        if (!nextItem.transits) {
          nextItem.transits = [{ trans: nextItem.trans || "none", duration: nextItem.duration || 0, cost: nextItem.cost || 0, memo: "" }];
        }
        if (nextItem.transits.length > 0) {
          nextItem.transits[0].duration = diff || 0;
        }
        syncTransitTotals(nextItem);
      }
    }
  }

  if (field === "duration") {
    const dayItems = getFilteredItineraryItems();
    const idx = dayItems.findIndex(x => x.id === id);
    if (idx > 0) {
      const prevItem = dayItems[idx - 1];
      const baseTime = prevItem.endTime || prevItem.time;
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

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function addTravelSegment(id) {
  const item = findItineraryItem(id);
  if (!item) return;

  if (!item.transits) {
    item.transits = [{ trans: item.trans || "none", duration: item.duration || 0, cost: item.cost || 0, memo: "" }];
  }
  item.transits.push({ trans: "walk", duration: 0, cost: 0, memo: "" });

  syncTransitTotals(item);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function deleteTravelSegment(id, index) {
  const item = findItineraryItem(id);
  if (!item || !item.transits || item.transits.length <= index) return;

  item.transits.splice(index, 1);

  syncTransitTotals(item);
  syncSegmentExpense(item);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
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
      const baseTime = prevItem.endTime || prevItem.time;
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

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function syncTransitTotals(item) {
  if (!item.transits || item.transits.length === 0) {
    item.transits = [{ trans: item.trans || "none", duration: item.duration || 0, cost: item.cost || 0, memo: "" }];
  }
  item.duration = item.transits.reduce((acc, x) => acc + (x.duration || 0), 0);
  item.cost = item.transits.reduce((acc, x) => acc + (x.cost || 0), 0);
  item.trans = item.transits[0]?.trans || "none";
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

  if (button.dataset.itineraryAction === "delete") {
    deleteItineraryItem(item.id);
  }
}

window.TripLog.register("features.itinerary.listActions", {
  swapItineraryItems,
  updateInlineItineraryField,
  handleItineraryListAction,
  addTravelSegment,
  deleteTravelSegment,
  updateTravelSegmentField,
  syncTransitTotals,
});
