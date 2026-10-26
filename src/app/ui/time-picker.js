let customTimeDocumentClickBound = false;

function attachCustomTimePickerDocumentListener() {
  if (customTimeDocumentClickBound) return;
  customTimeDocumentClickBound = true;

  document.addEventListener("click", (event) => {
    pruneDetachedCustomTimePickers();
    customTimePickers.forEach((control, input) => {
      if (!control.shell.contains(event.target)) {
        if (control.textEntry) {
          finishTimeTextEntry(input);
          if (document.activeElement === control.value) returnTimePickerFocus(control);
        }
        closeCustomTimePicker(input);
      }
    });
  });
}

function pruneDetachedCustomTimePickers() {
  Array.from(customTimePickers.entries()).forEach(([input, control]) => {
    if (!input.isConnected || !control.shell.isConnected) {
      stopTimeWheels(input, true);
      customTimePickers.delete(input);
    }
  });
}

function destroyCustomTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  stopTimeWheels(input, true);
  setTimePickerLayerState(input, false);
  input.classList.remove("native-time-hidden");

  if (control.shell.isConnected && control.shell.contains(input)) {
    control.shell.parentNode?.insertBefore(input, control.shell);
    control.shell.remove();
  }

  customTimePickers.delete(input);
}

function setupCustomTimePicker(input) {
  if (!input) return;
  pruneDetachedCustomTimePickers();
  if (customTimePickers.has(input)) return;

  const shell = document.createElement("div");
  shell.className = "custom-time";
  shell.dataset.timeId = input.id;

  const button = document.createElement("div");
  button.className = "custom-time-button";
  button.setAttribute("role", "combobox");
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");

  const value = document.createElement("input");
  value.type = "text";
  value.className = "custom-time-value";
  value.placeholder = "시간 선택";
  value.inputMode = "numeric";
  value.enterKeyHint = "done";
  value.autocomplete = "off";
  value.setAttribute("aria-label", "시간 직접 입력");
  value.style.border = "none";
  value.style.background = "transparent";
  value.style.outline = "none";
  value.style.width = "100%";
  value.style.font = "inherit";
  value.style.color = "inherit";
  value.style.padding = "0";
  value.style.margin = "0";

  const icon = document.createElement("span");
  icon.className = "custom-time-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.style.cursor = "pointer";
  icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 7v5l3 2" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>';

  const panel = document.createElement("div");
  panel.className = "custom-time-panel control-popover control-time-wheel";
  panel.id = input.id ? `${input.id}Panel` : `customTimePanel${customTimePickers.size + 1}`;
  panel.setAttribute("role", "dialog");
  panel.setAttribute('aria-label', '시간 선택');
  panel.hidden = true;
  button.setAttribute("aria-controls", panel.id);

  input.parentNode.insertBefore(shell, input);
  shell.appendChild(input);
  const chevron = document.createElement('span');
  chevron.className = 'custom-select-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'custom-time-toggle';
  toggle.setAttribute('aria-label', '시간 선택 열기');
  toggle.setAttribute('aria-controls', panel.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-haspopup', 'dialog');
  toggle.append(chevron);
  button.append(icon, value, toggle);
  shell.append(button, panel);
  input.classList.add("native-time-hidden");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  value.id = `${input.id}Text`;
  const label = input.closest("label");
  if (label?.htmlFor === input.id) label.htmlFor = value.id;

  customTimePickers.set(input, { shell, button, value, panel, toggle, openValue: input.value || "", panelDirty: false, textEntry: null });
  attachCustomTimePickerDocumentListener();

  // Pointer users expect the whole field to behave like the clock icon. Open
  // before the browser focuses the text input (and before a mobile keyboard can
  // block the UI). Keyboard users can still focus the input with Tab and type.
  value.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || input.disabled) return;
    if (customTimePickers.get(input)?.textEntry) return;
    event.preventDefault();
    event.stopPropagation();
    focusTimePickerElement(toggle);
    openCustomTimePicker(input);
  });

  // Open panel on keyboard focus.
  value.addEventListener("focus", () => {
    const control = customTimePickers.get(input);
    if (control && !control.textEntry) openCustomTimePicker(input);
  });

  value.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  // Typing formatting and syncing
  value.addEventListener("input", () => {
    let raw = value.value.replace(/[^0-9:]/g, "");
    if (raw.length === 4 && !raw.includes(":")) {
      raw = raw.substring(0, 2) + ":" + raw.substring(2);
    }
    value.value = raw;

    // Check if HH:MM matching valid 24H format
    if (/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(raw)) {
      if (input.value !== raw) {
        input.value = raw;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        refreshOpenTimePickerSelection(input, { animate: true });
      }
    }
  });

  value.addEventListener("keydown", (event) => {
    const control = customTimePickers.get(input);
    if (control?.textEntry && (event.key === 'Enter' || event.key === 'Escape')) {
      event.preventDefault(); event.stopPropagation();
      finishTimeTextEntry(input, { commit: event.key === 'Enter' });
      returnTimePickerFocus(control);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const normalized = parseTypedTime(value.value);
      if (normalized) {
        input.value = normalized;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        syncCustomTimePicker(input);
      }
      closeCustomTimePicker(input);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeCustomTimePicker(input, { commit: false });
      return;
    }

    if (event.key === "ArrowDown" && event.altKey) {
      event.preventDefault();
      openCustomTimePicker(input);
    }
  });

  value.addEventListener("blur", () => {
    if (customTimePickers.get(input)?.textEntry) {
      finishTimeTextEntry(input);
      return;
    }
    setTimeout(() => {
      const currentControl = customTimePickers.get(input);
      if (currentControl?.shell.contains(document.activeElement) || (currentControl && !currentControl.panel.hidden)) {
        return;
      }

      const normalized = parseTypedTime(value.value);
      if (normalized) {
        input.value = normalized;
        input.dispatchEvent(new Event("change"));
      } else {
        value.value = input.value || "";
      }
    }, 0);
  });

  // Icon click toggles time picker
  icon.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    toggleCustomTimePicker(input);
  });

  // Keep focus inside the control on pointer press. Otherwise blur can close
  // the panel before click, and label activation can focus/reopen the text box.
  button.addEventListener('pointerdown', event => {
    if (event.button === 0 && event.target !== value) {
      event.preventDefault(); focusTimePickerElement(toggle);
    }
  });
  toggle.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    toggleCustomTimePicker(input);
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    // Keep the whole trigger clickable after returning focus from the picker.
    if (event.target !== value && event.target !== icon && !icon.contains(event.target)) {
      toggleCustomTimePicker(input);
    }
  });

  button.addEventListener("keydown", (event) => {
    if (event.target === value || toggle.contains(event.target)) return;
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openCustomTimePicker(input);
    }
  });

  input.addEventListener("change", () => syncCustomTimePicker(input));

  // A touch tap can synthesize mousedown and move focus to the surrounding
  // dialog. Keep selection/actions in this control without blocking touch scroll.
  panel.addEventListener('mousedown', event => {
    if (!event.target.closest('.time-wheel-input')) event.preventDefault();
  });
  panel.addEventListener("click", (event) => {
    event.stopPropagation();
    handleTimePickerClick(event, input);
  });
  panel.addEventListener("input", (event) => {
    event.stopPropagation();
    handleTimePickerInput(event, input);
  });
  panel.addEventListener("change", (event) => {
    event.stopPropagation();
    handleTimePickerChange(event, input);
  });
  panel.addEventListener("focusin", (event) => {
    const partInput = event.target.closest("[data-time-part-input]");
    if (partInput) partInput.select();
  });
  panel.addEventListener("keydown", (event) => {
    event.stopPropagation();
    handleTimePickerKeydown(event, input);
  });
  shell.addEventListener('focusout', () => {
    setTimeout(() => { if (!shell.contains(document.activeElement)) closeCustomTimePicker(input); }, 0);
  });
  renderTimePicker(input);
  syncCustomTimePicker(input);
}

function syncCustomTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control) return;
  if (!input.isConnected || !control.shell.isConnected) {
    destroyCustomTimePicker(input);
    return;
  }

  if (control.value instanceof HTMLInputElement) {
    if (document.activeElement !== control.value) {
      control.value.value = input.value || "";
    }
    control.value.placeholder = "시간 선택";
    control.value.disabled = input.disabled;
  } else {
    control.value.textContent = input.value || "시간 선택";
  }

  control.button.classList.toggle("is-disabled", input.disabled);
  control.toggle.disabled = input.disabled;
  control.button.setAttribute('aria-disabled', String(input.disabled));
  if (input.disabled && !control.panel.hidden) closeCustomTimePicker(input, { commit: false });
  if (!control.panel.hidden) renderTimePicker(input);
}

function toggleCustomTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control || control.button.disabled) return;

  if (control.panel.hidden) {
    openCustomTimePicker(input);
  } else {
    closeCustomTimePicker(input);
  }
}

function openCustomTimePicker(input) {
  pruneDetachedCustomTimePickers();
  const control = customTimePickers.get(input);
  // A pointer click also focuses the text input. Do not rebuild the panel twice
  // or reset the original value used to commit changes when it closes.
  if (!control || input.disabled || !control.panel.hidden) return;

  if (control.textEntry) finishTimeTextEntry(input);

  closeAllCustomSelects();
  closeAllCustomDatePickers();
  closeAllCustomTimePickers(input);
  renderTimePicker(input);
  control.openValue = input.value || "";
  control.panelDirty = false;
  control.panel.hidden = false;
  control.button.classList.add("open");
  control.button.setAttribute("aria-expanded", "true");
  control.toggle.setAttribute('aria-expanded', 'true');
  control.toggle.setAttribute('aria-label', '시간 선택 닫기');
  setTimePickerLayerState(input, true);
  positionFormPopup(control.panel, control.button, () => Math.min(224, Math.max(152, control.button.offsetWidth)));
  alignSelectedTimeOptions(input);
}

