(function () {
  'use strict';
  const build = document.querySelector('meta[name="triplog-build"]')?.content || 'development';
  const IDLE_MS = 1500, CHECK_MS = 60000;
  const RESUME_KEY = 'triplog.autoUpdate.resume.v1';
  const ATTEMPT_KEY = 'triplog.autoUpdate.attempt.v1';
  let registration, checking, targetBuild, timer, ready = false, reloading = false;
  let lastCheck = 0, lastInteraction = Date.now(), composing = false, pointerDown = false;
  const observedWorkers = new WeakSet();

  function schedule(delay = IDLE_MS) {
    if (!targetBuild || reloading || timer) return;
    timer = setTimeout(() => { timer = null; applyWhenIdle().catch(() => {}); }, delay);
  }
  function editing() {
    const active = document.activeElement;
    return composing || pointerDown || Boolean(document.querySelector('dialog[open]'))
      || Boolean(active?.isContentEditable || active?.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select'));
  }
  function canApply() {
    return document.visibilityState !== 'hidden' && navigator.onLine !== false
      && !editing() && window.TripLog.sync.controller.canReload();
  }
  async function applyWhenIdle() {
    if (!targetBuild || reloading || !canApply()) return;
    const quietFor = Date.now() - lastInteraction;
    if (quietFor < IDLE_MS) { schedule(IDLE_MS - quietFor); return; }
    await window.TripLog.persistence.stateStorage.whenSaved();
    if (!canApply() || Date.now() - lastInteraction < IDLE_MS) { schedule(); return; }
    try {
      const attempt = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) || 'null');
      // A failed/mixed deployment must not turn into a reload loop.
      if (attempt?.build === targetBuild && Date.now() - attempt.at < CHECK_MS) { schedule(CHECK_MS); return; }
      const state = window.TripLog.core.state.state;
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({
        build: targetBuild, tripId: state.id, accountId: window.TripLog.sync.controller.engine.status().accountId,
        selectedDate: state.selectedDate, selectedItineraryDate: state.selectedItineraryDate,
        lastActiveItineraryDate: state.lastActiveItineraryDate, x: window.scrollX, y: window.scrollY,
      }));
      sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ build: targetBuild, at: Date.now() }));
    } catch (_) { return; } // Keep the current screen if its UI state cannot be retained.
    reloading = true;
    location.reload();
  }
  function restoreView() {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null'); } catch (_) { return; }
    if (!saved || saved.build !== build) return;
    const state = window.TripLog.core.state.state;
    if (state.id !== saved.tripId || window.TripLog.sync.controller.engine.status().accountId !== saved.accountId) return;
    try { sessionStorage.removeItem(RESUME_KEY); } catch (_) { return; }
    for (const key of ['selectedDate', 'selectedItineraryDate', 'lastActiveItineraryDate']) if (typeof saved[key] === 'string') state[key] = saved[key];
    if (typeof render === 'function') render();
    requestAnimationFrame(() => window.scrollTo(Number(saved.x) || 0, Number(saved.y) || 0));
  }
  function inspectController() {
    const worker = navigator.serviceWorker?.controller || registration?.active;
    if (!worker) return Promise.resolve();
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const finish = () => { clearTimeout(timeout); channel.port1.close(); channel.port2.close(); resolve(); };
      const timeout = setTimeout(finish, 3000);
      channel.port1.onmessage = event => {
        const next = event.data?.type === 'TRIPLOG_BUILD' && event.data.build;
        if (/^[a-f0-9]{20}$/.test(next || '') && next !== build) { targetBuild = next; schedule(); }
        finish();
      };
      try { worker.postMessage({ type: 'TRIPLOG_GET_BUILD', build }, [channel.port2]); } catch (_) { finish(); }
    });
  }
  function watch(worker) {
    if (!worker || observedWorkers.has(worker)) return;
    observedWorkers.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') inspectController();
      if (worker.state === 'installed') registration?.waiting?.postMessage({ type: 'TRIPLOG_ACTIVATE_UPDATE' });
    });
  }
  async function checkForUpdate(force = false) {
    if (!ready || navigator.onLine === false || document.visibilityState === 'hidden') return;
    if (checking) return checking;
    if (!force && Date.now() - lastCheck < 30000) { schedule(); return; }
    lastCheck = Date.now();
    checking = (async () => {
      if (registration) {
        await registration.update();
        watch(registration.installing);
        registration.waiting?.postMessage({ type: 'TRIPLOG_ACTIVATE_UPDATE' });
        await inspectController();
      } else if (!navigator.serviceWorker?.controller) {
        // Without a usable worker, read only the static app document.
        const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 10000);
        try {
          const response = await fetch('/Travel', { cache: 'no-store', signal: abort.signal });
          const next = response.ok && (await response.text()).match(/name="triplog-build" content="([a-f0-9]{20})"/)?.[1];
          if (next && next !== build) { targetBuild = next; schedule(); }
        } finally { clearTimeout(timeout); }
      }
    })().catch(() => {}).finally(() => { checking = null; });
    return checking;
  }
  async function setup() {
    if (ready) return;
    ready = true;
    const activity = () => { lastInteraction = Date.now(); schedule(); };
    document.addEventListener('pointerdown', () => { pointerDown = true; activity(); }, { passive: true });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(event, () => { pointerDown = false; activity(); }, { passive: true });
    document.addEventListener('compositionstart', () => { composing = true; });
    document.addEventListener('compositionend', () => { composing = false; activity(); });
    for (const event of ['input', 'keydown', 'wheel', 'touchmove', 'focusin']) document.addEventListener(event, activity, { passive: true });
    for (const event of ['close', 'focusout']) document.addEventListener(event, () => schedule(), true);
    window.addEventListener('blur', () => { pointerDown = false; });
    window.addEventListener('triplog:sync-status', () => { restoreView(); schedule(); });
    window.addEventListener('triplog:state-saved', () => schedule());
    const resume = () => { checkForUpdate(); schedule(); };
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resume(); });
    setInterval(resume, CHECK_MS);
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => inspectController());
        registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        registration.addEventListener('updatefound', () => watch(registration.installing));
        watch(registration.installing);
        await inspectController();
      }
    } catch (_) { /* Continue with the normal network and local repository. */ }
    restoreView();
    checkForUpdate(true);
    document.addEventListener('pointerdown', () => navigator.storage?.persist?.().catch(() => {}), { once: true });
  }
  // Old panels may coexist briefly during rollout. They show no prompt.
  window.TripLog.register('sync.lifecycle', { setup, checkForUpdate, hasUpdate: () => false, applyUpdate: () => checkForUpdate(true) });
})();
