function setupCustomDatePicker(input) {
  if (customDatePickers.has(input)) return;

  const shell = document.createElement("div");
  shell.className = "custom-date";
  shell.dataset.dateId = input.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-date-button";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", input.closest("label")?.querySelector("span")?.textContent || "날짜 선택");

  const value = document.createElement("span");
  value.className = "custom-date-value";

  const icon = document.createElement("span");
  icon.className = "custom-date-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>';

  const panel = document.createElement("div");
  panel.className = "custom-date-panel control-popover control-calendar";
  panel.setAttribute("role", "dialog");
  panel.setAttribute('aria-label', '날짜 선택');
  panel.hidden = true;

  panel.innerHTML = `
    <div class="calendar-head">
      <button type="button" class="calendar-nav" data-calendar-action="prev" aria-label="이전 달">
        <svg viewBox="0 0 24 24" focusable="false"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <strong class="calendar-title" aria-live="polite"></strong>
      <button type="button" class="calendar-nav" data-calendar-action="next" aria-label="다음 달">
        <svg viewBox="0 0 24 24" focusable="false"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
    <div class="calendar-weekdays" aria-hidden="true">
      <span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>
    </div>
    <div class="calendar-grid" role="grid"></div>
    <div class="calendar-actions">
      <button type="button" class="calendar-soft-button" data-calendar-action="today">오늘</button>
      <button type="button" class="calendar-soft-button" data-calendar-action="close">닫기</button>
    </div>
  `;

  input.parentNode.insertBefore(shell, input);
  shell.appendChild(input);
  button.append(value, icon);
  shell.append(button, panel);
  input.classList.add("native-date-hidden");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  button.id = `${input.id}Button`;
  panel.id = `${input.id}Panel`;
  button.setAttribute("aria-controls", panel.id);
  const label = input.closest("label");
  if (label?.htmlFor === input.id) label.htmlFor = button.id;

  const selectedDate = parseDate(input.value) || new Date();
  customDatePickers.set(input, {
    shell,
    button,
    value,
    panel,
    viewDate: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    toggleCustomDatePicker(input);
  });
  button.addEventListener("keydown", (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openCustomDatePicker(input);
      customDatePickers.get(input)?.panel.querySelector('.calendar-day[tabindex="0"]')?.focus({ preventScroll: true });
    }
  });

  panel.addEventListener("click", (event) => handleCalendarClick(event, input));
  panel.addEventListener("keydown", (event) => handleCalendarKeydown(event, input));
  shell.addEventListener('focusout', () => {
    setTimeout(() => { if (!shell.contains(document.activeElement)) closeCustomDatePicker(input); }, 0);
  });

  syncCustomDatePicker(input);
}

function syncCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control) return;

  const selectedDate = parseDate(input.value);
  control.value.textContent = selectedDate ? toInputDate(selectedDate) : "날짜 선택";
  if (selectedDate && document.body.classList.contains('rd-app')) {
    const short = input.id.startsWith('newTrip') || input.dataset.compactDate === 'true';
    control.value.textContent = `${short ? '' : selectedDate.getFullYear()+'.'}${String(selectedDate.getMonth()+1).padStart(2,'0')}.${String(selectedDate.getDate()).padStart(2,'0')} (${'일월화수목금토'[selectedDate.getDay()]})`;
    if (input.id === 'startDateInput' || input.id === 'endDateInput') control.value.textContent = input.value.replaceAll('-', '.');
  }
  control.button.disabled = input.disabled;
  control.button.classList.toggle("is-disabled", input.disabled);

  if (selectedDate && !control.panel.hidden && control.lastValue !== input.value) {
    control.viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  }
  control.lastValue = input.value;

  if (!control.panel.hidden) renderCalendar(input);
}

function toggleCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control || control.button.disabled) return;

  if (control.panel.hidden) {
    openCustomDatePicker(input);
  } else {
    closeCustomDatePicker(input);
  }
}

function openCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control || control.button.disabled) return;

  closeAllCustomSelects();
  closeAllCustomTimePickers();
  closeAllCustomDatePickers(input);
  const selectedDate = parseDate(input.value) || new Date();
  control.viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderCalendar(input);
  control.panel.hidden = false;
  control.button.classList.add("open");
  control.button.setAttribute("aria-expanded", "true");
  control.shell.classList.add("is-open");
  positionFormPopup(control.panel, control.button, 350);
}

function closeCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control || control.panel.hidden) return;
  hideFormPopup(control.panel);
  control.shell.classList.remove("is-open");
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
}

function closeAllCustomDatePickers(exceptInput) {
  customDatePickers.forEach((_, input) => {
    if (input !== exceptInput) closeCustomDatePicker(input);
  });
}

document.addEventListener("click", event => {
  customDatePickers.forEach((control, input) => {
    if (!control.panel.hidden && !control.shell.contains(event.target)) closeCustomDatePicker(input);
  });
});

