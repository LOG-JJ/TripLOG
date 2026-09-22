/* Handles opt into touch-action:none, so pickup needs no browser long press.
   The rest of the card retains native page scrolling and existing actions. */
function setupItineraryPointerDrag(list, cancelNative) {
  let session = null, frame = 0, landingGhost = null, suppressClickUntil = 0;
  const announcement = document.createElement('div');
  announcement.className = 'itinerary-drag-announcement';
  announcement.setAttribute('role', 'status'); announcement.setAttribute('aria-live', 'polite');
  list.after(announcement);
  const hint = document.createElement('span'); hint.id = 'itineraryDragInstructions'; hint.className = 'itinerary-drag-announcement';
  hint.textContent = '손잡이를 잡고 위아래로 이동하세요. 키보드는 Alt와 위아래 방향키로 순서를 바꿀 수 있습니다.';
  announcement.after(hint);
  const rows = () => [...list.querySelectorAll(':scope > .timeline-stop')];
  const valid = drag => drag && !itineraryReorderPending && drag.tripId === state.id && drag.date === state.selectedItineraryDate
    && drag.source.isConnected && findItineraryItem(drag.id)?.date === drag.date;

  function scrollParent(node) {
    for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight + 1) return parent;
    }
    return document.scrollingElement;
  }
  function stopCapture(drag) {
    cancelAnimationFrame(frame); frame = 0;
    session = null; // lostpointercapture must not cancel a completed drop.
    if (list.hasPointerCapture(drag.pointerId)) list.releasePointerCapture(drag.pointerId);
    document.body.classList.remove('itinerary-pointer-dragging');
    drag.source.classList.remove('is-dragging');
    drag.handle.setAttribute('aria-pressed', 'false');
    suppressClickUntil = performance.now() + 350;
  }
  function cancel({ animate = false } = {}) {
    landingGhost?.remove(); landingGhost = null;
    if (!session) return;
    const drag = session, rects = animate ? drag.preview.capture({ floating: true }) : null;
    stopCapture(drag); drag.preview.finish();
    if (rects) animateItineraryDrop(list, rects);
    announcement.textContent = '일정 이동을 취소했어요.';
  }
  function update(now) {
    const drag = session;
    if (!valid(drag)) { cancel(); return; }
    const elapsed = Math.min(32, now - drag.lastFrame || 16); drag.lastFrame = now;
    if (drag.moved) {
      const root = drag.scrollParent === document.scrollingElement;
      const viewport = window.visualViewport;
      const bounds = root ? { top: (viewport?.offsetTop || 0) + 12, bottom: (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - 104 }
        : drag.scrollParent.getBoundingClientRect();
      const edge = 64;
      const amount = drag.y < bounds.top + edge ? -Math.min(1, (bounds.top + edge - drag.y) / edge)
        : drag.y > bounds.bottom - edge ? Math.min(1, (drag.y - bounds.bottom + edge) / edge) : 0;
      if (amount) drag.scrollParent.scrollTop += Math.sign(amount) * amount ** 2 * 650 * elapsed / 1000;
      const boundsX = list.getBoundingClientRect();
      drag.inside = drag.x >= boundsX.left - 24 && drag.x <= boundsX.right + 24 && drag.y >= 0 && drag.y <= innerHeight;
      const target = drag.inside ? drag.preview.targetAt(drag.y) : null;
      if (target && findItineraryItem(target.row.dataset.id)?.date === drag.date) {
        drag.target = target; drag.preview.update(target);
        const order = list.dataset.dragPreviewOrder;
        if (order !== drag.lastOrder) {
          drag.lastOrder = order;
          announcement.textContent = `${drag.place}, ${order.split(',').indexOf(drag.id) + 1}번째 위치`;
        }
      } else { drag.target = null; drag.preview.reset(); }
    }
    drag.preview.move(drag.x, drag.y);
    frame = requestAnimationFrame(update);
  }
  async function drop() {
    const drag = session;
    if (!valid(drag) || !drag.moved || !drag.target || !drag.inside || !drag.preview.changed()) { cancel({ animate: true }); return; }
    const rects = drag.preview.capture({ floating: true });
    stopCapture(drag);
    drag.preview.finish({ keepGhost: true }); landingGhost = drag.preview.ghost;
    const heldGhost = landingGhost;
    const opacity = drag.source.style.opacity;
    drag.source.style.opacity = '0';
    try {
      // saveAndRender renders synchronously; start the landing before awaiting
      // durable storage so a slow disk cannot replay the animation later.
      const saving = moveItineraryItem(drag.id, drag.target.row.dataset.id, drag.target.placement);
      drag.source.style.opacity = opacity; heldGhost.remove();
      if (state.id === drag.tripId && state.selectedItineraryDate === drag.date) {
        animateItineraryDrop(list, rects, drag.id);
      }
      const saved = await saving;
      if (state.id === drag.tripId && state.selectedItineraryDate === drag.date) {
        rows().find(row => row.dataset.id === drag.id)?.querySelector('.timeline-drag-handle')?.focus({ preventScroll: true });
        announcement.textContent = saved ? `${drag.place} 일정을 옮겼어요.` : '변경한 순서의 저장 상태를 확인해 주세요.';
      }
    } catch (error) {
      showToast('일정 순서의 저장 상태를 확인해 주세요.');
      console.error('Itinerary reorder did not finish', error);
    } finally {
      drag.source.style.opacity = opacity; heldGhost.remove();
      if (landingGhost === heldGhost) landingGhost = null;
    }
  }
  list.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.timeline-drag-handle'), source = handle?.closest('.timeline-stop');
    const item = source && findItineraryItem(source.dataset.id);
    if (!handle || !item || handle.disabled || event.button !== 0 || event.isPrimary === false || itineraryReorderPending
      || state.selectedItineraryDate === 'all' || item.date !== state.selectedItineraryDate || rows().length < 2) return;
    event.preventDefault(); event.stopPropagation();
    cancel(); cancelNative();
    handle.focus({ preventScroll: true });
    const preview = createItineraryDragPreview(list, source, event, { pointer: true });
    if (!preview) return;
    session = { id: item.id, tripId: state.id, date: item.date, place: itineraryPlaceLabel(item), source, handle, preview,
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      target: null, inside: true, moved: false, lastFrame: performance.now(), scrollParent: scrollParent(list), viewportWidth: window.visualViewport?.width || innerWidth };
    list.setPointerCapture(event.pointerId);
    handle.setAttribute('aria-pressed', 'true'); source.classList.add('is-dragging');
    document.body.classList.add('itinerary-pointer-dragging');
    preview.activate(); preview.move(event.clientX, event.clientY);
    announcement.textContent = `${session.place} 선택. 원하는 위치로 끌어 주세요.`;
    frame = requestAnimationFrame(update);
  });
  list.addEventListener('pointermove', event => {
    if (!session || event.pointerId !== session.pointerId) return;
    event.preventDefault();
    const latest = event.getCoalescedEvents?.().at(-1) || event;
    session.x = latest.clientX; session.y = latest.clientY;
    if (Math.hypot(session.x - session.startX, session.y - session.startY) >= 4) session.moved = true;
  });
  list.addEventListener('pointerup', event => {
    if (!session || event.pointerId !== session.pointerId) return;
    event.preventDefault();
    // Use the release position even when pointermove and pointerup share a frame.
    session.x = event.clientX; session.y = event.clientY;
    cancelAnimationFrame(frame); update(performance.now());
    void drop();
  });
  list.addEventListener('pointercancel', event => { if (event.pointerId === session?.pointerId) cancel({ animate: true }); });
  list.addEventListener('lostpointercapture', event => { if (event.pointerId === session?.pointerId) cancel({ animate: true }); });
  list.addEventListener('click', event => {
    if (event.target.closest('.timeline-drag-handle') || performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  list.addEventListener('contextmenu', event => { if (session || event.target.closest('.timeline-drag-handle')) event.preventDefault(); });
  document.addEventListener('pointerdown', event => {
    suppressClickUntil = 0;
    if (session && event.pointerId !== session.pointerId) cancel({ animate: true });
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') cancel({ animate: true }); }, true);
  // Mobile browser chrome changes viewport height while edge-scrolling. Keep
  // the drag alive; width/orientation changes invalidate the measured rows.
  const resize = () => { if (session && Math.abs((window.visualViewport?.width || innerWidth) - session.viewportWidth) > 1) cancel(); };
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('pagehide', () => cancel());
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  return { cancel, get active() { return !!session; } };
}

window.TripLog.register('features.itinerary.pointerDrag', { setup: setupItineraryPointerDrag });
