(function createReceiptInput() {
  const ids = ['CameraButton', 'AlbumButton', 'CameraInput', 'AlbumInput', 'CloseButton', 'Language', 'ImageArea',
    'Preview', 'CropBox', 'RotateButton', 'CropButton', 'CropApplyButton', 'CropHint', 'RecognizeButton', 'ProgressArea',
    'Progress', 'CancelButton', 'Status', 'ReviewForm', 'Warnings', 'Merchant', 'Date', 'ExpenseDate', 'Amount',
    'Currency', 'Category', 'Payment', 'RawText', 'ParseTextButton', 'ApplyButton', 'TextDetails',
    'JsonText', 'JsonPrompt', 'CopyPrompt', 'ParseJson', 'JsonStatus'];
  const ui = Object.fromEntries(ids.map((id) => [id, els.receiptDialog.querySelector(`#receipt${id}`)]));
  const parser = window.TripLog.features.expenses.receiptParser;
  const engine = window.TripLog.features.expenses.receiptOcr;
  let snapshot = '';
  let photo = null;
  let fingerprint = '';
  let generation = 0;
  let controller = null;
  let busy = false;
  let pendingReceipt = null;
  let cropMode = false;
  let cropStart = null;
  let crop = null;
  let setupDone = false;
  let structured = null;

  function formSignature() {
    return JSON.stringify([state.id, editingId, state.travelMode, state.startDate, state.endDate,
      ...['daySelect', 'categorySelect', 'descriptionInput', 'amountInput', 'currencySelect', 'foreignAmountInput',
        'exchangeRateInput', 'noteInput', 'paymentMethodInput', 'lodgingCheckInInput', 'lodgingCheckOutInput'].map((id) => els[id]?.value),
      document.getElementById('rdPaymentDate')?.value, document.getElementById('rdPayer')?.value]);
  }
  function status(message, error = false) {
    ui.Status.textContent = message;
    ui.Status.classList.toggle('is-error', error);
  }
  function setBusy(value) {
    busy = value;
    ['CameraButton', 'AlbumButton', 'RotateButton', 'CropButton', 'Language', 'ParseTextButton', 'ParseJson', 'JsonText'].forEach((key) => { ui[key].disabled = value; });
    ui.RecognizeButton.disabled = value || !photo;
    ui.ApplyButton.disabled = value || ui.ReviewForm.hidden;
    ui.ProgressArea.hidden = !value;
    ui.ReviewForm.inert = value;
    ui.RawText.disabled = value;
  }
  function resetReview() {
    structured = null;
    ui.ReviewForm.reset(); ui.ReviewForm.hidden = true; ui.ApplyButton.disabled = true;
    ui.RawText.value = ''; ui.Warnings.replaceChildren();
  }
  function drawPreview() {
    const canvas = ui.Preview;
    canvas.width = photo.width; canvas.height = photo.height;
    canvas.getContext('2d').drawImage(photo, 0, 0);
    ui.ImageArea.hidden = false;
  }
  function cancel() {
    generation++;
    controller?.abort(); controller = null;
    setBusy(false);
  }
  function setCropMode(enabled) {
    cropMode = enabled; crop = null; cropStart = null;
    ui.CropBox.hidden = true;
    ui.CropHint.hidden = !enabled; ui.CropApplyButton.hidden = !enabled; ui.CropApplyButton.disabled = true;
    ui.CropButton.setAttribute('aria-pressed', String(enabled));
    ui.Preview.classList.toggle('is-cropping', enabled);
  }
  function open() {
    cancel(); snapshot = formSignature(); fingerprint = ''; photo = null; resetReview(); setCropMode(false);
    ui.Preview.width = ui.Preview.height = 1; ui.ImageArea.hidden = true; ui.TextDetails.open = false;
    ui.Language.value = state.travelMode === 'domestic' ? 'kor+eng' : state.currencyCode === 'JPY' ? 'jpn+eng' : 'eng';
    ui.ExpenseDate.replaceChildren(new Option('일자를 선택해 주세요', ''));
    for (const option of els.daySelect.options) ui.ExpenseDate.add(new Option(option.textContent, option.value));
    ui.JsonText.value = ''; ui.JsonStatus.textContent = '';
    ui.JsonPrompt.value = window.TripLog.features.expenses.receiptJson.prompt({
      startDate: state.startDate, endDate: state.endDate,
      payers: getSettlementMembers().map(member => ({ key: member.key, name: member.isLeader ? '나' : member.name })),
    });
    setBusy(false); status('AI 결과를 붙여넣거나 영수증 사진을 선택해 주세요.');
    els.receiptDialog.showModal();
  }
  async function choosePhoto(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    cancel(); const token = generation;
    resetReview(); setCropMode(false); setBusy(true); status('사진을 준비하고 있어요.');
    ui.Progress.removeAttribute('value');
    try {
      const result = await engine.prepareImage(file);
      if (token !== generation || !els.receiptDialog.open) { result.canvas.width = result.canvas.height = 1; return; }
      if (photo) photo.width = photo.height = 1;
      photo = result.canvas; fingerprint = result.fingerprint; drawPreview();
      status('사진과 언어를 확인하고 ‘영수증 인식’을 눌러 주세요.');
    } catch (error) {
      if (token === generation) status(error.message || '사진을 준비하지 못했습니다. JPG 사진으로 다시 시도해 주세요.', true);
    } finally { if (token === generation) setBusy(false); }
  }
  function showResult(result) {
    structured = result.structured || null;
    ui.Merchant.value = result.merchant;
    ui.Date.value = result.date;
    ui.Amount.value = result.amount === null ? '' : String(result.amount);
    ui.Currency.value = result.currency;
    ui.Category.value = result.category;
    ui.Payment.value = result.paymentMethod;
    ui.RawText.value = result.text;
    ui.ExpenseDate.value = [...ui.ExpenseDate.options].some((option) => option.value === result.date) ? result.date : '';
    if (structured?.expenseDate) ui.ExpenseDate.value = structured.expenseDate;
    const warnings = [...result.warnings];
    if (!ui.ExpenseDate.value) warnings.push('여행의 어느 일자에 기록할지 선택해 주세요. 사전 결제는 ‘사전구매’를 선택할 수 있어요.');
    const duplicate = parser.findReceiptDuplicate(state.entries, { ...result, fingerprint }, editingId);
    if (duplicate) warnings.push('이미 등록한 영수증 또는 비슷한 지출이 있습니다. 중복 여부를 확인해 주세요.');
    ui.Warnings.replaceChildren(...warnings.map((message) => { const li = document.createElement('li'); li.textContent = message; return li; }));
    ui.Warnings.hidden = !warnings.length;
    ui.ReviewForm.hidden = false; ui.ApplyButton.disabled = false;
    status('입력 정보를 확인해 주세요. 아직 지출에 저장되지 않았습니다.');
    ui.Status.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function recognize() {
    if (busy || !photo) return;
    setCropMode(false); const token = ++generation; controller = new AbortController();
    setBusy(true); ui.Progress.value = 0;
    const started = performance.now(); status('인식 파일을 불러오고 있어요.');
    try {
      const lines = await engine.recognize(photo, ui.Language.value, (event) => {
        if (token !== generation) return;
        const labels = { 'loading tesseract core': '인식 엔진 불러오는 중', 'loading language traineddata': '언어 파일 불러오는 중',
          'initializing tesseract': '인식 엔진 준비 중', 'initializing api': '언어 준비 중', 'recognizing text': '영수증 글자 읽는 중' };
        status(labels[event.status] || '영수증 인식 준비 중');
        ui.Progress.value = Number(event.progress) || 0;
      }, controller.signal);
      if (token !== generation) return;
      if (!lines.length) throw new Error('글자를 찾지 못했습니다. 영수증을 밝고 선명하게 다시 찍어 주세요.');
      showResult(parser.parseReceipt(lines));
      status(`인식 완료 · ${((performance.now() - started) / 1000).toFixed(1)}초. 금액·통화·일자를 확인해 주세요.`);
    } catch (error) {
      if (token === generation) status(error.name === 'AbortError' ? '인식을 취소했습니다.' : (error.message || '인식하지 못했습니다. 사진을 다시 선택해 주세요.'), error.name !== 'AbortError');
    } finally { if (token === generation) { controller = null; setBusy(false); } }
  }
  function apply(event) {
    event.preventDefault();
    if (busy || ui.ReviewForm.hidden) return;
    if (snapshot !== formSignature()) {
      status('인식 중 여행이나 지출 입력값이 바뀌었습니다. 현재 입력을 보호하기 위해 창을 닫고 다시 시작해 주세요.', true); return;
    }
    const amount = parser.parseReceiptNumber(ui.Amount.value);
    if (!(amount > 0)) { status('0보다 큰 결제금액을 입력해 주세요.', true); ui.Amount.focus(); return; }
    if (['KRW', 'JPY', 'VND'].includes(ui.Currency.value) && !Number.isInteger(amount)) {
      status('선택한 통화의 금액에 소수점이 있습니다. 원본의 숫자와 구분 기호를 확인해 주세요.', true); return;
    }
    if (state.travelMode !== 'overseas' && ui.Currency.value !== 'KRW') {
      status('해외 통화 영수증입니다. 여행 설정을 해외 모드로 바꾼 뒤 입력해 주세요.', true); return;
    }
    const date = ui.ExpenseDate.value;
    if (![...els.daySelect.options].some((option) => option.value === date)) {
      status('기록할 여행 일자를 선택해 주세요.', true); return;
    }
    if (structured) {
      const issue = structuredIssue(structured);
      if (issue) { status(issue, true); return; }
      if ((structured.checkIn || structured.checkOut) && ui.Category.value !== '숙소') {
        status('체크인·체크아웃이 있는 JSON입니다. 항목을 숙소로 선택하거나 날짜를 제거해 주세요.', true); return;
      }
    }
    els.daySelect.value = date;
    els.categorySelect.value = ui.Category.value;
    els.descriptionInput.value = ui.Merchant.value.trim();
    setPaymentMethod(ui.Payment.value);
    if (state.travelMode === 'overseas') {
      const previousCurrency = els.currencySelect.value;
      const previousRate = parseFormattedNumber(els.exchangeRateInput.value);
      const currency = getCurrencyMeta(ui.Currency.value);
      if (state.currencyCode !== currency.code) {
        exchangeRateFetchToken++;
        setPreferredCurrency(currency.code);
        state.exchangeRate = getDefaultExchangeRateForCurrency(currency.code);
        state.exchangeRateSource = '기본값'; state.exchangeRateUpdatedAt = '';
        state.currencyAutoMatchedCountryCode = getCurrentCurrencyMatchCountryKey();
      }
      renderModeControls();
      els.currencySelect.value = currency.code;
      if (previousCurrency === currency.code && previousRate > 0) setCommaNumberInputValue(els.exchangeRateInput, previousRate);
      setCommaNumberInputValue(els.foreignAmountInput, amount);
      updateExchangeRateGuide(); updateConvertedAmount();
    } else setCommaNumberInputValue(els.amountInput, amount);
    syncCustomSelect(els.daySelect); syncCustomSelect(els.categorySelect); syncCustomSelect(els.currencySelect);
    renderExpenseFormMode();
    if (structured) {
      els.noteInput.value = structured.note || '';
      const paymentDate = document.getElementById('rdPaymentDate');
      paymentDate.value = ui.Date.value; syncCustomDatePicker(paymentDate);
      const payer = document.getElementById('rdPayer');
      if (structured.payerKey) { payer.value = structured.payerKey; syncCustomSelect(payer); }
      document.getElementById('rdExpenseMemo').open = Boolean(els.noteInput.value || payer.value !== 'leader');
      if (state.travelMode === 'overseas' && structured.exchangeRate && ui.Currency.value !== 'KRW') {
        setCommaNumberInputValue(els.exchangeRateInput, structured.exchangeRate);
        updateExchangeRateGuide(); updateConvertedAmount();
      }
      if (isLodgingSplitMode()) {
        els.lodgingCheckInInput.value = structured.checkIn || '';
        els.lodgingCheckOutInput.value = structured.checkOut || '';
        syncLodgingDateBounds(); updateLodgingPreview();
      }
      window.TripLog.features.expenses.workspace?.syncEditor();
    }
    pendingReceipt = { tripId: state.id, editingId, fingerprint, recognizedDate: ui.Date.value };
    const applied = document.getElementById('receiptAppliedStatus');
    applied.textContent = `영수증 정보를 채웠어요. ${state.travelMode === 'overseas' ? '환율과 ' : ''}입력값을 확인한 뒤 ‘${editingId ? '저장' : '추가'}’를 눌러 주세요.`;
    applied.hidden = false;
    els.receiptDialog.close();
    els.expenseForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    els.descriptionInput.focus({ preventScroll: true });
    // Programmatic filling must participate in the existing local draft flow.
    els.descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function structuredIssue(data) {
    if (data.expenseDate && ![...els.daySelect.options].some(option => option.value === data.expenseDate)) return 'expenseDate가 여행 기간 밖입니다. 여행 일자 또는 __pretrip__으로 수정해 주세요.';
    if (data.payerKey && !getSettlementMembers().some(member => member.key === data.payerKey)) return '현재 여행에 없는 payerKey입니다. 프롬프트를 다시 복사해 결제자를 확인해 주세요.';
    if (editingId && (data.checkIn || data.checkOut)) return '숙박 기간은 새 지출에서 입력해 주세요. 기존 숙소의 기간은 예약 상세에서 수정할 수 있어요.';
    for (const key of ['checkIn', 'checkOut']) if (data[key] && (data[key] < state.startDate || data[key] > state.endDate)) return '체크인·체크아웃은 현재 여행 기간 안으로 입력해 주세요.';
    return '';
  }
  function parseJson() {
    if (busy) return;
    resetReview(); fingerprint = '';
    try {
      const result = window.TripLog.features.expenses.receiptJson.parse(ui.JsonText.value);
      const issue = structuredIssue(result.structured);
      if (issue) throw new Error(issue);
      showResult(result);
      ui.JsonStatus.textContent = '정보를 읽었어요. 아래에서 확인한 뒤 지출 정보에 적용해 주세요.';
      const guidance = document.getElementById('rdReceiptStatusInfo');
      // The redesign observer collapses this on review; reopen after it runs.
      if (guidance && result.warnings.length) queueMicrotask(() => { guidance.open = true; });
    } catch (error) { ui.JsonStatus.textContent = error.message; status(error.message, true); }
  }
  function reset() {
    pendingReceipt = null;
    const applied = document.getElementById('receiptAppliedStatus');
    if (applied) applied.hidden = true;
  }
  function metadata() {
    if (!pendingReceipt || pendingReceipt.tripId !== state.id || pendingReceipt.editingId !== editingId) return null;
    return { fingerprint: pendingReceipt.fingerprint, recognizedDate: pendingReceipt.recognizedDate };
  }
  async function beforeSubmit() {
    const receipt = metadata();
    if (!receipt) return true;
    const duplicate = parser.findReceiptDuplicate(state.entries, {
      ...receipt, merchant: els.descriptionInput.value, date: els.daySelect.value,
      currency: state.travelMode === 'overseas' ? els.currencySelect.value : 'KRW',
      amount: parseFormattedNumber(state.travelMode === 'overseas' ? els.foreignAmountInput.value : els.amountInput.value),
    }, editingId);
    return !duplicate || await (window.TripLog.features.redesign?.workspace?.confirmAction?.('같은 영수증 또는 비슷한 지출이 이미 있습니다. 별도 지출로 다시 저장할까요?') ?? window.confirm('같은 영수증 또는 비슷한 지출이 이미 있습니다. 별도 지출로 다시 저장할까요?'));
  }
  function pointerPosition(event) {
    const rect = ui.Preview.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  }
  function setup() {
    if (setupDone) return; setupDone = true;
    els.receiptOpenButton.addEventListener('click', open);
    ui.ParseJson.addEventListener('click', parseJson);
    ui.JsonText.addEventListener('input', () => { resetReview(); ui.JsonStatus.textContent = ''; });
    ui.CopyPrompt.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(ui.JsonPrompt.value); ui.JsonStatus.textContent = '프롬프트를 복사했어요. 외부 AI에 영수증과 함께 전달해 주세요.'; }
      catch { ui.JsonPrompt.closest('details').open = true; ui.JsonPrompt.focus(); ui.JsonPrompt.select(); ui.JsonStatus.textContent = '자동 복사가 안 되어 텍스트를 선택했어요. 직접 복사해 주세요.'; }
    });
    ui.CloseButton.addEventListener('click', () => els.receiptDialog.close());
    els.receiptDialog.addEventListener('close', () => {
      if (els.receiptDialog.open) return;
      cancel(); setCropMode(false); if (photo) photo.width = photo.height = 1;
      engine.release();
      photo = null; fingerprint = ''; ui.Preview.width = ui.Preview.height = 1;
      resetReview();
    });
    ui.CameraButton.addEventListener('click', () => ui.CameraInput.click());
    ui.AlbumButton.addEventListener('click', () => ui.AlbumInput.click());
    ui.CameraInput.addEventListener('change', choosePhoto); ui.AlbumInput.addEventListener('change', choosePhoto);
    ui.RecognizeButton.addEventListener('click', recognize);
    ui.CancelButton.addEventListener('click', () => { cancel(); status('인식을 취소했습니다. 다시 시도할 수 있어요.'); });
    ui.ReviewForm.addEventListener('submit', apply);
    ui.ParseTextButton.addEventListener('click', () => {
      if (!busy && ui.RawText.value.trim()) showResult(parser.parseReceipt(ui.RawText.value));
    });
    ui.Date.addEventListener('change', () => {
      ui.ExpenseDate.value = [...ui.ExpenseDate.options].some((option) => option.value === ui.Date.value) ? ui.Date.value : '';
    });
    ui.RotateButton.addEventListener('click', () => {
      if (!photo || busy) return;
      const rotated = document.createElement('canvas'); rotated.width = photo.height; rotated.height = photo.width;
      const ctx = rotated.getContext('2d'); ctx.translate(rotated.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(photo, 0, 0);
      photo.width = photo.height = 1; photo = rotated; setCropMode(false); resetReview(); drawPreview();
    });
    ui.CropButton.addEventListener('click', () => setCropMode(!cropMode));
    ui.Preview.addEventListener('pointerdown', (event) => {
      if (!cropMode || busy) return;
      cropStart = pointerPosition(event); ui.Preview.setPointerCapture(event.pointerId); event.preventDefault();
    });
    ui.Preview.addEventListener('pointermove', (event) => {
      if (!cropStart) return;
      const point = pointerPosition(event);
      crop = { x: Math.min(point.x, cropStart.x), y: Math.min(point.y, cropStart.y), w: Math.abs(point.x - cropStart.x), h: Math.abs(point.y - cropStart.y) };
      ui.CropBox.hidden = false;
      Object.assign(ui.CropBox.style, { left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` });
      ui.CropApplyButton.disabled = crop.w * photo.width < 50 || crop.h * photo.height < 50;
    });
    ui.Preview.addEventListener('pointerup', () => { cropStart = null; });
    ui.Preview.addEventListener('pointercancel', () => { cropStart = null; });
    ui.CropApplyButton.addEventListener('click', () => {
      if (!crop || ui.CropApplyButton.disabled) return;
      const cropped = document.createElement('canvas'); cropped.width = Math.round(photo.width * crop.w); cropped.height = Math.round(photo.height * crop.h);
      cropped.getContext('2d').drawImage(photo, photo.width * crop.x, photo.height * crop.y, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      photo.width = photo.height = 1; photo = cropped; setCropMode(false); resetReview(); drawPreview();
    });
    window.addEventListener('pagehide', () => { cancel(); engine.release(); });
    window.addEventListener('triplog:state-saved', () => {
      if (pendingReceipt && pendingReceipt.tripId !== state.id) reset();
    });
  }
  window.TripLog.register('features.expenses.receiptInput', { setup, reset, metadata, beforeSubmit });
})();
