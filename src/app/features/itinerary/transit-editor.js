(() => {
  let dialog, form, draft = null, serial = 0, submitting = false, returnFocus = null;
  let routeMode = 'transit', activeView = 'route', routeKey = '', routeFrames = new Map();
  const navigationKey = 'triplog.transitMapDraft.v1';
  let pendingNavigation = null, navigationObserver;
  const clone = value => JSON.parse(JSON.stringify(value));
  const find = selector => dialog.querySelector(selector);
  const icon = name => itineraryIcon(name);
  const minutes = value => /^\d{2}:\d{2}$/.test(value || '') && Number(value.slice(0, 2)) < 24 && Number(value.slice(3)) < 60
    ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
  const durationText = value => value >= 60 ? `${Math.floor(value / 60)}시간 ${value % 60}분` : `${value}분`;
  const clockText = value => `${value >= 1440 ? `+${Math.floor(value / 1440)}일 ` : ''}${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const modeFor = row => itineraryTransitModes[row.trans === 'etc' ? 'flight' : row.trans] || itineraryTransitModes.none;
  const modeKey = row => row.trans === 'etc' ? 'flight' : row.trans || 'none';
  const departureTime = () => minutes(draft.previous.endTime || draft.previous.time);
  const validDuration = row => /^\d+$/.test(row.durationInput) && Number(row.durationInput) <= 1440 ? Number(row.durationInput) : 0;
  const transferName = (row, index) => index ? String(row.fromPlace || '').trim() || `환승 ${index}` : itineraryPlaceLabel(draft.previous);
  const transitColors = [ ['#2879ef', '파랑'], ['#e93545', '빨강'], ['#248452', '초록'], ['#b96609', '주황'], ['#748197', '회색'] ];
  const defaultColors = { bus: '#2879ef', train: '#e93545', car: '#248452', flight: '#2879ef' };
  const colorFor = row => /^#[0-9a-f]{6}$/i.test(row.color || '') ? row.color : defaultColors[modeKey(row)] || '#748197';
  const legStyle = row => `--leg-color:${colorFor(row)};--leg-tint:${colorFor(row)}16`;

  function journeyTimes() {
    let time = departureTime();
    const starts = draft.rows.map(row => {
      const start = time, duration = validDuration(row);
      time = time !== null && duration > 0 ? time + duration : null;
      return start;
    });
    return { starts, arrival: time };
  }
  function syncMapLink() {
    const source = find('#itineraryTransitGoogleLink'), link = find('#itineraryTransitMapLink');
    link.hidden = source.hidden;
    if (source.hasAttribute('href')) link.href = source.href;
    else link.removeAttribute('href');
    link.target = source.target;
    link.setAttribute('aria-label', source.getAttribute('aria-label') || '지도에서 길찾기 열기');
    link.title = source.getAttribute('aria-label') || '지도에서 길찾기 열기';
  }

  function clearNavigation() {
    pendingNavigation = null; navigationObserver?.disconnect();
    try { sessionStorage.removeItem(navigationKey); } catch (_) { /* Keep the live editor usable. */ }
  }
  function prepareNavigation(event) {
    const link = event.currentTarget;
    link.target = matchMedia('(any-pointer: coarse)').matches ? '_self' : '_blank';
    if (!draft || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target !== '_self') return;
    try {
      sessionStorage.setItem(navigationKey, JSON.stringify({ tripId: draft.tripId, id: draft.id,
        previousId: draft.previous.id, signature: draft.signature, original: draft.original,
        rows: draft.rows, mode: routeMode, savedAt: Date.now() }));
    } catch (_) { link.target = '_blank'; }
    // Native link navigation must stay in the tap event; no popup or async lookup.
  }
  function restoreNavigation() {
    if (!pendingNavigation || document.documentElement.dataset.auth !== 'signed-in'
      || document.documentElement.dataset.appReady !== 'true') return;
    const saved = pendingNavigation; clearNavigation();
    if (dialog?.open || saved.tripId !== getActiveTripId() || saved.tripId !== state.id
      || !Number.isFinite(saved.savedAt) || Date.now() - saved.savedAt > 24 * 60 * 60 * 1000
      || !Array.isArray(saved.rows) || !saved.rows.length
      || !saved.rows.every(row => row && typeof row === 'object' && typeof row.durationInput === 'string')
      || typeof saved.original !== 'string') return;
    const source = context(saved.id);
    if (!source || source.previous.id !== saved.previousId || !matchesSignature(source, saved.signature)) return;
    setActivePage('itinerary'); open(saved.id, saved.previousId, saved.mode);
    draft.rows = saved.rows.map(row => ({ ...row, key: ++serial, durationInput: String(row.durationInput || '') }));
    draft.original = saved.original; renderRows(); renderJourney();
  }
  function routeStop(item) {
    if (getBestRouteCoordinates(item, { requireSignature: true })) return item;
    const clean = value => {
      const text = String(value || '').trim();
      return !text || /^[-–—\s]+$/.test(text) || /^(?:(?:식사|숙소)\s*)?(?:장소\s*)?미정$/.test(text) ? '' : text;
    };
    const stop = { ...item, place: clean(item.place), location: clean(item.location) };
    if (!stop.place && !stop.location) stop.place = clean(extractNaverMapsPlaceName(item.mapQuery || '') || extractGoogleMapsPlaceName(item.mapQuery || ''));
    return stop.place || stop.location ? stop : null;
  }
  function resetRouteFrames() {
    routeFrames.forEach(entry => clearTimeout(entry.timer));
    routeFrames.clear(); routeKey = ''; find('#itineraryTransitMap').replaceChildren();
  }
  function routeStatus(entry) {
    if (!dialog?.open || activeView !== 'route' || routeFrames.get(routeMode) !== entry) return;
    const status = find('#itineraryTransitMapStatus');
    status.hidden = entry.loaded;
    status.classList.toggle('is-slow', Boolean(entry.slow));
    status.textContent = entry.slow ? '지도가 늦게 열려요. 다시 시도하거나 지도에서 확인해 주세요.' : '지도를 불러오는 중…';
    find('#itineraryTransitMap').setAttribute('aria-busy', String(!entry.loaded && !entry.slow));
  }
  function resolveRoute(stops) {
    const current = draft;
    current.routeLookup = { status: 'loading' };
    resolveDomesticRouteStops(stops).then(result => {
      if (draft !== current || current.tripId !== state.id || !isDomesticMapTrip()) return;
      current.routeLookup = { status: result.complete ? 'ready' : 'failed', ...result };
      if (dialog.open && activeView === 'route') showRoute();
    });
  }
  function showRoute() {
    if (!draft || activeView !== 'route') return;
    const domestic = isDomesticMapTrip(), label = getTripMapLabel();
    dialog.dataset.mapProvider = domestic ? 'naver' : 'google';
    find('[data-transit-map-mode="driving"]').hidden = !domestic;
    find('#itineraryTransitRouteTab').textContent = domestic ? '지도 · 길찾기' : 'Google 경로';
    find('.transit-map-modes').setAttribute('aria-label', `${label} 경로 이동 수단`);
    find('#itineraryTransitMapRetry').hidden = domestic;
    find('#itineraryTransitMapRetry').setAttribute('aria-label', `${label} 경로 다시 불러오기`);
    find('.transit-map-note span').textContent = `여행 날짜·출발 시각은 ${label}에서 확인해 주세요. 아래 이동 구간은 직접 기록한 내용이에요.`;
    const stops = [routeStop(draft.previous), routeStop(draft.item)];
    const available = stops.every(Boolean);
    find('#itineraryTransitMapArea').hidden = !available || domestic;
    find('#itineraryTransitNaver').hidden = !available || !domestic;
    find('#itineraryTransitRouteEmpty').hidden = available;
    find('#itineraryTransitGoogleLink').hidden = !available;
    find('#itineraryTransitRouteFooter').classList.toggle('is-empty', !available);
    find('#itineraryTransitModes').hidden = !available;
    if (!domestic || !available) hideEmbeddedDomesticMap(find('#itineraryTransitDomesticMap'));
    if (!available) {
      resetRouteFrames();
      find('#itineraryTransitGoogleLink').removeAttribute('href');
      const missing = !stops[0] && !stops[1] ? '출발지와 도착지를' : !stops[0] ? '출발지를' : '도착지를';
      find('#itineraryTransitRouteEmptyText').textContent = `${missing} 먼저 정해 주세요. 일정에 장소 이름이나 주소를 입력하면 경로가 표시돼요.`;
      syncMapLink();
      return;
    }
    const urls = buildTripMapRouteUrls(stops, { travelMode: routeMode });
    if (domestic && urls.isSearchFallback) urls.external = buildTripPlaceSearchUrl(stops[1].location || stops[1].place);
    const key = JSON.stringify([urls.provider, draft.tripId, draft.previous.id, draft.id, ...stops.map(buildGoogleMapsRouteStopQuery)]);
    if (routeKey !== key) { resetRouteFrames(); routeKey = key; }
    find('#itineraryTransitGoogleLink').href = urls.external;
    find('#itineraryTransitGoogleLink').target = matchMedia('(any-pointer: coarse)').matches ? '_self' : '_blank';
    find('#itineraryTransitGoogleLink span').textContent = urls.isSearchFallback ? '네이버지도에서 도착지 검색' : `${label}에서 열기`;
    find('#itineraryTransitGoogleLink').setAttribute('aria-label', urls.isSearchFallback ? '네이버지도에서 도착지 검색' : `${label}에서 길찾기 열기`);
    find('#itineraryTransitGoogleLink').title = find('#itineraryTransitGoogleLink').getAttribute('aria-label');
    dialog.querySelectorAll('[data-transit-map-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.transitMapMode === routeMode)));
    if (domestic) {
      const current = draft;
      renderEmbeddedDomesticMap(find('#itineraryTransitDomesticMap'), stops, {
        isCurrent: () => draft === current && dialog.open && activeView === 'route',
      });
      if (urls.isSearchFallback && !draft.routeLookup) resolveRoute(stops);
      const loading = urls.isSearchFallback && draft.routeLookup?.status === 'loading';
      const failed = urls.isSearchFallback && !loading;
      // Keep a native Naver link available even while geocoding is pending or
      // unavailable. Its destination upgrades from place search to directions
      // as soon as both stops are verified.
      find('#itineraryTransitMapRetry').hidden = !failed;
      find('#itineraryTransitMapRetry').setAttribute('aria-label', '장소 위치 다시 찾기');
      find('#itineraryTransitNaver').setAttribute('aria-busy', String(loading));
      find('#itineraryTransitNaver').classList.toggle('is-ready', !loading && !failed);
      find('#itineraryTransitNaver strong').textContent = loading ? '출발지와 도착지 위치를 찾고 있어요'
        : failed ? '장소 위치를 다시 확인해 주세요' : '출발지·도착지 위치';
      find('#itineraryTransitNaver p').textContent = loading ? '등록한 장소 이름과 여행 지역으로 길찾기를 준비하고 있어요.'
        : failed ? (draft.routeLookup?.failed ? '위치를 불러오지 못했어요. 지도 위 바로가기로 네이버지도에서 도착지를 검색하거나 다시 시도해 주세요.'
          : '일치하는 장소를 찾지 못했어요. 지도 위 바로가기로 네이버지도에서 도착지를 검색할 수 있어요.')
        : '지도에서 장소 위치를 확인하고, 아래 버튼으로 선택한 이동 수단의 상세 경로를 확인하세요.';
      find('#itineraryTransitGeocodeCredit').hidden = !urls.attribution;
      find('#itineraryTransitMap').setAttribute('aria-busy', 'false');
      syncMapLink();
      return;
    }
    let entry = routeFrames.get(routeMode);
    if (!entry) {
      const frame = document.createElement('iframe');
      frame.title = `${itineraryPlaceLabel(draft.previous)}에서 ${itineraryPlaceLabel(draft.item)}까지 Google ${routeMode === 'walking' ? '도보' : '대중교통'} 경로`;
      frame.loading = 'eager'; frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allowFullscreen = true;
      frame.dataset.routeMode = routeMode;
      entry = { frame, loaded: false, slow: false, timer: null };
      const current = entry;
      frame.addEventListener('load', () => { current.loaded = true; clearTimeout(current.timer); routeStatus(current); });
      frame.addEventListener('error', () => { current.slow = true; clearTimeout(current.timer); routeStatus(current); });
      routeFrames.set(routeMode, entry);
      frame.src = urls.embed; find('#itineraryTransitMap').appendChild(frame);
    }
    routeFrames.forEach((cached, mode) => { cached.frame.hidden = mode !== routeMode; });
    if (!entry.loaded && !entry.slow) {
      clearTimeout(entry.timer); const current = entry;
      entry.timer = setTimeout(() => { current.slow = true; routeStatus(current); }, 8000);
    }
    syncMapLink(); routeStatus(entry);
  }
  function selectView(view) {
    activeView = view === 'manual' ? 'manual' : 'route';
    dialog.dataset.transitView = activeView;
    find('#itineraryTransitRoutePanel').hidden = activeView !== 'route';
    find('#itineraryTransitManualPanel').hidden = activeView !== 'manual';
    find('#itineraryTransitRouteFooter').hidden = activeView !== 'route';
    find('#itineraryTransitManualFooter').hidden = activeView !== 'manual';
    dialog.querySelectorAll('[data-transit-view]').forEach(button => {
      const selected = button.dataset.transitView === activeView;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    find('.transit-editor-scroll').scrollTop = 0;
    if (activeView !== 'route') hideEmbeddedDomesticMap(find('#itineraryTransitDomesticMap'));
    dialog.querySelectorAll('.transit-segment-menu[open]').forEach(menu => { menu.open = false; });
    if (activeView === 'route') { renderJourney(); showRoute(); }
  }

  function context(id) {
    const item = findItineraryItem(id);
    if (!item) return null;
    const day = sortItineraryItems(state.itineraryItems.filter(row => row.date === item.date));
    const index = day.findIndex(row => row.id === id);
    return index > 0 ? { item, previous: day[index - 1] } : null;
  }
  function signature(value) {
    return JSON.stringify({ tripId: state.id, item: value.item, previous: value.previous,
      expense: value.item.expenseId ? state.entries.find(entry => entry.id === value.item.expenseId) : null });
  }
  function matchesSignature(value, captured) {
    const content = serialized => {
      const snapshot = JSON.parse(serialized);
      // Sync decode rebuilds object keys and attaches storage positions. The
      // actual neighboring stops are checked by context, not these positions.
      for (const row of [snapshot.item, snapshot.previous, snapshot.expense]) {
        if (row && typeof row === 'object') delete row._syncPosition;
      }
      return snapshot;
    };
    try { return window.TripLogSyncModel.equal(content(signature(value)), content(captured)); }
    catch (_) { return false; }
  }
  function normalized(row) {
    const { key, durationInput, ...segment } = row;
    if ('fromPlace' in segment) segment.fromPlace = String(segment.fromPlace || '').trim();
    if ('lineName' in segment) segment.lineName = String(segment.lineName || '').trim();
    if ('color' in segment && !/^#[0-9a-f]{6}$/i.test(segment.color || '')) delete segment.color;
    return { ...segment, trans: segment.trans || 'none', duration: Number(durationInput) || 0,
      cost: Number(segment.cost) || 0, memo: String(segment.memo || '').trim() };
  }
  function returnButton() {
    const target = returnFocus?.();
    return target?.isConnected ? target : [...document.querySelectorAll('[data-transit-open]')].find(button => button.dataset.id === draft?.id);
  }
  function fitViewport() {
    if (!dialog) return;
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    dialog.style.setProperty('--transit-view-height', `${height}px`);
    dialog.style.setProperty('--transit-keyboard-offset', `${Math.max(0, window.innerHeight - height - (viewport?.offsetTop || 0))}px`);
  }
  function clearError() {
    find('#itineraryTransitError').hidden = true;
    dialog.querySelectorAll('[aria-invalid]').forEach(input => { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); });
  }
  function error(message, input) {
    const element = find('#itineraryTransitError');
    element.textContent = message; element.hidden = false;
    if (input) {
      input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', element.id);
      input.focus({ preventScroll: true }); input.scrollIntoView({ block: 'nearest' });
    }
    element.scrollIntoView({ block: 'nearest' });
  }
  function updateSummary() {
    if (!draft) return;
    const values = draft.rows.map(validDuration);
    const total = values.reduce((sum, value) => sum + value, 0);
    const incomplete = values.filter(value => value === 0).length;
    find('#itineraryTransitTotal').textContent = total ? durationText(total) : '시간 미정';
    find('#itineraryTransitTotalLabel').textContent = incomplete && total ? '입력한 이동 시간' : '총 이동 시간';
    const start = departureTime();
    find('#itineraryTransitDeparture').textContent = start === null ? '—' : clockText(start);
    const scheduled = minutes(draft.item.time);
    const arrival = start !== null && total > 0 && !incomplete ? start + total : null;
    find('#itineraryTransitArrival').textContent = arrival === null ? '—' : clockText(arrival);
    const note = find('#itineraryTransitTiming');
    note.classList.remove('is-late');
    if (incomplete) note.textContent = `${incomplete}개 구간의 시간을 입력하면 예상 도착을 확인할 수 있어요.`;
    else if (start === null) note.textContent = '이전 장소의 출발 시각을 입력하면 예상 도착을 확인할 수 있어요.';
    else if (scheduled !== null && arrival > scheduled) {
      note.textContent = `다음 일정 시작보다 ${durationText(arrival - scheduled)} 늦게 도착할 수 있어요.`;
      note.classList.add('is-late');
    } else if (scheduled !== null) note.textContent = arrival === scheduled ? '다음 일정 시작 시각에 맞춰 도착해요.' : `다음 일정까지 ${durationText(scheduled - arrival)} 여유가 있어요.`;
    else note.textContent = '이전 장소에 입력한 시각을 기준으로 계산했어요.';
    note.hidden = !incomplete && start !== null && !(scheduled !== null && arrival > scheduled);
    const timing = journeyTimes();
    find('#itineraryTransitRoute').innerHTML = `<span class="transit-route-symbol">${icon('map-pin')}</span><div class="transit-route-copy"><div class="transit-route-places"><b>${escapeHtml(itineraryPlaceLabel(draft.previous))}</b>${icon('arrow-right')}<span>${icon('map-pin')}<b>${escapeHtml(itineraryPlaceLabel(draft.item))}</b></span></div><div class="transit-route-times"><span>${start === null ? '출발 시각 미정' : `${clockText(start)} 출발`}</span>${icon('arrow-right')}<span>${arrival === null ? '도착 시각 미정' : `${clockText(arrival)} 도착`}</span><span class="transit-route-total">${incomplete ? (total ? `입력한 시간 ${durationText(total)}` : '이동 시간 미정') : `총 ${durationText(total)}`}</span></div></div>`;
    draft.rows.forEach((row, index) => {
      const root = find(`[data-transit-key="${row.key}"]`);
      root.querySelector('[data-transit-step="-5"]').disabled = values[index] <= 0;
      root.querySelector('[data-transit-step="5"]').disabled = values[index] >= 1440;
      const mode = modeFor(row);
      root.dataset.transitMode = modeKey(row);
      root.style.setProperty('--leg-color', colorFor(row)); root.style.setProperty('--leg-tint', `${colorFor(row)}16`);
      root.querySelector('.transit-segment-icon').innerHTML = icon(mode.icon);
      root.querySelector('.transit-mode-icon').innerHTML = icon(mode.icon);
      const continuationName = root.querySelector('[data-transit-continuation-name]');
      if (continuationName) continuationName.textContent = mode.label;
      root.querySelector('[data-transit-time]').textContent = timing.starts[index] === null ? '—' : clockText(timing.starts[index]);
      const select = root.querySelector('select');
      Array.from(select.options).forEach(option => {
        option.textContent = option.value === 'none' ? '미정' : (itineraryTransitModes[option.value]?.label || '기타 이동');
      });
      syncCustomSelect(select);
      root.querySelectorAll('[data-transit-color]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.transitColor === colorFor(row))));
    });
    find('#itineraryTransitEndTime').textContent = arrival === null ? '—' : clockText(arrival);
    find('#itineraryTransitEndPlace').textContent = itineraryPlaceLabel(draft.item);
    find('#itineraryTransitEndAddress').textContent = draft.item.location || '';
    if (activeView === 'route') renderJourney();
  }
  function renderJourney() {
    if (!draft) return;
    const timing = journeyTimes();
    find('#itineraryTransitJourney').innerHTML = draft.rows.map((row, index) => {
      const mode = modeFor(row), duration = validDuration(row);
      const next = index + 1 < draft.rows.length ? transferName(draft.rows[index + 1], index + 1) : itineraryPlaceLabel(draft.item);
      const memo = String(row.memo || '').trim() || `${transferName(row, index)} → ${next}`;
      return `<li class="transit-journey-leg" data-transit-mode="${escapeHtml(modeKey(row))}" style="${legStyle(row)}">
        <div class="transit-journey-stop"><time>${timing.starts[index] === null ? '—' : clockText(timing.starts[index])}</time><span class="transit-stop-dot" aria-hidden="true"></span><div><strong>${escapeHtml(transferName(row, index))}</strong>${index === 0 && draft.previous.location ? `<small>${escapeHtml(draft.previous.location)}</small>` : ''}</div></div>
        <button type="button" class="transit-journey-edit" data-transit-edit="${row.key}" aria-label="이동 구간 ${index + 1} 수정"><span class="transit-journey-mode" aria-hidden="true">${icon(mode.icon)}</span><span class="transit-journey-detail"><span class="transit-journey-badge"><b>${escapeHtml(row.trans === 'none' ? '이동 수단 미정' : mode.label)}</b><span>${duration ? durationText(duration) : '시간 미정'}</span></span><span class="transit-journey-memo">${escapeHtml(memo)}</span></span>${icon('caret-right')}</button>
      </li>`;
    }).join('') + `<li class="transit-journey-destination"><div class="transit-journey-stop"><time>${timing.arrival === null ? '—' : clockText(timing.arrival)}</time><span class="transit-destination-pin" aria-hidden="true">${icon('map-pin')}</span><div><strong>${escapeHtml(itineraryPlaceLabel(draft.item))}</strong>${draft.item.location ? `<small>${escapeHtml(draft.item.location)}</small>` : ''}</div></div></li>`;
  }
  function renderRows() {
    find('#itineraryTransitSegments').innerHTML = draft.rows.map((row, index) => {
      const selected = row.trans === 'etc' ? 'flight' : row.trans || 'none';
      const choices = { ...itineraryTransitModes };
      const continuation = index > 0 && row.fromPlace?.trim() && row.fromPlace.trim() === draft.rows[index - 1].fromPlace?.trim();
      const transferInput = `<input type="text" data-transit-field="fromPlace" value="${escapeHtml(row.fromPlace || '')}" maxlength="100" aria-label="환승 ${index} 장소" placeholder="환승 장소 입력 (선택)">`;
      if (!choices[selected]) choices[selected] = { label: '기타 이동', icon: 'path' };
      return `<section class="transit-segment${continuation ? ' is-continuation' : ''}" data-transit-key="${row.key}" data-transit-mode="${escapeHtml(selected)}" style="${legStyle(row)}" aria-labelledby="transitSegment${row.key}">
        <h2 id="transitSegment${row.key}" class="transit-sr-only">이동 구간 ${index + 1}</h2>
        <div class="transit-segment-stop"><time data-transit-time></time><span class="transit-stop-dot" aria-hidden="true"></span><div class="transit-segment-place">${index === 0 ? `<strong>${escapeHtml(itineraryPlaceLabel(draft.previous))}</strong>${draft.previous.location ? `<small>${escapeHtml(draft.previous.location)}</small>` : ''}` : continuation ? `<strong data-transit-continuation-name>${escapeHtml(modeFor(row).label)}</strong>` : transferInput}</div></div>
        <details class="transit-segment-menu"><summary aria-label="이동 구간 ${index + 1} 옵션">${icon('dots-three-vertical')}</summary><div class="transit-segment-options">${continuation ? `<label>환승 장소 (선택)${transferInput}</label>` : ''}<label for="transitLine${row.key}">노선명 (선택)</label><input id="transitLine${row.key}" data-transit-field="lineName" type="text" value="${escapeHtml(row.lineName || '')}" maxlength="60" placeholder="노선명 입력 (선택)" aria-label="이동 구간 ${index + 1} 노선명">${draft.rows.length > 1 ? `<button type="button" class="transit-remove" data-transit-remove aria-label="이동 구간 ${index + 1} 삭제">${icon('trash')}구간 삭제</button><small class="transit-removal-note">저장 시 반영돼요.</small>` : ''}</div></details>
        <div class="transit-segment-icon" aria-hidden="true"></div>
        <div class="transit-segment-body"><div class="transit-segment-fields">
          <label class="transit-mode-field"><span>이동 수단</span><span class="transit-mode-control"><span class="transit-mode-icon" aria-hidden="true"></span><select id="transitMode${row.key}" data-transit-field="trans" aria-label="이동 구간 ${index + 1} 수단">${Object.entries(choices).map(([key, mode]) => `<option value="${escapeHtml(key)}"${key === selected ? ' selected' : ''}>${key === 'none' ? '미정' : mode.label}</option>`).join('')}</select></span></label>
          <div class="transit-duration-field"><label for="transitDuration${row.key}">이동 시간 (분)</label><div class="transit-stepper"><button type="button" data-transit-step="-5" aria-label="이동 구간 ${index + 1} 시간 5분 줄이기">${icon('minus')}</button><input id="transitDuration${row.key}" data-transit-field="duration" type="text" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="이동 구간 ${index + 1} 시간 (분)" value="${escapeHtml(row.durationInput)}" placeholder="미정"><button type="button" data-transit-step="5" aria-label="이동 구간 ${index + 1} 시간 5분 늘리기">${icon('plus')}</button></div></div>
          <div class="transit-colors" role="group" aria-label="이동 구간 ${index + 1} 색상">${transitColors.map(([color, name]) => `<button type="button" data-transit-color="${color}" style="--swatch:${color}" aria-label="이동 구간 ${index + 1} ${name}" title="${name}" aria-pressed="${color === colorFor(row)}">${icon('check')}</button>`).join('')}</div>
        </div>
        <div class="transit-memo"><label for="transitMemo${row.key}">이동 메모 (선택)</label><input id="transitMemo${row.key}" data-transit-field="memo" type="text" maxlength="120" placeholder="메모를 입력하세요." value="${escapeHtml(row.memo || '')}" aria-label="이동 구간 ${index + 1} 메모"></div>
        ${Number(row.cost) > 0 ? `<p class="transit-cost">${icon('coins')}기록된 이동 경비 ${escapeHtml(formatWon(Number(row.cost)))}${draft.item.syncExpense ? ' · 지출 연동' : ''}</p>` : ''}
        </div>
      </section>`;
    }).join('');
    window.TripLog.ui.formControls.enhance(find('#itineraryTransitSegments'));
    draft.rows.forEach((row, index) => customSelects.get(find(`#transitMode${row.key}`))?.button.setAttribute('aria-label', `이동 구간 ${index + 1} 수단`));
    updateSummary();
  }
  function setup() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.id = 'itineraryTransitDialog'; dialog.className = 'rd-dialog transit-editor';
    dialog.setAttribute('aria-labelledby', 'itineraryTransitTitle');
    dialog.innerHTML = `<header class="transit-editor-head"><h1 id="itineraryTransitTitle" tabindex="-1">이동 정보</h1><button type="button" class="transit-close" data-transit-cancel aria-label="이동 정보 닫기">${icon('x')}</button></header>
      <div class="transit-view-tabs" role="tablist" aria-label="이동 정보 보기"><button type="button" role="tab" id="itineraryTransitRouteTab" data-transit-view="route" aria-controls="itineraryTransitRoutePanel" aria-selected="true">Google 경로</button><button type="button" role="tab" id="itineraryTransitManualTab" data-transit-view="manual" aria-controls="itineraryTransitManualPanel" aria-selected="false" tabindex="-1">직접 기록</button></div>
      <div class="transit-editor-scroll"><div class="transit-route" id="itineraryTransitRoute"></div>
        <section id="itineraryTransitRoutePanel" role="tabpanel" aria-labelledby="itineraryTransitRouteTab">
          <div class="transit-map-stage">
          <div id="itineraryTransitModes" class="transit-map-toolbar"><div class="transit-map-modes" role="group" aria-label="Google 경로 이동 수단"><button type="button" data-transit-map-mode="driving" aria-pressed="false" hidden>${icon('car')}자동차</button><button type="button" data-transit-map-mode="transit" aria-pressed="true">${icon('train')}대중교통</button><button type="button" data-transit-map-mode="walking" aria-pressed="false">${icon('person-simple-walk')}도보</button></div><button type="button" id="itineraryTransitMapRetry" aria-label="Google 경로 다시 불러오기">${icon('arrow-clockwise')}</button></div>
          <div id="itineraryTransitMapArea"><div class="transit-map-shell"><div id="itineraryTransitMap" aria-busy="true"></div><p id="itineraryTransitMapStatus" role="status" aria-live="polite"></p></div></div>
          <div id="itineraryTransitDomesticMap" class="triplog-domestic-map" hidden></div>
          <a id="itineraryTransitMapLink" rel="noopener noreferrer" aria-label="지도에서 길찾기 열기" title="지도에서 길찾기 열기" hidden>${icon('arrow-square-out')}</a></div>
          <div id="itineraryTransitNaver" class="transit-route-empty" role="status" aria-live="polite" hidden>${icon('map-trifold')}<strong></strong><p></p><small id="itineraryTransitGeocodeCredit" hidden>장소 데이터 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></small></div>
          <div id="itineraryTransitRouteEmpty" class="transit-route-empty" hidden>${icon('map-pin')}<strong>장소가 정해지면 길을 안내해 드려요</strong><p id="itineraryTransitRouteEmptyText"></p><button type="button" id="itineraryTransitRecordInstead">이동 정보 직접 기록</button></div>
          <p class="transit-journey-caption">직접 기록한 이동 <span class="transit-map-note" tabindex="0" aria-label="이동 경로 안내">${icon('info')}<span>여행 날짜·출발 시각은 지도에서 확인해 주세요.</span></span></p><ol id="itineraryTransitJourney" class="transit-journey" aria-label="직접 기록한 이동 경로"></ol>
        </section>
        <section id="itineraryTransitManualPanel" role="tabpanel" aria-labelledby="itineraryTransitManualTab" hidden>
        <form id="itineraryTransitForm" novalidate><div class="transit-segments-frame"><div id="itineraryTransitSegments"></div><div class="transit-editor-destination transit-segment-stop"><time id="itineraryTransitEndTime"></time><span class="transit-destination-pin" aria-hidden="true">${icon('map-pin')}</span><div class="transit-segment-place"><strong id="itineraryTransitEndPlace"></strong><small id="itineraryTransitEndAddress"></small></div></div></div><button type="button" id="itineraryTransitAdd" class="transit-add">${icon('plus')}환승 구간 추가</button></form>
        <p class="transit-preserve transit-sr-only">저장해도 장소의 시작·종료 시각은 유지돼요.</p><p id="itineraryTransitError" class="transit-error" role="alert" hidden></p>
        </section>
        <section class="transit-estimate" aria-label="이동 시간 요약"><div class="transit-estimate-time"><span>출발</span><strong id="itineraryTransitDeparture"></strong></div><span class="transit-estimate-connection" aria-hidden="true">${icon('circle')}</span><div class="transit-estimate-duration"><span id="itineraryTransitTotalLabel">총 이동 시간</span><strong id="itineraryTransitTotal"></strong></div><span class="transit-estimate-connection is-arrival" aria-hidden="true">${icon('circle')}</span><div class="transit-estimate-time is-arrival"><span>도착</span><strong id="itineraryTransitArrival"></strong></div><p id="itineraryTransitTiming"></p></section>
      </div><footer id="itineraryTransitRouteFooter" class="transit-editor-footer"><button type="button" data-transit-cancel>닫기</button><a id="itineraryTransitGoogleLink" rel="noopener noreferrer">${icon('arrow-square-out')}<span>지도에서 열기</span></a></footer><footer id="itineraryTransitManualFooter" class="transit-editor-footer" hidden><button type="button" data-transit-cancel>취소</button><button type="submit" form="itineraryTransitForm" id="itineraryTransitSave" aria-describedby="itineraryTransitTiming">이동 저장</button></footer>`;
    document.body.appendChild(dialog); form = find('#itineraryTransitForm');
    window.addEventListener('resize', () => { if (dialog.open) fitViewport(); });
    window.visualViewport?.addEventListener('resize', () => { if (dialog.open) fitViewport(); });
    window.visualViewport?.addEventListener('scroll', () => { if (dialog.open) fitViewport(); });
    form.addEventListener('submit', save);
    find('#itineraryTransitGoogleLink').addEventListener('click', prepareNavigation);
    find('#itineraryTransitMapLink').addEventListener('click', prepareNavigation);
    find('.transit-view-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      selectView(event.key === 'Home' ? 'route' : event.key === 'End' ? 'manual' : activeView === 'route' ? 'manual' : 'route');
      find(`[data-transit-view="${activeView}"]`).focus();
    });
    const changeField = event => {
      const field = event.target.dataset.transitField;
      const row = draft?.rows.find(entry => entry.key === Number(event.target.closest('[data-transit-key]')?.dataset.transitKey));
      if (!field || !row) return;
      if (field === 'duration') row.durationInput = event.target.value.trim();
      else {
        if (field === 'trans' && row.trans !== event.target.value) {
          delete row.lineName; find(`#transitLine${row.key}`).value = '';
        }
        row[field] = event.target.value;
      }
      clearError(); updateSummary();
    };
    form.addEventListener('input', changeField); form.addEventListener('change', changeField);
    form.addEventListener('focusin', event => { if (event.target.dataset.transitField === 'duration') event.target.select(); });
    dialog.addEventListener('click', event => {
      dialog.querySelectorAll('.transit-segment-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
      if (event.target.closest('[data-transit-cancel]')) { dialog.close(); return; }
      if (event.target === dialog) {
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
        return;
      }
      const target = event.target.closest('button'); if (!target || !draft) return;
      if (target.dataset.transitEdit) {
        selectView('manual');
        customSelects.get(find(`#transitMode${target.dataset.transitEdit}`))?.button.focus();
        return;
      }
      if (target.dataset.transitView) { selectView(target.dataset.transitView); return; }
      if (target.dataset.transitMapMode) { routeMode = target.dataset.transitMapMode; showRoute(); return; }
      if (target.id === 'itineraryTransitRecordInstead') { selectView('manual'); find('#itineraryTransitManualTab').focus(); return; }
      if (target.id === 'itineraryTransitMapRetry') {
        if (isDomesticMapTrip()) { draft.routeLookup = null; showRoute(); return; }
        const entry = routeFrames.get(routeMode);
        if (entry) { clearTimeout(entry.timer); entry.frame.remove(); routeFrames.delete(routeMode); }
        showRoute(); return;
      }
      const key = Number(target.closest('[data-transit-key]')?.dataset.transitKey);
      const row = draft.rows.find(entry => entry.key === key);
      if (row && target.dataset.transitColor && transitColors.some(([color]) => color === target.dataset.transitColor)) {
        row.color = target.dataset.transitColor; clearError(); updateSummary(); return;
      }
      if (target.id === 'itineraryTransitAdd') {
        draft.rows.push({ key: ++serial, trans: 'walk', durationInput: '', cost: 0, memo: '' });
        clearError(); renderRows();
        customSelects.get(find(`#transitMode${serial}`))?.button.focus();
      } else if (target.hasAttribute('data-transit-remove') && draft.rows.length > 1) {
        const index = draft.rows.indexOf(row); draft.rows.splice(index, 1);
        clearError(); renderRows();
        const next = draft.rows[Math.min(index, draft.rows.length - 1)];
        customSelects.get(find(`#transitMode${next.key}`))?.button.focus();
      } else if (row && target.hasAttribute('data-transit-step')) {
        row.durationInput = String(Math.max(0, Math.min(1440, (Number(row.durationInput) || 0) + Number(target.dataset.transitStep))));
        find(`#transitDuration${key}`).value = row.durationInput;
        clearError(); updateSummary();
      }
    });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const menu = event.target.closest('.transit-segment-menu[open]');
      if (menu) { event.preventDefault(); event.stopPropagation(); menu.open = false; menu.querySelector('summary').focus(); }
    });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      hideEmbeddedDomesticMap(find('#itineraryTransitDomesticMap'));
      const target = returnButton();
      if (target?.matches('[data-transit-open], [data-summary-transit]')) target.setAttribute('aria-expanded', 'false');
      target?.focus({ preventScroll: true });
      clearNavigation(); routeFrames.forEach(entry => clearTimeout(entry.timer));
      draft = null; returnFocus = null;
    });
  }
  function open(id, previousId, preferredMode, options = {}) {
    setup(); if (dialog.open) return;
    const source = context(id);
    if (!source || source.previous.id !== previousId) { showToast('이동 구간이 변경됐어요. 일정을 다시 확인해 주세요.'); return; }
    returnFocus = typeof options.returnFocus === 'function' ? options.returnFocus : null;
    const rows = getItineraryTransits(source.item).map(segment => ({ ...clone(segment), key: ++serial,
      durationInput: Number(segment.duration) > 0 ? String(segment.duration) : '' }));
    draft = { id, tripId: state.id, previous: clone(source.previous), item: clone(source.item),
      signature: signature(source), rows, original: JSON.stringify(rows.map(normalized)) };
    const allowedModes = isDomesticMapTrip() ? ['driving', 'transit', 'walking'] : ['transit', 'walking'];
    routeMode = allowedModes.includes(preferredMode) ? preferredMode : rows.every(row => row.trans === 'walk') ? 'walking'
      : isDomesticMapTrip() && !rows.some(row => ['bus', 'train', 'flight'].includes(row.trans)) ? 'driving' : 'transit';
    clearError(); renderRows(); find('.transit-editor-scroll').scrollTop = 0;
    returnButton()?.setAttribute('aria-expanded', 'true'); fitViewport(); dialog.showModal();
    selectView(options.initialView);
    const input = activeView === 'manual' && rows[Math.max(0, Math.min(rows.length - 1, options.segmentIndex || 0))];
    (input ? find(`#transitDuration${input.key}`) : find('#itineraryTransitTitle')).focus({ preventScroll: true });
  }
  async function save(event) {
    event.preventDefault(); if (!draft || !dialog.open || submitting) return;
    clearError();
    for (const row of draft.rows) {
      if (row.durationInput && (!/^\d+$/.test(row.durationInput) || Number(row.durationInput) > 1440)) {
        error('이동 시간은 0~1,440분 사이의 정수로 입력해 주세요.', find(`#transitDuration${row.key}`)); return;
      }
    }
    const current = context(draft.id);
    if (draft.tripId !== state.id || getActiveTripId() !== state.id) { error('여행이 변경됐어요. 닫고 이동 정보를 다시 열어 주세요.'); return; }
    if (!current || !matchesSignature(current, draft.signature)) { error('일정이 다른 곳에서 변경됐어요. 닫고 이동 구간을 다시 확인해 주세요.'); return; }
    const segments = draft.rows.map(normalized);
    if (JSON.stringify(segments) === draft.original) { dialog.close(); return; }
    const previousItems = state.itineraryItems, previousEntries = state.entries, submittedTrip = state.id;
    const updated = { ...current.item, transits: segments };
    syncTransitTotals(updated);
    submitting = true; find('#itineraryTransitSave').disabled = true;
    try {
      // Edit a copy once. Changing duration must never shift a scheduled stop.
      state.itineraryItems = previousItems.map(item => item.id === updated.id ? updated : item);
      state.entries = [...previousEntries]; syncSegmentExpense(updated);
      if (!await saveAndRender()) {
        if (state.id === submittedTrip) { state.itineraryItems = previousItems; state.entries = previousEntries; render(); }
        error('저장하지 못했어요. 작성 내용은 유지되며 다시 저장할 수 있어요.'); return;
      }
      if (state.id !== submittedTrip) return;
      const target = returnButton();
      dialog.close(); target?.classList.add('is-saved');
      target?.addEventListener('animationend', () => target.classList.remove('is-saved'), { once: true });
      showToast('이동 정보를 저장했어요.');
    } finally { submitting = false; find('#itineraryTransitSave').disabled = false; }
  }
  try { pendingNavigation = JSON.parse(sessionStorage.getItem(navigationKey) || 'null'); } catch (_) { clearNavigation(); }
  if (pendingNavigation) {
    navigationObserver = new MutationObserver(restoreNavigation);
    navigationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-auth', 'data-app-ready'] });
    queueMicrotask(restoreNavigation);
  }
  window.addEventListener('pageshow', () => { if (dialog?.open) clearNavigation(); else restoreNavigation(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && dialog?.open) clearNavigation(); });
  window.TripLog.register('features.itinerary.transitEditor', { open });
})();
