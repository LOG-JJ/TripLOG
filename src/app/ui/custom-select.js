function setupCustomSelect(select) {
  if (customSelects.has(select)) return;

  const shell = document.createElement("div");
  shell.className = "custom-select";
  shell.dataset.selectId = select.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", select.closest("label")?.querySelector("span")?.textContent || "선택");

  const value = document.createElement("span");
  value.className = "custom-select-value";

  const chevron = document.createElement("span");
  chevron.className = "custom-select-chevron";
  chevron.setAttribute("aria-hidden", "true");

  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  select.parentNode.insertBefore(shell, select);
  shell.appendChild(select);
  button.append(value, chevron);
  shell.append(button, menu);
  select.classList.add("native-select-hidden");

  customSelects.set(select, { shell, button, value, menu });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    toggleCustomSelect(select);
  });
  button.addEventListener("keydown", (event) => handleCustomSelectButtonKeydown(event, select));

  document.addEventListener("click", (event) => {
    if (!shell.contains(event.target)) closeCustomSelect(select);
  });

  syncCustomSelect(select, { rebuild: true });
}

function syncCustomSelect(select, options = {}) {
  const control = customSelects.get(select);
  if (!control) return;

  if (options.rebuild) {
    control.menu.replaceChildren();

    Array.from(select.options).forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "custom-select-option";
      item.dataset.value = option.value;
      item.setAttribute("role", "option");

      if (select.id === "categorySelect") {
        item.style.setProperty("--option-color", getCategory(option.value).color);
        const dot = document.createElement("span");
        dot.className = "custom-select-dot";
        item.appendChild(dot);
      }

      if (select.id === "currencySelect" || select.id === "settingsCurrencySelect") {
        const currency = getCurrencyMeta(option.value);
        const icon = document.createElement("span");
        icon.className = "custom-currency-icon";
        icon.textContent = currency.symbol;
        item.appendChild(icon);
      }

      const label = document.createElement("span");
      label.textContent = select.id === "currencySelect" || select.id === "settingsCurrencySelect"
        ? getCurrencyMeta(option.value).label
        : option.textContent;
      item.appendChild(label);

      if (option.disabled) item.disabled = true;

      item.addEventListener("click", () => {
        if (item.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncCustomSelect(select);
        closeCustomSelect(select);
      });
      item.addEventListener("keydown", (event) => handleCustomSelectOptionKeydown(event, select));
      control.menu.appendChild(item);
    });
  }

  const selectedOption = select.selectedOptions[0] || select.options[0];
  control.value.replaceChildren();
  if ((select.id === "currencySelect" || select.id === "settingsCurrencySelect") && selectedOption?.value) {
    const currency = getCurrencyMeta(selectedOption.value);
    const icon = document.createElement("span");
    icon.className = "custom-currency-icon";
    icon.textContent = currency.symbol;
    const label = document.createElement("span");
    label.textContent = currency.label;
    control.value.append(icon, label);
  } else {
    control.value.textContent = selectedOption?.textContent || "선택";
  }
  control.button.disabled = select.disabled;
  control.button.classList.toggle("is-disabled", select.disabled);

  if (select.id === "categorySelect" && selectedOption?.value) {
    control.shell.style.setProperty("--selected-color", getCategory(selectedOption.value).color);
  }

  control.menu.querySelectorAll(".custom-select-option").forEach((item) => {
    const isSelected = item.dataset.value === select.value;
    item.classList.toggle("selected", isSelected);
    item.setAttribute("aria-selected", String(isSelected));
  });
}

function toggleCustomSelect(select) {
  const control = customSelects.get(select);
  if (!control || control.button.disabled) return;

  const willOpen = control.menu.hidden;
  closeAllCustomDatePickers();
  closeAllCustomTimePickers();
  closeAllCustomSelects(select);
  control.menu.hidden = !willOpen;
  control.button.classList.toggle("open", willOpen);
  control.button.setAttribute("aria-expanded", String(willOpen));

  if (willOpen) {
    const selected = control.menu.querySelector(".custom-select-option.selected");
    selected?.scrollIntoView({ block: "nearest" });
  }
}

function closeCustomSelect(select) {
  const control = customSelects.get(select);
  if (!control) return;
  control.menu.hidden = true;
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
}

function closeAllCustomSelects(exceptSelect) {
  customSelects.forEach((_, select) => {
    if (select !== exceptSelect) closeCustomSelect(select);
  });
}

function handleCustomSelectButtonKeydown(event, select) {
  if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
  event.preventDefault();
  const control = customSelects.get(select);
  if (!control || control.button.disabled) return;

  if (control.menu.hidden) toggleCustomSelect(select);
  const options = getEnabledCustomOptions(control.menu);
  const selectedIndex = Math.max(0, options.findIndex((item) => item.classList.contains("selected")));
  options[event.key === "ArrowUp" ? Math.max(0, selectedIndex - 1) : selectedIndex]?.focus();
}

function handleCustomSelectOptionKeydown(event, select) {
  const control = customSelects.get(select);
  if (!control) return;

  const options = getEnabledCustomOptions(control.menu);
  const currentIndex = options.indexOf(document.activeElement);

  if (event.key === "Escape") {
    event.preventDefault();
    closeCustomSelect(select);
    control.button.focus();
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + direction));
    options[nextIndex]?.focus();
  }
}

function getEnabledCustomOptions(menu) {
  return Array.from(menu.querySelectorAll(".custom-select-option:not(:disabled)"));
}

window.TripLog.register("ui.customSelect", {
  setupCustomSelect,
  syncCustomSelect,
  toggleCustomSelect,
  closeCustomSelect,
  closeAllCustomSelects,
  handleCustomSelectButtonKeydown,
  handleCustomSelectOptionKeydown,
  getEnabledCustomOptions,
});
