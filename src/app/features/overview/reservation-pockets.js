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
    const flight = first.transportKind === 'flight';
    const returning = flight && validDate(first.date) && validDate(first.endDate) && first.endDate >= first.date;
    const name = clean(first.title) || '교통 예약';
    const route = from && to ? `${from} ${returning ? '↔' : '→'} ${to}` : name;
    const secondary = clean(first.operator) || (from && to ? '' : clean(first.location));
    const routeHtml = from && to
      ? `<span class="rs-summary-city">${text(from)}</span>${icon(returning ? 'arrows-left-right' : 'arrow-right')}<span class="rs-summary-city">${text(to)}</span>`
      : `<span class="rs-summary-transport-name">${text(name)}</span>`;
    return `<div class="rs-transport-body${returning ? ' is-round-trip' : ''}" data-summary-source-id="${text(first.id)}" aria-label="교통 예약 ${rows.length}건 중 첫 번째 예약 요약">
      ${flight ? artwork('plane', 'rs-transport-illustration') : `<span class="rs-transport-symbol">${icon(/KTX|기차|열차|철도/i.test(name) ? 'train' : 'ticket')}</span>`}
      <strong class="rs-summary-route" title="${text(route)}">${routeHtml}</strong>
      ${secondary && secondary !== route && secondary !== name ? `<span class="rs-summary-operator" title="${text(secondary)}">${text(secondary)}</span>` : ''}
      <span class="rs-summary-period" title="${text(period(first.date, first.endDate))}">${text(period(first.date, first.endDate))}</span>
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
      <header class="rs-summary-heading"><h2 id="rs-${type}-heading">${title}</h2><span class="rs-summary-count">${rows.length}<small>건</small></span></header>
      <div class="rs-summary-body" id="rs-${type}-content">${type === 'transport' ? transportBody(rows) : stayBody(rows)}</div>
      <button type="button" class="rs-summary-action rd-reservation-${type}" data-rd-action="companion-${type}${rows.length ? '' : '-new'}" aria-label="${title} ${rows.length}건, ${rows.length ? '예약 지갑 열기' : '예약 추가하기'}"><span>${rows.length ? '전체 보기' : '예약 추가'}</span>${icon('caret-right')}</button>
    </section>`;
  }
  function render(bookings) {
    const rows = Array.isArray(bookings) ? bookings : [];
    return `<section class="rs-reservations" aria-label="예약 요약">
      <div class="rs-summary-brand"><img src="src/assets/triplog-wordmark.png" alt="" aria-hidden="true" decoding="async"></div>
      <div class="rs-summary-columns">${column('transport', rows.filter(row => row.type === 'transport'))}${column('stay', rows.filter(row => row.type === 'stay'))}</div>
    </section>`;
  }
  window.TripLog.register('features.overview.reservationPockets', { render });
})();
