// Public entry points are shared by the settings, itinerary and expense pages.
// Export opens the preview; the explicit save action opens the print dialog.
function exportPdf(type = 'expense') {
  return window.TripLog.features.print.studio.open(type);
}
function exportExpensePdf() { return exportPdf('expense'); }
function exportItineraryPdf() { return exportPdf('itinerary'); }
function exportFullPdf() { return exportPdf('full'); }
function getFilteredEntriesForPrint() {
  return window.TripLog.features.print.model.sortedEntries(state.entries);
}
function getSortedItineraryItemsForPrint() { return sortItineraryItems(state.itineraryItems || []); }
function formatPrintTimeRange(item) {
  const range = window.TripLog.features.print.model.timeRange(item);
  if (range.start === null) return item.endTime ? `종료 ${item.endTime}` : '시간 미정';
  if (range.end === null) return item.time;
  const days = Math.floor(range.end / 1440);
  return `${item.time} – ${days ? `${days === 1 ? '다음날' : days + '일 후'} ` : ''}${item.endTime}`;
}
function getPrintTransitLabel(trans) {
  return window.TripLog.features.print.model.transitMode(trans).label;
}
function getPrintTransitSegments(item) {
  const source = Array.isArray(item?.transits) && item.transits.length ? item.transits : [{ trans: item?.trans, duration: item?.duration, cost: item?.cost }];
  return source.filter(segment => segment && typeof segment === 'object' && (
    (segment.trans && segment.trans !== 'none') || Number(segment.duration) > 0 || Number(segment.cost) || segment.memo || segment.fromPlace
  ));
}
function formatPrintTransitSegment(segment, emoji = false) {
  const model = window.TripLog.features.print.model, mode = model.transitMode(segment?.trans);
  const duration = model.number(segment?.duration), cost = model.number(segment?.cost);
  const minutes = duration > 0 ? `${duration.toLocaleString('ko-KR')}분` : '';
  const lead = emoji ? `${mode.emoji} ${minutes || mode.label}` : [mode.label, minutes].filter(Boolean).join(' · ');
  return [segment?.fromPlace || '', lead, cost ? formatWon(cost) : '', segment?.memo || ''].filter(Boolean).join(' · ');
}
function formatPrintTransitSummary(item, emoji = false) {
  return getPrintTransitSegments(item).map(segment => formatPrintTransitSegment(segment, emoji)).join(' / ');
}
function formatPrintTransitHint(item) {
  const model = window.TripLog.features.print.model;
  return getPrintTransitSegments(item).map(segment => {
    const mode = model.transitMode(segment.trans), duration = model.number(segment.duration);
    return `${mode.emoji} ${duration > 0 ? `${duration.toLocaleString('ko-KR')}분` : mode.label}`;
  }).join(' · ');
}
function buildPrintReport(type = 'expense', options = {}) {
  const result = window.TripLog.features.print.renderer.build(type, options);
  els.printReport.dataset.reportType = type;
  els.printReport.innerHTML = result.markup;
  return result;
}
function buildExpensePrintSections() { return window.TripLog.features.print.renderer.build('expense').markup; }
function buildItineraryPrintSections() { return window.TripLog.features.print.renderer.build('itinerary').markup; }

