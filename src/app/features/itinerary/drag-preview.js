function animateItineraryDrop(list, previousRects, landedId = '') {
  if (!previousRects || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const node of list.children) {
    const key = `${node.classList.contains('timeline-transit') ? 'transit' : 'stop'}:${node.dataset.id}`;
    const before = previousRects.get(key);
    if (!before) continue;
    const after = node.getBoundingClientRect(), delta = before.top - after.top, deltaX = before.left - after.left;
    if (Math.abs(delta) > .5 || Math.abs(deltaX) > .5) node.animate([
      { transform: `translate3d(${deltaX}px, ${delta}px, 0)` }, { transform: 'translate3d(0, 0, 0)' },
    ], { duration: 190, easing: 'cubic-bezier(.18,.82,.24,1)' });
    if (node.classList.contains('timeline-stop') && node.dataset.id === landedId) {
      node.querySelector('.timeline-stop-body')?.animate([
        { backgroundColor: '#fff8ad', boxShadow: '0 0 0 2px #fff05a' },
        { backgroundColor: getComputedStyle(node.querySelector('.timeline-stop-body')).backgroundColor, boxShadow: '0 0 0 0 transparent' },
      ], { duration: 300, easing: 'ease-out' });
    }
  }
}

function createItineraryDragPreview(list, source, event, { pointer = false } = {}) {
  const nodes = [...list.children].filter(node => node.matches('.timeline-stop, .timeline-transit'));
  nodes.forEach(node => node.getAnimations().forEach(animation => animation.cancel()));
  const listRect = list.getBoundingClientRect();
  const styles = new Map(nodes.map(node => [node, { transform: node.style.transform, opacity: node.style.opacity }]));
  const units = nodes.filter(node => node.classList.contains('timeline-stop')).map(row => {
    const previous = row.previousElementSibling;
    const transit = previous?.classList.contains('timeline-transit') ? previous : null;
    const rect = row.getBoundingClientRect(), transitRect = transit?.getBoundingClientRect();
    return { row, transit, id: row.dataset.id, height: rect.height, top: rect.top - listRect.top,
      gap: transitRect ? rect.top - transitRect.top : 0, transitTop: transitRect ? transitRect.top - listRect.top : null };
  });
  const dragged = units.find(unit => unit.row === source);
  if (!dragged) return null;

  // The native drag image must remain connected until Chromium captures it.
  const ghost = document.createElement('div');
  ghost.className = pointer ? 'itinerary-touch-ghost' : 'itinerary-page itinerary-drag-image';
  ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
  ghost.style.width = `${listRect.width}px`;
  const clone = source.cloneNode(true);
  clone.classList.remove('is-dragging'); clone.removeAttribute('id'); clone.removeAttribute('tabindex');
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  clone.removeAttribute('draggable');
  ghost.append(clone);
  (pointer ? list.closest('#itineraryPage') || document.body : document.body).append(ghost);
  const startRect = source.getBoundingClientRect();
  if (pointer) {
    ghost.style.left = `${startRect.left}px`; ghost.style.top = `${startRect.top}px`;
    ghost.style.width = `${startRect.width}px`;
  } else event.dataTransfer.setDragImage(ghost, Math.max(0, event.clientX - startRect.left), Math.max(0, event.clientY - startRect.top));

  const item = findItineraryItem(dragged.id);
  const placeholder = document.createElement('div');
  placeholder.className = 'timeline-drag-placeholder';
  placeholder.hidden = true;
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.style.height = `${dragged.height}px`;
  placeholder.innerHTML = `<span class="timeline-drag-placeholder-time">${escapeHtml(item?.time || '')}</span><span class="timeline-drag-placeholder-dot"></span><div><strong>${escapeHtml(itineraryPlaceLabel(item || {}))}</strong><span>여기에 놓기</span></div>`;
  list.append(placeholder);
  // A stable transparent drop surface keeps native drop acceptance intact even
  // when the animated cards move out from underneath a stationary pointer.
  const captureSurface = document.createElement('div');
  captureSurface.className = 'timeline-drag-capture';
  captureSurface.setAttribute('aria-hidden', 'true'); captureSurface.hidden = true;
  list.append(captureSurface);
  let active = true, lastKey = '';
  function apply(ordered) {
    if (!active) return;
    const key = ordered.map(unit => unit.id).join('|');
    if (lastKey === key && !placeholder.hidden) return;
    lastKey = key;
    list.classList.add('is-drag-previewing'); placeholder.hidden = false;
    captureSurface.hidden = pointer;
    const replacementGap = ordered[0].gap || units.find(unit => unit.gap)?.gap || 0;
    let top = units[0].top;
    for (const [index, unit] of ordered.entries()) {
      const gap = index ? unit.gap || replacementGap : 0;
      if (unit.transit) {
        unit.transit.style.opacity = index ? styles.get(unit.transit).opacity : '0';
        unit.transit.style.transform = `translate3d(0, ${top - unit.transitTop}px, 0)`;
      }
      top += gap;
      unit.row.style.transform = `translate3d(0, ${top - unit.top}px, 0)`;
      if (unit === dragged) placeholder.style.transform = `translate3d(0, ${top}px, 0)`;
      top += unit.height;
    }
    list.dataset.dragPreviewOrder = ordered.map(unit => unit.id).join(',');
  }
  let lastSlot = units.indexOf(dragged);
  function targetAt(clientY) {
    const y = clientY - list.getBoundingClientRect().top;
    const others = units.filter(unit => unit !== dragged);
    // Keep hit testing independent of CSS transforms: stationary pointers must
    // not alternate between slots as the neighboring cards animate past them.
    let slot = others.findIndex(unit => y < unit.top + unit.height / 2);
    if (slot < 0) slot = others.length;
    if (pointer && slot !== lastSlot) {
      const boundary = slot > lastSlot ? others[slot - 1] : others[slot];
      if (boundary && Math.abs(y - boundary.top - boundary.height / 2) < 7) slot = lastSlot;
    }
    lastSlot = slot;
    const next = others[slot];
    return next ? { row: next.row, placement: 'before' }
      : others.length ? { row: others.at(-1).row, placement: 'after' } : null;
  }
  function update(target) {
    const ordered = units.filter(unit => unit !== dragged);
    const index = ordered.findIndex(unit => unit.row === target.row);
    if (index < 0) return;
    ordered.splice(index + (target.placement === 'after' ? 1 : 0), 0, dragged);
    apply(ordered);
  }
  function reset() {
    lastSlot = units.indexOf(dragged);
    apply(units); placeholder.hidden = true;
  }
  function capture({ floating = false } = {}) {
    return new Map(nodes.map(node => [`${node.classList.contains('timeline-transit') ? 'transit' : 'stop'}:${node.dataset.id}`,
      node === source && floating ? ghost.getBoundingClientRect() : node === source && !placeholder.hidden ? placeholder.getBoundingClientRect() : node.getBoundingClientRect()]));
  }
  function finish({ keepGhost = false } = {}) {
    if (!active) return;
    active = false;
    list.classList.remove('is-drag-previewing'); delete list.dataset.dragPreviewOrder;
    for (const [node, previous] of styles) { node.style.transform = previous.transform; node.style.opacity = previous.opacity; }
    placeholder.remove(); captureSurface.remove(); if (!keepGhost) ghost.remove();
  }
  // Wait for the first dragover (after native drag activation) before moving or
  // hiding the source. Changing its layout during dragstart can abort the drag.
  return { targetAt, update, reset, capture, finish, ghost,
    activate: () => apply(units),
    changed: () => lastKey !== units.map(unit => unit.id).join('|'),
    move: (x, y) => { if (pointer && active) ghost.style.transform = `translate3d(${Math.max(-10, Math.min(10, (x - event.clientX) * .12))}px, ${y - event.clientY - 3}px, 0)`; }
  };
}

window.TripLog.register('features.itinerary.dragPreview', { create: createItineraryDragPreview, animate: animateItineraryDrop });
