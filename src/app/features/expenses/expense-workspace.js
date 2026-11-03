(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const safe = value => escapeHtml(String(value ?? ''));
  const won = value => `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
  const model = () => window.TripLog.features.redesign.model;
  const categoryData = window.TripLog.data.expenseCategories;
  const categories = categoryData.ledgerOrder;
  const categoryIcons = Object.fromEntries(categories.map(name => [name, categoryData.get(name, 'ledger').icon]));
  const categoryColors = Object.fromEntries(categories.map(name => [name, categoryData.get(name, 'ledger').color]));
  let ready = false, ui = {}, currentTab = 'all', lastTrip = '', submitIntent = null, tripPreferences = null;
  let reorderPending = false, orderControls = null;
  let compactNodes = [], compactOptions;
  function setCompact(enabled) {
    if (!ready) return;
    if (!enabled) {
      for (const { node, marker } of compactNodes) { marker.before(node); marker.remove(); }
      compactNodes = []; compactOptions?.remove(); compactOptions = null;
      ui.dialog.classList.remove('cx-quick-expense');
      return;
    }
    if (compactOptions) return;
    compactOptions = document.createElement('details'); compactOptions.id = 'cxQuickOptions';
    compactOptions.innerHTML = '<summary>결제일 · 수단 · 결제자 · 메모</summary><div></div>';
    const body = compactOptions.querySelector('div');
    for (const node of [$('.ex-date-row', ui.form), $('.payment-method-field', ui.form), $('#rdExpenseMemo'), $('.ex-pretrip-shortcut', ui.form)].filter(Boolean)) {
      const marker = document.createComment('quick-expense-return'); node.before(marker); compactNodes.push({ node, marker }); body.appendChild(node);
    }
    ui.form.appendChild(compactOptions); ui.dialog.classList.add('cx-quick-expense');
    updateCompactViewport();
  }
  function updateCompactViewport() {
    if (!compactOptions || !window.visualViewport) return;
    ui.dialog.style.setProperty('--cx-vh', `${visualViewport.height}px`);
    ui.dialog.style.setProperty('--cx-keyboard', `${Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop)}px`);
  }
  const canReorder = () => window.TripLog.features.redesign.workspace.canEditTripSettings();

  async function moveExpense(id, targetId, placement = 'before') {
    if (reorderPending || !canReorder() || els.expenseSortSelect.value !== 'default') return false;
    const result = window.TripLog.shared.expenseOrder.move(state.entries, id, targetId, placement);
    if (!result.changed) return false;
    const tripId = state.id;
    reorderPending = true;
    state.entries = result.items;
    try {
      const saved = await saveAndRender();
      if (state.id !== tripId) return saved;
      showToast(!saved ? '순서를 저장하지 못했어요. 상단 저장 상태에서 다시 시도해 주세요.'
        : window.TripLogSyncRepository.cached(tripId)?.conflicts.length ? '순서 변경을 보관했어요. 저장 상태에서 겹친 변경을 확인해 주세요.'
        : '지출 순서를 변경했어요.');
      return saved;
    } finally { reorderPending = false; renderLedger(); }
  }

  function setupLedger() {
    const view = $('#budgetPage .rd-content');
    const search = els.expenseSearchInput;
    const sort = els.expenseSortSelect.closest('.custom-select') || els.expenseSortSelect;
    view.classList.add('ex-ledger');
    view.innerHTML = `
      <div class="ex-heading trip-context-heading tl-page-heading"><h1>지출 기록</h1>
        <div class="ex-heading-actions">${window.TripLog.ui.markup.expenseAction('경비 정산','users-three','nav-settlement')}${window.TripLog.ui.markup.expenseAction('영수증','receipt','receipt-start')}<button type="button" class="ex-button ex-primary ex-desktop-add" data-rd-action="expense-new">${icon('plus')} 지출 추가</button></div>
        <div data-trip-context></div></div>
      <section id="rdBudgetSummary" class="cost-summary-host" aria-label="여행 경비 요약"></section>
      <div class="ex-toolbar"><div class="ex-search">${icon('magnifying-glass')}<span id="rdSearchMount"></span><button type="button" id="exSearchClear" aria-label="검색어 지우기" hidden>${icon('x')}</button></div>
        <button type="button" id="exFilterToggle" aria-expanded="false" aria-controls="exFilterControls">${icon('sliders-horizontal')}<span>필터</span></button>
        <div id="exFilterControls" class="ex-filter-controls"><label class="ex-filter"><span class="ex-sr-only">카테고리 필터</span><select id="exCategoryFilter" aria-label="카테고리 필터"><option value="전체">전체 카테고리</option>${categories.map(c => `<option value="${c}">${c}</option>`).join('')}</select></label>
        <div id="exSortMount" class="ex-sort"></div></div></div>
      <div class="ex-list-controls"><div id="rdExpenseTabs" class="ex-tabs" role="group" aria-label="지출 시기">${[['all', '전체'], ['pretrip', '사전구매'], ['during', '여행 중']].map(([key, label]) => `<button type="button" data-rd-action="expense-tab" data-tab="${key}" aria-pressed="${key === 'all'}">${label}<span data-count="${key}"></span></button>`).join('')}</div><button type="button" id="exFilterReset" class="ex-text-button" data-rd-action="expense-tab" data-tab="all" hidden>필터 초기화</button></div>
      <p id="exReorderHint" class="ex-reorder-hint" hidden>순서를 이동하려면 정렬에서 기본순을 선택하세요.</p>
      <p id="exResultSummary" class="ex-result-summary" role="status" aria-live="polite"></p>
      <div class="ex-table-wrap">${window.TripLog.ui.expenseLedger.table({ bodyId: 'rdExpenseList', caption: '지출 기록. 내용 또는 수정 버튼을 누르면 편집할 수 있습니다.' })}<div id="exExpenseEmpty" hidden></div></div>
      <div class="ex-mobile-add"><button type="button" class="ex-button ex-primary" data-rd-action="expense-new">${icon('plus')} 지출 추가</button></div>`;
    $('#rdSearchMount').appendChild(search);
    search.placeholder = '지출 내용, 메모 등을 검색하세요'; search.setAttribute('aria-label', '지출 검색'); search.type = 'search';
    const mobileLayout = matchMedia('(max-width: 760px)');
    const updateSearchHint = () => { search.placeholder = mobileLayout.matches ? '지출 검색' : '지출 내용, 메모 등을 검색하세요'; };
    mobileLayout.addEventListener('change', updateSearchHint); updateSearchHint();
    $('#exSortMount').appendChild(sort);
    els.expenseSortSelect.setAttribute('aria-label', '지출 정렬');
    els.expenseSortSelect.querySelector('[value="default"]').textContent = '기본순';
    if (!els.expenseSortSelect.querySelector('[value="dateDesc"]')) els.expenseSortSelect.add(new Option('최신순', 'dateDesc'));
    if (!els.expenseSortSelect.querySelector('[value="dateAsc"]')) els.expenseSortSelect.add(new Option('오래된순', 'dateAsc'));
    els.expenseSortSelect.insertBefore(els.expenseSortSelect.querySelector('[value="dateAsc"]'), els.expenseSortSelect.querySelector('[value="amountDesc"]'));
    els.expenseSortSelect.insertBefore(els.expenseSortSelect.querySelector('[value="dateDesc"]'), els.expenseSortSelect.querySelector('[value="dateAsc"]'));
    syncCustomSelect(els.expenseSortSelect, { rebuild: true });
    setupCustomSelect($('#exCategoryFilter'));
    customSelects.get($('#exCategoryFilter'))?.button.insertAdjacentHTML('afterbegin', icon('tag'));
    customSelects.get(els.expenseSortSelect)?.button.insertAdjacentHTML('afterbegin', icon('arrows-down-up'));
    customSelects.get(els.expenseSortSelect)?.button.setAttribute('aria-label', '지출 정렬');
    customSelects.get(els.expenseSortSelect)?.menu.setAttribute('aria-label', '지출 정렬');
    $('#exFilterToggle').addEventListener('click', event => { const open = $('.ex-toolbar').classList.toggle('is-expanded'); event.currentTarget.setAttribute('aria-expanded', String(open)); });
    $('#exCategoryFilter').addEventListener('change', event => setFilter(event.target.value));
    $('#exSearchClear').addEventListener('click', () => { search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true })); search.focus(); });
    $('#exFilterReset').addEventListener('click', () => { search.value = ''; activeFilter = '전체'; });
    orderControls = window.TripLog.ui.sortableList.setup({
      list: $('#rdExpenseList'), itemSelector: 'tr:not([data-dnd-placeholder])', rowSelector: 'tr', group: 'expense', label: '지출',
      instructionsId: 'expenseDragInstructions', announcementAnchor: $('.ex-table'),
      getScope: () => JSON.stringify([state.id, currentTab, activeFilter, els.expenseSearchInput.value, els.expenseSortSelect.value]),
      enabled: () => !reorderPending && canReorder() && els.expenseSortSelect.value === 'default',
      find: findEntry, getItems: () => getFilteredEntries().filter(entry => currentTab === 'all' || (currentTab === 'pretrip') === isPreTripExpenseDate(entry.date)),
      getLabel: entry => entry.description || '지출', move: moveExpense,
    });
  }

  function renderLedger(tab = currentTab) {
    if (!ready) return;
    orderControls.cancel();
    currentTab = tab;
    if (lastTrip !== state.id) { lastTrip = state.id; activeFilter = '전체'; }
    const cost = window.TripLog.shared.travelCosts.summarize(state, { members: window.TripLog.features.collaboration.tripCollaboration.getTripMembers().length });
    $('#rdBudgetSummary').innerHTML = window.TripLog.ui.costSummary.render(cost);
    const filtered = getFilteredEntries();
    const rows = filtered.filter(entry => tab === 'all' || (tab === 'pretrip') === isPreTripExpenseDate(entry.date));
    const hasHandles = canReorder() && els.expenseSortSelect.value === 'default' && rows.length > 1;
    $('#exReorderHint').hidden = !canReorder() || els.expenseSortSelect.value === 'default' || rows.length < 2;
    $('#budgetPage .ex-table').classList.toggle('has-reorder-handles', hasHandles);
    $('#rdExpenseList').setAttribute('aria-busy', String(reorderPending));
    const counts = { all: filtered.length, pretrip: filtered.filter(e => isPreTripExpenseDate(e.date)).length, during: filtered.filter(e => !isPreTripExpenseDate(e.date)).length };
    $$('#rdExpenseTabs button').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tab);
      button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
      $('[data-count]', button).textContent = counts[button.dataset.tab];
    });
    const hasQuery = Boolean(els.expenseSearchInput.value.trim());
    const filterCount = Number(activeFilter !== '전체') + Number(els.expenseSortSelect.value !== 'default');
    $('#exFilterToggle span').textContent = filterCount ? `필터 ${filterCount}` : '필터';
    $('#exFilterToggle').classList.toggle('is-active', filterCount > 0);
    $('#exSearchClear').hidden = !hasQuery;
    $('#exFilterReset').hidden = !hasQuery && activeFilter === '전체' && tab === 'all';
    $('#exCategoryFilter').value = activeFilter; syncCustomSelect($('#exCategoryFilter'));
    const summary = $('#exResultSummary');
    summary.innerHTML = `<span>${icon('list-bullets')}${rows.length}건</span><span>합계 <strong>${won(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0))}</strong></span>`;
    summary.hidden = !hasQuery && activeFilter === '전체' && tab === 'all';
    $('#rdExpenseList').innerHTML = rows.map(entry => {
      const orderButton = hasHandles ? window.TripLog.ui.sortableList.handle({label: entry.description || '지출', instructionsId: 'expenseDragInstructions', className: 'ex-drag-handle', disabled: reorderPending}) : '';
      const editButton = `<button type="button" class="ex-entry-edit" data-rd-action="expense-edit" data-id="${safe(entry.id)}" aria-label="${safe(entry.description)} 수정">${icon('pencil-simple')}</button>`;
      return window.TripLog.ui.expenseLedger.row(entry, { actions: editButton + orderButton });
    }).join('');
    orderControls.refresh();
    const empty = $('#exExpenseEmpty'); empty.hidden = rows.length > 0;
    $('#budgetPage .ex-table').hidden = !rows.length;
    if (!rows.length) empty.innerHTML = `<div class="ex-empty">${icon(state.entries.length ? 'magnifying-glass' : 'receipt')}<h2>${state.entries.length ? '조건에 맞는 지출이 없어요' : '첫 지출을 기록해 보세요'}</h2><p>${state.entries.length ? '검색어나 카테고리를 바꿔 보세요.' : '금액과 내용을 입력하면 여행 경비를 한눈에 볼 수 있어요.'}</p><button type="button" class="ex-button ex-secondary" ${state.entries.length ? 'data-rd-action="expense-tab" data-tab="all" data-ex-reset' : 'data-rd-action="expense-new"'}>${state.entries.length ? '필터 초기화' : '지출 추가'}</button></div>`;
    $$('[data-ex-reset]', empty).forEach(button => button.addEventListener('click', () => { els.expenseSearchInput.value = ''; activeFilter = '전체'; }));
  }

  function setupEditor() {
    const dialog = $('#rdExpenseEditor'), form = els.expenseForm;
    dialog.classList.add('ex-editor');
    const titleRow = document.createElement('div'); titleRow.className = 'ex-editor-title';
    $('#rdExpenseEditorTitle').before(titleRow); titleRow.append($('#rdExpenseEditorTitle'), $('.rd-expense-tools', dialog));
    $('.rd-dialog-body > [data-rd-trip]', dialog).classList.add('ex-editor-trip');
    $('[data-rd-action="receipt"]', dialog).innerHTML = `${icon('clipboard-text')} 텍스트 · 영수증`;
    $$('.payment-method-toggle button', form).forEach(button => { button.innerHTML = `${icon(button.dataset.paymentMethod === 'cash' ? 'money' : 'credit-card')} ${button.dataset.paymentMethod === 'cash' ? '현금' : '카드'}`; });
    form.noValidate = true;
    form.insertAdjacentHTML('afterbegin', `<div class="ex-amount-group" id="exAmountGroup"><div class="ex-field-title">결제 금액 <span aria-hidden="true">*</span></div><div class="ex-amount-input-row"><div id="exAmountInputs"></div><div id="exCurrencyMount"></div></div><div class="ex-conversion-row"><span id="exConversionSummary" aria-live="polite"></span><button type="button" id="exRateToggle" aria-expanded="false" aria-controls="exRatePanel">환율 수정</button></div><div id="exRatePanel" hidden></div></div>`);
    const amount = els.amountInput.closest('label'), foreign = els.foreignAmountInput.closest('label');
    amount.classList.add('ex-payment-amount'); foreign.classList.add('ex-payment-amount');
    $('#exAmountInputs').append(amount, foreign);
    $('.rd-amount-unit', amount)?.remove();
    $('#exCurrencyMount').append(els.currencySelect.closest('label'));
    $('#exRatePanel').append(els.exchangeRateInput.closest('label'));
    els.amountInput.setAttribute('aria-label', '결제 금액'); els.foreignAmountInput.setAttribute('aria-label', '결제 금액');
    els.currencySelect.dataset.compactCurrency = 'true'; syncCustomSelect(els.currencySelect, { rebuild: true });
    const category = els.categorySelect.closest('label'); category.hidden = true;
    form.insertAdjacentHTML('beforeend', `<fieldset class="ex-category-field"><legend>카테고리 <span aria-hidden="true">*</span></legend><div id="exCategoryChoices" class="ex-category-choices" role="group" aria-label="카테고리">${categories.map(c => `<button type="button" data-ex-category="${c}" aria-pressed="false" style="--ex-category:${categoryColors[c]}">${icon(categoryIcons[c])}<span>${c}</span></button>`).join('')}</div></fieldset>`);
    const dateRow = document.createElement('div'); dateRow.className = 'ex-date-row';
    dateRow.append(els.daySelect.closest('label'), $('#rdPaymentDate').closest('label'));
    form.append(dateRow);
    const description = els.descriptionInput.closest('label'); description.classList.add('ex-description-field');
    description.insertAdjacentHTML('beforeend', `<button type="button" class="ex-description-clear" id="exDescriptionClear" aria-label="내용 지우기" hidden>${icon('x')}</button>`);
    form.append($('.payment-method-field', form), $('#rdExpenseMemo'), els.submitButton);
    const order = [$('#exAmountGroup'), description, $('.ex-category-field', form), dateRow, els.lodgingFields, $('.payment-method-field', form), $('#rdExpenseMemo'), els.submitButton];
    order.forEach(element => form.appendChild(element));
    window.TripLog.features.expenses.reservationEditor.setup(form);
    els.daySelect.closest('label').querySelector('span').textContent = '여행 일정';
    customSelects.get(els.daySelect)?.button.setAttribute('aria-label', '여행 일정');
    $('#rdPaymentDate').dataset.compactDate = 'true'; $('#rdPaymentDate').required = true;
    [els.lodgingCheckInInput, els.lodgingCheckOutInput].forEach(input => { input.dataset.compactDate = 'true'; });
    [els.descriptionInput, els.daySelect, $('#rdPaymentDate')].forEach(input => input.closest('label').querySelector('span').insertAdjacentHTML('beforeend', '<em class="ex-required" aria-hidden="true">*</em>'));
    els.paymentMethodToggle.closest('.payment-method-field').querySelector('.payment-method-label').textContent = '결제 수단';
    els.noteInput.closest('label').querySelector('span').textContent = '메모';
    const pretripLink = $('[data-rd-action="reservation"]', dialog);
    pretripLink.classList.add('ex-pretrip-shortcut');
    pretripLink.innerHTML = `${icon('airplane-tilt')}${icon('bed')}<span>사전구매</span>${icon('caret-right')}`;
    pretripLink.setAttribute('aria-label', '항공권·숙소 사전구매 입력');
    dateRow.after(pretripLink);
    $('#rdExpenseMemo').append($('#rdDeleteExpense'));
    els.daySelect.addEventListener('change', () => { pretripLink.hidden = !!editingId || !isPreTripExpenseDate(els.daySelect.value); });
    $('#rdExpenseMemo summary').innerHTML = `${icon('user')}<span>메모 · 결제자</span>${icon('caret-down')}`;
    $('.rd-dialog-footer', dialog).insertAdjacentHTML('afterbegin', '<p id="exExpenseError" role="alert" hidden></p><button type="submit" form="expenseForm" id="exSaveAnother" class="ex-button ex-secondary">저장 후 계속</button>');
    ui = { dialog, form, amount, foreign, currency: els.currencySelect, error: $('#exExpenseError'), saveAnother: $('#exSaveAnother'), save: $('#rdExpenseSubmit') };
    $('#exDescriptionClear').addEventListener('click', () => { els.descriptionInput.value = ''; els.descriptionInput.dispatchEvent(new Event('input', { bubbles: true })); els.descriptionInput.focus(); });
    $('#exCategoryChoices').addEventListener('click', event => {
      const button = event.target.closest('[data-ex-category]'); if (!button) return;
      els.categorySelect.value = button.dataset.exCategory;
      els.categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    $('#exRateToggle').addEventListener('click', event => {
      const panel = $('#exRatePanel'); panel.hidden = !panel.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) { els.exchangeRateInput.focus(); els.exchangeRateInput.select(); }
    });
    form.addEventListener('submit', validate, true);
    form.addEventListener('input', () => { ui.error.hidden = true; $$('[aria-invalid="true"]', form).forEach(el => el.removeAttribute('aria-invalid')); syncAmount(); });
    dialog.addEventListener('close', () => { submitIntent = null; setSaving(false); setCompact(false); });
    window.visualViewport?.addEventListener('resize', updateCompactViewport);
    window.visualViewport?.addEventListener('scroll', updateCompactViewport);
  }

  function syncAmount() {
    if (!ready) return;
    const overseas = state.travelMode === 'overseas', currency = getCurrencyMeta(overseas ? ui.currency.value : 'KRW');
    const input = overseas ? els.foreignAmountInput : els.amountInput;
    ui.amount.hidden = overseas; ui.foreign.hidden = !overseas;
    els.foreignAmountInput.required = overseas;
    els.foreignAmountInput.disabled = !overseas;
    els.amountInput.readOnly = overseas;
    els.amountInput.required = !overseas;
    input.placeholder = '0';
    $('#exCurrencyMount').classList.toggle('is-fixed', !overseas);
    ui.currency.disabled = !overseas; syncCustomSelect(ui.currency);
    const foreignCurrency = overseas && currency.code !== 'KRW';
    const rate = parseFormattedNumber(els.exchangeRateInput.value);
    const summary = $('#exConversionSummary');
    summary.closest('.ex-conversion-row').hidden = !foreignCurrency;
    summary.closest('.ex-conversion-row').classList.toggle('needs-rate', !(rate > 0));
    summary.innerHTML = rate > 0 ? `<span aria-hidden="true">≈</span> <strong>${won(parseFormattedNumber(els.amountInput.value))}</strong>` : `${icon('warning-circle')}<span>환율 입력 필요</span>`;
    const rateToggle = $('#exRateToggle');
    rateToggle.hidden = !foreignCurrency;
    rateToggle.innerHTML = `${icon('pencil-simple')}<span>${rate > 0 ? `${currency.rateBase}${safe(currency.unit)} = ${Number(rate).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원` : '환율 입력'}</span>`;
    rateToggle.setAttribute('aria-label', `환율 수정${rate > 0 ? `, ${currency.rateBase}${currency.unit}당 ${rate}원` : ''}`);
    if (!foreignCurrency) { $('#exRatePanel').hidden = true; $('#exRateToggle').setAttribute('aria-expanded', 'false'); }
    $('#exDescriptionClear').hidden = !els.descriptionInput.value;
    window.TripLog.features.expenses.allocation.sync();
  }

  function syncEditor() {
    if (!ready) return;
    $('.ex-pretrip-shortcut', ui.dialog).hidden = !!editingId || !isPreTripExpenseDate(els.daySelect.value);
    syncAmount();
    $$('#exCategoryChoices button').forEach(button => { const selected = button.dataset.exCategory === els.categorySelect.value; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); });
    ui.saveAnother.hidden = Boolean(editingId);
    ui.save.textContent = editingId ? '변경 내용 저장' : '지출 저장';
  }

  function editorOpened(entry, options = {}) {
    if (!ready) return;
    window.TripLog.features.expenses.reservationEditor.open(entry, options);
    window.TripLog.features.expenses.allocation.open(entry);
    ui.error.hidden = true; $('#exRatePanel').hidden = true; $('#exRateToggle').setAttribute('aria-expanded', 'false');
    if (!editingId && state.travelMode === 'overseas' && !(parseFormattedNumber(els.exchangeRateInput.value) > 0)) {
      const code = els.currencySelect.value;
      const rate = code === state.currencyCode && Number(state.exchangeRate) > 0 ? state.exchangeRate : getDefaultExchangeRateForCurrency(code);
      setCommaNumberInputValue(els.exchangeRateInput, rate);
    }
    syncEditor();
    if (!options.focusBookingCode) $('.rd-dialog-body', ui.dialog).scrollTop = 0;
    if (!editingId && !matchMedia('(any-pointer: coarse)').matches) (state.travelMode === 'overseas' ? els.foreignAmountInput : els.amountInput).focus({ preventScroll: true });
  }

  function validate(event) {
    const overseas = state.travelMode === 'overseas', input = overseas ? els.foreignAmountInput : els.amountInput;
    let message = '', target = input;
    if (!(parseFormattedNumber(input.value) > 0)) message = '결제 금액을 0보다 크게 입력해 주세요.';
    else if (overseas && ui.currency.value !== 'KRW' && !(parseFormattedNumber(els.exchangeRateInput.value) > 0)) { message = '환율을 0보다 크게 입력해 주세요.'; target = els.exchangeRateInput; $('#exRatePanel').hidden = false; $('#exRateToggle').setAttribute('aria-expanded', 'true'); }
    else if (!els.descriptionInput.value.trim()) { message = '지출 내용을 입력해 주세요.'; target = els.descriptionInput; }
    else if (!getExpenseDayOptions(getTripDays()).some(day => day.date === els.daySelect.value)) { message = '기록할 여행 일정을 선택해 주세요.'; target = customSelects.get(els.daySelect)?.button; }
    else if (!$('#rdPaymentDate').value) { message = '결제일을 선택해 주세요.'; target = customDatePickers.get($('#rdPaymentDate'))?.button; }
    else if (isLodgingSplitMode() && !getLodgingPlan().valid) { message = getLodgingPlan().message; target = customDatePickers.get(els.lodgingCheckOutInput)?.button; }
    if (!message) { const issue = window.TripLog.features.expenses.reservationEditor.validate(); if (issue) ({ message, target } = issue); }
    if (!message) { const issue = window.TripLog.features.expenses.allocation.validate(); if (issue) ({ message, target } = issue); }
    if (!message) return;
    event.preventDefault(); event.stopImmediatePropagation();
    ui.error.textContent = message; ui.error.hidden = false;
    const folded = target?.closest('details'); if (folded) folded.open = true;
    target?.setAttribute('aria-invalid', 'true'); target?.focus();
  }

  function beginSubmit(submitter) {
    if (!ready) return;
    submitIntent = { another: submitter?.id === 'exSaveAnother' && !editingId, date: els.daySelect.value, category: els.categorySelect.value,
      paymentDate: $('#rdPaymentDate').value, payer: $('#rdPayer').value, paymentMethod: getSelectedPaymentMethod(),
      currency: els.currencySelect.value, exchangeRate: els.exchangeRateInput.value };
    setSaving(true);
  }

  function setSaving(saving) {
    if (!ready) return;
    ui.save.disabled = saving; ui.saveAnother.disabled = saving;
    ui.form.setAttribute('aria-busy', String(saving));
    window.TripLog.features.expenses.allocation.setSaving(saving);
  }

  function afterSave() {
    if (!ready) return false;
    const intent = submitIntent; submitIntent = null; setSaving(false);
    if (!intent?.another) return false;
    window.TripLog.features.redesign.workspace.openExpenseEditor();
    els.daySelect.value = intent.date; els.categorySelect.value = intent.category;
    els.currencySelect.value = intent.currency; els.exchangeRateInput.value = intent.exchangeRate;
    $('#rdPaymentDate').value = intent.paymentDate; $('#rdPayer').value = intent.payer;
    setPaymentMethod(intent.paymentMethod);
    [els.daySelect, els.categorySelect, els.currencySelect, $('#rdPayer')].forEach(select => syncCustomSelect(select));
    syncCustomDatePicker($('#rdPaymentDate')); updateExchangeRateGuide(); renderExpenseFormMode(); syncEditor();
    (state.travelMode === 'overseas' ? els.foreignAmountInput : els.amountInput).focus({ preventScroll: true });
    showToast('저장했어요. 다음 지출을 입력해 주세요.');
    return true;
  }

  function captureTripPreferences() {
    if (tripPreferences) return;
    const keys = ['travelMode', 'currencyCode', 'currencySymbol', 'currencyUnit', 'exchangeBase', 'exchangeRate', 'exchangeRateSource', 'exchangeRateUpdatedAt', 'currencyAutoMatchedCountryCode'];
    tripPreferences = { tripId: state.id, values: Object.fromEntries(keys.map(key => [key, state[key]])) };
  }

  function restoreTripPreferences() {
    if (!tripPreferences) return;
    if (tripPreferences.tripId === state.id) { exchangeRateFetchToken++; Object.assign(state, tripPreferences.values); }
    tripPreferences = null;
  }

  function setup() {
    if (ready) return;
    setupLedger(); setupEditor(); window.TripLog.features.expenses.allocation.setup(els.expenseForm); ready = true; syncEditor();
  }
  window.TripLog.register('features.expenses.workspace', { setup, renderLedger, syncAmount, syncEditor, editorOpened, beginSubmit, setSaving, afterSave, captureTripPreferences, restoreTripPreferences, setCompact });
})();
