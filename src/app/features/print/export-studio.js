(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const renderer = () => window.TripLog.features.print.renderer;
  const model = () => window.TripLog.features.print.model;
  const text = value => escapeHtml(String(value ?? ''));
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  let dialog, type = 'expense', options, result, pageIndex = 0, generation = 0, tripId = '', printing = false, originalTitle;
  const defaults = () => ({ itineraryDay: 'all', expensePeriod: 'all', charts: true, transit: true, notes: true });
  function setup() {
    if (dialog) return;
    dialog = window.TripLog.ui.dialog.create({ id: 'rdPdf', className: 'rd-dialog ex-dialog', labelledBy: 'exTitle',
      fallbackFocus: () => $('#rdMenuButton'), markup: `<header class="ex-studio-header"><img src="src/assets/triplog-wordmark.png" width="106" height="32" alt="TripLOG"><span>여행 내보내기</span><button type="button" data-ex-action="close" aria-label="내보내기 닫기">${icon('x')}</button></header>
      <div class="ex-workbench"><section class="ex-controls"><nav class="ex-type-tabs" aria-label="내보낼 내용"><button type="button" data-ex-type="itinerary">${icon('calendar-blank')}일정</button><button type="button" data-ex-type="expense">${icon('chart-bar')}지출</button><button type="button" data-ex-type="full">${icon('book-open')}전체</button></nav>
      <h1 id="exTitle" tabindex="-1"></h1><p id="exSubtitle" class="ex-studio-subtitle"></p><div id="exTripSummary"></div><div id="exOptions"></div><div id="exMobileItinerary" class="ex-mini-days"></div><div class="ex-included" id="exIncluded"></div><p id="exError" role="alert" hidden></p></section>
      <section class="ex-preview-area" aria-labelledby="exPreviewTitle"><div class="ex-preview-toolbar"><h2 id="exPreviewTitle">PDF 미리보기</h2><span class="ex-paper-size">A4 · 세로</span><button type="button" data-ex-action="zoom" aria-pressed="false">${icon('magnifying-glass-plus')}크게 보기</button></div><div id="exPreviewScroll" class="ex-preview-scroll"><div id="exPreviewViewport" class="ex-preview-viewport"><div id="exPreview" class="ex-preview-pages" aria-label="내보낼 PDF 페이지"></div></div></div><div class="ex-preview-pagination"><button type="button" data-ex-action="previous" aria-label="이전 페이지">${icon('caret-left')}</button><span id="exPageNumber" aria-live="polite"></span><button type="button" data-ex-action="next" aria-label="다음 페이지">${icon('caret-right')}</button></div></section></div>
      <footer class="ex-studio-footer"><strong id="exStatus" role="status">리포트를 준비하고 있어요.</strong><button type="button" data-ex-action="preview">${icon('eye')}미리보기</button><button type="button" id="exSave" data-ex-action="save">${icon('download-simple')}PDF 저장</button></footer>`
    });
    dialog.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.dataset.exType) {
        type = target.dataset.exType; pageIndex = 0; renderControls(); refresh(); return;
      }
      if (target.dataset.exDay !== undefined) {
        options.itineraryDay = target.dataset.exDay; pageIndex = 0; renderControls(); refresh(); return;
      }
      switch (target.dataset.exAction) {
        case 'close': dialog.close(); break;
        case 'previous': showPage(pageIndex - 1); break;
        case 'next': showPage(pageIndex + 1); break;
        case 'zoom': {
          const enlarged = target.getAttribute('aria-pressed') !== 'true';
          target.setAttribute('aria-pressed', String(enlarged));
          target.innerHTML = `${icon(enlarged ? 'arrows-in' : 'magnifying-glass-plus')}${enlarged ? '맞춰 보기' : '크게 보기'}`;
          fitPreview(); break;
        }
        case 'preview': $('.ex-preview-area').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); break;
        case 'save': print(); break;
      }
    });
    dialog.addEventListener('change', event => {
      const key = event.target.dataset.exOption;
      if (!key) return;
      options[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      pageIndex = 0; refresh();
    });
    dialog.addEventListener('close', () => {
      generation++; result = null;
      // Retain no stale trip document after the export surface is dismissed.
      $('#exPreview').replaceChildren();
      $('#exMobileItinerary').replaceChildren();
      if (!printing) els.printReport.replaceChildren();
    });
    new ResizeObserver(fitPreview).observe($('#exPreviewScroll'));
    window.addEventListener('afterprint', () => { if (originalTitle) { document.title = originalTitle; originalTitle = ''; } });
  }
  const toggle = (key, title, description) => `<label class="ex-switch-row"><span><strong>${title}</strong><small>${description}</small></span><input type="checkbox" data-ex-option="${key}" ${options[key] ? 'checked' : ''}><span class="ex-switch-track" aria-hidden="true"></span></label>`;
  function renderControls() {
    const current = renderer().data();
    dialog.dataset.exportType = type;
    dialog.querySelectorAll('[data-ex-type]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.exType === type)));
    $('#exTitle').textContent = type === 'itinerary' ? '시간으로 보는 여행' : type === 'expense' ? '지출을 한눈에' : '한 권의 여행 기록';
    $('#exSubtitle').textContent = type === 'itinerary' ? '날짜별 시간표와 상세 일정을 함께 담아요.' : type === 'expense' ? '여행의 쓰임부터 모든 지출 내역까지.' : '일정과 지출을 하나의 PDF로 정리해요.';
    $('#exTripSummary').innerHTML = `<div class="ex-trip-summary"><div><strong>${text(state.tripName || getDefaultTripName())}</strong><span>${text(renderer().periodLabel(current))}</span><small>${icon('users')}${current.members}명${current.calendar.length ? ` · ${current.calendar.length}일` : ''}</small></div>${renderer().sceneMarkup(state, 'ex-studio-art')}</div>`;
    let controls = '';
    if (type !== 'expense') {
      controls += `<section class="ex-control-section"><h2>내보낼 일정</h2><div class="ex-day-options" aria-label="내보낼 날짜"><button type="button" data-ex-day="all" aria-pressed="${options.itineraryDay === 'all'}">전체</button>${current.allDates.map(date => { const index = current.calendar.indexOf(date) + 1, key = date || '__undated__'; return `<button type="button" data-ex-day="${text(key)}" aria-pressed="${options.itineraryDay === key}">${index ? `DAY ${index}` : text(model().dateLabel(date))}</button>`; }).join('')}</div></section>`;
      controls += toggle('transit', '이동 정보 포함', '이동 수단·시간·메모를 상세 일정에 표시해요.');
    }
    if (type !== 'itinerary') {
      const dates = [...new Set(current.allEntries.map(entry => entry.date).filter(date => model().dateValue(date) !== null))].sort();
      controls += `<section class="ex-control-section"><label for="exExpensePeriod">내보낼 지출 기간</label><select id="exExpensePeriod" aria-label="내보낼 지출 기간" data-ex-option="expensePeriod"><option value="all">전체 기간 · 사전구매 포함</option>${current.allEntries.some(entry => entry.date === '__pretrip__') ? `<option value="__pretrip__" ${options.expensePeriod === '__pretrip__' ? 'selected' : ''}>사전구매</option>` : ''}${dates.map(date => `<option value="${date}" ${options.expensePeriod === date ? 'selected' : ''}>${text(model().dateLabel(date, true))}</option>`).join('')}</select></section>`;
      controls += toggle('charts', '차트 포함', '항목별 비중과 일자별 지출을 함께 담아요.');
    }
    controls += toggle('notes', type === 'itinerary' ? '주소·메모 포함' : '메모 포함', type === 'itinerary' ? '장소의 상세 주소와 남긴 메모를 표시해요.' : '기록에 남긴 메모도 빠짐없이 담아요.');
    $('#exOptions').innerHTML = controls;
  }
  function showPage(index) {
    if (!result) return;
    pageIndex = Math.max(0, Math.min(result.pages - 1, index));
    $('#exPreview').querySelectorAll('.ex-paper').forEach((paper, number) => { paper.hidden = number !== pageIndex; });
    $('#exPageNumber').textContent = `${pageIndex + 1} / ${result.pages} 페이지`;
    $('[data-ex-action="previous"]').disabled = pageIndex === 0;
    $('[data-ex-action="next"]').disabled = pageIndex === result.pages - 1;
    fitPreview();
  }
  function fitPreview() {
    if (!dialog?.open || !result) return;
    const scroll = $('#exPreviewScroll'), viewport = $('#exPreviewViewport'), preview = $('#exPreview');
    const zoom = $('[data-ex-action="zoom"]').getAttribute('aria-pressed') === 'true';
    const paperWidth = 210 * 96 / 25.4, paperHeight = 297 * 96 / 25.4;
    const scale = zoom ? 1 : Math.min(1, Math.max(0.1, (scroll.clientWidth - 4) / paperWidth));
    viewport.style.width = `${paperWidth * scale}px`; viewport.style.height = `${paperHeight * scale}px`;
    preview.style.transform = `scale(${scale})`;
  }
  function renderMobileItinerary(report) {
    const mount = $('#exMobileItinerary');
    mount.innerHTML = type === 'expense' ? '' : report.days.map((day, index) => `<details class="ex-mini-day" ${index === 0 ? 'open' : ''}><summary>${day.index ? `<b>DAY ${day.index}</b>` : ''}<span>${text(day.label)}</span>${icon('caret-down')}</summary><ol>${day.items.map(item => {
      const appearance = renderer();
      const theme = window.TripLog.shared.itineraryArt.presentation(item);
      const transit = options.transit ? formatPrintTransitSummary(item) : '';
      return `<li><time>${text(item.time || '미정')}</time><div class="ex-mini-stop has-art" style="--ex-event:${appearance.eventColors[item.theme] || appearance.eventColors.etc}"><strong>${icon(theme.icon)}${text(item.place || '장소 미정')}</strong>${options.notes && item.memo ? `<small>${text(item.memo)}</small>` : ''}${appearance.eventArt(item, 'ex-mini-art')}</div>${transit ? `<span class="ex-mini-transit">${text(transit)}</span>` : ''}</li>`;
    }).join('') || '<li class="ex-mini-empty">아직 등록한 일정이 없어요.</li>'}</ol></details>`).join('');
  }
  async function refresh() {
    const ticket = ++generation;
    $('#exSave').disabled = true; $('#exPreview').setAttribute('aria-busy', 'true'); $('#exError').hidden = true;
    $('#exStatus').textContent = '리포트를 준비하고 있어요.';
    try {
      await document.fonts.ready;
      if (ticket !== generation || !dialog.open) return null;
      if (tripId !== state.id) { tripId = state.id; options = defaults(); pageIndex = 0; renderControls(); }
      const latest = renderer().data();
      let resetScope = false;
      if (options.expensePeriod !== 'all' && !latest.allEntries.some(entry => entry.date === options.expensePeriod)) { options.expensePeriod = 'all'; resetScope = true; }
      if (options.itineraryDay !== 'all' && !latest.allDates.includes(options.itineraryDay === '__undated__' ? '' : options.itineraryDay)) { options.itineraryDay = 'all'; resetScope = true; }
      if (resetScope) { pageIndex = 0; renderControls(); }
      result = buildPrintReport(type, options);
      $('#exPreview').innerHTML = result.markup;
      renderMobileItinerary(result.data);
      const count = type === 'itinerary' ? `일정 ${result.data.itemCount}개` : type === 'expense' ? `지출 ${result.data.entries.length}건 전체 포함` : `일정 ${result.data.itemCount}개 · 지출 ${result.data.entries.length}건 전체 포함`;
      $('#exIncluded').innerHTML = `${icon('check-circle')}<span><strong>${count}</strong>${type === 'itinerary' ? '' : '<small>내역이 길면 다음 페이지로 이어져요.</small>'}</span>`;
      $('#exStatus').textContent = '';
      $('#exPreview').setAttribute('aria-busy', 'false');
      $('#exSave').disabled = false; showPage(pageIndex); return result;
    } catch (error) {
      if (ticket !== generation) return null;
      $('#exError').hidden = false; $('#exError').textContent = '리포트를 만들지 못했어요. 내보내기 창을 다시 열어 주세요.';
      $('#exStatus').textContent = '미리보기를 다시 확인해 주세요.'; $('#exPreview').setAttribute('aria-busy', 'false');
      console.error('TripLOG report preview failed', error); return null;
    }
  }
  async function print() {
    if (printing) return;
    printing = true;
    try {
      // Rebuild immediately before printing so live edits and selected scope
      // cannot leave totals and the full ledger out of sync.
      const prepared = await refresh(); if (!prepared || !dialog.open) return;
      const printGeneration = generation, printTripId = state.id;
      $('#exSave').disabled = true; $('#exStatus').textContent = 'PDF에 들어갈 그림을 준비하고 있어요.';
      await Promise.all([...els.printReport.querySelectorAll('img')].map(async image => {
        let timer;
        try { await Promise.race([image.decode().catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, 5000); })]); }
        finally { clearTimeout(timer); }
        // The bundled fallback uses the same existing destination-image error
        // handler as the trip header. Never print a broken image placeholder.
        if (!image.complete || !image.naturalWidth) image.hidden = true;
      }));
      if (!dialog.open || generation !== printGeneration || state.id !== printTripId) return;
      await new Promise(resolve => requestAnimationFrame(resolve));
      originalTitle = document.title;
      document.title = `${state.tripName || '여행'}_${type === 'itinerary' ? '일정' : type === 'expense' ? '지출' : '전체리포트'}_TripLOG`;
      window.print();
    } finally {
      printing = false;
      if (dialog.open && result && $('#exPreview').getAttribute('aria-busy') !== 'true') { $('#exSave').disabled = false; $('#exStatus').textContent = ''; }
    }
  }
  function open(requestedType = 'expense') {
    setup(); type = ['expense', 'itinerary', 'full'].includes(requestedType) ? requestedType : 'expense';
    options = defaults(); pageIndex = 0; tripId = state.id;
    renderControls();
    window.TripLog.ui.dialog.open(dialog); refresh();
  }
  window.TripLog.register('features.print.studio', { setup, open, refresh, print });
})();
