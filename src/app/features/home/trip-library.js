(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const text = value => escapeHtml(String(value ?? ''));
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
  const R = () => window.TripLogSyncRepository;
  const VIEW_STORAGE_KEY = 'triplog.tripLibraryView.v1';
  function readViewPreference() {
    try { return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'passport'; }
    catch (_) { return 'passport'; }
  }
  let filter = 'all', opening = '', removing = '', ready = false;
  let viewMode = readViewPreference(), viewAnimation = null;
  let pendingInitialTrip = new URLSearchParams(location.search).get('trip') || '';
  const today = () => window.TripLog.features.redesign.model.localDate();
  const statusLabels = { upcoming: 'UP NEXT', ongoing: 'ON THE GO', past: 'MEMORIES', undated: 'PLANNING' };
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function status(trip, date = today()) {
    if (!validDate(trip.startDate) || !validDate(trip.endDate) || trip.endDate < trip.startDate) return 'undated';
    if (trip.endDate < date) return 'past';
    return trip.startDate > date ? 'upcoming' : 'ongoing';
  }
  function badge(trip, date = today()) {
    const group = status(trip, date);
    if (group !== 'upcoming') return statusLabels[group];
    const days = Math.round((Date.parse(`${trip.startDate}T12:00:00`) - Date.parse(`${date}T12:00:00`)) / 86400000);
    return `${statusLabels.upcoming} · D-${days}`;
  }
  function dates(trip) {
    if (!validDate(trip.startDate) || !validDate(trip.endDate) || trip.endDate < trip.startDate) return '날짜를 정해 주세요';
    const sameYear = trip.startDate.slice(0, 4) === trip.endDate.slice(0, 4);
    const start = sameYear ? trip.startDate : trip.startDate.slice(2), end = sameYear ? trip.endDate.slice(5) : trip.endDate.slice(2);
    return `${start.replaceAll('-', '.')} – ${end.replaceAll('-', '.')}`;
  }
  function cover(trip) {
    if (trip.countryCode === 'JP' || /일본|japan/i.test(trip.country || '')) return 'pink';
    const domestic = trip.countryCode === 'KR' || trip.travelMode === 'domestic';
    const place = trip.city || trip.tripName || '';
    if (domestic && /제주|jeju/i.test(place)) return 'mint';
    if (domestic && /강릉|속초|동해|부산|gangneung|busan/i.test(place)) return 'blue';
    return 'generic';
  }
  function destination(trip) {
    const known = { 강릉: 'GANGNEUNG', 제주: 'JEJU', 제주도: 'JEJU', 오사카: 'OSAKA', 교토: 'KYOTO', 서울: 'SEOUL', 부산: 'BUSAN' };
    const city = String(trip.city || '').trim();
    let country = trip.country || '';
    try { if (/^[A-Z]{2}$/.test(trip.countryCode || '')) country = new Intl.DisplayNames(['en'], { type: 'region' }).of(trip.countryCode); } catch (_) { /* Keep the saved country name. */ }
    if (trip.countryCode === 'KR') country = 'REPUBLIC OF KOREA';
    return [known[city] || city.toUpperCase() || 'MY JOURNEY', String(country).toUpperCase()];
  }
  function trips() {
    // The repository already isolates the authenticated account. Never inject
    // the previous active trip or show an automatic empty migration placeholder.
    return window.TripLog.persistence.stateStorage.getTrips().filter(trip => { const record = R()?.cached(trip.id); return !record?.placeholder && !record?.hidden; });
  }
  function markup() {
    return `<section class="tl-library" data-view="${viewMode}" aria-labelledby="tripLibraryTitle">
      <div class="tl-library-heading"><h1 id="tripLibraryTitle">내 여행</h1><p>떠날 여행도, 다녀온 순간도</p></div>
      <div class="tl-library-search" role="search">${icon('magnifying-glass')}<input id="tripLibrarySearch" type="search" placeholder="여행 이름이나 여행지 검색" aria-label="여행 이름이나 여행지 검색" autocomplete="off"><button id="tripLibrarySearchClear" type="button" aria-label="여행 검색 지우기" hidden>${icon('x')}</button></div>
      <div class="tl-library-filters" id="rdTripTabs" role="group" aria-label="여행 기간 필터">${[['all', 'ALL'], ['upcoming', statusLabels.upcoming], ['ongoing', statusLabels.ongoing], ['past', statusLabels.past]].map(([key, label]) => `<button type="button" data-library-filter="${key}" aria-pressed="${key === 'all'}" ${key === 'ongoing' ? 'hidden' : ''}>${label}<span>0</span></button>`).join('')}</div>
      <div class="tl-library-toolbar">
        <p class="tl-library-count" id="tripLibraryResult" role="status" aria-live="polite"></p>
        <div class="tl-library-view-switch" role="group" aria-label="여행 보기 방식">
          <button type="button" data-library-view="passport" aria-pressed="${viewMode === 'passport'}" aria-controls="rdTripList">${icon('squares-four')}<span>여권</span></button>
          <button type="button" data-library-view="list" aria-pressed="${viewMode === 'list'}" aria-controls="rdTripList">${icon('list-dashes')}<span>목록</span></button>
        </div>
      </div>
      <div class="tl-library-empty" id="tripLibraryEmpty" hidden></div>
      <div class="tl-library-grid" id="rdTripList"><div id="tripLibraryItems"></div>
        <button type="button" id="rdTripCreate" class="tl-passport tl-passport-new" data-rd-action="new-trip" aria-label="새 여행 만들기">
          <img class="tl-passport-art" src="src/assets/home-passport-new.webp" alt="" width="174" height="268">
          <span class="tl-passport-new-copy"><span class="tl-passport-plus">${icon('plus')}</span><strong>새 여행 만들기</strong><span>새로운 여행을 기록할<br>여권을 만들어보세요</span></span>
        </button>
      </div>
    </section>`;
  }
  function card(trip, date, canRemove) {
    const [city, country] = destination(trip), group = status(trip, date), name = trip.tripName || '새로운 여행';
    return `<div class="tl-passport-entry"><button type="button" class="tl-passport cover-${cover(trip)}" data-library-trip="${text(trip.id)}" aria-label="${text(name)} 여행 열기" ${opening || removing ? 'disabled' : ''}>
      <img class="tl-passport-art" src="src/assets/home-passport-${cover(trip)}.webp" alt="" width="174" height="268" loading="lazy" decoding="async">
      <span class="tl-passport-head"><img src="src/assets/triplog-wordmark.png" alt="" width="48" height="16">${icon('airplane-tilt')}</span>
      <span class="tl-passport-copy"><strong>${text(name)}</strong><span class="tl-passport-dates">${text(dates(trip))}</span><span class="tl-passport-status is-${group}">${opening === trip.id ? '여는 중' : text(badge(trip, date))}</span></span>
      <span class="tl-passport-foot"><span><b>${text(city)}</b><small>${text(country)}</small></span>${icon('identification-card')}</span>
    </button><button type="button" class="tl-passport-remove" data-library-remove="${text(trip.id)}" aria-label="${text(name)} 여행 제거" title="${canRemove ? '여행 제거' : '마지막 여행은 삭제할 수 없어요'}" ${opening || removing || !canRemove ? 'disabled' : ''}>${icon(removing === trip.id ? 'hourglass' : 'x')}</button></div>`;
  }
  function listCard(trip, date, canRemove) {
    const group = status(trip, date), name = trip.tripName || '새로운 여행';
    const place = [trip.city, trip.country].filter(Boolean).join(' · ') || '목적지 미정';
    const label = group === 'upcoming' ? badge(trip, date).replace(`${statusLabels.upcoming} · `, '')
      : { ongoing: '여행 중', past: '지난 여행', undated: '계획 중' }[group];
    return `<div class="tl-passport-entry tl-trip-list-entry">
      <button type="button" class="tl-trip-row cover-${cover(trip)}" data-library-trip="${text(trip.id)}" aria-label="${text(name)} 여행 열기" ${opening || removing ? 'disabled' : ''}>
        <span class="tl-trip-row-art" aria-hidden="true"><img src="src/assets/home-passport-${cover(trip)}.webp" alt="" width="174" height="268" loading="lazy" decoding="async"></span>
        <span class="tl-trip-row-copy"><strong>${text(name)}</strong><span class="tl-trip-row-destination">${icon('map-pin')}<span>${text(place)}</span></span><span class="tl-trip-row-dates">${icon('calendar-blank')}<span>${text(dates(trip))}</span></span></span>
        <span class="tl-trip-row-status is-${group}">${opening === trip.id ? '여는 중' : text(label)}</span>
      </button>
      <button type="button" class="tl-trip-row-remove" data-library-remove="${text(trip.id)}" aria-label="${text(name)} 여행 제거" title="${canRemove ? '여행 제거' : '마지막 여행은 삭제할 수 없어요'}" ${opening || removing || !canRemove ? 'disabled' : ''}>${icon(removing === trip.id ? 'hourglass' : 'trash')}</button>
    </div>`;
  }
  function setViewMode(value) {
    if (!['passport', 'list'].includes(value) || value === viewMode) return;
    viewMode = value;
    // A device display preference, never a trip mutation or a sync command.
    try { localStorage.setItem(VIEW_STORAGE_KEY, value); } catch (_) { /* Keep this session usable when storage is unavailable. */ }
    if (viewAnimation) { viewAnimation.stop(); viewAnimation = null; }
    const grid = $('#rdTripList');
    grid.style.removeProperty('opacity'); grid.style.removeProperty('transform');
    render();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.TripLogMotion?.animate) return;
    try {
      const control = window.TripLogMotion.animate(grid,
        { opacity: [.65, 1], transform: ['translateY(6px)', 'translateY(0px)'] },
        { duration: .2, ease: [.22, 1, .36, 1] });
      viewAnimation = control;
      const finishAnimation = () => {
        if (viewAnimation !== control) return;
        viewAnimation = null;
        grid.style.removeProperty('opacity'); grid.style.removeProperty('transform');
      };
      Promise.resolve(control).then(finishAnimation, finishAnimation);
    } catch (_) {
      grid.style.removeProperty('opacity'); grid.style.removeProperty('transform');
    }
  }
  function render() {
    if (!ready) return;
    const editing = window.TripLog.features.redesign.workspace.isTripEditing();
    $('.tl-library').hidden = editing;
    if (editing) return;
    $('.tl-library').dataset.view = viewMode;
    document.querySelectorAll('[data-library-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.libraryView === viewMode)));
    const all = trips(), date = today(), query = normalize($('#tripLibrarySearch').value);
    const loading = !all.length && !window.TripLog.features.collaboration.tripCollaboration.isTripListReady();
    const counts = { all: all.length, upcoming: 0, ongoing: 0, past: 0 };
    all.forEach(trip => { const key = status(trip, date); if (key in counts) counts[key]++; });
    document.querySelectorAll('[data-library-filter]').forEach(button => {
      const key = button.dataset.libraryFilter;
      button.querySelector('span').textContent = counts[key];
      button.setAttribute('aria-pressed', String(key === filter));
      button.hidden = key === 'ongoing' && !counts.ongoing && filter !== 'ongoing';
    });
    const order = { ongoing: 0, upcoming: 1, undated: 2, past: 3 };
    const visible = all.filter(trip => (filter === 'all' || status(trip, date) === filter) && normalize([trip.tripName, trip.city, trip.country].join(' ')).includes(query))
      .sort((a, b) => order[status(a, date)] - order[status(b, date)] || (status(a, date) === 'past' ? String(b.startDate).localeCompare(String(a.startDate)) : String(a.startDate).localeCompare(String(b.startDate))) || String(a.id).localeCompare(String(b.id)));
    $('#tripLibrarySearchClear').hidden = !$('#tripLibrarySearch').value;
    $('#tripLibraryResult').textContent = loading ? '여행을 불러오는 중' : `${visible.length}개의 여행`;
    const renderTrip = viewMode === 'list' ? listCard : card;
    const list = $('#tripLibraryItems'), html = visible.map(trip => renderTrip(trip, date, all.length > 1)).join('');
    if (list.innerHTML !== html) {
      const focused = document.activeElement?.dataset.libraryTrip;
      const focusedRemove = document.activeElement?.dataset.libraryRemove;
      list.innerHTML = html;
      if (focused) [...list.querySelectorAll('[data-library-trip]')].find(button => button.dataset.libraryTrip === focused)?.focus({ preventScroll: true });
      if (focusedRemove) [...list.querySelectorAll('[data-library-remove]')].find(button => button.dataset.libraryRemove === focusedRemove)?.focus({ preventScroll: true });
    }
    $('#rdTripList').setAttribute('aria-busy', String(Boolean(opening || removing) || loading));
    $('#rdTripCreate').disabled = Boolean(opening || removing) || loading;
    const empty = $('#tripLibraryEmpty');
    empty.hidden = Boolean(visible.length);
    empty.innerHTML = loading ? '<strong>여행을 불러오고 있어요</strong><p>저장된 여행을 확인하고 있어요.</p>' : !all.length ? `<strong>${viewMode === 'list' ? '첫 여행을 만들어볼까요?' : '첫 여행의 여권을 만들어볼까요?'}</strong><p>여행을 만들면 일정과 지출을 함께 기록할 수 있어요.</p>`
      : `<strong>${query ? '검색 결과가 없어요' : '이 기간의 여행이 없어요'}</strong><p>${query ? '다른 여행 이름이나 여행지를 찾아보세요.' : '다른 기간을 선택하거나 새 여행을 만들어보세요.'}</p><button type="button" data-library-reset>전체 여행 보기</button>`;
  }
  async function openTrip(id) {
    if (opening || removing) return;
    if (!trips().some(trip => trip.id === id)) { render(); showToast('여행 목록이 변경됐어요. 다시 선택해 주세요.'); return; }
    const account = window.TripLog.sync.controller.getAccount()?.id;
    opening = id; render();
    try {
      const saved = await window.TripLog.persistence.stateStorage.switchTrip(id);
      if (saved === false) { showToast('여행을 열지 못했어요. 저장 상태를 확인하고 다시 시도해 주세요.'); return; }
      if (state.id !== id || account !== window.TripLog.sync.controller.getAccount()?.id || !trips().some(trip => trip.id === id)) return;
      window.TripLog.features.redesign.workspace.navigate('overview');
    } finally { opening = ''; render(); }
  }
  async function removeTrip(id) {
    if (opening || removing || !trips().some(trip => trip.id === id)) return;
    const account = window.TripLog.sync.controller.getAccount()?.id;
    removing = id; render();
    try {
      if (await window.TripLog.persistence.stateStorage.deleteTrip(id)
          && account === window.TripLog.sync.controller.getAccount()?.id) showToast('여행을 목록에서 제거했어요.');
    } finally {
      removing = ''; render();
      if (activePage === 'start') ([...document.querySelectorAll('[data-library-remove]')].find(button => button.dataset.libraryRemove === id) || $('#tripLibrarySearch'))?.focus({ preventScroll: true });
    }
  }
  function setup() {
    if (ready) return;
    ready = true;
    $('#tripLibrarySearch').addEventListener('input', render);
    $('#tripLibrarySearch').addEventListener('keydown', event => { if (event.key === 'Escape') { event.target.value = ''; render(); } });
    $('#tripLibrarySearchClear').addEventListener('click', () => { $('#tripLibrarySearch').value = ''; render(); $('#tripLibrarySearch').focus(); });
    $('.tl-library').addEventListener('click', event => {
      const view = event.target.closest('[data-library-view]');
      if (view) { setViewMode(view.dataset.libraryView); return; }
      const period = event.target.closest('[data-library-filter]');
      if (period) { filter = period.dataset.libraryFilter; render(); return; }
      if (event.target.closest('[data-library-reset]')) { filter = 'all'; $('#tripLibrarySearch').value = ''; render(); return; }
      const remove = event.target.closest('[data-library-remove]');
      if (remove) { removeTrip(remove.dataset.libraryRemove).catch(() => showToast('여행을 제거하지 못했어요. 다시 시도해 주세요.')); return; }
      const trip = event.target.closest('[data-library-trip]');
      if (trip) openTrip(trip.dataset.libraryTrip).catch(() => showToast('여행을 열지 못했어요. 다시 시도해 주세요.'));
    });
    $('.tl-library-view-switch').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const focusedView = event.target.closest('[data-library-view]');
      if (!focusedView) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'passport' : event.key === 'End' ? 'list' : focusedView.dataset.libraryView === 'list' ? 'passport' : 'list';
      setViewMode(next);
      $(`[data-library-view="${next}"]`).focus({ preventScroll: true });
    });
    let renderFrame;
    const requestRender = () => {
      if (activePage !== 'start' || renderFrame) return;
      renderFrame = requestAnimationFrame(() => { renderFrame = null; if (activePage === 'start') render(); });
    };
    R()?.subscribe(requestRender);
    window.addEventListener('triplog:sync-status', requestRender);
    // Old home bookmarks should reach the collection, while explicit trip links
    // and links directly to an itinerary/expense screen keep their intent.
    if (activePage === 'start') { pendingInitialTrip = ''; history.replaceState({ page: 'start' }, '', window.TripLog.navigation.pageRouter.pageUrl('start')); }
    render();
  }
  function reconcileInitialTrip() {
    if (!pendingInitialTrip || activePage === 'start') return true;
    if (state.id === pendingInitialTrip && trips().some(trip => trip.id === pendingInitialTrip)) { pendingInitialTrip = ''; return true; }
    if (!window.TripLog.features.collaboration.tripCollaboration.isTripListReady()) return false;
    pendingInitialTrip = '';
    window.TripLog.features.redesign.workspace.navigate('start');
    showToast('이 여행을 찾을 수 없어요. 보관함에서 여행을 선택해 주세요.');
    return false;
  }
  window.TripLog.register('features.home.tripLibrary', { markup, setup, render, openTrip, reconcileInitialTrip, trips, status, statusLabels, badge, dates, cover });
})();
