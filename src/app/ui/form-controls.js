const openFormPopups = new Map();

// Enhance newly rendered forms as well as the initial markup. Native values
// remain the source of truth for validation, existing listeners and persistence.
(() => {
  let ready = false, nextId = 0;
  const selector = 'select:not([multiple]), input[type="date"], input[type="time"]';
  function enhance(root, syncExisting = false) {
    if (!(root instanceof Element) && root !== document) return;
    const inputs = root.matches?.(selector) ? [root] : [];
    inputs.push(...root.querySelectorAll(selector));
    for (const input of inputs) {
      if (!input.isConnected) continue;
      if (!input.id) input.id = `triplogControl${++nextId}`;
      if (input.tagName === 'SELECT') {
        setupCustomSelect(input); if (syncExisting) syncCustomSelect(input);
      } else if (input.type === 'date') {
        setupCustomDatePicker(input); if (syncExisting) syncCustomDatePicker(input);
      } else {
        setupCustomTimePicker(input); if (syncExisting) syncCustomTimePicker(input);
      }
    }
  }
  function setup() {
    if (ready) return;
    ready = true;
    enhance(document);
    new MutationObserver(records => {
      const selects = new Set();
      for (const record of records) {
        // Do not rescan the document or observe the generated control chrome.
        const select = record.target.closest?.('select');
        if (select) selects.add(select);
        if (record.type === 'attributes' && record.target.matches('input[type="date"]')) syncCustomDatePicker(record.target);
        if (record.type === 'attributes' && record.target.matches('input[type="time"]')) syncCustomTimePicker(record.target);
        if (record.type === 'attributes' && ((record.attributeName === 'hidden' && !record.target.hidden) || (record.attributeName === 'open' && record.target.open))) enhance(record.target, true);
        for (const node of record.addedNodes) enhance(node);
      }
      for (const select of selects) syncCustomSelect(select, { rebuild: true });
      pruneDetachedCustomSelects();
      pruneDetachedCustomTimePickers();
      for (const [input] of customDatePickers) if (!input.isConnected) customDatePickers.delete(input);
      for (const [panel] of openFormPopups) if (!panel.isConnected) openFormPopups.delete(panel);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'open'] });
    document.addEventListener('change', event => {
      if (event.target.matches('select')) syncCustomSelect(event.target);
      if (event.target.matches('input[type="date"]')) syncCustomDatePicker(event.target);
      const control = customSelects.get(event.target) || customDatePickers.get(event.target);
      if (event.target.validity?.valid) control?.button.removeAttribute('aria-invalid');
    });
    document.addEventListener('invalid', event => {
      const control = customSelects.get(event.target) || customDatePickers.get(event.target);
      if (!control) return;
      event.preventDefault();
      control.button.setAttribute('aria-invalid', 'true');
      control.button.focus({ preventScroll: true });
      showToast(`${control.button.getAttribute('aria-label') || '입력값'}을 확인해 주세요.`);
    }, true);
    document.addEventListener('close', () => {
      closeAllCustomDatePickers(); closeAllCustomTimePickers(); closeAllCustomSelects();
    }, true);
    let popupFrame = 0;
    const reposition = event => {
      if (!openFormPopups.size || popupFrame) return;
      if (event?.target instanceof Node && [...openFormPopups.keys()].some(panel => panel.contains(event.target))) return;
      popupFrame = requestAnimationFrame(() => {
        popupFrame = 0;
        for (const [panel, { trigger, width }] of openFormPopups) {
          if (panel.isConnected && trigger.isConnected && !panel.hidden) positionFormPopup(panel, trigger, width);
          else openFormPopups.delete(panel);
        }
      });
    };
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    document.addEventListener('scroll', reposition, true);
    // Escape closes the innermost control before a surrounding dialog.
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const shell = event.target.closest('.custom-select, .custom-date, .custom-time')
        || document.querySelector('.custom-time.is-open, .custom-date.is-open, .custom-select.is-open');
      if (!shell?.querySelector('[aria-expanded="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      if (shell.classList.contains('custom-select')) {
        const select = shell.querySelector('select');
        closeCustomSelect(select); customSelects.get(select)?.button.focus({ preventScroll: true });
      } else if (shell.classList.contains('custom-date')) {
        const input = shell.querySelector('input[type="date"]');
        closeCustomDatePicker(input); customDatePickers.get(input)?.button.focus({ preventScroll: true });
      } else handleTimePickerKeydown(event, shell.querySelector('input[type="time"]'));
    }, true);
  }
  window.TripLog.register('ui.formControls', { setup, enhance });
})();

// Keep menus in the same dialog/top layer as their trigger, but outside the
// scrolling form's layout. Clamp both edges on narrow screens.
function positionFormPopup(panel, trigger, preferredWidth) {
  openFormPopups.set(panel, { trigger, width: preferredWidth });
  if (typeof panel.showPopover === 'function') {
    panel.popover = 'manual';
    if (!panel.matches(':popover-open')) panel.showPopover();
  }
  const rect = trigger.getBoundingClientRect();
  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  const offsetTop = viewport?.offsetTop || 0;
  const offsetLeft = viewport?.offsetLeft || 0;
  const requestedWidth = typeof preferredWidth === 'function' ? preferredWidth(rect) : preferredWidth;
  const popupWidth = Math.min(requestedWidth || rect.width, width - 24);
  panel.classList.add('form-popup');
  panel.style.width = `${popupWidth}px`;
  panel.style.left = `${Math.max(offsetLeft + 12, Math.min(rect.left, offsetLeft + width - popupWidth - 12))}px`;
  panel.style.maxHeight = `${height - 24}px`;
  panel.style.setProperty('--control-available-height', `${height - 24}px`);
  const popupHeight = Math.min(panel.offsetHeight, height - 24);
  const below = offsetTop + height - rect.bottom - 12;
  const top = below >= popupHeight || rect.top - offsetTop < popupHeight + 12
    ? Math.min(rect.bottom + 7, offsetTop + height - popupHeight - 12)
    : rect.top - popupHeight - 7;
  panel.style.top = `${Math.max(offsetTop + 12, top)}px`;
}

function hideFormPopup(panel) {
  openFormPopups.delete(panel);
  if (typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) panel.hidePopover();
  panel.hidden = true;
}
