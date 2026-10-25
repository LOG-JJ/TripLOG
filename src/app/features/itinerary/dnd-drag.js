function setupItineraryDndDrag(list) {
  return window.TripLog.ui.sortableList.setup({
    list, itemSelector: '.timeline-sortable-item:not([data-dnd-placeholder])', rowSelector: '.timeline-stop', group: 'itinerary', label: '일정',
    instructionsId: 'itineraryDragInstructions', bodyClass: 'itinerary-pointer-dragging', bodyDragTarget: '.timeline-stop-body',
    getScope: () => JSON.stringify([state.id, state.selectedItineraryDate]), enabled: () => !itineraryReorderPending && state.selectedItineraryDate !== 'all',
    find: findItineraryItem, getItems: getFilteredItineraryItems, getLabel: itineraryPlaceLabel, move: moveItineraryItem,
    valid: item => item.date === state.selectedItineraryDate, sameGroup: (a, b) => a.date === b.date,
    target: element => element.querySelector('.timeline-stop'), capture: () => captureItineraryPositions(list), animate: (rects, id) => animateItineraryDrop(list, rects, id),
    refreshVisuals: () => {
      const nodes = [...list.children].filter(node => node.matches('.timeline-sortable-item:not([data-dnd-placeholder])'));
      nodes.forEach((item, index) => { const transit = item.querySelector(':scope > .timeline-transit, :scope > .timeline-sortable-gap'); if (transit) transit.hidden = index === 0; item.classList.toggle('is-last', index === nodes.length - 1); });
    },
  });
}
window.TripLog.register('features.itinerary.dndDrag', {setup: setupItineraryDndDrag});
