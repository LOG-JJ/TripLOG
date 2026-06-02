function setupCustomTimePicker(input) {
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
  panel.setAttribute("role", "dialog");
  panel.hidden = true;

  input.parentNode.insertBefore(shell, input);
  shell.appendChild(input);
  button.append(value, icon);
  shell.append(button, panel);
  input.classList.add("native-time-hidden");

  customTimePickers.set(input, { shell, button, value, panel });

  // Open panel on input focus
  value.addEventListener("focus", () => {
    openCustomTimePicker(input);
  });

  value.addEventListener("click", (event) => {
    event.stopPropagation();
    openCustomTimePicker(input);
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
      value.focus();
    }
  });

  button.addEventListener("keydown", (event) => {
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
  panel.addEventListener("change", (event) => {
    event.stopPropagation();
    handleTimePickerChange(event, input);
  });
  panel.addEventListener("keydown", (event) => {
    event.stopPropagation();
    handleTimePickerKeydown(event, input);
  });
  document.addEventListener("click", (event) => {
    if (!shell.contains(event.target)) closeCustomTimePicker(input);
  });

  syncCustomTimePicker(input);
}

function syncCustomTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

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
  const control = customTimePickers.get(input);
  if (!control || control.button.disabled) return;

  closeAllCustomSelects();
  closeAllCustomDatePickers();
  closeAllCustomTimePickers(input);
  renderTimePicker(input);
  control.panel.hidden = false;
  control.button.classList.add("open");
  control.button.setAttribute("aria-expanded", "true");
  setTimePickerLayerState(input, true);
  alignCustomTimePanel(input);
  alignSelectedTimeOptions(input);
}

function closeCustomTimePicker(input, { commit = true } = {}) {
  const control = customTimePickers.get(input);
  if (!control) return;
  const wasOpen = !control.panel.hidden;
  control.panel.hidden = true;
  control.panel.style.removeProperty("--time-panel-shift-x");
  control.panel.style.removeProperty("--time-panel-shift-y");
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
  setTimePickerLayerState(input, false);
  if (wasOpen && commit) {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function closeAllCustomTimePickers(exceptInput) {
  customTimePickers.forEach((_, input) => {
    if (input !== exceptInput) closeCustomTimePicker(input);
  });
}

function setTimePickerLayerState(input, isOpen) {
  const control = customTimePickers.get(input);
  if (!control) return;

  control.shell.classList.toggle("is-open", isOpen);
  control.shell.closest(".itinerary-card")?.classList.toggle("time-picker-active", isOpen);
}

function alignCustomTimePanel(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  control.panel.style.removeProperty("--time-panel-shift-x");
  control.panel.style.removeProperty("--time-panel-shift-y");
  requestAnimationFrame(() => {
    if (control.panel.hidden) return;
    const margin = 12;
    const rect = control.panel.getBoundingClientRect();
    const navRect = document.querySelector(".app-navbar")?.getBoundingClientRect();
    const usableBottom = navRect && navRect.top > 0 && navRect.top < window.innerHeight
      ? navRect.top - 8
      : window.innerHeight - margin;
    let shift = 0;
    let verticalShift = 0;

    if (rect.right > window.innerWidth - margin) {
      shift = window.innerWidth - margin - rect.right;
    }

    if (rect.left + shift < margin) {
      shift += margin - (rect.left + shift);
    }

    if (rect.bottom > usableBottom) {
      verticalShift = usableBottom - rect.bottom;
    }

    if (rect.top + verticalShift < margin) {
      verticalShift += margin - (rect.top + verticalShift);
    }

    control.panel.style.setProperty("--time-panel-shift-x", `${Math.round(shift)}px`);
    control.panel.style.setProperty("--time-panel-shift-y", `${Math.round(verticalShift)}px`);
  });
}

function renderTimePicker(input) {
  const control = customTimePickers.get(input);
  if (!control) return;

  const selected = getTimePickerSelection(input.value);

  control.panel.replaceChildren();
  const head = document.createElement("div");
  head.className = "time-panel-head";
  head.innerHTML = `<strong>${selected.hour24}:${selected.minute}</strong><span>일정 시간</span>`;

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

  control.panel.append(head, grid, actions);
}

function createTimeColumn(label, part, values, selectedValue) {
  const column = document.createElement("div");
  column.className = "time-dropdown-field";

  const title = document.createElement("span");
  title.className = "time-dropdown-label";
  title.textContent = label;
  column.appendChild(title);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "time-dropdown-trigger";
  trigger.dataset.timeDropdownTrigger = part;
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", `${label} 선택`);
  trigger.innerHTML = `
    <span class="time-dropdown-trigger-value">${selectedValue}</span>
    <span class="time-dropdown-chevron" aria-hidden="true"></span>
  `;

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

  const trigger = event.target.closest("[data-time-dropdown-trigger]");
  if (trigger) {
    event.preventDefault();
    toggleTimeDropdown(input, trigger.dataset.timeDropdownTrigger);
    return;
  }

  const option = event.target.closest("[data-time-option]");
  if (option) {
    event.preventDefault();
    setTimePickerPart(input, option.dataset.timePart, option.dataset.timeOption);
    closeTimeDropdowns(input);
    const trigger = customTimePickers.get(input)?.panel.querySelector(`[data-time-dropdown-trigger="${option.dataset.timePart}"]`);
    trigger?.focus();
    return;
  }
}

function handleTimePickerChange(event, input) {
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
    refreshOpenTimePickerSelection(input);
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
      trigger?.focus();
    } else {
      closeCustomTimePicker(input, { commit: false });
    }
    return;
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
      control.panel.querySelector(`[data-time-dropdown-trigger="${option.dataset.timePart}"]`)?.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const options = getTimeDropdownOptions(option.closest(".time-dropdown-menu"));
      const currentIndex = options.indexOf(option);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + direction));
      options[nextIndex]?.focus();
    }
  }
}

function setTimePickerPart(input, part, value) {
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
    const selected = menu.querySelector(".time-dropdown-option.selected");
    selected?.scrollIntoView({ block: "center" });
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
  return `${padNumber(hour24)}:${selection.minute || "00"}`;
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
  selected?.scrollIntoView({ block: "center" });
  if (focusOption) {
    const options = getTimeDropdownOptions(menu);
    const focusTarget = focusOption === "last" ? options[options.length - 1] : selected;
    focusTarget?.focus();
  }
}

function closeTimeDropdowns(input, exceptPart) {
  const control = customTimePickers.get(input);
  if (!control) return;
  control.panel.querySelectorAll(".time-dropdown-menu").forEach((menu) => {
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
  const value = trigger?.querySelector(".time-dropdown-trigger-value");
  if (value) value.textContent = selectedValue;

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
  syncCustomTimePicker,
  toggleCustomTimePicker,
  openCustomTimePicker,
  closeCustomTimePicker,
  closeAllCustomTimePickers,
  renderTimePicker,
  alignCustomTimePanel,
  createTimeColumn,
  handleTimePickerClick,
  handleTimePickerAction,
  handleTimePickerKeydown,
  setTimePickerPart,
  refreshOpenTimePickerSelection,
  alignSelectedTimeOptions,
  handleTimeOptionWheel,
  scrollTimeListFromEdge,
  getVisibleTimeOptions,
  getTimeOptionStep,
  animateTimeListScroll,
});
