(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const M = () => window.TripLog.features.travelCompanion.model;
  const V = () => window.TripLog.features.travelCompanion.view;
  const text = value => M().esc(value);
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const money = value => `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
  const button = (label, action, style = '', extra = '') => `<button type="button" class="tt-button ${style}" data-tt-action="${action}" ${extra}>${label}</button>`;
  const logo = '<img class="tt-logo" src="src/assets/triplog-wordmark.png" alt="TripLOG">';
  const titles = { today: '오늘의 여행', wallet: '예약 지갑', tools: '여행 도구' };
  let ready = false, activeTab = 'today', selectedDay = '', walletFilter = 'all', openedTrip = '', editor = null;
  let walletQuery = '', walletSort = 'date', walletPastOpen = false;
  let selectedDayManual = false;
  let openingPage = false;
  let packingBusy = false, reservationSaving = false;
  let personal = {}, personalKey = '', progressUndo = null, progressBusy = false, openSequence = 0, returnContext = null, openedAccount = '';
  const accountKey = () => window.TripLog.sync.controller.getAccount()?.id || 'device';
  const isOpen = () => Boolean($('#ttCompanion') && !$('#ttCompanion').hidden);
  const scopeKey = () => `${accountKey()}:${state.id}:${selectedDay}`;
  async function loadPersonal() {
    const key = scopeKey();
    const value = await window.TripLogSyncRepository.personal(`today:${key}`);
    if (key !== scopeKey()) return false;
    personalKey = key; personal = value || {}; progressUndo = null; return true;
  }
  async function savePersonal(value) {
    const key = scopeKey();
    await window.TripLogSyncRepository.personal(`today:${key}`, value);
    if (key !== scopeKey()) throw new Error('여행이나 날짜가 변경됐어요.');
    personalKey = key; personal = value;
  }
  const pageScroll = () => activePage === 'travel' ? window.scrollY : $('#ttCompanion .tt-scroll').scrollTop;
  function setPageScroll(top) { if (activePage === 'travel') window.scrollTo({ top, behavior: 'auto' }); else $('#ttCompanion .tt-scroll').scrollTop = top; }
  function syncTravelLocation() {
    if (activePage !== 'travel') return;
    const url = new URL(location.href); url.searchParams.set('travelTab', activeTab);
    if (url.href !== location.href) history.replaceState({ ...history.state, page: 'travel' }, '', url);
  }
  function rememberReturn() { returnContext = { tripId: state.id, account: accountKey(), tab: activeTab, date: selectedDay, scroll: pageScroll() }; }
  function restoreReturn() {
    const context = returnContext;
    if (!context || context.tripId !== state.id || context.account !== accountKey()) { returnContext = null; return; }
    returnContext = null; activeTab = context.tab; selectedDay = context.date; openedTrip = state.id;
    openDialog('ttCompanion'); renderContent(); setPageScroll(context.scroll);
  }
  const walletFilters = [['all', '전체'], ['transport', '교통'], ['stay', '숙소'], ['activity', '입장권'], ['other', '기타']];
  let pocketOptions = { itinerary: true, references: true, reservations: true, costs: false };
  const dateLabel = value => M().validDate(value) ? `${Number(value.slice(5, 7))}.${Number(value.slice(8))} (${'일월화수목금토'[new Date(`${value}T12:00:00Z`).getUTCDay()]})` : '날짜 미정';
  const notice = (content, kind = 'blue') => `<div class="tt-notice ${kind}" role="status">${icon(kind === 'pink' ? 'warning-circle' : 'info')}<span>${content}</span></div>`;
  const empty = (title, description, action = 'itinerary-new', label = '일정 추가') => `<div class="tt-empty">${icon(action === 'reservation-new' ? 'ticket' : 'calendar-blank')}<h2>${title}</h2><p>${description}</p>${action ? button(label, action, 'tt-primary') : ''}</div>`;
  function createDialog(id, body) {
    if (id === 'ttCompanion') {
      const panel = document.createElement('section'); panel.id = id;
      panel.className = 'rd-dialog tt-dialog'; panel.hidden = true;
      panel.setAttribute('aria-labelledby', 'ttCompanionTitle');
      panel.innerHTML = `<header class="tt-header">${logo}${button(icon('x'), 'close', 'tt-icon', 'aria-label="닫기"')}</header>${body}`;
      return panel;
    }
    const dialog = window.TripLog.ui.dialog.create({
      id, className: 'rd-dialog tt-dialog',
      markup: `<header class="tt-header">${logo}${button(icon('x'), 'close', 'tt-icon', 'aria-label="닫기"')}</header>${body}`,
      fallbackFocus: () => isOpen() ? $('#ttCompanionTitle') : $('[data-rd-action="companion"]'),
      onClose: element => { if (element.id === 'ttReservationEditor') editor = null; },
    });
    if (['ttReservationEditor', 'ttReservationDetail', 'ttCopy'].includes(id)) dialog.classList.add('tt-wallet-ui');
    if (['ttAdjustment', 'ttCostInfo'].includes(id)) dialog.classList.add('tt-passport-detail');
    if (id !== 'ttCompanion') dialog.classList.add('cx-sheet');
    return dialog;
  }
  function openDialog(id) {
    const dialog = $(`#${id}`);
    dialog.tripId = state.id;
    if (id === 'ttCompanion') {
      const previous = openingPage; openingPage = true;
      if (activePage !== 'travel') window.TripLog.features.redesign.workspace.navigate('travel');
      dialog.hidden = false;
      openingPage = previous; syncTravelLocation(); return;
    }
    window.TripLog.ui.dialog.open(dialog);
  }
  function closeAll() { $$('.tt-dialog[open]').reverse().forEach(dialog => dialog.close()); $('#ttCompanion').hidden = true; }
  async function commit(patch) {
    const tripId = state.id, account = accountKey();
    const previous = Object.fromEntries(Object.keys(patch).map(key => [key, JSON.parse(JSON.stringify(state[key] ?? null))]));
    Object.assign(state, patch);
    const saved = await saveAndRender();
    if (!saved) {
      if (state.id === tripId && accountKey() === account) {
        const latest = window.TripLogSyncRepository.cached(tripId)?.snapshot;
        for (const key of Object.keys(previous)) state[key] = JSON.parse(JSON.stringify(latest?.[key] ?? previous[key]));
        render();
      }
      throw new Error('기기 저장 공간을 확인해 주세요. 변경 내용을 저장하지 못했어요.');
    }
    $('#ttStatus').textContent = '';
    if (state.id !== tripId || accountKey() !== account) throw new Error('여행이나 계정이 변경됐어요. 현재 화면의 저장 상태를 확인해 주세요.');
  }
  function companion() { return normalizeTravelCompanion(state.travelCompanion, state.itineraryItems); }
  async function open(tab = 'today', filter = 'all') {
    if (!ready) return;
    if (tab === 'review') { closeAll(); window.TripLog.features.redesign.workspace.navigate('report'); window.TripLog.features.reports.workspace.setTab('itinerary'); return; }
    const sequence = ++openSequence, tripId = state.id, account = accountKey(), dates = M().days(state);
    openingPage = true;
    if (openedTrip !== tripId || !dates.includes(selectedDay)) selectedDayManual = false;
    if (!selectedDayManual) selectedDay = M().defaultItineraryDate(state);
    openedTrip = tripId; openedAccount = account; activeTab = titles[tab] ? tab : 'today';
    walletFilter = walletFilters.some(([key]) => key === filter) ? filter : 'all';
    walletQuery = ''; walletSort = 'date'; walletPastOpen = false;
    if (activePage !== 'travel') window.TripLog.features.redesign.workspace.navigate('travel');
    syncTravelLocation();
    try { if (!await loadPersonal()) { if (sequence === openSequence) openingPage = false; return; } } catch (_) { personal = {}; personalKey = scopeKey(); }
    if (sequence !== openSequence || state.id !== tripId || accountKey() !== account || activePage !== 'travel') { if (sequence === openSequence) openingPage = false; return; }
    $('#ttStatus').textContent = '';
    if ($('#rdMore')?.open) $('#rdMore').close();
    renderContent(); openDialog('ttCompanion'); setPageScroll(0); openingPage = false;
  }
  function todayContent() { return V().today(state, selectedDay, personal, Boolean(progressUndo)); }
  function renderCostInfo() {
    $('#ttCostInfoBody').innerHTML = V().spendingDetail(state, selectedDay);
    window.TripLog.features.reports.workspace.drawDonut(V().spendingRows(state, selectedDay), $('#ttDayDonut'), { innerRadius: 133, stroke: '#fff', lineWidth: 1 });
  }
  function reservationDate(row) {
    const stay = row.type === 'stay' && M().validDate(row.date) && M().validDate(row.endDate) && row.endDate > row.date;
    if (row.type === 'transport' && row.source === 'entry' && M().validDate(row.endDate)) return `${dateLabel(row.date)}${row.time ? ' · ' + row.time : ''} → ${dateLabel(row.endDate)}${row.endTime ? ' · ' + row.endTime : ''} · 왕복`;
    if (row.type === 'transport' && row.endTime) return `${dateLabel(row.date)} · ${row.time} → ${row.arrivalDate && row.arrivalDate !== row.date ? dateLabel(row.arrivalDate) + ' · ' : ''}${row.endTime}`;
    return `${dateLabel(row.date)}${row.time ? ' · ' + row.time : ''}${stay ? ` – ${dateLabel(row.endDate)} · ${Math.round((Date.parse(row.endDate) - Date.parse(row.date)) / 86400000)}박` : ''}`;
  }
  const walletFold = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
  function walletSearchMatches(row) {
    const query = walletFold(walletQuery);
    return !query || walletFold([row.title, row.from, row.to, row.location, row.reference, row.note, row.date, row.endDate, reservationDate(row), walletType(row)?.label].join(' ')).includes(query);
  }
  function walletType(row) {
    return row.type === 'transport' ? { ...M().transportInfo(row), color: 'blue' } : M().types[row.type] || M().types.other;
  }
  function renderWalletResults() {
    const list = $('#ttWalletList'); if (!list) return;
    walletPastOpen = list.querySelector('.cx-past')?.open ?? walletPastOpen;
    const all = M().reservationOccurrences(state), searched = all.filter(walletSearchMatches);
    const matching = searched.filter(row => walletFilter === 'all' || row.type === walletFilter);
    if (walletSort === 'recent') matching.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));
    else if (walletSort === 'name') matching.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko-KR', { numeric: true }));
    const count = rows => new Set(rows.map(row => row.reservationId)).size;
    $('#ttWalletFilters').innerHTML = walletFilters.map(([key, label]) => '<option value="' + key + '"' + (key === walletFilter ? ' selected' : '') + '>' + label + ' ' + count(key === 'all' ? searched : searched.filter(row => row.type === key)) + '</option>').join('');
    setupCustomSelect($('#ttWalletFilters'));
    syncCustomSelect($('#ttWalletFilters'), { rebuild: true });
    $('#ttWalletSearchClear').hidden = !walletQuery;
    $('#ttWalletCount').textContent = `${walletQuery ? '검색 결과' : '예약'} ${count(matching)}건`;
    list.innerHTML = walletQuery || walletSort !== 'date'
      ? matching.map(row => V().walletRow(row)).join('') || '<p class="cx-empty-line">조건에 맞는 예약이 없어요.</p>'
      : V().walletList(state, matching, walletFilter !== 'all');
    if (list.querySelector('.cx-past')) list.querySelector('.cx-past').open = walletPastOpen;
  }
  function walletContent() {
    return `<div class="tt-wallet-toolbar"><div class="tt-wallet-search">${icon('magnifying-glass')}<input id="ttWalletSearch" type="search" value="${text(walletQuery)}" placeholder="예약 검색" aria-label="예약명·장소·예약번호 검색" autocomplete="off" maxlength="200">${button(icon('x'), 'wallet-search-clear', 'tt-wallet-clear', 'id="ttWalletSearchClear" aria-label="검색어 지우기"')}</div><select id="ttWalletFilters" aria-label="예약 종류"></select>${button(icon('plus'), 'reservation-new', 'tt-primary cx-add-reservation', 'aria-label="예약 추가"')}<div class="tt-wallet-resultbar"><p id="ttWalletCount" role="status" aria-live="polite"></p><label class="tt-wallet-sort"><span class="tt-visually-hidden">예약 정렬</span><select id="ttWalletSort" aria-label="예약 정렬">${[['date','날짜순'],['recent','최근 날짜순'],['name','이름순']].map(([value,label])=>`<option value="${value}"${walletSort===value?' selected':''}>${label}</option>`).join('')}</select></label></div></div><div id="ttWalletList" class="tt-wallet-list"></div>`;
  }
  function toolsContent() { return V().tools(state); }
  function renderContent() {
    const panel = $('#ttCompanion'); if (!panel) return;
    panel.dataset.tab = activeTab; panel.classList.add('cx-experience'); panel.classList.remove('tt-passport-ui', 'tt-wallet-ui');
    const top = pageScroll();
    $('#ttCompanionTitle').textContent = titles[activeTab];
    $('#ttTodayControls').hidden = activeTab !== 'today';
    $('#ttTodayControls').innerHTML = activeTab === 'today' ? V().todayControls(state, selectedDay, Boolean(progressUndo)) : '';
    $('#ttCompanionSubtitle').textContent = '';
    $('#ttPassportGreeting').textContent = '';
    walletPastOpen = $('#ttWalletList .cx-past')?.open ?? walletPastOpen;
    const focused = document.activeElement?.id, start = focused === 'ttWalletSearch' ? $('#ttWalletSearch')?.selectionStart : null;
    $('#ttContent').innerHTML = ({ today: todayContent, wallet: walletContent, tools: toolsContent })[activeTab]();
    if (activeTab === 'wallet') {
      renderWalletResults();
      if (focused === 'ttWalletSearch') { $('#ttWalletSearch').focus({ preventScroll: true }); if (start !== null) $('#ttWalletSearch').setSelectionRange(start, start); }
    }
    $('#ttPrimary').hidden = true;
    $$('#ttTravelTabs [role="tab"]').forEach(tab => {
      const selected = tab.dataset.tab === activeTab;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    });
    $('#ttContent').setAttribute('aria-labelledby', `ttTravelTab-${activeTab}`);
    syncTravelLocation(); setPageScroll(top);
    window.TripLog.features.travelCompanion.tools.refresh();
    if (activeTab === 'today' && $('#ttDay')) setupCustomSelect($('#ttDay'));
    if (!window.TripLog.features.redesign.workspace.canEditTripSettings()) {
      panel.querySelectorAll('[data-tt-action]').forEach(control => {
        if (['complete', 'quick-expense', 'reservation-new', 'reservation-edit', 'reservation-source', 'packing-rename', 'packing-delete', 'packing'].includes(control.dataset.ttAction)) control.disabled = true;
      });
      panel.querySelectorAll('[data-tt-packing],#ttPackingAdd input,#ttPackingAdd button').forEach(control => { control.disabled = true; });
    }
  }
  function render() {
    if (!ready) return;
    if (activePage !== 'travel') {
      if (openingPage) { openSequence++; openingPage = false; }
      if (isOpen()) ($('#ttCompanion').hidden = true);
    }
    if (openedTrip && (openedTrip !== state.id || openedAccount && openedAccount !== accountKey())) { openSequence++; openingPage = false; closeAll(); openedTrip = ''; selectedDay = ''; selectedDayManual = false; editor = null; personal = {}; progressUndo = null; returnContext = null; }
    if (activePage === 'travel' && !isOpen() && !openingPage && !returnContext) {
      const requested = new URL(location.href).searchParams.get('travelTab');
      open(titles[requested] ? requested : 'today');
    } else if (isOpen()) {
      if (!M().days(state).includes(selectedDay)) {
        selectedDay = M().defaultItineraryDate(state); selectedDayManual = false;
        personal = {}; personalKey = ''; progressUndo = null;
        loadPersonal().then(loaded => { if (loaded && isOpen()) renderContent(); }).catch(() => {});
      }
      renderContent();
    }
    window.TripLog.features.travelCompanion.tools.refresh();
    if ($('#ttCostInfo').open && $('#ttCostInfo').tripId === state.id) renderCostInfo();
  }
  function openReservationEditor(row) {
    const source = row?.source === 'manual' ? companion().reservations.find(item => item.id === row.sourceId) : null;
    editor = { tripId: state.id, account: window.TripLog.sync.controller.getAccount()?.id, id: source?.id || createId(), existing: Boolean(source), signature: JSON.stringify(source || null) };
    const form = $('#ttReservationForm'); form.reset();
    $('#ttReservationEditorTitle').textContent = source ? '예약 수정' : '예약 추가';
    const values = { type: source?.type || (walletFilter === 'all' ? 'transport' : walletFilter), title: source?.title || '', date: source?.date || selectedDay || M().defaultItineraryDate(state), endDate: source?.endDate || state.endDate, time: source?.time || '', endTime: source?.endTime || '', arrivalDate: source?.arrivalDate || '', transportKind: source?.transportKind || '', from: source?.from || '', to: source?.to || '', reference: source?.reference || '', location: source?.location || '', url: source?.url || '', note: source?.note || '', ticketUrl: source?.ticketUrl || '', guests: source?.guests || '', seats: source?.seats || '', operator: source?.operator || '', serviceNumber: source?.serviceNumber || '' };
    Object.entries(values).forEach(([key, value]) => { if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value; });
    $('#ttReservationExtras').open = false;
    $('#ttReservationError').textContent = ''; updateReservationType();
    window.TripLog.features.travelCompanion.payment.open(source);
    form.querySelectorAll('select').forEach(select => { setupCustomSelect(select); syncCustomSelect(select, { rebuild: true }); });
    ['ttReservationDate', 'ttReservationEnd', 'ttReservationArrivalDate'].forEach(id => { setupCustomDatePicker($(`#${id}`)); syncCustomDatePicker($(`#${id}`)); });
    ['ttReservationTime', 'ttReservationArrivalTime'].forEach(id => { setupCustomTimePicker($(`#${id}`)); syncCustomTimePicker($(`#${id}`)); });
    openDialog('ttReservationEditor');
  }
  function addReservation(type = 'transport') {
    if (!ready) return;
    const dates = M().days(state), today = M().dateInZone(M().defaultZone(state) || undefined);
    if (openedTrip !== state.id || !dates.includes(selectedDay)) selectedDay = M().defaultItineraryDate(state);
    openedTrip = state.id; openedAccount = accountKey();
    walletFilter = walletFilters.some(([key]) => key === type && key !== 'all') ? type : 'transport';
    openReservationEditor();
  }
  function updateReservationType() {
    const type = $('#ttReservationForm').elements.namedItem('type').value, stay = type === 'stay', transport = type === 'transport';
    $$('#ttReservationTypes button').forEach(el => { el.classList.toggle('active', el.dataset.type === type); el.setAttribute('aria-pressed', String(el.dataset.type === type)); });
    $('#ttReservationDateLabel').textContent = stay ? '체크인' : '예약 일자';
    $('#ttReservationEndField').hidden = !stay; $('#ttReservationTimeField').hidden = false;
    $('#ttReservationEnd').required = stay;
    $('#ttReservationEnd').disabled = !stay; $('#ttReservationTime').disabled = false;
    $('#ttReservationTimeLabel').textContent = transport ? '출발 시간 (선택)' : '예약 시간 (선택)';
    $('#ttReservationTransport').hidden = !transport;
    $('#ttReservationArrivalField').hidden = !(transport || stay);
    $('#ttReservationArrivalDateField').hidden = !transport;
    ['transportKind', 'from', 'to', 'arrivalDate', 'endTime'].forEach(name => { $('#ttReservationForm').elements.namedItem(name).disabled = name === 'endTime' ? !(transport || stay) : !transport; });
    $('#ttReservationName').placeholder = transport ? '예: KTX 503' : stay ? '예: 난바 호텔' : '예: 전망대 입장권';
  }
  async function saveReservation(event) {
    event.preventDefault(); if (reservationSaving || !editor) return;
    reservationSaving = true;
    const submit = document.querySelector('[form="ttReservationForm"][type="submit"]'); submit.disabled = true;
    try {
      if (editor.tripId !== state.id || editor.account !== window.TripLog.sync.controller.getAccount()?.id) throw new Error('여행이 변경됐어요. 예약 창을 다시 열어 주세요.');
      const existing = companion().reservations.find(row => row.id === editor.id);
      if (JSON.stringify(existing || null) !== editor.signature) throw new Error('예약이 다른 곳에서 수정됐어요. 창을 다시 열어 주세요.');
      const data = Object.fromEntries(new FormData(event.target));
      Object.keys(data).forEach(key => { data[key] = String(data[key]).trim(); });
      Object.assign(data, window.TripLog.features.travelCompanion.payment.values());
      if (data.type !== 'stay') data.endDate = '';
      if (data.type !== 'transport') Object.assign(data, { arrivalDate: '', transportKind: '', from: '', to: '', operator: '', serviceNumber: '', seats: '' });
      const next = window.TripLog.domain.commands.mutate(state, 'reservation', editor.existing ? 'update' : 'add', { id: editor.id, data });
      const after = new Set(next.itineraryItems.map(item => item.id));
      state.itineraryItems.filter(item => !after.has(item.id)).forEach(item => window.TripLog.persistence.stateStorage.markDeletedEntity('itinerary', item.id));
      const saving = editor;
      await commit({ travelCompanion: next.travelCompanion, itineraryItems: next.itineraryItems, entries: next.entries });
      if (editor !== saving || state.id !== saving.tripId) return;
      $('#ttReservationEditor').close();
      if ($('#ttReservationDetail').open) showReservationDetail(`manual:${saving.id}`, false);
      showToast('예약을 저장했어요.');
    } catch (error) { $('#ttReservationError').textContent = error.message; $('#ttReservationError').scrollIntoView({ block: 'nearest' }); }
    finally { reservationSaving = false; submit.disabled = false; }
  }
  function showReservationDetail(id, openModal = true, occurrenceId) {
    const row = (occurrenceId && M().reservationOccurrences(state).find(item => item.occurrenceId === occurrenceId)) || M().reservations(state).find(item => item.id === id); if (!row) return;
    const type = walletType(row), link = M().safeUrl(row.url);
    const mapLink = row.location ? buildTripPlaceSearchUrl(row.location) : '';
    const ticket = M().safeUrl(row.ticketUrl), linkedExpense = state.entries.find(entry => entry.id === (row.source === 'entry' ? row.sourceId : row.linkedExpenseId));
    const linkedPlans = state.itineraryItems.filter(item => (item.linkedReservationId === row.id && (row.type === 'stay' || item.date === row.date)) || row.source === 'itinerary' && item.id === row.sourceId);
    const mapTarget = matchMedia('(any-pointer: coarse)').matches ? '_self' : '_blank';
    $('#ttReservationDetailTitle').textContent = '예약 상세';
    $('#ttReservationDetailBody').innerHTML = `
      <div class="tt-detail-hero"><span class="tt-reservation-icon ${type.color}">${icon(type.icon)}</span><div><span class="tt-type ${type.color}">${type.label}</span><h2>${text(row.title)}</h2></div></div>
      <dl class="tt-detail-list">
        ${row.type === 'transport' ? `<div><dt>${icon(type.icon)}교통수단 · 구간</dt><dd>${text(type.label)} · ${text(row.from || '출발지 미정')} → ${text(row.to || '도착지 미정')}</dd></div>` : ''}
        <div><dt>${icon('calendar-blank')}${row.type === 'stay' ? '체크인 · 체크아웃' : '예약 일자 · 시간'}</dt><dd>${text(reservationDate(row))}</dd></div>
        <div><dt>${icon('clipboard-text')}예약번호</dt><dd class="tt-detail-reference"><code>${text(row.reference || '등록한 번호가 없어요')}</code>${row.reference ? button(`${icon('copy')}<span>복사</span>`, 'copy', 'tt-copy-action', `data-id="${text(id)}" aria-label="예약번호 복사"`) : button('입력', row.source === 'manual' ? 'reservation-edit' : 'reservation-source', '', `data-id="${text(id)}" data-field="reference"`)}</dd></div>
        <div><dt>${icon('map-pin')}주소 · 장소</dt><dd class="tt-detail-address"><span>${text(row.location || '등록한 장소가 없어요')}</span>${mapLink ? `<a class="tt-button tt-detail-map" href="${text(mapLink)}" target="${mapTarget}" rel="noopener noreferrer external">${icon('arrow-square-out')} ${getTripMapLabel()}</a>` : ''}</dd></div>
        ${row.guests || row.seats || row.operator || row.serviceNumber ? `<div><dt>${icon('users')}인원 · 이용 정보</dt><dd>${text([row.guests ? row.guests + '명' : '', row.seats ? '좌석 ' + row.seats : '', row.operator, row.serviceNumber].filter(Boolean).join(' · '))}</dd></div>` : ''}
        ${row.note ? `<div><dt>${icon('note')}메모</dt><dd class="tt-prewrap">${text(row.note)}</dd></div>` : ''}
        ${row.quotedAmount > 0 ? `<div><dt>예약 금액</dt><dd>${text(row.quotedCurrency)} ${Number(row.quotedAmount).toLocaleString('ko-KR')}</dd></div>` : ''}
      </dl>
      <div class="cx-detail-links">${ticket ? `<a class="tt-button tt-primary" href="${text(ticket)}" target="_blank" rel="noopener noreferrer">${icon('ticket')} 티켓 열기</a>` : ''}${link ? `<a class="tt-button tt-detail-link" href="${text(link)}" target="_blank" rel="noopener noreferrer">예약 사이트 ${icon('arrow-up-right')}</a>` : ''}${row.location ? button(`${icon('copy')} 주소 복사`, 'copy-text', '', `data-value="${text(row.location)}"`) : ''}</div>
      ${linkedExpense ? button(`${icon('wallet')} 연결된 지출 · ${money(linkedExpense.amount)} ${icon('caret-right')}`, 'expense-source', 'tt-detail-link', `data-id="${text(linkedExpense.id)}"`) : row.linkedExpenseId ? '<p class="tt-muted">연결된 지출을 확인할 수 없어요. 편집에서 다시 선택할 수 있어요.</p>' : ''}
      ${row.attachment ? button(`${icon('file')} 저장한 입장권 열기`, 'attachment', 'tt-detail-link', `data-id="${text(id)}"`) : ''}
      <p class="tt-muted tt-source-note">${row.source === 'manual' ? '직접 등록한 예약' : row.source === 'entry' ? '사전구매 지출에 연결된 예약' : '일정에 연결된 예약'}</p>
      ${row.source === 'manual' ? `<div class="tt-detail-actions">${button(`${icon('pencil-simple')} 예약 수정`, 'reservation-edit', '', `data-id="${text(id)}"`)}${button(`${icon('trash')} 삭제`, 'reservation-delete', 'tt-danger', `data-id="${text(id)}"`)}</div>` : button(row.source === 'entry' ? '원본 지출 보기' : '연결된 일정 보기', 'reservation-source', 'tt-detail-link', `data-id="${text(id)}"`)}
    `;
    $('#ttReservationDetailFooter').innerHTML = `<div>${button(`${icon('calendar-plus')} ${linkedPlans.length ? '연결된 일정 보기' : '새 일정에 추가'}`, 'reservation-link', 'tt-primary', `data-id="${text(id)}" data-occurrence="${text(row.occurrenceId || '')}"`)}${!linkedPlans.length && row.source !== 'itinerary' ? button('기존 일정 연결', 'choose-itinerary', '', `data-id="${text(id)}" data-occurrence="${text(row.occurrenceId || '')}"`) : ''}</div>`;
    if (openModal) openDialog('ttReservationDetail');
  }
  function editItinerary(item) {
    if (!item) return;
    rememberReturn();
    closeAll(); state.selectedItineraryDate = item.date;
    window.TripLog.features.redesign.workspace.navigate('itinerary', { date: state.selectedItineraryDate }); startItineraryEdit(item);
  }
  async function linkReservation(row) {
    if (row.source === 'itinerary') { editItinerary(findItineraryItem(row.sourceId)); return; }
    if (row.type === 'stay') {
      const stay = M().stayItinerary(state, row, row);
      const item = stay.itineraryItems.find(item => item.linkedReservationId === row.id);
      if (!item) throw new Error('여행 기간 안에 숙박일이 없어요. 예약 또는 여행 일자를 먼저 수정해 주세요.');
      stay.removedIds.forEach(id => window.TripLog.persistence.stateStorage.markDeletedEntity('itinerary', id));
      await commit({ itineraryItems: stay.itineraryItems }); editItinerary(item); return;
    }
    const linked = state.itineraryItems.find(item => item.linkedReservationId === row.id && item.date === row.date);
    if (linked) { editItinerary(linked); return; }
    if (!M().days(state).includes(row.date)) throw new Error('예약 일자가 여행 기간 밖에 있어요. 예약 또는 여행 일자를 먼저 수정해 주세요.');
    const item = M().itineraryForReservation(row, { id: createId(), trans: 'none', transits: [], duration: 0, cost: 0, linkedReservationId: row.id, createdAt: Date.now() });
    await commit({ itineraryItems: [...state.itineraryItems, item] }); editItinerary(item); showToast('예약 정보를 일정에 함께 추가했어요.');
  }
  function download(content, name, type) {
    const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const fileName = suffix => `${(state.tripName || 'TripLOG').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80)}-${suffix}`;
  async function savePocket() {
    const trip = JSON.parse(JSON.stringify(state)), options = { ...pocketOptions };
    const asset = await fetch('src/assets/triplog-wordmark.png');
    if (!asset.ok) throw new Error('포켓노트 이미지를 불러오지 못했어요. 다시 시도해 주세요.');
    const blob = await asset.blob();
    options.logo = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    if (trip.id !== state.id) throw new Error('여행이 변경됐어요. 다시 저장해 주세요.');
    download(M().createPocketNote(trip, options), fileName('포켓노트.html'), 'text/html;charset=utf-8');
    showToast('포켓노트를 만들었어요. 다운로드한 파일을 열어 보세요.');
  }
  async function changeDay(date) {
    if (!M().days(state).includes(date)) return;
    selectedDay = date;
    selectedDayManual = true;
    if (await loadPersonal()) renderContent();
  }
  async function progressAction(action, id) {
    if (progressBusy || !findItineraryItem(id) || personalKey !== scopeKey()) return;
    progressBusy = true;
    const before = JSON.parse(JSON.stringify(personal)), scope = scopeKey();
    try {
      if (action === 'complete') {
        const checked = !M().flags(state).completed.has(id);
        const next = window.TripLog.domain.commands.mutate(state, 'itinerary', 'complete', { id, checked });
        await commit({ travelCompanion: next.travelCompanion });
        progressUndo = { kind: 'complete', id, before: !checked, after: checked, personal: before, scope };
        showToast(checked ? '방문 완료 · 되돌리기 가능' : '방문 완료를 취소했어요.');
      } else {
        const skipped = new Set(personal.skipped || []);
        if (action === 'skip') skipped.add(id); else skipped.delete(id);
        const after = { ...personal, cursor: id, skipped: [...skipped] };
        await savePersonal(after); progressUndo = { kind: 'personal', before, after, scope };
        showToast(action === 'skip' ? '건너뛰었어요 · 되돌리기 가능' : '이 일정부터 보여드려요.');
      }
      if (scope === scopeKey()) renderContent();
    } finally { progressBusy = false; }
  }
  async function undoProgress() {
    const undo = progressUndo; if (!undo || undo.scope !== scopeKey() || progressBusy) return;
    progressBusy = true;
    try {
      if (undo.kind === 'complete') {
        if (!findItineraryItem(undo.id) || M().flags(state).completed.has(undo.id) !== undo.after) throw new Error('완료 상태가 다른 곳에서 변경됐어요. 현재 상태를 확인해 주세요.');
        const next = window.TripLog.domain.commands.mutate(state, 'itinerary', 'complete', { id: undo.id, checked: undo.before });
        await commit({ travelCompanion: next.travelCompanion });
      } else await savePersonal(undo.before);
      progressUndo = null; renderContent(); showToast('방금 진행 조작을 되돌렸어요.');
    } finally { progressBusy = false; }
  }
  function showStartPicker() {
    const completed = M().flags(state).completed;
    $('#ttStartChoices').innerHTML = M().dayItems(state, selectedDay).filter(item => !completed.has(item.id)).map(item => button(`<time>${text(item.time || '시각 미정')}</time><b>${text(item.place)}</b>`, 'start-at', '', `data-id="${text(item.id)}"`)).join('') || '<p class="cx-empty-line">모든 일정이 완료됐어요.</p>';
    openDialog('ttStartPicker');
  }
  function openOffline() {
    $('#ttOfflineBody').innerHTML = V().offline(state, pocketOptions);
    updateOfflinePreview();
    openDialog('ttOfflineOptions');
  }
  function updateOfflinePreview() {
    $('#ttOfflineSave').disabled = !pocketOptions.itinerary && !pocketOptions.references && !pocketOptions.costs;
    const summary = $('#ttOfflineBody .cx-export-preview p');
    if (summary) summary.textContent = [pocketOptions.itinerary ? '여행 일정' : '', pocketOptions.references ? '예약정보·번호' : '', pocketOptions.costs ? '기록된 경비' : ''].filter(Boolean).join(' · ') || '저장할 정보를 선택해 주세요.';
  }
  function quickExpense(id) {
    const item = findItineraryItem(id);
    rememberReturn(); closeAll(); clearEditMode();
    window.TripLog.features.redesign.workspace.openExpenseEditor();
    const actual = M().dateInZone(M().defaultZone(state) || undefined);
    els.daySelect.value = actual < state.startDate ? '__pretrip__' : selectedDay || state.startDate;
    els.descriptionInput.value = item?.place || '';
    const category = { food: '식비', lodging: '숙소', transport: '교통', shopping: '쇼핑', sightseeing: '관광' }[item?.theme] || '기타';
    if ([...els.categorySelect.options].some(option => option.value === category)) els.categorySelect.value = category;
    $('#rdPaymentDate').value = actual; syncCustomDatePicker($('#rdPaymentDate'));
    [els.daySelect, els.categorySelect].forEach(select => syncCustomSelect(select));
    $('#rdExpenseEditor').classList.add('cx-quick-expense');
    $('#rdExpenseEditorTitle').textContent = '빠른 지출';
    window.TripLog.features.expenses.workspace.syncEditor();
    window.TripLog.features.expenses.workspace.setCompact(true);
  }
  async function copyText(value) {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); showToast('복사했어요.'); }
    catch (_) { $('#ttCopyTitle').textContent = '텍스트 복사'; $('#ttCopyValue').value = value; openDialog('ttCopy'); $('#ttCopyValue').focus(); $('#ttCopyValue').select(); }
  }
  async function packingChange(action, id, data) {
    const next = window.TripLog.domain.commands.mutate(state, 'packing', action, { id, data });
    if (action === 'remove') window.TripLog.persistence.stateStorage.markDeletedEntity('packing', id);
    await commit({ packingList: next.packingList });
  }
  function itineraryChoices(row) {
    $('#ttItineraryChoices').innerHTML = M().dayItems(state, row.date).filter(item => !item.linkedReservationId || item.linkedReservationId === row.id).map(item => button(`<b>${text(item.time || '미정')} ${text(item.place)}</b>`, 'connect-itinerary', '', `data-id="${text(row.id)}" data-item="${text(item.id)}" data-occurrence="${text(row.occurrenceId || '')}"`)).join('') || '<p class="cx-empty-line">이용 날짜에 연결할 일정이 없어요.</p>';
    openDialog('ttItineraryPicker');
  }
  async function handleClick(event) {
    const target = event.target.closest('[data-tt-action]'); if (!target) return;
    const action = target.dataset.ttAction, id = target.dataset.id;
    if (target.closest('.tt-dialog')?.tripId !== state.id) return;
    try {
      switch (action) {
        case 'global-nav': returnContext = null; closeAll(); window.TripLog.features.redesign.workspace.navigate(target.dataset.page); break;
        case 'copy-text': await copyText(target.dataset.value); break;
        case 'expense-source': { const entry = findEntry(id); if (entry) { rememberReturn(); closeAll(); startEdit(entry); } break; }
        case 'skip': case 'resume': await progressAction(action, id); break;
        case 'progress-undo': await undoProgress(); break;
        case 'start-picker': showStartPicker(); break;
        case 'start-at': await progressAction('start', id); $('#ttStartPicker').close(); break;
        case 'quick-expense': quickExpense(id); break;
        case 'stay-directions': {
          const stays = M().activeStays(state, selectedDay);
          $('#ttStayChoices').innerHTML = stays.map(row => `<a class="tt-button" href="${text(M().directions({ place: row.title, location: row.location }, state))}" target="_blank" rel="noopener noreferrer"><b>${text(row.title)}</b><small>${text(row.location)}</small></a>`).join('');
          openDialog('ttStayPicker'); break;
        }
        case 'offline-options': openOffline(); break;
        case 'packing-rename': {
          const row = state.packingList.find(item => item.id === id); if (!row) break;
          $('#ttPackingName').value = row.name; $('#ttPackingRenameForm').dataset.id = id; $('#ttPackingRenameForm').dataset.original = row.name; openDialog('ttPackingRename'); break;
        }
        case 'packing-delete': {
          const row = state.packingList.find(item => item.id === id), trip = state.id;
          if (row && await window.TripLog.ui.confirmation.ask({ kind: 'packing', subject: row.name }) && trip === state.id) await packingChange('remove', id);
          break;
        }
        case 'choose-itinerary': { const row = M().reservationOccurrences(state).find(item => item.occurrenceId === target.dataset.occurrence) || M().reservations(state).find(item => item.id === id); if (row) itineraryChoices(row); break; }
        case 'connect-itinerary': {
          const row = M().reservationOccurrences(state).find(item => item.occurrenceId === target.dataset.occurrence) || M().reservations(state).find(item => item.id === id), item = findItineraryItem(target.dataset.item);
          if (!row || !item || row.date !== item.date) throw new Error('같은 이용 날짜의 일정을 다시 선택해 주세요.');
          if (item.linkedReservationId && item.linkedReservationId !== row.id) throw new Error('다른 예약에 연결된 일정이에요.');
          await commit({ itineraryItems: state.itineraryItems.map(value => value.id === item.id ? { ...value, linkedReservationId: row.id, ...(row.source === 'entry' && row.type === 'transport' ? { reservationJourney: row.returnJourney ? 'return' : 'outbound' } : {}) } : value) });
          $('#ttItineraryPicker').close(); showReservationDetail(row.id, false); showToast('기존 일정과 연결했어요.'); break;
        }
        case 'close': target.closest('dialog')?.close(); break;
        case 'tab': if (!titles[target.dataset.tab]) break; activeTab = target.dataset.tab; renderContent(); setPageScroll(0); target.focus({ preventScroll: true }); break;
        case 'day': await changeDay(target.dataset.date); break;
        case 'complete': case 'lock': {
          if (action === 'complete') { await progressAction('complete', id); break; }
          if (!findItineraryItem(id)) break;
          const next = companion(), key = action === 'complete' ? 'completedItineraryIds' : 'lockedItineraryIds';
          const values = new Set(next[key]); if (values.has(id)) values.delete(id); else values.add(id); next[key] = [...values];
          await commit({ travelCompanion: next });
          $$(`[data-tt-action="${action}"]`).find(el => el.dataset.id === id)?.focus({ preventScroll: true });
          break;
        }
        case 'itinerary-edit': editItinerary(findItineraryItem(id)); break;
        case 'transit-edit': {
          const items = M().dayItems(state, selectedDay), index = items.findIndex(item => item.id === id);
          if (index < 1) break;
          rememberReturn(); closeAll(); state.selectedItineraryDate = selectedDay;
          window.TripLog.features.redesign.workspace.navigate('itinerary', { date: state.selectedItineraryDate });
          window.TripLog.features.itinerary.transitEditor.open(id, items[index - 1].id, undefined, { initialView: 'manual', segmentIndex: Number(target.dataset.segment) || 0 });
          break;
        }
        case 'itinerary-new': closeAll(); state.selectedItineraryDate = selectedDay || state.startDate; window.TripLog.features.redesign.workspace.navigate('itinerary', { date: state.selectedItineraryDate }); window.TripLog.features.itinerary.workspace.show(); break;
        case 'itinerary-day': case 'itinerary-all': closeAll(); state.selectedItineraryDate = action === 'itinerary-all' ? 'all' : selectedDay; window.TripLog.features.redesign.workspace.navigate('itinerary', { date: state.selectedItineraryDate }); saveAndRender(); break;
        case 'cost-info': renderCostInfo(); openDialog('ttCostInfo'); break;
        case 'expenses-open': returnContext = null; closeAll(); window.TripLog.features.redesign.workspace.navigate('budget'); $('#exFilterReset').click(); break;
        case 'wallet-filter': walletFilter = target.dataset.filter; renderWalletResults(); $$('#ttWalletFilters button').find(el => el.dataset.filter === walletFilter)?.focus({ preventScroll: true }); break;
        case 'wallet-search-clear': walletQuery = ''; $('#ttWalletSearch').value = ''; renderWalletResults(); $('#ttWalletSearch').focus({ preventScroll: true }); break;
        case 'wallet-reset': walletFilter = 'all'; walletQuery = ''; $('#ttWalletSearch').value = ''; renderWalletResults(); $('#ttWalletSearch').focus({ preventScroll: true }); break;
        case 'reservation-new': openReservationEditor(); break;
        case 'reservation-type': $('#ttReservationForm').elements.namedItem('type').value = target.dataset.type; updateReservationType(); break;
        case 'reservation-detail': showReservationDetail(id, true, target.dataset.occurrence); break;
        case 'reservation-edit': openReservationEditor(M().reservations(state).find(row => row.id === id)); if (target.dataset.field === 'reference') $('#ttReservationReference').focus(); break;
        case 'reservation-delete': {
          const tripId = state.id, row = companion().reservations.find(item => `manual:${item.id}` === id), before = JSON.stringify(row);
          if (row && await window.TripLog.ui.confirmation.ask({ kind: 'reservation', subject: row.title || '예약' }) && tripId === state.id) {
            const current = companion(); if (JSON.stringify(current.reservations.find(item => item.id === row.id)) !== before) throw new Error('예약이 변경됐어요. 다시 확인해 주세요.');
            window.TripLog.persistence.stateStorage.markDeletedEntity('reservation', row.id);
            const next = window.TripLog.domain.commands.mutate(state, 'reservation', 'remove', { id: row.id });
            await commit({ travelCompanion: next.travelCompanion, itineraryItems: next.itineraryItems }); $('#ttReservationDetail').close(); showToast('예약을 삭제했어요. 연결된 지출은 유지돼요.');
          } break;
        }
        case 'copy': { if (target.classList.contains('is-copied')) break; const row = M().reservations(state).find(item => item.id === id); if (row?.reference) { try { await navigator.clipboard.writeText(row.reference);
          if (target.isConnected) { const before = target.innerHTML; target.innerHTML = `${icon('check')}<span>복사됨</span>`; target.classList.add('is-copied'); window.setTimeout(() => { if (target.isConnected) { target.innerHTML = before; target.classList.remove('is-copied'); } }, 1500); }
          showToast('예약번호를 복사했어요.'); } catch { $('#ttCopyValue').value = row.reference; openDialog('ttCopy'); $('#ttCopyValue').focus(); $('#ttCopyValue').select(); } } break; }
        case 'reservation-source': { const row = M().reservations(state).find(item => item.id === id); if (row?.source === 'entry') { rememberReturn(); closeAll(); startEdit(findEntry(row.sourceId), { focusBookingCode: target.dataset.field === 'reference' }); } else if (row) editItinerary(findItineraryItem(row.sourceId)); break; }
        case 'reservation-link': { const row = M().reservationOccurrences(state).find(item => item.occurrenceId === target.dataset.occurrence) || M().reservations(state).find(item => item.id === id); if (row) await linkReservation(row); break; }
        case 'attachment': { const row = M().reservations(state).find(item => item.id === id), item = findItineraryItem(row?.sourceId); if (item) window.TripLog.features.itinerary.workspace.downloadTicket(item); break; }
        case 'calendar': { const zone = M().defaultZone(state); if (!zone) throw new Error('먼저 여행지의 일정 시간대를 선택해 주세요.'); const content = M().createCalendar(state, zone); download(content, fileName('여행일정.ics'), 'text/calendar;charset=utf-8'); $('#ttExportHelp').hidden = false; showToast('ICS 파일을 만들었어요. 캘린더 앱으로 가져오세요.'); break; }
        case 'pocket': target.disabled = true; try { await savePocket(); } finally { target.disabled = false; } break;
        case 'packing': window.TripLog.features.travelCompanion.tools.open('packing'); break;
      }
    } catch (error) {
      if (isOpen()) $('#ttStatus').textContent = error.message;
      showToast(error.message || '처리하지 못했어요. 다시 시도해 주세요.');
    }
  }
  function setup() {
    if (ready) return; ready = true;
    const mainDialog = createDialog('ttCompanion', '<div class="tt-scroll"><div class="tt-heading"><h1 id="ttCompanionTitle" tabindex="-1"></h1><div id="ttTodayControls" hidden></div><p id="ttCompanionSubtitle"></p></div><div id="ttContent"></div><p id="ttStatus" role="alert"></p></div><footer class="tt-footer"><div id="ttPrimaryDock"><div id="ttPrimary"></div></div><nav id="ttNav" aria-label="여행 동행 도구"></nav></footer>');
    els.travelPage.appendChild(mainDialog); mainDialog.setAttribute('role', 'region');
    mainDialog.insertAdjacentHTML('afterbegin', `<div id="ttTravelTabs" class="cx-travel-tabs" role="tablist" aria-label="여행 기능">${Object.entries(titles).map(([tab, title]) => button(title, 'tab', '', `id="ttTravelTab-${tab}" data-tab="${tab}" role="tab" aria-controls="ttContent" aria-selected="${tab === activeTab}" tabindex="${tab === activeTab ? 0 : -1}"`)).join('')}</div>`);
    $('#ttContent').setAttribute('role', 'tabpanel');
    $('#ttTravelTabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = $$('#ttTravelTabs [role="tab"]'), index = buttons.indexOf(event.target);
      if (index < 0) return; event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].click();
    });
    $('.tt-header .tt-icon', mainDialog).insertAdjacentHTML('beforebegin', '<span id="ttPassportGreeting" aria-hidden="true"></span>');
    createDialog('ttReservationEditor', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttReservationEditorTitle" tabindex="-1">예약 추가</h1></div>
      <form id="ttReservationForm" class="tt-form"><input type="hidden" name="type" value="transport">
        <div id="ttReservationTypes" class="tt-filters" role="group" aria-label="예약 종류">${Object.entries(M().types).map(([type, entry]) => button(`${icon(entry.icon)}<span>${entry.label}</span>`, 'reservation-type', '', `data-type="${type}"`)).join('')}</div>
        <label for="ttReservationName"><span>예약 이름 <b class="tt-required" aria-hidden="true">*</b></span><input id="ttReservationName" name="title" required maxlength="200" autocomplete="off" placeholder="예: 난바 호텔"></label>
        <div id="ttReservationTransport" class="tt-transport-fields"><label><span>교통수단</span><select name="transportKind" id="ttReservationKind"><option value="">선택 안 함</option>${Object.entries(M().transportKinds).map(([kind, entry]) => `<option value="${kind}">${entry.label}</option>`).join('')}</select></label><div class="tt-form-grid"><label><span>출발지</span><input name="from" id="ttReservationFrom" maxlength="200" placeholder="예: 용산역"></label><label><span>도착지</span><input name="to" id="ttReservationTo" maxlength="200" placeholder="예: 순천역"></label></div></div>
        <div class="tt-form-grid"><label><span id="ttReservationDateLabel">예약 일자</span><input name="date" id="ttReservationDate" type="date" data-compact-date="true" required></label><label id="ttReservationEndField"><span>체크아웃</span><input name="endDate" id="ttReservationEnd" type="date" data-compact-date="true"></label><label id="ttReservationArrivalDateField"><span>도착일 (다른 날이면 선택)</span><input name="arrivalDate" id="ttReservationArrivalDate" type="date" data-compact-date="true"></label><label id="ttReservationTimeField"><span id="ttReservationTimeLabel">예약 시간 (선택)</span><input name="time" id="ttReservationTime" type="time"></label><label id="ttReservationArrivalField"><span>도착 시간 (선택)</span><input name="endTime" id="ttReservationArrivalTime" type="time"></label></div>
        <label for="ttReservationReference"><span>예약번호</span><input name="reference" id="ttReservationReference" maxlength="300" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="확인 메일의 예약번호"></label>
        <label for="ttReservationLocation"><span>주소 · 장소</span><input name="location" id="ttReservationLocation" maxlength="600" autocomplete="off" placeholder="장소명 또는 주소"></label>
        <details id="ttReservationExtras" class="tt-reservation-extras"><summary>${icon('note')}<span>예약 링크 · 메모 <small>(선택)</small></span>${icon('caret-down')}</summary><div>
          <label for="ttReservationUrl"><span>예약 링크</span><input name="url" id="ttReservationUrl" type="url" maxlength="2000" placeholder="https://" autocomplete="off"></label>
          <label for="ttReservationNote"><span>메모</span><textarea name="note" id="ttReservationNote" maxlength="3000" rows="3" placeholder="체크인 안내, 준비물 등을 적어 주세요"></textarea></label>
        </div></details>
        <p class="tt-muted">${icon('info')} 지출 기록은 별도로 추가해 주세요.</p><p id="ttReservationError" role="alert"></p>
      </form></div><footer class="tt-sub-footer"><div>${button('취소', 'close')}<button type="submit" form="ttReservationForm" class="tt-button tt-primary">예약 저장</button></div></footer>`);
    createDialog('ttReservationDetail', '<div class="tt-scroll"><div class="tt-heading"><h1 id="ttReservationDetailTitle" tabindex="-1"></h1></div><div id="ttReservationDetailBody"></div></div><footer class="tt-sub-footer" id="ttReservationDetailFooter"></footer>');
    createDialog('ttCostInfo', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttCostInfoTitle" tabindex="-1">지출 상세</h1></div><div id="ttCostInfoBody"></div></div><footer class="tt-sub-footer">${button(`${icon('receipt')}<span>지출 내역 보기</span>${icon('caret-right')}`, 'expenses-open', 'cx-spend-open')}</footer>`);
    createDialog('ttCopy', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttCopyTitle" tabindex="-1">예약번호 복사</h1><p>선택한 예약번호를 길게 눌러 복사하거나 Ctrl+C를 누르세요.</p></div><input id="ttCopyValue" class="tt-copy-value" readonly aria-label="복사할 예약번호"></div><footer class="tt-sub-footer">${button('완료', 'close', 'tt-primary')}</footer>`);
    createDialog('ttStartPicker', '<div class="tt-scroll"><div class="tt-heading"><h1 id="ttStartPickerTitle" tabindex="-1">Start here</h1><p>이전 일정의 완료 상태는 유지돼요.</p></div><div id="ttStartChoices" class="cx-select-list"></div></div>');
    createDialog('ttStayPicker', '<div class="tt-scroll"><div class="tt-heading"><h1 id="ttStayPickerTitle" tabindex="-1">숙소로 길찾기</h1></div><div id="ttStayChoices" class="cx-select-list"></div></div>');
    createDialog('ttOfflineOptions', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttOfflineOptionsTitle" tabindex="-1">오프라인 여행정보</h1></div><div id="ttOfflineBody"></div></div><footer class="tt-sub-footer">${button(`${icon('download-simple')} 파일 저장`, 'pocket', 'tt-primary', 'id="ttOfflineSave"')}</footer>`);
    createDialog('ttItineraryPicker', '<div class="tt-scroll"><div class="tt-heading"><h1 id="ttItineraryPickerTitle" tabindex="-1">기존 일정 연결</h1></div><div id="ttItineraryChoices" class="cx-select-list"></div></div>');
    createDialog('ttPackingRename', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttPackingRenameTitle" tabindex="-1">준비물 이름 수정</h1></div><form id="ttPackingRenameForm" class="tt-form"><label><span>준비물 이름</span><input id="ttPackingName" required maxlength="200" autocomplete="off"></label><p id="ttPackingRenameError" role="alert"></p></form></div><footer class="tt-sub-footer"><div>${button('취소', 'close')}<button class="tt-button tt-primary" type="submit" form="ttPackingRenameForm">변경 저장</button></div></footer>`);
    $('#ttReservationExtras>div').insertAdjacentHTML('afterbegin', '<label><span>원본 티켓 링크</span><input name="ticketUrl" id="ttReservationTicketUrl" type="url" maxlength="2000" placeholder="https://"></label><div class="tt-form-grid"><label><span>인원</span><input name="guests" id="ttReservationGuests" type="text" inputmode="numeric" maxlength="3"></label><label><span>좌석</span><input name="seats" id="ttReservationSeats" maxlength="200"></label><label><span>운영사 · 항공사</span><input name="operator" id="ttReservationOperator" maxlength="200"></label><label><span>편명 · 열차번호</span><input name="serviceNumber" id="ttReservationService" maxlength="100"></label></div>');
    $('#ttReservationForm .tt-muted').remove();
    window.TripLog.features.travelCompanion.payment.setup($('#ttReservationForm'));
    window.TripLog.features.travelCompanion.tools.setup({ commit });
    $('#ttReservationForm').addEventListener('submit', saveReservation);
    $('#ttReservationForm').addEventListener('invalid', event => { const extra = event.target.closest('details'); if (extra) extra.open = true; }, true);
    $('#ttCompanion').addEventListener('input', event => { if (event.target.id === 'ttWalletSearch') { walletQuery = event.target.value; renderWalletResults(); } });
    $('#ttCompanion').addEventListener('keydown', event => { if (event.target.id === 'ttWalletSearch' && event.key === 'Escape' && walletQuery) { event.preventDefault(); event.stopPropagation(); walletQuery = ''; event.target.value = ''; renderWalletResults(); } });
    document.addEventListener('click', handleClick);
    document.addEventListener('toggle', event => { if (event.target.isConnected && event.target.matches('#ttCompanion .cx-past')) walletPastOpen = event.target.open; }, true);
    document.addEventListener('submit', async event => {
      if (!['ttPackingAdd', 'ttPackingRenameForm'].includes(event.target.id)) return;
      event.preventDefault();
      if (event.target.closest('.tt-dialog')?.tripId !== state.id) return;
      const form = event.target, submit = form.querySelector('[type="submit"]') || document.querySelector('[form="ttPackingRenameForm"]');
      if (form.dataset.saving) return;
      form.dataset.saving = 'true'; if (submit) submit.disabled = true;
      try {
        if (form.id === 'ttPackingAdd') await packingChange('add', undefined, { name: form.elements.name.value.trim() });
        else {
          const item = state.packingList.find(row => row.id === form.dataset.id);
          if (!item || item.name !== form.dataset.original) throw new Error('준비물이 변경됐어요. 다시 열어 주세요.');
          await packingChange('update', item.id, { name: $('#ttPackingName').value.trim() }); $('#ttPackingRename').close();
        }
      } catch (error) { if (form.id === 'ttPackingRenameForm') $('#ttPackingRenameError').textContent = error.message; else showToast(error.message); }
      finally { delete form.dataset.saving; if (submit) submit.disabled = false; }
    });
    document.addEventListener('close', event => {
      if (event.target.id === 'rdExpenseEditor') event.target.classList.remove('cx-quick-expense');
      if (returnContext && ['rdExpenseEditor', 'itineraryEditor', 'itineraryTransitDialog', 'itineraryToolsDialog'].includes(event.target.id)) setTimeout(restoreReturn, 0);
    }, true);
    const refreshClock = async () => {
      if (!isOpen() || !['today', 'wallet'].includes(activeTab)) return;
      if (activeTab === 'today' && !selectedDayManual) {
        const current = M().defaultItineraryDate(state);
        if (current !== selectedDay) {
          selectedDay = current; personal = {}; personalKey = ''; progressUndo = null;
          try { if (!await loadPersonal()) return; } catch (_) { /* A local-storage failure must not show another date's progress. */ }
        }
      }
      if (isOpen()) renderContent();
    };
    setInterval(refreshClock, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshClock(); });
    document.addEventListener('change', async event => {
      if (event.target.closest('.tt-dialog')?.tripId !== state.id) return;
      if (event.target.id === 'ttWalletFilters') { walletFilter = event.target.value; renderWalletResults(); }
      if (event.target.id === 'ttWalletSort') { walletSort = event.target.value; renderWalletResults(); }
      if (event.target.id === 'ttDay') { await changeDay(event.target.value); }
      if (event.target.dataset.ttOption) {
        pocketOptions[event.target.dataset.ttOption] = event.target.checked;
        if (event.target.dataset.ttOption === 'references') pocketOptions.reservations = event.target.checked;
        if ($('#ttOfflineOptions').open) updateOfflinePreview();
      }
      if (event.target.dataset.ttPacking) {
        const id = event.target.dataset.ttPacking;
        if (packingBusy || !state.packingList.some(item => item.id === id)) return;
        const tripId = state.id, checked = event.target.checked;
        packingBusy = true;
        $$('[data-tt-packing]').forEach(input => { input.disabled = true; });
        try { await window.TripLog.features.packing.list.setChecked(id, checked); }
        catch (error) { showToast(error.message); }
        finally {
          packingBusy = false;
          if (state.id === tripId && isOpen() && activeTab === 'tools') {
            renderContent(); $$('[data-tt-packing]').find(input => input.dataset.ttPacking === id)?.focus({ preventScroll: true });
          }
        }
      }
    });
  }
  window.TripLog.register('features.travelCompanion.workspace', { setup, render, open, addReservation });
})();