function renderCalendar(input) {
  const control = customDatePickers.get(input);
  if (!control) return;

  const selectedDate = parseDate(input.value);
  const minDate = parseDate(input.min);
  const maxDate = parseDate(input.max);
  const title = control.panel.querySelector(".calendar-title");
  const grid = control.panel.querySelector(".calendar-grid");
  const year = control.viewDate.getFullYear();
  const month = control.viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const calendarStart = addDays(firstDay, -firstDay.getDay());
  const today = toInputDate(new Date());

  title.textContent = `${year}년 ${month + 1}월`;
  grid.setAttribute('aria-label', title.textContent);
  control.panel.querySelector('[data-calendar-action="today"]').disabled = isDateOutsideInputBounds(input, today);
  grid.replaceChildren();

  for (let index = 0; index < 42; index += 1) {
    if (index % 7 === 0) {
      const row = document.createElement('div'); row.className = 'calendar-week';
      row.setAttribute('role', 'row'); grid.append(row);
    }
    const date = addDays(calendarStart, index);
    const value = toInputDate(date);
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";
    dayButton.dataset.date = value;
    dayButton.setAttribute("role", "gridcell");
    dayButton.setAttribute("aria-label", formatReadableDate(value));
    dayButton.textContent = String(date.getDate());
    const isDisabled = Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
    dayButton.disabled = isDisabled;
    dayButton.setAttribute("aria-disabled", String(isDisabled));
    dayButton.classList.toggle("outside", date.getMonth() !== month);
    dayButton.classList.toggle("today", value === today);
    dayButton.classList.toggle("selected", selectedDate && value === toInputDate(selectedDate));
    dayButton.classList.toggle('sunday', date.getDay() === 0);
    dayButton.classList.toggle('saturday', date.getDay() === 6);
    dayButton.setAttribute('aria-selected', String(value === input.value));
    if (value === today) dayButton.setAttribute('aria-current', 'date');
    dayButton.tabIndex = -1;
    dayButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDatePickerValue(input, value);
    });
    grid.lastElementChild.appendChild(dayButton);
  }
  const focusDay = grid.querySelector('.selected:not(:disabled)') || grid.querySelector('.today:not(:disabled)') || grid.querySelector('.calendar-day:not(.outside):not(:disabled)');
  if (focusDay) focusDay.tabIndex = 0;
}

function handleCalendarClick(event, input) {
  const action = event.target.closest("[data-calendar-action]")?.dataset.calendarAction;
  if (action) {
    handleCalendarAction(action, input);
    return;
  }

  const day = event.target.closest(".calendar-day");
  if (!day) return;
  setDatePickerValue(input, day.dataset.date);
}

function handleCalendarAction(action, input) {
  const control = customDatePickers.get(input);
  if (!control) return;

  if (action === "prev" || action === "next") {
    const amount = action === "prev" ? -1 : 1;
    control.viewDate = new Date(control.viewDate.getFullYear(), control.viewDate.getMonth() + amount, 1);
    renderCalendar(input);
  }

  if (action === "today") {
    setDatePickerValue(input, toInputDate(new Date()));
  }

  if (action === "close") {
    closeCustomDatePicker(input);
    control.button.focus();
  }
}

function handleCalendarKeydown(event, input) {
  const control = customDatePickers.get(input);
  if (event.key === "Escape") {
    event.preventDefault();
    closeCustomDatePicker(input);
    control?.button.focus();
    return;
  }
  const day = event.target.closest('.calendar-day');
  if (!control || !day) return;
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (!(event.key in offsets) && !['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
  event.preventDefault();
  const current = parseDate(day.dataset.date);
  let next = addDays(current, offsets[event.key] || 0);
  if (event.key === 'Home') next = addDays(current, -current.getDay());
  if (event.key === 'End') next = addDays(current, 6 - current.getDay());
  if (event.key === 'PageUp' || event.key === 'PageDown') {
    const month = current.getMonth() + (event.key === 'PageUp' ? -1 : 1);
    const last = new Date(current.getFullYear(), month + 1, 0).getDate();
    next = new Date(current.getFullYear(), month, Math.min(current.getDate(), last));
  }
  const nextValue = toInputDate(next);
  if (isDateOutsideInputBounds(input, nextValue)) return;
  if (next.getMonth() !== control.viewDate.getMonth() || next.getFullYear() !== control.viewDate.getFullYear()) {
    control.viewDate = new Date(next.getFullYear(), next.getMonth(), 1); renderCalendar(input);
  }
  control.panel.querySelectorAll('.calendar-day').forEach(button => button.tabIndex = button.dataset.date === nextValue ? 0 : -1);
  control.panel.querySelector(`[data-date="${nextValue}"]`)?.focus({ preventScroll: true });
}

function setDatePickerValue(input, value) {
  if (isDateOutsideInputBounds(input, value)) return;
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  syncCustomDatePicker(input);
  closeCustomDatePicker(input);
  customDatePickers.get(input)?.button.focus({ preventScroll: true });
}

function isDateOutsideInputBounds(input, value) {
  const date = parseDate(value);
  const minDate = parseDate(input.min);
  const maxDate = parseDate(input.max);
  if (!date) return true;
  return Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
}

window.TripLog.register("ui.datePicker", {
  setupCustomDatePicker,
  syncCustomDatePicker,
  toggleCustomDatePicker,
  openCustomDatePicker,
  closeCustomDatePicker,
  closeAllCustomDatePickers,
  renderCalendar,
  handleCalendarClick,
  handleCalendarAction,
  handleCalendarKeydown,
  setDatePickerValue,
  isDateOutsideInputBounds,
});
