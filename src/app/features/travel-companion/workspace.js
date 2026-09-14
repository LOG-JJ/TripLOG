(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const M = () => window.TripLog.features.travelCompanion.model;
  const text = value => M().esc(value);
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const money = value => `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
  const button = (label, action, style = '', extra = '') => `<button type="button" class="tt-button ${style}" data-tt-action="${action}" ${extra}>${label}</button>`;
  const logo = '<img class="tt-logo" src="src/assets/triplog-wordmark.png" alt="TripLOG">';
  const tabs = [['today', '오늘', 'house'], ['review', '점검', 'clipboard-text'], ['wallet', '예약', 'calendar-blank'], ['tools', '도구', 'suitcase']];
  const titles = { today: '오늘의 여행', review: '일정 점검', wallet: '예약 지갑', tools: '여행 도구' };
  let ready = false, activeTab = 'today', selectedDay = '', walletFilter = 'all', openedTrip = '', activePlan = null, editor = null, detailId = '';
  let pocketOptions = { itinerary: true, references: true, budget: false };
  const dateLabel = value => M().validDate(value) ? `${Number(value.slice(5, 7))}.${Number(value.slice(8))} (${'일월화수목금토'[new Date(`${value}T12:00:00Z`).getUTCDay()]})` : '날짜 미정';
  const period = () => `${dateLabel(state.startDate)} – ${dateLabel(state.endDate)}`;
  const notice = (content, kind = 'blue') => `<div class="tt-notice ${kind}" role="status">${icon(kind === 'pink' ? 'warning-circle' : 'info')}<span>${content}</span></div>`;
  const empty = (title, description, action = 'itinerary-new', label = '일정 추가') => `<div class="tt-empty">${icon(action === 'reservation-new' ? 'ticket' : 'calendar-blank')}<h2>${title}</h2><p>${description}</p>${action ? button(label, action, 'tt-primary') : ''}</div>`;
  function createDialog(id, body) {
    const dialog = document.createElement('dialog'); dialog.id = id; dialog.className = 'rd-dialog tt-dialog';
    dialog.setAttribute('aria-labelledby', `${id}Title`);
    dialog.innerHTML = `<header class="tt-header">${logo}${button(icon('x'), 'close', 'tt-icon', 'aria-label="닫기"')}</header>${body}`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      document.documentElement.classList.toggle('rd-modal-open', !!$('dialog[open]'));
      if (dialog === $('#ttReservationEditor')) editor = null;
      const target = dialog.returnFocus?.isConnected ? dialog.returnFocus : $('#ttCompanion')?.open ? $('#ttCompanionTitle') : $('[data-rd-action="companion"]');
      target?.focus({ preventScroll: true });
    });
    return dialog;
  }
  function openDialog(id) {
    const dialog = $(`#${id}`);
    dialog.returnFocus = document.activeElement; dialog.tripId = state.id;
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('rd-modal-open');
    $(`#${id}Title`)?.focus({ preventScroll: true });
  }
  function closeAll() { $$('.tt-dialog[open]').reverse().forEach(dialog => dialog.close()); }
  function commit(patch) {
    const previous = JSON.parse(JSON.stringify(state));
    Object.assign(state, patch); saveAndRender();
    const saved = window.TripLog.persistence.stateStorage.getTrips().find(trip => trip.id === state.id);
    if (!saved || Object.keys(patch).some(key => JSON.stringify(saved[key]) !== JSON.stringify(state[key]))) {
      Object.assign(state, previous); render();
      throw new Error('기기 저장 공간을 확인해 주세요. 변경 내용을 저장하지 못했어요.');
    }
  }
  function companion() { return normalizeTravelCompanion(state.travelCompanion, state.itineraryItems); }
  function open(tab = 'today', filter = 'all') {
    if (!ready) return;
    const dates = M().days(state), today = M().dateInZone(M().defaultZone(state) || undefined);
    if (openedTrip !== state.id || !dates.includes(selectedDay)) selectedDay = dates.includes(today) ? today : dates[0] || '';
    openedTrip = state.id; activeTab = titles[tab] ? tab : 'today'; walletFilter = filter;
    if ($('#rdMore')?.open) $('#rdMore').close();
    renderContent(); openDialog('ttCompanion');
  }
  function hero(review = false) {
    const members = window.TripLog.features.collaboration.tripCollaboration.getTripMembers();
    const team = members.length ? members : [{ name: '나' }, ...(state.companions || [])];
    const isToday = selectedDay === M().dateInZone(M().defaultZone(state) || undefined), count = M().days(state).length;
    return `<section class="tt-card tt-hero ${review ? 'tt-hero-review' : ''}"><div><span class="tt-badge pink">${review ? text(state.tripName || '나의 여행') : isToday ? '여행 중' : '미리보기'}</span>${review ? '' : `<h2>${text(state.tripName || '나의 여행')}</h2>`}<p>${period()} · ${count ? `${Math.max(0, count - 1)}박 ${count}일` : '기간 미정'}</p><div class="tt-members" aria-label="여행 멤버 ${team.length}명">${team.slice(0, 3).map((member, i) => `<span class="tt-avatar tt-avatar-${i}">${text((member.name || '나').slice(0, 2))}</span>`).join('')}<span>${team.length}명</span></div></div><figure>${/서울/.test(state.city || '') ? '<img src="src/assets/seoul-tower.png" alt="">' : icon('suitcase-rolling')}<figcaption>${text([state.city, state.country].filter(Boolean).join(' · ') || '목적지 미정')}</figcaption></figure></section>`;
  }
  function dayStrip() {
    const dates = M().days(state);
    return dates.length ? `<div class="tt-days" aria-label="여행 일자">${dates.map((date, index) => button(`<b>${dateLabel(date)}</b><span>${index + 1}일차</span>`, 'day', date === selectedDay ? 'active' : '', `data-date="${date}" aria-pressed="${date === selectedDay}"`)).join('')}</div>` : notice('여행 정보에서 시작일과 종료일을 설정해 주세요.', 'pink');
  }
  function itineraryRows(items, review = false) {
    const status = M().flags(state), next = items.find(item => !status.completed.has(item.id));
    return `<div class="tt-itinerary">${items.map((item, index) => {
      const done = status.completed.has(item.id), locked = status.locked.has(item.id), highlighted = review ? index === 0 : item.id === next?.id;
      let action;
      if (review) action = button(`${icon(locked ? 'lock-key' : 'lock-key-open')}<span>${locked ? '잠금됨' : '잠금'}</span>`, 'lock', locked ? 'tt-locked' : '', `data-id="${text(item.id)}" aria-label="${text(item.place)} ${locked ? '잠금 해제' : '시간 잠금'}" aria-pressed="${locked}"`);
      else if (done || highlighted) action = button(`${icon(done ? 'check-circle' : 'circle')}<span>${done ? '완료' : '완료하기'}</span>`, 'complete', done ? 'tt-completed' : '', `data-id="${text(item.id)}" aria-label="${text(item.place)} ${done ? '완료 취소' : '완료하기'}" aria-pressed="${done}"`);
      else action = button(`${icon(item.trans === 'walk' ? 'person-simple-walk' : 'bus')}<span>${item.trans === 'walk' ? '도보' : '이동'} ${M().transitMinutes(item, 0) || '미정'}${M().transitMinutes(item, 0) ? '분' : ''}</span>`, 'complete', '', `data-id="${text(item.id)}" aria-label="${text(item.place)} 완료하기" aria-pressed="false"`);
      return `<article class="tt-stop ${highlighted ? 'is-next' : ''} ${done ? 'is-done' : ''}">${!review && highlighted ? '<span class="tt-next-badge">다음 장소</span>' : ''}<button type="button" class="tt-stop-main" data-tt-action="itinerary-edit" data-id="${text(item.id)}" aria-label="${text(item.place)} 일정 상세"><span class="tt-time"><b>${text(item.time || '미정')}</b><span>${item.endTime ? '– ' + text(item.endTime) : '종료 미정'}</span></span><span class="tt-place"><strong>${text(item.place || '여행 일정')}</strong><small>${icon('map-pin')} ${text(item.location || state.city || '장소 미정')}</small></span></button>${action}</article>`;
    }).join('')}</div>`;
  }
  function todayContent() {
    const data = M().today(state, selectedDay), budget = M().dailyBudget(state, selectedDay);
    return `${hero()}${dayStrip()}${data.items.length ? `<section class="tt-card tt-progress"><div class="tt-section-head"><h2>오늘의 일정</h2><span>${data.completed} / ${data.items.length}개 완료</span></div><div class="tt-progress-line"><progress max="100" value="${data.percent}" aria-label="일정 완료율"></progress><b>${data.percent}%</b></div></section>${itineraryRows(data.items)}` : empty('아직 일정이 없어요', '이날 가고 싶은 장소를 추가해 보세요.')}<section class="tt-card tt-budget"><div class="tt-section-head"><h2>하루 가용 예산</h2>${button(`자세히 보기 ${icon('caret-right')}`, 'budget-info', 'tt-text')}</div>${budget.configured ? `<div class="tt-budget-amount"><strong>${money(Math.max(0, budget.remaining))}</strong><span>/ ${money(budget.allowance)}</span></div><div class="tt-progress-line"><progress max="100" value="${budget.percent}" aria-label="하루 가용 예산 잔여율"></progress><b>${budget.percent}%</b></div><p>${budget.remaining < 0 ? `오늘 배정액보다 ${money(-budget.remaining)} 더 사용했어요` : `오늘 사용 ${money(budget.used)}`}</p>` : `<p>여행 예산을 설정하면 오늘 쓸 수 있는 금액을 계산해요.</p>${button('여행 예산 설정', 'budget-settings', 'tt-text')}`}</section>`;
  }
  function reviewContent() {
    const items = M().dayItems(state, selectedDay), issues = M().reviewDay(state, selectedDay), outside = M().outsideItems(state);
    return `${hero(true)}${dayStrip()}${notice(`<strong>${issues.length ? `확인할 항목 ${issues.length}개` : items.length ? '여유 있게 움직일 수 있어요' : '일정을 추가해 주세요'}</strong><small>${issues.length ? '시간과 이동 간격을 확인해 주세요.' : '입력한 시간과 이동 시간으로 점검했어요.'}</small>`, issues.length ? 'pink' : 'blue')}${issues.map(issue => button(`<span class="tt-issue-icon ${issue.type === 'transit' ? 'yellow' : 'pink'}">${icon(issue.type === 'transit' ? 'car' : 'clock')}</span><span><strong>${text(issue.title)}</strong><small>${text(issue.detail)}</small></span>${icon('caret-right')}`, 'itinerary-edit', 'tt-issue', `data-id="${text(issue.id)}"`)).join('')}${outside.length ? button(`${icon('calendar-x')} 여행 기간 밖 일정 ${outside.length}개 확인`, 'itinerary-all', 'tt-notice pink') : ''}${items.length ? `<div class="tt-section-head tt-list-title"><h2>오늘의 일정</h2><span>${items.length}개</span></div>${itineraryRows(items, true)}` : empty('점검할 일정이 없어요', '일정을 만들면 겹치는 시간을 알려드려요.')}${state.travelCompanion?.lastAdjustment ? button(`${icon('arrow-counter-clockwise')} 마지막 시간 조정 되돌리기`, 'undo', 'tt-undo') : ''}`;
  }
  function walletCard(row) {
    const type = M().types[row.type];
    const date = `${dateLabel(row.date)}${row.time ? ' ' + row.time : ''}${row.type === 'stay' && M().validDate(row.endDate) ? ` – ${dateLabel(row.endDate)} · ${Math.round((Date.parse(row.endDate) - Date.parse(row.date)) / 86400000)}박` : ''}`;
    return `<article class="tt-card tt-reservation"><button type="button" class="tt-reservation-main" data-tt-action="reservation-detail" data-id="${text(row.id)}"><span class="tt-reservation-icon ${type.color}">${icon(type.icon)}</span><span><span class="tt-type ${type.color}">${type.label}</span><strong>${text(row.title)}</strong><small>${text(date)}</small><small>${text(row.location || (row.source === 'itinerary' ? '일정에 연결된 예약' : '장소 미입력'))}</small></span>${icon('caret-right')}</button><div class="tt-reference"><span>예약번호</span><b>${text(row.reference || '미입력')}</b>${button(`${icon('copy')} 복사`, 'copy', '', `data-id="${text(row.id)}" aria-label="${text(row.title)} 예약번호 복사" ${row.reference ? '' : 'disabled'}`)}</div></article>`;
  }
  function walletContent() {
    const all = M().reservations(state), matching = all.filter(row => walletFilter === 'all' || row.type === walletFilter);
    return `<div class="tt-filters" aria-label="예약 종류">${[['all', '전체'], ['transport', '교통'], ['stay', '숙소'], ['activity', '입장권']].map(([key, label]) => button(label, 'wallet-filter', key === walletFilter ? 'active' : '', `data-filter="${key}" aria-pressed="${key === walletFilter}"`)).join('')}</div><div class="tt-wallet-list">${matching.length ? matching.map(walletCard).join('') : empty(all.length ? '이 종류의 예약이 없어요' : '예약을 한곳에 모아 보세요', '항공·숙소 사전구매와 일정의 입장권도 여기에 표시돼요.', 'reservation-new', '예약 추가')}</div>`;
  }
  function zoneOptions() {
    const popular = [['Asia/Seoul', '한국'], ['Asia/Tokyo', '일본'], ['Asia/Shanghai', '중국'], ['Asia/Taipei', '대만'], ['Asia/Bangkok', '태국'], ['Asia/Singapore', '싱가포르'], ['Asia/Ho_Chi_Minh', '베트남'], ['Europe/London', '영국'], ['Europe/Paris', '프랑스 파리'], ['America/New_York', '미국 뉴욕'], ['America/Los_Angeles', '미국 로스앤젤레스'], ['Pacific/Honolulu', '하와이'], ['Australia/Sydney', '호주 시드니'], ['UTC', '협정 세계시']];
    const map = new Map(popular); let rest = [];
    try { rest = Intl.supportedValuesOf('timeZone'); } catch { rest = ['Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Kolkata', 'Asia/Manila', 'Europe/Rome', 'Europe/Berlin', 'America/Chicago', 'America/Denver', 'Pacific/Auckland']; }
    const zone = M().defaultZone(state); if (zone && !map.has(zone) && !rest.includes(zone)) rest.unshift(zone);
    return `<option value="">여행지의 시간대를 선택하세요</option>${[...popular, ...rest.filter(value => !map.has(value)).map(value => [value, ''])].map(([value, label]) => `<option value="${value}" ${value === zone ? 'selected' : ''}>${value}${label ? ' · ' + label : ''}</option>`).join('')}`;
  }
  function toolsContent() {
    const packing = state.packingList || [];
    return `<label class="tt-card tt-zone"><strong>일정 시간대</strong><select id="ttTimeZone" aria-label="일정 시간대">${zoneOptions()}</select></label><section class="tt-card tt-tool-card"><span class="tt-tool-icon">${icon('calendar-check')}</span><div><h2>캘린더에 일정 추가</h2><p>여행 일정을 휴대폰 캘린더로</p><div class="tt-export-row"><span>${state.itineraryItems.length}개 일정</span>${button('ICS 내보내기', 'calendar', '', state.itineraryItems.length ? '' : 'disabled')}</div><p id="ttExportHelp" class="tt-export-help" role="status" hidden>iPhone에서는 다운로드한 ICS를 Mail 첨부파일로 열어 캘린더에 추가하세요. <a href="https://support.apple.com/guide/iphone/ipha0d932e96/ios" target="_blank" rel="noopener noreferrer">Apple 사용 안내</a></p></div></section><section class="tt-card tt-tool-card tt-pocket"><span class="tt-tool-icon">${icon('suitcase')}</span><div><h2>오프라인 포켓노트</h2><p>인터넷 없이 일정과 예약을 확인해요</p><div class="tt-checks">${[['itinerary', '일정 포함'], ['references', '예약번호 포함'], ['budget', '예산 포함']].map(([key, label]) => `<label><input type="checkbox" data-tt-option="${key}" ${pocketOptions[key] ? 'checked' : ''}>${label}</label>`).join('')}</div></div><p class="tt-pocket-note">${icon('info')} 기기에 저장한 파일에서 열어보세요</p></section>${button(`${icon('list-checks')}<strong>출발 준비물</strong><span>${packing.filter(item => item.checked).length} / ${packing.length}개 완료</span>${icon('caret-right')}`, 'packing', 'tt-card tt-packing')}`;
  }
  function renderContent() {
    const panel = $('#ttCompanion'); if (!panel) return;
    panel.dataset.tab = activeTab;
    const scroll = $('.tt-scroll', panel), previousScroll = scroll.scrollTop;
    $('#ttCompanionTitle').textContent = titles[activeTab];
    $('#ttCompanionSubtitle').textContent = activeTab === 'today' ? '오늘의 일정과 다음 장소를 확인하세요' : activeTab === 'review' ? '일정을 점검하고 조정할 부분을 확인하세요' : `${state.tripName || '나의 여행'} · ${period()}`;
    $('#ttContent').innerHTML = ({ today: todayContent, review: reviewContent, wallet: walletContent, tools: toolsContent })[activeTab]();
    const data = M().today(state, selectedDay);
    $('#ttPrimary').innerHTML = activeTab === 'today' ? data.next ? `<a class="tt-button tt-primary" href="${text(M().directions(data.next, state))}" target="_blank" rel="noopener noreferrer">다음 장소 길찾기 ${icon('caret-right')}</a>` : button(`${data.items.length ? '오늘 일정 완료 · 일정 보기' : '첫 일정 추가'} ${icon('caret-right')}`, data.items.length ? 'itinerary-day' : 'itinerary-new', 'tt-primary') : activeTab === 'review' ? button(`시간 조정하기 ${icon('caret-right')}`, 'adjustment', 'tt-primary', M().dayItems(state, selectedDay).length ? '' : 'disabled') : activeTab === 'wallet' ? button(`예약 추가 ${icon('caret-right')}`, 'reservation-new', 'tt-primary') : button(`포켓노트 저장 ${icon('caret-right')}`, 'pocket', 'tt-primary');
    $('#ttNav').innerHTML = tabs.map(([key, label, glyph]) => button(`${icon(glyph)}<span>${label}</span>`, 'tab', key === activeTab ? 'active' : '', `data-tab="${key}" ${key === activeTab ? 'aria-current="page"' : ''}`)).join('');
    scroll.scrollTop = previousScroll;
    $('.tt-days .active', panel)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function render() {
    if (!ready) return;
    if (openedTrip && openedTrip !== state.id) { closeAll(); openedTrip = ''; selectedDay = ''; editor = null; activePlan = null; }
    if ($('#ttCompanion').open) {
      if (!M().days(state).includes(selectedDay)) selectedDay = M().days(state)[0] || '';
      renderContent();
    }
  }
  function showAdjustment() {
    $('#ttAdjustmentError').textContent = '';
    $('#ttAdjustmentDate').textContent = `${dateLabel(selectedDay)} · 이동 시간까지 반영해요`;
    $('#ttFallback').value = '10'; $('#ttDelay').value = '0';
    updateAdjustment(); openDialog('ttAdjustment');
  }
  function updateAdjustment() {
    const delay = Number($('#ttDelay').value), fallback = Number($('#ttFallback').value);
    $$('#ttDelayChips button').forEach(el => { el.classList.toggle('active', Number(el.dataset.delay) === delay); el.setAttribute('aria-pressed', String(Number(el.dataset.delay) === delay)); });
    activePlan = M().planAdjustment(state, selectedDay, delay, fallback);
    const issues = activePlan.errors;
    $('#ttAdjustmentResult').innerHTML = `<h2>시간 조정 결과</h2>${activePlan.changes.map((change, index) => `<div class="tt-adjust-row"><span class="tt-step tt-avatar-${index % 3}">${index + 1}</span><span><b>${text(change.place)}</b><small>${change.beforeTime} – ${change.beforeEndTime}</small></span>${icon('arrow-right')}<strong>${change.time} – ${change.endTime}</strong></div>`).join('')}${issues.length ? notice(issues.map(text).join('<br>'), 'pink') : notice(activePlan.changes.length ? '겹치는 일정 없이 조정할 수 있어요' : '변경할 시간이 없어요. 현재 일정을 유지해요.')}`;
    $('#ttApply').disabled = !!issues.length || !activePlan.changes.length;
    $('#ttApply').textContent = `${activePlan.changes.length}개 일정에 적용`;
  }
  function openReservationEditor(row) {
    const source = row?.source === 'manual' ? companion().reservations.find(item => item.id === row.sourceId) : null;
    editor = { tripId: state.id, id: source?.id || '', signature: JSON.stringify(source || null) };
    const form = $('#ttReservationForm'); form.reset();
    $('#ttReservationEditorTitle').textContent = source ? '예약 수정' : '예약 추가';
    const values = { type: source?.type || (walletFilter === 'all' ? 'transport' : walletFilter), title: source?.title || '', date: source?.date || selectedDay || state.startDate, endDate: source?.endDate || state.endDate, time: source?.time || '', reference: source?.reference || '', location: source?.location || '', url: source?.url || '', note: source?.note || '' };
    Object.entries(values).forEach(([key, value]) => { form.elements.namedItem(key).value = value; });
    $('#ttReservationError').textContent = ''; updateReservationType(); openDialog('ttReservationEditor');
  }
  function updateReservationType() {
    const type = $('#ttReservationForm').elements.namedItem('type').value, stay = type === 'stay';
    $$('#ttReservationTypes button').forEach(el => { el.classList.toggle('active', el.dataset.type === type); el.setAttribute('aria-pressed', String(el.dataset.type === type)); });
    $('#ttReservationDateLabel').textContent = stay ? '체크인' : '예약 일자';
    $('#ttReservationEndField').hidden = !stay; $('#ttReservationTimeField').hidden = stay;
    $('#ttReservationEnd').required = stay;
  }
  function saveReservation(event) {
    event.preventDefault();
    try {
      if (!editor || editor.tripId !== state.id) throw new Error('여행이 변경됐어요. 예약 창을 다시 열어 주세요.');
      const current = companion(), existing = current.reservations.find(row => row.id === editor.id);
      if (JSON.stringify(existing || null) !== editor.signature) throw new Error('예약이 다른 곳에서 수정됐어요. 창을 다시 열어 주세요.');
      const data = Object.fromEntries(new FormData(event.target));
      Object.keys(data).forEach(key => { data[key] = String(data[key]).trim(); });
      if (data.type !== 'stay') data.endDate = ''; else data.time = '';
      const problem = M().validateReservation(data); if (problem) throw new Error(problem);
      const row = { ...data, id: editor.id || createId() };
      current.reservations = existing ? current.reservations.map(item => item.id === row.id ? row : item) : [...current.reservations, row];
      commit({ travelCompanion: current });
      $('#ttReservationEditor').close();
      if ($('#ttReservationDetail').open) showReservationDetail(`manual:${row.id}`, false);
      showToast('예약을 저장했어요.');
    } catch (error) { $('#ttReservationError').textContent = error.message; }
  }
  function showReservationDetail(id, openModal = true) {
    const row = M().reservations(state).find(item => item.id === id); if (!row) return;
    detailId = id;
    const type = M().types[row.type], link = M().safeUrl(row.url);
    $('#ttReservationDetailTitle').textContent = row.title;
    $('#ttReservationDetailBody').innerHTML = `<span class="tt-type ${type.color}">${type.label}</span><dl class="tt-detail-list"><dt>예약 일자</dt><dd>${dateLabel(row.date)}${row.endDate ? ' – ' + dateLabel(row.endDate) : ''}${row.time ? ' · ' + row.time : ''}</dd><dt>예약번호</dt><dd><code>${text(row.reference || '미입력')}</code>${row.reference ? button(`${icon('copy')} 복사`, 'copy', '', `data-id="${text(id)}"`) : ''}</dd><dt>주소 · 장소</dt><dd>${text(row.location || '미입력')}</dd>${row.note ? `<dt>메모</dt><dd class="tt-prewrap">${text(row.note)}</dd>` : ''}</dl>${link ? `<a class="tt-button tt-detail-link" href="${text(link)}" target="_blank" rel="noopener noreferrer">예약 사이트 열기 ${icon('arrow-up-right')}</a>` : ''}${row.attachment ? button(`${icon('file')} 저장한 입장권 열기`, 'attachment', 'tt-detail-link', `data-id="${text(id)}"`) : ''}<p class="tt-muted">${row.source === 'manual' ? '예약 지갑에 직접 저장한 정보예요.' : row.source === 'entry' ? '사전구매 지출에 저장한 예약이에요.' : '일정에 저장한 예약이에요.'}</p>${row.source === 'manual' ? `<div class="tt-detail-actions">${button(`${icon('pencil-simple')} 수정`, 'reservation-edit', '', `data-id="${text(id)}"`)}${button(`${icon('trash')} 삭제`, 'reservation-delete', 'tt-danger', `data-id="${text(id)}"`)}</div>` : button(row.source === 'entry' ? '원본 지출 보기' : '연결된 일정 보기', 'reservation-source', 'tt-detail-link', `data-id="${text(id)}"`)}`;
    $('#ttReservationDetailFooter').innerHTML = button(`${icon('calendar-plus')} ${row.source === 'itinerary' || state.itineraryItems.some(item => item.linkedReservationId === row.id) ? '연결된 일정 보기' : '일정에 추가'}`, 'reservation-link', 'tt-primary', `data-id="${text(id)}"`);
    if (openModal) openDialog('ttReservationDetail');
  }
  function editItinerary(item) {
    if (!item) return;
    closeAll(); state.selectedItineraryDate = item.date;
    window.TripLog.features.redesign.workspace.navigate('itinerary'); startItineraryEdit(item);
  }
  function linkReservation(row) {
    if (row.source === 'itinerary') { editItinerary(findItineraryItem(row.sourceId)); return; }
    const linked = state.itineraryItems.find(item => item.linkedReservationId === row.id);
    if (linked) { editItinerary(linked); return; }
    if (!M().days(state).includes(row.date)) throw new Error('예약 일자가 여행 기간 밖에 있어요. 예약 또는 여행 일자를 먼저 수정해 주세요.');
    const item = { id: createId(), date: row.date, time: row.time || '', endTime: '', place: row.title, location: row.location || '', memo: row.note || '', theme: row.type === 'stay' ? 'lodging' : row.type === 'transport' ? 'transport' : 'sightseeing', trans: 'none', transits: [], duration: 0, cost: 0, voucherName: row.title, voucherCode: row.reference || '', linkedReservationId: row.id, createdAt: Date.now() };
    commit({ itineraryItems: [...state.itineraryItems, item] }); editItinerary(item); showToast('일정에 추가했어요. 방문 시간을 설정해 주세요.');
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
  async function handleClick(event) {
    const target = event.target.closest('[data-tt-action]'); if (!target) return;
    const action = target.dataset.ttAction, id = target.dataset.id;
    if (target.closest('.tt-dialog')?.tripId !== state.id) return;
    try {
      switch (action) {
        case 'close': target.closest('dialog')?.close(); break;
        case 'tab': activeTab = target.dataset.tab; renderContent(); $('.tt-scroll', $('#ttCompanion')).scrollTop = 0; $('#ttCompanionTitle').focus({ preventScroll: true }); break;
        case 'day': selectedDay = target.dataset.date; renderContent(); $$('.tt-days button').find(el => el.dataset.date === selectedDay)?.focus({ preventScroll: true }); break;
        case 'complete': case 'lock': {
          if (!findItineraryItem(id)) break;
          const next = companion(), key = action === 'complete' ? 'completedItineraryIds' : 'lockedItineraryIds';
          const values = new Set(next[key]); if (values.has(id)) values.delete(id); else values.add(id); next[key] = [...values];
          commit({ travelCompanion: next });
          $$(`[data-tt-action="${action}"]`).find(el => el.dataset.id === id)?.focus({ preventScroll: true });
          break;
        }
        case 'itinerary-edit': editItinerary(findItineraryItem(id)); break;
        case 'itinerary-new': closeAll(); state.selectedItineraryDate = selectedDay || state.startDate; window.TripLog.features.redesign.workspace.navigate('itinerary'); window.TripLog.features.itinerary.workspace.show(); break;
        case 'itinerary-day': case 'itinerary-all': closeAll(); state.selectedItineraryDate = action === 'itinerary-all' ? 'all' : selectedDay; window.TripLog.features.redesign.workspace.navigate('itinerary'); saveAndRender(); break;
        case 'budget-settings': closeAll(); window.TripLog.features.redesign.workspace.navigate('start'); $('#budgetInput')?.focus(); break;
        case 'budget-info': { const data = M().dailyBudget(state, selectedDay); $('#ttBudgetInfoBody').innerHTML = `<p>오늘 이전에 기록한 지출과 사전구매를 전체 예산에서 뺀 뒤, 남은 ${data.remainingDays}일로 나눠 계산해요.</p><dl class="tt-detail-list"><dt>오늘 배정액</dt><dd>${money(data.allowance)}</dd><dt>오늘 기록한 지출</dt><dd>${money(data.used)}</dd><dt>오늘 남은 금액</dt><dd>${money(data.remaining)}</dd></dl><p class="tt-muted">지출을 기록할수록 가용 금액이 바뀝니다. 다른 멤버의 별도 지출은 포함하지 않아요.</p>`; openDialog('ttBudgetInfo'); break; }
        case 'adjustment': showAdjustment(); break;
        case 'delay': $('#ttDelay').value = target.dataset.delay; updateAdjustment(); break;
        case 'apply': commit(M().applyAdjustment(state, activePlan)); $('#ttAdjustment').close(); showToast('일정 시간을 조정했어요. 점검 화면에서 되돌릴 수 있어요.'); break;
        case 'undo': commit(M().undoAdjustment(state)); showToast('시간 조정을 되돌렸어요.'); break;
        case 'wallet-filter': walletFilter = target.dataset.filter; renderContent(); $$('.tt-filters button').find(el => el.dataset.filter === walletFilter)?.focus({ preventScroll: true }); break;
        case 'reservation-new': openReservationEditor(); break;
        case 'reservation-type': $('#ttReservationForm').elements.namedItem('type').value = target.dataset.type; updateReservationType(); break;
        case 'reservation-detail': showReservationDetail(id); break;
        case 'reservation-edit': openReservationEditor(M().reservations(state).find(row => row.id === id)); break;
        case 'reservation-delete': {
          const tripId = state.id, row = companion().reservations.find(item => `manual:${item.id}` === id), before = JSON.stringify(row);
          if (row && await window.TripLog.features.redesign.workspace.confirmAction(`‘${row.title}’ 예약을 삭제할까요? 연결한 일정과 지출은 유지됩니다.`) && tripId === state.id) {
            const current = companion(); if (JSON.stringify(current.reservations.find(item => item.id === row.id)) !== before) throw new Error('예약이 변경됐어요. 다시 확인해 주세요.');
            current.reservations = current.reservations.filter(item => item.id !== row.id); commit({ travelCompanion: current }); $('#ttReservationDetail').close(); showToast('예약을 삭제했어요.');
          } break;
        }
        case 'copy': { const row = M().reservations(state).find(item => item.id === id); if (row?.reference) { try { await navigator.clipboard.writeText(row.reference); showToast('예약번호를 복사했어요.'); } catch { $('#ttCopyValue').value = row.reference; openDialog('ttCopy'); $('#ttCopyValue').focus(); $('#ttCopyValue').select(); } } break; }
        case 'reservation-source': { const row = M().reservations(state).find(item => item.id === id); if (row?.source === 'entry') { closeAll(); window.TripLog.features.redesign.workspace.navigate('budget'); startEdit(findEntry(row.sourceId)); } else if (row) editItinerary(findItineraryItem(row.sourceId)); break; }
        case 'reservation-link': { const row = M().reservations(state).find(item => item.id === id); if (row) linkReservation(row); break; }
        case 'attachment': { const row = M().reservations(state).find(item => item.id === id), item = findItineraryItem(row?.sourceId); if (item) window.TripLog.features.itinerary.workspace.downloadTicket(item); break; }
        case 'calendar': { const zone = $('#ttTimeZone').value; if (!zone) throw new Error('먼저 여행지의 일정 시간대를 선택해 주세요.'); const content = M().createCalendar(state, zone); download(content, fileName('여행일정.ics'), 'text/calendar;charset=utf-8'); $('#ttExportHelp').hidden = false; showToast('ICS 파일을 만들었어요. 화면의 가져오기 안내를 확인해 주세요.'); break; }
        case 'pocket': target.disabled = true; try { await savePocket(); } finally { target.disabled = false; } break;
        case 'packing': closeAll(); $('#itineraryToolsDialog').showModal(); document.documentElement.classList.add('rd-modal-open'); break;
      }
    } catch (error) {
      if ($('#ttAdjustment')?.open) $('#ttAdjustmentError').textContent = error.message;
      else if ($('#ttCompanion')?.open) $('#ttStatus').textContent = error.message;
      showToast(error.message || '처리하지 못했어요. 다시 시도해 주세요.');
    }
  }
  function setup() {
    if (ready) return; ready = true;
    createDialog('ttCompanion', '<div class="tt-scroll"><div class="tt-heading"><h1 id="ttCompanionTitle" tabindex="-1"></h1><p id="ttCompanionSubtitle"></p></div><div id="ttContent"></div><p id="ttStatus" role="alert"></p></div><footer class="tt-footer"><div id="ttPrimary"></div><nav id="ttNav" aria-label="여행 동행 도구"></nav></footer>');
    createDialog('ttAdjustment', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttAdjustmentTitle" tabindex="-1">시간 조정 미리보기</h1><p id="ttAdjustmentDate"></p></div>${notice('완료한 일정과 잠긴 시간은 유지돼요', 'pink')}<section class="tt-card tt-adjust-controls"><h2 id="ttDelayLabel">얼마나 늦어졌나요?</h2><div id="ttDelayChips" class="tt-filters" role="group" aria-labelledby="ttDelayLabel">${[0, 15, 30, 60].map(value => button(`${value}분`, 'delay', '', `data-delay="${value}"`)).join('')}</div><input id="ttDelay" type="hidden" value="0"><div class="tt-number-fields"><label><span>이동 시간이 없으면 (분)</span><input id="ttFallback" type="number" min="0" max="180" step="1" value="10" inputmode="numeric"></label></div></section><section id="ttAdjustmentResult" class="tt-card"></section><p id="ttAdjustmentError" role="alert"></p></div><footer class="tt-sub-footer"><div>${button('취소', 'close')}<button type="button" class="tt-button tt-primary" data-tt-action="apply" id="ttApply"></button></div><p>적용한 뒤 한 번 되돌릴 수 있어요</p></footer>`);
    createDialog('ttReservationEditor', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttReservationEditorTitle" tabindex="-1">예약 추가</h1><p>예약 정보를 한곳에 보관하세요</p></div><form id="ttReservationForm" class="tt-form"><input type="hidden" name="type" value="transport"><div id="ttReservationTypes" class="tt-filters">${Object.entries({ transport: '교통', stay: '숙소', activity: '입장권', other: '기타' }).map(([type, label]) => button(label, 'reservation-type', '', `data-type="${type}"`)).join('')}</div><label><span>예약 이름</span><input name="title" required maxlength="200" autocomplete="off" placeholder="예: 종로 스테이"></label><div class="tt-form-grid"><label><span id="ttReservationDateLabel">예약 일자</span><input name="date" type="date" required></label><label id="ttReservationEndField"><span>체크아웃</span><input name="endDate" id="ttReservationEnd" type="date"></label><label id="ttReservationTimeField"><span>예약 시간 (선택)</span><input name="time" type="time"></label></div><label><span>예약번호</span><input name="reference" maxlength="300" autocomplete="off" autocapitalize="off" spellcheck="false"></label><label><span>주소 · 장소</span><input name="location" maxlength="600" autocomplete="off"></label><label><span>예약 링크 (선택)</span><input name="url" type="url" maxlength="2000" placeholder="https://" autocomplete="off"></label><label><span>메모 (선택)</span><textarea name="note" maxlength="3000" rows="3"></textarea></label><p class="tt-muted">${icon('info')} 지출에는 자동으로 추가되지 않아요</p><p id="ttReservationError" role="alert"></p></form></div><footer class="tt-sub-footer"><div>${button('취소', 'close')}<button type="submit" form="ttReservationForm" class="tt-button tt-primary">예약 저장</button></div></footer>`);
    createDialog('ttReservationDetail', '<div class="tt-scroll"><div class="tt-heading"><h1 id="ttReservationDetailTitle" tabindex="-1"></h1></div><div id="ttReservationDetailBody"></div></div><footer class="tt-sub-footer" id="ttReservationDetailFooter"></footer>');
    createDialog('ttBudgetInfo', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttBudgetInfoTitle" tabindex="-1">하루 예산 계산</h1></div><div id="ttBudgetInfoBody"></div></div><footer class="tt-sub-footer">${button('확인', 'close', 'tt-primary')}</footer>`);
    createDialog('ttCopy', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttCopyTitle" tabindex="-1">예약번호 복사</h1><p>선택한 예약번호를 길게 눌러 복사하거나 Ctrl+C를 누르세요.</p></div><input id="ttCopyValue" class="tt-copy-value" readonly aria-label="복사할 예약번호"></div><footer class="tt-sub-footer">${button('완료', 'close', 'tt-primary')}</footer>`);
    $('#ttReservationForm').addEventListener('submit', saveReservation);
    document.addEventListener('click', handleClick);
    ['ttDelay', 'ttFallback'].forEach(id => $(`#${id}`).addEventListener('input', () => { $('#ttAdjustmentError').textContent = ''; updateAdjustment(); }));
    document.addEventListener('change', event => {
      if (event.target.dataset.ttOption) pocketOptions[event.target.dataset.ttOption] = event.target.checked;
      if (event.target.id === 'ttTimeZone') { const next = companion(); next.timeZone = event.target.value; try { commit({ travelCompanion: next }); $('#ttTimeZone')?.focus({ preventScroll: true }); } catch (error) { showToast(error.message); } }
    });
  }
  window.TripLog.register('features.travelCompanion.workspace', { setup, render, open });
})();
