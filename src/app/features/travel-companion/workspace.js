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
  let walletQuery = '', walletSort = 'date';
  let packingBusy = false;
  const foldStates = new Map();
  const walletFilters = [['all', '전체'], ['transport', '교통'], ['stay', '숙소'], ['activity', '입장권'], ['other', '기타']];
  let pocketOptions = { itinerary: true, references: true, budget: false };
  const dateLabel = value => M().validDate(value) ? `${Number(value.slice(5, 7))}.${Number(value.slice(8))} (${'일월화수목금토'[new Date(`${value}T12:00:00Z`).getUTCDay()]})` : '날짜 미정';
  const period = () => `${dateLabel(state.startDate)} – ${dateLabel(state.endDate)}`;
  const notice = (content, kind = 'blue') => `<div class="tt-notice ${kind}" role="status">${icon(kind === 'pink' ? 'warning-circle' : 'info')}<span>${content}</span></div>`;
  const empty = (title, description, action = 'itinerary-new', label = '일정 추가') => `<div class="tt-empty">${icon(action === 'reservation-new' ? 'ticket' : 'calendar-blank')}<h2>${title}</h2><p>${description}</p>${action ? button(label, action, 'tt-primary') : ''}</div>`;
  function createDialog(id, body) {
    const dialog = document.createElement('dialog'); dialog.id = id; dialog.className = 'rd-dialog tt-dialog';
    if (['ttReservationEditor', 'ttReservationDetail', 'ttCopy'].includes(id)) dialog.classList.add('tt-wallet-ui');
    if (['ttAdjustment', 'ttBudgetInfo'].includes(id)) dialog.classList.add('tt-passport-detail');
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
  async function commit(patch) {
    const previous = JSON.parse(JSON.stringify(state));
    Object.assign(state, patch);
    const saved = await saveAndRender();
    if (!saved) {
      if (state.id === previous.id) { Object.assign(state, previous); render(); }
      throw new Error('기기 저장 공간을 확인해 주세요. 변경 내용을 저장하지 못했어요.');
    }
    if (state.id !== previous.id) throw new Error('원래 여행에 저장했습니다. 현재 여행 화면을 확인해 주세요.');
  }
  function companion() { return normalizeTravelCompanion(state.travelCompanion, state.itineraryItems); }
  function open(tab = 'today', filter = 'all') {
    if (!ready) return;
    const dates = M().days(state), today = M().dateInZone(M().defaultZone(state) || undefined);
    if (openedTrip !== state.id || !dates.includes(selectedDay)) selectedDay = dates.includes(today) ? today : dates[0] || '';
    openedTrip = state.id; activeTab = titles[tab] ? tab : 'today';
    walletFilter = walletFilters.some(([key]) => key === filter) ? filter : 'all';
    walletQuery = ''; walletSort = 'date';
    if ($('#rdMore')?.open) $('#rdMore').close();
    renderContent(); $('.tt-scroll', $('#ttCompanion')).scrollTop = 0; openDialog('ttCompanion');
  }
  function hero() {
    const members = window.TripLog.features.collaboration.tripCollaboration.getTripMembers();
    const team = members.length ? members : [{ name: '나' }, ...(state.companions || [])];
    const isToday = selectedDay === M().dateInZone(M().defaultZone(state) || undefined), count = M().days(state).length;
    return `<section class="tt-card tt-hero"><div><div class="pp-hero-top"><span class="tt-badge pink">${isToday ? '여행 중' : '미리보기'}</span><p>${period()} · ${count ? `${Math.max(0, count - 1)}박 ${count}일` : '기간 미정'}</p></div><h2>${text(state.tripName || '나의 여행')}</h2><div class="tt-members" aria-label="여행 멤버 ${team.length}명">${team.slice(0, 3).map((member, i) => `<span class="tt-avatar tt-avatar-${i}">${text((member.name || '나').slice(0, 2))}</span>`).join('')}<span>${team.length}명</span></div></div><figure>${/서울/.test(state.city || '') ? '<img src="src/assets/seoul-tower.png" alt="">' : icon('suitcase-rolling')}<figcaption>${text([state.city, state.country].filter(Boolean).join(' · ') || '목적지 미정')}</figcaption></figure></section>`;
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
      return `<article class="tt-stop ${highlighted ? 'is-next' : ''} ${done ? 'is-done' : ''}">${!review && highlighted ? '<span class="tt-next-badge">다음 장소</span>' : ''}<button type="button" class="tt-stop-main" data-tt-action="itinerary-edit" data-id="${text(item.id)}" aria-label="${text(item.place)} 일정 상세"><span class="tt-time"><b>${text(item.time || '미정')}</b><span>${item.theme === 'lodging' ? '숙소 도착' : item.endTime ? '– ' + text(item.endTime) : '종료 미정'}</span></span><span class="tt-place"><strong>${text(item.place || '여행 일정')}</strong><small>${icon('map-pin')} ${text(item.location || state.city || '장소 미정')}</small></span></button>${action}</article>`;
    }).join('')}</div>`;
  }
  function todayContent() {
    const data = M().today(state, selectedDay), budget = M().dailyBudget(state, selectedDay);
    const completed = M().flags(state).completed;
    const finished = data.items.filter(item => completed.has(item.id));
    const remaining = data.items.filter(item => !completed.has(item.id) && item.id !== data.next?.id);
    const next = data.next;
    const ticket = next ? `<section class="pp-next-pass" aria-label="다음 장소">
      <div class="pp-pass-caption"><span>NEXT STOP</span><b>${String(data.items.indexOf(next) + 1).padStart(2, '0')}<small> / ${String(data.items.length).padStart(2, '0')}</small></b></div>
      <div class="pp-pass-rule" aria-hidden="true">${icon('airplane-tilt')}</div>
      <div class="pp-pass-place"><div><time>${text(next.time || '시각 미정')}</time>${button(`<strong>${text(next.place || '장소 미정')}</strong>`, 'itinerary-edit', `pp-place-title${(next.place || '').length > 16 ? ' is-long' : (next.place || '').length > 8 ? ' is-medium' : ''}`, `data-id="${text(next.id)}" aria-label="${text(next.place || '다음 장소')} 일정 상세"`)}<p>${icon('map-pin')}<span>${text(next.location || [state.city, state.country].filter(Boolean).join(' · ') || '장소를 입력해 주세요')}</span></p></div><img class="pp-pass-sketch" src="src/assets/companion-passport-sketch.png" alt="" width="135" height="110"></div>
      <div id="ttPassportPrimarySlot"></div><div class="pp-pass-bottom"><span>${data.completed} / ${data.items.length}개 완료</span>${button(`${icon('check-circle')} 방문 완료`, 'complete', 'pp-complete-next', `data-id="${text(next.id)}" aria-label="${text(next.place)} 완료하기" aria-pressed="false"`)}</div>
    </section>` : data.items.length ? `<section class="pp-day-complete">${icon('check-circle')}<h2>오늘의 여정을 모두 마쳤어요</h2><p>${data.items.length}개의 장소를 다녀왔어요.</p><div id="ttPassportPrimarySlot"></div></section>` : empty('아직 일정이 없어요', '이날 가고 싶은 장소를 추가해 보세요.', '');
    const budgetLine = `<button type="button" class="pp-budget-strip${budget.remaining < 0 ? ' is-over' : ''}" data-tt-action="${budget.configured ? 'budget-info' : 'budget-settings'}" aria-label="하루 가용 예산 ${budget.configured ? money(budget.remaining) + ', 자세히 보기' : '설정하기'}">${icon('wallet')}<span>${budget.remaining < 0 ? '하루 예산 초과' : '오늘 남은 예산'}</span><div>${budget.configured ? `<strong>${money(Math.abs(budget.remaining))}</strong><small> / ${money(budget.allowance)}</small><progress max="100" value="${budget.percent}" aria-label="하루 가용 예산 잔여율"></progress>` : `<strong>예산 설정 ${icon('caret-right')}</strong>`}</div></button>`;
    return `${hero()}${dayStrip()}${ticket}${finished.length ? passportStopList(finished, '완료한 일정', 'completed', data.items) : ''}${remaining.length ? passportStopList(remaining, '남은 일정', 'remaining', data.items) : ''}${budgetLine}`;
  }
  function passportStopList(items, title, key, all) {
    const done = key === 'completed';
    return `<details class="pp-stops" data-pp-fold="${key}"${foldStates.get(key) === false ? '' : ' open'}><summary><span>${title} <b>${items.length}</b></span>${icon('caret-up')}</summary><div>${items.map(item => `<div class="pp-stop-row">
      ${done ? button(icon('check-circle'), 'complete', 'pp-stop-check', `data-id="${text(item.id)}" aria-label="${text(item.place)} 완료 취소" aria-pressed="true"`) : `<span class="pp-stop-number">${String(all.indexOf(item) + 1).padStart(2, '0')}</span>`}
      ${button(`<time>${text(item.time || '미정')}</time><strong>${text(item.place || '장소 미정')}</strong>${done ? `<small>${icon('map-pin')}${text(item.location || state.city || '')}</small>` : icon('caret-right')}`, 'itinerary-edit', 'pp-stop-detail', `data-id="${text(item.id)}" aria-label="${text(item.place)} 일정 상세"`)}
    </div>`).join('')}</div></details>`;
  }
  function reviewContent() {
    const items = M().dayItems(state, selectedDay), issues = M().reviewDay(state, selectedDay), outside = M().outsideItems(state);
    const plan = M().planAdjustment(state, selectedDay, 0, 10), flags = M().flags(state);
    const changes = new Map(plan.changes.map(change => [change.id, change]));
    const times = (start, end, lodging) => `<time>${text(start || '미정')}</time>${!lodging && end ? `<small>– ${text(end)}</small>` : ''}`;
    const rows = items.map((item, index) => {
      const change = changes.get(item.id), locked = flags.locked.has(item.id), completed = flags.completed.has(item.id);
      const itemIssues = issues.filter(issue => issue.id === item.id), delta = change ? M().minutes(change.time) - M().minutes(item.time) : 0;
      const segments = getItineraryTransits(item), mode = segments.length === 1 ? segments[0].trans : 'none';
      const transitIcon = itineraryTransitModes[mode === 'etc' ? 'flight' : mode]?.icon || 'path';
      const transit = index && !completed ? button(`${icon(transitIcon)}<span>${M().transitMinutes(item, 0) ? `이동 시간 <b>${M().transitMinutes(item, 0)}분</b>` : '이동 미정 · 10분 기준'}</span>${itemIssues.some(issue => issue.type === 'transit') ? `<small>${text(itemIssues.find(issue => issue.type === 'transit').title.replace('이동 시간 ', ''))}</small>` : ''}${icon('caret-right')}`, 'transit-edit', 'pp-review-transit', `data-id="${text(item.id)}" aria-label="${text(item.place)} 이동 정보 수정"`) : '';
      return `${transit}<div class="pp-review-row${change ? ' has-change' : ''}" data-review-id="${text(item.id)}">
        <div class="pp-review-place"><span class="pp-review-number${!completed && index === items.findIndex(row => !flags.completed.has(row.id)) ? ' is-next' : ''}">${String(index + 1).padStart(2, '0')}</span>${button(`<strong>${text(item.place || '장소 미정')}</strong><small>${text(item.location || state.city || '')}</small>`, 'itinerary-edit', 'pp-review-detail', `data-id="${text(item.id)}" aria-label="${text(item.place)} 일정 상세"`)}</div>
        <div class="pp-review-current">${times(item.time, item.endTime, item.theme === 'lodging')}</div><span class="pp-review-arrow" aria-hidden="true">${icon('arrow-right')}</span>
        <div class="pp-review-proposed">${times(change?.time || item.time, change ? change.endTime : item.endTime, item.theme === 'lodging')}</div>
        <div class="pp-review-note">${completed ? `<span class="pp-review-completed">${icon('check')}완료</span>` : button(locked ? `${icon('lock-key')}<small>고정</small>` : delta ? `<b>+${delta}분</b>` : icon('lock-key-open'), 'lock', 'pp-review-lock', `data-id="${text(item.id)}" aria-label="${text(item.place)} ${locked ? '잠금 해제' : '시간 잠금'}" aria-pressed="${locked}"`)}</div>
      </div>${itemIssues.filter(issue => issue.type !== 'transit').map(issue => `<p class="pp-review-warning">${icon('warning-circle')}${text(issue.title)}</p>`).join('')}`;
    }).join('');
    const description = plan.errors.length ? plan.errors[0] : plan.changes.length ? `이동 시간을 반영한 조정안이에요. 확인 후 적용해 주세요.` : '입력한 시간과 이동 간격에 맞는 일정이에요.';
    return `${dayStrip()}${items.length ? `<section class="pp-review-sheet" aria-label="현재 시간과 조정안 비교"><div class="pp-review-columns" aria-hidden="true"><span>일정</span><span>현재 시간</span><span></span><span>조정안</span><span>비고</span></div>${rows}</section><div class="pp-review-status${plan.errors.length ? ' is-warning' : ''}" role="status">${icon(plan.errors.length ? 'warning-circle' : plan.changes.length ? 'info' : 'check-circle')}<div><strong>${plan.errors.length ? '먼저 확인할 시간이 있어요' : plan.changes.length ? `${plan.changes.length}개 일정의 조정안을 확인해 주세요` : '여유 있게 움직일 수 있어요'}</strong><small>${text(description)}</small></div></div>` : empty('점검할 일정이 없어요', '일정을 만들면 겹치는 시간을 알려드려요.')}${outside.length ? button(`${icon('calendar-x')} 여행 기간 밖 일정 ${outside.length}개 확인`, 'itinerary-all', 'pp-outside-link') : ''}${state.travelCompanion?.lastAdjustment ? button(`${icon('arrow-counter-clockwise')} 마지막 시간 조정 되돌리기`, 'undo', 'tt-undo') : ''}`;
  }
  function reservationDate(row) {
    const stay = row.type === 'stay' && M().validDate(row.date) && M().validDate(row.endDate) && row.endDate > row.date;
    if (row.type === 'transport' && M().validDate(row.endDate)) return `${dateLabel(row.date)}${row.time ? ' · ' + row.time : ''} → ${dateLabel(row.endDate)}${row.endTime ? ' · ' + row.endTime : ''} · 왕복`;
    return `${dateLabel(row.date)}${row.time ? ' · ' + row.time : ''}${stay ? ` – ${dateLabel(row.endDate)} · ${Math.round((Date.parse(row.endDate) - Date.parse(row.date)) / 86400000)}박` : ''}`;
  }
  const walletFold = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
  function walletSearchMatches(row) {
    const query = walletFold(walletQuery);
    return !query || walletFold([row.title, row.location, row.reference, row.note, row.date, row.endDate, reservationDate(row), M().types[row.type]?.label].join(' ')).includes(query);
  }
  function walletType(row) {
    return row.type === 'transport' && row.transportKind === 'flight'
      ? { label: '항공권', icon: 'airplane-tilt', color: 'blue' } : M().types[row.type] || M().types.other;
  }
  function walletReference(row) {
    return `<div class="pw-reference${row.reference ? '' : ' is-empty'}"><span>예약번호</span>${row.reference
      ? button(`<b>${text(row.reference)}</b>${icon('copy')}`, 'copy', 'pw-reference-action', `data-id="${text(row.id)}" aria-label="${text(row.title)} 예약번호 복사" title="${text(row.reference)}"`)
      : button(`${icon('plus')}<span>입력하기</span>`, row.source === 'manual' ? 'reservation-edit' : 'reservation-source', 'pw-reference-action', `data-id="${text(row.id)}" data-field="reference" aria-label="${text(row.title)} 예약번호 입력"`)}</div>`;
  }
  function walletTicketDates(row) {
    const stay = row.type === 'stay', transport = row.type === 'transport';
    const date = (label, value, time) => `<span><small>${label}</small><b>${text(dateLabel(value))}${time ? ` <time>${text(time)}</time>` : ''}</b></span>`;
    return `<span class="pw-ticket-dates">${date(stay ? '체크인' : transport ? '가는 날' : '예약 일자', row.date, row.time)}${stay || M().validDate(row.endDate) ? date(stay ? '체크아웃' : transport ? '오는 날' : '종료 일자', row.endDate, row.endTime) : ''}</span>`;
  }
  function walletTicket(row) {
    const type = walletType(row), route = row.type === 'transport' && row.from && row.to;
    const today = M().dateInZone(M().defaultZone(state) || undefined);
    const remaining = M().validDate(row.date) ? Math.round((Date.parse(row.date) - Date.parse(today)) / 86400000) : null;
    const event = row.type === 'stay' ? '체크인' : row.type === 'transport' ? '출발' : '예약';
    const status = remaining === null ? '일정 확인' : remaining < 0 ? '지난 예약' : remaining === 0 ? `오늘 ${event}` : `${remaining}일 후 ${event}`;
    const title = M().validDate(row.date) ? `${Number(row.date.slice(5, 7))}월 ${Number(row.date.slice(8))}일 (${'일월화수목금토'[new Date(`${row.date}T12:00:00Z`).getUTCDay()]})` : '날짜 미정';
    return `<section class="pw-featured" aria-label="대표 예약"><div class="pw-ticket-heading"><h2>${text(title)}</h2><span>${text(status)}</span></div>
      <article class="tt-reservation pw-wallet-ticket ${type.color}" data-reservation-id="${text(row.id)}">
        <div class="pw-ticket-band"><div>${icon(type.icon)}<span>${type.label}</span><strong>${text([row.operator, row.serviceNumber].filter(Boolean).join(' ') || (route ? '여행 교통' : ''))}</strong></div>${walletReference(row)}</div>
        <div class="pw-ticket-body"><button type="button" class="tt-reservation-main pw-ticket-main" data-tt-action="reservation-detail" data-id="${text(row.id)}" aria-label="${text(row.title)} 예약 상세">${route
          ? `<span class="pw-ticket-route"><span><strong>${text(row.from)}</strong><small>출발지</small></span>${icon(type.icon)}<span><strong>${text(row.to)}</strong><small>도착지</small></span></span>`
          : `<span class="pw-ticket-title"><strong>${text(row.title)}</strong>${row.location ? `<small>${icon('map-pin')} ${text(row.location)}</small>` : ''}</span>`}${walletTicketDates(row)}</button>
          <div class="pw-ticket-stub" aria-hidden="true"><img src="src/assets/${row.transportKind === 'flight' ? 'wallet-passbook-flight-stamp.png' : 'wallet-passbook-greeting.png'}" alt="" width="${row.transportKind === 'flight' ? '360' : '384'}" height="${row.transportKind === 'flight' ? '360' : '192'}">${row.transportKind === 'flight' ? '' : `<span>TRIPLOG<br>TRAVEL WALLET</span>`}</div></div>
      </article></section>`;
  }
  function walletCard(row) {
    const type = walletType(row), date = M().validDate(row.date);
    const title = row.from && row.to && /^항공권(?:\s|·)/.test(row.title) ? `${row.from} → ${row.to}` : row.title;
    const compactDate = row.type === 'transport' && M().validDate(row.endDate)
      ? `${date ? `${Number(row.date.slice(5, 7))}.${Number(row.date.slice(8))}` : '날짜 미정'} ${row.time || ''} → ${Number(row.endDate.slice(5, 7))}.${Number(row.endDate.slice(8))} ${row.endTime || ''}`.trim()
      : reservationDate(row);
    return `<article class="tt-reservation pw-wallet-row" data-reservation-id="${text(row.id)}"><button type="button" class="tt-reservation-main pw-row-main" data-tt-action="reservation-detail" data-id="${text(row.id)}" aria-label="${text(row.title)} 예약 상세">
      <span class="pw-row-day">${date ? `<b>${Number(row.date.slice(5, 7))}.${Number(row.date.slice(8))}</b><small>(${'일월화수목금토'[new Date(`${row.date}T12:00:00Z`).getUTCDay()]})</small>` : '<small>날짜<br>미정</small>'}</span>
      <span class="tt-reservation-icon ${type.color}">${icon(type.icon)}</span><span class="tt-reservation-copy"><small class="pw-row-type">${type.label}${row.operator ? ` · ${text(row.operator)}` : ''}</small><strong>${text(title)}</strong><small class="tt-reservation-date">${text(compactDate)}</small></span>${icon('caret-right')}</button>${walletReference(row)}</article>`;
  }
  function renderWalletResults() {
    const list = $('#ttWalletList'); if (!list) return;
    const all = M().reservations(state), searched = all.filter(walletSearchMatches);
    const matching = searched.filter(row => walletFilter === 'all' || row.type === walletFilter);
    if (walletSort === 'recent') matching.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));
    else if (walletSort === 'name') matching.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko-KR', { numeric: true }));
    const filters = $('#ttWalletFilters'), left = filters.scrollLeft;
    filters.innerHTML = walletFilters.map(([key, label]) => {
      const count = key === 'all' ? searched.length : searched.filter(row => row.type === key).length;
      return button(`<span>${label}</span><b>${count}</b>`, 'wallet-filter', key === walletFilter ? 'active' : '', `data-filter="${key}" aria-pressed="${key === walletFilter}" aria-label="${label} 예약 ${count}건"`);
    }).join('');
    filters.scrollLeft = left;
    $('#ttWalletSearchClear').hidden = !walletQuery;
    $('#ttWalletCount').textContent = `${walletQuery ? '검색 결과' : '예약'} ${matching.length}건`;
    if (!matching.length) {
      list.innerHTML = all.length
        ? empty(walletQuery ? '검색 결과가 없어요' : '이 종류의 예약이 없어요', walletQuery ? '예약명·장소·예약번호를 바꿔 검색해 보세요.' : '다른 종류의 예약을 확인하거나 새 예약을 추가해 보세요.', 'wallet-reset', '전체 예약 보기')
        : empty('첫 예약을 추가해 보세요', '항공·숙소 사전구매와 일정의 입장권도 함께 모여요.', 'reservation-new', '예약 추가');
      return;
    }
    list.innerHTML = walletTicket(matching[0]) + `<div class="pw-wallet-index" aria-label="나머지 예약">${matching.slice(1).map(walletCard).join('')}</div>`;
  }
  function walletContent() {
    return `<div class="tt-wallet-toolbar"><div class="tt-wallet-search">${icon('magnifying-glass')}<input id="ttWalletSearch" type="search" value="${text(walletQuery)}" placeholder="예약명·장소·예약번호 검색" aria-label="예약 검색" autocomplete="off" maxlength="200">${button(icon('x'), 'wallet-search-clear', 'tt-wallet-clear', 'id="ttWalletSearchClear" aria-label="검색어 지우기"')}</div><div id="ttWalletFilters" class="tt-filters" role="group" aria-label="예약 종류"></div><div class="tt-wallet-resultbar"><p id="ttWalletCount" role="status" aria-live="polite"></p><label class="tt-wallet-sort"><span class="tt-visually-hidden">예약 정렬</span><select id="ttWalletSort" aria-label="예약 정렬">${[['date', '날짜순'], ['recent', '최근 날짜순'], ['name', '이름순']].map(([value, label]) => `<option value="${value}"${walletSort === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div></div><div id="ttWalletList" class="tt-wallet-list"></div>`;
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
    return `<figure class="pp-note-cover"><img src="src/assets/companion-passport-cover.png" alt="TripLOG 오프라인 포켓노트 — 리넨 표지와 분홍색 책갈피" width="1717" height="916"></figure>
      <section class="pp-pocket-panel"><div class="pp-tool-heading">${icon('suitcase')}<div><h2>오프라인 포켓노트</h2><p>인터넷 없이도 일정과 예약을 확인해요.</p></div></div>
        <div class="pp-note-options">${[['itinerary', '일정 포함'], ['references', '예약번호 포함'], ['budget', '예산 포함']].map(([key, label]) => `<label><input type="checkbox" data-tt-option="${key}" ${pocketOptions[key] ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div><div id="ttPassportPrimarySlot"></div>
      </section>
      <section class="pp-calendar-panel">${button(`${icon('calendar-check')}<span><strong>캘린더에 일정 추가</strong><small>여행 일정을 휴대폰 캘린더로 · ${state.itineraryItems.length}개</small></span>${icon('arrow-down')}`, 'calendar', 'pp-calendar-action', state.itineraryItems.length ? '' : 'disabled')}<p id="ttExportHelp" class="tt-export-help" role="status" hidden>다운로드한 ICS 파일을 캘린더로 가져오세요. iPhone에서는 Mail 첨부파일로 열어 추가할 수 있어요. <a href="https://support.apple.com/guide/iphone/ipha0d932e96/ios" target="_blank" rel="noopener noreferrer">가져오기 안내</a></p></section>
      <details class="pp-packing" data-pp-fold="packing"${foldStates.get('packing') === false ? '' : ' open'}><summary>${icon('suitcase')}<strong>준비물 체크리스트</strong><span>${packing.filter(item => item.checked).length} / ${packing.length} 완료</span>${icon('caret-up')}</summary>
        <div class="pp-packing-list">${packing.length ? packing.map(item => `<label><input type="checkbox" data-tt-packing="${text(item.id)}" ${item.checked ? 'checked' : ''}${packingBusy ? ' disabled' : ''}><span>${text(item.name || item.text || '준비물')}</span></label>`).join('') : '<p>여행에 필요한 준비물을 적어보세요.</p>'}</div>${button(`${packing.length ? '준비물 편집' : '준비물 추가'} ${icon('arrow-up-right')}`, 'packing', 'pp-packing-edit')}
      </details>
      <label class="pp-zone" for="ttTimeZone">${icon('globe')}<span class="pp-zone-label">일정 시간대</span><select id="ttTimeZone" aria-label="일정 시간대">${zoneOptions()}</select></label>`;
  }
  function renderContent() {
    const panel = $('#ttCompanion'); if (!panel) return;
    panel.dataset.tab = activeTab;
    panel.classList.toggle('tt-wallet-ui', activeTab === 'wallet');
    panel.classList.add('tt-passport-ui');
    const scroll = $('.tt-scroll', panel), previousScroll = scroll.scrollTop;
    $$('[data-pp-fold]', panel).forEach(el => foldStates.set(el.dataset.ppFold, el.open));
    const primary = $('#ttPrimary'); primary.remove();
    $('#ttCompanionTitle').textContent = titles[activeTab];
    $('#ttCompanionSubtitle').textContent = activeTab === 'wallet' ? state.tripName || '나의 여행' : activeTab === 'today' ? '오늘의 일정과 다음 장소를 확인하세요' : activeTab === 'review' ? '시간을 조정하고, 여유로운 하루를 만들어보세요.' : '여행을 더 가볍게, 더 편리하게.';
    $('#ttPassportGreeting').innerHTML = activeTab === 'wallet' ? '<img src="src/assets/wallet-passbook-greeting.png" alt="좋은 여행이 되길." width="384" height="192">' : activeTab === 'today' ? '오늘도,<br>좋은 여행이 되길.' : activeTab === 'review' ? '일정을 점검하고,<br>더 좋은 여행으로.' : '작은 준비가<br>더 큰 여행을 만듭니다.';
    const searchFocused = document.activeElement?.id === 'ttWalletSearch';
    const searchPosition = searchFocused ? $('#ttWalletSearch').selectionStart : null;
    $('#ttContent').innerHTML = ({ today: todayContent, review: reviewContent, wallet: walletContent, tools: toolsContent })[activeTab]();
    ($('#ttPassportPrimarySlot') || $('#ttPrimaryDock')).appendChild(primary);
    if (activeTab === 'wallet') {
      renderWalletResults();
      if (searchFocused) { $('#ttWalletSearch').focus({ preventScroll: true }); if (searchPosition !== null) $('#ttWalletSearch').setSelectionRange(searchPosition, searchPosition); }
    }
    const data = M().today(state, selectedDay);
    primary.innerHTML = activeTab === 'today' ? data.next ? `<a class="tt-button tt-primary" href="${text(M().directions(data.next, state))}" target="_blank" rel="noopener noreferrer">${icon('navigation-arrow')} 길찾기 ${icon('caret-right')}</a>` : button(`${data.items.length ? '오늘 일정 완료 · 일정 보기' : '첫 일정 추가'} ${icon('caret-right')}`, data.items.length ? 'itinerary-day' : 'itinerary-new', 'tt-primary') : activeTab === 'review' ? button(`조정안 확인 ${icon('caret-right')}`, 'adjustment', 'tt-primary', M().dayItems(state, selectedDay).length ? '' : 'disabled') : activeTab === 'wallet' ? button(`${icon('plus')} 예약 추가`, 'reservation-new', 'tt-primary') : button(`${icon('download-simple')}<span>저장</span>`, 'pocket', 'pp-pocket-save', 'aria-label="포켓노트 저장" title="포켓노트 저장"');
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
    $('#ttAdjustmentResult').innerHTML = `<h2>시간 조정 결과</h2>${activePlan.changes.map((change, index) => `<div class="tt-adjust-row"><span class="tt-step tt-avatar-${index % 3}">${index + 1}</span><span><b>${text(change.place)}</b><small>${change.beforeTime}${change.beforeEndTime ? ' – ' + change.beforeEndTime : ''}</small></span>${icon('arrow-right')}<strong>${change.time}${change.endTime ? ' – ' + change.endTime : ''}</strong></div>`).join('')}${issues.length ? notice(issues.map(text).join('<br>'), 'pink') : notice(activePlan.changes.length ? '겹치는 일정 없이 조정할 수 있어요' : '변경할 시간이 없어요. 현재 일정을 유지해요.')}`;
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
    $('#ttReservationExtras').open = Boolean(values.url || values.note);
    $('#ttReservationError').textContent = ''; updateReservationType(); openDialog('ttReservationEditor');
  }
  function updateReservationType() {
    const type = $('#ttReservationForm').elements.namedItem('type').value, stay = type === 'stay';
    $$('#ttReservationTypes button').forEach(el => { el.classList.toggle('active', el.dataset.type === type); el.setAttribute('aria-pressed', String(el.dataset.type === type)); });
    $('#ttReservationDateLabel').textContent = stay ? '체크인' : '예약 일자';
    $('#ttReservationEndField').hidden = !stay; $('#ttReservationTimeField').hidden = stay;
    $('#ttReservationEnd').required = stay;
  }
  async function saveReservation(event) {
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
      if (!existing) { walletFilter = row.type; walletQuery = ''; }
      await commit({ travelCompanion: current });
      $('#ttReservationEditor').close();
      if ($('#ttReservationDetail').open) showReservationDetail(`manual:${row.id}`, false);
      showToast('예약을 저장했어요.');
    } catch (error) { $('#ttReservationError').textContent = error.message; $('#ttReservationError').scrollIntoView({ block: 'nearest' }); }
  }
  function showReservationDetail(id, openModal = true) {
    const row = M().reservations(state).find(item => item.id === id); if (!row) return;
    detailId = id;
    const type = walletType(row), link = M().safeUrl(row.url);
    const mapLink = row.location ? buildTripPlaceSearchUrl(row.location) : '';
    const mapTarget = matchMedia('(any-pointer: coarse)').matches ? '_self' : '_blank';
    $('#ttReservationDetailTitle').textContent = '예약 상세';
    $('#ttReservationDetailBody').innerHTML = `
      <div class="tt-detail-hero"><span class="tt-reservation-icon ${type.color}">${icon(type.icon)}</span><div><span class="tt-type ${type.color}">${type.label}</span><h2>${text(row.title)}</h2></div></div>
      <dl class="tt-detail-list">
        <div><dt>${icon('calendar-blank')}${row.type === 'stay' ? '체크인 · 체크아웃' : '예약 일자 · 시간'}</dt><dd>${text(reservationDate(row))}</dd></div>
        <div><dt>${icon('clipboard-text')}예약번호</dt><dd class="tt-detail-reference"><code>${text(row.reference || '등록한 번호가 없어요')}</code>${row.reference ? button(`${icon('copy')}<span>복사</span>`, 'copy', 'tt-copy-action', `data-id="${text(id)}" aria-label="예약번호 복사"`) : button('입력', row.source === 'manual' ? 'reservation-edit' : 'reservation-source', '', `data-id="${text(id)}" data-field="reference"`)}</dd></div>
        <div><dt>${icon('map-pin')}주소 · 장소</dt><dd class="tt-detail-address"><span>${text(row.location || '등록한 장소가 없어요')}</span>${mapLink ? `<a class="tt-button tt-detail-map" href="${text(mapLink)}" target="${mapTarget}" rel="noopener noreferrer external">${icon('arrow-square-out')} ${getTripMapLabel()}</a>` : ''}</dd></div>
        ${row.note ? `<div><dt>${icon('note')}메모</dt><dd class="tt-prewrap">${text(row.note)}</dd></div>` : ''}
      </dl>
      ${link ? `<a class="tt-button tt-detail-link" href="${text(link)}" target="_blank" rel="noopener noreferrer">예약 사이트 열기 ${icon('arrow-up-right')}</a>` : ''}
      ${row.attachment ? button(`${icon('file')} 저장한 입장권 열기`, 'attachment', 'tt-detail-link', `data-id="${text(id)}"`) : ''}
      <p class="tt-muted tt-source-note">${row.source === 'manual' ? '직접 등록한 예약' : row.source === 'entry' ? '사전구매 지출에 연결된 예약' : '일정에 연결된 예약'}</p>
      ${row.source === 'manual' ? `<div class="tt-detail-actions">${button(`${icon('pencil-simple')} 예약 수정`, 'reservation-edit', '', `data-id="${text(id)}"`)}${button(`${icon('trash')} 삭제`, 'reservation-delete', 'tt-danger', `data-id="${text(id)}"`)}</div>` : button(row.source === 'entry' ? '원본 지출 보기' : '연결된 일정 보기', 'reservation-source', 'tt-detail-link', `data-id="${text(id)}"`)}
    `;
    $('#ttReservationDetailFooter').innerHTML = button(`${icon('calendar-plus')} ${row.source === 'itinerary' || state.itineraryItems.some(item => item.linkedReservationId === row.id) ? '연결된 일정 보기' : '일정에 추가'}`, 'reservation-link', 'tt-primary', `data-id="${text(id)}"`);
    if (openModal) openDialog('ttReservationDetail');
  }
  function editItinerary(item) {
    if (!item) return;
    closeAll(); state.selectedItineraryDate = item.date;
    window.TripLog.features.redesign.workspace.navigate('itinerary'); startItineraryEdit(item);
  }
  async function linkReservation(row) {
    if (row.source === 'itinerary') { editItinerary(findItineraryItem(row.sourceId)); return; }
    const linked = state.itineraryItems.find(item => item.linkedReservationId === row.id);
    if (linked) { editItinerary(linked); return; }
    if (!M().days(state).includes(row.date)) throw new Error('예약 일자가 여행 기간 밖에 있어요. 예약 또는 여행 일자를 먼저 수정해 주세요.');
    const item = { id: createId(), date: row.date, time: row.time || '', endTime: '', place: row.title, location: row.location || '', memo: row.note || '', theme: row.type === 'stay' ? 'lodging' : row.type === 'transport' ? 'transport' : 'sightseeing', trans: 'none', transits: [], duration: 0, cost: 0, voucherName: row.title, voucherCode: row.reference || '', linkedReservationId: row.id, createdAt: Date.now() };
    await commit({ itineraryItems: [...state.itineraryItems, item] }); editItinerary(item); showToast('일정에 추가했어요. 방문 시간을 설정해 주세요.');
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
          await commit({ travelCompanion: next });
          $$(`[data-tt-action="${action}"]`).find(el => el.dataset.id === id)?.focus({ preventScroll: true });
          break;
        }
        case 'itinerary-edit': editItinerary(findItineraryItem(id)); break;
        case 'transit-edit': {
          const items = M().dayItems(state, selectedDay), index = items.findIndex(item => item.id === id);
          if (index < 1) break;
          closeAll(); state.selectedItineraryDate = selectedDay;
          window.TripLog.features.redesign.workspace.navigate('itinerary');
          window.TripLog.features.itinerary.transitEditor.open(id, items[index - 1].id);
          break;
        }
        case 'itinerary-new': closeAll(); state.selectedItineraryDate = selectedDay || state.startDate; window.TripLog.features.redesign.workspace.navigate('itinerary'); window.TripLog.features.itinerary.workspace.show(); break;
        case 'itinerary-day': case 'itinerary-all': closeAll(); state.selectedItineraryDate = action === 'itinerary-all' ? 'all' : selectedDay; window.TripLog.features.redesign.workspace.navigate('itinerary'); saveAndRender(); break;
        case 'budget-settings': closeAll(); window.TripLog.features.redesign.workspace.navigate('start'); $('#budgetInput')?.focus(); break;
        case 'budget-info': { const data = M().dailyBudget(state, selectedDay); $('#ttBudgetInfoBody').innerHTML = `<p>오늘 이전에 기록한 지출과 사전구매를 전체 예산에서 뺀 뒤, 남은 ${data.remainingDays}일로 나눠 계산해요.</p><dl class="tt-detail-list"><dt>오늘 배정액</dt><dd>${money(data.allowance)}</dd><dt>오늘 기록한 지출</dt><dd>${money(data.used)}</dd><dt>오늘 남은 금액</dt><dd>${money(data.remaining)}</dd></dl><p class="tt-muted">지출을 기록할수록 가용 금액이 바뀝니다. 다른 멤버의 별도 지출은 포함하지 않아요.</p>`; openDialog('ttBudgetInfo'); break; }
        case 'adjustment': showAdjustment(); break;
        case 'delay': $('#ttDelay').value = target.dataset.delay; updateAdjustment(); break;
        case 'apply': await commit(M().applyAdjustment(state, activePlan)); $('#ttAdjustment').close(); showToast('일정 시간을 조정했어요. 점검 화면에서 되돌릴 수 있어요.'); break;
        case 'undo': await commit(M().undoAdjustment(state)); showToast('시간 조정을 되돌렸어요.'); break;
        case 'wallet-filter': walletFilter = target.dataset.filter; renderWalletResults(); $$('#ttWalletFilters button').find(el => el.dataset.filter === walletFilter)?.focus({ preventScroll: true }); break;
        case 'wallet-search-clear': walletQuery = ''; $('#ttWalletSearch').value = ''; renderWalletResults(); $('#ttWalletSearch').focus({ preventScroll: true }); break;
        case 'wallet-reset': walletFilter = 'all'; walletQuery = ''; $('#ttWalletSearch').value = ''; renderWalletResults(); $('#ttWalletSearch').focus({ preventScroll: true }); break;
        case 'reservation-new': openReservationEditor(); break;
        case 'reservation-type': $('#ttReservationForm').elements.namedItem('type').value = target.dataset.type; updateReservationType(); break;
        case 'reservation-detail': showReservationDetail(id); break;
        case 'reservation-edit': openReservationEditor(M().reservations(state).find(row => row.id === id)); if (target.dataset.field === 'reference') $('#ttReservationReference').focus(); break;
        case 'reservation-delete': {
          const tripId = state.id, row = companion().reservations.find(item => `manual:${item.id}` === id), before = JSON.stringify(row);
          if (row && await window.TripLog.features.redesign.workspace.confirmAction(`‘${row.title}’ 예약을 삭제할까요? 연결한 일정과 지출은 유지됩니다.`) && tripId === state.id) {
            const current = companion(); if (JSON.stringify(current.reservations.find(item => item.id === row.id)) !== before) throw new Error('예약이 변경됐어요. 다시 확인해 주세요.');
            window.TripLog.persistence.stateStorage.markDeletedEntity('reservation', row.id);
            current.reservations = current.reservations.filter(item => item.id !== row.id); await commit({ travelCompanion: current }); $('#ttReservationDetail').close(); showToast('예약을 삭제했어요.');
          } break;
        }
        case 'copy': { if (target.classList.contains('is-copied')) break; const row = M().reservations(state).find(item => item.id === id); if (row?.reference) { try { await navigator.clipboard.writeText(row.reference);
          if (target.isConnected) { const before = target.innerHTML; target.innerHTML = `${icon('check')}<span>복사됨</span>`; target.classList.add('is-copied'); window.setTimeout(() => { if (target.isConnected) { target.innerHTML = before; target.classList.remove('is-copied'); } }, 1500); }
          showToast('예약번호를 복사했어요.'); } catch { $('#ttCopyValue').value = row.reference; openDialog('ttCopy'); $('#ttCopyValue').focus(); $('#ttCopyValue').select(); } } break; }
        case 'reservation-source': { const row = M().reservations(state).find(item => item.id === id); if (row?.source === 'entry') { closeAll(); window.TripLog.features.redesign.workspace.navigate('budget'); startEdit(findEntry(row.sourceId), { focusBookingCode: target.dataset.field === 'reference' }); } else if (row) editItinerary(findItineraryItem(row.sourceId)); break; }
        case 'reservation-link': { const row = M().reservations(state).find(item => item.id === id); if (row) await linkReservation(row); break; }
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
    const mainDialog = createDialog('ttCompanion', '<div class="tt-scroll"><div class="tt-heading"><h1 id="ttCompanionTitle" tabindex="-1"></h1><p id="ttCompanionSubtitle"></p></div><div id="ttContent"></div><p id="ttStatus" role="alert"></p></div><footer class="tt-footer"><div id="ttPrimaryDock"><div id="ttPrimary"></div></div><nav id="ttNav" aria-label="여행 동행 도구"></nav></footer>');
    $('.tt-header .tt-icon', mainDialog).insertAdjacentHTML('beforebegin', '<span id="ttPassportGreeting" aria-hidden="true"></span>');
    createDialog('ttAdjustment', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttAdjustmentTitle" tabindex="-1">시간 조정 미리보기</h1><p id="ttAdjustmentDate"></p></div>${notice('완료한 일정과 잠긴 시간은 유지돼요', 'pink')}<section class="tt-card tt-adjust-controls"><h2 id="ttDelayLabel">얼마나 늦어졌나요?</h2><div id="ttDelayChips" class="tt-filters" role="group" aria-labelledby="ttDelayLabel">${[0, 15, 30, 60].map(value => button(`${value}분`, 'delay', '', `data-delay="${value}"`)).join('')}</div><input id="ttDelay" type="hidden" value="0"><div class="tt-number-fields"><label><span>이동 시간이 없으면 (분)</span><input id="ttFallback" type="number" min="0" max="180" step="1" value="10" inputmode="numeric"></label></div></section><section id="ttAdjustmentResult" class="tt-card"></section><p id="ttAdjustmentError" role="alert"></p></div><footer class="tt-sub-footer"><div>${button('취소', 'close')}<button type="button" class="tt-button tt-primary" data-tt-action="apply" id="ttApply"></button></div><p>적용한 뒤 한 번 되돌릴 수 있어요</p></footer>`);
    createDialog('ttReservationEditor', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttReservationEditorTitle" tabindex="-1">예약 추가</h1></div>
      <form id="ttReservationForm" class="tt-form"><input type="hidden" name="type" value="transport">
        <div id="ttReservationTypes" class="tt-filters" role="group" aria-label="예약 종류">${Object.entries(M().types).map(([type, entry]) => button(`${icon(entry.icon)}<span>${entry.label}</span>`, 'reservation-type', '', `data-type="${type}"`)).join('')}</div>
        <label for="ttReservationName"><span>예약 이름 <b class="tt-required" aria-hidden="true">*</b></span><input id="ttReservationName" name="title" required maxlength="200" autocomplete="off" placeholder="예: 난바 호텔"></label>
        <div class="tt-form-grid"><label><span id="ttReservationDateLabel">예약 일자</span><input name="date" id="ttReservationDate" type="date" data-compact-date="true" required></label><label id="ttReservationEndField"><span>체크아웃</span><input name="endDate" id="ttReservationEnd" type="date" data-compact-date="true"></label><label id="ttReservationTimeField"><span>예약 시간 (선택)</span><input name="time" id="ttReservationTime" type="time"></label></div>
        <label for="ttReservationReference"><span>예약번호</span><input name="reference" id="ttReservationReference" maxlength="300" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="확인 메일의 예약번호"></label>
        <label for="ttReservationLocation"><span>주소 · 장소</span><input name="location" id="ttReservationLocation" maxlength="600" autocomplete="off" placeholder="장소명 또는 주소"></label>
        <details id="ttReservationExtras" class="tt-reservation-extras"><summary>${icon('note')}<span>예약 링크 · 메모 <small>(선택)</small></span>${icon('caret-down')}</summary><div>
          <label for="ttReservationUrl"><span>예약 링크</span><input name="url" id="ttReservationUrl" type="url" maxlength="2000" placeholder="https://" autocomplete="off"></label>
          <label for="ttReservationNote"><span>메모</span><textarea name="note" id="ttReservationNote" maxlength="3000" rows="3" placeholder="체크인 안내, 준비물 등을 적어 주세요"></textarea></label>
        </div></details>
        <p class="tt-muted">${icon('info')} 지출 기록은 별도로 추가해 주세요.</p><p id="ttReservationError" role="alert"></p>
      </form></div><footer class="tt-sub-footer"><div>${button('취소', 'close')}<button type="submit" form="ttReservationForm" class="tt-button tt-primary">예약 저장</button></div></footer>`);
    createDialog('ttReservationDetail', '<div class="tt-scroll"><div class="tt-heading"><h1 id="ttReservationDetailTitle" tabindex="-1"></h1></div><div id="ttReservationDetailBody"></div></div><footer class="tt-sub-footer" id="ttReservationDetailFooter"></footer>');
    createDialog('ttBudgetInfo', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttBudgetInfoTitle" tabindex="-1">하루 예산 계산</h1></div><div id="ttBudgetInfoBody"></div></div><footer class="tt-sub-footer">${button('확인', 'close', 'tt-primary')}</footer>`);
    createDialog('ttCopy', `<div class="tt-scroll"><div class="tt-heading"><h1 id="ttCopyTitle" tabindex="-1">예약번호 복사</h1><p>선택한 예약번호를 길게 눌러 복사하거나 Ctrl+C를 누르세요.</p></div><input id="ttCopyValue" class="tt-copy-value" readonly aria-label="복사할 예약번호"></div><footer class="tt-sub-footer">${button('완료', 'close', 'tt-primary')}</footer>`);
    $('#ttReservationForm').addEventListener('submit', saveReservation);
    $('#ttReservationForm').addEventListener('invalid', event => { const extra = event.target.closest('details'); if (extra) extra.open = true; }, true);
    $('#ttCompanion').addEventListener('input', event => { if (event.target.id === 'ttWalletSearch') { walletQuery = event.target.value; renderWalletResults(); } });
    $('#ttCompanion').addEventListener('keydown', event => { if (event.target.id === 'ttWalletSearch' && event.key === 'Escape' && walletQuery) { event.preventDefault(); event.stopPropagation(); walletQuery = ''; event.target.value = ''; renderWalletResults(); } });
    document.addEventListener('click', handleClick);
    ['ttDelay', 'ttFallback'].forEach(id => $(`#${id}`).addEventListener('input', () => { $('#ttAdjustmentError').textContent = ''; updateAdjustment(); }));
    document.addEventListener('change', async event => {
      if (event.target.closest('.tt-dialog')?.tripId !== state.id) return;
      if (event.target.id === 'ttWalletSort') { walletSort = event.target.value; renderWalletResults(); }
      if (event.target.dataset.ttOption) pocketOptions[event.target.dataset.ttOption] = event.target.checked;
      if (event.target.id === 'ttTimeZone') { const next = companion(); next.timeZone = event.target.value; try { await commit({ travelCompanion: next }); $('#ttTimeZone')?.focus({ preventScroll: true }); } catch (error) { showToast(error.message); } }
      if (event.target.dataset.ttPacking) {
        const id = event.target.dataset.ttPacking;
        if (packingBusy || !state.packingList.some(item => item.id === id)) return;
        const tripId = state.id, checked = event.target.checked;
        packingBusy = true;
        $$('[data-tt-packing]').forEach(input => { input.disabled = true; });
        try { await commit({ packingList: state.packingList.map(item => item.id === id ? { ...item, checked } : item) }); }
        catch (error) { showToast(error.message); }
        finally {
          packingBusy = false;
          if (state.id === tripId && $('#ttCompanion').open && activeTab === 'tools') {
            renderContent(); $$('[data-tt-packing]').find(input => input.dataset.ttPacking === id)?.focus({ preventScroll: true });
          }
        }
      }
    });
  }
  window.TripLog.register('features.travelCompanion.workspace', { setup, render, open });
})();