function closeCustomTimePicker(input, { commit = true } = {}) {
  const control = customTimePickers.get(input);
  if (!control) return;
  if (!input.isConnected || !control.shell.isConnected) {
    stopTimeWheels(input, true);
    customTimePickers.delete(input);
    return;
  }

  if (control.textEntry) finishTimeTextEntry(input, { commit });
  const wasOpen = !control.panel.hidden;
  if (!wasOpen) return;
  let shouldDispatchChange = false;
  if (wasOpen && commit) {
    flushTimeWheels(input);
    const previousValue = control.openValue ?? input.value ?? "";
    if (input.value || control.panelDirty) {
      commitTimePanelInputs(input);
    }
    shouldDispatchChange = input.value !== previousValue;
  }
  if (!commit && input.value !== control.openValue) {
    input.value = control.openValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  stopTimeWheels(input);
  hideFormPopup(control.panel);
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
  control.toggle.setAttribute('aria-expanded', 'false');
  control.toggle.setAttribute('aria-label', '시간 선택 열기');
  setTimePickerLayerState(input, false);
  control.openValue = input.value || "";
  refreshOpenTimePickerSelection(input);
  if (wasOpen && commit && shouldDispatchChange) {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function closeAllCustomTimePickers(exceptInput) {
  pruneDetachedCustomTimePickers();
  Array.from(customTimePickers.keys()).forEach((input) => {
    if (input !== exceptInput) closeCustomTimePicker(input);
  });
}

function setTimePickerLayerState(input, isOpen) {
  const control = customTimePickers.get(input);
  if (!control) return;

  control.shell.classList.toggle("is-open", isOpen);
  control.shell.closest(".itinerary-card")?.classList.toggle("time-picker-active", isOpen);
  control.shell.closest(".pretrip-purchase-panel")?.classList.toggle("time-picker-active", isOpen);
}

function renderTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control) return;
  if (control.panel.childElementCount) { refreshOpenTimePickerSelection(input); return; }
  control.wheels = new Map();
  const grid = document.createElement('div'); grid.className = 'time-panel-grid';
  grid.append(createTimeColumn(input, '시', 'hour', 24), createTimeColumn(input, '분', 'minute', 60));
  const actions = document.createElement('div'); actions.className = 'time-panel-actions';
  actions.innerHTML = '<button type="button" class="time-soft-button" data-time-action="type" aria-label="시간 직접 입력">입력</button><button type="button" class="time-soft-button" data-time-action="clear" aria-label="시간 없음">없음</button><button type="button" class="time-soft-button" data-time-action="close">확인</button>';
  control.panel.append(grid, actions);
  refreshOpenTimePickerSelection(input);
}

function createTimeColumn(input, label, part, count) {
  const control = customTimePickers.get(input);
  const column = document.createElement('div'); column.className = 'time-wheel-column';
  const caption = document.createElement('span'); caption.className = 'time-wheel-label'; caption.textContent = label;
  const frame = document.createElement('div'); frame.className = 'time-wheel-frame';
  const band = document.createElement('div'); band.className = 'time-wheel-band'; band.setAttribute('aria-hidden', 'true');
  const list = document.createElement('div'); list.className = 'time-wheel-list'; list.dataset.timeWheel = part;
  list.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < count * 3; index++) {
    const row = document.createElement('div'); row.className = 'time-wheel-option';
    row.dataset.timeOption = padNumber(index % count); row.dataset.wheelIndex = index;
    const number = document.createElement('span'); number.className = 'time-wheel-number'; number.textContent = row.dataset.timeOption;
    row.append(number); list.append(row);
  }
  const editor = document.createElement('input'); editor.type = 'text'; editor.className = 'time-wheel-input';
  editor.dataset.timePartInput = part; editor.inputMode = 'numeric'; editor.maxLength = 2; editor.autocomplete = 'off';
  editor.setAttribute('role', 'spinbutton'); editor.setAttribute('aria-label', `${label} 직접 입력`);
  editor.setAttribute('aria-valuemin', '0'); editor.setAttribute('aria-valuemax', String(count - 1));
  editor.addEventListener('beforeinput', () => frame.classList.add('is-editing'));
  editor.addEventListener('blur', () => {
    if (!control.panel.hidden && frame.classList.contains('is-editing')) commitTimePartInput(input, editor);
    frame.classList.remove('is-editing');
  });
  frame.append(band, list, editor); column.append(caption, frame);
  const wheel = window.TripLogTimeWheel.create(list, {
    count, isOpen: () => input.isConnected && !input.disabled && !control.panel.hidden,
    onSelect: value => setTimePickerPart(input, part, padNumber(value), { fromWheel: true }),
    onEdit: event => {
      // Touch selects the wheel only. The explicit Input action opens a keyboard.
      if (event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents || (!event.pointerType && matchMedia('(pointer: coarse)').matches)) return;
      frame.classList.add('is-editing'); focusTimePickerElement(editor); editor.select();
    },
    onInteract: () => {
      control.panel.querySelectorAll('.time-wheel-frame.is-editing').forEach(activeFrame => {
        const activeEditor = activeFrame.querySelector('[data-time-part-input]');
        commitTimePartInput(input, activeEditor, { animate: false });
        activeFrame.classList.remove('is-editing');
        if (document.activeElement === activeEditor) returnTimePickerFocus(control);
      });
    }
  });
  control.wheels.set(part, wheel);
  return column;
}

