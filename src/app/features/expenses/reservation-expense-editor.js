(() => {
  const $ = id => document.getElementById(id);
  const known = entry => ['hotel', 'flight'].includes(entry?.pretripType);
  const groups = {
    hotel: [
      ['hotelName', '숙소명', 'text', true], ['hotelCheckIn', '체크인', 'date'], ['hotelCheckOut', '체크아웃', 'date'],
      ['hotelRoomType', '객실 · 요금제', 'text'], ['hotelGuests', '인원', 'number'], ['hotelAddress', '주소 · 장소', 'text', true],
    ],
    flight: [
      ['flightAirline', '항공사', 'text'], ['flightNumber', '편명', 'text'], ['flightFrom', '출발지', 'text'], ['flightTo', '도착지', 'text'],
      ['flightDepartDate', '가는 날', 'date'], ['flightDepartTime', '출발 시간', 'time'],
      ['flightReturnDate', '오는 날', 'date'], ['flightReturnDepartTime', '복귀 출발 시간', 'time'],
    ],
  };
  let panel, source = null, tripId = '', signature = '';
  const entrySignature = entry => JSON.stringify(Object.fromEntries(
    Object.entries(entry || {}).filter(([key]) => key !== '_syncPosition').sort(([a], [b]) => a.localeCompare(b))
  ));
  const input = key => $(`exReservation_${key}`);
  const value = key => input(key).value.trim();
  const field = ([key, label, type, wide]) => `<label${wide ? ' class="wide"' : ''}><span>${label}</span><input id="exReservation_${key}" data-reservation-field="${key}" type="${type}" ${type === 'date' ? 'data-compact-date="true"' : ''} ${type === 'number' ? 'min="1" max="999" step="1" inputmode="numeric"' : ''} autocomplete="off"></label>`;
  function setup(form) {
    panel = document.createElement('details'); panel.id = 'exReservationDetails'; panel.className = 'rd-details wide ex-reservation-details'; panel.hidden = true;
    panel.innerHTML = `<summary><i class="ph ph-ticket" aria-hidden="true"></i><span id="exReservationLabel">예약 상세</span><i class="ph ph-caret-down" aria-hidden="true"></i></summary>
      <div id="exReservationHotel" class="ex-date-row ex-reservation-grid">${groups.hotel.map(field).join('')}</div>
      <div id="exReservationFlight" class="ex-date-row ex-reservation-grid">${groups.flight.map(field).join('')}</div>
      <label id="exReservationRoundTripLabel" class="ex-reservation-roundtrip"><input id="exReservationRoundTrip" type="checkbox"><span>왕복 항공권</span></label>
      <label class="ex-reservation-code"><span>예약번호</span><input id="exReservation_bookingCode" autocomplete="off" spellcheck="false"></label>
      <p id="exReservationSummary" class="ex-reservation-summary" role="status"></p>`;
    form.querySelector('.payment-method-field').before(panel);
    for (const spec of Object.values(groups).flat()) {
      if (spec[2] === 'date') setupCustomDatePicker(input(spec[0]));
      if (spec[2] === 'time') setupCustomTimePicker(input(spec[0]));
    }
    panel.addEventListener('change', sync);
    panel.addEventListener('input', sync);
    form.addEventListener('input', event => { if ([els.amountInput, els.foreignAmountInput, els.exchangeRateInput].includes(event.target)) sync(); });
    form.addEventListener('change', sync);
    // Place the journey choice immediately before its optional return date fields.
    input('flightReturnDate').closest('label').before($('exReservationRoundTripLabel'));
  }
  function open(entry, options = {}) {
    source = known(entry) ? JSON.parse(JSON.stringify(entry)) : null;
    tripId = state.id; signature = entrySignature(source);
    panel.hidden = !source; panel.open = Boolean(source && options.focusBookingCode);
    for (const [kind, specs] of Object.entries(groups)) {
      $(`exReservation${kind === 'hotel' ? 'Hotel' : 'Flight'}`).hidden = source?.pretripType !== kind;
      for (const [key, , type] of specs) {
        const control = input(key); control.value = source?.[key] || ''; control.disabled = source?.pretripType !== kind;
        if (type === 'date') { control.min = state.startDate || ''; control.max = state.endDate || ''; syncCustomDatePicker(control); }
        if (type === 'time') syncCustomTimePicker(control);
      }
    }
    input('bookingCode').value = source?.bookingCode || ''; input('bookingCode').disabled = !source;
    $('exReservationRoundTrip').checked = Boolean(source?.flightReturnDate);
    $('exReservationRoundTrip').disabled = source?.pretripType !== 'flight';
    $('exReservationLabel').textContent = source?.pretripType === 'hotel' ? '숙소 예약 상세' : '항공권 예약 상세';
    sync();
    if (source && options.focusBookingCode) { input('bookingCode').focus({ preventScroll: true }); input('bookingCode').scrollIntoView({ block: 'center' }); }
  }
  function sync() {
    if (!source) return;
    const roundtrip = source.pretripType === 'flight' && $('exReservationRoundTrip').checked;
    for (const key of ['flightReturnDate', 'flightReturnDepartTime']) {
      input(key).disabled = !roundtrip; input(key).closest('label').hidden = !roundtrip;
      (key === 'flightReturnDate' ? syncCustomDatePicker : syncCustomTimePicker)(input(key));
    }
    const nights = source.pretripType === 'hotel' ? getPretripHotelNights(value('hotelCheckIn'), value('hotelCheckOut')) : 0;
    const amount = parseFormattedNumber(els.amountInput.value);
    $('exReservationSummary').textContent = source.pretripType === 'hotel'
      ? nights ? `${nights}박 · 숙박 전체 금액${amount > 0 ? ` · 1박 평균 ${Math.round(amount / nights).toLocaleString('ko-KR')}원` : ''}` : '체크인과 체크아웃 날짜를 확인해 주세요.'
      : `${roundtrip ? '왕복' : '편도'} · 예약 지갑에도 함께 반영돼요.`;
  }
  function error(message, key) {
    panel.open = true;
    const control = key ? input(key) : input('bookingCode');
    return { message, target: customDatePickers.get(control)?.button || customTimePickers.get(control)?.button || control };
  }
  function validate() {
    if (!source) return null;
    if (tripId !== state.id || editingId !== source.id || entrySignature(findEntry(source.id)) !== signature) return error('예약이 다른 곳에서 변경됐어요. 지출 창을 다시 열어 확인해 주세요.');
    const hotel = source.pretripType === 'hotel', model = window.TripLog.features.travelCompanion.model;
    for (const key of hotel ? ['hotelName'] : ['flightAirline', 'flightFrom', 'flightTo']) if (!value(key)) return error(`${groups[hotel ? 'hotel' : 'flight'].find(field => field[0] === key)[1]} 항목을 입력해 주세요.`, key);
    const dates = hotel ? ['hotelCheckIn', 'hotelCheckOut'] : ['flightDepartDate', ...($('exReservationRoundTrip').checked ? ['flightReturnDate'] : [])];
    for (const key of dates) if (!model.validDate(value(key)) || (state.startDate && value(key) < state.startDate) || (state.endDate && value(key) > state.endDate)) return error('예약 날짜를 여행 기간 안에서 선택해 주세요.', key);
    if (hotel && value('hotelCheckOut') <= value('hotelCheckIn')) return error('체크아웃은 체크인 다음 날 이후로 선택해 주세요.', 'hotelCheckOut');
    if (!hotel && $('exReservationRoundTrip').checked && value('flightReturnDate') < value('flightDepartDate')) return error('오는 날은 가는 날보다 앞설 수 없어요.', 'flightReturnDate');
    if (hotel && value('hotelGuests') && (!Number.isInteger(Number(value('hotelGuests'))) || Number(value('hotelGuests')) < 1 || Number(value('hotelGuests')) > 999)) return error('인원은 1~999 사이의 정수로 입력해 주세요.', 'hotelGuests');
    return null;
  }
  function metadata() {
    if (!source) return {};
    const hotel = source.pretripType === 'hotel', fields = Object.fromEntries(groups[source.pretripType].map(([key]) => [key, value(key)]));
    const memo = els.noteInput.value.trim(); fields.bookingCode = value('bookingCode');
    if (hotel) fields.hotelGuests = Number(fields.hotelGuests) || 0;
    else if (!$('exReservationRoundTrip').checked) { fields.flightReturnDate = ''; fields.flightReturnDepartTime = ''; }
    const notes = hotel ? [`체크인 ${fields.hotelCheckIn}`, `체크아웃 ${fields.hotelCheckOut}`, `${getPretripHotelNights(fields.hotelCheckIn, fields.hotelCheckOut)}박`, fields.hotelRoomType ? `객실 ${fields.hotelRoomType}` : '', fields.hotelGuests ? `${fields.hotelGuests}명` : '']
      : [`출발 ${fields.flightDepartDate}${fields.flightDepartTime ? ` ${fields.flightDepartTime}` : ''}`, fields.flightReturnDate ? `복귀 출발 ${fields.flightReturnDate}${fields.flightReturnDepartTime ? ` ${fields.flightReturnDepartTime}` : ''}` : ''];
    const description = row => hotel ? `숙소 예약 · ${row.hotelName}` : `항공권 · ${[row.flightAirline, row.flightNumber].filter(Boolean).join(' ')} · ${row.flightFrom} → ${row.flightTo}`;
    if (source.description === description(source) && els.descriptionInput.value.trim() === source.description) fields.description = description(fields);
    return { ...fields, pretripMemo: memo, note: [...notes, fields.bookingCode ? `예약번호 ${fields.bookingCode}` : '', memo].filter(Boolean).join(' · ') };
  }
  window.TripLog.register('features.expenses.reservationEditor', { setup, open, validate, metadata });
})();
