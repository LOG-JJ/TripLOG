(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('../shared/itinerary-order') : root.TripLogItineraryOrder,
    node ? require('../features/travel-companion/model') : root.TripLog.features.travelCompanion.model,
    node ? require('../shared/expense-order') : root.TripLog.shared.expenseOrder);
  if (node) module.exports = api;
  root.TripLog?.register('domain.commands', api);
})(typeof window === 'undefined' ? globalThis : window, function (Order, Companion, ExpenseOrder) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const uuid = () => globalThis.crypto.randomUUID();
  const fields = {
    trip: 'tripName country countryCode city travelMode startDate endDate totalBudget currencyCode currencySymbol currencyUnit exchangeBase exchangeRate exchangeRateSource exchangeRateUpdatedAt',
    itinerary: 'date time endTime place location theme memo trans transits duration cost syncExpense lat lon mapQuery coordinateSource coordinateSignature coordinatePrecision coordinateAddress googlePlaceId voucherName voucherCode voucherFile voucherFileName transportReservation',
    expense: 'date category description amount note mode currency currencySymbol currencyUnit foreignAmount exchangeRate exchangeBase paymentDate paymentMethod payerKey pretripType pretripMemo bookingCode hotelName hotelAddress hotelCheckIn hotelCheckOut flightFrom flightTo flightAirline flightNumber flightDepartDate flightDepartTime flightReturnDate flightReturnDepartTime receipt',
    packing: 'name checked', companion: 'name individualSpent',
    reservation: 'type title date endDate time endTime arrivalDate transportKind from to reference location note url',
    settlement: 'leaderName splitMode itemSplits customShares',
  };
  function problem(message, details) { const e = new Error(message); e.code = 'INVALID_INPUT'; e.exitCode = 2; e.details = details; throw e; }
  function input(kind, value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) problem('JSON 객체를 입력해 주세요.');
    const allowed = fields[kind]?.split(' ') || [];
    const numbers = new Set('totalBudget exchangeBase exchangeRate amount foreignAmount duration cost lat lon individualSpent'.split(' '));
    const structures = new Set(['transits', 'transportReservation', 'receipt', 'itemSplits', 'customShares']);
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) problem(`지원하지 않는 ${kind} 필드: ${key}`);
      if (numbers.has(key)) { if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) problem(`${key}는 숫자여야 합니다.`); }
      else if (['syncExpense', 'checked'].includes(key)) { if (typeof value[key] !== 'boolean') problem(`${key}는 boolean이어야 합니다.`); }
      else if (structures.has(key)) { if (!value[key] || typeof value[key] !== 'object' || (key === 'transits') !== Array.isArray(value[key])) problem(`${key} 형식을 확인해 주세요.`); }
      else if (typeof value[key] !== 'string') problem(`${key}는 문자열이어야 합니다.`);
    }
    return clone(value);
  }
  function text(value, label, max = 1000) { if (typeof value !== 'string' || !value.trim() || value.length > max) problem(`${label}을(를) 확인해 주세요.`); }
  function date(value, label) { if (!Companion.validDate(value)) problem(`${label}은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.`); }
  function amount(value, label = '금액', min = 0) { if (!Number.isSafeInteger(value) || value < min) problem(`${label}은 ${min} 이상의 안전한 정수여야 합니다. 음수 환불의 서버 입력은 현재 지원하지 않습니다.`); }
  function validateTrip(trip) {
    text(trip.tripName, '여행 이름', 200); date(trip.startDate, '시작일'); date(trip.endDate, '종료일');
    if (trip.startDate > trip.endDate || !Companion.days(trip).length) problem('여행 기간을 확인해 주세요. 최대 3,660일입니다.');
    if (!['domestic', 'overseas'].includes(trip.travelMode)) problem('travelMode는 domestic 또는 overseas입니다.');
    if (trip.currencyCode && !/^[A-Z]{3}$/.test(trip.currencyCode)) problem('통화는 KRW, JPY 같은 3자리 코드입니다.');
    for (const key of ['exchangeBase', 'exchangeRate']) if (trip[key] !== undefined && (!Number.isFinite(trip[key]) || trip[key] <= 0)) problem(`${key}는 0보다 큰 수여야 합니다.`);
    if (trip.totalBudget !== undefined) amount(trip.totalBudget, '예산');
    return trip;
  }
  function createTrip(values, id = uuid()) {
    const data = input('trip', values);
    return validateTrip({ id, tripName: '', country: '대한민국', countryCode: 'KR', city: '', travelMode: 'domestic', currencyCode: 'KRW', currencySymbol: '₩', currencyUnit: '원', exchangeBase: 1, exchangeRate: 1,
      itineraryItems: [], entries: [], packingList: [], companions: [], travelCompanion: { reservations: [], completedItineraryIds: [], lockedItineraryIds: [], timeZone: 'Asia/Seoul' },
      settlement: { splitMode: 'equal', leaderName: '여행 대표', itemSplits: {}, customShares: {} },
      collaboration: { privacy: { shareItinerary: true, shareExpenses: true, showMemberEmail: false, allowInviteRequests: true } }, ...data });
  }
  function transitTotals(item) {
    const next = clone(item);
    if (!next.transits?.length) next.transits = [{ trans: next.trans || 'none', duration: next.duration || 0, cost: next.cost || 0, memo: '' }];
    next.duration = next.transits.reduce((sum, part) => sum + (part.duration || 0), 0);
    next.cost = next.transits.reduce((sum, part) => sum + (part.cost || 0), 0);
    next.trans = next.transits[0]?.trans || 'none'; return next;
  }
  function transitExpense(trip, item, newId = uuid) {
    const next = clone(item), entries = clone(trip.entries || []), deleted = [];
    if (next.syncExpense && next.cost > 0) {
      const labels = { walk: '도보', car: '차량', train: '기차', bus: '버스', flight: '비행', etc: '비행', none: '이동' };
      const description = `${next.place} 이동 경비 (${(next.transits || []).map(part => labels[part.trans] || '이동').join('+')})`;
      const previous = entries.find(entry => entry.id === next.expenseId);
      if (previous) Object.assign(previous, { date: next.date, amount: next.cost, description });
      else { next.expenseId = newId(); entries.push({ id: next.expenseId, date: next.date, category: '교통', description, amount: next.cost, note: '일정 자동 연동', mode: 'domestic', createdAt: Date.now() }); }
    } else if (next.expenseId && (!next.syncExpense || next.cost <= 0)) {
      deleted.push(next.expenseId); next.expenseId = null;
    }
    return { item: next, entries: entries.filter(entry => !deleted.includes(entry.id)), deleted };
  }
  function validateItem(kind, item, trip) {
    for (const [key, value] of Object.entries(item)) if (typeof value === 'string' && value.length > (key === 'voucherFile' ? 2200000 : 100000)) problem(`필드가 너무 깁니다: ${key}`);
    if (kind === 'itinerary') {
      date(item.date, '일정 날짜'); text(item.place, '장소', 1000);
      for (const key of ['time', 'endTime']) if (item[key] && Companion.minutes(item[key]) === null) problem('시간은 HH:MM 형식이어야 합니다.');
      if (item.endTime && item.theme !== 'lodging' && (!item.time || Companion.endMinutes(item) <= Companion.minutes(item.time))) problem('일정의 종료 시간은 시작 시간보다 늦어야 합니다.');
      if (!Array.isArray(item.transits) || item.transits.length > 100) problem('이동 구간 목록을 확인해 주세요.');
      for (const segment of item.transits) { if (!segment || typeof segment !== 'object' || Array.isArray(segment)) problem('이동 구간은 객체여야 합니다.'); amount(segment.cost || 0, '이동 비용'); amount(segment.duration || 0, '이동 시간'); }
      amount(item.cost || 0, '이동 비용'); amount(item.duration || 0, '이동 시간');
      if (item.syncExpense !== undefined && typeof item.syncExpense !== 'boolean') problem('syncExpense는 true 또는 false입니다.');
      for (const [key, bound] of [['lat', 90], ['lon', 180]]) if (item[key] !== undefined && item[key] !== null && item[key] !== '' && (!Number.isFinite(Number(item[key])) || Math.abs(Number(item[key])) > bound)) problem('좌표가 올바르지 않습니다.');
      if (item.transportReservation?.arrivalDate) { date(item.transportReservation.arrivalDate, '도착일'); if (item.transportReservation.arrivalDate < item.date) problem('도착일은 출발일 이후여야 합니다.'); }
    }
    if (kind === 'expense') {
      if (item.date !== '__pretrip__') date(item.date, '지출 일자');
      text(item.description, '지출 내용'); text(item.category, '분류'); amount(item.amount);
      if (item.paymentDate) date(item.paymentDate, '결제일');
      for (const key of ['hotelCheckIn', 'hotelCheckOut', 'flightDepartDate', 'flightReturnDate']) if (item[key]) date(item[key], key);
      if (item.hotelCheckIn && item.hotelCheckOut && item.hotelCheckOut <= item.hotelCheckIn) problem('체크아웃은 체크인 이후여야 합니다.');
      if (item.flightReturnDate && item.flightDepartDate && item.flightReturnDate < item.flightDepartDate) problem('귀국일은 출국일 이후여야 합니다.');
      for (const key of ['flightDepartTime', 'flightReturnDepartTime']) if (item[key] && Companion.minutes(item[key]) === null) problem(`${key}는 HH:MM 형식이어야 합니다.`);
      if (!['domestic', 'overseas'].includes(item.mode)) problem('mode는 domestic 또는 overseas입니다.');
      if (item.paymentMethod && !['card', 'cash'].includes(item.paymentMethod)) problem('paymentMethod는 card 또는 cash입니다.');
      if (item.payerKey && item.payerKey !== 'leader' && !(trip.companions || []).some(person => `companion:${person.id}` === item.payerKey)) problem('존재하는 결제자를 지정해 주세요.');
      if (item.mode === 'overseas') {
        if (!/^[A-Z]{3}$/.test(item.currency || '')) problem('해외 지출의 통화를 지정해 주세요.');
        for (const key of ['foreignAmount', 'exchangeRate', 'exchangeBase']) if (!Number.isFinite(item[key]) || item[key] < (key === 'foreignAmount' ? 0 : Number.MIN_VALUE)) problem(`해외 지출의 ${key}를 확인해 주세요.`);
        if (item.amount !== Math.round(item.foreignAmount * item.exchangeRate / item.exchangeBase)) problem('원화 금액과 외화·환율 환산 결과가 다릅니다.');
      }
    }
    if (kind === 'packing' || kind === 'companion') {
      text(item.name, '이름', 200);
      const list = kind === 'packing' ? trip.packingList : trip.companions;
      if (list.some(other => other.id !== item.id && other.name === item.name)) problem('동일한 이름이 이미 있습니다.');
      if (kind === 'packing' && typeof item.checked !== 'boolean') problem('checked는 true 또는 false입니다.');
      if (kind === 'companion') { amount(item.individualSpent || 0, '개인 지출'); if (['나', '방장'].includes(item.name)) problem('대표와 구분되는 이름을 지정해 주세요.'); }
    }
    if (kind === 'reservation') { text(item.title, '예약 이름'); const issue = Companion.validateReservation(item); if (issue) problem(issue); }
    return item;
  }
  const collections = { itinerary: 'itineraryItems', expense: 'entries', packing: 'packingList', companion: 'companions' };
  function list(trip, kind) {
    const rows = kind === 'reservation' ? (trip.travelCompanion?.reservations || []) : (trip[collections[kind]] || []);
    return kind === 'expense' && rows.some(entry => ExpenseOrder.rank(entry) !== null) ? ExpenseOrder.sort(rows) : rows;
  }
  function find(trip, kind, id) { const item = list(trip, kind).find(row => row.id === id); if (!item) { const e = new Error(`대상을 찾을 수 없습니다: ${id}`); e.code = 'NOT_FOUND'; e.exitCode = 3; throw e; } return item; }
  function normalizeExpense(item, data) {
    if (item.mode === 'overseas' && ['foreignAmount', 'exchangeRate', 'exchangeBase'].some(key => Object.hasOwn(data, key)) && !Object.hasOwn(data, 'amount')) item.amount = Math.round(item.foreignAmount * item.exchangeRate / item.exchangeBase);
    return item;
  }
  function mutate(source, kind, action, { id, data = {}, target, placement = 'before', checked } = {}) {
    const trip = clone(source);
    for (const field of Object.values(collections)) trip[field] ||= [];
    trip.travelCompanion ||= {}; trip.travelCompanion.reservations ||= []; trip.settlement ||= {};
    if (kind === 'trip') { Object.assign(trip, input('trip', data)); validateTrip(trip); return trip; }
    if (kind === 'settlement') { Object.assign(trip.settlement, input('settlement', data)); if (!['equal', 'custom'].includes(trip.settlement.splitMode || 'equal')) problem('splitMode는 equal 또는 custom입니다.'); if (trip.settlement.leaderName !== undefined) text(trip.settlement.leaderName, '대표 이름', 80); return trip; }
    if (kind === 'reservation' && action === 'link') {
      const row = Companion.reservations(trip).find(row => row.id === id || row.id === `manual:${id}`);
      if (!row) problem('연결할 예약을 찾을 수 없습니다.');
      if (row.source === 'itinerary') return trip;
      if (row.type === 'stay') { const stay = Companion.stayItinerary(trip, row, row, uuid); if (!stay.itineraryItems.some(item => item.linkedReservationId === row.id)) problem('여행 기간 안에 숙박일이 없습니다.'); trip.itineraryItems = stay.itineraryItems; }
      else if (!trip.itineraryItems.some(item => item.linkedReservationId === row.id)) {
        if (!Companion.days(trip).includes(row.date)) problem('예약이 여행 기간 밖에 있습니다. 여행 날짜를 먼저 변경해 주세요.');
        trip.itineraryItems.push(Companion.itineraryForReservation(row, { id: uuid(), linkedReservationId: row.id, trans: 'none', transits: [], duration: 0, cost: 0, createdAt: Date.now() }));
      }
      return trip;
    }
    let rows = kind === 'expense' ? (trip.entries || []) : list(trip, kind), item = action === 'add' ? null : find(trip, kind, id);
    if (action === 'remove') {
      if (kind === 'companion') {
        const key = `companion:${id}`;
        if (trip.entries.some(entry => entry.payerKey === key)) problem('결제자가 지정된 지출을 먼저 다른 사람에게 옮겨 주세요.');
        if (trip.settlement.customShares?.[key] || Object.values(trip.settlement.itemSplits || {}).some(split => split?.mode === 'custom' && split.shares?.[key])) problem('이 동행의 직접 입력 분담금을 먼저 다른 사람에게 옮겨 주세요.');
        if (trip.settlement.customShares) delete trip.settlement.customShares[key];
        for (const split of Object.values(trip.settlement.itemSplits || {})) if (split?.shares) delete split.shares[key];
      }
      if (kind === 'itinerary') {
        if (item.syncExpense && item.expenseId) trip.entries = trip.entries.filter(entry => entry.id !== item.expenseId);
        for (const key of ['completedItineraryIds', 'lockedItineraryIds']) trip.travelCompanion[key] = (trip.travelCompanion[key] || []).filter(value => value !== id);
      }
      if (kind === 'expense') {
        trip.itineraryItems = trip.itineraryItems.map(row => row.expenseId === id ? { ...row, expenseId: null, syncExpense: false } : row);
        trip.itineraryItems = trip.itineraryItems.map(row => { if (row.linkedReservationId !== `entry:${id}`) return row; const next = { ...row }; delete next.linkedReservationId; delete next.reservationStayDate; return next; });
        if (trip.settlement.itemSplits) delete trip.settlement.itemSplits[`current:${id}`];
      }
      if (kind === 'reservation') trip.itineraryItems = trip.itineraryItems.map(row => { if (row.linkedReservationId !== `manual:${id}`) return row; const next = { ...row }; delete next.linkedReservationId; delete next.reservationStayDate; return next; });
      rows = rows.filter(row => row.id !== id);
    } else if (action === 'move') {
      if (!['before', 'after'].includes(placement)) problem('placement는 before 또는 after입니다.');
      find(trip, kind, target);
      if (id === target) return trip;
      if (kind === 'itinerary') { const result = Order.move(rows, id, target, placement); if (!result.changed) problem('같은 날짜 안에서 일정 순서를 이동해 주세요.'); rows = result.items; }
      else if (kind === 'expense') rows = ExpenseOrder.move(rows, id, target, placement).items;
      else { rows = rows.filter(row => row.id !== id); rows.splice(rows.findIndex(row => row.id === target) + (placement === 'after' ? 1 : 0), 0, item); rows.forEach((row, index) => { row._syncPosition = (index + 1) * 1024; }); }
    } else if (action === 'check') { if (kind !== 'packing') problem('준비물에만 check를 사용할 수 있습니다.'); item.checked = checked !== false; }
    else if (action === 'complete' || action === 'lock') {
      if (kind !== 'itinerary') problem('일정에만 사용할 수 있습니다.');
      const field = action === 'complete' ? 'completedItineraryIds' : 'lockedItineraryIds';
      const ids = new Set(trip.travelCompanion[field] || []); if (checked === false) ids.delete(id); else ids.add(id); trip.travelCompanion[field] = [...ids];
    } else {
      if (!['add', 'update'].includes(action)) problem(`지원하지 않는 작업: ${action}`);
      const values = input(kind, data);
      const defaults = { itinerary: { time: '', endTime: '', location: '', memo: '', theme: 'sightseeing', trans: 'none', transits: [], cost: 0, duration: 0, syncExpense: false }, expense: { mode: 'domestic', paymentMethod: 'card', payerKey: 'leader', note: '' }, packing: { checked: false }, companion: { individualSpent: 0 }, reservation: { type: 'other', time: '', endTime: '', reference: '', note: '', location: '', url: '' } };
      let next = { ...(item || { ...defaults[kind], id: uuid(), createdAt: Date.now() }), ...values };
      if (kind === 'itinerary') {
        if (!Object.hasOwn(values, 'transits') && ['trans', 'duration', 'cost'].some(key => Object.hasOwn(values, key))) next.transits = [{ trans: next.trans, duration: next.duration, cost: next.cost, memo: '' }];
        next = transitTotals(next); validateItem(kind, next, trip);
        if (item && (item.place !== next.place || item.location !== next.location) && !Object.hasOwn(values, 'lat')) for (const key of ['lat', 'lon', 'mapQuery', 'coordinateSource', 'coordinateSignature', 'coordinatePrecision', 'coordinateAddress', 'googlePlaceId']) delete next[key];
        const linked = transitExpense(trip, next); next = linked.item; trip.entries = linked.entries;
      }
      if (kind === 'expense') {
        next = normalizeExpense(next, values);
        const linked = trip.itineraryItems.filter(row => row.syncExpense && row.expenseId === next.id);
        if (linked.length && item && (next.amount !== item.amount || next.date !== item.date)) problem('일정에 연결된 교통비의 금액·날짜는 itinerary update로 변경해 주세요.');
      }
      validateItem(kind, next, trip);
      rows = item ? rows.map(row => row.id === item.id ? next : row) : [...rows, next];
      if (kind === 'expense' && item && trip.itineraryItems.some(row => row.linkedReservationId === `entry:${item.id}`)) {
        const row = Companion.reservations({ ...trip, entries: [next] }).find(row => row.id === `entry:${item.id}`);
        if (row?.type === 'stay') trip.itineraryItems = Companion.stayItinerary(trip, row, Companion.stayFromEntry(item), uuid).itineraryItems;
        else if (row) trip.itineraryItems = trip.itineraryItems.map(plan => plan.linkedReservationId === row.id ? Companion.itineraryForReservation(row, plan) : plan);
      }
      if (kind === 'reservation') {
        const linkedId = `manual:${next.id}`;
        if (next.type === 'stay') trip.itineraryItems = Companion.stayItinerary(trip, { ...next, id: linkedId }, item, uuid).itineraryItems;
        else if (item?.type === 'stay') trip.itineraryItems = trip.itineraryItems.map(row => { if (row.linkedReservationId !== linkedId) return row; const copy = { ...row }; delete copy.linkedReservationId; delete copy.reservationStayDate; return copy; });
        else if (next.type === 'transport' || item?.type === 'transport') trip.itineraryItems = trip.itineraryItems.map(row => row.linkedReservationId === linkedId ? Companion.itineraryForReservation(next, row) : row);
      }
    }
    if (kind === 'reservation') trip.travelCompanion.reservations = rows;
    else trip[collections[kind]] = rows;
    for (const key of Object.keys(trip.settlement.itemSplits || {})) if (key.startsWith('current:') && !(trip.entries || []).some(entry => key === `current:${entry.id}`)) delete trip.settlement.itemSplits[key];
    return trip;
  }
  return { fields, input, createTrip, validateTrip, validateItem, transitTotals, transitExpense, list, find, mutate };
});
