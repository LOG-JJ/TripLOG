/* Shared itinerary/expense dnd-kit engine and handle. */
(() => {
'use strict';
function handle({label, instructionsId, className = '', disabled = false}) {
  return '<button class="tl-sort-handle '+escapeHtml(className)+'" type="button" aria-describedby="'+escapeHtml(instructionsId)+'" aria-label="'+escapeHtml(label)+' 순서 이동" aria-pressed="false" title="바로 잡아서 이동 · 키보드는 Alt + ↑↓" '+(disabled?'disabled':'')+'><i class="ph ph-dots-six-vertical" aria-hidden="true"></i></button>';
}
/* One pointer engine moves the original card; only a completed drop changes data. */
function setup(options) {
  const { list, itemSelector, rowSelector, group, label, getScope, enabled, find, getItems, getLabel, move } = options;
  const handleSelector = '.tl-sort-handle', bodyClass = options.bodyClass || 'tl-pointer-dragging';
  const capture = options.capture || (() => new Map(units().map(node => [node.dataset.id, node.getBoundingClientRect()])));
  const animateDrop = options.animate || ((before) => {
    if (!before || motion.matches) return;
    const measured = units().map(node => ({node, before: before.get(node.dataset.id), after: node.getBoundingClientRect()}));
    for (const item of measured) if (item.before) {
      const x = item.before.left - item.after.left, y = item.before.top - item.after.top;
      if (Math.abs(x) > .5 || Math.abs(y) > .5) item.node.animate([{transform: 'translate3d('+x+'px,'+y+'px,0)'}, {transform:'translate3d(0,0,0)'}], {duration:180,easing:'cubic-bezier(.2,.8,.25,1)'});
    }
  });
  const kit = window.TripLogDnd, motion = matchMedia('(prefers-reduced-motion: reduce)');
  let manager = null, sortables = [], session = null, generation = 0, suppressClickUntil = 0;
  const announcement = document.createElement('div');
  announcement.className = 'tl-sort-announcement';
  announcement.setAttribute('role', 'status'); announcement.setAttribute('aria-live', 'polite');
  const hint = document.createElement('span');
  hint.id = options.instructionsId; hint.className = 'tl-sort-announcement';
  hint.textContent = '손잡이를 잡고 위아래로 이동하세요. 키보드는 Alt와 위아래 방향키로 순서를 바꿀 수 있습니다.';
  (options.announcementAnchor || list).after(announcement, hint);
  const units = () => [...list.children].filter(node => node.matches(itemSelector));
  const ids = () => units().map(node => node.dataset.id);
  const valid = drag => drag && enabled() && drag.scope === getScope() && drag.item.isConnected && find(drag.id) && (!options.valid || options.valid(find(drag.id)));
  const inside = event => {
    if (!event || event instanceof KeyboardEvent) return true;
    const point = event.changedTouches?.[0] || event.touches?.[0] || event, rect = list.getBoundingClientRect();
    return point.clientX >= rect.left - 24 && point.clientX <= rect.right + 24 && point.clientY >= 0 && point.clientY <= innerHeight;
  };
  function syncConnectors() { options.refreshVisuals?.(); }
  function finishVisuals(drag) {
    document.body.classList.remove(bodyClass);
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
        id: element.dataset.id, index, group, element,
        target: options.target ? options.target(element) : element, collisionDetector: kit.pointerIntersection,
        handle: element.querySelector(handleSelector),
        transition: motion.matches ? null : { duration: 180, easing: 'cubic-bezier(.2,.8,.25,1)' },
      }, manager));
    }
    sortables.forEach(item => {
      item.disabled = !enabled() || nodes.length < 2;
      item.transition = motion.matches ? null : { duration: 180, easing: 'cubic-bezier(.2,.8,.25,1)' };
    });
    list.dataset.reorderEngine = kit ? 'dnd-kit-dom-0.5.1' : 'keyboard';
    list.dataset.reorderComponent = 'shared-sortable-list';
  }
  function cancel({ animate = false } = {}) {
    if (!session) return;
    const drag = session, rects = animate ? capture() : null;
    session = null; generation++;
    // Dispose the operation before a day switch or remote render replaces its DOM.
    manager.actions.stop({ canceled: true });
    manager.destroy(); manager = null; sortables = [];
    list.replaceChildren(...drag.nodes);
    finishVisuals(drag); syncConnectors();
    if (rects) animateDrop(rects);
    announcement.textContent = label + ' 이동을 취소했어요.';
    refresh();
  }
  async function persist(drag, targetId, placement, rects) {
    try {
      const saving = move(drag.id, targetId, placement);
      if (getScope() === drag.scope) animateDrop(rects, drag.id);
      const saved = await saving;
      if (getScope() !== drag.scope) return;
      const row = [...list.querySelectorAll(rowSelector)].find(node => node.dataset.id === drag.id);
      (drag.handle ? row?.querySelector(handleSelector) : row)?.focus({ preventScroll: true });
      announcement.textContent = saved ? `${drag.place} ${label}을 옮겼어요.` : '변경한 순서의 저장 상태를 확인해 주세요.';
    } catch (error) {
      showToast(label + ' 순서의 저장 상태를 확인해 주세요.');
      console.error('List reorder did not finish', error);
    } finally { refresh(); }
  }
  function mount() {
    if (!kit || manager) return;
    manager = new kit.DragDropManager({
      sensors: [kit.PointerSensor.configure({
        activatorElements: source => [source.element],
        activationConstraints: event => event.target.closest(handleSelector) ? []
          : [new kit.PointerActivationConstraints.Distance({ value: 4 })],
        preventActivation: event => {
          if (event.target.closest(handleSelector)) return false;
          return !options.bodyDragTarget || event.pointerType === 'touch' || !event.target.closest(options.bodyDragTarget)
            || !!event.target.closest('button, input, a, textarea, select, [contenteditable]');
        },
      })],
      plugins: defaults => [...defaults.filter(plugin => plugin !== kit.Accessibility),
        kit.Feedback.configure({ feedback: 'default', dropAnimation: null }),
        kit.AutoScroller.configure({ threshold: { x: 0, y: .2 }, acceleration: 12 })],
    });
    manager.monitor.addEventListener('beforedragstart', event => {
      const source = event.operation.source;
      if (!source || !enabled() || units().length < 2) event.preventDefault();
    });
    manager.monitor.addEventListener('dragstart', event => {
      const item = event.operation.source.element, record = find(item.dataset.id), nodes = units();
      const handle = event.nativeEvent?.target.closest(handleSelector);
      session = { id: record.id, place: getLabel(record), item, handle, scope: getScope(), nodes, order: nodes.map(node => node.dataset.id),
        pointerId: event.nativeEvent?.pointerId, viewportWidth: window.visualViewport?.width || innerWidth };
      handle?.focus({ preventScroll: true }); handle?.setAttribute('aria-pressed', 'true');
      document.body.classList.add(bodyClass); list.classList.add('is-sorting');
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
      const rects = capture();
      // Feedback restores the original element in a microtask. Commit before the
      // next paint so the landing animation bridges that cleanup and our render.
      requestAnimationFrame(() => {
        if (session !== drag || epoch !== generation) return;
        session = null; finishVisuals(drag);
        if (canceled) {
          list.replaceChildren(...drag.nodes); refresh(); animateDrop(rects);
          announcement.textContent = label + ' 이동을 취소했어요.'; return;
        }
        if (order.join('|') === drag.order.join('|')) { refresh(); animateDrop(rects); return; }
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
    if (event.target.closest(handleSelector) || performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  list.addEventListener('contextmenu', event => { if (session || event.target.closest(handleSelector)) event.preventDefault(); });
  list.addEventListener('keydown', event => {
    const row = event.target.closest(rowSelector), handle = event.target.closest(handleSelector);
    if (!row || (event.target !== row && !handle) || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); cancel();
    const items = getItems(), index = items.findIndex(item => item.id === row.dataset.id);
    const target = items[index + (event.key === 'ArrowUp' ? -1 : 1)];
    if (!target || !enabled() || options.sameGroup && !options.sameGroup(items[index], target)) return;
    void persist({ id: row.dataset.id, place: getLabel(items[index]), handle, scope: getScope() },
      target.id, event.key === 'ArrowUp' ? 'before' : 'after', capture());
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

window.TripLog.register('ui.sortableList', { setup, handle });

})();
