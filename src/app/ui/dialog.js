(() => {
  'use strict';
  const options = new WeakMap();

  function create({ id, className = 'rd-dialog', labelledBy = `${id}Title`, markup = '', dismissOutside = false, fallbackFocus, onClose } = {}) {
    const dialog = document.createElement('dialog');
    dialog.id = id;
    dialog.className = className;
    dialog.setAttribute('aria-labelledby', labelledBy);
    dialog.innerHTML = markup;
    options.set(dialog, { labelledBy });
    dialog.addEventListener('close', () => {
      onClose?.(dialog);
      const target = dialog.returnFocus?.isConnected ? dialog.returnFocus : fallbackFocus?.();
      target?.focus({ preventScroll: true });
    });
    if (dismissOutside) dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function open(dialog, { focusTitle = true, returnFocus = document.activeElement } = {}) {
    if (!dialog) return;
    dialog.returnFocus = returnFocus;
    if (!dialog.open) dialog.showModal();
    if (focusTitle) document.getElementById(options.get(dialog)?.labelledBy)?.focus({ preventScroll: true });
  }

  window.TripLog.register('ui.dialog', { create, open });
})();
