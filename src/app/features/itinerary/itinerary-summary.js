(() => {
  const preferenceKey = 'triplog.itinerarySummaryView.v1';
  const preferences = new Map();
  const query = selector => document.querySelector(selector);
  const text = value => String(value || '').replace(/\s+/g, ' ').trim();
  const escape = value => escapeHtml(String(value ?? ''));
  const icon = name => itineraryIcon(name);
  const timeMinutes = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
    ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
  const minutesLabel = value => value >= 60 ? `${Math.floor(value / 60)}시간${value % 60 ? ` ${value % 60}분` : ''}` : `${value}분`;
  const clockLabel = value => `${value >= 1440 ? '다음날 ' : ''}${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  let ready = false, lastSignature = '', displayedTripId = '', copyJob = 0, feedbackTimer, viewTransition = 0;

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = parseDate(value);
    return date && toInputDate(date) === value;
  }
  function preference() {
    if (!preferences.has(state.id)) {
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem(preferenceKey) || 'null'); } catch (_) { /* Session preferences are optional. */ }
      preferences.set(state.id, { mode: saved?.tripId === state.id && saved.mode === 'summary' ? 'summary' : 'edit',
        expanded: new Set(saved?.tripId === state.id && Array.isArray(saved.expanded) ? saved.expanded.filter(value => typeof value === 'string') : []),
        initialized: saved?.tripId === state.id && Array.isArray(saved.expanded), scroll: { edit: 0, summary: 0 } });
    }
    return preferences.get(state.id);
  }
  function remember() {
    const pref = preference();
    try { sessionStorage.setItem(preferenceKey, JSON.stringify({ tripId: state.id, mode: pref.mode, expanded: [...pref.expanded] })); }
    catch (_) { /* In-memory switching still works with storage disabled. */ }
  }
  function isActive() { return preference().mode === 'summary'; }

  function buildModel(source = state) {
    const days = getTripDays(source);
    const groups = new Map(days.map(day => [day.date, { ...day, key: day.date, inRange: true, title: `Day ${day.index}`, items: [] }]));
    for (const item of (source.itineraryItems || [])) {
      if (!item || typeof item !== 'object') continue;
      const date = validDate(item.date) ? item.date : '';
      if (!groups.has(date)) groups.set(date, { date, key: date || 'undated', inRange: false,
        title: date ? '기간 외 일정' : '날짜 미정', shortDate: date ? formatShortDate(parseDate(date)) : '',
        weekday: date ? formatWeekday(parseDate(date)) : '', items: [] });
      groups.get(date).items.push(item);
    }
    const ordered = [...groups.values()].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    let totalMinutes = 0, missingSegments = 0, totalSegments = 0, count = 0;
    for (const group of ordered) {
      group.items = sortItineraryItems(group.items);
      let recorded = 0, missing = 0, segments = 0, missingTimes = 0;
      const starts = [], ends = [];
      group.items.forEach((item, index) => {
        const start = timeMinutes(item.time), end = timeMinutes(item.endTime);
        if (start === null) missingTimes++;
        else { starts.push(start); ends.push(end === null ? start : end < start ? end + 1440 : end); }
        // Incoming travel belongs only to adjacent stops on the same known date.
        if (!index || !group.date) return;
        for (const segment of getItineraryTransits(item)) {
          segments++;
          const duration = Number(segment?.duration);
          if (Number.isFinite(duration) && duration > 0) recorded += Math.round(duration);
          else missing++;
        }
      });
      const first = starts.length ? Math.min(...starts) : null, last = ends.length ? Math.max(...ends) : null;
      group.range = first === null ? '시간 미정' : first === last ? clockLabel(first) : `${clockLabel(first)}–${clockLabel(last)}`;
      group.minutes = recorded; group.missing = missing; group.segments = segments; group.missingTimes = missingTimes;
      group.travel = !segments ? '' : recorded ? `이동 ${minutesLabel(recorded)}` : '이동 시간 미입력';
      group.metadata = group.items.length ? [group.range, `${group.items.length}개 일정`, group.travel].filter(Boolean).join(' · ') : '등록된 일정 없음';
      group.route = group.items.map(item => itineraryPlaceLabel(item)).join(' → ');
      group.warnings = [missingTimes ? `시각 미입력 ${missingTimes}개` : '', recorded && missing ? `이동 시간 미입력 ${missing}구간` : ''].filter(Boolean).join(' · ');
      count += group.items.length; totalMinutes += recorded; missingSegments += missing; totalSegments += segments;
    }
    return { tripId: source.id, tripName: text(source.tripName) || '여행 일정', days, groups: ordered,
      count, totalMinutes, missingSegments, totalSegments,
      travelLabel: totalMinutes ? `기록된 이동 ${minutesLabel(totalMinutes)}` : totalSegments ? '이동 시간 미입력' : '이동 기록 없음' };
  }
  function buildCopyText(model = buildModel()) {
    const dates = model.days.length ? `${model.days[0].shortDate} (${model.days[0].weekday})–${model.days.at(-1).shortDate} (${model.days.at(-1).weekday}) · ${model.days.length}일` : '여행 기간 미정';
    return [model.tripName, dates, `${model.count}개 일정 · ${model.travelLabel}`,
      ...model.groups.map(group => ['', `${group.title}${group.shortDate ? ` · ${group.shortDate} (${group.weekday})` : ''}`,
        group.metadata, ...group.items.map(item => `${timeMinutes(item.time) === null ? '시간 미정' : item.time}  ${text(itineraryPlaceLabel(item))}`),
        ...(group.warnings ? [group.warnings] : [])].join('\n'))].join('\n').trim();
  }
  function dayMarkup(group, index) {
    const open = preference().expanded.has(group.key);
    const bodyId = `itinerarySummaryDay${index}`;
    return `<article class="itinerary-summary-day${open ? ' is-open' : ''}" data-summary-day="${escape(group.key)}">
      <header class="itinerary-summary-day-head" data-summary-heading="${escape(group.key)}"><h2><strong>${escape(group.title)}</strong><span>${escape(group.shortDate)}${group.weekday ? ` (${escape(group.weekday)})` : ''}</span></h2><button type="button" class="itinerary-summary-edit" data-summary-edit="${escape(group.key)}" aria-label="${escape(group.title)} ${escape(group.shortDate)} ${group.inRange ? '일정 편집' : '전체 일정에서 확인'}">${group.inRange ? '이 날짜 편집' : '일정 확인'}${icon('caret-right')}</button><button type="button" class="itinerary-summary-toggle" data-summary-toggle="${escape(group.key)}" aria-expanded="${open}" aria-controls="${bodyId}" aria-label="${escape(group.title)} ${escape(group.shortDate)} ${open ? '접기' : '펼치기'}">${icon('caret-down')}</button></header>
      <p class="itinerary-summary-day-meta">${escape(group.metadata)}</p>
      ${group.warnings ? `<p class="itinerary-summary-warning">${icon('info')}${escape(group.warnings)}</p>` : ''}
      <p class="itinerary-summary-route"${open || !group.route ? ' hidden' : ''}>${escape(group.route)}</p>
      <div id="${bodyId}" class="itinerary-summary-day-body"${open ? '' : ' hidden'}>${group.items.length ? `<ol>${group.items.map(item => `<li data-theme="${escape(item.theme || 'sightseeing')}"><time>${timeMinutes(item.time) === null ? '미정' : escape(item.time)}</time><span class="itinerary-summary-dot" aria-hidden="true">${icon('circle')}</span><strong>${escape(itineraryPlaceLabel(item))}</strong></li>`).join('')}</ol>` : '<p class="itinerary-summary-unplanned">이 날짜에 방문할 장소를 추가해 보세요.</p>'}</div>
    </article>`;
  }
  function clearCopyFeedback() {
    copyJob++; clearTimeout(feedbackTimer);
    query('#itinerarySummaryCopy').disabled = false;
    query('#itinerarySummaryCopy').innerHTML = `${icon('copy')}<span>요약 복사</span>`;
    query('#itinerarySummaryCopyStatus').hidden = true;
    query('#itinerarySummaryCopyStatus').classList.remove('is-success');
    query('#itinerarySummaryCopyFallback').hidden = true;
    query('#itinerarySummaryCopyText').value = '';
  }
  function render() {
    setup();
    const pref = preference(), active = pref.mode === 'summary';
    query('#itineraryPage').dataset.itineraryView = pref.mode;
    query('#itineraryEditView').hidden = active; query('#itinerarySummaryView').hidden = !active;
    query('.itinerary-view-switch').querySelectorAll('button').forEach(button => {
      const selected = button.dataset.itineraryView === pref.mode;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    if (displayedTripId !== state.id) { displayedTripId = state.id; lastSignature = ''; clearCopyFeedback(); remember(); }
    if (!active) return;
    const model = buildModel();
    if (!model.count) query('#itinerarySummaryCopy').disabled = true;
    if (!pref.initialized && model.count) {
      const first = model.groups.find(group => group.date === state.selectedItineraryDate && group.items.length)
        || model.groups.find(group => group.items.length) || model.groups[0];
      if (first) pref.expanded.add(first.key);
      pref.initialized = true; remember();
    }
    const signature = JSON.stringify([model.tripId, model.tripName, model.count, model.totalMinutes, model.missingSegments,
      model.groups.map(group => [group.key, group.title, group.shortDate, group.weekday, group.metadata, group.warnings,
        group.items.map(item => [item.id, item.place, item.theme, item.time])])]);
    if (signature !== lastSignature) {
      const focused = document.activeElement?.closest('[data-summary-edit], [data-summary-toggle]');
      const action = focused?.hasAttribute('data-summary-edit') ? 'edit' : 'toggle';
      const key = focused?.getAttribute(`data-summary-${action}`);
      lastSignature = signature;
      query('#itinerarySummaryTotal').innerHTML = `<strong>${model.count}개 일정</strong><span>${escape(model.travelLabel)}</span>`;
      query('#itinerarySummaryDays').innerHTML = model.count ? model.groups.map(dayMarkup).join('') : '';
      query('#itinerarySummaryEmpty').hidden = Boolean(model.count);
      clearCopyFeedback(); query('#itinerarySummaryCopy').disabled = !model.count;
      if (key) [...query('#itinerarySummaryDays').querySelectorAll(`[data-summary-${action}]`)].find(button => button.getAttribute(`data-summary-${action}`) === key)?.focus({ preventScroll: true });
    }
  }
  function setMode(mode, { restoreScroll = true } = {}) {
    setup(); const pref = preference();
    for (const id of ['#itineraryEditView', '#itinerarySummaryView']) query(id).getAnimations().forEach(animation => animation.cancel());
    const next = mode === 'summary' ? 'summary' : 'edit';
    if (pref.mode === next) { render(); return; }
    pref.scroll[pref.mode] = window.scrollY;
    pref.mode = next; remember(); clearCopyFeedback();
    if (next === 'edit') renderItineraryPage(); else render();
    const panel = query(next === 'edit' ? '#itineraryEditView' : '#itinerarySummaryView');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) panel.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
    const token = ++viewTransition, tripId = state.id;
    if (restoreScroll) requestAnimationFrame(() => {
      if (token === viewTransition && tripId === state.id && pref.mode === next) window.scrollTo({ top: pref.scroll[next], behavior: 'instant' });
    });
  }
  function editDay(key) {
    const group = buildModel().groups.find(day => day.key === key); if (!group) return;
    clearItineraryEditMode(false);
    state.selectedItineraryDate = group.inRange ? group.date : 'all';
    if (group.inRange) state.lastActiveItineraryDate = group.date;
    state.selectedItineraryId = group.items[0]?.id || '';
    saveStateSilently(); setMode('edit', { restoreScroll: false });
    const target = group.inRange ? query('#itinerarySelectedDayTitle') : [...query('#itineraryList').querySelectorAll('.timeline-stop')].find(row => row.dataset.id === group.items[0]?.id);
    if (target) {
      target.tabIndex = -1; target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  function toggleDay(key) {
    const article = [...query('#itinerarySummaryDays').children].find(row => row.dataset.summaryDay === key); if (!article) return;
    const pref = preference(), open = !pref.expanded.has(key);
    if (open) pref.expanded.add(key); else pref.expanded.delete(key);
    article.classList.toggle('is-open', open);
    const button = article.querySelector('[data-summary-toggle]');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', button.getAttribute('aria-label').replace(/접기|펼치기/, open ? '접기' : '펼치기'));
    article.querySelector('.itinerary-summary-day-body').hidden = !open;
    const route = article.querySelector('.itinerary-summary-route'); route.hidden = open || !route.textContent;
    remember();
  }
  async function copySummary() {
    const model = buildModel(); if (!model.count) return;
    const payload = buildCopyText(model), job = ++copyJob;
    clearTimeout(feedbackTimer);
    query('#itinerarySummaryCopyStatus').hidden = true;
    query('#itinerarySummaryCopyStatus').classList.remove('is-success');
    query('#itinerarySummaryCopyFallback').hidden = true;
    const button = query('#itinerarySummaryCopy'); button.disabled = true;
    button.innerHTML = `${icon('copy')}<span>복사 중…</span>`;
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(payload); copied = true; } } catch (_) { /* Try local selection next. */ }
    if (job !== copyJob || model.tripId !== state.id) return;
    if (!copied) {
      const input = query('#itinerarySummaryCopyText'); input.value = payload;
      query('#itinerarySummaryCopyFallback').hidden = false; input.focus({ preventScroll: true }); input.select();
      try { copied = document.execCommand('copy'); } catch (_) { /* Offer visible manual copying. */ }
    }
    button.disabled = false;
    const status = query('#itinerarySummaryCopyStatus'); status.hidden = false;
    if (copied) {
      status.classList.add('is-success');
      query('#itinerarySummaryCopyFallback').hidden = true; button.focus({ preventScroll: true });
      button.innerHTML = `${icon('check')}<span>복사 완료</span>`;
      status.textContent = '전체 여행의 일정 요약을 복사했어요.';
      feedbackTimer = setTimeout(() => { if (job === copyJob) clearCopyFeedback(); }, 2500);
    } else {
      button.innerHTML = `${icon('copy')}<span>다시 복사</span>`;
      status.textContent = '자동 복사가 제한되어 있어요. 아래 내용을 선택해 복사해 주세요.';
      query('#itinerarySummaryCopyText').scrollIntoView({ block: 'nearest' });
    }
  }
  function setup() {
    if (ready) return; ready = true;
    const controls = query('.itinerary-view-switch');
    controls.addEventListener('click', event => { const button = event.target.closest('button[data-itinerary-view]'); if (button) setMode(button.dataset.itineraryView); });
    controls.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'edit' : event.key === 'End' ? 'summary' : isActive() ? 'edit' : 'summary';
      setMode(next); controls.querySelector(`[data-itinerary-view="${next}"]`).focus({ preventScroll: true });
    });
    query('#itinerarySummaryDays').addEventListener('click', event => {
      const edit = event.target.closest('[data-summary-edit]'); if (edit) { editDay(edit.dataset.summaryEdit); return; }
      const toggle = event.target.closest('[data-summary-toggle]');
      const heading = event.target.closest('[data-summary-heading]');
      if (toggle || heading) toggleDay(toggle?.dataset.summaryToggle || heading.dataset.summaryHeading);
    });
    query('#itinerarySummaryCopy').addEventListener('click', copySummary);
    query('#itinerarySummaryAdd').addEventListener('click', () => { setMode('edit'); window.TripLog.features.itinerary.workspace.show(); });
  }
  window.TripLog.register('features.itinerary.summary', { isActive, render, setMode, buildModel, buildCopyText, editDay });
})();
