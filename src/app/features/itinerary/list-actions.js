function swapItineraryItems(draggedId, targetId) {
  const draggedItem = state.itineraryItems.find(item => item.id === draggedId);
  const targetItem = state.itineraryItems.find(item => item.id === targetId);
  if (!draggedItem || !targetItem) return;
  
  const tempTime = draggedItem.time;
  draggedItem.time = targetItem.time;
  targetItem.time = tempTime;
  
  const tempCreatedAt = draggedItem.createdAt;
  draggedItem.createdAt = targetItem.createdAt;
  targetItem.createdAt = tempCreatedAt;
  
  [draggedItem, targetItem].forEach(item => {
    if (item.syncExpense && item.expenseId && item.cost > 0) {
      state.entries = state.entries.map(entry => {
        if (entry.id === item.expenseId) {
          const transLabels = { walk: "도보", car: "자동차", bus: "대중교통", etc: "항공/기타", none: "이동" };
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

  if (field === "trans" || field === "time" || field === "memo") {
    if (item.syncExpense && item.expenseId && item.cost > 0) {
      state.entries = state.entries.map(entry => {
        if (entry.id === item.expenseId) {
          const transLabels = { walk: "도보", car: "자동차", bus: "대중교통", etc: "항공/기타", none: "이동" };
          const desc = `${item.place} 이동 경비 (${transLabels[item.trans] || "이동"})`;
          return { ...entry, description: desc };
        }
        return entry;
      });
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
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
});
