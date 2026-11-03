(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const model = () => window.TripLog.features.travelCompanion.model;
  const esc = value => model().esc(value);
  let source = null, tripId = '', account = '', selectedId = '', selectedSignature = '', newExpenseId = '', picker;
  const signature = row => JSON.stringify(Object.fromEntries(Object.entries(row || {}).filter(([key]) => key !== '_syncPosition').sort(([a], [b]) => a.localeCompare(b))));
  const accountId = () => window.TripLog.sync.controller.getAccount()?.id || 'device';
  const validScope = () => state.id === tripId && accountId() === account;
  const readNumber = id => Number($(id).value.replaceAll(',', ''));
  function setup(form) {
    const details = document.createElement('details'); details.id = 'ttReservationPayment'; details.className = 'cx-payment';
    details.innerHTML = `<summary>금액 · 지출 연동 <small>선택</small></summary><div><div class="tt-form-grid"><label><span>예약 금액</span><input name="quotedAmount" id="ttQuotedAmount" type="text" inputmode="decimal" placeholder="0" autocomplete="off"></label><label><span>통화</span><select name="quotedCurrency" id="ttQuotedCurrency">${['KRW', 'JPY', 'USD', 'EUR', 'CNY', 'TWD', 'HKD', 'SGD', 'THB', 'GBP', 'AUD'].map(code => `<option>${code}</option>`).join('')}</select></label></div><label><span>지출 연결</span><select id="ttPaymentMode"><option value="none">금액만 기록 · 지출에 반영 안 함</option><option value="create">결제 완료 · 새 지출 기록</option><option value="link">기존 지출 연결</option><option value="update">연결된 결제 정보 수정</option><option value="unlink">연결만 해제 · 지출 유지</option></select></label><div id="ttPaymentExisting"><button type="button" class="tt-button" id="ttChooseExpense">기존 지출 선택</button><p id="ttSelectedExpense" class="cx-payment-preview"></p></div><div id="ttPaymentFields"><div class="tt-form-grid"><label><span>실제 결제일</span><input id="ttPaymentDate" type="date" data-compact-date="true"></label><label><span>지출 분류</span><select id="ttPaymentCategory">${window.TripLog.data.expenseCategories.ledgerOrder.map(name => `<option>${esc(name)}</option>`).join('')}</select></label><label><span>결제수단</span><select id="ttPaymentMethod"><option value="card">카드</option><option value="cash">현금</option></select></label><label><span>결제자</span><select id="ttPaymentPayer"></select></label></div><div id="ttPaymentForeign" class="tt-form-grid"><label><span>환율 · 원</span><input id="ttPaymentRate" inputmode="decimal" type="text"></label><label><span>환율 기준 단위</span><input id="ttPaymentBase" inputmode="decimal" type="text"></label></div><p id="ttPaymentPreview" class="cx-payment-preview"></p><small>위 금액을 실제 결제액으로 기록해요. 이용일과 결제일은 별도예요.</small></div></div>`;
    form.querySelector('#ttReservationError').before(details);
    $('ttChooseExpense').addEventListener('click', showPicker);
    details.addEventListener('input', preview); details.addEventListener('change', event => {
      if (event.target.id === 'ttQuotedCurrency') {
        const meta = getCurrencyMeta(event.target.value);
        $('ttPaymentBase').value = meta.rateBase || 1;
        $('ttPaymentRate').value = event.target.value === state.currencyCode ? state.exchangeRate || 1 : getDefaultExchangeRateForCurrency(event.target.value);
      }
      preview();
    });
    setupCustomDatePicker($('ttPaymentDate'));
  }
  function open(row) {
    source = row; tripId = state.id; account = accountId(); selectedId = row?.linkedExpenseId || ''; newExpenseId = createId();
    const linked = state.entries.find(entry => entry.id === selectedId);
    selectedSignature = signature(linked);
    const record = window.TripLogSyncRepository.cached(state.id);
    $('ttReservationPayment').hidden = record?.role && record.role !== 'owner' && state.collaboration?.privacy?.shareExpenses === false;
    $('ttReservationPayment').open = false;
    const code = row?.quotedCurrency || linked?.currency || (state.travelMode === 'overseas' ? state.currencyCode : 'KRW') || 'KRW';
    if (!$('ttQuotedCurrency').querySelector(`option[value="${CSS.escape(code)}"]`)) $('ttQuotedCurrency').add(new Option(code, code));
    $('ttQuotedCurrency').value = code;
    $('ttQuotedAmount').value = row?.quotedAmount || (linked ? linked.mode === 'overseas' ? linked.foreignAmount : linked.amount : '') || '';
    $('ttPaymentMode').value = 'none';
    $('ttPaymentMode').querySelector('[value="update"]').disabled = !linked;
    $('ttPaymentMode').querySelector('[value="unlink"]').disabled = !selectedId;
    $('ttPaymentDate').value = linked?.paymentDate || model().dateInZone(model().defaultZone(state) || undefined);
    $('ttPaymentCategory').value = linked?.category || ({ transport: '교통', stay: '숙소', activity: '관광' })[row?.type || $('ttReservationForm').elements.type.value] || '기타';
    $('ttPaymentMethod').value = linked?.paymentMethod || 'card';
    $('ttPaymentPayer').innerHTML = getSettlementMembers().map(member => `<option value="${esc(member.key)}">${esc(member.name)}</option>`).join('');
    $('ttPaymentPayer').value = linked?.payerKey || 'leader';
    $('ttPaymentRate').value = linked?.exchangeRate || (code === state.currencyCode ? state.exchangeRate : getDefaultExchangeRateForCurrency(code)) || 1;
    $('ttPaymentBase').value = linked?.exchangeBase || getCurrencyMeta(code).rateBase || 1;
    syncCustomDatePicker($('ttPaymentDate')); preview();
    $('ttReservationPayment').querySelectorAll('select').forEach(select => { setupCustomSelect(select); syncCustomSelect(select, { rebuild: true }); });
  }
  function preview() {
    const mode = $('ttPaymentMode').value, code = $('ttQuotedCurrency').value;
    $('ttPaymentExisting').hidden = mode !== 'link';
    $('ttPaymentFields').hidden = !['create', 'update'].includes(mode);
    $('ttPaymentForeign').hidden = code === 'KRW';
    const linked = state.entries.find(entry => entry.id === selectedId);
    $('ttSelectedExpense').textContent = linked ? `${linked.description} · ${Math.round(linked.amount).toLocaleString('ko-KR')}원 · ${linked.paymentDate || linked.date}` : selectedId ? '연결된 지출이 없어졌어요. 다시 선택해 주세요.' : '선택한 지출을 재사용해요.';
    const amount = readNumber('ttQuotedAmount'), rate = readNumber('ttPaymentRate'), base = readNumber('ttPaymentBase');
    const krw = code === 'KRW' ? Math.round(amount) : base > 0 ? Math.round(amount * rate / base) : NaN;
    $('ttPaymentPreview').textContent = Number.isFinite(krw) && krw > 0 ? `${$('ttPaymentDate').value < state.startDate ? '사전구매' : $('ttPaymentDate').value || '결제일 선택'} · ${krw.toLocaleString('ko-KR')}원` : '실제 결제 금액과 환율을 확인해 주세요.';
  }
  function values() {
    if (!validScope()) throw new Error('여행이나 계정이 변경됐어요. 예약을 다시 열어 주세요.');
    const quotedAmount = readNumber('ttQuotedAmount'), quotedCurrency = $('ttQuotedCurrency').value, mode = $('ttPaymentMode').value;
    if (!Number.isFinite(quotedAmount) || quotedAmount < 0) throw new Error('예약 금액을 확인해 주세요.');
    const result = { quotedAmount, quotedCurrency, payment: { mode } };
    if (['link', 'update'].includes(mode) && signature(state.entries.find(entry => entry.id === selectedId)) !== selectedSignature) throw new Error('선택한 지출이 변경됐어요. 기존 지출을 다시 선택해 주세요.');
    if (mode === 'link') { if (!state.entries.some(entry => entry.id === selectedId)) throw new Error('연결할 지출을 선택해 주세요.'); result.payment.expenseId = selectedId; }
    if (['create', 'update'].includes(mode)) {
      if (!(quotedAmount > 0)) throw new Error('실제 결제 금액을 0보다 크게 입력해 주세요.');
      const overseas = quotedCurrency !== 'KRW', rate = readNumber('ttPaymentRate'), base = readNumber('ttPaymentBase'), date = $('ttPaymentDate').value;
      if (!model().validDate(date)) throw new Error('실제 결제일을 선택해 주세요.');
      if (overseas && (!(rate > 0) || !(base > 0))) throw new Error('환율과 기준 단위를 확인해 주세요.');
      const previous = mode === 'update' ? state.entries.find(entry => entry.id === source?.linkedExpenseId) : null;
      result.payment = { mode, expenseId: mode === 'update' ? source?.linkedExpenseId : newExpenseId, entry: {
        date: date < state.startDate ? '__pretrip__' : date, paymentDate: date,
        category: $('ttPaymentCategory').value, description: previous?.description || $('ttReservationName').value.trim(),
        amount: overseas ? Math.round(quotedAmount * rate / base) : Math.round(quotedAmount), mode: overseas ? 'overseas' : 'domestic',
        currency: overseas ? quotedCurrency : '', foreignAmount: overseas ? quotedAmount : 0,
        exchangeRate: overseas ? rate : 0, exchangeBase: overseas ? base : 1,
        paymentMethod: $('ttPaymentMethod').value, payerKey: $('ttPaymentPayer').value || 'leader', note: previous?.note || ''
      } };
    }
    return result;
  }
  function showPicker() {
    if (!validScope()) return;
    if (!picker) {
      picker = window.TripLog.ui.dialog.create({ id: 'ttExpensePicker', className: 'rd-dialog tt-dialog cx-sheet', labelledBy: 'ttExpensePickerTitle', markup: '<header class="tt-header"><h1 id="ttExpensePickerTitle" tabindex="-1">기존 지출 연결</h1><button type="button" class="tt-button tt-icon" data-payment-close aria-label="닫기"><i class="ph ph-x" aria-hidden="true"></i></button></header><div class="tt-scroll"><input type="search" id="ttExpenseSearch" aria-label="지출 검색" placeholder="지출 내용 검색"><div id="ttExpenseChoices" class="cx-select-list"></div></div>' });
      picker.addEventListener('input', renderChoices);
      picker.addEventListener('click', event => {
        if (event.target.closest('[data-payment-close]')) picker.close();
        const target = event.target.closest('[data-payment-expense]');
        if (target && validScope() && state.entries.some(entry => entry.id === target.dataset.paymentExpense)) { selectedId = target.dataset.paymentExpense; selectedSignature = signature(state.entries.find(entry => entry.id === selectedId)); preview(); picker.close(); $('ttChooseExpense').focus(); }
      });
    }
    $('ttExpenseSearch').value = ''; renderChoices(); window.TripLog.ui.dialog.open(picker);
  }
  function renderChoices() {
    const query = $('ttExpenseSearch').value.trim().toLocaleLowerCase('ko-KR');
    $('ttExpenseChoices').innerHTML = state.entries.filter(row => `${row.description} ${row.note || ''}`.toLocaleLowerCase('ko-KR').includes(query)).map(row => `<button type="button" class="tt-button${row.id === selectedId ? ' is-selected' : ''}" data-payment-expense="${esc(row.id)}"><b>${esc(row.description)} · ${Math.round(row.amount).toLocaleString('ko-KR')}원</b><small>${esc(row.paymentDate || row.date)} · ${esc(row.category)} · ${row.paymentMethod === 'cash' ? '현금' : '카드'}</small></button>`).join('') || '<p class="cx-empty-line">연결할 지출이 없어요.</p>';
  }
  window.TripLog.register('features.travelCompanion.payment', { setup, open, values });
})();
