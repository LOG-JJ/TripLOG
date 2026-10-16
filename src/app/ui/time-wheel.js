/* Continuous time wheel. Native touch/trackpad scrolling and interruptible
   click/keyboard motion share one position; only the visible rows are painted. */
window.TripLogTimeWheel = (() => {
  const mod = (number, count) => ((number % count) + count) % count;
  const ease = progress => 1 - (1 - progress) ** 4;

  function create(list, { count, isOpen, onSelect, onEdit, onInteract }) {
    const rows = [...list.children];
    const abort = new AbortController();
    const listen = (node, event, callback, options = {}) => node.addEventListener(event, callback, { ...options, signal: abort.signal });
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    let step = 36, value = 0, animation = null, paintFrame = 0, idleTimer = 0;
    let pointer = null, suppressClickUntil = 0, destroyed = false, lastPainted = [];
    let programPosition = null;

    function measure() { step = rows[0]?.offsetHeight || step; }
    function paint() {
      paintFrame = 0;
      if (destroyed || !isOpen()) return;
      const center = list.scrollTop / step;
      const visible = [];
      for (let index = Math.max(0, Math.floor(center) - 3); index <= Math.min(rows.length - 1, Math.ceil(center) + 3); index++) visible.push(index);
      for (const index of new Set([...lastPainted, ...visible])) {
        const distance = Math.abs(index - center), strength = Math.max(0, 1 - distance);
        const number = rows[index].firstElementChild;
        number.style.transform = `scale(${(8 / 9 + strength / 9).toFixed(3)})`;
        number.style.opacity = String(Math.max(.18, 1 - Math.max(0, distance - .4) * .3));
        number.style.color = `rgb(${Math.round(112 - strength * 95)} ${Math.round(122 - strength * 101)} ${Math.round(139 - strength * 102)})`;
        number.style.fontWeight = String(Math.round(600 + strength * 150));
      }
      lastPainted = visible;
      list.dataset.visualValue = String(mod(Math.round(center), count));
    }
    function queuePaint() { if (!paintFrame) paintFrame = requestAnimationFrame(paint); }
    function position(top) {
      programPosition = top;
      list.scrollTop = top;
      paint();
    }
    function publish(next, source) {
      next = mod(next, count);
      if (next === value) return;
      value = next;
      onSelect(next, source);
    }
    function stopAnimation() {
      if (animation) cancelAnimationFrame(animation.raf);
      animation = null;
      delete list.dataset.animating;
    }
    function rebase() {
      const index = Math.round(list.scrollTop / step);
      const middle = count + mod(index, count);
      if (index !== middle) position(middle * step);
    }
    function move(target, animate = true) {
      stopAnimation(); clearTimeout(idleTimer);
      const start = list.scrollTop, distance = Math.abs(target - start);
      if (!animate || motionPreference.matches || distance < .5) { position(target); rebase(); return; }
      const duration = Math.min(360, 180 + Math.sqrt(distance / step) * 35);
      animation = { target, started: performance.now(), duration, raf: 0 };
      list.dataset.animating = 'true';
      const tick = now => {
        if (destroyed || !isOpen()) { stopAnimation(); return; }
        const current = animation;
        if (!current) return;
        const progress = Math.min(1, (now - current.started) / duration);
        position(start + (target - start) * ease(progress));
        if (progress < 1) current.raf = requestAnimationFrame(tick);
        else { stopAnimation(); position(target); rebase(); }
      };
      animation.raf = requestAnimationFrame(tick);
    }
    function select(next, { animate = true, notify = true } = {}) {
      measure();
      next = mod(Number(next) || 0, count);
      const current = list.scrollTop / step;
      const candidates = [next, count + next, count * 2 + next];
      const nearest = candidates.reduce((a, b) => Math.abs(b - current) < Math.abs(a - current) ? b : a);
      if (notify) publish(next, 'select'); else value = next;
      move(nearest * step, animate);
    }
    function settle() {
      clearTimeout(idleTimer);
      if (destroyed || !isOpen() || animation || pointer?.active) return;
      const nearest = Math.round(list.scrollTop / step);
      publish(nearest, 'scroll');
      move(nearest * step);
    }
    function scheduleSettle() { clearTimeout(idleTimer); idleTimer = setTimeout(settle, 120); }
    function readScroll() {
      if (destroyed || !isOpen()) return;
      queuePaint();
      if (animation || (programPosition !== null && Math.abs(list.scrollTop - programPosition) < 1)) return;
      programPosition = null;
      publish(Math.round(list.scrollTop / step), 'scroll');
      scheduleSettle();
    }
    function interrupt() {
      stopAnimation(); clearTimeout(idleTimer); programPosition = null;
      onInteract();
      stopAnimation(); programPosition = null;
      publish(Math.round(list.scrollTop / step), 'scroll');
    }
    function finish({ commit = true } = {}) {
      clearTimeout(idleTimer);
      const target = animation?.target;
      stopAnimation(); pointer = null;
      if (commit) {
        const index = Math.round((target ?? list.scrollTop) / step);
        publish(index, 'scroll'); position(index * step); rebase();
      }
      if (paintFrame) cancelAnimationFrame(paintFrame);
      paintFrame = 0;
    }
    function sync(next) {
      finish({ commit: false }); measure();
      value = mod(Number(next) || 0, count);
      position((count + value) * step);
    }

    listen(list, 'scroll', readScroll, { passive: true });
    listen(list, 'wheel', interrupt, { passive: true });
    listen(list, 'pointerdown', event => {
      if (event.button !== 0) return;
      // Suppress only the drag's own synthetic click, never a new gesture.
      suppressClickUntil = 0;
      interrupt();
      pointer = { id: event.pointerId, type: event.pointerType, active: true, y: event.clientY, top: list.scrollTop, lastY: event.clientY, lastAt: performance.now(), velocity: 0, moved: false };
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
        event.preventDefault(); list.setPointerCapture(event.pointerId);
      }
    });
    listen(list, 'pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const delta = pointer.y - event.clientY;
      if (Math.abs(delta) > 4) pointer.moved = true;
      if (pointer.type === 'touch') return; // Browser owns native touch inertia.
      if (!pointer.moved) return;
      const now = performance.now(), elapsed = Math.max(1, now - pointer.lastAt);
      pointer.velocity = .55 * pointer.velocity + .45 * (pointer.lastY - event.clientY) / elapsed;
      pointer.lastY = event.clientY; pointer.lastAt = now;
      programPosition = null; list.scrollTop = pointer.top + delta;
      publish(Math.round(list.scrollTop / step), 'scroll'); queuePaint();
    });
    function endPointer(event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      const ended = pointer; pointer = null;
      if (list.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
      if (ended.moved) suppressClickUntil = performance.now() + 350;
      if (ended.type !== 'touch' && ended.moved && event.type !== 'pointercancel') {
        const velocity = performance.now() - ended.lastAt > 80 ? 0 : ended.velocity;
        const projected = Math.max(0, Math.min((rows.length - 1) * step, list.scrollTop + Math.max(-step * 4, Math.min(step * 4, velocity * 130))));
        const index = Math.round(projected / step);
        publish(index, 'select'); move(index * step);
      } else scheduleSettle();
    }
    listen(list, 'pointerup', endPointer);
    listen(list, 'pointercancel', endPointer);
    listen(list, 'lostpointercapture', event => { if (pointer?.id === event.pointerId) { pointer = null; scheduleSettle(); } });
    listen(list, 'click', event => {
      event.preventDefault(); event.stopPropagation();
      if (performance.now() < suppressClickUntil) return;
      // Pointer capture can retarget mouse clicks to the scroller itself.
      const row = event.target.closest('[data-time-option]');
      const index = row ? Number(row.dataset.wheelIndex) : Math.round((event.clientY - list.getBoundingClientRect().top + list.scrollTop - step * 2 - step / 2) / step);
      const next = mod(index, count);
      if (next === value && Math.abs(index * step - list.scrollTop) < step / 2) { finish(); onEdit(); }
      else select(next);
    });
    listen(motionPreference, 'change', () => { if (motionPreference.matches) finish(); });
    listen(document, 'visibilitychange', () => { if (document.hidden) finish(); });
    const resize = new ResizeObserver(() => {
      const nextStep = rows[0]?.offsetHeight;
      if (isOpen() && nextStep && nextStep !== step) sync(value);
    });
    resize.observe(list);
    return {
      select, sync, finish,
      get value() { return value; },
      get step() { return step; },
      get moving() { return !!animation; },
      destroy() { finish({ commit: false }); destroyed = true; abort.abort(); resize.disconnect(); }
    };
  }
  return { create };
})();
