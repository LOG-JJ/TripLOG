/* One pointer engine moves the original card; only a completed drop changes data. */
function setupItineraryDndDrag(list) {
  const kit = window.TripLogDnd, motion = matchMedia('(prefers-reduced-motion: reduce)');
  const itemSelector = '.timeline-sortable-item:not([data-dnd-placeholder])';
  let manager = null, sortables = [], session = null, generation = 0, suppressClickUntil = 0;
  const announcement = document.createElement('div');
  announcement.className = 'itinerary-drag-announcement';
  announcement.setAttribute('role', 'status'); announcement.setAttribute('aria-live', 'polite');
  const hint = document.createElement('span');
  hint.id = 'itineraryDragInstructions'; hint.className = 'itinerary-drag-announcement';
  hint.textContent = '손잡이를 잡고 위아래로 이동하세요. 키보드는 Alt와 위아래 방향키로 순서를 바꿀 수 있습니다.';
  list.after(announcement, hint);
  const units = () => [...list.children].filter(node => node.matches(itemSelector));
  const ids = () => units().map(node => node.dataset.id);
  const valid = drag => drag && !itineraryReorderPending && drag.tripId === state.id && drag.date === state.selectedItineraryDate
    && drag.item.isConnected && findItineraryItem(drag.id)?.date === drag.date;
  const inside = event => {
    if (!event || event instanceof KeyboardEvent) return true;
    const point = event.changedTouches?.[0] || event.touches?.[0] || event, rect = list.getBoundingClientRect();
    return point.clientX >= rect.left - 24 && point.clientX <= rect.right + 24 && point.clientY >= 0 && point.clientY <= innerHeight;
  };
  function syncConnectors() {
    const items = units();
    items.forEach((item, index) => {
      const transit = item.querySelector(':scope > .timeline-transit, :scope > .timeline-sortable-gap');
      if (transit) transit.hidden = index === 0;
      item.classList.toggle('is-last', index === items.length - 1);
    });
  }
  function finishVisuals(drag) {
    document.body.classList.remove('itinerary-pointer-dragging');
    list.classList.remove('is-sorting'); delete list.dataset.dragPreviewOrder;
    drag?.handle?.setAttribute('aria-pressed', 'false');
    suppressClickUntil = performance.now() + 300;
  }
  function refresh() {
    if (session) return;
    syncConnectors(); mount();
    const nodes = units();
    if (manager && (sortables.length !== nodes.length || sortables.some((item, index) => item.element !== nodes[index]))) {
      sortables.forEach(item => item.destroy());
      sortables = nodes.map((element, index) => new kit.Sortable({
        id: element.dataset.id, index, group: 'itinerary', element,
        target: element.querySelector('.timeline-stop'), collisionDetector: kit.pointerIntersection,
        handle: element.querySelector('.timeline-drag-handle'),
        transition: motion.matches ? null : { duration: 180, easing: 'cubic-bezier(.2,.8,.25,1)' },
      }, manager));
    }
    sortables.forEach(item => {
      item.disabled = itineraryReorderPending || state.selectedItineraryDate === 'all' || nodes.length < 2;
      item.transition = motion.matches ? null : { duration: 180, easing: 'cubic-bezier(.2,.8,.25,1)' };
    });
    list.dataset.reorderEngine = kit ? 'dnd-kit-dom-0.5.1' : 'keyboard';
  }
  function cancel({ animate = false } = {}) {
    if (!session) return;
    const drag = session, rects = animate ? captureItineraryPositions(list) : null;
    session = null; generation++;
    // Dispose the operation before a day switch or remote render replaces its DOM.
    manager.actions.stop({ canceled: true });
    manager.destroy(); manager = null; sortables = [];
    list.replaceChildren(...drag.nodes);
    finishVisuals(drag); syncConnectors();
    if (rects) animateItineraryDrop(list, rects);
    announcement.textContent = '일정 이동을 취소했어요.';
    refresh();
  }
  async function persist(drag, targetId, placement, rects) {
    try {
      const saving = moveItineraryItem(drag.id, targetId, placement);
      if (state.id === drag.tripId && state.selectedItineraryDate === drag.date) animateItineraryDrop(list, rects, drag.id);
      const saved = await saving;
      if (state.id !== drag.tripId || state.selectedItineraryDate !== drag.date) return;
      const row = [...list.querySelectorAll('.timeline-stop')].find(node => node.dataset.id === drag.id);
      (drag.handle ? row?.querySelector('.timeline-drag-handle') : row)?.focus({ preventScroll: true });
      announcement.textContent = saved ? `${drag.place} 일정을 옮겼어요.` : '변경한 순서의 저장 상태를 확인해 주세요.';
    } catch (error) {
      showToast('일정 순서의 저장 상태를 확인해 주세요.');
      console.error('Itinerary reorder did not finish', error);
    } finally { refresh(); }
  }
  function mount() {
    if (!kit || manager) return;
    manager = new kit.DragDropManager({
      sensors: [kit.PointerSensor.configure({
        activatorElements: source => [source.element],
        activationConstraints: event => event.target.closest('.timeline-drag-handle') ? []
          : [new kit.PointerActivationConstraints.Distance({ value: 4 })],
        preventActivation: event => {
          if (event.target.closest('.timeline-drag-handle')) return false;
          return event.pointerType === 'touch' || !event.target.closest('.timeline-stop-body')
            || !!event.target.closest('button, input, a, textarea, select, [contenteditable]');
        },
      })],
      plugins: defaults => [...defaults.filter(plugin => plugin !== kit.Accessibility),
        kit.Feedback.configure({ feedback: 'default', dropAnimation: null }),
        kit.AutoScroller.configure({ threshold: { x: 0, y: .2 }, acceleration: 12 })],
    });
    manager.monitor.addEventListener('beforedragstart', event => {
      const source = event.operation.source;
      if (!source || itineraryReorderPending || state.selectedItineraryDate === 'all' || units().length < 2) event.preventDefault();
    });
    manager.monitor.addEventListener('dragstart', event => {
      const item = event.operation.source.element, record = findItineraryItem(item.dataset.id), nodes = units();
      const handle = event.nativeEvent?.target.closest('.timeline-drag-handle');
      session = { id: record.id, place: itineraryPlaceLabel(record), item, handle, tripId: state.id,
        date: state.selectedItineraryDate, nodes, order: nodes.map(node => node.dataset.id),
        pointerId: event.nativeEvent?.pointerId, viewportWidth: window.visualViewport?.width || innerWidth };
      handle?.focus({ preventScroll: true }); handle?.setAttribute('aria-pressed', 'true');
      document.body.classList.add('itinerary-pointer-dragging'); list.classList.add('is-sorting');
      list.dataset.dragPreviewOrder = session.order.join(',');
      announcement.textContent = `${session.place} 선택. 원하는 위치로 끌어 주세요.`;
    });
    manager.monitor.addEventListener('dragover', event => {
      if (!valid(session)) event.preventDefault();
    });
    manager.monitor.addEventListener('dragend', event => {
      const drag = session;
      if (!drag) return;
      const canceled = event.canceled || !valid(drag) || !inside(event.nativeEvent);
      event.canceled = canceled;
      const order = ids(), epoch = generation;
      const rects = captureItineraryPositions(list);
      // Feedback restores the original element in a microtask. Commit before the
      // next paint so the landing animation bridges that cleanup and our render.
      requestAnimationFrame(() => {
        if (session !== drag || epoch !== generation) return;
        session = null; finishVisuals(drag);
        if (canceled) {
          list.replaceChildren(...drag.nodes); refresh(); animateItineraryDrop(list, rects);
          announcement.textContent = '일정 이동을 취소했어요.'; return;
        }
        if (order.join('|') === drag.order.join('|')) { refresh(); animateItineraryDrop(list, rects); return; }
        const index = order.indexOf(drag.id), next = order[index + 1];
        void persist(drag, next || order[index - 1], next ? 'before' : 'after', rects);
      });
    });
  }
  // Observe actual reorders, rather than measuring every card on every pointer move.
  new MutationObserver(() => {
    if (!session) return;
    const order = ids().join(',');
    if (order === list.dataset.dragPreviewOrder) return;
    list.dataset.dragPreviewOrder = order;
    announcement.textContent = `${session.place}, ${ids().indexOf(session.id) + 1}번째 위치`;
  }).observe(list, { childList: true });
  document.addEventListener('pointerdown', event => {
    suppressClickUntil = 0;
    if (session && event.pointerId !== session.pointerId) cancel({ animate: true });
  }, true);
  list.addEventListener('click', event => {
    if (event.target.closest('.timeline-drag-handle') || performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  list.addEventListener('contextmenu', event => { if (session || event.target.closest('.timeline-drag-handle')) event.preventDefault(); });
  list.addEventListener('keydown', event => {
    const row = event.target.closest('.timeline-stop'), handle = event.target.closest('.timeline-drag-handle');
    if (!row || (event.target !== row && !handle) || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); cancel();
    const items = getFilteredItineraryItems(), index = items.findIndex(item => item.id === row.dataset.id);
    const target = items[index + (event.key === 'ArrowUp' ? -1 : 1)];
    if (!target || target.date !== items[index]?.date || state.selectedItineraryDate === 'all' || itineraryReorderPending) return;
    void persist({ id: row.dataset.id, place: itineraryPlaceLabel(items[index]), handle, tripId: state.id, date: state.selectedItineraryDate },
      target.id, event.key === 'ArrowUp' ? 'before' : 'after', captureItineraryPositions(list));
  });
  const resize = () => { if (session && Math.abs((window.visualViewport?.width || innerWidth) - session.viewportWidth) > 1) cancel(); };
  window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('pagehide', () => cancel());
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  motion.addEventListener('change', () => {
    cancel();
    if (motion.matches) list.getAnimations({ subtree: true }).forEach(animation => animation.finish());
    refresh();
  });
  return { cancel, refresh, get active() { return !!session; } };
}

window.TripLog.register('features.itinerary.dndDrag', { setup: setupItineraryDndDrag });
