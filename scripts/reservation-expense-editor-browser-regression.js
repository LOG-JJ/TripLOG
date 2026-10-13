const { launchBrowser, fixtureToken, blockExternalRequests, startServer, stopServer } = require('./helpers/browser-fixture');
// Isolated fixtures only. Browser plugin not available; use the established Playwright/Edge regression workflow.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || path.join(require('node:os').tmpdir(), 'TripLOG-Reservation-Editor-20260922');
const hotel = { id: 'old-hotel', date: '__pretrip__', paymentDate: '2026-09-03', category: '숙소', description: '숙소 예약 · 호텔 몬돈스 교토 고조', amount: 401711, foreignAmount: 401711, currency: 'KRW', currencyUnit: '원', currencySymbol: '₩', exchangeRate: 1, exchangeBase: 1, mode: 'overseas', paymentMethod: 'card', payerKey: 'leader', pretripType: 'hotel', hotelName: '호텔 몬돈스 교토 고조', hotelCheckIn: '2026-09-26', hotelCheckOut: '2026-09-28', hotelRoomType: '특실 트윈', hotelGuests: 5, hotelAddress: '교토 고조', bookingCode: 'HOTEL-123', pretripMemo: '늦은 체크인 요청', note: '체크인 2026-09-26 · 체크아웃 2026-09-28 · 2박 · 객실 특실 트윈 · 5명 · 예약번호 HOTEL-123 · 늦은 체크인 요청', createdAt: 1, providerData: { preserved: true } };
const flight = { id: 'old-flight', date: '__pretrip__', paymentDate: '2026-09-04', category: '교통', description: '항공권 · 대한항공 KE721 · 인천 → 간사이', amount: 280000, foreignAmount: 280000, currency: 'KRW', exchangeRate: 1, exchangeBase: 1, mode: 'overseas', paymentMethod: 'cash', pretripType: 'flight', flightAirline: '대한항공', flightNumber: 'KE721', flightFrom: '인천', flightTo: '간사이', flightDepartDate: '2026-09-25', flightDepartTime: '08:30', flightReturnDate: '2026-09-28', flightReturnDepartTime: '19:20', bookingCode: '', pretripMemo: '수하물 23kg', note: '출발 2026-09-25 08:30 · 복귀 출발 2026-09-28 19:20 · 수하물 23kg', createdAt: 2 };
const fixture = { id: 'reservation-editor-fixture', tripName: '오사카·교토 검증 여행', country: '일본', city: '교토', countryCode: 'JP', travelMode: 'overseas', currencyCode: 'JPY', exchangeRate: 900, startDate: '2026-09-25', endDate: '2026-09-28', entries: [hotel, flight, { ...hotel, id: 'foreign-hotel', currency: 'JPY', currencyUnit: '엔', currencySymbol: '¥', exchangeBase: 100, exchangeRate: 900, foreignAmount: 18000, amount: 162000 }, { ...hotel, id: 'currency-less-hotel', currency: '', foreignAmount: 0, exchangeRate: 0 }], companions: [], packingList: [], itineraryItems: [] };

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } }); context.setDefaultTimeout(12000);
  const user = { id: '00000000-0000-4000-8000-000000000099', email: 'reservation@example.test', user_metadata: { display_name: '회귀 검증' } };
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const token = fixtureToken(user, expiry);
  await context.addInitScript(({ origin, fixture, user, expiry, token }) => {
    if (location.origin !== origin || localStorage.getItem('reservation-editor-seed')) return;
    localStorage.setItem('reservation-editor-seed', '1');
    localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', expires_at: expiry, expires_in: 3600, token_type: 'bearer', user }));
    localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([fixture])); localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', fixture.id);
  }, { origin, fixture, user, expiry, token });
  await blockExternalRequests(context, origin);
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
  const ready = () => page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in');
  const dialog = page.locator('#rdExpenseEditor');
  const open = async id => {
    await page.locator(`#rdExpenseList .ex-entry-title[data-id="${id}"]`).click();
    assert.equal(await page.locator('#rdReservation').isVisible(), false, 'No old edit dialog for existing reservations');
    assert(await dialog.locator('#exAmountGroup').isVisible(), 'Use the current amount-first expense editor');
    assert.equal(await dialog.locator('.rd-dialog-body').evaluate(el => el.scrollTop), 0, 'Every edit opens at its title and amount');
  };
  const close = () => dialog.locator('.rd-dialog-head [data-rd-action="close"]').click();
  const row = id => page.evaluate(id => { const copy = JSON.parse(JSON.stringify(findEntry(id))); delete copy._syncPosition; return copy; }, id);
  const capture = name => dialog.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
  try {
    await page.goto(`${origin}/Travel?page=budget`); await ready();
    for (const id of ['old-hotel', 'old-flight', 'foreign-hotel', 'currency-less-hotel']) {
      const before = await row(id); await open(id);
      assert.equal(await page.locator('#foreignAmountInput').inputValue(), id === 'foreign-hotel' ? '18,000' : Number(before.amount).toLocaleString('en-US'));
      await dialog.locator('#exReservationDetails summary').click();
      assert.equal(await dialog.locator('#exReservation_bookingCode').inputValue(), before.bookingCode);
      if (id !== 'old-flight') { assert.equal(await dialog.locator('#exReservation_hotelGuests').inputValue(), '5'); assert.equal(await dialog.locator('#exReservation_hotelRoomType').inputValue(), '특실 트윈'); }
      else { assert.equal(await dialog.locator('#exReservation_flightReturnDate').inputValue(), flight.flightReturnDate); assert.equal(await dialog.locator('#exReservation_flightReturnDepartTime').inputValue(), flight.flightReturnDepartTime); }
      await capture(`${id}-before-save`); await close(); assert.deepEqual(await row(id), before, 'Cancel preserves the complete record');
    }
    await open('old-hotel'); await capture('hotel-current-editor-mobile');
    await dialog.locator('#exReservationDetails summary').click();
    await dialog.locator('#exReservation_hotelName').fill('호텔 몬돈스 교토 고조 · 변경');
    await dialog.locator('#exReservation_bookingCode').fill('HOTEL-456');
    await page.locator('#foreignAmountInput').fill('405000');
    await dialog.locator('#exReservation_hotelCheckOut').fill('2026-09-26');
    await page.locator('#rdExpenseSubmit').click();
    assert.match(await page.locator('#exExpenseError').innerText(), /체크아웃/); assert.equal((await row('old-hotel')).amount, 401711);
    await dialog.locator('#exReservation_hotelCheckOut').fill('2026-09-28');
    await page.evaluate(() => { window.reservationTestSave = saveAndRender; saveAndRender = async () => false; });
    try {
      await page.locator('#rdExpenseSubmit').click();
      assert(await dialog.isVisible()); assert.equal((await row('old-hotel')).amount, 401711);
      assert.equal(await page.locator('#foreignAmountInput').inputValue(), '405,000');
    } finally { await page.evaluate(() => { saveAndRender = window.reservationTestSave; delete window.reservationTestSave; }); }
    await page.locator('#rdExpenseSubmit').click(); await dialog.waitFor({ state: 'hidden' });
    const changed = await row('old-hotel');
    assert.equal(changed.amount, 405000); assert.equal(changed.foreignAmount, 405000); assert.equal(changed.currency, 'KRW');
    assert.equal(changed.bookingCode, 'HOTEL-456'); assert.equal(changed.description, '숙소 예약 · 호텔 몬돈스 교토 고조 · 변경');
    for (const key of ['id', 'createdAt', 'date', 'hotelCheckIn', 'hotelCheckOut', 'hotelRoomType', 'hotelGuests', 'hotelAddress', 'paymentDate', 'paymentMethod', 'providerData', 'pretripMemo']) assert.deepEqual(changed[key], hotel[key], key + ' remains intact');
    assert.equal(await page.evaluate(() => state.entries.length), 4, 'Editing a hotel does not split or duplicate the purchase');
    const wallet = await page.evaluate(() => window.TripLog.features.travelCompanion.model.reservations(state).find(row => row.sourceId === 'old-hotel'));
    assert.equal(wallet.title, changed.hotelName); assert.equal(wallet.reference, 'HOTEL-456'); assert.equal(wallet.amount, 405000);
    await page.reload(); await ready(); await open('old-hotel'); assert.equal(await page.locator('#foreignAmountInput').inputValue(), '405,000'); await close();
    await open('foreign-hotel'); await page.locator('#foreignAmountInput').fill('19000');
    await page.locator('#exRateToggle').click(); await page.locator('#exchangeRateInput').fill('800');
    assert.match(await page.locator('#exReservationSummary').textContent(), /76,000원/, 'Hotel nightly summary tracks edited exchange rates');
    await page.locator('#exchangeRateInput').fill('900'); await page.locator('#rdExpenseSubmit').click(); await dialog.waitFor({ state: 'hidden' });
    const foreign = await row('foreign-hotel'); assert.equal(foreign.currency, 'JPY'); assert.equal(foreign.amount, 171000); assert.equal(foreign.exchangeBase, 100); assert.equal(foreign.exchangeRate, 900); assert.equal(foreign.hotelGuests, 5);
    await open('currency-less-hotel'); await page.locator('#rdExpenseSubmit').click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal((await row('currency-less-hotel')).amount, 401711); assert.equal((await row('currency-less-hotel')).currency, 'KRW');
    // The reservation wallet's missing-reference shortcut must land in the same editor and focus the new field.
    await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('wallet'));
    await page.locator('[data-tt-action="reservation-detail"][data-id="entry:old-flight"]').click();
    await page.locator('#ttReservationDetail [data-tt-action="reservation-source"][data-field="reference"]').click();
    assert.equal(await dialog.isVisible(), true); assert.equal(await page.locator('#rdReservation').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'exReservation_bookingCode');
    await dialog.locator('#exReservation_bookingCode').fill('FLIGHT-789');
    await page.locator('#foreignAmountInput').fill('290000'); await page.locator('#rdExpenseSubmit').click(); await dialog.waitFor({ state: 'hidden' });
    const changedFlight = await row('old-flight');
    for (const key of ['flightAirline', 'flightNumber', 'flightFrom', 'flightTo', 'flightDepartDate', 'flightDepartTime', 'flightReturnDate', 'flightReturnDepartTime', 'pretripMemo', 'paymentDate', 'paymentMethod', 'createdAt']) assert.equal(changedFlight[key], flight[key], key);
    assert.equal(changedFlight.bookingCode, 'FLIGHT-789'); assert.equal(changedFlight.amount, 290000);
    await page.evaluate(() => window.TripLog.features.redesign.workspace.openPretripEditor('hotel', { entry: findEntry('old-hotel') }));
    assert.equal(await dialog.isVisible(), true); assert.equal(await page.locator('#rdReservation').isVisible(), false); await close();
    // Stale edits are rejected, preserving the other device's reservation changes.
    await open('old-hotel'); await page.evaluate(() => { findEntry('old-hotel').hotelRoomType = '다른 기기에서 변경'; });
    await page.locator('#rdExpenseSubmit').click(); assert.match(await page.locator('#exExpenseError').innerText(), /다른 곳에서 변경/);
    assert.equal((await row('old-hotel')).hotelRoomType, '다른 기기에서 변경'); await close();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1100 : 844 }); await open('old-flight');
      await dialog.locator('#exReservationDetails summary').click(); await capture(`flight-${width}`);
      assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Editor has no horizontal overflow'); await close();
    }
    await page.locator('.ex-desktop-add[data-rd-action="expense-new"]').click();
    assert.equal(await dialog.locator('#exReservationDetails').isVisible(), false);
    await page.locator('#descriptionInput').fill('일반 지출 확인'); await page.locator('#foreignAmountInput').fill('1000');
    await page.locator('#rdExpenseSubmit').click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => state.entries.find(row => row.description === '일반 지출 확인')?.pretripType || ''), '');
    assert.deepEqual(errors, []); console.log('PASS existing reservations: one modern editor for KRW/foreign/missing-currency purchases, metadata and wallet preservation, no duplicate lodging, cancel/reload, validation/stale guard, wallet shortcut and mobile layout. '+output);
  } catch (error) {
    console.error(JSON.stringify({ errors, url: page.url(), state: await page.evaluate(() => ({ ready: document.documentElement.dataset, ids: typeof state === 'undefined' ? [] : state.entries.map(entry => entry.id), rows: document.querySelector('#rdExpenseList')?.innerText, status: document.querySelector('#exExpenseError')?.textContent })) }));
    await page.screenshot({ path: path.join(output, 'failure.png'), animations: 'disabled' }); throw error;
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
