let customSelectDocumentClickBound = false;

const controlThemeEmojis = { sightseeing: '📍', lodging: '🏨', food: '🍽️', shopping: '🛍️', transport: '🚆', etc: '✨' };
const controlCategoryIcons = { 전체: 'tag', 식비: 'fork-knife', 교통: 'train', 숙소: 'bed', 관광: 'camera', 쇼핑: 'shopping-bag', 기타: 'dots-three' };

function getSelectPresentation(select) {
  if (select.id === 'itineraryThemeSelect') return 'theme';
  if (select.id === 'itinerarySubtypeSelect') return 'theme-subtype';
  if (['currencySelect', 'settingsCurrencySelect'].includes(select.id)) return 'currency';
  if (select.id === 'exCategoryFilter') return 'expense-category';
  if (select.id === 'expenseSortSelect') return 'expense-sort';
  if (select.id === 'ttWalletSort') return 'wallet-sort';
  if (select.id === 'categorySelect') return 'category';
  if (select.id === 'daySelect') return 'day';
  return 'default';
}

function controlSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  if (text != null) span.textContent = text;
  return span;
}

function controlIcon(name) {
  const icon = document.createElement('i');
  icon.className = `ph ph-${name}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function renderSelectOptionContent(item, option, variant) {
  const label = controlSpan('control-option-label', option.textContent);
  if (variant === 'theme') {
    const emoji = controlSpan('control-theme-emoji', controlThemeEmojis[option.value] || '✨');
    emoji.setAttribute('aria-hidden', 'true');
    item.append(emoji, label);
  } else if (variant === 'theme-subtype') {
    const subtype = window.TripLog.shared.itineraryArt.catalog[option.value];
    item.append(controlIcon(subtype?.icon || 'sparkle'), label);
  } else if (variant === 'currency') {
    const currency = getCurrencyMeta(option.value);
    label.textContent = currency.label;
    item.append(controlSpan('custom-currency-icon', currency.symbol), label, controlSpan('control-currency-code', currency.code));
    item.dataset.searchText = `${currency.code} ${currency.label} ${currency.unit} ${currency.symbol}`.toLocaleLowerCase();
  } else if (variant === 'category' || variant === 'expense-category') {
    const badge = controlSpan('control-category-icon');
    const name = variant === 'expense-category' && option.value === '전체' ? 'squares-four' : controlCategoryIcons[option.value] || 'dots-three';
    badge.append(controlIcon(name));
    item.append(badge, label);
  } else if (variant === 'expense-sort' || variant === 'wallet-sort') {
    const icons = { default: 'clock', dateAsc: 'arrow-up', amountDesc: 'arrow-down', amountAsc: 'arrow-up', descAsc: 'sort-ascending', date: 'calendar-blank', recent: 'clock', name: 'sort-ascending' };
    item.append(controlIcon(icons[option.value] || 'arrows-down-up'), label);
  } else if (variant === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(option.value)) {
    const date = parseDate(option.value);
    const days = getTripDays();
    const index = days.findIndex(day => (typeof day === 'string' ? day : day.date) === option.value);
    const dayLabel = option.textContent.match(/Day\s*\d+/i)?.[0] || `Day ${index + 1}`;
    const dateLabel = date ? `${date.getMonth() + 1}.${date.getDate()} (${'일월화수목금토'[date.getDay()]})` : option.textContent;
    item.append(controlSpan('control-day-badge', dayLabel), controlSpan('control-day-date', dateLabel));
  } else if (variant === 'day') {
    item.append(controlIcon('ticket'), label);
  } else {
    item.append(label);
  }
  if (variant !== 'default') {
    const check = controlSpan('control-option-check');
    check.setAttribute('aria-hidden', 'true');
    check.append(controlIcon('check'));
    item.append(check);
  }
}

function filterCurrencyOptions(select, query = '') {
  const control = customSelects.get(select);
  if (!control) return;
  const search = query.trim().toLocaleLowerCase();
  let count = 0;
  control.menu.querySelectorAll('.custom-select-option').forEach(item => {
    item.hidden = !item.dataset.searchText.includes(search);
    if (!item.hidden) count++;
  });
  if (control.empty) control.empty.hidden = count !== 0;
  if (control.results) control.results.textContent = search ? `${count}개 통화` : '';
  if (control.list) control.list.scrollTop = 0;
}

function attachCustomSelectDocumentListener() {
  if (customSelectDocumentClickBound) return;
  customSelectDocumentClickBound = true;

  document.addEventListener("click", (event) => {
    pruneDetachedCustomSelects();
    customSelects.forEach((control, select) => {
      if (!control.shell.contains(event.target)) {
        closeCustomSelect(select);
      }
    });
  });
}

function pruneDetachedCustomSelects() {
  Array.from(customSelects.entries()).forEach(([select, control]) => {
    if (!select.isConnected || !control.shell.isConnected) {
      customSelects.delete(select);
    }
  });
}

function destroyCustomSelect(select) {
  const control = customSelects.get(select);
  if (!control) return;

  select.classList.remove("native-select-hidden");
  if (control.shell.isConnected && control.shell.contains(select)) {
    control.shell.parentNode?.insertBefore(select, control.shell);
    control.shell.remove();
  }

  customSelects.delete(select);
}

function setupCustomSelect(select) {
  if (!select) return;
  pruneDetachedCustomSelects();
  if (customSelects.has(select)) return;

  const shell = document.createElement("div");
  shell.className = "custom-select";
  shell.dataset.selectId = select.id;
  const variant = getSelectPresentation(select);
  shell.dataset.control = variant;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", select.getAttribute('aria-label') || select.closest("label")?.querySelector("span")?.textContent || "선택");

  const value = document.createElement("span");
  value.className = "custom-select-value";

  const chevron = document.createElement("span");
  chevron.className = "custom-select-chevron";
  chevron.setAttribute("aria-hidden", "true");

  const menu = document.createElement("div");
  menu.className = `custom-select-menu control-popover control-select-${variant}`;
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  select.parentNode.insertBefore(shell, select);
  shell.appendChild(select);
  button.append(value, chevron);
  shell.append(button, menu);
  select.classList.add("native-select-hidden");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  button.id = `${select.id}Button`;
  menu.id = `${select.id}Menu`;
  button.setAttribute("aria-controls", menu.id);
  const label = select.closest("label");
  if (label?.htmlFor === select.id) label.htmlFor = button.id;

  menu.setAttribute('aria-label', button.getAttribute('aria-label'));
  customSelects.set(select, { shell, button, value, menu, variant });
  attachCustomSelectDocumentListener();

  button.addEventListener("click", (event) => {
    event.preventDefault();
    toggleCustomSelect(select);
  });
  button.addEventListener("keydown", (event) => handleCustomSelectButtonKeydown(event, select));
  shell.addEventListener('focusout', () => {
    setTimeout(() => { if (!shell.contains(document.activeElement)) closeCustomSelect(select); }, 0);
  });

  syncCustomSelect(select, { rebuild: true });
}

function syncCustomSelect(select, options = {}) {
  const control = customSelects.get(select);
  if (!control) return;
  if (!select.isConnected || !control.shell.isConnected) {
    destroyCustomSelect(select);
    return;
  }

  const signature = JSON.stringify(Array.from(select.options, option => [option.value, option.textContent, option.hidden, option.disabled]));
  if (control.optionsSignature !== signature) {
    control.optionsSignature = signature;
    control.menu.replaceChildren();

    let list = control.menu;
    if (control.variant === 'currency') {
      control.menu.setAttribute('role', 'dialog');
      control.button.setAttribute('aria-haspopup', 'dialog');
      const searchBox = document.createElement('div');
      searchBox.className = 'control-currency-search';
      const search = document.createElement('input');
      search.type = 'search'; search.placeholder = '통화명 또는 코드 검색';
      search.setAttribute('aria-label', '통화명 또는 코드 검색');
      search.autocomplete = 'off'; search.spellcheck = false;
      search.addEventListener('input', () => filterCurrencyOptions(select, search.value));
      search.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); getEnabledCustomOptions(control.menu)[0]?.focus(); }
        if (event.key === 'Enter') { event.preventDefault(); getEnabledCustomOptions(control.menu)[0]?.click(); }
      });
      searchBox.append(controlIcon('magnifying-glass'), search);
      list = document.createElement('div'); list.className = 'control-currency-list';
      list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', '통화');
      control.empty = controlSpan('control-search-empty', '검색 결과가 없습니다');
      control.empty.hidden = true;
      control.results = controlSpan('control-sr-only');
      control.results.setAttribute('role', 'status');
      control.menu.append(searchBox, list, control.empty, control.results);
      control.search = search;
    }
    control.list = list;
    let hasDayDivider = false;
    const nativeOptions = Array.from(select.options).filter(option => !option.hidden);
    if (control.variant === 'currency') {
      const order = ['KRW', 'JPY', 'USD', 'CNY', 'EUR', 'GBP', 'TWD', 'THB', 'VND'];
      nativeOptions.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
    }
    nativeOptions.forEach((option) => {
      if (control.variant === 'day' && /^\d{4}-/.test(option.value) && !hasDayDivider) {
        const divider = controlSpan('control-day-divider', '여행 중 지출');
        divider.setAttribute('role', 'presentation');
        list.append(divider); hasDayDivider = true;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = "custom-select-option";
      item.dataset.value = option.value;
      item.setAttribute("role", "option");

      renderSelectOptionContent(item, option, control.variant);

      if (option.disabled) item.disabled = true;

      item.addEventListener("click", () => {
        if (item.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncCustomSelect(select);
        closeCustomSelect(select);
        if (control.button.isConnected) control.button.focus({ preventScroll: true });
      });
      item.addEventListener("keydown", (event) => handleCustomSelectOptionKeydown(event, select));
      list.appendChild(item);
    });
  }

  const selectedOption = select.selectedOptions[0] || select.options[0];
  const displaySignature = `${selectedOption?.value}:${selectedOption?.textContent}:${select.dataset.compactCurrency || ''}`;
  if (control.displaySignature !== displaySignature) {
    control.displaySignature = displaySignature;
    control.value.replaceChildren();
    if ((select.id === "currencySelect" || select.id === "settingsCurrencySelect") && selectedOption?.value) {
      const currency = getCurrencyMeta(selectedOption.value);
      const icon = document.createElement("span");
      icon.className = "custom-currency-icon";
      icon.textContent = currency.symbol;
      const label = document.createElement("span");
      label.textContent = select.dataset.compactCurrency ? `${currency.code} · ${currency.unit}` : currency.label;
      if (select.dataset.compactCurrency) control.value.append(label);
      else control.value.append(icon, label);
    } else if (control.variant === 'theme') {
      const emoji = controlSpan('control-theme-emoji', controlThemeEmojis[selectedOption?.value] || '✨');
      emoji.setAttribute('aria-hidden', 'true');
      control.value.append(emoji, controlSpan('control-option-label', selectedOption?.textContent || '테마 선택'));
    } else if (control.variant === 'theme-subtype') {
      const subtype = window.TripLog.shared.itineraryArt.catalog[selectedOption?.value];
      control.value.append(controlIcon(subtype?.icon || 'sparkle'), controlSpan('control-option-label', selectedOption?.textContent || '자동'));
    } else {
      control.value.textContent = selectedOption?.textContent || "선택";
    }
  }
  control.button.disabled = select.disabled;
  control.shell.hidden = select.hidden;
  control.button.classList.toggle("is-disabled", select.disabled);

  if (select.id === "categorySelect" && selectedOption?.value) {
    control.shell.style.setProperty("--selected-color", getCategory(selectedOption.value).color);
  }

  control.menu.querySelectorAll(".custom-select-option").forEach((item) => {
    const isSelected = item.dataset.value === select.value;
    item.classList.toggle("selected", isSelected);
    item.setAttribute("aria-selected", String(isSelected));
    item.tabIndex = isSelected ? 0 : -1;
  });
}

function toggleCustomSelect(select) {
  pruneDetachedCustomSelects();
  const control = customSelects.get(select);
  if (!control || control.button.disabled) return;

  const willOpen = control.menu.hidden;
  if (willOpen) syncCustomSelect(select, { rebuild: true });
  closeAllCustomDatePickers();
  closeAllCustomTimePickers();
  closeAllCustomSelects(select);
  if (willOpen) control.menu.hidden = false;
  else hideFormPopup(control.menu);
  control.button.classList.toggle("open", willOpen);
  control.button.setAttribute("aria-expanded", String(willOpen));
  control.shell.classList.toggle("is-open", willOpen);

  if (willOpen) {
    if (control.search) { control.search.value = ''; filterCurrencyOptions(select); }
    // Theme follows its trigger on open and on every viewport reposition.
    const widths = { theme: rect => Math.max(280, rect.width), 'theme-subtype': 280, category: 300, currency: 360, day: 330, 'expense-category': 200, 'expense-sort': 200, 'wallet-sort': 184 };
    positionFormPopup(control.menu, control.button, widths[control.variant]);
    const selected = control.menu.querySelector(".custom-select-option.selected");
    if (selected && !['theme', 'currency'].includes(control.variant)) control.list.scrollTop = Math.max(0, selected.offsetTop - control.list.clientHeight / 2);
    if (control.search && !matchMedia('(pointer: coarse)').matches) control.search.focus({ preventScroll: true });
  }
}

function closeCustomSelect(select) {
  const control = customSelects.get(select);
  if (!control) return;
  if (!select.isConnected || !control.shell.isConnected) {
    customSelects.delete(select);
    return;
  }
  if (control.menu.hidden) return;
  hideFormPopup(control.menu);
  control.shell.classList.remove("is-open");
  control.button.classList.remove("open");
  control.button.setAttribute("aria-expanded", "false");
}

function closeAllCustomSelects(exceptSelect) {
  pruneDetachedCustomSelects();
  Array.from(customSelects.keys()).forEach((select) => {
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

  if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const step = control.variant === 'theme' && ['ArrowDown', 'ArrowUp'].includes(event.key) ? 2 : 1;
    const direction = ["ArrowDown", "ArrowRight"].includes(event.key) ? step : -step;
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, currentIndex + direction));
    options[nextIndex]?.focus();
  }
  if (event.key === 'Tab') closeCustomSelect(select);
}

function getEnabledCustomOptions(menu) {
  return Array.from(menu.querySelectorAll(".custom-select-option:not(:disabled):not([hidden])"));
}

window.TripLog.register("ui.customSelect", {
  setupCustomSelect,
  destroyCustomSelect,
  pruneDetachedCustomSelects,
  syncCustomSelect,
  toggleCustomSelect,
  closeCustomSelect,
  closeAllCustomSelects,
  handleCustomSelectButtonKeydown,
  handleCustomSelectOptionKeydown,
  getEnabledCustomOptions,
});
