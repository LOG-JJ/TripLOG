/* dnd-kit owns live sorting. Capture once at release for the final render. */
function captureItineraryPositions(list) {
  return new Map([...list.querySelectorAll('.timeline-stop, .timeline-transit')]
    .filter(node => !node.hidden && !node.closest('[data-dnd-placeholder]'))
    .map(node => [`${node.classList.contains('timeline-transit') ? 'transit' : 'stop'}:${node.dataset.id}`, node.getBoundingClientRect()]));
}

function animateItineraryDrop(list, previousRects, landedId = '') {
  if (!previousRects || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes = [...list.querySelectorAll('.timeline-stop, .timeline-transit')].filter(node => !node.hidden && !node.closest('[data-dnd-placeholder]'));
  // Batch geometry reads before starting animations, avoiding read/write loops.
  const measurements = nodes.map(node => ({ node, after: node.getBoundingClientRect(),
    before: previousRects.get(`${node.classList.contains('timeline-transit') ? 'transit' : 'stop'}:${node.dataset.id}`) }));
  for (const { node, before, after } of measurements) {
    if (!before) continue;
    const x = before.left - after.left, y = before.top - after.top;
    if (Math.abs(x) > .5 || Math.abs(y) > .5) node.animate([
      { transform: `translate3d(${x}px, ${y}px, 0)` }, { transform: 'translate3d(0, 0, 0)' },
    ], { duration: 180, easing: 'cubic-bezier(.2,.8,.25,1)' });
    if (node.classList.contains('timeline-stop') && node.dataset.id === landedId) {
      const body = node.querySelector('.timeline-stop-body');
      body?.animate([{ boxShadow: '0 0 0 2px #ffe28a' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 240, easing: 'ease-out' });
    }
  }
}

window.TripLog.register('features.itinerary.dragMotion', { capture: captureItineraryPositions, animate: animateItineraryDrop });
