let customTimeDocumentClickBound = false;

function attachCustomTimePickerDocumentListener() {
  if (customTimeDocumentClickBound) return;
  customTimeDocumentClickBound = true;

  document.addEventListener("click", (event) => {
    pruneDetachedCustomTimePickers();
    customTimePickers.forEach((control, input) => {
      if (!control.shell.contains(event.target)) {
        closeCustomTimePicker(input);
      }
    });
  });
}

function pruneDetachedCustomTimePickers() {
  Array.from(customTimePickers.entries()).forEach(([input, control]) => {
    if (!input.isConnected || !control.shell.isConnected) {
      customTimePickers.delete(input);
    }
  });
}

function destroyCustomTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

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

  const button = document.createElement("div"); // Change to div container to contain text input
  button.className = "custom-time-button";
  button.setAttribute("role", "combobox");
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");

  const value = document.createElement("input"); // Change to text input for typing!
  value.type = "text";
  value.className = "custom-time-value";
  value.placeholder = "시간 선택";
  value.inputMode = "numeric";
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
  panel.className = "custom-time-panel";
  panel.id = input.id ? `${input.id}Panel` : `customTimePanel${customTimePickers.size + 1}`;
  panel.setAttribute("role", "dialog");
  panel.hidden = true;
  button.setAttribute("aria-controls", panel.id);

  input.parentNode.insertBefore(shell, input);
  shell.appendChild(input);
  button.append(value, icon);
  shell.append(button, panel);
  input.classList.add("native-time-hidden");

  customTimePickers.set(input, { shell, button, value, panel, openValue: input.value || "", panelDirty: false });
  attachCustomTimePickerDocumentListener();

  // Pointer users expect the whole field to behave like the clock icon. Open
  // before the browser focuses the text input (and before a mobile keyboard can
  // block the UI). Keyboard users can still focus the input with Tab and type.
  value.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || input.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    openCustomTimePicker(input);
  });

  // Open panel on keyboard focus.
  value.addEventListener("focus", () => {
    openCustomTimePicker(input);
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
        renderTimePicker(input);
      }
    }
  });

  value.addEventListener("keydown", (event) => {
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

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    // If clicking container but not input itself, focus input
    if (event.target !== value && event.target !== icon && !icon.contains(event.target)) {
      focusTimePickerElement(value);
    }
  });

  button.addEventListener("keydown", (event) => {
    if (event.target === value) return;
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openCustomTimePicker(input);
    }
  });

  input.addEventListener("change", () => syncCustomTimePicker(input));

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

  closeAllCustomSelects();
  closeAllCustomDatePickers();
  closeAllCustomTimePickers(input);
  renderTimePicker(input);
  control.openValue = input.value || "";
  control.panelDirty = false;
  control.panel.hidden = false;
  control.button.classList.add("open");
  control.button.setAttribute("aria-expanded", "true");
  setTimePickerLayerState(input, true);
}

function closeCustomTimePicker(input, { commit = true } = {}) {
  const control = customTimePickers.get(input);
  if (!control) return;
  if (!input.isConnected || !control.shell.isConnected) {
    customTimePickers.delete(input);
    return;
  }

  const wasOpen = !control.panel.hidden;
  if (!wasOpen) return;
  let shouldDispatchChange = false;
  if (wasOpen && commit) {
    const previousValue = control.openValue ?? input.value ?? "";
    if (input.value || control.panelDirty) {
      commitTimePanelInputs(input);
    }
    shouldDispatchChange = input.value !== previousValue;
  }
  control.panel.hidden = true;
  closeTimeDropdowns(input);
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
  setTimePickerLayerState(input, false);
  control.openValue = input.value || "";
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

  // Reuse the fixed option DOM instead of rebuilding it on every interaction.
  if (control.panel.childElementCount) {
    refreshOpenTimePickerSelection(input);
    return;
  }

  const selected = getTimePickerSelection(input.value);

  control.panel.replaceChildren();
  const grid = document.createElement("div");
  grid.className = "time-panel-grid";
  grid.append(createTimeColumn("시", "hour", Array.from({ length: 24 }, (_, index) => {
    const value = padNumber(index);
    return { value, label: value };
  }), selected.hour24));
  grid.append(createTimeColumn("분", "minute", Array.from({ length: 60 }, (_, index) => {
    const value = padNumber(index);
    return { value, label: value };
  }), selected.minute));

  const actions = document.createElement("div");
  actions.className = "time-panel-actions";
  actions.innerHTML = `
    <button type="button" class="time-soft-button" data-time-action="clear">시간 없음</button>
    <button type="button" class="time-soft-button" data-time-action="close">확인</button>
  `;

  control.panel.append(grid, actions);
}

