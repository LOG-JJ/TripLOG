(() => {
  'use strict';
  const { icon, text } = window.TripLog.ui.markup;
  const tabs = [
    ['overview', 'house', '개요'], ['itinerary', 'calendar-blank', '일정'],
    ['travel', 'suitcase-rolling', '여행'], ['budget', 'wallet', '지출'], ['report', 'chart-bar', '리포트'],
  ];
  // All tabs navigate directly; retain cleanup for restored legacy menu history.
  const menus = {};
  let dialog, panel, content, shade, dock, surface, sourceDock, group = '', returnFocus, baseUrl = '', closing = false;
  let onNavigate, onSelect, historyReturn, pendingTab, rootOverflow = '', transition = 0;
  const animations = new Set();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const historyKey = 'tripNavigation';
  const easing = [.16, 1, .3, 1];

  function buttons() {
    return tabs.map(([page, name, label]) => `<button type="button" data-trip-nav="${page}"${menus[page] ? ' aria-haspopup="dialog" aria-controls="tripNavigationMenu" aria-expanded="false"' : ''}><i class="tl-nav-icon" style="--tl-nav-icon:url('/src/assets/navigation/${name}.svg')" aria-hidden="true"></i><span>${label}</span>${menus[page] ? `<span class="tl-nav-expand" aria-hidden="true">${icon('caret-up')}</span>` : ''}</button>`).join('');
  }
  function animate(element, frames, options = {}) {
    const engine = window.TripLogMotion;
    if (reducedMotion.matches || !engine?.animate) return Promise.resolve();
    const keys = Object.keys(frames[0]);
    const previous = keys.map(key => [key, element.style.getPropertyValue(key), element.style.getPropertyPriority(key)]);
    const keyframes = Object.fromEntries(keys.map(key => [key, frames.map(frame => frame[key])]));
    let control, resolve, finished = false;
    const promise = new Promise(done => { resolve = done; });
    const record = { cancel: finish, finish };
    function finish() {
      if (finished) return; finished = true;
      control?.stop();
      previous.forEach(([key, value, priority]) => value ? element.style.setProperty(key, value, priority) : element.style.removeProperty(key));
      animations.delete(record);
      if (dialog) dialog.dataset.animating = String(animations.size > 0);
      resolve();
    }
    animations.add(record);
    if (dialog) dialog.dataset.animating = 'true';
    try {
      control = engine.animate(element, keyframes, {
        duration: (options.duration ?? 420) / 1000, delay: (options.delay || 0) / 1000,
        ease: ({ 'ease-out': 'easeOut', 'ease-in': 'easeIn' })[options.easing] || options.easing || easing,
      });
      control.then(finish, finish);
    } catch (_) { finish(); }
    return promise;
  }
  function cancelAnimations() {
    animations.forEach(animation => animation.cancel()); animations.clear();
  }
  function dockLayout() {
    if (!sourceDock?.isConnected) return;
    const bounds = sourceDock.getBoundingClientRect(), style = getComputedStyle(sourceDock);
    return { bounds, padding: style.padding, gap: style.gap, columns: style.gridTemplateColumns };
  }
  function positionMenu(layout = dockLayout()) {
    if (!layout) return;
    const { bounds, padding, gap, columns } = layout;
    // The modal's interactive copy has exactly the original dock's geometry.
    // Only the sheet above it enters, resizes or exits.
    Object.assign(dock.style, {
      left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`,
      padding, gap, gridTemplateColumns: columns,
    });
    surface.style.left = `${bounds.left + bounds.width / 2}px`;
    surface.style.bottom = `${innerHeight - bounds.top}px`;
    surface.style.width = `${Math.min(bounds.width, 560)}px`;
    panel.style.maxHeight = `${Math.max(120, bounds.top - 12)}px`;
  }
  function cleanup() {
    if (dialog.open || !group) return;
    transition++;
    cancelAnimations();
    document.documentElement.style.overflow = rootOverflow;
    closing = false; group = ''; pendingTab = null;
    if (historyReturn) { const resolve = historyReturn; historyReturn = null; resolve(); }
    // Authentication can close every native dialog. Retire our marker in place
    // without sending an account boundary through browser history.
    if (history.state?.[historyKey]) {
      const clean = { ...history.state }; delete clean[historyKey]; history.replaceState(clean, '', location.href);
    }
    sync();
  }
  function sync() {
    const current = activePage === 'settlement' ? 'budget' : activePage;
    document.querySelectorAll('[data-trip-nav]').forEach(button => {
      const page = button.dataset.tripNav;
      const selected = page === current;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
      if (menus[page]) button.setAttribute('aria-expanded', String(Boolean(dialog?.open && page === group && !closing)));
    });
  }
  function renderMenu(nextGroup) {
    group = nextGroup;
    const [, name, label] = tabs.find(([page]) => page === group);
    dialog.dataset.group = group;
    document.getElementById('tripNavigationTitle').textContent = label;
    dialog.querySelector('.tl-nav-heading-icon').innerHTML = icon(name);
    content.innerHTML = menus[group].map(([key, name, title, detail, tone], index) => `<button type="button" class="tl-nav-item${index ? '' : ' is-primary'}" data-nav-item="${key}" data-tone="${tone}"><span class="tl-nav-item-icon">${icon(name)}</span><span class="tl-nav-item-copy"><strong>${text(title)}</strong><small>${text(detail)}</small></span>${icon('caret-right')}</button>`).join('');
    sync();
  }
  function historyState() {
    return { ...history.state, [historyKey]: { group, tripId: state.id } };
  }
  function animateRows() {
    [...content.children].forEach((row, index) => animate(row, [
      { opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 300, delay: index * 18, fill: 'backwards' }));
  }
  function openMenu(nextGroup, trigger, { fromHistory = false } = {}) {
    if (!menus[nextGroup] || (closing && !fromHistory)) return;
    // Forward may restore the menu before its Back-dismiss animation ends.
    // Cancel that dismissal and continue from the currently painted position.
    if (closing) { closing = false; group = ''; pendingTab = null; }
    if (dialog.open && group === nextGroup) { if (!fromHistory) dismiss(); return; }
    transition++;
    if (dialog.open) {
      const height = panel.getBoundingClientRect().height;
      const transform = getComputedStyle(panel).transform;
      const opacity = getComputedStyle(panel).opacity;
      const shadeOpacity = getComputedStyle(shade).opacity;
      cancelAnimations();
      renderMenu(nextGroup);
      const nextHeight = panel.getBoundingClientRect().height;
      animate(panel, [{ height: `${height}px`, transform, opacity }, { height: `${nextHeight}px`, transform: 'none', opacity: 1 }], { duration: 360 });
      animate(shade, [{ opacity: shadeOpacity }, { opacity: 1 }], { duration: 220 });
      animateRows();
      if (!fromHistory) history.replaceState(historyState(), '', location.href);
      // Keyboard focus remains on the selected dock control while switching.
      return;
    }
    returnFocus = trigger || (returnFocus?.isConnected && returnFocus.getClientRects().length ? returnFocus :
      [...document.querySelectorAll(`.tl-bottom-nav:not(.tl-nav-dock) [data-trip-nav="${nextGroup}"]`)].filter(button => button.getClientRects().length).at(-1));
    sourceDock = returnFocus?.closest('.tl-bottom-nav');
    if (!sourceDock || sourceDock === dock) sourceDock = [...document.querySelectorAll('.tl-bottom-nav:not(.tl-nav-dock)')].find(nav => nav.getClientRects().length && getComputedStyle(nav).display !== 'none');
    const layout = dockLayout();
    baseUrl = location.href;
    renderMenu(nextGroup);
    rootOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    dialog.dataset.motion = !reducedMotion.matches && window.TripLogMotion?.animate ? 'motion' : 'none';
    positionMenu(layout);
    sync();
    if (!fromHistory) history.pushState(historyState(), '', location.href);
    document.getElementById('tripNavigationTitle').focus({ preventScroll: true });
    animate(panel, [{ opacity: 0, transform: 'translateY(48px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 460 });
    animate(shade, [{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    animateRows();
  }
  async function dismiss({ fromHistory = false, restoreFocus = true, immediate = false } = {}) {
    if (!dialog?.open || closing) return false;
    closing = true;
    const version = ++transition;
    const transform = getComputedStyle(panel).transform, opacity = getComputedStyle(panel).opacity;
    cancelAnimations();
    sync();
    let returned = Promise.resolve();
    if (!fromHistory && history.state?.[historyKey]) {
      returned = new Promise(resolve => { historyReturn = resolve; });
      history.back();
    }
    await Promise.all([
      returned,
      immediate ? undefined : animate(panel, [{ transform, opacity }, { transform: 'translateY(24px)', opacity: 0 }], { duration: 180, easing: [.4, 0, 1, 1] }),
      immediate ? undefined : animate(shade, [{ opacity: getComputedStyle(shade).opacity }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' }),
    ]);
    if (version !== transition) return false;
    const nextTab = pendingTab;
    dialog.close();
    cleanup();
    // Honor the latest tap made during a short closing animation. It supersedes
    // any destination selected before that tap instead of dropping the input.
    if (nextTab) { chooseTab(nextTab.page, nextTab.trigger); return false; }
    if (restoreFocus && returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus({ preventScroll: true });
    return true;
  }
  async function chooseTab(page, trigger) {
    if (closing) { pendingTab = { page, trigger }; return; }
    if (menus[page]) return openMenu(page, trigger);
    if (dialog.open && !await dismiss({ restoreFocus: false })) return;
    onNavigate(page);
  }
  function setup({ navigate, select }) {
    if (dialog) return;
    onNavigate = navigate; onSelect = select;
    // All three original docks and the overlay dock use the same definition.
    document.querySelectorAll('.rd-nav, .itinerary-bottom-nav').forEach(nav => {
      nav.classList.add('tl-bottom-nav'); nav.innerHTML = buttons();
    });
    dialog = document.createElement('dialog');
    dialog.id = 'tripNavigationMenu'; dialog.className = 'tl-nav-menu';
    dialog.setAttribute('aria-labelledby', 'tripNavigationTitle'); dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = `<button type="button" class="tl-nav-backdrop" tabindex="-1" aria-hidden="true"></button><div class="tl-nav-surface"><section class="tl-nav-panel" id="tripNavigationPanel" aria-labelledby="tripNavigationTitle"><div class="tl-nav-handle" aria-hidden="true"></div><header class="tl-nav-heading"><span class="tl-nav-heading-icon" aria-hidden="true"></span><h2 id="tripNavigationTitle" tabindex="-1"></h2><button type="button" class="tl-nav-close" aria-label="메뉴 닫기">${icon('x')}</button></header><div class="tl-nav-content"></div></section></div><nav class="tl-bottom-nav tl-nav-dock" aria-label="주 메뉴">${buttons()}</nav>`;
    document.body.appendChild(dialog);
    panel = document.getElementById('tripNavigationPanel'); content = dialog.querySelector('.tl-nav-content'); shade = dialog.querySelector('.tl-nav-backdrop');
    dock = dialog.querySelector('.tl-nav-dock'); surface = dialog.querySelector('.tl-nav-surface');
    window.addEventListener('resize', () => { if (dialog.open) positionMenu(); });
    window.visualViewport?.addEventListener('resize', () => { if (dialog.open) positionMenu(); });
    dialog.addEventListener('close', cleanup);
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    dialog.addEventListener('click', async event => {
      if (event.target.closest('.tl-nav-close, .tl-nav-backdrop')) { dismiss(); return; }
      const item = event.target.closest('[data-nav-item]');
      if (!item || closing) return;
      const key = item.dataset.navItem;
      if (await dismiss({ restoreFocus: false })) onSelect(key);
    });
    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-trip-nav]');
      const settings = event.target.closest('#itineraryMenuButton,[data-itinerary-menu]');
      if (!tab && !settings) return;
      event.preventDefault(); event.stopImmediatePropagation();
      chooseTab(tab ? tab.dataset.tripNav : 'settings', tab || settings);
    }, true);
    window.addEventListener('popstate', event => {
      if (historyReturn) {
        const resolve = historyReturn; historyReturn = null; resolve();
        if (location.href === baseUrl) event.stopImmediatePropagation();
        return;
      }
      const menu = event.state?.[historyKey];
      if (menu && menus[menu.group] && menu.tripId === state.id && location.href === baseUrl) {
        event.stopImmediatePropagation(); openMenu(menu.group, null, { fromHistory: true }); return;
      }
      if (dialog.open && closing) {
        // A second Back during dismissal is real navigation. Invalidate any
        // deferred menu selection so it cannot override the user's destination.
        dialog.close(); cleanup(); return;
      }
      if (dialog.open) {
        if (location.href === baseUrl) event.stopImmediatePropagation();
        dismiss({ fromHistory: true, immediate: location.href !== baseUrl });
      }
    }, true);
    // Reloading an open-menu history entry starts with an ordinary closed dock.
    if (history.state?.[historyKey]) {
      const clean = { ...history.state }; delete clean[historyKey]; history.replaceState(clean, '', location.href);
    }
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) animations.forEach(animation => animation.finish()); });
    sync();
  }
  window.TripLog.register('navigation.tripNavigation', { setup, sync, dismiss, open: openMenu });
})();
