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
  const previewLimit = () => matchMedia('(min-width: 900px)').matches ? 8 : matchMedia('(min-width: 600px)').matches ? 6 : 4;
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
        issues: new Map(), initialized: saved?.tripId === state.id && Array.isArray(saved.expanded), scroll: { edit: 0, summary: 0 } });
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
      const starts = [], ends = [], connections = [], missingRoutes = [], untimed = [];
      group.items.forEach((item, index) => {
        const start = timeMinutes(item.time), end = timeMinutes(item.endTime);
        if (start === null) { missingTimes++; untimed.push(item); }
        else { starts.push(start); ends.push(end === null ? start : end < start ? end + 1440 : end); }
        // Incoming travel belongs only to adjacent stops on the same known date.
        if (!index || !group.date) return;
        const previous = group.items[index - 1], transits = getItineraryTransits(item);
        const connection = { fromId: previous.id, toId: item.id, toIndex: index, minutes: 0, missing: 0, segments: 0, legs: [] };
        for (const [part, segment] of transits.entries()) {
          segments++;
          connection.segments++;
          const duration = Number(segment?.duration);
          connection.legs.push({ ...segment, duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0 });
          if (Number.isFinite(duration) && duration > 0) { recorded += Math.round(duration); connection.minutes += Math.round(duration); }
          else {
            missing++; connection.missing++;
            missingRoutes.push({ from: itineraryPlaceLabel(previous), to: itineraryPlaceLabel(item),
              fromId: previous.id, toId: item.id, part: part + 1, segmentIndex: part, total: transits.length });
          }
        }
        connections.push(connection);
      });
      const first = starts.length ? Math.min(...starts) : null, last = ends.length ? Math.max(...ends) : null;
      group.range = first === null ? '시간 미정' : first === last ? clockLabel(first) : `${clockLabel(first)}–${clockLabel(last)}`;
      group.minutes = recorded; group.missing = missing; group.segments = segments; group.missingTimes = missingTimes;
      group.travel = !segments ? '' : recorded ? `이동 ${minutesLabel(recorded)}` : '이동 시간 미입력';
      group.metadata = group.items.length ? [group.range, `${group.items.length}개 일정`, group.travel].filter(Boolean).join(' · ') : '등록된 일정 없음';
      group.route = group.items.map(item => itineraryPlaceLabel(item)).join(' → ');
      group.warnings = [missingTimes ? `시각 미입력 ${missingTimes}개` : '', recorded && missing ? `이동 시간 미입력 ${missing}구간` : ''].filter(Boolean).join(' · ');
      group.connections = connections; group.missingRoutes = missingRoutes; group.untimed = untimed;
      // Preview every itinerary type, including each hotel stop, in the same
      // order as the expanded list. Only viewport capacity limits visibility.
      group.preview = group.items.map((item, itemIndex) => ({ item, itemIndex }));
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
    let issueKind = preference().issues.get(group.key);
    if (issueKind && !(issueKind === 'transit' ? group.missing : group.missingTimes)) {
      preference().issues.delete(group.key); issueKind = '';
    }
    return `<article class="itinerary-summary-day${open ? ' is-open' : ''}" data-summary-day="${escape(group.key)}">
      <header class="itinerary-summary-day-head"><h2><button type="button" class="itinerary-summary-toggle" data-summary-toggle="${escape(group.key)}" aria-expanded="${open}" aria-controls="${bodyId}" aria-label="${escape(group.title)} ${escape(group.shortDate)} ${open ? '접기' : '펼치기'}"><strong>${escape(group.title)}</strong><span>${escape(group.shortDate.replace('/', '.'))}${group.weekday ? ` ${escape(group.weekday)}` : ''}</span>${icon('caret-down')}</button></h2></header>
      <div class="itinerary-summary-day-meta">
        <div class="summary-day-metrics">
        <span class="summary-metric summary-clock" aria-label="${escape(group.range)}">${icon('clock')}<span>${group.range === '시간 미정' ? '—' : escape(group.range)}</span></span>
        <span class="summary-metric" aria-label="${group.items.length}개 일정">${icon('map-pin')}<span>${group.items.length}곳</span></span>
        ${issueBadge(group, index, 'transit', group.missing, 'path', '이동 시간 미입력')}
        ${issueBadge(group, index, 'time', group.missingTimes, 'clock', '시각 미입력')}
        </div>
        <button type="button" class="itinerary-summary-edit" data-summary-edit="${escape(group.key)}" aria-label="${escape(group.title)} ${escape(group.shortDate)} ${group.inRange ? '일정 편집' : '전체 일정에서 확인'}" title="${group.inRange ? '일정 편집' : '전체 일정에서 확인'}">${icon('pencil-simple')}</button>
      </div>
      <div class="itinerary-summary-route"${open || !group.items.length ? ' hidden' : ''}>${previewMarkup(group, bodyId, open)}</div>
      <div id="itinerarySummaryIssues${index}" class="itinerary-summary-issues" role="region" aria-label="${escape(group.title)} 미입력 항목" data-kind="${issueKind || ''}"${issueKind ? '' : ' hidden'}>${issueKind ? issuesMarkup(group, issueKind) : ''}</div>
      <div id="${bodyId}" class="itinerary-summary-day-body"${open ? '' : ' hidden'}>${group.items.length ? `<ol>${group.items.map((item, itemIndex) => stopMarkup(group, item, itemIndex)).join('')}</ol>` : '<p class="itinerary-summary-unplanned">이 날짜에 방문할 장소를 추가해 보세요.</p>'}</div>
    </article>`;
  }
  function issueBadge(group, index, kind, count, glyph, label) {
    return count ? `<button type="button" class="summary-issue-badge" data-summary-issues="${escape(group.key)}" data-issue-kind="${kind}" aria-controls="itinerarySummaryIssues${index}" aria-expanded="${preference().issues.get(group.key) === kind}" aria-label="${label} ${count}${kind === 'transit' ? '구간' : '개'} 확인" title="${label} ${count}${kind === 'transit' ? '구간' : '개'}">${icon(glyph)}<span class="summary-question" aria-hidden="true">?</span><b>${count}</b></button>` : '';
  }
  function placeIcon(item, size = 28) {
    const art = window.TripLog.shared.itineraryArt.resolve(item);
    return `<img data-summary-icon src="${escape(art.colorIcon)}" alt="" width="${size}" height="${size}" />`;
  }
  function transitAttributes(group, connection, segmentIndex, origin) {
    return `data-summary-transit="${escape(connection.toId)}" data-summary-previous="${escape(connection.fromId)}" data-summary-group="${escape(group.key)}" data-summary-segment="${segmentIndex}" data-summary-origin="${origin}" aria-haspopup="dialog" aria-expanded="false"`;
  }
  function stopMarkup(group, item, itemIndex) {
    const connection = group.connections.find(row => row.toIndex === itemIndex);
    const travel = connection ? `<div class="summary-transit-strip" role="group" aria-label="${escape(itineraryPlaceLabel(group.items[itemIndex - 1]))}에서 ${escape(itineraryPlaceLabel(item))}까지 이동 ${connection.segments}구간">${connection.legs.map((leg, index) => {
      const modeKey = leg.trans === 'etc' ? 'flight' : leg.trans;
      const mode = itineraryTransitModes[modeKey] || itineraryTransitModes.none;
      const art = window.TripLog.shared.itineraryArt.catalog[modeKey === 'flight' ? 'airport' : modeKey];
      const line = text(leg.lineName), from = text(leg.fromPlace);
      const label = `${index + 1}번째 이동 · ${mode.label}${line ? ` · ${line}` : ''}${from ? ` · ${from} 출발` : ''} · ${leg.duration ? `${leg.duration}분` : '시간 미입력'} · 편집`;
      return `${index ? `<span class="summary-transit-arrow" aria-hidden="true">${icon('arrow-right')}</span>` : ''}<button type="button" class="summary-transit-leg${leg.duration ? '' : ' is-missing'}" ${transitAttributes(group, connection, index, 'timeline')} aria-label="${escape(label)}" title="${escape(label)}">${art ? `<img data-summary-icon src="${escape(art.colorIcon)}" alt="" width="20" height="20" />` : icon(mode.icon)}${line ? `<span class="summary-transit-line">${escape(line)}</span>` : ''}<span>${leg.duration ? `${leg.duration}분` : '<span class="summary-question" aria-hidden="true">?</span>'}</span></button>`;
    }).join('')}</div>` : '';
    return `<li class="summary-timeline-stop${connection?.missing ? ' has-missing' : ''}" data-stop-id="${escape(item.id)}">${travel}<div class="summary-stop-row"><time>${timeMinutes(item.time) === null ? '미정' : escape(item.time)}</time><span class="summary-stop-icon" aria-hidden="true">${placeIcon(item)}</span><strong>${escape(itineraryPlaceLabel(item))}</strong></div></li>`;
  }
  function issuesMarkup(group, kind) {
    const transit = kind === 'transit', count = transit ? group.missing : group.missingTimes;
    const title = transit ? '이동 확인' : '시각 확인';
    const rows = transit ? group.missingRoutes.map(row => {
      const from = group.items.find(item => item.id === row.fromId), to = group.items.find(item => item.id === row.toId);
      const leg = getItineraryTransits(to)[row.segmentIndex];
      return `<li><div class="summary-issue-route"><span class="summary-issue-place">${placeIcon(from)}<span>${escape(row.from)}</span></span><span class="summary-issue-arrow" aria-hidden="true">${icon('arrow-right')}</span><span class="summary-issue-place">${placeIcon(to)}<span>${escape(row.to)}</span></span></div><span class="summary-issue-duration">${icon('clock')}<span>—분</span>${row.total > 1 ? `<small title="${escape(text(leg.lineName) || (itineraryTransitModes[leg.trans]?.label || '이동'))}">${row.part}/${row.total}</small>` : ''}</span><button type="button" class="summary-issue-action" ${transitAttributes(group, row, row.segmentIndex, 'issues')} aria-label="${escape(row.from)}에서 ${escape(row.to)}까지 ${row.total > 1 ? `${row.part}번째 ` : ''}이동 시간 입력">${icon('pencil-simple')}<span>시간 입력</span></button></li>`;
    }) : group.untimed.map(item => `<li><span class="summary-issue-place">${placeIcon(item)}<span>${escape(itineraryPlaceLabel(item))}</span></span><span class="summary-issue-duration">${icon('clock')}<span>—:—</span></span><button type="button" class="summary-issue-action" data-summary-time="${escape(item.id)}">${icon('pencil-simple')}<span>시각 입력</span></button></li>`);
    return `<div class="summary-issues-head"><strong>${icon(transit ? 'path' : 'clock')}<span>${title}</span><b aria-label="${transit ? '이동 시간 미입력' : '시각 미입력'} ${count}${transit ? '구간' : '개'}">${count}</b></strong><button type="button" class="summary-issues-close" data-summary-close-issues aria-label="${title} 닫기">${icon('x')}</button></div><ul>${rows.join('')}</ul>`;
  }
  function previewMarkup(group, bodyId, open) {
    const preview = group.preview.slice(0, previewLimit());
    const more = group.items.length - preview.length;
    const stops = preview.map(({ item, itemIndex }, previewIndex) => {
      const art = window.TripLog.shared.itineraryArt.resolve(item);
      const next = preview[previewIndex + 1];
      let connection = '';
      if (next && group.date) {
        const legs = group.connections.filter(row => row.toIndex > itemIndex && row.toIndex <= next.itemIndex);
        const missing = legs.reduce((sum, row) => sum + row.missing, 0);
        const minutes = legs.reduce((sum, row) => sum + row.minutes, 0);
        const label = `${itineraryPlaceLabel(item)} → ${itineraryPlaceLabel(next.item)}${next.itemIndex > itemIndex + 1 ? ' (경유 포함)' : ''}: ${missing ? `이동 시간 미입력 ${missing}구간` : minutesLabel(minutes)}`;
        connection = `<span class="summary-route-link${missing ? ' is-missing' : ''}" role="img" aria-label="${escape(label)}" title="${escape(label)}"><span aria-hidden="true">${missing ? '?' : ''}</span></span>`;
      }
      return `<div class="summary-preview-stop">${connection}<button type="button" class="summary-preview-place" data-summary-toggle="${escape(group.key)}" aria-expanded="${open}" aria-controls="${bodyId}" aria-label="${escape(itineraryPlaceLabel(item))} · ${escape(group.title)} 상세 일정 ${open ? '접기' : '펼치기'}" title="${escape(itineraryPlaceLabel(item))}"><img data-summary-icon src="${escape(art.colorIcon)}" alt="" width="36" height="36" /><span>${escape(itineraryPlaceLabel(item))}</span></button></div>`;
    }).join('');
    return `<div class="summary-preview-stops" style="--preview-count:${preview.length}">${stops}${more ? `<button type="button" class="summary-preview-more" data-summary-toggle="${escape(group.key)}" aria-expanded="${open}" aria-controls="${bodyId}" aria-label="나머지 ${more}개 일정 펼치기"><span>+${more}</span></button>` : ''}</div>`;
  }
  function toggleIssues(button) {
    const group = buildModel().groups.find(row => row.key === button.dataset.summaryIssues); if (!group) return;
    const article = button.closest('article'), panel = document.getElementById(button.getAttribute('aria-controls'));
    const kind = button.dataset.issueKind, open = panel.hidden || panel.dataset.kind !== kind;
    if (open) preference().issues.set(group.key, kind); else preference().issues.delete(group.key);
    article.querySelectorAll('[data-summary-issues]').forEach(control => control.setAttribute('aria-expanded', String(open && control === button)));
    panel.hidden = !open; panel.dataset.kind = kind;
    if (!open) return;
    panel.innerHTML = issuesMarkup(group, kind);
  }
  function openTransit(button) {
    const { summaryTransit: id, summaryPrevious: previousId, summaryGroup: key, summarySegment: segment, summaryOrigin: origin } = button.dataset;
    const tripId = state.id;
    window.TripLog.features.itinerary.transitEditor.open(id, previousId, undefined, {
      initialView: 'manual', segmentIndex: Number(segment), returnFocus: () => {
        if (state.id !== tripId || !isActive()) return null;
        const article = [...query('#itinerarySummaryDays').children].find(row => row.dataset.summaryDay === key);
        if (!article) return null;
        return [...article.querySelectorAll('[data-summary-transit]')].find(control =>
          control.dataset.summaryTransit === id && control.dataset.summarySegment === segment && control.dataset.summaryOrigin === origin)
          || article.querySelector('[data-issue-kind="transit"]') || article.querySelector('.itinerary-summary-toggle');
      }
    });
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
      pref.initialized = true; remember();
    }
    const signature = JSON.stringify([model.tripId, model.tripName, model.count, model.totalMinutes, model.missingSegments, previewLimit(),
      model.groups.map(group => [group.key, group.title, group.shortDate, group.weekday, group.metadata, group.warnings,
        group.connections, group.items.map(item => [item.id, item.place, item.theme, item.themeSubtype, item.placeType, item.placeTypes, item.transportReservation?.kind, item.time, item.endTime])])]);
    if (signature !== lastSignature) {
      const focused = document.activeElement?.closest('[data-summary-edit], [data-summary-toggle], [data-summary-issues]');
      const action = focused?.hasAttribute('data-summary-edit') ? 'edit' : focused?.hasAttribute('data-summary-issues') ? 'issues' : 'toggle';
      const key = focused?.getAttribute(`data-summary-${action}`);
      const issueKind = focused?.dataset.issueKind;
      lastSignature = signature;
      query('#itinerarySummaryTotal').innerHTML = `<strong aria-label="전체 ${model.count}개 일정">${icon('map-pin')}${model.count}</strong>${model.totalMinutes ? `<span title="기록된 이동 시간" aria-label="${escape(model.travelLabel)}">${icon('path')}${escape(minutesLabel(model.totalMinutes))}</span>` : ''}`;
      query('#itinerarySummaryDays').innerHTML = model.count ? model.groups.map(dayMarkup).join('') : '';
      query('#itinerarySummaryEmpty').hidden = Boolean(model.count);
      clearCopyFeedback(); query('#itinerarySummaryCopy').disabled = !model.count;
      if (key) ([...query('#itinerarySummaryDays').querySelectorAll(`[data-summary-${action}]`)].find(button => button.getAttribute(`data-summary-${action}`) === key && (!issueKind || button.dataset.issueKind === issueKind)) || [...query('#itinerarySummaryDays').querySelectorAll('[data-summary-toggle]')].find(button => button.dataset.summaryToggle === key))?.focus({ preventScroll: true });
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
    const previewFocused = article.querySelector('.itinerary-summary-route').contains(document.activeElement);
    const pref = preference(), open = !pref.expanded.has(key);
    if (open) pref.expanded.add(key); else pref.expanded.delete(key);
    article.classList.toggle('is-open', open);
    article.querySelectorAll('[data-summary-toggle]').forEach(button => {
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', button.getAttribute('aria-label').replace(/접기|펼치기/, open ? '접기' : '펼치기'));
    });
    article.querySelector('.itinerary-summary-day-body').hidden = !open;
    const route = article.querySelector('.itinerary-summary-route'); route.hidden = open || !route.querySelector('button');
    if (open && previewFocused) article.querySelector('.itinerary-summary-toggle').focus({ preventScroll: true });
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
    for (const breakpoint of ['(min-width: 600px)', '(min-width: 900px)']) matchMedia(breakpoint).addEventListener('change', () => { if (isActive()) render(); });
    const controls = query('.itinerary-view-switch');
    controls.addEventListener('click', event => { const button = event.target.closest('button[data-itinerary-view]'); if (button) setMode(button.dataset.itineraryView); });
    controls.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'edit' : event.key === 'End' ? 'summary' : isActive() ? 'edit' : 'summary';
      setMode(next); controls.querySelector(`[data-itinerary-view="${next}"]`).focus({ preventScroll: true });
    });
    query('#itinerarySummaryDays').addEventListener('click', event => {
      const transit = event.target.closest('[data-summary-transit]'); if (transit) { openTransit(transit); return; }
      const close = event.target.closest('[data-summary-close-issues]');
      if (close) {
        const active = close.closest('article').querySelector('[data-summary-issues][aria-expanded="true"]');
        if (active) { toggleIssues(active); active.focus({ preventScroll: true }); } return;
      }
      const time = event.target.closest('[data-summary-time]');
      if (time) {
        const item = findItineraryItem(time.dataset.summaryTime);
        if (item) { setMode('edit', { restoreScroll: false }); startItineraryEdit(item); } return;
      }
      const issue = event.target.closest('[data-summary-issues]'); if (issue) { toggleIssues(issue); return; }
      const edit = event.target.closest('[data-summary-edit]'); if (edit) { editDay(edit.dataset.summaryEdit); return; }
      const toggle = event.target.closest('[data-summary-toggle]');
      const heading = event.target.closest('[data-summary-heading]');
      if (toggle || heading) toggleDay(toggle?.dataset.summaryToggle || heading.dataset.summaryHeading);
    });
    query('#itinerarySummaryDays').addEventListener('error', event => {
      const image = event.target; if (!image.matches?.('img[data-summary-icon]')) return;
      if (!image.dataset.fallback) { image.dataset.fallback = 'true'; image.src = window.TripLog.shared.itineraryArt.catalog.sightseeing.colorIcon; }
      else { image.hidden = true; image.insertAdjacentHTML('afterend', icon('map-pin')); }
    }, true);
    query('#itinerarySummaryDays').addEventListener('keydown', event => {
      const strip = event.target.closest('.summary-transit-strip');
      if (strip && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        const buttons = [...strip.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
        buttons[next].focus({ preventScroll: true }); buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' }); return;
      }
      if (event.key !== 'Escape') return;
      const article = event.target.closest('.itinerary-summary-day');
      const active = article?.querySelector('[data-summary-issues][aria-expanded="true"]');
      if (active) { event.preventDefault(); toggleIssues(active); active.focus({ preventScroll: true }); }
    });
    query('#itinerarySummaryCopy').addEventListener('click', copySummary);
    query('#itinerarySummaryAdd').addEventListener('click', () => { setMode('edit'); window.TripLog.features.itinerary.workspace.show(); });
  }
  window.TripLog.register('features.itinerary.summary', { isActive, render, setMode, buildModel, buildCopyText, editDay });
})();