(() => {
  'use strict';
  const M = () => window.TripLog.features.print.model;
  const text = value => escapeHtml(String(value ?? ''));
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const eventColors = { transport: '#f9d6e2', sightseeing: '#d9effb', food: '#d9effb', lodging: '#fff5b5', shopping: '#f9d6e2', etc: '#eae3f5' };
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-export-art')) return;
    for (const key of ['artFallback', 'artUniversal']) {
      const fallback = image.dataset[key]; delete image.dataset[key];
      if (fallback && fallback !== image.getAttribute('src')) { image.src = fallback; return; }
    }
    image.hidden = true;
  }, true);
  function eventArt(item, className = 'ex-event-art') {
    const art = window.TripLog.shared.itineraryArt.resolve(item, state);
    return `<img class="${className}" src="${text(art.src)}" data-illustration-type="${art.id}" data-art-fallback="${text(art.fallbackSrc)}" data-art-universal="${text(art.universalSrc)}" width="360" height="210" alt="" data-export-art decoding="async">`;
  }
  const won = value => text(formatWon(Math.round(M().number(value))));
  const node = markup => { const template = document.createElement('template'); template.innerHTML = markup.trim(); return template.content.firstElementChild; };
  const chunks = (value, length) => {
    const result = [];
    let part = '', used = 0;
    // A line break consumes paper height even when a note contains few
    // characters. Keep multiline notes within a page without losing bytes.
    for (const char of String(value || '')) {
      const weight = char === '\n' || char === '\r' ? 40 : char === '\t' ? 4 : 1;
      if (part && used + weight > length) { result.push(part); part = ''; used = 0; }
      part += char; used += weight;
    }
    if (part) result.push(part);
    return result.length ? result : [''];
  };
  function memberCount() {
    const members = window.TripLog.features.collaboration?.tripCollaboration?.getTripMembers?.();
    return members?.length || (state.companions?.length || 0) + 1;
  }
  function data(options = {}) {
    return M().create({ ...state, itineraryItems: getSortedItineraryItemsForPrint() }, { ...options, memberCount: memberCount() });
  }
  function sceneMarkup(source, className = 'ex-report-art') {
    const scene = window.TripLog.shared.destinationScenes.resolve(source);
    return `<img class="${className}" src="${text(scene.src)}" data-trip-scene data-scene-fallback="${text(scene.fallbackSrc)}" data-scene-universal="${text(scene.universalSrc)}" width="800" height="480" alt="" decoding="async">`;
  }
  function periodLabel(report) {
    const start = M().dateValue(report.source.startDate), end = M().dateValue(report.source.endDate);
    return start === null || end === null ? '날짜 미정' : `${M().dateLabel(report.source.startDate, true)} – ${M().dateLabel(report.source.endDate)}`;
  }
  function header(report, kind, compact = false) {
    if (compact === 'details') return `<header class="ex-detail-report-header"><div class="ex-detail-report-brand"><img src="src/assets/triplog-wordmark.png" width="96" height="28" alt="TripLOG"></div><div class="ex-detail-report-titles"><div><h1>${text(report.source.tripName || getDefaultTripName())}</h1><p>${text(periodLabel(report))} · ${report.members}명</p></div><h2>상세 일정</h2></div></header>`;
    const title = kind === 'itinerary' ? '시간으로 보는 여행' : '여행의 쓰임을 한눈에';
    return `<header class="ex-report-header ${compact ? 'is-compact' : ''}"><div class="ex-report-heading">
      <div class="ex-report-brand"><img src="src/assets/triplog-wordmark.png" width="96" height="28" alt="TripLOG"><span>${kind === 'itinerary' ? 'TRAVEL ITINERARY' : 'EXPENSE REPORT'}</span></div>
      <h1>${text(report.source.tripName || getDefaultTripName())}</h1>${compact ? '' : `<p class="ex-report-subtitle">${title}</p>`}
      <div class="ex-report-meta"><span>${icon('calendar-blank')}${text(periodLabel(report))}</span><span>${icon('users')}${report.members}명</span>${report.source.city ? `<span>${icon('map-pin')}${text(report.source.city)}</span>` : ''}</div>
    </div>${compact ? '' : sceneMarkup(report.source)}</header>`;
  }
  function sectionTitle(title, sub = '') { return `<div class="ex-section-heading"><h2>${title}</h2>${sub ? `<span>${sub}</span>` : ''}</div>`; }
  function expenseSummary(report) {
    const filtered = report.expensePeriod !== 'all';
    return `<section class="ex-expense-hero"><div><span class="ex-overline">${filtered ? '선택한 기간의 여행 경비' : '여행 경비'}</span><strong class="ex-total">${won(report.total)}</strong></div>
      <div class="ex-cost-facts"><div><span>기록한 지출</span><b>${report.entries.length}건</b></div><div><span>1인 평균 <small>· ${report.members}명</small></span><strong>${won(report.perPerson)}</strong></div></div></section>`;
  }
  function categoryChart(report) {
    const boxes = M().treemap(report.categories);
    const tiles = boxes.map(box => {
      const small = box.width < 88 || box.height < 68;
      const compactLabel = box.width >= 48 && box.height >= 52 ? `<span>${text(box.name)}</span><small>${box.percent}%</small>` : '';
      return `<div class="ex-treemap-tile ${small ? 'is-small' : ''}" style="left:${box.x / 4.2}%;top:${box.y / 2.32}%;width:${box.width / 4.2}%;height:${box.height / 2.32}%;--ex-category:${box.color}" aria-hidden="true">${small ? compactLabel : `${icon(box.icon)}<span>${text(box.name)}</span><b>${won(box.amount)}</b><small>${box.percent}%</small>`}</div>`;
    }).join('');
    return `<section class="ex-category-chart">${sectionTitle('항목별 지출 비중', report.adjustments ? '환불·조정 전 기준' : '')}${boxes.length ? `<div class="ex-treemap" role="img" aria-label="항목별 지출 비중. 상세 금액은 아래 범례에 표시됩니다.">${tiles}</div><ul class="ex-chart-legend">${report.categories.map(row => `<li><span class="ex-color-dot" style="--ex-category:${row.color}"></span><span>${text(row.name)}</span><b>${won(row.amount)}</b><small>${row.percent}%</small></li>`).join('')}</ul>` : '<div class="ex-chart-empty">아직 시각화할 지출이 없어요.</div>'}</section>`;
  }
  function dailyChart(report) {
    const chart = M().dailyShares(report), buckets = chart.rows;
    const grouped = buckets.some(row => row.count > 1);
    const pretrip = report.entries.filter(entry => entry.date === '__pretrip__').reduce((sum, entry) => sum + M().number(entry.amount), 0);
    const colors = ['#a3dbf8', '#f7afc7', '#fff05a'];
    const bars = report.entries.length ? buckets.map((row, index) => {
      const day = report.calendar.indexOf(row.date) + 1;
      const tag = row.count > 1 ? `${row.count}일 합산` : day ? `DAY ${day}` : '';
      const color = row.amount < 0 ? '#b74770' : colors[(day ? day - 1 : index) % colors.length];
      const share = window.TripLog.shared.travelCosts.formatShare(row.percent);
      return `<li class="ex-daily-item${row.amount < 0 ? ' is-negative' : ''}" data-daily-date="${text(row.date)}" style="--ex-daily-color:${color}"><div class="ex-daily-label"><span class="ex-daily-date">${text(row.label)}</span>${tag ? `<small class="ex-daily-day">${tag}</small>` : ''}</div><b class="ex-daily-amount">${won(row.amount)}</b><div class="ex-daily-track" aria-hidden="true"><span style="left:${row.barStart}%;width:${row.barWidth}%"></span></div><strong class="ex-daily-share"${share === '—' ? ' aria-label="비중 계산 불가"' : ''}>${text(share)}</strong></li>`;
    }).join('') : '';
    return `<section class="ex-daily-chart${chart.hasNegative ? ' has-negative' : ''}" style="--ex-daily-zero:${chart.zero}%">${sectionTitle(grouped ? '기간별 지출 현황' : '일자별 지출 현황')}${bars ? `<ol class="ex-daily-bars${buckets.length > 3 ? ' is-dense' : ''}" aria-label="날짜별 지출 금액과 비중">${bars}</ol>` : '<p class="ex-chart-empty">지출을 기록하면 표시돼요.</p>'}${bars && !chart.hasPercent ? '<p class="ex-chart-note">합계가 0원 이하이면 비중을 계산하지 않아요.</p>' : ''}${chart.hasNegative ? '<p class="ex-chart-note">0선 왼쪽은 환불, 오른쪽은 지출이에요.</p>' : ''}${grouped ? '<p class="ex-chart-note">긴 여행은 연속된 날짜를 묶어 합산했어요.</p>' : ''}${pretrip ? `<p class="ex-chart-note">사전구매 ${won(pretrip)} 포함</p>` : ''}${report.adjustments ? `<p class="ex-chart-note">환불·조정 ${won(report.adjustments)} 포함</p>` : ''}</section>`;
  }
  function amountMarkup(entry) {
    const foreign = typeof isForeignEntry === 'function' && isForeignEntry(entry) && entry.currency !== 'KRW';
    return `<b>${won(entry.amount)}</b>${foreign ? `<small>${text(formatForeignAmount(entry))}</small>` : ''}`;
  }
  function expenseHighlights(report) {
    const value = M().expenseHighlights(report), peak = value.peak;
    const averageNote = !value.days ? 'Available for dated periods' : report.expensePeriod === 'all'
      ? `Total ÷ ${value.days} ${value.days === 1 ? 'day' : 'days'}` : 'Selected day';
    const peakDate = M().dateValue(peak?.date);
    const peakNote = !peak ? 'No positive spending' : peak.date === '__pretrip__' ? 'Pre-trip purchases' : peakDate === null ? 'Undated expenses'
      : new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(peakDate);
    const amount = number => number === null ? '—' : `${text(Math.round(number).toLocaleString('en-US'))}<span class="ex-highlight-unit"> KRW</span>`;
    return `<section class="ex-expense-highlights" aria-label="Spending highlights" lang="en"><div class="ex-highlight-grid">
      <div class="ex-spend-highlight"><span class="ex-highlight-label">Daily average</span><strong data-expense-average>${amount(value.average)}</strong><small>${text(averageNote)}</small></div>
      <div class="ex-spend-highlight"><span class="ex-highlight-label">Peak spending</span><strong data-expense-peak>${amount(peak?.amount ?? null)}</strong><small>${text(peakNote)}</small></div>
    </div></section>`;
  }
  function fitExpenseOverview(body) {
    if ([...body.querySelectorAll('.ex-category-chart, .ex-daily-chart')].some(region => region.scrollHeight > region.clientHeight + 1)) body.parentElement.classList.add('is-dense-overview');
    // Tile areas remain proportional. Fit only their labels; every exact
    // category amount is also listed in the full-width legend below.
    body.querySelectorAll('.ex-treemap-tile b').forEach(amount => {
      let size = parseFloat(getComputedStyle(amount).fontSize);
      while (size > 12 && amount.scrollWidth > amount.clientWidth + .5) amount.style.fontSize = `${--size}px`;
      if (amount.scrollWidth > amount.clientWidth + .5) amount.hidden = true;
    });
    body.querySelectorAll('.ex-spend-highlight strong').forEach(amount => {
      let size = parseFloat(getComputedStyle(amount).fontSize);
      while (size > 24 && amount.scrollWidth > amount.clientWidth + .5) amount.style.fontSize = `${--size}px`;
    });
  }
  function expenseRows(report, options) {
    return report.entries.flatMap((entry, index) => {
      const description = chunks(entry.description || '내용 없음', 300);
      const notes = chunks(options.notes === false ? '' : entry.note, 700);
      const count = Math.max(description.length, notes.length);
      return Array.from({ length: count }, (_, part) => `<tr ${part ? 'data-entry-continuation' : 'data-entry-id'}="${text(entry.id || index)}"><td>${part ? '<span class="ex-continued">계속</span>' : text(M().dateLabel(entry.date))}${!part && entry.date === '__pretrip__' && entry.paymentDate ? `<small>결제 ${text(M().dateLabel(entry.paymentDate))}</small>` : ''}</td><td><span class="ex-table-category"><span class="ex-color-dot" style="--ex-category:${window.TripLog.data.expenseCategories.get(entry.category, 'print').color}"></span>${text(entry.category || '기타')}</span></td><td>${description[part] ? `<strong>${text(description[part])}</strong>` : ''}${notes[part] ? `<span class="ex-entry-note">${text(notes[part])}</span>` : ''}</td><td class="ex-table-amount">${part ? '' : amountMarkup(entry)}</td></tr>`);
    });
  }
  function scheduleMarkup(layout, options) {
    const hours = [];
    for (let minute = layout.start; minute <= layout.end; minute += 60) hours.push(minute);
    const clock = minute => `${minute >= 1440 ? '+' + Math.floor(minute / 1440) + '일 ' : ''}${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:00`;
    const grid = hours.map(minute => `<span class="ex-time-rule" style="top:${(minute - layout.start) * layout.scale}px"><time>${clock(minute)}</time></span>`).join('');
    const colors = ['#f9d6e2', '#d9effb', '#fff5b5'];
    const columns = layout.columns.map((day, column) => `<div class="ex-time-column" style="--ex-day:${colors[column % colors.length]}"><div class="ex-time-day"><b>${day.index ? `DAY ${day.index}` : '별도 일정'}</b><span>${text(day.label)}</span></div><div class="ex-time-events" style="height:${layout.height}px">${day.timed.map(row => {
      const theme = typeof itineraryThemes === 'object' ? itineraryThemes[row.item.theme] || itineraryThemes.etc : { icon: 'map-pin' };
      const transit = options.transit === false ? '' : formatPrintTransitSummary(row.item);
      const compact = row.compact || row.height < 44;
      const tall = !compact && row.height >= 160;
      const shallow = !compact && row.height < 76;
      const narrow = row.lanes * layout.columns.length >= 4;
      const art = !compact && row.lanes === 1;
      const showHint = transit && !compact && row.height >= (narrow || row.end >= 1440 ? 114 : 96);
      const hint = showHint ? `<small class="ex-time-transit">${text(formatPrintTransitHint(row.item))}</small>` : '';
      const density = compact ? 'is-compact-event' : tall ? 'is-tall-event' : shallow ? 'is-shallow-event' : 'is-medium-event';
      return `<div class="ex-time-event ${density}${narrow ? ' is-narrow-event' : ''}${art ? ' has-export-art' : ''}" data-schedule-event="${text(row.item.id || row.index)}" style="--ex-event:${eventColors[row.item.theme] || eventColors.etc};top:${row.top}px;height:${row.height}px;left:calc(${row.lane / row.lanes * 100}% + 3px);width:calc(${100 / row.lanes}% - 6px)" title="${text([formatPrintTimeRange(row.item), row.item.place, transit].filter(Boolean).join(' · '))}"><div class="ex-time-copy"><time class="ex-time-range">${text(formatPrintTimeRange(row.item))}</time><strong class="ex-time-place">${icon(theme.icon)}<span class="ex-time-name">${text(row.item.place || '장소 미정')}</span></strong>${tall ? '' : hint}</div>${tall ? hint : ''}${art ? eventArt(row.item) : ''}</div>`;
    }).join('')}${!day.timed.length ? '<span class="ex-time-quiet">시간이 정해진 일정이 없어요</span>' : ''}</div><div class="ex-untimed">${day.untimed.length ? `${icon('clock')}시간 미정 ${day.untimed.length}건 · 상세 일정 참고` : ''}</div></div>`).join('');
    return `<section class="ex-time-grid" style="--ex-days:${layout.columns.length}"><div class="ex-time-axis">시간</div><div class="ex-time-rules" style="height:${layout.height}px">${grid}</div>${columns}</section>`;
  }
  function build(type = 'expense', options = {}) {
    const report = data(options), kind = ['expense', 'itinerary', 'full'].includes(type) ? type : 'expense';
    const measure = document.createElement('div'); measure.className = 'ex-document ex-measure'; measure.setAttribute('aria-hidden', 'true'); document.body.appendChild(measure);
    const pages = [];
    const generated = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    function page(pageKind, compact = false) {
      const expenseClass = pageKind === 'expense' ? compact ? ' ex-expense-detail-paper' : ' ex-expense-overview-paper' : '';
      const paper = node(`<article class="ex-paper${compact === 'details' ? ' ex-itinerary-detail-paper' : ''}${expenseClass}" data-report-kind="${pageKind}"><div class="ex-paper-body">${header(report, pageKind, compact)}</div><footer class="ex-paper-footer"><b>TripLOG</b><span>${text(generated)} · ${pageKind === 'itinerary' ? '여행 일정' : '지출 리포트'}</span><span data-page-number></span></footer></article>`);
      measure.appendChild(paper); pages.push(paper); return paper.querySelector('.ex-paper-body');
    }
    const fits = body => body.lastElementChild.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 0.5;
    function ledger(initialBody, rows, tableKind, total, overview = false) {
      let body = initialBody, table, tbody, heading;
      const isExpense = tableKind === 'expense';
      const columns = isExpense ? '<col style="width:17%"><col style="width:13%"><col style="width:48%"><col style="width:22%">' : '<col style="width:18%"><col style="width:23%"><col style="width:59%">';
      const tableHeader = isExpense ? '<th>날짜</th><th>항목</th><th>내용</th><th class="ex-table-amount">금액 (원)</th>' : '<th>날짜</th><th>시간</th><th>장소 · 상세 정보</th>';
      function startTable(continued) {
        heading = node(sectionTitle(isExpense ? '상세 지출 내역' : overview ? '시간순 일정' : '상세 일정', continued ? '이어보기' : isExpense ? `${report.expensePeriod === 'all' ? '전체' : '선택 기간'} ${report.entries.length}건` : `${report.itemCount}개 일정`));
        body.appendChild(heading);
        table = node(`<table class="ex-ledger ${isExpense ? '' : 'ex-itinerary-ledger'}"><colgroup>${columns}</colgroup><thead><tr>${tableHeader}</tr></thead><tbody></tbody></table>`);
        body.appendChild(table); tbody = table.tBodies[0];
      }
      startTable(false);
      const list = rows.length ? rows : [`<tr><td class="ex-table-empty" colspan="${isExpense ? 4 : 3}">${isExpense ? '기록된 지출이 없습니다.' : '등록된 일정이 없습니다.'}</td></tr>`];
      for (const markup of list) {
        const row = node(`<table><tbody>${markup}</tbody></table>`).tBodies[0].firstElementChild;
        tbody.appendChild(row);
        if (!fits(body)) {
          row.remove();
          if (!tbody.children.length) { table.remove(); heading.remove(); }
          body = page(tableKind, true); startTable(true); tbody.appendChild(row);
        }
      }
      if (isExpense) {
        const summary = node(`<div class="ex-ledger-total"><span>총 ${report.entries.length}건 합계</span><strong>${won(total)}</strong></div>`);
        body.appendChild(summary);
        if (!fits(body)) { summary.remove(); body = page(tableKind, true); body.appendChild(summary); }
      }
      return body;
    }
    try {
      if (kind === 'itinerary' || kind === 'full') {
        if (!report.days.length) {
          const body = page('itinerary'); body.appendChild(node('<div class="ex-report-empty"><h2>아직 일정이 없어요</h2><p>여행 날짜와 일정을 추가하면 시간표로 정리해 드려요.</p></div>'));
        }
        for (let index = 0; index < report.days.length;) {
          let group = report.days.slice(index, index + 3);
          const body = page('itinerary');
          const heading = node(sectionTitle('한눈에 보는 시간표', `${group.reduce((sum, day) => sum + day.items.length, 0)}개 일정`));
          body.appendChild(heading);
          const available = body.getBoundingClientRect().bottom - body.lastElementChild.getBoundingClientRect().bottom;
          const height = Math.min(680, Math.max(320, available - 154));
          let layout = M().schedule(group, height);
          // Keep a readable text column when events overlap. This changes page
          // grouping only; the recorded times and time-proportional positions stay intact.
          while (group.length > 1 && layout.columns.some(day => day.maxLanes * group.length > 4)) {
            group = group.slice(0, -1); layout = M().schedule(group, height);
          }
          heading.querySelector('span').textContent = `${group.reduce((sum, day) => sum + day.items.length, 0)}개 일정`;
          if (layout.columns.some(day => day.maxLanes > 4)) {
            body.appendChild(node('<p class="ex-chart-note">동시에 겹치는 일정이 많아 상세 시간표로 정리했어요.</p>'));
            const overviewRows = group.flatMap(day => day.items.slice().sort((a, b) => (M().timeMinutes(a.time) ?? 2000) - (M().timeMinutes(b.time) ?? 2000)).map((item, index) => `<tr data-schedule-event="${text(item.id || index)}"><td>${text(day.label)}</td><td class="ex-detail-time">${text(formatPrintTimeRange(item))}</td><td>${text(item.place || '장소 미정')}</td></tr>`));
            ledger(body, overviewRows, 'itinerary', undefined, true);
          } else {
            body.appendChild(node(scheduleMarkup(layout, options)));
          }
          index += group.length;
        }
        if (report.itemCount) window.TripLog.features.print.itineraryTable.append(report, options, () => page('itinerary', 'details'), fits);
      }
      if (kind === 'expense' || kind === 'full') {
        const body = page('expense'); body.appendChild(node(expenseSummary(report)));
        if (options.charts !== false) body.appendChild(node(`<div class="ex-expense-charts">${categoryChart(report)}${dailyChart(report)}</div>`));
        body.appendChild(node(expenseHighlights(report)));
        fitExpenseOverview(body);
        // The overview is a complete analysis page. Detail rows always begin
        // on a fresh sheet, including filtered, chart-free and combined reports.
        ledger(page('expense', true), expenseRows(report, options), 'expense', report.total);
      }
      pages.forEach((paper, index) => { paper.querySelector('[data-page-number]').textContent = `${index + 1} / ${pages.length}`; });
      return { markup: `<div class="ex-document">${pages.map(paper => paper.outerHTML).join('')}</div>`, pages: pages.length, data: report };
    } finally { measure.remove(); }
  }
  window.TripLog.register('features.print.renderer', { build, data, header, sceneMarkup, periodLabel, expenseSummary, categoryChart, dailyChart, eventArt, eventColors });
})();

window.TripLog.register('features.print.export', {
  exportPdf, exportExpensePdf, exportItineraryPdf, exportFullPdf, buildPrintReport,
  buildExpensePrintSections, buildItineraryPrintSections, getFilteredEntriesForPrint, getSortedItineraryItemsForPrint,
});
