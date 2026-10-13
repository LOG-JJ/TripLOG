(() => {
  const model = () => window.TripLog.features.travelCompanion.model;
  const text = value => model().esc(value);
  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const validDate = value => model().validDate(value);
  function dateLabel(value, year = false) {
    return `${year ? value.slice(0, 4) + '.' : ''}${Number(value.slice(5, 7))}.${Number(value.slice(8))}`;
  }
  function period(start, end) {
    if (!validDate(start)) return '날짜 미정';
    if (!end) return dateLabel(start);
    if (!validDate(end) || end < start) return '날짜 확인하기';
    if (end === start) return dateLabel(start);
    const crossYear = start.slice(0, 4) !== end.slice(0, 4);
    return `${dateLabel(start, crossYear)}–${dateLabel(end, crossYear)}`;
  }
  function artwork(type, className = '') {
    return `<img class="rs-summary-art ${className}" src="src/assets/reservation-summary-${type}.webp" alt="" aria-hidden="true" decoding="async">`;
  }
  function emptyBody(type) {
    return `<div class="rs-summary-empty">${artwork(type === 'transport' ? 'plane' : 'hotel')}
      <p>${type === 'transport' ? '이동 예약을' : '머무를 곳을'}<br>추가해 보세요</p></div>`;
  }
  function transportBody(rows) {
    if (!rows.length) return emptyBody('transport');
    // This is a preview of the first dated reservation, never a merge of records.
    // Airport qualifiers and every original reservation remain intact in the wallet.
    const first = rows[0], from = clean(first.from), to = clean(first.to);
    const returning = first.source === 'entry' && validDate(first.date) && validDate(first.endDate) && first.endDate >= first.date;
    const name = clean(first.title) || '교통 예약';
    const route = from && to ? `${from} ${returning ? '↔' : '→'} ${to}` : name;
    const transport = model().transportInfo(first);
    const routeHtml = from && to
      ? `<span class="rs-summary-city">${text(from)}</span>${icon(returning ? 'arrows-left-right' : 'arrow-right')}<span class="rs-summary-city">${text(to)}</span>`
      : `<span class="rs-summary-transport-name">${text(name)}</span>`;
    return `<div class="rs-transport-body${returning ? ' is-round-trip' : ''}" data-summary-source-id="${text(first.id)}" aria-label="교통 예약 ${rows.length}건 중 첫 번째 예약 요약">
      <span class="rs-transport-symbol" role="img" aria-label="${text(transport.label)}">${transport.emoji}</span>
      <div class="rs-transport-copy"><strong class="rs-summary-route" title="${text(route)}">${routeHtml}</strong>
      <div class="rs-transport-meta"><span class="rs-summary-booking-name" title="${text(name)}">${text(from && to ? name : clean(first.operator) || clean(first.location) || transport.label)}</span><span class="rs-summary-period" title="${text(period(first.date))}">${text(period(first.date))}</span></div></div>
    </div>`;
  }
  function stayBody(rows) {
    if (!rows.length) return emptyBody('stay');
    return `<div class="rs-summary-stays">${rows.slice(0, 2).map(row => {
      const title = clean(row.title) || '이름 없는 숙소';
      const validPeriod = validDate(row.date) && validDate(row.endDate) && row.endDate > row.date;
      const nights = validPeriod ? Math.round((Date.parse(`${row.endDate}T12:00:00Z`) - Date.parse(`${row.date}T12:00:00Z`)) / 86400000) : 0;
      const dates = validPeriod ? period(row.date, row.endDate) : '숙박 날짜 확인';
      return `<div class="rs-summary-stay-item" data-summary-source-id="${text(row.id)}">${artwork('hotel')}
        <div class="rs-summary-stay-copy"><strong class="rs-summary-name" title="${text(title)}">${text(title)}</strong>
          <span class="rs-summary-stay-meta" title="${text(dates)}${nights ? ` · ${nights}박` : ''}"><span class="rs-summary-stay-period">${text(dates)}</span>${nights ? `<span class="rs-summary-nights">· ${nights}박</span>` : ''}</span>
        </div></div>`;
    }).join('')}</div>`;
  }
  function column(type, rows) {
    const title = type === 'transport' ? '교통 예약' : '숙소 예약';
    return `<section class="rs-summary-column rs-summary-${type}${rows.length ? '' : ' is-empty'}" aria-labelledby="rs-${type}-heading">
      ${window.TripLog.features.overview.card.header({ title, titleId: `rs-${type}-heading`, className: 'rs-summary-heading', badge: `<span class="rs-summary-count">${rows.length}<small>건</small></span>` })}
      <div class="rs-summary-body" id="rs-${type}-content">${type === 'transport' ? transportBody(rows) : stayBody(rows)}</div>
      <button type="button" class="rs-summary-action rd-reservation-${type}" data-rd-action="companion-${type}${rows.length ? '' : '-new'}" aria-label="${title} ${rows.length}건, ${rows.length ? '예약 지갑 열기' : '예약 추가하기'}"><span>${rows.length ? '전체 보기' : '예약 추가'}</span>${icon('caret-right')}</button>
    </section>`;
  }
  function render(bookings) {
    const rows = Array.isArray(bookings) ? bookings : [];
    return window.TripLog.features.overview.card.render({ className: 'rs-reservations', variant: 'reservations', label: '예약 요약', content: `<div class="rs-summary-columns">${column('transport', rows.filter(row => row.type === 'transport'))}${column('stay', rows.filter(row => row.type === 'stay'))}</div>` });
  }
  window.TripLog.register('features.overview.reservationPockets', { render });
})();