function createTimeColumn(label, part, values, selectedValue) {
  const column = document.createElement("div");
  column.className = "time-dropdown-field";

  const trigger = document.createElement("div");
  trigger.className = "time-dropdown-trigger";
  trigger.dataset.timeDropdownTrigger = part;
  trigger.setAttribute("role", "group");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", `${label} 직접 입력 및 선택`);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "time-dropdown-input";
  input.dataset.timePartInput = part;
  input.value = selectedValue;
  input.maxLength = 2;
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.setAttribute("aria-label", `${label} 직접 입력`);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "time-dropdown-toggle";
  toggle.dataset.timeDropdownToggle = part;
  toggle.setAttribute("aria-label", `${label} 목록 열기`);
  toggle.innerHTML = `<span class="time-dropdown-chevron" aria-hidden="true"></span>`;
  trigger.append(input, toggle);

  const menu = document.createElement("div");
  menu.className = "time-dropdown-menu";
  menu.dataset.timeDropdownMenu = part;
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  values.forEach((optionValue) => {
    const value = typeof optionValue === "object" ? optionValue.value : optionValue;
    const option = document.createElement("button");
    option.type = "button";
    option.className = "time-dropdown-option";
    option.dataset.timeOption = value;
    option.dataset.timePart = part;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(value === selectedValue));
    option.textContent = typeof optionValue === "object" ? optionValue.label : optionValue;
    option.classList.toggle("selected", value === selectedValue);
    menu.appendChild(option);
  });
  column.append(trigger, menu);
  return column;
}

function handleTimePickerClick(event, input) {
  const action = event.target.closest("[data-time-action]")?.dataset.timeAction;
  if (action) {
    event.preventDefault();
    handleTimePickerAction(action, input);
    return;
  }

  const toggle = event.target.closest("[data-time-dropdown-toggle]");
  if (toggle) {
    event.preventDefault();
    toggleTimeDropdown(input, toggle.dataset.timeDropdownToggle);
    return;
  }

  const partInput = event.target.closest("[data-time-part-input]");
  if (partInput) {
    selectTimePartInput(partInput);
    return;
  }

  const trigger = event.target.closest("[data-time-dropdown-trigger]");
  if (trigger) {
    event.preventDefault();
    focusTimePickerElement(trigger.querySelector("[data-time-part-input]"));
    return;
  }

  const option = event.target.closest("[data-time-option]");
  if (option) {
    event.preventDefault();
    setTimePickerPart(input, option.dataset.timePart, option.dataset.timeOption);
    closeTimeDropdowns(input);
    const trigger = customTimePickers.get(input)?.panel.querySelector(`[data-time-dropdown-trigger="${option.dataset.timePart}"]`);
    focusTimePickerElement(trigger?.querySelector("[data-time-part-input]"));
    return;
  }
}

function handleTimePickerInput(event, input) {
  const partInput = event.target.closest("[data-time-part-input]");
  if (!partInput) return;

  const control = customTimePickers.get(input);
  if (control) control.panelDirty = true;

  const digits = partInput.value.replace(/\D/g, "").slice(0, 2);
  partInput.value = digits;

  if (digits.length === 2) {
    commitTimePartInput(input, partInput);
  }
}

function handleTimePickerChange(event, input) {
  const partInput = event.target.closest("[data-time-part-input]");
  if (partInput) {
    event.preventDefault();
    commitTimePartInput(input, partInput);
    return;
  }

  const select = event.target.closest(".time-dropdown-select");
  if (!select) return;
  event.preventDefault();
  setTimePickerPart(input, select.dataset.timePart, select.value);
}

