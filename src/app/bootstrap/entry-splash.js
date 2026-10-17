(function createEntrySplash() {
  'use strict';
  // This small bootstrap runs before the auth markup, so the first paint is the
  // selected splash. It never reads credentials, chooses a trip or changes URLs.
  const root = document.documentElement;
  const splash = document.querySelector('#entrySplash');
  if (!splash) return;
  const $ = selector => splash.querySelector(selector);
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const started = performance.now();
  const params = new URLSearchParams(location.search);
  const deepLink = ['trip', 'invite', 'itinerary', 'code', 'token_hash', 'error', 'type'].some(key => params.has(key)) || Boolean(location.hash);
  const home = !params.get('page') || ['start', 'overview'].includes(params.get('page'));
  const historyReturn = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
  let phase = !home || deepLink || historyReturn ? 'skipped' : 'showing';
  let minimumEnd = started + (motionPreference.matches ? 0 : 1850);
  let poll = 0, deadline = 0, slow = 0, exitTimer = 0;
  let connected = false, motionStarted = false, locked = [], controls = [], restoredStyles = [];
  let surfaceObserver = null, returnFocusToContent = false;
  let progressControl = null;

  const active = () => phase === 'showing' || phase === 'exiting';
  function setPhase(value) { phase = value; root.dataset.splash = value; }
  function mount() {
    if (!active()) return;
    for (const node of [document.querySelector('#authGate'), document.querySelector('#appShell')]) {
      if (!node || locked.some(item => item.node === node)) continue;
      locked.push({ node, inert: node.inert });
      node.inert = true;
    }
    if (locked.length === 2) surfaceObserver?.disconnect();
  }
  function stopAnimations() {
    controls.forEach(control => { try { control.stop(); } catch (_) { /* Animation is optional. */ } });
    controls = [];
  }
  function restoreProperty(node, property) {
    const value = node.style.getPropertyValue(property), priority = node.style.getPropertyPriority(property);
    restoredStyles.push(() => value ? node.style.setProperty(property, value, priority) : node.style.removeProperty(property));
  }
  function animate(...args) {
    const control = window.TripLogMotion.animate(...args);
    controls.push(control);
    return control;
  }
  function complete() {
    if (!active()) return;
    clearInterval(poll); clearTimeout(deadline); clearTimeout(slow); clearTimeout(exitTimer);
    surfaceObserver?.disconnect();
    stopAnimations();
    restoredStyles.forEach(restore => restore()); restoredStyles = [];
    const moveFocus = returnFocusToContent || splash.contains(document.activeElement);
    splash.hidden = true;
    locked.forEach(({ node, inert }) => { node.inert = inert; }); locked = [];
    setPhase('done');
    motionPreference.removeEventListener('change', onMotionPreference);
    window.removeEventListener('pagehide', complete);
    window.removeEventListener('popstate', complete);
    window.removeEventListener('hashchange', complete);
    if (moveFocus) {
      const target = document.querySelector('#appShell:not([hidden]) #tripLibraryTitle, #authGate:not([hidden]) #authGateTitle');
      if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    }
    window.dispatchEvent(new CustomEvent('triplog:splash-complete'));
  }
  function finish({ immediate = false } = {}) {
    if (phase !== 'showing') return;
    returnFocusToContent = splash.contains(document.activeElement);
    clearInterval(poll); clearTimeout(slow);
    $('.entry-splash-continue').hidden = true;
    const engine = window.TripLogMotion;
    if (immediate || motionPreference.matches || !engine?.animate || document.visibilityState === 'hidden') { complete(); return; }
    setPhase('exiting');
    stopAnimations();
    // A separate watchdog makes even an interrupted animation unable to trap entry.
    exitTimer = setTimeout(complete, 1000);
    try {
      const logo = $('.entry-splash-logo');
      const targetLogo = document.querySelector('#appShell:not([hidden]) .rd-header .rd-logo, #authGate:not([hidden]) .rd-logo');
      const from = logo.getBoundingClientRect(), to = targetLogo?.getBoundingClientRect();
      const transition = [
        [$('.entry-splash-progress'), { transform: 'scaleX(1)' }, { at: 0, duration: .18 }],
        [$('.entry-splash-art'), { opacity: [1, 0], transform: ['translateY(0px) scale(1)', 'translateY(-18px) scale(.96)'] }, { at: .08, duration: .36 }],
        [$('.entry-splash-status'), { opacity: 0 }, { at: .12, duration: .2 }],
        [$('.entry-splash-tagline'), { opacity: 0, transform: 'translateY(-8px)' }, { at: .1, duration: .2 }],
        [splash, { backgroundColor: 'rgba(255, 253, 247, 0)' }, { at: .22, duration: .4 }],
      ];
      if (to?.width && to.height && from.width && from.height) {
        restoreProperty(targetLogo, 'visibility'); targetLogo.style.visibility = 'hidden';
        // Blend the raster's paper into the actual destination, outside the
        // overlay's isolated stacking context, while the wordmark travels.
        const flyingLogo = logo.cloneNode(false);
        flyingLogo.className = 'entry-splash-flight-logo';
        flyingLogo.alt = ''; flyingLogo.setAttribute('aria-hidden', 'true');
        flyingLogo.style.cssText = `position:fixed;z-index:10001;pointer-events:none;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;margin:0;max-width:none;mix-blend-mode:multiply;transform-origin:center`;
        document.body.appendChild(flyingLogo);
        restoredStyles.push(() => flyingLogo.remove());
        restoreProperty(logo, 'visibility'); logo.style.visibility = 'hidden';
        const dx = to.left + to.width / 2 - from.left - from.width / 2;
        const dy = to.top + to.height / 2 - from.top - from.height / 2;
        transition.push([flyingLogo, { transform: ['translate(0px, 0px) scale(1, 1)', `translate(${dx}px, ${dy}px) scale(${to.width / from.width}, ${to.height / from.height})`] }, { at: .1, duration: .58, ease: [.76, 0, .24, 1] }]);
      } else {
        transition.push([logo, { opacity: 0, transform: 'translateY(-12px) scale(.98)' }, { at: .1, duration: .4 }]);
      }
      const incomingHeading = document.querySelector('#appShell:not([hidden]) .tl-library-heading, #authGate:not([hidden]) .auth-brand-panel > h1');
      if (incomingHeading) {
        restoreProperty(incomingHeading, 'opacity'); restoreProperty(incomingHeading, 'transform');
        // Let the moving wordmark clear the title before the title becomes legible.
        transition.push([incomingHeading, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] }, { at: .5, duration: .3 }]);
      }
      const exits = [animate(transition, { defaultTransition: { ease: [.22, 1, .36, 1] } })];
      // Reveal actual mounted content, keeping its original styles after the entrance.
      const candidates = document.querySelector('#appShell:not([hidden])')
        ? document.querySelectorAll('.tl-library-search, .tl-library-filters, .tl-passport-entry, #rdTripCreate')
        : document.querySelectorAll('#authGate .auth-brand-panel > p, #authGate .rd-login-art, #authGate .auth-panel');
      const targets = [...candidates].filter(node => node.getClientRects().length).slice(0, 10);
      if (targets.length) {
        targets.forEach(node => { restoreProperty(node, 'opacity'); restoreProperty(node, 'transform'); });
        exits.push(animate(targets, { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] },
          { duration: .36, delay: engine.stagger(.035, { startDelay: .18 }), ease: [.22, 1, .36, 1] }));
      }
      Promise.all(exits).then(complete, complete);
    } catch (_) { complete(); }
  }
  function ready() {
    if (root.dataset.appReady === 'error') { finish({ immediate: true }); return; }
    if (phase !== 'showing') return;
    const initialized = root.dataset.appReady === 'true' && root.dataset.triplogInitialized === 'true';
    const collaboration = window.TripLog?.features?.collaboration?.tripCollaboration;
    const sessionReady = collaboration?.isInitialSessionReady?.();
    const visibleTrips = root.dataset.auth === 'signed-in' && document.querySelector('[data-library-trip]');
    if (initialized && (sessionReady || visibleTrips) && performance.now() >= minimumEnd) finish();
  }
  function startMotion() {
    if (phase !== 'showing' || motionStarted || motionPreference.matches || !window.TripLogMotion?.animate) return;
    motionStarted = true;
    minimumEnd = Math.max(minimumEnd, performance.now() + 1200);
    splash.dataset.motion = 'motion';
    try {
      const sequence = [
        [$('.entry-splash-logo'), { opacity: [0, 1], transform: ['translateY(18px) scale(.92)', 'translateY(0px) scale(1)'] }, { at: 0, duration: .65 }],
        [$('.entry-splash-tagline'), { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] }, { at: .17, duration: .5 }],
        [$('.entry-splash-ground'), { opacity: [0, 1], transform: ['scaleX(.6)', 'scaleX(1)'] }, { at: .3, duration: .7 }],
        [$('.is-blue'), { opacity: [0, 1], transform: ['translate(48px, 32px) rotate(12deg) scale(.88)', 'translate(0px, 0px) rotate(0deg) scale(1)'] }, { at: .22, duration: .8 }],
        [$('.is-pink'), { opacity: [0, 1], transform: ['translate(-48px, 32px) rotate(-11deg) scale(.88)', 'translate(0px, 0px) rotate(0deg) scale(1)'] }, { at: .34, duration: .8 }],
        [$('.is-mint'), { opacity: [0, 1], transform: ['translateY(52px) rotate(6deg) scale(.9)', 'translateY(0px) rotate(0deg) scale(1)'] }, { at: .46, duration: .8 }],
        [$('.entry-splash-route'), { opacity: [0, .8] }, { at: .65, duration: .55 }],
        [$('.entry-splash-plane'), { opacity: [0, 1], transform: ['translate(-38px, 28px) rotate(-14deg)', 'translate(0px, 0px) rotate(0deg)'] }, { at: .65, duration: .9 }],
        [$('.entry-splash-status'), { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] }, { at: .5, duration: .4 }],
      ];
      animate(sequence, { defaultTransition: { ease: [.16, 1, .3, 1] } });
      progressControl = animate($('.entry-splash-progress'), { transform: ['scaleX(.08)', 'scaleX(.78)'] }, { duration: 1.55, ease: [.16, 1, .3, 1] });
    } catch (_) {
      stopAnimations(); splash.dataset.motion = 'fallback';
      splash.querySelectorAll('[style]').forEach(node => { node.style.removeProperty('opacity'); node.style.removeProperty('transform'); });
    }
  }
  function connect() {
    if (connected) return;
    connected = true;
    window.TripLog?.register('ui.entrySplash', { finish, getState: () => phase });
    mount();
    if (phase !== 'showing') return;
    startMotion(); ready();
  }
  function onMotionPreference() {
    if (!motionPreference.matches || !active()) return;
    if (phase === 'exiting') { complete(); return; }
    stopAnimations(); minimumEnd = started;
    splash.querySelectorAll('[style]').forEach(node => { node.style.removeProperty('opacity'); node.style.removeProperty('transform'); });
    ready();
  }
  // This bootstrap bridge is available before the normal module registry exists.
  window.TripLogEntrySplash = { mount, connect, motionReady: startMotion, fail: () => finish({ immediate: true }) };
  setPhase(phase);
  if (phase !== 'showing') return;
  splash.hidden = false;
  // Gate keyboard access as each surface is parsed, even if app.js downloads slowly.
  surfaceObserver = new MutationObserver(mount);
  surfaceObserver.observe(document.body, { childList: true });
  mount();
  $('.entry-splash-continue').addEventListener('click', () => finish({ immediate: true }));
  motionPreference.addEventListener('change', onMotionPreference);
  window.addEventListener('pagehide', complete);
  window.addEventListener('popstate', complete);
  window.addEventListener('hashchange', complete);
  poll = setInterval(ready, 80);
  slow = setTimeout(() => {
    if (phase !== 'showing') return;
    if (progressControl) { try { progressControl.stop(); } catch (_) { /* Optional motion. */ } }
    $('#entrySplashStatus').textContent = '조금만 기다려 주세요';
    $('.entry-splash-continue').hidden = false;
  }, 4500);
  deadline = setTimeout(() => finish({ immediate: true }), 8000);
})();