function handleTimePickerClick(event, input) {
  const action = event.target.closest('[data-time-action]')?.dataset.timeAction;
  if (action) { event.preventDefault(); handleTimePickerAction(action, input); }
}

function handleTimePickerInput(event, input) {
  const editor = event.target.closest('[data-time-part-input]');
  const control = customTimePickers.get(input);
  if (!editor || !control || control.panel.hidden) return;
  control.panelDirty = true;
  editor.closest('.time-wheel-frame').classList.add('is-editing');
  editor.value = editor.value.replace(/\D/g, '').slice(0, 2);
  if (editor.value.length === 2) commitTimePartInput(input, editor);
}

function handleTimePickerChange(event, input) {
  if (customTimePickers.get(input)?.panel.hidden) return;
  const editor = event.target.closest('[data-time-part-input]');
  if (editor?.closest('.time-wheel-frame').classList.contains('is-editing')) commitTimePartInput(input, editor);
}

function focusTimePickerElement(element) { element?.focus({ preventScroll: true }); }
function returnTimePickerFocus(control) {
  focusTimePickerElement(control.toggle);
}

function startTimeTextEntry(input) {
  const control = customTimePickers.get(input);
  if (!control || input.disabled) return;
  closeCustomTimePicker(input);
  control.textEntry = { value: input.value || '' };
  control.value.value = input.value || '';
  control.shell.classList.add('is-text-entry');
  // Focus synchronously in the user's click so mobile browsers can open the
  // keyboard, while keeping the wheel closed and the surrounding editor open.
  focusTimePickerElement(control.value);
  control.value.select();
}

