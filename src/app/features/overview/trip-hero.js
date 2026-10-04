(() => {
  'use strict';
  const text = value => escapeHtml(String(value ?? ''));
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const scenes = () => window.TripLog.shared.destinationScenes;
  function render({ trip, countdown, period, duration, memberCount, expanded = false }) {
    const scene = scenes().resolve(trip), title = String(trip.tripName || '새로운 여행');
    const members = Math.max(0, Math.floor(Number(memberCount) || 0));
    return `<section class="rd-trip-hero rd-outline th-trip-hero" aria-label="여행 정보" data-destination-id="${text(scene.destinationId)}" data-destination-match="${text(scene.match)}" data-scene="${text(scene.artworkId)}">
      <div class="th-hero-copy">
        <span class="rd-badge th-countdown">${text(countdown)}</span>
        <h2><button type="button" class="rd-trip-name th-trip-name" id="rdOverviewTripButton" data-rd-action="trip-choose" aria-haspopup="dialog" aria-controls="rdTripChooser" aria-expanded="${Boolean(expanded)}" aria-label="여행 바꾸기: ${text(title)}" title="${text(title)}"><span>${text(title)}</span>${icon('caret-down')}</button></h2>
        <div class="th-trip-facts" aria-label="여행 기간과 멤버">
          <span class="th-trip-dates">${icon('calendar-blank')}<span>${text(period)}</span></span>
          <span class="th-trip-duration">${icon('bed')}<span>${text(duration)}</span></span>
          <button type="button" class="rd-team th-trip-members" data-rd-action="invite" aria-label="여행 멤버 ${members}명 보기">${icon('users')}<span>${members}명</span>${icon('caret-right')}</button>
        </div>
      </div>
      <div class="th-hero-scene" aria-hidden="true"><img src="${text(scene.src)}" data-trip-scene data-scene-fallback="${text(scene.fallbackSrc)}" data-scene-universal="${text(scene.universalSrc)}" width="800" height="480" alt="" decoding="async"></div>
    </section>`;
  }
  // One delegated listener also covers new markup after trip changes or sync.
  // Missing artwork must never leave a broken-image icon over the trip controls.
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-trip-scene')) return;
    const current = image.getAttribute('src');
    const next = [image.dataset.sceneFallback, image.dataset.sceneUniversal]
      .find(source => source && source !== current && source !== image.dataset.sceneFailed);
    image.dataset.sceneFailed = current;
    if (next) image.src = next;
    else image.hidden = true;
  }, true);
  // On a first visit the visible image can finish before the worker activates.
  // Warm only that same public city asset once control becomes available, so
  // the illustration the user just saw remains available on an offline reload.
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    const image = document.querySelector('.th-hero-scene img[data-trip-scene]');
    const source = image?.getAttribute('src') || '';
    if (!/^src\/assets\/trip-scenes\/cities\/v\d+\/[a-z0-9-]+\.webp$/.test(source)) return;
    fetch(source).catch(() => {});
  });
  window.TripLog.register('features.overview.tripHero', { render });
})();
