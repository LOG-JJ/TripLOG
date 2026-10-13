(() => {
  'use strict';
  const text = value => escapeHtml(String(value ?? ''));
  const node = markup => { const template = document.createElement('template'); template.innerHTML = markup; return template.content.firstElementChild; };
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
  const characters = value => segmenter ? Array.from(segmenter.segment(String(value)), part => part.segment) : Array.from(String(value));
  const run = (kind, value, extra = {}) => ({ kind, chars: characters(value), ...extra });
  const isLocation = part => part.kind === 'place' || part.kind === 'address';

  function content(item, options) {
    const runs = [run('place', item.place || '장소 미정')];
    if (options.notes !== false && item.location) runs.push(run('address', item.location));
    if (options.transit !== false) {
      getPrintTransitSegments(item).forEach((segment, index) => runs.push(run('transit', formatPrintTransitSegment(segment, true), {
        mode: segment.trans || 'none', label: getPrintTransitLabel(segment.trans), segment: index,
      })));
      const reservation = item.transportReservation;
      if (reservation?.from || reservation?.to) {
        const mode = window.TripLog.features.print.model.transitMode(reservation.kind);
        runs.push(run('route', `${mode.emoji} ${reservation.from || ''} → ${reservation.to || ''}`));
      }
    }
    return { runs, memo: characters(options.notes === false ? '' : item.memo || '') };
  }

  // Split only text, before escaping it. A grapheme (including an emoji) is never
  // split between pages; concatenating the fragments recovers the original text.
  function partition(source, limit) {
    const head = [], tail = [];
    // Location and transport occupy independent columns, so each gets its own
    // text budget rather than forcing a short transport line onto a later page.
    [source.runs.filter(isLocation), source.runs.filter(part => !isLocation(part))].forEach(column => {
      let remaining = limit;
      column.forEach(part => {
        const take = Math.min(remaining, part.chars.length);
        if (take) head.push({ ...part, chars: part.chars.slice(0, take) });
        if (take < part.chars.length) tail.push({ ...part, chars: part.chars.slice(take) });
        remaining -= take;
      });
    });
    return [{ runs: head, memo: source.memo.slice(0, limit) }, { runs: tail, memo: source.memo.slice(limit) }];
  }
  const length = source => Math.max(
    source.runs.filter(isLocation).reduce((sum, part) => sum + part.chars.length, 0),
    source.runs.filter(part => !isLocation(part)).reduce((sum, part) => sum + part.chars.length, 0), source.memo.length);

  function rowMarkup(item, id, part, source, fragment = false) {
    const repeat = part && !source.runs.some(value => value.kind === 'place')
      ? `<strong class="ex-detail-repeat">${text(characters(item.place || '장소 미정').slice(0, 80).join(''))}</strong>` : '';
    const render = values => values.map(value => {
      const tag = value.kind === 'place' ? 'strong' : 'span';
      const attrs = value.kind === 'transit' ? ` data-transport-mode="${text(value.mode)}" data-transit-segment="${value.segment}" title="${text(value.label)}"` : '';
      return `<${tag} class="ex-detail-${value.kind}"${attrs}>${text(value.chars.join(''))}</${tag}>`;
    }).join('');
    return `<tr${part || fragment ? ' class="is-detail-fragment"' : ''} ${part ? 'data-itinerary-continuation' : 'data-itinerary-detail'}="${text(id)}"><td class="ex-detail-time">${text(formatPrintTimeRange(item))}${part ? '<small class="ex-detail-continued">계속</small>' : ''}</td><td class="ex-detail-location">${repeat}${render(source.runs.filter(isLocation))}</td><td class="ex-detail-transit-cell">${render(source.runs.filter(value => !isLocation(value)))}</td><td class="ex-detail-memo">${text(source.memo.join(''))}</td></tr>`;
  }

  function append(report, options, createPage, fits) {
    let body, table;
    const seenDays = new Set();
    function start() {
      body = createPage();
      table = node('<table class="ex-ledger ex-itinerary-ledger ex-itinerary-detail-table" aria-label="상세 일정"><colgroup><col style="width:12%"><col style="width:16%"><col style="width:32%"><col style="width:12%"><col style="width:28%"></colgroup><thead><tr><th scope="col">날짜</th><th scope="col">시간</th><th scope="col">장소</th><th scope="col">이동</th><th scope="col">메모</th></tr></thead></table>');
      body.appendChild(table);
    }
    function add(day, markup) {
      const key = day.date || '__undated__';
      let group = table.tBodies[table.tBodies.length - 1];
      if (!group || group.dataset.itineraryDay !== key) {
        group = document.createElement('tbody'); group.dataset.itineraryDay = key; table.appendChild(group);
      }
      const row = node(`<table><tbody>${markup}</tbody></table>`).tBodies[0].firstElementChild;
      if (!group.rows.length) {
        const cell = document.createElement('th'); cell.className = 'ex-detail-day'; cell.scope = 'rowgroup';
        cell.innerHTML = `${day.index ? `<b>DAY ${day.index}</b>` : ''}<span>${text(day.label)}</span>${seenDays.has(key) ? '<small>계속</small>' : ''}`;
        row.prepend(cell);
      }
      group.appendChild(row);
      group.rows[0].cells[0].rowSpan = group.rows.length;
      return () => {
        row.remove();
        if (group.rows.length) group.rows[0].cells[0].rowSpan = group.rows.length;
        else group.remove();
      };
    }
    start();
    report.days.forEach(day => day.items.forEach((item, index) => {
      const id = item.id || `${day.date || 'undated'}-${index}`;
      let source = content(item, options), part = 0;
      while (length(source)) {
        const hadRows = table.rows.length > 1;
        let undo = add(day, rowMarkup(item, id, part, source));
        if (fits(body)) { seenDays.add(day.date || '__undated__'); break; }
        undo();
        // Prefer keeping a stop whole. Split only a stop that cannot fit on a
        // fresh sheet, measuring the actual font, column widths and line breaks.
        if (hadRows) { start(); continue; }
        let low = 1, high = length(source) - 1, best = 0;
        while (low <= high) {
          const count = Math.floor((low + high) / 2);
          const [head] = partition(source, count);
          undo = add(day, rowMarkup(item, id, part, head, true));
          const fit = fits(body); undo();
          if (fit) { best = count; low = count + 1; } else high = count - 1;
        }
        if (!best) throw new Error('상세 일정 한 행을 페이지에 배치할 수 없습니다.');
        const [head, tail] = partition(source, best);
        add(day, rowMarkup(item, id, part, head, true));
        seenDays.add(day.date || '__undated__'); source = tail; part++; start();
      }
    }));
  }
  window.TripLog.register('features.print.itineraryTable', { append });
})();
