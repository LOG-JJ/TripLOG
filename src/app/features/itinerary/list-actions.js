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

function syncTransitTotals(item) {
  Object.assign(item, window.TripLog.domain.commands.transitTotals(item));
}

function syncSegmentExpense(item) {
  const result = window.TripLog.domain.commands.transitExpense(state, item, createId);
  Object.assign(item, result.item);
  state.entries = result.entries;
  result.deleted.forEach(id => window.TripLog.persistence.stateStorage.markDeletedEntity("expense", id));
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
  if (button.dataset.itineraryAction === "copy") startItineraryEdit(item, { copy: true });

  if (button.dataset.itineraryAction === "select") selectItineraryItem(item.id);
  if (button.dataset.itineraryAction === "ticket") window.TripLog.features.itinerary.workspace?.downloadTicket?.(item);

  if (button.dataset.itineraryAction === "delete") {
    deleteItineraryItem(item.id);
  }
}

window.TripLog.register("features.itinerary.listActions", {
  moveItineraryItem,
  handleItineraryListAction,
  syncTransitTotals,
});
