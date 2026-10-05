(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const M = () => window.TripLog.features.redesign.model;
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const text = value => escapeHtml(String(value ?? ''));
  const money = value => `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
  const logo = '<img class="rd-logo" src="src/assets/triplog-wordmark.png" alt="TripLOG">';
  const button = (label, action, style = '', extra = '') => `<button type="button" class="rd-button ${style}" data-rd-action="${action}" ${extra}>${label}</button>`;
  const row = (label, name, action, value = '') => `<button type="button" class="rd-setting-row" data-rd-action="${action}">${icon(name)}<span>${label}</span><small>${text(value)}</small>${icon('caret-right')}</button>`;
  let ready = false, tripTab = 'upcoming', expenseTab = 'all', reportTab = 'expenses', reportDay = 'all', expenseTrip = '', expenseReturnMode = '', lastTrip = '';
  let overlayReturnFocus = null;
  let editingTripId = '';
  let removingTripId = '';
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
    setCommaNumberInputValue(els.budgetInput, state.totalBudget || '');
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
    Object.assign(state, { tripName, startDate, endDate, totalBudget: Math.max(0, parseFormattedNumber(els.budgetInput.value)) });
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
  const dateShort = value => { const d = new Date(`${value}T12:00:00`); return Number.isFinite(d.getTime()) ? `${d.getMonth() + 1}.${d.getDate()} ${'일월화수목금토'[d.getDay()]}` : '날짜 미정'; };
  const period = trip => `${dateShort(trip.startDate)} – ${dateShort(trip.endDate)}`;
  const duration = trip => { const n = getTripDaysForRange(trip.startDate, trip.endDate).length; return n > 1 ? `${n - 1}박 ${n}일` : n ? '당일치기' : '기간 미정'; };
  function dday(trip) { const diff = Math.round((new Date(`${trip.startDate}T12:00:00`) - new Date(`${M().localDate()}T12:00:00`)) / 86400000); return !Number.isFinite(diff) ? '여행 준비' : diff > 0 ? `D-${diff}` : trip.endDate < M().localDate() ? '다녀온 여행' : '여행 중'; }
  function members() { const list = window.TripLog.features.collaboration.tripCollaboration.getTripMembers(); return list.length ? list : [{name:'나'}, ...(state.companions || [])]; }
  const avatar = (name, index) => `<span class="rd-avatar rd-avatar-${index % 3}" aria-hidden="true">${text(String(name || '나').slice(0, 2))}</span>`;
  const heading = (title, subtitle = '') => `<div class="rd-heading"><h1>${title}</h1><p ${subtitle ? '' : 'data-rd-trip'}>${subtitle || ''}</p></div>`;
  function addView(page, markup) {
    const main = $(`#${page}Page`), park = document.createElement('div');
    park.className = 'rd-legacy'; park.hidden = true;
    while (main.firstChild) park.appendChild(main.firstChild);
    main.appendChild(park);
    const view = document.createElement('div'); view.className = `rd-content rd-${page}`; view.innerHTML = markup; main.appendChild(view);
  }
  function dialog(id, title, body, footer = '') {
    const element = document.createElement('dialog'); element.id = id; element.className = 'rd-dialog'; element.setAttribute('aria-labelledby', `${id}Title`);
    element.innerHTML = `<div class="rd-dialog-head">${logo}${button(icon('x'),'close','rd-icon-button','aria-label="닫기"')}</div><div class="rd-dialog-body"><h1 id="${id}Title" tabindex="-1">${title}</h1><p data-rd-trip></p>${body}</div>${footer ? `<footer class="rd-dialog-footer">${footer}</footer>` : ''}`;
    document.body.appendChild(element);
    element.addEventListener('close', () => { (element.returnFocus?.isConnected ? element.returnFocus : $('#rdMenuButton'))?.focus({preventScroll:true}); });
    element.addEventListener('click', event => { if (event.target === element && (event.clientX < element.getBoundingClientRect().left || event.clientX > element.getBoundingClientRect().right || event.clientY < element.getBoundingClientRect().top || event.clientY > element.getBoundingClientRect().bottom)) element.close(); });
    return element;
  }
  function open(id) {
    const el = $(`#${id}`); if (!el || el.open) return;
    el.returnFocus = document.activeElement;
    if (id !== 'rdExpenseEditor' && $('#rdMore')?.open) $('#rdMore').close();
    el.showModal(); $(`#${id}Title`, el)?.focus({preventScroll:true});
  }
  function closeAll() { $$('.rd-dialog[open]').forEach(el => el.close()); }
  function navigate(page, { replace = false } = {}) { closeAll(); const url=window.TripLog.navigation.pageRouter.pageUrl(page); if(url.href!==location.href)history[replace?'replaceState':'pushState']({page},'',url);setActivePage(page); }
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
      return `<div class="rd-trip-choice ${current?'is-current':''}"><button type="button" class="rd-trip-choice-select" data-rd-action="trip-select" data-id="${text(trip.id)}" aria-pressed="${current}" ${removingTripId?'disabled':''}><span class="rd-trip-thumbnail">${thumbnail}</span><span class="rd-trip-choice-copy"><strong>${text(name)}</strong><span>${text([trip.city,trip.country].filter(Boolean).join(' · ')||'목적지 미정')}</span><small>${text(trip.startDate?.slice(0,4)||'')} · ${period(trip)} · ${duration(trip)}</small>${current?'<em>현재 여행</em>':past?'<em class="is-past">지난 여행</em>':''}</span>${icon(current?'radio-button':'circle')}</button><button type="button" class="rd-trip-delete" data-rd-action="trip-choice-delete" data-id="${text(trip.id)}" aria-label="${text(name)} 여행 삭제" title="${trips.length<=1?'마지막 여행은 삭제할 수 없어요':'여행 삭제'}" ${deleteDisabled?'disabled':''}>${icon('trash')}</button></div>`;
    }).join(''):`<div class="rd-trip-search-empty">${icon('magnifying-glass')}<strong>검색 결과가 없어요</strong><p>다른 여행 이름이나 여행지를 입력해 보세요.</p></div>`;
  }
  async function removeTripFromChooser(id) {
    if (removingTripId) return;
    const chooser=$('#rdTripChooser'), list=$('#rdTripChooserList'), scrollTop=list.scrollTop;
    removingTripId=id;
    renderTripChooser();
    try {
      const removed=await window.TripLog.persistence.stateStorage.deleteTrip(id);
      if (removed) showToast('여행을 목록에서 삭제했어요. 복구 기록에서 다시 열 수 있어요.');
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
    $('#rdPayer').innerHTML = payers.map(member => `<option value="${text(member.key)}">${text(member.isLeader ? '나' : member.name)}</option>`).join('');
    $('#rdPayer').value = payers.some(m => m.key === value) ? value : 'leader';
    syncCustomSelect($('#rdPayer'));
  }
  function newExpense() { expenseReturnMode = state.travelMode; clearEditMode(); openExpenseEditor(); }
  function expenseSaved() { if (!ready) return; if (window.TripLog.features.expenses.workspace?.afterSave()) return; $('#rdExpenseEditor').close(); showToast('지출을 저장했어요.'); }
  function showSavedPretrip(entry) {
    // Opening or saving an expense preserves the user's current list controls.
    renderExpenses(calculateTotals().total);
    const button = $$('#rdExpenseList [data-rd-action="expense-edit"]').find(element => element.dataset.id === entry.id);
    button?.closest('tr')?.classList.add('pp-saved-entry');
    button?.scrollIntoView({ block: 'nearest' }); button?.focus({ preventScroll: true });
  }
  function expenseMetadata() { return {paymentDate: $('#rdPaymentDate')?.value || '', payerKey: $('#rdPayer')?.value || 'leader'}; }
  function confirmAction(message) {
    const el=$('#rdConfirm'); if(el.open)return Promise.resolve(false);
    $('#rdConfirmMessage').textContent=message;
    return new Promise(resolve=>{el.addEventListener('close',()=>resolve(el.returnValue==='confirm'),{once:true});el.returnValue='';open('rdConfirm');$('#rdConfirmCancel').focus();});
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
    dialog('rdFilter','지출 필터',`<div class="rd-filter-categories">${['전체','숙소','교통','식비','관광','쇼핑','기타'].map(c => button(c,'category','',`data-category="${c}"`)).join('')}</div><label><span>정렬</span><div id="rdSortMount"></div></label>`,button('적용','close','rd-primary'));
    move(els.expenseSortSelect.closest('.custom-select') || els.expenseSortSelect, '#rdSortMount');
  }
  function setupSettings() {
    dialog('rdProfile','여행 프로필','<div id="rdProfileMount"></div>');
    ['#settingsAccountStatus','.settings-account-form','.settings-account-actions'].forEach(s => move(s,'#rdProfileMount'));
    dialog('rdCurrency','여행 방식·통화','<div id="rdCurrencyMount"></div>'); move($('#settingsCurrencyArea').parentElement,'#rdCurrencyMount');
    dialog('rdBackup','백업·불러오기','<div id="rdBackupMount"></div>'); move($('#settingsStorageTitle').closest('.itinerary-main-panel'),'#rdBackupMount');
    dialog('rdAdvanced','고급 연결 설정','<div id="rdAdvancedMount"></div>'); move($('.settings-supabase-box'),'#rdAdvancedMount'); move($('#settingsGoogleGeocodingKeyInput').closest('.itinerary-main-panel'),'#rdAdvancedMount');
    dialog('rdPdf','PDF 저장',`<p>인쇄 창에서 PDF로 저장할 수 있어요.</p>${button('지출 내역','pdf-expenses','rd-primary')}${button('여행 일정','pdf-itinerary')}${button('전체 여행 리포트','pdf-full')}`);
    move($('.settings-privacy-options'),'#rdPrivacyMount');
    const privacyLabels = ['일정 공유','지출 공유','이메일 공개','초대 링크 수락 허용'];
    $$('#rdPrivacyMount label').forEach((label, i) => { label.classList.add('rd-switch-row'); label.querySelector('span').textContent = privacyLabels[i]; label.insertAdjacentHTML('afterbegin', icon(['calendar-blank','wallet','envelope','link'][i])); });
    move($('#rdPrivacyMount label:last-child'),'#rdAdvancedMount');
    dialog('rdSettlementDetails','항목별 분담','<div id="rdSettlementSource"></div><div id="rdSettlementLedger"></div>');
    move($('#settlementExpenseSourceSelect').closest('label'),'#rdSettlementSource'); move($('#settlementSourceSummary'),'#rdSettlementSource'); move($('#settlementExpenseSplitList'),'#rdSettlementLedger');
    dialog('rdCompanions','정산 멤버 관리','<p>멤버가 따로 낸 추가 지출도 정산에 포함할 수 있어요.</p><div id="rdCompanionMount"></div>');
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
    $('#appShell').insertAdjacentHTML('afterbegin',`<header class="rd-header"><a href="/Travel?page=start" class="rd-brand-link" data-rd-nav="start" aria-label="내 여행 보관함">${logo}</a>${button(icon('user'),'profile','tl-library-profile','aria-label="내 프로필"')}${button(icon('list'),'more','rd-icon-button','id="rdMenuButton" aria-label="여행 메뉴 열기"')}</header>`);
    const sync = els.itineraryPageButton;
    sync.className = 'rd-button rd-sync';
    sync.replaceChildren();
    sync.setAttribute('aria-label', '저장 상태 자세히 보기');
    const headerActions = document.createElement('div'); headerActions.className = 'rd-header-actions';
    $('.rd-header').appendChild(headerActions); headerActions.append(sync, $('#rdMenuButton'));
    $('#appShell').insertAdjacentHTML('beforeend',`<nav class="rd-nav" aria-label="주 메뉴">${[['overview','house','개요'],['itinerary','calendar-blank','일정'],['budget','wallet','지출'],['report','chart-bar','리포트'],['more','dots-three','더보기']].map(([page,name,label])=>`<button type="button" data-rd-nav="${page}">${icon(name)}<span>${label}</span></button>`).join('')}</nav>`);
    addView('overview',`<div class="rd-heading"><div class="rd-overview-heading"><h1>여행 개요</h1>${button(`${icon('plus')} 새 여행`,'new-trip','rd-overview-new','aria-label="새 여행 만들기"')}</div></div><div id="rdOverview"></div>`);
    addView('start',window.TripLog.features.home.tripLibrary.markup()+`<section class="rd-trip-edit" hidden><div class="rd-section-head"><h2>여행 수정</h2>${button('취소','trip-cancel','rd-text-button')}</div><p>내용을 바꾼 뒤 아래 여행 수정 버튼을 눌러 저장해 주세요.</p><div id="rdTripEditMount" class="rd-form-grid"></div></section><div class="rd-page-footer" id="rdTripEditFooter" hidden>${button('여행 수정','trip-save','rd-primary','id="rdTripSave" hidden')}</div>`);
    ['#tripNameInput','#startDateInput','#endDateInput','#budgetInput'].forEach(s=>move($(s).closest('label'),'#rdTripEditMount'));els.tripNameInput.closest('label').hidden=false;els.budgetInput.closest('label').classList.add('rd-budget-input-label');els.budgetInput.closest('label').querySelector('span').textContent='총예산';
    addView('budget',heading('지출 기록')+`<div id="rdBudgetSummary"></div>${button(`${icon('camera')} 영수증으로 입력 ${icon('caret-right')}`,'receipt-start','rd-secondary rd-scan')}<div class="rd-search"><div id="rdSearchMount">${icon('magnifying-glass')}</div>${button(icon('sliders-horizontal'),'filter','rd-icon-button','aria-label="지출 필터"')}</div><div class="rd-tabs" id="rdExpenseTabs">${[['all','전체'],['pretrip','사전구매'],['during','여행 중']].map(([key,label])=>button(label,'expense-tab',key==='all'?'active':'',`data-tab="${key}"`)).join('')}</div><div id="rdExpenseList"></div><div class="rd-page-footer">${button(`${icon('plus')} 지출 추가`,'expense-new','rd-primary')}</div>`);
    move(els.expenseSearchInput,'#rdSearchMount');els.expenseSearchInput.placeholder='지출 검색';
    addView('settlement',heading('경비 정산')+'<div id="rdSettlement"></div>');
    addView('report',heading('여행 리포트')+`<div id="rdReportSummary"></div><div class="rd-tabs">${button('지출 분석','report-expenses','active','id="rdReportExpenseTab"')}${button('일정 분석','report-itinerary','','id="rdReportItineraryTab"')}</div><div id="rdReportExpenses"></div><div id="rdReportItinerary" hidden></div><div class="rd-page-footer">${button(`${icon('file-pdf')} 리포트 PDF 저장`,'pdf-full','rd-secondary')}</div>`);
    move($('#reportItineraryDurationChart'),'#rdReportItinerary').hidden=true;$('#rdReportItinerary').insertAdjacentHTML('beforeend','<div id="rdPlanAnalytics"></div>');
    addView('settings',heading('설정','여행을 내 방식대로')+`<div id="rdProfileSummary"></div><section class="rd-setting-group"><h2>여행 설정</h2><div id="rdSettingsTrip"></div></section><section class="rd-setting-group"><h2>공유 설정</h2><div id="rdPrivacyMount"></div></section><section class="rd-setting-group"><h2>기록 관리</h2>${row('저장 기록','bookmark-simple','history')}${row('백업·불러오기','download-simple','backup')}${row('PDF 저장','file-text','pdf')}</section>${row('고급 연결 설정','gear','advanced')}<button class="rd-logout" data-rd-action="logout" type="button">로그아웃</button>`);
    setupForms();setupSettings();setupExistingDialogs();setupAuth();setupTripChooser();
    $$('.custom-date-button').forEach(el=>{el.insertAdjacentHTML('afterbegin',icon('calendar-blank'));$('.custom-date-icon',el).innerHTML=icon('caret-down');});
    dialog('rdMore','여행 메뉴',`${row('오늘의 여행','compass','companion')}${row('예약 지갑','ticket','companion-wallet')}${row('여행 도구','suitcase','companion-tools')}${row('내 여행','suitcase','nav-start')}${row('여행 정보 수정','pencil-simple','trip-edit-current')}${row('경비 정산','users-three','nav-settlement')}${row('여행 준비물','suitcase-rolling','packing')}${row('멤버·초대','user-plus','invite')}${row('저장 기록','bookmark-simple','history')}${row('설정','gear','nav-settings')}${row('저장 상태·공동 작업','cloud-check','sync-status')}${row('전체 일정 보기','calendar-blank','all-itinerary')}`);
    dialog('rdMemberInfo','멤버 정보','<div id="rdMemberInfoBody"></div>');
    dialog('rdConfirm','확인해 주세요','<p id="rdConfirmMessage"></p>',`${button('취소','close','','id="rdConfirmCancel"')}${button('확인','confirm-accept','rd-primary')}`).setAttribute('role','alertdialog');
    const tools = move($('#itineraryToolsDialog'),document.body), park=document.createElement('div');park.hidden=true;park.className='rd-legacy';while(tools.firstChild)park.appendChild(tools.firstChild);tools.appendChild(park);tools.classList.add('rd-dialog');tools.insertAdjacentHTML('beforeend',`<div class="rd-dialog-head">${logo}${button(icon('x'),'close','rd-icon-button','aria-label="준비물 닫기"')}</div><div class="rd-dialog-body"><h1>여행 준비물</h1><p data-rd-trip></p><div id="rdPacking"></div><label class="rd-packing-add"><span>준비물 추가</span><div id="rdPackingInputMount"></div></label>${button('기본 목록으로 되돌리기','packing-reset','rd-text-button')}<p class="rd-muted">체크한 내용은 자동으로 저장돼요.</p></div><footer class="rd-dialog-footer">${button('완료','close','rd-primary')}</footer>`);move(els.packingInput,'#rdPackingInputMount');move(els.packingAddBtn,'#rdPackingInputMount');els.packingAddBtn.innerHTML=icon('plus');els.packingAddBtn.setAttribute('aria-label','준비물 추가');els.packingInput.placeholder='챙길 물건을 입력하세요';
    document.addEventListener('click',handleClick);
    document.addEventListener('click',event=>{if(event.target.closest('#itineraryMenuButton,[data-itinerary-menu]')){event.preventDefault();event.stopImmediatePropagation();open('rdMore');}},true);
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
    render();
  }
  function renderOverview(total) {
    const bookings = window.TripLog.features.travelCompanion.model.reservations(state);
    const team = members(), budget = Number(state.totalBudget) || 0;
    const pct = budget ? Math.round(total / budget * 100) : 0;
    const days = getTripDays(), validDates = new Set(days.map(day => day.date));
    const plans = sortItineraryItems(state.itineraryItems.filter(item => validDates.has(item.date)));
    const today = M().localDate();
    const scheduleDate = validDates.has(today) ? today : plans[0]?.date || state.startDate;
    const scheduleDay = days.find(day => day.date === scheduleDate);
    const scheduleTitle = scheduleDate === today ? '오늘 일정' : scheduleDate === state.startDate ? '첫날 일정' : `${scheduleDay?.label || ''} 일정`;
    const items = plans.filter(item => item.date === scheduleDate).slice(0, 3), packing = state.packingList || [];
    $('#rdOverview').innerHTML = `
      ${window.TripLog.features.overview.tripHero.render({ trip: state, countdown: dday(state), period: period(state), duration: duration(state), memberCount: team.length, expanded: !!$('#rdTripChooser')?.open })}
      ${window.TripLog.features.overview.reservationPockets.render(bookings)}
      <section class="rd-outline rd-overview-budget${budget && total > budget ? ' is-over-budget' : ''}">
        <div class="rd-section-head"><h2>${icon('coins')}여행 예산</h2><button type="button" data-rd-nav="budget" aria-label="지출 기록 자세히 보기">자세히 ${icon('caret-right')}</button></div>
        <div class="rd-budget-metric"><strong>${money(total)}</strong><span>예산 ${money(budget)}</span></div>
        <div class="rd-progress-row"><progress max="100" value="${Math.max(0, Math.min(100, pct))}" aria-label="예산 사용률" aria-valuetext="${pct}% 사용"></progress><b>${pct}%</b></div>
        <p>${budget ? `${total > budget ? '초과 금액' : '남은 예산'} <strong>${money(Math.abs(budget - total))}</strong>` : '<button type="button" class="rd-budget-setup" data-rd-action="trip-edit" data-id="' + text(state.id) + '">여행 예산 설정하기 ' + icon('caret-right') + '</button>'}</p>
      </section>
      <section class="rd-outline rd-key-schedule">
        <div class="rd-section-head"><h2>${icon('calendar-blank')}${scheduleTitle}</h2><span class="rd-schedule-date">${dateShort(scheduleDate)}</span><button type="button" data-rd-action="all-itinerary">전체 보기 ${icon('caret-right')}</button></div>
        ${items.length ? items.map((item, index) => `<button type="button" class="rd-plan-row" data-rd-action="plan" data-id="${text(item.id)}" aria-label="${text(item.time || '시간 미정')} ${text(item.place || '장소 미정')} 일정 수정"><time>${text(item.time || '미정')}</time><span class="rd-plan-dot rd-plan-dot-${index}" aria-hidden="true"></span>${icon(itineraryThemes[item.theme]?.icon || 'map-pin')}<b>${text(item.place || '장소 미정')}</b></button>`).join('') : `<div class="rd-overview-empty"><p>아직 등록한 일정이 없어요.</p>${button(`${icon('plus')} 첫 일정 추가`, 'overview-add-plan', 'rd-empty-add', `data-date="${text(scheduleDate)}"`)}</div>`}
      </section>
      ${button(`${icon('clipboard-text')}<strong>준비물</strong><small>${packing.filter(item => item.checked).length} / ${packing.length}개 완료</small>${icon('caret-right')}`, 'packing', 'rd-packing-summary')}
      <div class="rd-page-footer">${button(`일정 보러 가기 ${icon('caret-right')}`, 'overview-itinerary', 'rd-primary', `data-date="${text(scheduleDate)}"`)}</div>`;
  }
  function renderTrips() {
    syncTripEdit();
    window.TripLog.features.home.tripLibrary.render();
  }
  function renderExpenses(total) {
    if (window.TripLog.features.expenses.workspace) { window.TripLog.features.expenses.workspace.renderLedger(total, expenseTab); return; }
    const budget=Number(state.totalBudget)||0,pct=budget?Math.round(total/budget*100):0;
    $('#rdBudgetSummary').innerHTML=`<p class="rd-metric-label">총 지출</p><strong class="rd-total">${money(total)}</strong><p class="rd-budget-caption">${budget?`예산의 ${pct}% · ${total>budget?'초과':'남은 예산'} ${money(Math.abs(budget-total))}`:'예산을 설정하면 사용률을 볼 수 있어요.'}</p><div class="rd-progress-row"><progress max="100" value="${Math.min(100,pct)}" aria-label="예산 사용률"></progress><span>${pct}%</span></div>`;
    const entries=getFilteredEntries().filter(e=>expenseTab==='all'||(expenseTab==='pretrip')===isPreTripExpenseDate(e.date));
    $$('#rdExpenseTabs button').forEach(el=>{el.classList.toggle('active',el.dataset.tab===expenseTab);el.setAttribute('aria-pressed',String(el.dataset.tab===expenseTab));});
    $('#rdExpenseList').innerHTML=entries.length?entries.map(e=>`<button type="button" class="rd-expense-row" data-rd-action="expense-edit" data-id="${text(e.id)}" aria-label="${text(e.description)} ${money(e.amount)} 수정"><span class="rd-category-icon" style="--category:${({'숙소':'#bce6fb','교통':'#fff05a','식비':'#f7afc7'})[e.category]||'#fff'}">${icon(M().icons[e.category]||'dots-three')}</span><span class="rd-expense-copy"><strong>${text(e.description)}</strong><small>${isPreTripExpenseDate(e.date)?'사전구매':dateShort(e.date)} · ${text(e.category)}${M().paymentDate(e)?` · ${dateShort(M().paymentDate(e)).split(' ')[0]}`:''}</small>${e.foreignAmount?`<small>${text(e.currency||'')} ${Number(e.foreignAmount).toLocaleString('ko-KR')} · ${getPaymentMethodLabel(e.paymentMethod)}</small>`:''}</span><b>${money(e.amount)}</b></button>`).join(''):`<div class="rd-empty">${icon('receipt')}<h2>${state.entries.length?'검색 결과가 없어요':'아직 기록한 지출이 없어요'}</h2><p>${state.entries.length?'검색어와 필터를 바꿔 보세요.':'첫 지출을 추가하거나 영수증으로 입력해 보세요.'}</p></div>`;
    $$('#rdFilter [data-category]').forEach(el=>{el.classList.toggle('active',el.dataset.category===activeFilter);el.setAttribute('aria-pressed',String(el.dataset.category===activeFilter));});
  }
  function renderSettlement(totals) {
    const source=getSelectedSettlementExpenseSource(getSettlementExpenseSources(totals)),model=buildSettlementModel(source);
    $('#settlementPage .rd-heading p').textContent=`${state.tripName} · ${model.members.length}명`;
    const unequal=model.entryRows.some(r=>r.mode==='custom'),n=model.members.length;
    $('#rdSettlement').innerHTML=`<section class="rd-settle-hero rd-outline"><div><span>함께 쓴 돈</span><strong>${money(model.totalTripSpent)}</strong><hr><span>${unequal?'평균 부담액':'1인 부담액'}</span><strong>${money(model.totalTripSpent/n)}</strong></div><div><span class="rd-badge">${unequal?'직접 분담':'균등 분담'}</span>${button('분담 수정','split','rd-secondary')}</div></section><h2>멤버별 정산</h2><div class="rd-member-balances">${model.memberSummaries.map((m,i)=>`<div class="rd-balance-row">${avatar(m.isLeader?'나':m.name,i)}<span><b>${text(m.isLeader?'나':m.name)}</b><small>낸 돈 ${money(m.paid)}</small></span><div class="${m.balance>0?'receives':''}"><b>${money(Math.abs(m.balance))}</b><small>${m.balance>0?'받을 돈':m.balance<0?'보낼 돈':'정산 완료'}</small></div></div>`).join('')}</div><h2>이렇게 보내면 끝!</h2><div class="rd-transfers rd-outline">${model.invalidEntries.length?'<p role="alert">항목별 분담 합계를 먼저 확인해 주세요.</p>':model.transactions.length?model.transactions.map(t=>`<div><b>${text(t.from.replace('방장 (나)','나'))} → ${text(t.to.replace('방장 (나)','나'))}</b><b>${money(t.amount)}</b></div>`).join(''):'<p>서로 주고받을 금액이 없어요.</p>'}</div><p class="rd-muted">송금 안내이며 실제 이체는 하지 않아요.</p>${row('항목별 분담 보기','file-text','split')}<div class="rd-page-footer">${button(`${icon('user-plus')} 멤버 추가·관리`,'companions','rd-secondary')}</div>`;
  }
  function drawDonut(rows,total) {
    const canvas=$('#rdDonut');if(!canvas)return;
    const ctx=canvas.getContext('2d'),size=400;canvas.width=size;canvas.height=size;ctx.clearRect(0,0,size,size);let start=-Math.PI/2;
    if(!rows.length){ctx.strokeStyle='#e4e5e9';ctx.lineWidth=80;ctx.beginPath();ctx.arc(200,200,148,0,Math.PI*2);ctx.stroke();return;}
    // Percentages live in the HTML legend at the shared metadata size.
    // Text painted into a 400px canvas became unreadable as the chart shrank.
    rows.forEach(row=>{const end=start+row.amount/total*Math.PI*2;ctx.beginPath();ctx.arc(200,200,198,start,end);ctx.arc(200,200,105,end,start,true);ctx.closePath();ctx.fillStyle=row.color;ctx.fill();ctx.strokeStyle='#0b1020';ctx.lineWidth=3;ctx.stroke();start=end;});
  }
  function renderReports(total) {
    const budget=Number(state.totalBudget)||0,rows=M().categoryShares(state.entries),trend=M().paymentTrend(state.entries),max=Math.max(1,...trend.map(t=>t.amount));
    $('#rdReportSummary').innerHTML=`<p class="rd-metric-label">총 지출</p><strong class="rd-total">${money(total)}</strong><p class="rd-budget-caption">예산 ${money(budget)}${budget?` · ${Math.round(total/budget*100)}% 사용`:''}</p>`;
    $('#rdReportExpenses').hidden=reportTab!=='expenses';$('#rdReportItinerary').hidden=reportTab==='expenses';if(reportTab==='itinerary')renderPlanAnalytics();
    $('#rdReportExpenseTab').classList.toggle('active',reportTab==='expenses');$('#rdReportItineraryTab').classList.toggle('active',reportTab!=='expenses');
    $('#rdReportExpenses').innerHTML=`<section class="rd-category-section"><h2>어디에 가장 많이 썼나요?</h2><div class="rd-donut-layout"><div class="rd-donut-wrap"><canvas id="rdDonut" role="img" aria-label="${text(rows.map(r=>`${r.name} ${r.percent}%`).join(', ')||'아직 지출 없음')}"></canvas><div><b>${money(total)}</b><span>총 지출</span></div></div><ul class="rd-legend">${rows.map(r=>`<li><button type="button" data-rd-action="report-category" data-category="${text(r.name)}"><span style="background:${r.color}"></span><b>${text(r.name)}</b><strong>${money(r.amount)}</strong><small>${r.percent}%</small></button></li>`).join('')}</ul></div>${rows.length?'':'<p class="rd-empty">지출을 입력하면 분석을 시작해요.</p>'}</section><section class="rd-trend"><h2>결제일별 지출</h2><div class="rd-chart-scroll"><div class="rd-bars" style="--bars:${Math.max(4,trend.length)}">${trend.map((t,i)=>`<div class="rd-bar-item"><strong>${money(t.amount)}</strong><div class="rd-bar" style="height:${Math.max(3,t.amount/max*80)}%;background:${['#fff05a','#bce6fb','#f7afc7','#e4e5e9'][i%4]}"></div><span>${t.date==='날짜 미지정'?t.date:dateShort(t.date)}</span></div>`).join('')}</div></div><p>${state.entries.length}건의 지출 기록 · 결제일 기준</p></section>`;drawDonut(rows,total);
  }
  function renderPlanAnalytics() {
    const days=getTripDays(),all=state.itineraryItems||[];
    if(reportDay!=='all'&&!days.some(day=>day.date===reportDay))reportDay='all';
    const items=sortItineraryItems(all.filter(item=>reportDay==='all'||item.date===reportDay));
    const stays=items.filter(item=>item.theme!=='lodging').map(item=>({...item,minutes:Math.max(0,getMinutesBetweenTimes(item.time,item.endTime)||0)}));
    const stayTotal=stays.reduce((n,item)=>n+item.minutes,0),transitTotal=items.reduce((n,item)=>n+getItineraryTransits(item).reduce((sum,segment)=>sum+(Number(segment.duration)||0),0),0),max=Math.max(1,...stays.map(item=>item.minutes));
    $('#rdPlanAnalytics').innerHTML=`<label class="rd-analysis-filter"><span>분석할 일자</span><select id="rdReportDay"><option value="all">전체 여행</option>${days.map((day,i)=>`<option value="${text(day.date)}" ${day.date===reportDay?'selected':''}>Day ${i+1} · ${dateShort(day.date)}</option>`).join('')}</select></label><div class="rd-analysis-metrics"><div><small>계획한 일정</small><strong>${items.length}개</strong></div><div><small>체류 시간</small><strong>${stayTotal}분</strong></div><div><small>이동 시간</small><strong>${transitTotal}분</strong></div></div><h2>장소별 체류 시간</h2>${stays.length?stays.map(item=>`<button type="button" class="rd-analysis-place" data-rd-action="plan" data-id="${text(item.id)}"><span><b>${text(item.place)}</b><small>${dateShort(item.date)} · ${text(item.time||'시간 미정')}${item.endTime?' – '+text(item.endTime):''}</small></span><strong>${item.minutes?item.minutes+'분':'시간 미입력'}</strong><span class="rd-analysis-track"><i style="width:${item.minutes/max*100}%"></i></span></button>`).join(''):'<p class="rd-empty">체류 시간을 기록할 일정이 없어요.</p>'}<p class="rd-muted">숙소는 체류 시간에서 제외합니다. 입력한 시간 기준이며, 같은 시간의 일정은 중복 합산됩니다.</p>`;
  }
  function renderPacking() {
    const list=state.packingList||[],done=list.filter(i=>i.checked).length;$('#itineraryToolsDialog [data-rd-trip]').textContent=`${state.tripName} · ${duration(state)}`;
    $('#rdPacking').innerHTML=`<div class="rd-pack-metric">${icon('suitcase-rolling')}<span><strong>${done} / ${list.length}개</strong><b>준비 완료</b></span></div><progress max="${list.length||1}" value="${done}" aria-label="준비물 완료"></progress><p class="rd-muted">${list.length-done?`${list.length-done}가지만 더 챙기면 준비 끝!`:'여행 준비를 마쳤어요!'}</p><div class="rd-pack-list">${list.map((item,i)=>`<div class="rd-pack-row"><label><input type="checkbox" data-rd-pack="${text(item.id)}" ${item.checked?'checked':''}><span>${text(item.name)}</span></label><div class="rd-pack-controls">${button(icon('arrow-up'),'packing-up','rd-icon-button',`data-id="${text(item.id)}" aria-label="${text(item.name)} 위로 이동" ${i?'':'disabled'}`)}${button(icon('trash'),'packing-delete','rd-icon-button',`data-id="${text(item.id)}" aria-label="${text(item.name)} 삭제"`)}</div></div>`).join('')}</div>`;
  }
  function render({ pageOnly = false } = {}) {
    if(!ready)return;
    if(lastTrip!==state.id){closeAll();lastTrip=state.id;expenseTab='all';els.expenseSearchInput.value='';editingTripId='';}
    $$('[data-rd-trip]').forEach(el=>el.textContent=state.tripName||'새로운 여행');
    $$('.rd-nav [data-rd-nav]').forEach(el=>{const active=el.dataset.rdNav===activePage||el.dataset.rdNav==='more'&&['start','settings','settlement'].includes(activePage);el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    if (!window.TripLog.features.home.tripLibrary.reconcileInitialTrip()) {
      if (activePage === 'overview') $('#rdOverview').innerHTML = '<p class="rd-empty" role="status">여행을 불러오는 중이에요.</p>';
      return;
    }
    const totals=calculateTotals();
    if(activePage==='overview')renderOverview(totals.total);
    if(activePage==='start')renderTrips();
    if(activePage==='budget')renderExpenses(totals.total);
    if(activePage==='settlement')renderSettlement(totals);
    if(activePage==='report')renderReports(totals.total);
    if(activePage==='settings'){
      $('#rdProfileSummary').innerHTML=`<button type="button" class="rd-profile-row" data-rd-action="profile">${icon('user-circle')}<span><b>${text($('#settingsAccountNameInput')?.value||members()[0]?.name||'나')}</b><small>여행 프로필</small></span>${icon('pencil-simple')}</button>`;
      $('#settingsPage [data-rd-action="history"] small').textContent=`${historyRecords.length}개`;
      $('#rdSettingsTrip').innerHTML=row('나의 여행','suitcase','nav-start',state.tripName)+row('여행 방식·통화','currency-krw','currency',`${state.travelMode==='overseas'?'해외':'국내'} · ${state.currencyCode||'KRW'}`)+row('멤버·초대 관리','users-three','invite',`${members().length}명`);
    }
    if (pageOnly) return;
    if ($('#itineraryToolsDialog').open) renderPacking();
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
    const nav=event.target.closest('[data-rd-nav]');if(nav){event.preventDefault();nav.dataset.rdNav==='more'?open('rdMore'):navigate(nav.dataset.rdNav);return;}
    const el=event.target.closest('[data-rd-action]');if(!el)return;const action=el.dataset.rdAction;
    if(action.startsWith('nav-')){navigate(action.slice(4));return;}
    const simple={more:'rdMore',filter:'rdFilter',profile:'rdProfile',currency:'rdCurrency',backup:'rdBackup',advanced:'rdAdvanced',pdf:'rdPdf',split:'rdSettlementDetails',companions:'rdCompanions'};
    if(simple[action]){open(simple[action]);return;}
    switch(action){
      case 'confirm-accept':$('#rdConfirm').close('confirm');break;
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
      case 'delete-expense':{const id=editingId,trip=state.id;if(id&&await confirmAction('이 지출 기록을 삭제할까요?')&&trip===state.id){deleteEntry(id);$('#rdExpenseEditor').close();showToast('지출을 삭제했어요.');}break;}
      case 'receipt-reselect':$('#receiptAlbumButton').click();break;
      case 'receipt-start':newExpense();els.receiptOpenButton.click();break;
      case 'receipt':els.receiptOpenButton.click();break;
      case 'expense-tab':expenseTab=el.dataset.tab;renderExpenses(calculateTotals().total);break;
      case 'category':setFilter(el.dataset.category);break;
      case 'report-category':setFilter(el.dataset.category);navigate('budget');break;
      case 'report-expenses':reportTab='expenses';render();break;
      case 'report-itinerary':reportTab='itinerary';render();break;
      case 'trips-upcoming':tripTab='upcoming';renderTrips();break;
      case 'trips-past':tripTab='past';renderTrips();break;
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
      case 'trip-delete':els.deleteCurrentTripButton.click();break;
      case 'new-trip':cancelTripEdit();closeAll();openNewTripModal();$('#rdNewTripDuration').textContent=duration({startDate:els.newTripStartDateInput.value,endDate:els.newTripEndDateInput.value});break;
      case 'flight':showReservation('flight');break;
      case 'hotel':showReservation('hotel');break;
      case 'reservation':showReservation('flight');break;
      case 'packing':closeAll();$('#itineraryToolsDialog').showModal();renderPacking();break;
      case 'packing-delete':deletePackingItem(el.dataset.id);break;
      case 'packing-up':{const index=state.packingList.findIndex(i=>i.id===el.dataset.id);if(index>0){[state.packingList[index-1],state.packingList[index]]=[state.packingList[index],state.packingList[index-1]];saveAndRender();}break;}
      case 'packing-reset':{const trip=state.id;if(await confirmAction('준비물 목록을 기본값으로 되돌릴까요?')&&trip===state.id){state.packingList=getDefaultPackingList();saveAndRender();}break;}
      case 'invite-settings':$('#tripInviteCloseButton').click();navigate('settings');break;
      case 'member-info':{const m=members()[Number(el.dataset.index)];if(m){$('#rdMemberInfoBody').innerHTML=`<div class="rd-member-info">${avatar(m.name,Number(el.dataset.index))}<h2>${text(m.name)}</h2><p>${m.role==='owner'||Number(el.dataset.index)===0?'방장':'여행 멤버'} · ${text(state.tripName)}</p></div>`;open('rdMemberInfo');}break;}
      case 'invite':closeAll();els.headerTripInviteButton.click();break;
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
        clearItineraryEditMode(false);navigate('itinerary');saveAndRender();
        if(action==='overview-add-plan')window.TripLog.features.itinerary.workspace.show();
        break;
      }
      case 'all-itinerary':state.selectedItineraryDate='all';navigate('itinerary');saveAndRender();break;
      case 'plan':{const item=findItineraryItem(el.dataset.id);if(item){state.selectedItineraryDate=item.date;navigate('itinerary');startItineraryEdit(item);}break;}
    }
  }
  document.addEventListener('change',event=>{if(event.target.id==='rdReportDay'){reportDay=event.target.value;renderPlanAnalytics();}const id=event.target.dataset.rdPack;if(id){const item=state.packingList.find(i=>i.id===id);if(item){item.checked=event.target.checked;saveAndRender();}}});
  window.TripLog.register('features.redesign.workspace',{setup,render,renderMembers,navigate,open,openExpenseEditor,openPretripEditor:showReservation,showSavedPretrip,expenseSaved,expenseMetadata,confirmAction,isTripEditing,cancelTripEdit});
})();