function handleTimePickerAction(action, input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  if (action === "clear") {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    syncCustomTimePicker(input);
    closeCustomTimePicker(input, { commit: false });
  }

  if (action === "close") {
    closeCustomTimePicker(input);
  }
}

function handleTimePickerKeydown(event, input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  if (event.key === "Escape") {
    event.preventDefault();
    const openMenu = control.panel.querySelector(".time-dropdown-menu:not([hidden])");
    if (openMenu) {
      closeTimeDropdowns(input);
      const trigger = control.panel.querySelector(`[data-time-dropdown-trigger="${openMenu.dataset.timeDropdownMenu}"]`);
      focusTimePickerElement(trigger?.querySelector("[data-time-part-input]"));
    } else {
      closeCustomTimePicker(input, { commit: false });
    }
    return;
  }

  const partInput = event.target.closest("[data-time-part-input]");
  if (partInput) {
    if (event.key === "Enter") {
      event.preventDefault();
      closeCustomTimePicker(input);
      return;
    }

    if (event.key === "ArrowDown" && event.altKey) {
      event.preventDefault();
      openTimeDropdown(input, partInput.dataset.timePartInput);
      return;
    }
  }

  const trigger = event.target.closest("[data-time-dropdown-trigger]");
  if (trigger && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    openTimeDropdown(input, trigger.dataset.timeDropdownTrigger, {
      focusOption: event.key === "ArrowUp" ? "last" : "selected",
    });
    return;
  }

  const option = event.target.closest("[data-time-option]");
  if (option) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setTimePickerPart(input, option.dataset.timePart, option.dataset.timeOption);
      closeTimeDropdowns(input);
      focusTimePickerElement(control.panel.querySelector(`[data-time-dropdown-trigger="${option.dataset.timePart}"] [data-time-part-input]`));
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const options = getTimeDropdownOptions(option.closest(".time-dropdown-menu"));
      const currentIndex = options.indexOf(option);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + direction));
      scrollTimeDropdownOptionIntoView(option.closest(".time-dropdown-menu"), options[nextIndex]);
      focusTimePickerElement(options[nextIndex]);
    }
  }
}

