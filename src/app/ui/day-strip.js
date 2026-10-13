

function setupDayStripDrag(strip) {
  if (!strip) return;

  let dragState = null;

  strip.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (strip.scrollWidth <= strip.clientWidth + 1) return;

    const existingFrame = dayStripScrollAnimations.get(strip);
    if (existingFrame) {
      cancelAnimationFrame(existingFrame);
      dayStripScrollAnimations.delete(strip);
    }

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: strip.scrollLeft,
      moved: false,
      captured: false,
    };
  });

  strip.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const distance = event.clientX - dragState.startX;
    if (!dragState.moved && Math.abs(distance) >= DAY_STRIP_DRAG_THRESHOLD) {
      dragState.moved = true;
      dragState.captured = true;
      strip.setPointerCapture?.(event.pointerId);
      strip.classList.add("is-dragging");
    }

    if (!dragState.moved) return;

    event.preventDefault();
    strip.scrollLeft = dragState.startScrollLeft - distance;
  });

  const finishDrag = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const shouldSuppressClick = dragState.moved;
    if (dragState.captured) strip.releasePointerCapture?.(event.pointerId);
    strip.classList.remove("is-dragging");
    dragState = null;

    if (shouldSuppressClick) suppressNextDayStripClick(strip);
  };

  strip.addEventListener("pointerup", finishDrag);
  strip.addEventListener("pointercancel", finishDrag);
  strip.addEventListener("dragstart", (event) => event.preventDefault());
}

function suppressNextDayStripClick(strip) {
  let timer = 0;
  const blockClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    cleanup();
  };
  const cleanup = () => {
    strip.removeEventListener("click", blockClick, true);
    window.clearTimeout(timer);
  };

  strip.addEventListener("click", blockClick, true);
  timer = window.setTimeout(cleanup, 260);
}

function captureDayStripScrollIntent(strip, button) {
  if (!strip || !button || strip.scrollWidth <= strip.clientWidth + 1) {
    return { scrollLeft: strip?.scrollLeft || 0, direction: null };
  }

  const stripRect = strip.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const direction = buttonRect.left <= stripRect.left + 2
    ? "left"
    : buttonRect.right >= stripRect.right - 2
      ? "right"
      : null;

  return {
    direction,
    scrollLeft: strip.scrollLeft,
    step: getDayStripScrollStep(strip, button),
  };
}

function applyDayStripScrollIntent(strip, intent) {
  if (!strip || !intent) return;

  requestAnimationFrame(() => {
    strip.scrollLeft = intent.scrollLeft || 0;
    if (!intent.direction) return;

    const delta = intent.direction === "right" ? intent.step : -intent.step;
    animateDayStripScroll(strip, delta, DAY_STRIP_EDGE_SCROLL_DURATION);
  });
}

function getDayStripScrollStep(strip, button) {
  const style = window.getComputedStyle(strip);
  const gap = Number.parseFloat(style.columnGap || style.gap) || 10;
  return (button?.getBoundingClientRect().width || strip.clientWidth / 3) + gap;
}

function animateDayStripScroll(strip, delta, duration) {
  const maxScroll = strip.scrollWidth - strip.clientWidth;
  const start = strip.scrollLeft;
  const target = Math.max(0, Math.min(maxScroll, start + delta));
  if (Math.abs(target - start) < 1) return;

  const existingFrame = dayStripScrollAnimations.get(strip);
  if (existingFrame) cancelAnimationFrame(existingFrame);

  const startTime = performance.now();
  const easeOut = (progress) => 1 - Math.pow(1 - progress, 3);

  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    strip.scrollLeft = start + (target - start) * easeOut(progress);

    if (progress < 1) {
      dayStripScrollAnimations.set(strip, requestAnimationFrame(step));
    } else {
      dayStripScrollAnimations.delete(strip);
    }
  };

  dayStripScrollAnimations.set(strip, requestAnimationFrame(step));
}

window.TripLog.register("ui.dayStrip", {
  setupDayStripDrag,
  suppressNextDayStripClick,
  captureDayStripScrollIntent,
  applyDayStripScrollIntent,
  getDayStripScrollStep,
  animateDayStripScroll,
});