function finishTimeTextEntry(input, { commit = true } = {}) {
  const control = customTimePickers.get(input);
  if (!control?.textEntry) return;
  const previous = control.textEntry.value;
  const next = commit ? parseTypedTime(control.value.value) : previous;
  control.textEntry = null;
  control.shell.classList.remove('is-text-entry');
  if (input.value !== next) {
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  control.value.value = input.value || '';
  control.openValue = input.value || '';
  if (commit && input.value !== previous) input.dispatchEvent(new Event('change', { bubbles: true }));
}

function handleTimePickerAction(action, input) {
  const control = customTimePickers.get(input);
  if (!control) return;
  if (action === 'type') { startTimeTextEntry(input); return; }
  if (action === 'clear') {
    stopTimeWheels(input);
    const changed = input.value !== '';
    control.openValue = ''; input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    closeCustomTimePicker(input, { commit: false });
    if (changed) input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (action === 'close') { control.panelDirty = true; closeCustomTimePicker(input); }
  if (action === 'clear' || action === 'close') returnTimePickerFocus(control);
}

function handleTimePickerKeydown(event, input) {
  const control = customTimePickers.get(input);
  if (!control) return;
  if (event.key === 'Escape') {
    event.preventDefault(); closeCustomTimePicker(input, { commit: false }); returnTimePickerFocus(control); return;
  }
  const editor = event.target.closest('[data-time-part-input]');
  if (!editor) return;
  if (event.key === 'Enter') { event.preventDefault(); commitTimePartInput(input, editor); closeCustomTimePicker(input); returnTimePickerFocus(control); return; }
  if (['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
    event.preventDefault(); editor.closest('.time-wheel-frame').classList.remove('is-editing');
    const part = editor.dataset.timePartInput, count = part === 'hour' ? 24 : 60;
    const current = Number(editor.value) || 0;
    const delta = { ArrowUp: 1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[event.key] || 0;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (current + delta + count) % count;
    setTimePickerPart(input, part, padNumber(next));
  }
}

function setTimePickerPart(input, part, value, { fromWheel = false, animate = true } = {}) {
  const control = customTimePickers.get(input);
  if (!control || control.panel.hidden || input.disabled) return;
  control.panelDirty = true;
  const current = getTimePickerSelection(input.value);
  const next = { hour24: part === 'hour' ? value : current.hour24, minute: part === 'minute' ? value : current.minute };
  const composed = composeTimeFromSelection(next), changed = input.value !== composed;
  input.value = composed;
  updateTimeEditor(control, part, value, true);
  control.value.value = input.value;
  if (!fromWheel) control.wheels.get(part)?.select(Number(value), { animate, notify: false });
  if (changed) input.dispatchEvent(new Event('input', { bubbles: true }));
}

function updateTimeEditor(control, part, value, force = false) {
  const editor = control.panel.querySelector(`[data-time-part-input="${part}"]`);
  if (!editor) return;
  if (force || !editor.closest('.time-wheel-frame').classList.contains('is-editing')) editor.value = value;
  editor.setAttribute('aria-valuenow', String(Number(value)));
  editor.setAttribute('aria-valuetext', `${Number(value)}${part === 'hour' ? '시' : '분'}`);
}

function refreshOpenTimePickerSelection(input, { animate = false } = {}) {
  const control = customTimePickers.get(input);
  if (!control) return;
  if (document.activeElement !== control.value) control.value.value = input.value || '';
  const selected = getTimePickerSelection(input.value);
  for (const [part, value] of [['hour', selected.hour24], ['minute', selected.minute]]) {
    updateTimeEditor(control, part, value);
    const wheel = control.wheels?.get(part);
    if (animate && !control.panel.hidden) wheel?.select(Number(value), { notify: false });
    else wheel?.sync(Number(value));
  }
}

function alignSelectedTimeOptions(input) { refreshOpenTimePickerSelection(input); }
function flushTimeWheels(input) { customTimePickers.get(input)?.wheels?.forEach(wheel => wheel.finish()); }
function stopTimeWheels(input, destroy = false) {
  const control = customTimePickers.get(input);
  control?.wheels?.forEach(wheel => destroy ? wheel.destroy() : wheel.finish({ commit: false }));
  control?.panel.querySelectorAll('.is-editing').forEach(frame => frame.classList.remove('is-editing'));
}

function getTimePickerSelection(value) {
  const parsed = parseTimeValue(value) || { hour: '09', minute: '00' };
  return { hour24: padNumber(Number(parsed.hour)), minute: parsed.minute };
}
function composeTimeFromSelection(selection) {
  return `${padNumber(Math.max(0, Math.min(23, Number(selection.hour24) || 0)))}:${padNumber(Math.max(0, Math.min(59, Number(selection.minute) || 0)))}`;
}
function normalizeTimePartInputValue(part, value, fallback = '00') {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? padNumber(Math.max(0, Math.min(part === 'hour' ? 23 : 59, Number(digits)))) : fallback;
}
function commitTimePartInput(input, editor, { animate = true } = {}) {
  const part = editor?.dataset.timePartInput;
  if (!part) return;
  const current = getTimePickerSelection(input.value);
  const normalized = normalizeTimePartInputValue(part, editor.value, part === 'hour' ? current.hour24 : current.minute);
  editor.value = normalized;
  setTimePickerPart(input, part, normalized, { animate });
}
function commitTimePanelInputs(input) {
  const control = customTimePickers.get(input);
  if (!control) return;
  const current = getTimePickerSelection(input.value);
  const hour = control.panel.querySelector('[data-time-part-input="hour"]');
  const minute = control.panel.querySelector('[data-time-part-input="minute"]');
  const next = composeTimeFromSelection({ hour24: normalizeTimePartInputValue('hour', hour?.value, current.hour24), minute: normalizeTimePartInputValue('minute', minute?.value, current.minute) });
  if (input.value !== next) { input.value = next; input.dispatchEvent(new Event('input', { bubbles: true })); }
}

window.TripLog.register('ui.timePicker', {
  setupCustomTimePicker, destroyCustomTimePicker, pruneDetachedCustomTimePickers,
  syncCustomTimePicker, toggleCustomTimePicker, openCustomTimePicker, closeCustomTimePicker,
  closeAllCustomTimePickers, renderTimePicker, createTimeColumn, handleTimePickerClick,
  handleTimePickerInput, handleTimePickerAction, handleTimePickerKeydown, setTimePickerPart,
  refreshOpenTimePickerSelection, commitTimePanelInputs, commitTimePartInput, alignSelectedTimeOptions,
});
