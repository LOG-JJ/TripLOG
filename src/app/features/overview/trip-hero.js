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
      <div class="th-hero-scene" aria-hidden="true"><picture>${scene.mobileSrc ? `<source media="(max-width: 767px)" srcset="${text(scene.mobileSrc)}" data-trip-scene-mobile>` : ''}<img src="${text(scene.src)}" data-trip-scene data-scene-fallback="${text(scene.fallbackSrc)}" data-scene-universal="${text(scene.universalSrc)}" width="800" height="480" alt="" decoding="async"></picture></div>
    </section>`;
  }
  // Missing artwork must never leave a broken-image icon over the trip controls.
  function fallbackScene(image) {
    if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-trip-scene')) return;
    const mobile = image.parentElement?.querySelector('source[data-trip-scene-mobile]');
    if (mobile) {
      const selected = window.matchMedia(mobile.media).matches;
      mobile.remove();
      if (selected) {
        // Let an unavailable optional mobile crop try the desktop painting
        // before the existing bundled-theme/universal fallback chain.
        image.src = image.getAttribute('src');
        return;
      }
    }
    const current = image.getAttribute('src');
    const next = [image.dataset.sceneFallback, image.dataset.sceneUniversal]
      .find(source => source && source !== current && source !== image.dataset.sceneFailed);
    image.dataset.sceneFailed = current;
    if (next) image.src = next;
    else image.hidden = true;
  }
  // One delegated listener also covers new markup after trip changes or sync.
  document.addEventListener('error', event => fallbackScene(event.target), true);
  // A failed <picture> candidate can become complete without another error
  // event after a media change. Decode the explicitly requested candidate:
  // decoding the displayed element can still resolve its previous picture.
  const mobileViewport = window.matchMedia('(max-width: 767px)');
  mobileViewport.addEventListener('change', ({ matches }) => {
    const image = document.querySelector('.th-hero-scene img[data-trip-scene]');
    if (!image || image.hidden) return;
    const source = image.getAttribute('src');
    const mobileSource = () => image.parentElement?.querySelector('source[data-trip-scene-mobile]')?.getAttribute('srcset') || '';
    const mobile = mobileSource();
    if (!mobile) return;
    const candidate = new Image();
    candidate.src = matches ? mobile : source;
    candidate.decode().catch(() => {
      if (image.isConnected && mobileViewport.matches === matches && image.getAttribute('src') === source && mobileSource() === mobile) fallbackScene(image);
    });
  });
  // On a first visit the visible image can finish before the worker activates.
  // Warm only that same public city asset once control becomes available, so
  // the illustration the user just saw remains available on an offline reload.
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    const image = document.querySelector('.th-hero-scene img[data-trip-scene]');
    const source = image?.currentSrc || image?.getAttribute('src') || '';
    if (!source) return;
    const url = new URL(source, document.baseURI);
    if (url.origin !== location.origin || !/^\/src\/assets\/trip-scenes\/cities\/v\d+\/[a-z0-9-]+\.webp$/.test(url.pathname)) return;
    fetch(url.pathname).catch(() => {});
  });
  window.TripLog.register('features.overview.tripHero', { render });
})();
