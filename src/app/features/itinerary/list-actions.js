let itineraryReorderPending = false;
const itineraryCopiesPending = new Set();
const stayBackfillsPending = new Set();
const stayBackfillFailures = new Map();

function canWriteItinerary() {
  if (document.documentElement.dataset.auth !== 'signed-in') return false;
  const record = window.TripLogSyncRepository?.cached(state.id);
  return record?.role !== 'viewer' && !record?.archivedAt;
}

async function copyItineraryImmediately(id) {
  if (itineraryCopiesPending.has(id) || !canWriteItinerary()) return;
  const source = findItineraryItem(id);
  if (!source) return;
  const tripId = state.id, previous = state.itineraryItems;
  const copy = { ...JSON.parse(JSON.stringify(source)), id: createId(), createdAt: Math.max(Date.now(), (Number(source.createdAt) || 0) + 1),
    trans: 'none', transits: [], duration: 0, cost: 0, syncExpense: false };
  for (const key of ['_syncPosition', 'itineraryOrder', 'expenseId', 'linkedReservationId', 'reservationStayDate']) delete copy[key];
  let items = [...previous, copy];
  if (window.TripLogItineraryOrder.rank(source) !== null) items = window.TripLogItineraryOrder.move(items, copy.id, source.id, 'after').items;
  itineraryCopiesPending.add(id);
  state.itineraryItems = items;
  try {
    if (!await saveAndRender()) {
      if (state.id === tripId) {
        state.itineraryItems = state.itineraryItems.filter(item => item.id !== copy.id).map(item => {
          const staged = items.find(row => row.id === item.id), original = previous.find(row => row.id === item.id);
          return original && window.TripLogSyncModel.equal(item, staged) ? original : item;
        });
        render();
      }
      showToast('일정 복사를 저장하지 못했어요. 상단 저장 상태를 확인해 주세요.'); return;
    }
    if (state.id !== tripId) return;
    showToast('일정을 복사했어요.');
    [...els.itineraryList.querySelectorAll('[data-itinerary-action="copy"]')].find(button => button.dataset.id === id)?.focus({ preventScroll: true });
  } finally { itineraryCopiesPending.delete(id); }
}

function backfillReservationStays() {
  const tripId = state.id;
  if (stayBackfillsPending.has(tripId) || !canWriteItinerary() || editingItineraryId) return;
  const model = window.TripLog.features.travelCompanion.model;
  const plan = model.defaultStayItinerary(state);
  if (!plan.addedIds.length) return;
  const signature = window.TripLogSyncModel.signature(plan.itineraryItems.filter(item => plan.addedIds.includes(item.id)));
  if (stayBackfillFailures.get(tripId) === signature) return;
  stayBackfillsPending.add(tripId);
  queueMicrotask(async () => {
    try {
      if (state.id !== tripId || !canWriteItinerary() || editingItineraryId) return;
      const latest = model.defaultStayItinerary(state);
      if (!latest.addedIds.length) return;
      state.itineraryItems = latest.itineraryItems;
      if (!await saveAndRender() && state.id === tripId) {
        const added = new Set(latest.addedIds);
        state.itineraryItems = state.itineraryItems.filter(item => !added.has(item.id));
        stayBackfillFailures.set(tripId, signature);
        render(); showToast('숙소 기본 일정을 저장하지 못했어요. 상단 저장 상태를 확인해 주세요.');
      }
    } finally { stayBackfillsPending.delete(tripId); }
  });
}

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
  if (button.dataset.itineraryAction === "copy") void copyItineraryImmediately(item.id);

  if (button.dataset.itineraryAction === "select") selectItineraryItem(item.id);
  if (button.dataset.itineraryAction === "ticket") window.TripLog.features.itinerary.workspace?.downloadTicket?.(item);

  if (button.dataset.itineraryAction === "delete") {
    deleteItineraryItem(item.id);
  }
}

window.TripLog.register("features.itinerary.listActions", {
  moveItineraryItem,
  copyItineraryImmediately,
  backfillReservationStays,
  handleItineraryListAction,
  syncTransitTotals,
});
