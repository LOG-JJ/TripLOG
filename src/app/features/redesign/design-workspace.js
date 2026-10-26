(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const M = () => window.TripLog.features.redesign.model;
  const { icon, text, button, row, avatar } = window.TripLog.ui.markup;
  const logo = '<img class="rd-logo" src="src/assets/triplog-wordmark.png" alt="TripLOG">';
  let ready = false, expenseTab = 'all', expenseTrip = '', expenseReturnMode = '', lastTrip = '';
  let overlayReturnFocus = null;
  let editingTripId = '';
  let removingTripId = '';
  let settlementNameDraft = null, settlementNameSaving = false;
  const profileAccount = () => window.TripLog.features.collaboration.tripCollaboration.getCurrentAccount();
  const canEditTripSettings = () => {
    const record = window.TripLogSyncRepository.cached(state.id);
    return record?.role !== 'viewer' && !record?.archivedAt;
  };
  function prepareSettlementName() {
    const name = getSettlementSettings().leaderName, account = profileAccount();
    settlementNameDraft = { tripId: state.id, accountId: account?.id || '', name };
    $('#rdSettlementName').value = name;
    $('#rdSettlementNameError').textContent = '';
    $('#rdSettlementName').disabled = !canEditTripSettings();
    $('#rdSettlementNameSave').disabled = !canEditTripSettings();
    $('#rdSettlementNameProfile').disabled = !canEditTripSettings() || !account?.displayName?.trim();
  }
  async function saveSettlementName(event) {
    event.preventDefault();
    if (settlementNameSaving) return;
    const draft = settlementNameDraft, name = $('#rdSettlementName').value.trim();
    const error = message => { $('#rdSettlementNameError').textContent = message; };
    if (!draft || draft.tripId !== state.id || draft.accountId !== (profileAccount()?.id || '')) return error('여행이나 계정이 변경됐어요. 이름 수정 창을 다시 열어 주세요.');
    if (!canEditTripSettings()) return error('이 여행의 이름을 수정할 권한이 없어요.');
    if (!name || name.length > 80) return error('이름을 1~80자로 입력해 주세요.');
    if (getSettlementSettings().leaderName !== draft.name) return error('다른 곳에서 이름이 변경됐어요. 창을 다시 열어 확인해 주세요.');
    const previous = state.settlement;
    settlementNameSaving = true;
    ['#rdSettlementName', '#rdSettlementNameSave', '#rdSettlementNameProfile'].forEach(id => { $(id).disabled = true; });
    try {
      state.settlement = { ...previous, leaderName: name };
      if (!await saveAndRender()) {
        if (state.id === draft.tripId) { state.settlement = previous; window.TripLog.features.render.main.render(); }
        return error('이름을 저장하지 못했어요. 입력한 이름은 유지됩니다. 다시 시도해 주세요.');
      }
      if (state.id !== draft.tripId || settlementNameDraft !== draft) return;
      const saved = window.TripLogSyncRepository.cached(draft.tripId);
      if (saved && saved.snapshot.settlement.leaderName !== name) return error('다른 변경과 겹쳤어요. 저장 상태에서 변경 내용을 확인해 주세요.');
      $('#rdCompanions').close(); showToast('정산 이름을 저장했어요.');
    } finally {
      settlementNameSaving = false;
      $('#rdSettlementName').disabled = $('#rdSettlementNameSave').disabled = !canEditTripSettings();
      $('#rdSettlementNameProfile').disabled = !canEditTripSettings() || !profileAccount()?.displayName?.trim();
    }
  }
  function isTripEditing() { return Boolean(editingTripId && editingTripId === state.id); }
  function syncTripEdit() {
    const editing = isTripEditing();
    $('.rd-trip-edit').hidden = !editing;
    $('#rdTripEditFooter').hidden = !editing;
    $('#rdTripSave').hidden = !editing;
    $('#rdTripCreate').hidden = editing;
    if (editing) return;
    els.tripNameInput.value = state.tripName;
    els.startDateInput.value = state.startDate;
    els.endDateInput.value = state.endDate;
    syncCustomDatePicker(els.startDateInput); syncCustomDatePicker(els.endDateInput);
  }
  function cancelTripEdit() { editingTripId = ''; if (ready) { syncTripEdit(); window.TripLog.features.home.tripLibrary.render(); } }
  async function startTripEdit(id) {
    cancelTripEdit();
    if (!window.TripLog.persistence.stateStorage.getTrips().some(trip => trip.id === id)) return;
    if (await window.TripLog.persistence.stateStorage.switchTrip(id) === false || state.id !== id) return;
    editingTripId = state.id;
    syncTripEdit();
    window.TripLog.features.home.tripLibrary.render();
    $('.rd-trip-edit').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    els.tripNameInput.focus({ preventScroll: true });
  }
  async function saveTripEdit() {
    if (!isTripEditing()) return;
    const submittedTrip = state.id;
    const tripName = els.tripNameInput.value.trim(), startDate = els.startDateInput.value, endDate = els.endDateInput.value;
    if (!tripName) { showToast('여행 이름을 입력해 주세요.'); els.tripNameInput.focus(); return; }
    if (!startDate || !endDate || startDate > endDate) { showToast('여행 시작일과 종료일을 확인해 주세요.'); return; }
    Object.assign(state, { tripName, startDate, endDate });
    const dates = getTripDays().map(day => day.date);
    if (!isPreTripExpenseDate(state.selectedDate) && !dates.includes(state.selectedDate)) state.selectedDate = startDate;
    if (state.selectedItineraryDate !== 'all' && !dates.includes(state.selectedItineraryDate)) state.selectedItineraryDate = startDate;
    if (!dates.includes(state.lastActiveItineraryDate)) state.lastActiveItineraryDate = startDate;
    if (!await saveAndRender()) return;
    if (state.id !== submittedTrip) return;
    editingTripId = '';
    syncTripEdit();
    window.TripLog.features.home.tripLibrary.render();
    showToast('여행 정보를 수정했어요.');
  }
  const period = formatTripPeriod;
  const duration = formatTripDuration;
  function members() { const list = window.TripLog.features.collaboration.tripCollaboration.getTripMembers(); return list.length ? list : [{name:'나'}, ...(state.companions || [])]; }
  const heading = (title, subtitle = '', { tripContext = false } = {}) => `<div class="rd-heading${tripContext ? ' trip-context-heading tl-page-heading' : ''}"><h1>${title}</h1>${tripContext ? '<div data-trip-context></div>' : `<p ${subtitle ? '' : 'data-rd-trip'}>${subtitle || ''}</p>`}</div>`;
  function addView(page, markup) {
    const view = document.createElement('div');
    view.className = `rd-content rd-${page}`;
    view.innerHTML = markup;
    $(`#${page}Page`).replaceChildren(view);
  }
  function dialog(id, title, body, footer = '') {
    return window.TripLog.ui.dialog.create({ id, markup: `<div class="rd-dialog-head">${logo}${button(icon('x'),'close','rd-icon-button','aria-label="닫기"')}</div><div class="rd-dialog-body"><h1 id="${id}Title" tabindex="-1">${title}</h1><p data-rd-trip></p>${body}</div>${footer ? `<footer class="rd-dialog-footer">${footer}</footer>` : ''}`, dismissOutside: true,
      fallbackFocus: () => $('#rdMenuButton') });
  }
  function open(id) {
    if (id === 'rdPdf') { exportPdf(activePage === 'itinerary' ? 'itinerary' : 'expense'); return; }
    const el = $(`#${id}`); if (!el || el.open) return;
    if (['rdCompanions', 'rdSettlementDetails'].includes(id)) renderSettlementEditors(calculateTotals());
    if (id === 'rdCompanions') prepareSettlementName();
    const returnFocus = document.activeElement;
    window.TripLog.ui.dialog.open(el, { returnFocus });
  }
  function closeAll() { $$('.rd-dialog[open]').forEach(el => el.close()); }
  function navigate(page, { replace = false, date } = {}) {
    const samePage = page === activePage;
    if (page === 'itinerary') {
      state.selectedItineraryDate = date === 'all' || getTripDays().some(day => day.date === date) ? date : getDefaultItineraryDate();
      if (state.selectedItineraryDate !== 'all') state.lastActiveItineraryDate = state.selectedItineraryDate;
    }
    closeAll(); window.TripLog.features.itinerary.workspace?.close?.();
    const url = window.TripLog.navigation.pageRouter.pageUrl(page);
    if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState']({ page }, '', url);
    setActivePage(page);
    if (samePage && page === 'itinerary') window.TripLog.features.render.main.render({ pageOnly: true });
  }
  function selectNavigationItem(key) {
    const companionTabs = { today: 'today', review: 'review', wallet: 'wallet', tools: 'tools' };
    if (companionTabs[key]) {
      navigate('itinerary'); window.TripLog.features.travelCompanion.workspace.open(companionTabs[key]); return;
    }
    if (['expenses', 'expense-new', 'receipt', 'settlement'].includes(key)) {
      navigate(key === 'settlement' ? 'settlement' : 'budget');
      if (key === 'expense-new' || key === 'receipt') newExpense();
      if (key === 'receipt') window.TripLog.features.expenses.receiptInput.open();
      return;
    }
    if (key === 'itinerary') { navigate('itinerary'); return; }
    navigate('report');
    if (key === 'pdf') exportFullPdf();
    else window.TripLog.features.reports.workspace.setTab(key === 'report-itinerary' ? 'itinerary' : 'expenses');
  }
  function setupTripChooser() {
    const chooser = dialog('rdTripChooser','여행 바꾸기',`<div class="rd-trip-search" role="search">${icon('magnifying-glass')}<input id="rdTripSearch" type="search" aria-label="여행 이름이나 여행지 검색" placeholder="여행 이름이나 여행지 검색" autocomplete="off">${button(icon('x'),'trip-search-clear','rd-icon-button','aria-label="검색어 지우기" hidden')}</div><p id="rdTripSearchCount" role="status" aria-live="polite"></p><div id="rdTripChooserList"></div>`,button(`${icon('plus')} 새 여행 만들기`,'new-trip','rd-primary'));
    chooser.classList.add('rd-trip-chooser');
    $('.rd-logo',chooser).remove();
    $('.rd-dialog-head',chooser).prepend($('#rdTripChooserTitle'));
    $('[data-rd-trip]',chooser).remove();
    $('#rdTripSearch').addEventListener('input',renderTripChooser);
    chooser.addEventListener('close',()=>{
      $('#rdOverviewTripButton')?.setAttribute('aria-expanded','false');
      if(activePage==='overview'&&!$('.rd-overlay:not([hidden])')&&!$('dialog[open]')) $('#rdOverviewTripButton')?.focus({preventScroll:true});
    });
  }
  function renderTripChooser() {
    const stored = window.TripLog.persistence.stateStorage.getTrips();
    const trips = [state,...(Array.isArray(stored)?stored:[]).filter(trip=>trip.id!==state.id)];
    const normalize = value => String(value||'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g,'');
    const query = normalize($('#rdTripSearch').value), today = M().localDate();
    const matching = trips.filter(trip=>normalize([trip.tripName,trip.city,trip.country].join(' ')).includes(query)).sort((a,b)=>{
      if(a.id===state.id)return -1;if(b.id===state.id)return 1;
      const aPast=!!a.endDate&&a.endDate<today,bPast=!!b.endDate&&b.endDate<today;
      return Number(aPast)-Number(bPast)||(aPast?String(b.startDate||'').localeCompare(String(a.startDate||'')):String(a.startDate||'').localeCompare(String(b.startDate||'')));
    });
    $('[data-rd-action="trip-search-clear"]').hidden=!$('#rdTripSearch').value;
    $('#rdTripSearchCount').textContent=query?`${matching.length}개의 여행을 찾았어요`:`저장된 여행 ${trips.length}개`;
    $('#rdTripChooserList').setAttribute('aria-busy', String(Boolean(removingTripId)));
    $('#rdTripChooserList').innerHTML=matching.length?matching.map(trip=>{
      const current=trip.id===state.id, past=trip.endDate&&trip.endDate<today;
      const name=trip.tripName||'새로운 여행', deleteDisabled=trips.length<=1||Boolean(removingTripId);
      const thumbnail=/서울/.test(trip.city||'')?'<img src="src/assets/seoul-tower.png" alt="">':icon(trip.travelMode==='overseas'?'airplane-tilt':'suitcase-rolling');
      return `<div class="rd-trip-choice ${current?'is-current':''}"><button type="button" class="rd-trip-choice-select" data-rd-action="trip-select" data-id="${text(trip.id)}" aria-pressed="${current}" ${removingTripId?'disabled':''}><span class="rd-trip-thumbnail">${thumbnail}</span><span class="rd-trip-choice-copy"><strong>${text(name)}</strong><span>${text([trip.city,trip.country].filter(Boolean).join(' · ')||'목적지 미정')}</span><small>${text(trip.startDate?.slice(0,4)||'')} · ${period(trip)} · ${duration(trip)}</small>${current?'<em>현재 여행</em>':past?'<em class="is-past">MEMORIES</em>':''}</span>${icon(current?'radio-button':'circle')}</button><button type="button" class="rd-trip-delete" data-rd-action="trip-choice-delete" data-id="${text(trip.id)}" aria-label="${text(name)} 여행 삭제" title="${trips.length<=1?'마지막 여행은 삭제할 수 없어요':'여행 삭제'}" ${deleteDisabled?'disabled':''}>${icon('trash')}</button></div>`;
    }).join(''):`<div class="rd-trip-search-empty">${icon('magnifying-glass')}<strong>검색 결과가 없어요</strong><p>다른 여행 이름이나 여행지를 입력해 보세요.</p></div>`;
  }
  async function removeTripFromChooser(id) {
    if (removingTripId) return;
    const chooser=$('#rdTripChooser'), list=$('#rdTripChooserList'), scrollTop=list.scrollTop;
    removingTripId=id;
    renderTripChooser();
    try {
      const removed=await window.TripLog.persistence.stateStorage.deleteTrip(id);
      if (removed) showToast('여행을 목록에서 삭제했어요.');
    } finally {
      removingTripId='';
      if (chooser.open) {
        renderTripChooser();list.scrollTop=scrollTop;
        const button=$$('.rd-trip-delete').find(button=>button.dataset.id===id&&!button.disabled);
        (button||$('#rdTripSearch')).focus({preventScroll:true});
      }
    }
  }
  function openTripChooser() {
    $('#rdTripSearch').value='';renderTripChooser();open('rdTripChooser');
    $('#rdOverviewTripButton')?.setAttribute('aria-expanded','true');
  }
  function move(selector, target) { const node = typeof selector === 'string' ? $(selector) : selector; const parent = typeof target === 'string' ? $(target) : target; if (node && parent) parent.appendChild(node); return node; }
  function openExpenseEditor(entry, options = {}) {
    if (!ready) return;
    expenseTrip = state.id;
    $('#rdExpenseEditorTitle').textContent = entry ? '지출 수정' : '지출 추가';
    $('#rdPaymentDate').value = entry ? M().paymentDate(entry) : M().localDate();syncCustomDatePicker($('#rdPaymentDate'));
    renderPayers(entry?.payerKey || 'leader');
    $('#rdDeleteExpense').hidden = !entry;
    $('#rdExpenseSubmit').textContent = entry ? '변경 내용 저장' : '지출 저장';
    $('#rdExpenseMemo').open = Boolean(entry?.note || entry?.payerKey && entry.payerKey !== 'leader');
    open('rdExpenseEditor');
    window.TripLog.features.expenses.workspace.editorOpened(entry, options);
  }
  function renderPayers(value = $('#rdPayer')?.value || 'leader') {
    const payers = getSettlementMembers();
    $('#rdPayer').innerHTML = payers.map(member => `<option value="${text(member.key)}">${text(member.name)}</option>`).join('');
    $('#rdPayer').value = payers.some(m => m.key === value) ? value : 'leader';
    syncCustomSelect($('#rdPayer'));
  }
  function newExpense() { expenseReturnMode = state.travelMode; clearEditMode(); openExpenseEditor(); }
  function expenseSaved() { if (!ready) return; if (window.TripLog.features.expenses.workspace?.afterSave()) return; $('#rdExpenseEditor').close(); showToast('지출을 저장했어요.'); }
  function showSavedPretrip(entry) {
    // Opening or saving an expense preserves the user's current list controls.
    renderExpenses();
    const button = $$('#rdExpenseList [data-rd-action="expense-edit"]').find(element => element.dataset.id === entry.id);
    button?.closest('tr')?.classList.add('pp-saved-entry');
    button?.scrollIntoView({ block: 'nearest' }); button?.focus({ preventScroll: true });
  }
  function expenseMetadata() { return {paymentDate: $('#rdPaymentDate')?.value || '', payerKey: $('#rdPayer')?.value || 'leader'}; }
  function confirmAction(message) {
    return window.TripLog.ui.confirmation.ask(message);
  }
  function showReservation(mode, options = {}) {
    if (options.entry) { closeAll(); startEdit(options.entry, options); return; }
    closeAll(); clearEditMode(); openPretripPurchaseMenu(mode, options);
    els.pretripPurchasePanel.hidden = false; open('rdReservation');
    if (options.focusBookingCode) { const input = mode === 'hotel' ? els.pretripHotelBookingCodeInput : els.pretripFlightBookingCodeInput; input.closest('details').open = true; input.focus(); }
  }
  function setupForms() {
    dialog('rdExpenseEditor','지출 추가',`<div class="rd-expense-tools">${button(`${icon('camera')} 영수증`,'receipt','rd-receipt-launch','aria-haspopup="dialog" aria-controls="receiptDialog" aria-expanded="false"')}</div><div id="rdExpenseFormMount"></div><p id="rdReceiptNotice"></p>${button(`${icon('airplane')} 항공권·숙소 사전구매 ${icon('caret-right')}`,'reservation','rd-subtle-row')}${button('지출 삭제','delete-expense','rd-danger','id="rdDeleteExpense" hidden')}`, '<button id="rdExpenseSubmit" class="rd-button rd-primary" type="submit" form="expenseForm">지출 저장</button>');
    move(els.expenseForm, '#rdExpenseFormMount');
    const form = els.expenseForm;
    const amount = els.amountInput.closest('label'), description = els.descriptionInput.closest('label');
    form.prepend(description); form.prepend(amount); form.prepend($('#amountFieldAnchor'));
    amount.classList.add('rd-amount-field'); description.classList.add('rd-description-field');
    amount.querySelector('span').textContent = '금액';
    els.daySelect.closest('label').querySelector('span').textContent = '기록할 일자';
    const payment = document.createElement('label'); payment.className = 'rd-payment-date wide'; payment.innerHTML = '<span>결제일</span><input type="date" id="rdPaymentDate" aria-label="결제일">';
    form.insertBefore(payment, $('.payment-method-field', form));
    setupCustomDatePicker($('#rdPaymentDate'));
    amount.insertAdjacentHTML('beforeend','<b class="rd-amount-unit" aria-hidden="true">원</b>');
    $$('.payment-method-toggle button',form).forEach(el=>el.innerHTML=icon(el.dataset.paymentMethod==='cash'?'coins':'credit-card')+' '+(el.dataset.paymentMethod==='cash'?'현금':'카드'));
    const details = document.createElement('details'); details.id = 'rdExpenseMemo'; details.className = 'rd-details wide'; details.innerHTML = `<summary>${icon('note')} 메모·결제한 사람 ${icon('caret-down')}</summary><label><span>결제한 사람</span><select id="rdPayer"></select></label>`;
    move(els.noteInput.closest('label'), details); form.insertBefore(details, els.submitButton);
    move($('#receiptAppliedStatus'), '#rdReceiptNotice');
    $('#rdExpenseEditor').addEventListener('cancel', () => { state.travelMode = expenseReturnMode || state.travelMode; clearEditMode(); });
    form.addEventListener('submit', event => { if (expenseTrip !== state.id) { event.preventDefault(); event.stopImmediatePropagation(); showToast('여행이 변경됐어요. 지출 창을 다시 열어 주세요.'); } }, true);
    dialog('rdReservation','사전구매','<div id="rdReservationMount"></div>', `${button('취소','close','pp-cancel')}<button id="pretripPurchaseSubmit" type="submit" form="pretripFlightForm" class="rd-button rd-primary">항공권 저장</button>`);
    move(els.pretripPurchasePanel, '#rdReservationMount');
    window.TripLog.features.expenses.pretripPurchases.connectDialog();
  }
  function setupSettings() {
    dialog('rdProfile','여행 프로필','<div id="rdProfileMount"></div>');
    ['#settingsAccountStatus','.settings-account-form','.settings-account-actions'].forEach(s => move(s,'#rdProfileMount'));
    dialog('rdCurrency','여행 방식·통화','<div id="rdCurrencyMount"></div>'); move($('#settingsCurrencyArea').parentElement,'#rdCurrencyMount');
    dialog('rdBackup','백업·불러오기','<div id="rdBackupMount"></div>'); move($('#settingsStorageTitle').closest('.itinerary-main-panel'),'#rdBackupMount');
    dialog('rdAdvanced','고급 연결 설정','<div id="rdAdvancedMount"></div>'); move($('.settings-supabase-box'),'#rdAdvancedMount'); move($('#settingsGoogleGeocodingKeyInput').closest('.itinerary-main-panel'),'#rdAdvancedMount');
    window.TripLog.features.print.studio.setup();
    move($('.settings-privacy-options'),'#rdPrivacyMount');
    const privacyLabels = ['일정 공유','지출 공유','이메일 공개','초대 링크 수락 허용'];
    $$('#rdPrivacyMount label').forEach((label, i) => { label.classList.add('rd-switch-row'); label.querySelector('span').textContent = privacyLabels[i]; label.insertAdjacentHTML('afterbegin', icon(['calendar-blank','wallet','envelope','link'][i])); });
    move($('#rdPrivacyMount label:last-child'),'#rdAdvancedMount');
    dialog('rdSettlementDetails','항목별 분담','<div id="rdSettlementSource"></div><div id="rdSettlementLedger"></div>');
    move($('#settlementExpenseSourceSelect').closest('label'),'#rdSettlementSource'); move($('#settlementSourceSummary'),'#rdSettlementSource'); move($('#settlementExpenseSplitList'),'#rdSettlementLedger');
    dialog('rdCompanions','정산 멤버 관리',`<form id="rdSettlementNameForm" class="rd-settlement-name-form"><label for="rdSettlementName"><span>정산 이름</span><input id="rdSettlementName" type="text" maxlength="80" required autocomplete="off"></label><div class="rd-settlement-name-actions">${button('내 프로필 이름 사용','settlement-name-profile','','id="rdSettlementNameProfile"')}<button id="rdSettlementNameSave" type="submit" class="rd-button rd-secondary">이름 저장</button></div><p id="rdSettlementNameError" class="rd-muted" role="alert"></p></form><p>멤버가 따로 낸 추가 지출도 정산에 포함할 수 있어요.</p><div id="rdCompanionMount"></div>`);
    $('#rdSettlementNameForm').addEventListener('submit', saveSettlementName);
    ['#settlementMemberForm','#settlementMembersList','#settlementIndividualSpentInputs'].forEach(s=>move(s,'#rdCompanionMount'));
  }
  function setupExistingDialogs() {
    for (const id of ['newTripModal','historyModal','tripInviteModal','tripInviteAcceptModal']) {
      const overlay = $(`#${id}`), sheet = overlay.firstElementChild;
      overlay.classList.add('rd-overlay'); sheet.classList.add('rd-sheet');
      sheet.insertAdjacentHTML('afterbegin', `<div class="rd-sheet-brand">${logo}</div>`);
      $$('.overline', sheet).forEach(el=>el.hidden = true);
      const close = $('.modal-close',sheet); close.innerHTML = icon('x');
      new MutationObserver(() => {
        if (!overlay.hidden) { overlayReturnFocus = document.activeElement; els.appShell.inert = true; close.focus({preventScroll:true}); }
        else if (!$('.rd-overlay:not([hidden])')) { els.appShell.inert = false; (overlayReturnFocus?.isConnected ? overlayReturnFocus : $('#rdMenuButton'))?.focus({preventScroll:true}); }
      }).observe(overlay,{attributes:true,attributeFilter:['hidden']});
      overlay.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape') { event.preventDefault(); close.click(); }
        if (event.key !== 'Tab') return;
        const focusables = $$('button,input,select,a[href],[tabindex="0"]',sheet).filter(el=>!el.disabled && el.getClientRects().length);
        const first=focusables[0],last=focusables.at(-1);
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
      });
    }
    $('#newTripModalTitle').textContent = '새 여행 만들기';$('#newTripModalTitle').insertAdjacentHTML('afterend','<p>설렘은 여기서부터</p>');$('.new-trip-field-label').textContent='여행 유형';
    $('#newTripModal .modal-head').insertAdjacentHTML('beforeend','<img class="rd-ticket-art" src="src/assets/travel-tickets.png" alt="">');
    $('#newTripForm button[type="submit"]').textContent = '여행 만들기';
    $('#newTripModeToggle').querySelectorAll('button').forEach(el=>el.insertAdjacentHTML('afterbegin',icon('circle')+icon('radio-button')+' '));
    $('#newTripForm').insertAdjacentHTML('beforeend','<p id="rdNewTripDuration" class="rd-info"></p>');
    $('#newTripForm').addEventListener('change',()=>$('#rdNewTripDuration').textContent=duration({startDate:els.newTripStartDateInput.value,endDate:els.newTripEndDateInput.value}));
    $('#historyList').insertAdjacentHTML('beforebegin','<h3 id="rdHistoryCount"></h3>');
    $('#historyModalTitle').parentElement.insertAdjacentHTML('beforeend','<p>여행의 기록을 안전하게</p>');
    $('#historyModal .modal-head').insertAdjacentHTML('beforeend','<img class="rd-archive-art" src="src/assets/archive-box.png" alt="">');
    $('#historyModal .history-modal').insertAdjacentHTML('beforeend',`${row('백업 파일 내보내기','upload-simple','export')}${row('백업 파일 불러오기','download-simple','import')}<p class="rd-muted">저장 기록은 이 브라우저에 보관돼요.</p>${button(`${icon('plus')} 현재 여행 저장`,'save-snapshot','rd-primary')}`);
    $('#tripInviteTitle').textContent = '함께 떠나요';$('#tripInviteTitle').insertAdjacentHTML('afterend','<p data-rd-trip></p>');
    $('.trip-invite-body').insertAdjacentHTML('afterbegin','<div id="rdInviteMembers"></div>');
    $('#tripInviteCopyButton').textContent = '초대 링크 복사';const inviteInfo=document.createElement('div');inviteInfo.className='rd-invite-info';$('.trip-invite-body').appendChild(inviteInfo);move($('#tripInviteStatus'),inviteInfo);inviteInfo.insertAdjacentHTML('beforeend',button('공유 설정','invite-settings','rd-invite-settings'));
    $('#receiptDialog').classList.add('rd-receipt');
    $('#receiptDialog').insertAdjacentHTML('afterbegin',`<div class="rd-receipt-brand">${logo}</div>`);
    $('#receiptStatus').insertAdjacentHTML('beforebegin',`<details id="rdReceiptStatusInfo" class="rd-receipt-info"><summary>${icon('check-circle')}<span id="rdReceiptStatusMount"></span>${icon('caret-down')}</summary><div id="rdReceiptGuidance"></div></details>`);
    move($('#receiptStatus'),'#rdReceiptStatusMount');move($('#receiptWarnings'),'#rdReceiptGuidance');move($('#receiptTextDetails'),'#rdReceiptGuidance');
    $('.receipt-image-actions').insertAdjacentHTML('afterbegin',button(`${icon('image')} 다시 선택`,'receipt-reselect','receipt-small-button'));
    $('#receiptRotateButton').innerHTML=icon('arrow-clockwise');$('#receiptRotateButton').setAttribute('aria-label','영수증 90도 회전');$('#receiptCropButton').textContent='자르기';
    $('#receiptDialogTitle').insertAdjacentHTML('afterend','<p class="rd-receipt-subtitle">텍스트 붙여넣기 또는 사진으로 입력</p>');
    $('#receiptDialogTitle').textContent = '지출 정보 가져오기'; $('#receiptCloseButton').innerHTML = icon('x');
    const receiptGrid=$('.receipt-review-grid');['#receiptMerchant','#receiptAmount','#receiptCurrency','#receiptDate','#receiptExpenseDate','#receiptCategory','#receiptPayment'].forEach(id=>move($(id).closest('label'),receiptGrid));
    $('#receiptReviewForm > .receipt-hint').textContent='사진은 이 기기에서만 인식해요. 금액·일자를 확인해 주세요.';
    $('#receiptApplyButton').textContent='지출 정보에 적용';$('#receiptDialog .receipt-dialog-footer span').textContent='내용을 확인한 뒤 지출 저장을 누르면 저장돼요.';
    new MutationObserver(()=>{const review=!$('#receiptReviewForm').hidden;$('#receiptDialog').classList.toggle('rd-receipt-review',review);if(review)$('#rdReceiptStatusInfo').open=false;}).observe($('#receiptReviewForm'),{attributes:true,attributeFilter:['hidden']});
    $('#receiptDialog').addEventListener('toggle',()=> { const active=$('#receiptDialog').open; $$('[data-rd-action="receipt"],[data-rd-action="receipt-start"]').forEach(button=>{button.classList.toggle('active',active);button.setAttribute('aria-expanded',String(active));}); });
    $('#receiptDialog').addEventListener('close',()=> { if (!$('#receiptAppliedStatus').hidden && !$('#rdExpenseEditor').open) open('rdExpenseEditor'); const receiptDate=window.TripLog.features.expenses.receiptInput.metadata()?.recognizedDate;if(receiptDate&&!$('#receiptAppliedStatus').hidden){$('#rdPaymentDate').value=receiptDate;syncCustomDatePicker($('#rdPaymentDate'));} });
  }
  function setupAuth() {
    const eye = $('.rd-password-eye');
    eye.addEventListener('click',()=> {const shown=els.authGatePasswordInput.type==='password';els.authGatePasswordInput.type=shown?'text':'password';eye.setAttribute('aria-pressed',String(shown));eye.setAttribute('aria-label',shown?'비밀번호 숨기기':'비밀번호 표시');});
  }
  function setup() {
    if(ready)return;ready=true;lastTrip=state.id;document.body.classList.add('rd-app');
    $('#appShell').insertAdjacentHTML('afterbegin',`<header class="rd-header"><a href="/Travel?page=start" class="rd-brand-link" data-rd-nav="start" aria-label="내 여행 보관함">${logo}</a>${button(icon('user'),'profile','tl-library-profile','aria-label="내 프로필"')}${button(icon('gear'),'nav-settings','rd-icon-button','id="rdMenuButton" aria-label="설정 열기"')}</header>`);
    const sync = els.itineraryPageButton;
    sync.className = 'rd-button rd-sync';
    sync.replaceChildren();
    sync.setAttribute('aria-label', '저장 상태 자세히 보기');
    const headerActions = document.createElement('div'); headerActions.className = 'rd-header-actions';
    $('.rd-header').appendChild(headerActions); headerActions.append(sync, $('#rdMenuButton'));
    $('#appShell').insertAdjacentHTML('beforeend','<nav class="rd-nav" aria-label="주 메뉴"></nav>');
    addView('overview',`<div class="rd-heading tl-page-heading"><div class="rd-overview-heading"><h1>여행 개요</h1>${button(`${icon('plus')} 새 여행`,'new-trip','rd-overview-new','aria-label="새 여행 만들기"')}</div></div><div id="rdOverview"></div>`);
    addView('start',window.TripLog.features.home.tripLibrary.markup()+`<section class="rd-trip-edit" hidden><div class="rd-section-head"><h2>여행 수정</h2>${button('취소','trip-cancel','rd-text-button')}</div><p>내용을 바꾼 뒤 아래 여행 수정 버튼을 눌러 저장해 주세요.</p><div id="rdTripEditMount" class="rd-form-grid"></div></section><div class="rd-page-footer" id="rdTripEditFooter" hidden>${button('여행 수정','trip-save','rd-primary','id="rdTripSave" hidden')}</div>`);
    ['#tripNameInput','#startDateInput','#endDateInput'].forEach(s=>move($(s).closest('label'),'#rdTripEditMount'));els.tripNameInput.closest('label').hidden=false;
    addView('budget', '');
    addView('settlement',heading('경비 정산')+'<div id="rdSettlement"></div>');
    addView('report',heading('여행 리포트', '', { tripContext: true })+`<section id="rdReportSummary" class="cost-summary-host" aria-label="여행 경비 요약"></section><div class="rd-tabs">${button('지출 분석','report-expenses','active','id="rdReportExpenseTab"')}${button('일정 분석','report-itinerary','','id="rdReportItineraryTab"')}</div><div id="rdReportExpenses"></div><div id="rdReportItinerary" hidden></div><div class="rd-page-footer">${button(`${icon('file-pdf')} 리포트 PDF 저장`,'pdf-full','rd-secondary')}</div>`);
    $('#rdReportItinerary').innerHTML = '<div id="rdPlanAnalytics"></div>';
    addView('settings',heading('설정','여행을 내 방식대로')+`<div id="rdProfileSummary"></div><section class="rd-setting-group"><h2>여행 설정</h2><div id="rdSettingsTrip"></div></section><section class="rd-setting-group"><h2>공유 설정</h2><div id="rdPrivacyMount"></div></section><section class="rd-setting-group"><h2>기록 관리</h2>${row('저장 기록','bookmark-simple','history')}${row('백업·불러오기','download-simple','backup')}${row('PDF 저장','file-text','pdf')}</section>${row('고급 연결 설정','gear','advanced')}<button class="rd-logout" data-rd-action="logout" type="button">로그아웃</button>`);
    setupForms();setupSettings();setupExistingDialogs();setupAuth();setupTripChooser();
    $$('.custom-date-button').forEach(el=>{el.insertAdjacentHTML('afterbegin',icon('calendar-blank'));$('.custom-date-icon',el).innerHTML=icon('caret-down');});
    dialog('rdMemberInfo','멤버 정보','<div id="rdMemberInfoBody"></div>');
    window.TripLog.ui.confirmation.setup();
    const tools = move($('#itineraryToolsDialog'),document.body);tools.classList.add('rd-dialog');tools.insertAdjacentHTML('beforeend',`<div class="rd-dialog-head">${logo}${button(icon('x'),'close','rd-icon-button','aria-label="준비물 닫기"')}</div><div class="rd-dialog-body"><h1>여행 준비물</h1><p data-rd-trip></p><div id="rdPacking"></div><label class="rd-packing-add"><span>준비물 추가</span><div id="rdPackingInputMount"></div></label>${button('기본 목록으로 되돌리기','packing-reset','rd-text-button')}<p class="rd-muted">체크한 내용은 자동으로 저장돼요.</p></div><footer class="rd-dialog-footer">${button('완료','close','rd-primary')}</footer>`);move(els.packingInput,'#rdPackingInputMount');move(els.packingAddBtn,'#rdPackingInputMount');els.packingAddBtn.innerHTML=icon('plus');els.packingAddBtn.setAttribute('aria-label','준비물 추가');els.packingInput.placeholder='챙길 물건을 입력하세요';
    window.TripLog.navigation.tripNavigation.setup({ navigate, select: selectNavigationItem });
    document.addEventListener('click',handleClick);
    window.addEventListener('popstate', async () => {
      const url = new URL(location.href), tripId = url.searchParams.get('trip');
      let page = url.searchParams.get('page') || 'start';
      if (tripId && tripId !== state.id) {
        if (window.TripLog.persistence.stateStorage.getTrips().some(trip => trip.id === tripId)) {
          if (await window.TripLog.persistence.stateStorage.switchTrip(tripId) === false) return;
          if (location.href !== url.href) return;
        } else page = 'start';
      }
      navigate(page, { replace: true });
    });
    window.TripLog.features.expenses.workspace?.setup();
    window.TripLog.features.home.tripLibrary.setup();
    $('#triplogFormSources').remove();
    render();
  }
  function renderTrips() {
    syncTripEdit();
    window.TripLog.features.home.tripLibrary.render();
  }
  function renderExpenses() { window.TripLog.features.expenses.workspace.renderLedger(expenseTab); }
  function render({ pageOnly = false } = {}) {
    if(!ready)return;
    if(lastTrip!==state.id){closeAll();lastTrip=state.id;expenseTab='all';els.expenseSearchInput.value='';editingTripId='';}
    $$('[data-rd-trip]').forEach(el=>el.textContent=state.tripName||'새로운 여행');
    window.TripLog.ui.tripContext.update(state);
    window.TripLog.navigation.tripNavigation.sync();
    if (!window.TripLog.features.home.tripLibrary.reconcileInitialTrip()) {
      if (activePage === 'overview') $('#rdOverview').innerHTML = '<p class="rd-empty" role="status">여행을 불러오는 중이에요.</p>';
      return;
    }
    const totals=calculateTotals();
    if(activePage==='overview')window.TripLog.features.overview.workspace.render();
    if(activePage==='start')renderTrips();
    if(activePage==='budget')renderExpenses();
    if(activePage==='settlement')window.TripLog.features.settlement.workspace.render(totals);
    if(activePage==='report')window.TripLog.features.reports.workspace.render();
    if(activePage==='settings'){
      $('#rdProfileSummary').innerHTML=`<button type="button" class="rd-profile-row" data-rd-action="profile">${icon('user-circle')}<span><b>${text($('#settingsAccountNameInput')?.value||members()[0]?.name||'나')}</b><small>여행 프로필</small></span>${icon('pencil-simple')}</button>`;
      $('#settingsPage [data-rd-action="history"] small').textContent=`${historyRecords.length}개`;
      $('#rdSettingsTrip').innerHTML=row('내 여행','suitcase','nav-start',state.tripName)+row('여행 정보 수정','pencil-simple','trip-edit-current')+row('여행 방식·통화','currency-krw','currency',`${state.travelMode==='overseas'?'해외':'국내'} · ${state.currencyCode||'KRW'}`)+row('멤버·초대 관리','users-three','invite',`${members().length}명`)+row('저장 상태·공동 작업','cloud-check','sync-status');
    }
    if (pageOnly) return;
    if ($('#rdCompanions').open || $('#rdSettlementDetails').open) renderSettlementEditors(totals);
    if ($('#itineraryToolsDialog').open) window.TripLog.features.packing.workspace.render();
    renderMembers();
    if($('#rdExpenseEditor').open)renderPayers();
    if($('#rdTripChooser').open)renderTripChooser();
  }
  function renderMembers() {
    if (!ready) return;
    const team = members();
    const list = $('#rdInviteMembers');
    const markup = `<div class="rd-invite-period">${icon('users-three')}<span><b>${period(state)}</b><small>${duration(state)}</small></span></div><h2>함께하는 멤버</h2>${team.map((m,i)=>`<button type="button" class="rd-invite-member" data-rd-action="member-info" data-index="${i}">${avatar(m.name,i)}<b>${text(m.name)}</b><span>${m.role==='owner'||!i?'방장':'멤버'}</span>${icon('caret-right')}</button>`).join('')}<h2>초대 링크</h2>`;
    // Avoid replacing focused member buttons when the roster did not change.
    if (list.innerHTML !== markup) list.innerHTML = markup;
    $$('.rd-team').forEach(button => {
      button.setAttribute('aria-label', `여행 멤버 ${team.length}명 보기`);
      $('span', button).textContent = `${team.length}명`;
    });
    const settingCount = $('#rdSettingsTrip [data-rd-action="invite"] small');
    if (settingCount) settingCount.textContent = `${team.length}명`;
  }
  async function handleClick(event) {
    const nav=event.target.closest('[data-rd-nav]');if(nav){event.preventDefault();navigate(nav.dataset.rdNav);return;}
    const el=event.target.closest('[data-rd-action]');if(!el)return;const action=el.dataset.rdAction;
    if(action.startsWith('nav-')){navigate(action.slice(4));return;}
    const simple={profile:'rdProfile',currency:'rdCurrency',backup:'rdBackup',advanced:'rdAdvanced',split:'rdSettlementDetails',companions:'rdCompanions'};
    if(simple[action]){open(simple[action]);return;}
    switch(action){
      case 'pdf':closeAll();exportPdf(activePage === 'itinerary' ? 'itinerary' : 'expense');break;
      case 'settlement-name':open('rdCompanions');$('#rdSettlementName').focus();$('#rdSettlementName').select();break;
      case 'settlement-name-profile':{
        const name=profileAccount()?.displayName?.trim();
        if(name&&canEditTripSettings()){$('#rdSettlementName').value=name.slice(0,80);$('#rdSettlementName').focus();}
        break;
      }
      case 'close': {const parent=el.closest('dialog');if(parent?.id==='rdExpenseEditor'){state.travelMode=expenseReturnMode||state.travelMode;clearEditMode();}parent?.close();break;}
      case 'companion':window.TripLog.features.travelCompanion.workspace.open('today');break;
      case 'companion-transport':window.TripLog.features.travelCompanion.workspace.open('wallet','transport');break;
      case 'companion-stay':window.TripLog.features.travelCompanion.workspace.open('wallet','stay');break;
      case 'companion-transport-new':window.TripLog.features.travelCompanion.workspace.addReservation('transport');break;
      case 'companion-stay-new':window.TripLog.features.travelCompanion.workspace.addReservation('stay');break;
      case 'companion-wallet':window.TripLog.features.travelCompanion.workspace.open('wallet');break;
      case 'companion-tools':window.TripLog.features.travelCompanion.workspace.open('tools');break;
      case 'expense-new':newExpense();break;
      case 'expense-edit':expenseReturnMode=state.travelMode;startEdit(findEntry(el.dataset.id));break;
      case 'delete-expense': {
        const id = editingId, trip = state.id, entry = findEntry(id);
        if (!entry) break;
        const message = state.itineraryItems.some(item => item.expenseId === id) ? '연결된 일정은 유지돼요.' : '';
        if (await confirmAction({ kind: 'expense', subject: `${entry.description || '지출'} · ${formatWon(entry.amount)}`, message }) && trip === state.id && editingId === id) {
          if (await deleteEntry(id) && trip === state.id && !editingId) { $('#rdExpenseEditor').close(); showToast('지출을 삭제했어요.'); }
        }
        break;
      }
      case 'receipt-reselect':$('#receiptAlbumButton').click();break;
      case 'receipt-start':newExpense();window.TripLog.features.expenses.receiptInput.open();break;
      case 'receipt':window.TripLog.features.expenses.receiptInput.open();break;
      case 'expense-tab':expenseTab=el.dataset.tab;renderExpenses();break;
      case 'category':setFilter(el.dataset.category);break;
      case 'cost-category':{
        expenseTab='all';els.expenseSearchInput.value='';navigate('budget');setFilter(el.dataset.category);
        const title=$('#budgetPage .ex-heading h1');title?.setAttribute('tabindex','-1');title?.focus({preventScroll:true});break;
      }
      case 'report-category':setFilter(el.dataset.category);navigate('budget');break;
      case 'report-expenses':window.TripLog.features.reports.workspace.setTab('expenses');break;
      case 'report-itinerary':window.TripLog.features.reports.workspace.setTab('itinerary');break;
      case 'trip-choose':openTripChooser();break;
      case 'trip-choice-delete':await removeTripFromChooser(el.dataset.id);break;
      case 'trip-search-clear':$('#rdTripSearch').value='';renderTripChooser();$('#rdTripSearch').focus();break;
      case 'trip-select':{
        const target=window.TripLog.persistence.stateStorage.getTrips().find(trip=>trip.id===el.dataset.id);
        if(!target){renderTripChooser();showToast('여행 목록이 변경됐어요. 다시 선택해 주세요.');break;}
        if(target.id===state.id){$('#rdTripChooser').close();break;}
        saveStateSilently();window.TripLog.persistence.stateStorage.switchTrip(target.id);navigate('overview');
        showToast(`${target.tripName||'선택한 여행'}으로 바꿨어요.`);break;
      }
      case 'trip-open':window.TripLog.persistence.stateStorage.switchTrip(el.dataset.id);navigate('overview');break;
      case 'trip-edit':navigate('start');await startTripEdit(el.dataset.id);break;
      case 'trip-edit-current':navigate('start');await startTripEdit(state.id);break;
      case 'trip-save':saveTripEdit();break;
      case 'trip-cancel':cancelTripEdit();break;
      case 'new-trip':cancelTripEdit();closeAll();openNewTripModal();$('#rdNewTripDuration').textContent=duration({startDate:els.newTripStartDateInput.value,endDate:els.newTripEndDateInput.value});break;
      case 'flight':showReservation('flight');break;
      case 'hotel':showReservation('hotel');break;
      case 'reservation':showReservation('flight');break;
      case 'packing':closeAll();$('#itineraryToolsDialog').showModal();window.TripLog.features.packing.workspace.render();break;
      case 'packing-delete':await deletePackingItem(el.dataset.id);break;
      case 'packing-up':{const index=state.packingList.findIndex(i=>i.id===el.dataset.id);if(index>0){[state.packingList[index-1],state.packingList[index]]=[state.packingList[index],state.packingList[index-1]];saveAndRender();}break;}
      case 'packing-reset':await window.TripLog.features.packing.list.resetPackingList();break;
      case 'invite-settings':$('#tripInviteCloseButton').click();navigate('settings');break;
      case 'member-info':{const m=members()[Number(el.dataset.index)];if(m){$('#rdMemberInfoBody').innerHTML=`<div class="rd-member-info">${avatar(m.name,Number(el.dataset.index))}<h2>${text(m.name)}</h2><p>${m.role==='owner'||Number(el.dataset.index)===0?'방장':'여행 멤버'} · ${text(state.tripName)}</p></div>`;open('rdMemberInfo');}break;}
      case 'invite':closeAll();window.TripLog.features.collaboration.tripCollaboration.openTripInviteModal();break;
      case 'history':closeAll();openHistoryModal();break;
      case 'save-snapshot':saveCurrentSnapshot();break;
      case 'export':exportHistoryJson();break;
      case 'import':requestImportHistoryJson();break;
      case 'pdf-expenses':exportExpensePdf();break;
      case 'pdf-itinerary':exportItineraryPdf();break;
      case 'pdf-full':exportFullPdf();break;
      case 'sync-status':closeAll();window.TripLog.sync.statusUi.open();break;
      case 'logout':els.settingsLogoutButton.click();break;
      case 'signup':els.authModeSignup.click();break;
      case 'overview-add-plan':
      case 'overview-itinerary':{
        state.selectedItineraryDate=el.dataset.date||state.startDate;
        state.lastActiveItineraryDate=state.selectedItineraryDate;
        clearItineraryEditMode(false);navigate('itinerary', { date: state.selectedItineraryDate });saveAndRender();
        if(action==='overview-add-plan')window.TripLog.features.itinerary.workspace.show();
        break;
      }
      case 'all-itinerary':navigate('itinerary', { date: 'all' });saveAndRender();break;
      case 'plan':{const item=findItineraryItem(el.dataset.id);if(item){navigate('itinerary', { date: item.date });startItineraryEdit(item);}break;}
    }
  }
  document.addEventListener('change',event=>{if(event.target.id==='rdReportDay'){window.TripLog.features.reports.workspace.setDay(event.target.value);}const id=event.target.dataset.rdPack;if(id){const item=state.packingList.find(i=>i.id===id);if(item){item.checked=event.target.checked;saveAndRender();}}});
  window.TripLog.register('features.redesign.workspace',{setup,render,renderMembers,navigate,open,openExpenseEditor,openPretripEditor:showReservation,showSavedPretrip,expenseSaved,expenseMetadata,confirmAction,canEditTripSettings,isTripEditing,cancelTripEdit});
})();