function setTimePickerPart(input, part, value) {
  const control = customTimePickers.get(input);
  if (control) control.panelDirty = true;
  const current = getTimePickerSelection(input.value);
  const next = {
    hour24: part === "hour" ? value : current.hour24,
    minute: part === "minute" ? value : current.minute,
  };
  input.value = composeTimeFromSelection(next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  refreshOpenTimePickerSelection(input);
}

function refreshOpenTimePickerSelection(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  const selected = input.value ? getTimePickerSelection(input.value) : null;
  if (control.value instanceof HTMLInputElement) {
    control.value.value = input.value || "";
  } else {
    control.value.textContent = input.value || "시간 선택";
  }

  const title = control.panel.querySelector(".time-panel-head strong");
  if (title) title.textContent = selected ? `${selected.hour24}:${selected.minute}` : "--:--";

  const fallback = selected || getTimePickerSelection("09:00");
  updateTimeDropdownField(control.panel, "hour", fallback.hour24);
  updateTimeDropdownField(control.panel, "minute", fallback.minute);
}

function alignSelectedTimeOptions(input) {
  const control = customTimePickers.get(input);
  if (!control) return;
  control.panel.querySelectorAll(".time-dropdown-menu").forEach((menu) => {
    if (menu.hidden) return;
    const selected = menu.querySelector(".time-dropdown-option.selected");
    scrollTimeDropdownOptionIntoView(menu, selected);
  });
}

function getTimePickerSelection(value) {
  const parsed = parseTimeValue(value) || { hour: "09", minute: "00" };
  const numericHour = Number(parsed.hour);
  return {
    hour24: padNumber(numericHour),
    minute: parsed.minute,
  };
}

function composeTimeFromSelection(selection) {
  const hour24 = Math.max(0, Math.min(23, Number(selection.hour24) || 0));
  const minute = Math.max(0, Math.min(59, Number(selection.minute) || 0));
  return `${padNumber(hour24)}:${padNumber(minute)}`;
}

function commitTimePanelInputs(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  const current = getTimePickerSelection(input.value);
  const hourInput = control.panel.querySelector('[data-time-part-input="hour"]');
  const minuteInput = control.panel.querySelector('[data-time-part-input="minute"]');
  const next = {
    hour24: normalizeTimePartInputValue("hour", hourInput?.value, current.hour24),
    minute: normalizeTimePartInputValue("minute", minuteInput?.value, current.minute),
  };

  const nextValue = composeTimeFromSelection(next);
  if (input.value !== nextValue) {
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  refreshOpenTimePickerSelection(input);
}

function commitTimePartInput(input, partInput) {
  const control = customTimePickers.get(input);
  if (control) control.panelDirty = true;
  const part = partInput?.dataset.timePartInput;
  if (!part) return;
  const current = getTimePickerSelection(input.value);
  const fallback = part === "hour" ? current.hour24 : current.minute;
  const normalized = normalizeTimePartInputValue(part, partInput.value, fallback);
  partInput.value = normalized;
  setTimePickerPart(input, part, normalized);
}

function normalizeTimePartInputValue(part, value, fallback = "00") {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return fallback;
  const max = part === "hour" ? 23 : 59;
  const numeric = Math.max(0, Math.min(max, Number(digits)));
  return padNumber(numeric);
}

function toggleTimeDropdown(input, part) {
  const control = customTimePickers.get(input);
  if (!control) return;
  const menu = control.panel.querySelector(`[data-time-dropdown-menu="${part}"]`);
  if (!menu) return;
  if (menu.hidden) {
    openTimeDropdown(input, part);
  } else {
    closeTimeDropdowns(input);
  }
}

function openTimeDropdown(input, part, { focusOption = null } = {}) {
  const control = customTimePickers.get(input);
  if (!control) return;
  closeTimeDropdowns(input, part);
  const menu = control.panel.querySelector(`[data-time-dropdown-menu="${part}"]`);
  const trigger = control.panel.querySelector(`[data-time-dropdown-trigger="${part}"]`);
  if (!menu || !trigger) return;

  menu.hidden = false;
  trigger.classList.add("open");
  trigger.setAttribute("aria-expanded", "true");
  const selected = menu.querySelector(".time-dropdown-option.selected") || menu.querySelector(".time-dropdown-option");
  scrollTimeDropdownOptionIntoView(menu, selected);
  if (focusOption) {
    const options = getTimeDropdownOptions(menu);
    const focusTarget = focusOption === "last" ? options[options.length - 1] : selected;
    focusTimePickerElement(focusTarget);
  }
}

function focusTimePickerElement(element) {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch (_) {
    element.focus();
  }
}

function selectTimePartInput(partInput) {
  if (!partInput) return;
  focusTimePickerElement(partInput);
  partInput.select();
}

function scrollTimeDropdownOptionIntoView(menu, option) {
  if (!menu || !option) return;
  const maxScroll = Math.max(0, menu.scrollHeight - menu.clientHeight);
  const target = option.offsetTop - ((menu.clientHeight - option.offsetHeight) / 2);
  menu.scrollTop = Math.max(0, Math.min(maxScroll, target));
}

function closeTimeDropdowns(input, exceptPart) {
  const control = customTimePickers.get(input);
  if (!control) return;
  control.panel.querySelectorAll(".time-dropdown-menu").forEach((menu) => {
    if (menu.hidden) return;
    if (menu.dataset.timeDropdownMenu === exceptPart) return;
    menu.hidden = true;
  });
  control.panel.querySelectorAll("[data-time-dropdown-trigger]").forEach((trigger) => {
    if (trigger.dataset.timeDropdownTrigger === exceptPart) return;
    trigger.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  });
}

function updateTimeDropdownField(panel, part, selectedValue) {
  const trigger = panel.querySelector(`[data-time-dropdown-trigger="${part}"]`);
  const value = trigger?.querySelector("[data-time-part-input]");
  if (value && document.activeElement !== value) value.value = selectedValue;

  panel.querySelectorAll(`[data-time-part="${part}"]`).forEach((option) => {
    const isSelected = option.dataset.timeOption === selectedValue;
    option.classList.toggle("selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
  });
}

function getTimeDropdownOptions(menu) {
  return Array.from(menu?.querySelectorAll(".time-dropdown-option") || []);
}

function handleTimeOptionWheel(event) {
  const list = event.currentTarget;
  const maxScroll = list.scrollHeight - list.clientHeight;
  if (!maxScroll) return;

  const direction = Math.sign(event.deltaY);
  const isAtStart = list.scrollTop <= 0;
  const isAtEnd = list.scrollTop >= maxScroll;
  if ((direction < 0 && isAtStart) || (direction > 0 && isAtEnd)) return;

  event.preventDefault();
  animateTimeListScroll(list, event.deltaY * TIME_WHEEL_SCROLL_FACTOR, TIME_WHEEL_SCROLL_DURATION);
}

function scrollTimeListFromEdge(option) {
  const list = option?.closest(".time-option-list");
  if (!list) return;

  const visibleOptions = getVisibleTimeOptions(list);
  const firstVisible = visibleOptions[0];
  const lastVisible = visibleOptions[visibleOptions.length - 1];
  const scrollAmount = getTimeOptionStep(option);

  if (option === firstVisible) {
    animateTimeListScroll(list, -scrollAmount, TIME_EDGE_SCROLL_DURATION);
  }

  if (option === lastVisible) {
    animateTimeListScroll(list, scrollAmount, TIME_EDGE_SCROLL_DURATION);
  }
}

function getVisibleTimeOptions(list) {
  const listRect = list.getBoundingClientRect();
  return Array.from(list.querySelectorAll(".time-option")).filter((option) => {
    const optionRect = option.getBoundingClientRect();
    return optionRect.bottom > listRect.top + 2 && optionRect.top < listRect.bottom - 2;
  });
}

function getTimeOptionStep(option) {
  const list = option.closest(".time-option-list");
  const style = window.getComputedStyle(list);
  const gap = Number.parseFloat(style.rowGap || style.gap) || 4;
  return option.getBoundingClientRect().height + gap;
}

function animateTimeListScroll(list, delta, duration) {
  const maxScroll = list.scrollHeight - list.clientHeight;
  const start = list.scrollTop;
  const target = Math.max(0, Math.min(maxScroll, start + delta));
  if (Math.abs(target - start) < 1) return;

  const existingFrame = timeListScrollAnimations.get(list);
  if (existingFrame) cancelAnimationFrame(existingFrame);

  const startTime = performance.now();
  const easeOut = (progress) => 1 - Math.pow(1 - progress, 3);

  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    list.scrollTop = start + (target - start) * easeOut(progress);

    if (progress < 1) {
      timeListScrollAnimations.set(list, requestAnimationFrame(step));
    } else {
      timeListScrollAnimations.delete(list);
    }
  };

  timeListScrollAnimations.set(list, requestAnimationFrame(step));
}

window.TripLog.register("ui.timePicker", {
  setupCustomTimePicker,
  destroyCustomTimePicker,
  pruneDetachedCustomTimePickers,
  syncCustomTimePicker,
  toggleCustomTimePicker,
  openCustomTimePicker,
  closeCustomTimePicker,
  closeAllCustomTimePickers,
  renderTimePicker,
  createTimeColumn,
  handleTimePickerClick,
  handleTimePickerInput,
  handleTimePickerAction,
  handleTimePickerKeydown,
  setTimePickerPart,
  refreshOpenTimePickerSelection,
  commitTimePanelInputs,
  commitTimePartInput,
  alignSelectedTimeOptions,
  handleTimeOptionWheel,
  scrollTimeListFromEdge,
  getVisibleTimeOptions,
  getTimeOptionStep,
  animateTimeListScroll,
});
