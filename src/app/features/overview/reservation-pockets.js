(() => {
  const model = () => window.TripLog.features.travelCompanion.model;
  const text = value => model().esc(value);
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const keyText = value => clean(value).toLocaleLowerCase('en');
  const validDate = value => model().validDate(value);
  const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '');
  const isFlight = row => row.transportKind === 'flight';
  const hasReturn = row => isFlight(row) && validDate(row.endDate);
  function dateLabel(value, showYear = false) {
    if (!validDate(value)) return '날짜 미정';
    const day = new Date(`${value}T12:00:00Z`).getUTCDay();
    return `${showYear ? value.slice(0, 4) + '.' : ''}${Number(value.slice(5, 7))}.${Number(value.slice(8))} (${'일월화수목금토'[day]})`;
  }
  function timeLabel(value) { return validTime(value) ? value : '시각 미정'; }
  function routeLabel(row) {
    if (clean(row.from) && clean(row.to)) return `${clean(row.from)} → ${clean(row.to)}`;
    return clean(row.location) || clean(row.title) || '교통 예약';
  }
  // A presentation group is not a duplicate detector. Airport qualifiers, operators,
  // service numbers and incomplete schedules must not be silently conflated.
  function scheduleKey(row) {
    if (!validDate(row.date) || !validTime(row.time)) return '';
    if (row.endDate && !validDate(row.endDate)) return '';
    if (row.endDate && row.endDate < row.date) return '';
    if (row.endTime && !validTime(row.endTime)) return '';
    if (hasReturn(row) && !validTime(row.endTime)) return '';
    const route = clean(row.from) && clean(row.to)
      ? [keyText(row.from), keyText(row.to)] : [keyText(row.location), keyText(row.title)];
    if (isFlight(row) && (!clean(row.from) || !clean(row.to) || !clean(row.operator))) return '';
    if (!route.every(Boolean)) return '';
    return JSON.stringify([row.transportKind || '', route, keyText(row.operator), keyText(row.serviceNumber), row.date, row.time, row.endDate || '', row.endTime || '']);
  }
  function groupTransport(rows) {
    const groups = [], bySchedule = new Map();
    rows.forEach(row => {
      const key = scheduleKey(row), existing = key && bySchedule.get(key);
      if (existing) { existing.rows.push(row); return; }
      const group = { row, rows: [row] };
      groups.push(group);
      if (key) bySchedule.set(key, group);
    });
    return groups;
  }
  const remaining = count => count > 0 ? `<span class="rs-more">외 ${count}건 ${icon('arrow-right')}</span>` : '';
  function bookingMark(group) {
    const count = group.rows.length;
    return `<span class="rs-booking-mark${count > 1 ? ' is-grouped' : ''}" aria-label="${count > 1 ? '같은 일정의 ' : ''}예약 ${count}건">${count}건</span>`;
  }
  function transportBody(rows) {
    if (!rows.length) return `<span class="rs-empty"><strong>이동 계획을 채워보세요</strong><span class="rs-empty-description">항공·기차·버스 예약을<br>한곳에 모아둘 수 있어요</span><span class="rs-empty-action">교통 예약 추가 ${icon('caret-right')}</span></span>`;
    const groups = groupTransport(rows), shown = groups.slice(0, 3), first = shown[0].row;
    const commonRoute = shown.every(({ row }) => isFlight(row) && clean(row.from) && clean(row.to)
      && keyText(row.from) === keyText(first.from) && keyText(row.to) === keyText(first.to)
      && keyText(row.operator) === keyText(first.operator) && keyText(row.serviceNumber) === keyText(first.serviceNumber));
    const commonDates = commonRoute && shown.every(({ row }) => row.date === first.date && row.endDate === first.endDate && hasReturn(row) === hasReturn(first));
    const hiddenCount = rows.length - shown.reduce((sum, group) => sum + group.rows.length, 0);
    if (commonDates) {
      const roundTrip = hasReturn(first), crossYear = roundTrip && first.date.slice(0, 4) !== first.endDate.slice(0, 4);
      return `<span class="rs-route-line"><span class="rs-route">${text(first.from)} ${icon(roundTrip ? 'arrows-left-right' : 'arrow-right')} ${text(first.to)}</span>
        ${first.operator ? `<span class="rs-operator">· ${text(first.operator)}${first.serviceNumber ? ` ${text(first.serviceNumber)}` : ''}</span>` : ''}</span>
        <span class="rs-flight-table${roundTrip ? '' : ' is-one-way'}">
          <span class="rs-flight-head"><span>예약</span><span>가는 편<span> · ${text(dateLabel(first.date, crossYear))}</span></span>${roundTrip ? `<span>오는 편<span> · ${text(dateLabel(first.endDate, crossYear))}</span></span>` : ''}</span>
          ${shown.map(group => `<span class="rs-flight-row" data-reservation-group-size="${group.rows.length}">${bookingMark(group)}<time>${text(timeLabel(group.row.time))}</time>${roundTrip ? `<time>${text(timeLabel(group.row.endTime))}</time>` : ''}</span>`).join('')}
        </span>${remaining(hiddenCount)}`;
    }
    return `<span class="rs-journeys">${shown.map(group => {
      const row = group.row, roundTrip = hasReturn(row);
      return `<span class="rs-journey" data-reservation-group-size="${group.rows.length}">${bookingMark(group)}<span class="rs-journey-copy">
        <strong>${text(routeLabel(row))}</strong>${row.operator && !routeLabel(row).includes(row.operator) ? `<span class="rs-carrier">${text(row.operator)}${row.serviceNumber ? ` · ${text(row.serviceNumber)}` : ''}</span>` : ''}
        <span class="rs-journey-date">${text(dateLabel(row.date))} ${text(timeLabel(row.time))}${roundTrip ? `<span>귀국 ${text(dateLabel(row.endDate))} ${text(timeLabel(row.endTime))}</span>` : ''}</span>
      </span></span>`;
    }).join('')}</span>${remaining(hiddenCount)}`;
  }
  function stayBody(rows) {
    if (!rows.length) return `<span class="rs-empty"><strong>머무를 곳을 담아보세요</strong><span class="rs-empty-description">숙소와 체크인 일정을<br>한눈에 확인할 수 있어요</span><span class="rs-empty-action">숙소 예약 추가 ${icon('caret-right')}</span></span>`;
    return `<span class="rs-stays">${rows.slice(0, 2).map(row => {
      const validPeriod = validDate(row.date) && validDate(row.endDate) && row.endDate > row.date;
      const nights = validPeriod ? Math.round((Date.parse(`${row.endDate}T12:00:00Z`) - Date.parse(`${row.date}T12:00:00Z`)) / 86400000) : 0;
      const crossYear = validPeriod && row.date.slice(0, 4) !== row.endDate.slice(0, 4);
      const dates = validPeriod ? `${dateLabel(row.date, crossYear)} → ${dateLabel(row.endDate, crossYear)} · ${nights}박` : '숙박 날짜 확인하기';
      return `<span class="rs-stay">${icon('building')}<span><strong title="${text(row.title || '이름 없는 숙소')}">${text(row.title || '이름 없는 숙소')}</strong><span class="rs-stay-dates">${text(dates)}</span></span></span>`;
    }).join('')}</span>${remaining(rows.length - 2)}`;
  }
  function card(type, rows) {
    const title = type === 'transport' ? '교통 예약' : '숙소 예약';
    return `<button type="button" class="rd-button rd-reservation-${type} rs-pocket${rows.length ? '' : ' is-empty'}" data-rd-action="companion-${type}${rows.length ? '' : '-new'}" aria-label="${title} ${rows.length}건, ${rows.length ? '예약 지갑 열기' : '예약 추가하기'}" aria-describedby="rs-${type}-content">
      <img class="rs-pocket-art" src="src/assets/reservation-empty-${type}.webp" alt="" aria-hidden="true" decoding="async">
      <span class="rs-pocket-copy"><span class="rs-pocket-heading"><span class="rs-pocket-label">${icon(type === 'transport' ? 'airplane-tilt' : 'bed')}<strong>${title}</strong></span>
      <span class="rs-pocket-count">${rows.length}<small>건</small></span>${rows.length ? `<span class="rs-pocket-chevron">${icon('caret-right')}</span>` : ''}</span>
      <span class="rs-pocket-body" id="rs-${type}-content">${type === 'transport' ? transportBody(rows) : stayBody(rows)}</span></span>
    </button>`;
  }
  function render(bookings) {
    const rows = Array.isArray(bookings) ? bookings : [];
    return `<div class="rd-reservations rs-reservations">${card('transport', rows.filter(row => row.type === 'transport'))}${card('stay', rows.filter(row => row.type === 'stay'))}</div>`;
  }
  window.TripLog.register('features.overview.reservationPockets', { render, groupTransport });
})();
