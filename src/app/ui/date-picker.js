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
  panel.className = "custom-date-panel";
  panel.setAttribute("role", "dialog");
  panel.hidden = true;

  panel.innerHTML = `
    <div class="calendar-head">
      <button type="button" class="calendar-nav" data-calendar-action="prev" aria-label="이전 달">
        <svg viewBox="0 0 24 24" focusable="false"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <strong class="calendar-title"></strong>
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
    }
  });

  panel.addEventListener("click", (event) => handleCalendarClick(event, input));
  panel.addEventListener("keydown", (event) => handleCalendarKeydown(event, input));
  document.addEventListener("click", (event) => {
    if (!shell.contains(event.target)) closeCustomDatePicker(input);
  });

  syncCustomDatePicker(input);
}

function syncCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control) return;

  const selectedDate = parseDate(input.value);
  control.value.textContent = selectedDate ? toInputDate(selectedDate) : "날짜 선택";
  control.button.disabled = input.disabled;
  control.button.classList.toggle("is-disabled", input.disabled);

  if (selectedDate && !control.panel.hidden) {
    control.viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  }

  renderCalendar(input);
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
}

function closeCustomDatePicker(input) {
  const control = customDatePickers.get(input);
  if (!control) return;
  control.panel.hidden = true;
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
}

function closeAllCustomDatePickers(exceptInput) {
  customDatePickers.forEach((_, input) => {
    if (input !== exceptInput) closeCustomDatePicker(input);
  });
}

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
  grid.replaceChildren();

  for (let index = 0; index < 42; index += 1) {
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
    dayButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDatePickerValue(input, value);
    });
    grid.appendChild(dayButton);
  }
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
  if (event.key === "Escape") {
    const control = customDatePickers.get(input);
    closeCustomDatePicker(input);
    control?.button.focus();
  }
}

function setDatePickerValue(input, value) {
  if (isDateOutsideInputBounds(input, value)) return;
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  syncCustomDatePicker(input);
  closeCustomDatePicker(input);
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
