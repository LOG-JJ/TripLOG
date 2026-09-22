(() => {
  const types = {
    transport: { label: '교통', icon: 'train', color: 'blue' },
    stay: { label: '숙소', icon: 'bed', color: 'pink' },
    activity: { label: '입장권', icon: 'ticket', color: 'green' },
    other: { label: '기타', icon: 'bookmark-simple', color: 'yellow' },
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const asList = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const time = Date.parse(`${value}T12:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  }
  function minutes(value) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
    return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  }
  const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const addDay = (value, count = 1) => new Date(Date.parse(`${value}T12:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
  function days(trip) {
    if (!validDate(trip.startDate) || !validDate(trip.endDate) || trip.endDate < trip.startDate) return [];
    const count = Math.round((Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000) + 1;
    if (count > 3660) return [];
    return Array.from({ length: count }, (_, index) => addDay(trip.startDate, index));
  }
  function dayItems(trip, date) {
    return sortItineraryItems(asList(trip.itineraryItems).filter(item => item.date === date));
  }
  function flags(trip) {
    const source = trip.travelCompanion || {};
    return { completed: new Set(source.completedItineraryIds || []), locked: new Set(source.lockedItineraryIds || []) };
  }
  function transitMinutes(item, fallback = 10) {
    const segments = asList(item.transits);
    const total = segments.length ? segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.duration) || 0), 0) : Math.max(0, Number(item.duration) || 0);
    return total > 0 ? Math.ceil(total) : Math.max(0, Math.round(Number(fallback) || 0));
  }
  function dateInZone(timeZone, now = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
      const part = name => parts.find(p => p.type === name)?.value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    } catch { return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'); }
  }
  function defaultZone(trip) {
    if (trip.travelCompanion?.timeZone) return trip.travelCompanion.timeZone;
    return ({ KR: 'Asia/Seoul', JP: 'Asia/Tokyo', CN: 'Asia/Shanghai', TW: 'Asia/Taipei', HK: 'Asia/Hong_Kong', SG: 'Asia/Singapore', TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh', PH: 'Asia/Manila', GB: 'Europe/London', DE: 'Europe/Berlin', IT: 'Europe/Rome', AE: 'Asia/Dubai' })[trip.countryCode] || (trip.travelMode === 'domestic' ? 'Asia/Seoul' : '');
  }
  function today(trip, date, now = new Date()) {
    const items = dayItems(trip, date), status = flags(trip);
    const completed = items.filter(item => status.completed.has(item.id)).length;
    return { items, completed, next: items.find(item => !status.completed.has(item.id)), percent: items.length ? Math.round(completed / items.length * 100) : 0, preview: date !== dateInZone(defaultZone(trip) || undefined, now) };
  }
  function dailyBudget(trip, date) {
    const dates = days(trip), index = dates.indexOf(date), total = Number(trip.totalBudget) || 0;
    const entries = asList(trip.entries), amount = entry => Number.isFinite(Number(entry.amount)) ? Number(entry.amount) : 0;
    const committed = entries.filter(entry => !validDate(entry.date) || entry.date < date).reduce((sum, entry) => sum + amount(entry), 0);
    const used = entries.filter(entry => entry.date === date).reduce((sum, entry) => sum + amount(entry), 0);
    const remainingDays = index >= 0 ? dates.length - index : 0;
    const allowance = total > 0 && remainingDays ? Math.max(0, Math.floor((total - committed) / remainingDays)) : 0;
    const remaining = allowance - used;
    return { configured: total > 0 && index >= 0, allowance, used, remaining, remainingDays, percent: allowance ? Math.max(0, Math.min(100, Math.round(remaining / allowance * 100))) : 0 };
  }
  function reviewDay(trip, date, fallback = 10) {
    const items = dayItems(trip, date), issues = [];
    let latestEnd = null;
    items.forEach((item, index) => {
      const lodging = item.theme === 'lodging';
      const start = minutes(item.time), end = lodging ? start : minutes(item.endTime), previous = items[index - 1];
      if (start === null || end === null) issues.push({ id: item.id, type: 'missing', title: lodging ? '도착 시각을 확인해 주세요' : '시작·종료 시간을 확인해 주세요', detail: item.place });
      else if (!lodging && end <= start) issues.push({ id: item.id, type: 'invalid', title: '종료 시간이 시작보다 빨라요', detail: item.place });
      if (start !== null && latestEnd !== null) {
        const gap = start - latestEnd, needed = transitMinutes(item, fallback);
        if (gap < 0) issues.push({ id: item.id, type: 'overlap', title: `일정이 ${-gap}분 겹쳐요`, detail: item.place });
        else if (gap < needed) issues.push({ id: item.id, type: 'transit', title: `이동 시간 ${needed - gap}분 부족`, detail: `${previous.place} → ${item.place}` });
      }
      if (start !== null && end !== null && (lodging || end > start)) latestEnd = Math.max(latestEnd ?? 0, end);
    });
    return issues;
  }
  function outsideItems(trip) {
    return asList(trip.itineraryItems).filter(item => !validDate(item.date) || item.date < trip.startDate || item.date > trip.endDate);
  }
  function signature(trip, date) {
    const status = flags(trip);
    return JSON.stringify([trip.id, trip.startDate, trip.endDate, dayItems(trip, date), [...status.completed].sort(), [...status.locked].sort()]);
  }
  function planAdjustment(trip, date, delay = 0, fallback = 10) {
    const items = dayItems(trip, date), status = flags(trip), errors = [], changes = [];
    delay = Number(delay); fallback = Number(fallback);
    if (!Number.isInteger(delay) || delay < 0 || delay > 720 || !Number.isInteger(fallback) || fallback < 0 || fallback > 180) errors.push('지연은 0~720분, 기본 이동은 0~180분으로 입력해 주세요.');
    if (!days(trip).includes(date)) errors.push('여행 기간 안의 일자를 선택해 주세요.');
    if (!items.length) errors.push('조정할 일정이 없어요.');
    let cursor = null, firstPending = true;
    for (const item of items) {
      const lodging = item.theme === 'lodging';
      const start = minutes(item.time), end = lodging ? start : minutes(item.endTime);
      if (start === null || end === null || (!lodging && end <= start)) { errors.push(`${item.place}: ${lodging ? '도착 시각을' : '시작·종료 시간을'} 먼저 입력해 주세요.`); continue; }
      const fixed = status.completed.has(item.id) || status.locked.has(item.id);
      const earliest = cursor === null ? 0 : cursor + transitMinutes(item, fallback);
      let nextStart = start;
      if (fixed) {
        if (start < earliest) errors.push(`${item.place}: 완료·잠금 시간과 충돌해요. 지연을 줄이거나 잠금을 해제해 주세요.`);
      } else {
        nextStart = Math.max(start + (firstPending ? delay : 0), earliest);
        firstPending = false;
      }
      const nextEnd = nextStart + end - start;
      if (nextEnd > 1439) errors.push(`${item.place}: 조정하면 날짜가 넘어가요. 일정을 직접 나눠 주세요.`);
      if (nextStart !== start && nextEnd <= 1439) changes.push({ id: item.id, place: item.place, beforeTime: item.time, beforeEndTime: lodging ? '' : item.endTime, originalEndTime: item.endTime, time: clock(nextStart), endTime: lodging ? '' : clock(nextEnd) });
      cursor = nextEnd;
    }
    return { tripId: trip.id, date, delay, fallback, sourceSignature: signature(trip, date), changes, errors: [...new Set(errors)] };
  }
  function applyAdjustment(trip, plan) {
    if (!plan || plan.tripId !== trip.id || plan.sourceSignature !== signature(trip, plan.date)) throw new Error('일정이 바뀌었어요. 미리보기를 다시 열어 주세요.');
    if (plan.errors.length || !plan.changes.length) throw new Error(plan.errors[0] || '변경할 시간이 없어요.');
    const changes = new Map(plan.changes.map(change => [change.id, change]));
    const itineraryItems = asList(trip.itineraryItems).map(item => changes.has(item.id) ? { ...item, time: changes.get(item.id).time, endTime: changes.get(item.id).endTime } : item);
    const lastAdjustment = { tripId: trip.id, date: plan.date, before: plan.changes.map(change => ({ id: change.id, time: change.beforeTime, endTime: 'originalEndTime' in change ? change.originalEndTime : change.beforeEndTime })), afterSignature: signature({ ...trip, itineraryItems }, plan.date) };
    return { itineraryItems, travelCompanion: { ...trip.travelCompanion, lastAdjustment } };
  }
  function undoAdjustment(trip) {
    const record = trip.travelCompanion?.lastAdjustment;
    if (!record || record.tripId !== trip.id || record.afterSignature !== signature(trip, record.date)) throw new Error('조정 후 일정이나 완료·잠금 상태가 바뀌어 되돌릴 수 없어요.');
    const before = new Map(record.before.map(item => [item.id, item]));
    return { itineraryItems: asList(trip.itineraryItems).map(item => before.has(item.id) ? { ...item, time: before.get(item.id).time, endTime: before.get(item.id).endTime } : item), travelCompanion: { ...trip.travelCompanion, lastAdjustment: null } };
  }
  function safeUrl(value) {
    try { const url = new URL(String(value || '')); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function reservations(trip) {
    const rows = asList(trip.travelCompanion?.reservations).map(row => ({ ...row, id: `manual:${row.id}`, sourceId: row.id, source: 'manual', type: types[row.type] ? row.type : 'other' }));
    asList(trip.entries).forEach(entry => {
      const stay = entry.pretripType === 'hotel' || !!entry.hotelName;
      const transport = entry.pretripType === 'flight' || !!entry.flightNumber;
      if (!stay && !transport) return;
      rows.push({ id: `entry:${entry.id}`, sourceId: entry.id, source: 'entry', type: stay ? 'stay' : 'transport', title: (stay ? entry.hotelName : entry.description) || (stay ? '숙소 예약' : '교통 예약'), date: (stay ? entry.hotelCheckIn : entry.flightDepartDate) || '', endDate: (stay ? entry.hotelCheckOut : entry.flightReturnDate) || '', time: stay ? '' : entry.flightDepartTime || '', endTime: stay ? '' : entry.flightReturnDepartTime || '', reference: entry.bookingCode || '', location: stay ? entry.hotelAddress || '' : [entry.flightFrom, entry.flightTo].filter(Boolean).join(' → '), note: typeof entry.pretripMemo === 'string' ? entry.pretripMemo : entry.note || '', url: '', amount: entry.amount,
        // Presentation metadata only; historical transport purchases also used the flight form.
        transportKind: !stay && (entry.flightAirline || entry.flightNumber || /^항공권(?:\s|·)/.test(entry.description || '')) ? 'flight' : '',
        operator: stay ? '' : entry.flightAirline || '', serviceNumber: stay ? '' : entry.flightNumber || '',
        from: stay ? '' : entry.flightFrom || '', to: stay ? '' : entry.flightTo || '' });
    });
    asList(trip.itineraryItems).forEach(item => {
      if (item.linkedReservationId && rows.some(row => row.id === item.linkedReservationId)) return;
      if (!item.voucherName && !item.voucherCode && !item.voucherFileName) return;
      rows.push({ id: `plan:${item.id}`, sourceId: item.id, source: 'itinerary', type: 'activity', title: item.voucherName || item.place || '입장권', date: item.date, time: item.time || '', reference: item.voucherCode || '', location: item.location || item.place || '', note: item.memo || '', attachment: !!item.voucherFile });
    });
    const order = { transport: 0, stay: 1, activity: 2, other: 3 };
    return rows.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || order[a.type] - order[b.type] || (a.time || '99:99').localeCompare(b.time || '99:99') || a.title.localeCompare(b.title));
  }
  function validateReservation(row) {
    if (!String(row.title || '').trim()) return '예약 이름을 입력해 주세요.';
    if (!types[row.type]) return '예약 종류를 선택해 주세요.';
    if (!validDate(row.date)) return '올바른 예약 일자를 입력해 주세요.';
    if (row.type === 'stay' && (!validDate(row.endDate) || row.endDate <= row.date)) return '체크아웃은 체크인 다음 날 이후로 선택해 주세요.';
    if (row.time && minutes(row.time) === null) return '시간을 확인해 주세요.';
    if (row.url && !safeUrl(row.url)) return '예약 링크는 http:// 또는 https:// 주소로 입력해 주세요.';
    return '';
  }
  function directions(item, trip) {
    if (isDomesticMapTrip(trip)) {
      const coords = typeof getBestRouteCoordinates === 'function' ? getBestRouteCoordinates(item, { requireSignature: true }) : getNaverRouteCoordinates(item);
      const stop = { place: [...new Set([item.place, item.location, trip.city].filter(Boolean))].join(' '), ...coords };
      return stop.place || coords ? buildNaverDirectionsLink([stop]).external : '';
    }
    const validCoord = item.lat !== null && item.lat !== undefined && item.lat !== '' && item.lon !== null && item.lon !== undefined && item.lon !== '' && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)) && Math.abs(Number(item.lat)) <= 90 && Math.abs(Number(item.lon)) <= 180;
    const destination = validCoord ? `${Number(item.lat)},${Number(item.lon)}` : [item.location || item.place, trip.city, trip.country].filter(Boolean).join(' ');
    return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : '';
  }
  function utcTime(date, time, timeZone) {
    if (!validDate(date) || minutes(time) === null) throw new Error('날짜 또는 시간이 올바르지 않아요.');
    let format;
    try { format = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { throw new Error('일정 시간대를 선택해 주세요.'); }
    if (!timeZone) throw new Error('일정 시간대를 선택해 주세요.');
    const wall = Date.parse(`${date}T${time}:00Z`);
    const wallAt = instant => { const parts = format.formatToParts(new Date(instant)); const p = name => parts.find(part => part.type === name).value; return Date.parse(`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:00Z`); };
    const offsets = new Set([-36, 0, 36].map(hour => { const sample = wall + hour * 3600000; return wallAt(sample) - sample; }));
    const matches = [...offsets].map(offset => wall - offset).filter(instant => wallAt(instant) === wall);
    if (matches.length !== 1) throw new Error(`${date} ${time}: 서머타임으로 ${matches.length ? '두 번 있는' : '존재하지 않는'} 시각이에요. 시간을 변경해 주세요.`);
    return new Date(matches[0]).toISOString().replace(/[-:]/g, '').replace('.000', '');
  }
  const icsText = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  function foldLine(line) {
    const encoder = new TextEncoder(); let current = '', bytes = 0, result = [];
    for (const character of line) { const size = encoder.encode(character).length; if (bytes + size > 75) { result.push(current); current = ' '; bytes = 1; } current += character; bytes += size; }
    result.push(current); return result.join('\r\n');
  }
  function createCalendar(trip, timeZone, now = new Date()) {
    const items = asList(trip.itineraryItems);
    if (!items.length) throw new Error('내보낼 일정이 없어요.');
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TripLOG//Travel Planner//KO', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsText(trip.tripName || 'TripLOG 여행')}`];
    for (const item of items) {
      if (!validDate(item.date)) throw new Error(`${item.place}: 날짜를 확인해 주세요.`);
      lines.push('BEGIN:VEVENT', `UID:${encodeURIComponent(trip.id)}-${encodeURIComponent(item.id)}@triplog.local`, `DTSTAMP:${stamp}`, 'CLASS:PRIVATE', `SUMMARY:${icsText(item.place || '여행 일정')}`);
      if (item.time) {
        const start = utcTime(item.date, item.time, timeZone);
        lines.push(`DTSTART:${start}`);
        if (item.theme !== 'lodging' && item.endTime) {
          if (minutes(item.endTime) === null || minutes(item.endTime) <= minutes(item.time)) throw new Error(`${item.place}: 종료 시간을 확인해 주세요.`);
          lines.push(`DTEND:${utcTime(item.date, item.endTime, timeZone)}`);
        }
      } else {
        if (item.theme !== 'lodging' && item.endTime) throw new Error(`${item.place}: 시작 시간을 입력해 주세요.`);
        lines.push(`DTSTART;VALUE=DATE:${item.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDay(item.date).replace(/-/g, '')}`);
      }
      if (item.location) lines.push(`LOCATION:${icsText(item.location)}`);
      if (item.memo) lines.push(`DESCRIPTION:${icsText(item.memo)}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }
  function createPocketNote(trip, { itinerary = true, references = true, budget = false, logo = '' } = {}) {
    const items = sortItineraryItems(asList(trip.itineraryItems));
    const wallet = reservations(trip), money = value => `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
    const line = (label, content) => content ? `<p><b>${esc(label)}</b> ${esc(content)}</p>` : '';
    const header = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(logo) ? `<img width="108" alt="TripLOG" src="${logo}">` : '<strong class="logo">TRIP<span>LOG</span></strong>';
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${esc(trip.tripName)} · 포켓노트</title><style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#0b1020;font:16px/1.6 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:24px 18px}h1{font-size:32px;line-height:1.2;margin:28px 0 8px}h2{font-size:23px;margin-top:30px}h3{margin:0 0 6px;font-size:19px}p{margin:6px 0;overflow-wrap:anywhere}article{border:2px solid #0b1020;border-radius:10px;padding:16px;margin:12px 0;break-inside:avoid}.muted{color:#686b75}.badge{background:#fff05a;border:1px solid;border-radius:6px;padding:2px 8px;display:inline-block}.logo{font-size:24px}.logo span{background:#f7afc7;border:2px solid;border-radius:7px}.summary{background:#bce6fb}code{font:inherit;font-weight:700;overflow-wrap:anywhere}footer{margin-top:32px;border-top:1px solid #e4e5e9;padding-top:14px}@media print{main{max-width:none}article{box-shadow:none}}</style></head><body><main>${header}<h1>${esc(trip.tripName || '나의 여행')}</h1><p class="muted">${esc(trip.startDate)} – ${esc(trip.endDate)} · ${esc([trip.city, trip.country].filter(Boolean).join(' · '))}</p><span class="badge">오프라인 포켓노트</span><p class="muted">저장한 시점의 기록입니다. 변경한 일정은 다시 저장해 주세요.</p>${itinerary ? `<h2>여행 일정</h2>${items.length ? items.map(item => `<article><small>${esc(item.date)} · ${esc(item.time || '시간 미정')}${item.theme !== 'lodging' && item.endTime ? ' – ' + esc(item.endTime) : ''}</small><h3>${esc(item.place)}</h3>${line('장소', item.location)}${line('메모', item.memo)}</article>`).join('') : '<p>등록된 일정이 없어요.</p>'}` : ''}<h2>예약 지갑</h2>${wallet.length ? wallet.map(row => `<article><span class="badge">${types[row.type].label}</span><h3>${esc(row.title)}</h3>${line('일자', [row.date, row.endDate ? '– ' + row.endDate : '', row.time].filter(Boolean).join(' '))}${line('장소', row.location)}${references ? line('예약번호', row.reference) : ''}${references ? line('메모', row.note) : ''}</article>`).join('') : '<p>등록된 예약이 없어요.</p>'}${budget ? `<article class="summary"><h2>여행 예산</h2>${line('예산', money(trip.totalBudget))}${line('기록한 지출', money(asList(trip.entries).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)))}</article>` : ''}<footer class="muted">TripLOG · 이 문서는 인터넷 연결 없이 열 수 있습니다. ${references ? '예약번호가 포함되어 있으니 개인 기기에 보관하세요.' : '예약번호와 예약 메모는 제외했습니다.'}</footer></main></body></html>`;
  }
  window.TripLog.register('features.travelCompanion.model', { types, esc, validDate, minutes, clock, days, dayItems, flags, transitMinutes, dateInZone, defaultZone, today, dailyBudget, reviewDay, outsideItems, signature, planAdjustment, applyAdjustment, undoAdjustment, safeUrl, reservations, validateReservation, directions, utcTime, foldLine, createCalendar, createPocketNote });
})();
