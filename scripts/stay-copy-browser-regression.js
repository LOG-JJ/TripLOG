const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, blockExternalRequests } = require('./helpers/browser-fixture');
// Browser plugin unavailable. Isolated Playwright/Edge fixtures block all
// external requests; no production reservations or itinerary are touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createReservationPocketPreview } = require('./preview-reservation-pockets');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('stay-copy');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createReservationPocketPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true, timezoneId: 'Asia/Seoul' });
    context.setDefaultTimeout(12000);
    await blockExternalRequests(context, origin);
    const page = await context.newPage(), errors = [];
    await page.clock.setFixedTime(new Date('2026-09-25T09:00:00+09:00'));
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in' && state.collaboration?.ownerId);
    const set = values => page.evaluate(values => {
      for (const [id, value] of Object.entries(values)) {
        const input = document.getElementById(id); input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, values);
    const snapshot = () => page.evaluate(() => JSON.parse(JSON.stringify({ reservations: state.travelCompanion.reservations, items: state.itineraryItems, entries: state.entries })));
    const submit = () => page.locator('#ttReservationEditor [type="submit"]').click();
    const copyButton = id => page.locator(`[data-itinerary-action="copy"][data-id="${id}"]`);
    await page.goto(`${origin}/Travel?page=overview&trip=reservation-empty-fixture`); await ready();
    await page.evaluate(async () => { state.itineraryItems = []; await saveAndRender(); });
    await page.locator('[data-rd-action="companion-stay-new"]').click();
    await set({ ttReservationName: '교토 연박 호텔', ttReservationDate: '2026-09-25', ttReservationEnd: '2026-09-28', ttReservationLocation: '교토 고조', ttReservationReference: 'HOTEL-3' });
    await page.evaluate(() => { window.__realSave = saveAndRender; saveAndRender = async () => false; });
    await submit(); await page.locator('#ttReservationError').filter({ hasText: '저장하지 못했어요' }).waitFor();
    assert.equal((await snapshot()).items.length, 0); assert.equal((await snapshot()).reservations.length, 0);
    assert.equal(await page.locator('#ttReservationName').inputValue(), '교토 연박 호텔');
    await page.evaluate(() => { saveAndRender = window.__realSave; });
    await submit(); await page.locator('#ttReservationEditor').waitFor({ state: 'hidden' });
    const initial = await snapshot(), hotelId = initial.reservations[0].id;
    assert.deepEqual(initial.items.map(item => item.date), ['2026-09-25', '2026-09-26', '2026-09-27']);
    assert(initial.items.every(item => item.theme === 'lodging' && item.linkedReservationId === `manual:${hotelId}`));
    assert.equal(initial.entries.length, 0, 'Auto lodging never duplicates payments');
    await page.reload(); await ready();
    assert.deepEqual((await snapshot()).items, initial.items, 'All nights persist together');

    const editReservation = async values => {
      await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('wallet', 'stay'));
      await page.locator(`[data-tt-action="reservation-detail"][data-id="manual:${hotelId}"]`).click();
      await page.locator('#ttReservationDetail [data-tt-action="reservation-edit"]').click();
      await set(values); await submit(); await page.locator('#ttReservationEditor').waitFor({ state: 'hidden' });
      await page.locator('#ttReservationDetail [data-tt-action="close"]').click();
      await page.locator('#ttCompanion [data-tt-action="close"]').click();
    };
    await editReservation({ ttReservationReference: 'HOTEL-UPDATED' });
    assert.deepEqual((await snapshot()).items.map(item => item.id), initial.items.map(item => item.id), 'Re-saving does not duplicate a night');
    await page.evaluate(id => { findItineraryItem(id).time = '21:40'; findItineraryItem(id).memo = '첫날 짐 맡기기'; return saveAndRender(); }, initial.items[0].id);
    await editReservation({ ttReservationEnd: '2026-09-27', ttReservationName: '교토 변경 호텔' });
    const shortened = await snapshot();
    assert.equal(shortened.items.length, 2);
    assert.equal(shortened.items[0].time, '21:40'); assert.equal(shortened.items[0].memo, '첫날 짐 맡기기');
    assert(shortened.items.every(item => item.place === '교토 변경 호텔' && item.voucherCode === 'HOTEL-UPDATED'));
    await page.reload(); await ready(); assert.equal((await snapshot()).items.length, 2, 'Removed nights stay removed on reload');

    await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('itinerary'));
    for (const width of [320, 390, 850, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      await page.evaluate(date => { state.selectedItineraryDate = date; render(); }, initial.items[0].date);
      assert(await copyButton(initial.items[0].id).isVisible());
      const boxes = await page.locator('.timeline-stop-heading').first().evaluate(el => {
        const box = selector => { const r = el.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right }; };
        return { title: box('.timeline-place'), actions: box('.timeline-stop-actions'), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert(boxes.title.right <= boxes.actions.left + 1 && !boxes.overflow, `Copy action fits ${width}px`);
      await page.locator('#itineraryList').screenshot({ path: path.join(output, `daily-stays-${width}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const original = (await snapshot()).items[0];
    await page.evaluate(() => { window.__realSave = saveAndRender; saveAndRender = async () => false; });
    await copyButton(original.id).click();
    await page.waitForFunction(() => itineraryCopiesPending.size === 0);
    assert.equal((await snapshot()).items.length, 2, 'Failed copy keeps original collection');
    assert.equal(await page.locator('#itineraryEditor').isVisible(), false, 'Copy never opens the place editor');
    await page.evaluate(() => { saveAndRender = window.__realSave; });
    await copyButton(original.id).focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => itineraryCopiesPending.size === 0 && state.itineraryItems.length === 3);
    const copied = await snapshot(), copy = copied.items.find(item => !shortened.items.some(source => source.id === item.id));
    assert(copy && copy.id !== original.id);
    assert.equal(await page.locator('#itineraryEditor').isVisible(), false);
    assert.deepEqual(copied.items.find(item => item.id === original.id), original, 'Copy never edits its source');
    assert.equal(copy.memo, original.memo); assert.equal(copy.time, '21:40'); assert.equal(copy.date, original.date);
    assert(!copy.linkedReservationId && !copy.reservationStayDate && !copy.expenseId, 'Copy has independent reservation/payment ownership');
    assert.equal(copy.voucherCode, 'HOTEL-UPDATED');
    await page.reload(); await ready(); assert.equal((await snapshot()).items.length, 3);
    await editReservation({ ttReservationEnd: '2026-09-26' });
    assert((await snapshot()).items.some(item => item.id === copy.id), 'Reservation changes leave the independent copy intact');

    // Paid hotel creation uses the same nightly expansion and keeps one expense.
    await page.evaluate(() => window.TripLog.features.redesign.workspace.openPretripEditor('hotel'));
    await set({ pretripHotelNameInput: '결제한 숙소', pretripHotelCheckInInput: '2026-09-26', pretripHotelCheckOutInput: '2026-09-28', pretripHotelAmountInput: '240000', pretripHotelPaymentDateInput: '2026-09-01' });
    await page.locator('#pretripHotelForm').evaluate(form => form.requestSubmit());
    await page.locator('#rdReservation').waitFor({ state: 'hidden' });
    const paid = await snapshot(), purchase = paid.entries.find(entry => entry.hotelName === '결제한 숙소');
    assert(purchase); assert.equal(paid.entries.length, 1); assert.equal(purchase.amount, 240000);
    assert.deepEqual(paid.items.filter(item => item.linkedReservationId === `entry:${purchase.id}`).map(item => item.date), ['2026-09-26', '2026-09-27']);
    await page.evaluate(id => { window.TripLog.features.redesign.workspace.navigate('budget'); startEdit(findEntry(id)); }, purchase.id);
    await set({ exReservation_hotelCheckOut: '2026-09-27', exReservation_hotelName: '결제한 숙소 수정' });
    await page.locator('#rdExpenseSubmit').click(); await page.locator('#rdExpenseEditor').waitFor({ state: 'hidden' });
    const editedPurchase = await snapshot();
    assert.equal(editedPurchase.entries.length, 1);
    const paidNights = editedPurchase.items.filter(item => item.linkedReservationId === `entry:${purchase.id}`);
    assert.equal(paidNights.length, 1); assert.equal(paidNights[0].place, '결제한 숙소 수정');

    // A real incoming transport payment must never become shared ownership
    // between the original stop and a copied stop.
    await page.evaluate(async id => {
      const item = findItineraryItem(id);
      Object.assign(item, { trans: 'bus', transits: [{ trans: 'bus', duration: 20, cost: 2000, memo: '원본 이동' }], duration: 20, cost: 2000, expenseId: 'source-bus-payment', syncExpense: true });
      state.entries.push({ id: 'source-bus-payment', date: item.date, amount: 2000, category: '교통', description: '숙소 이동', mode: 'domestic' });
      await saveAndRender(); window.TripLog.features.redesign.workspace.navigate('itinerary'); state.selectedItineraryDate = item.date; render();
    }, original.id);
    const sourceWithTransit = (await snapshot()).items.find(item => item.id === original.id);
    const beforeTransitCopyIds = (await snapshot()).items.map(item => item.id);
    await copyButton(original.id).click();
    await page.waitForFunction(() => itineraryCopiesPending.size === 0);
    const withTransitCopy = await snapshot(), copiedTransit = withTransitCopy.items.find(item => !beforeTransitCopyIds.includes(item.id));
    assert(copiedTransit && !copiedTransit.expenseId && copiedTransit.cost === 0);
    assert.deepEqual(withTransitCopy.items.find(item => item.id === original.id), sourceWithTransit);
    assert.equal(withTransitCopy.entries.length, 2);
    await page.evaluate(id => deleteItineraryItem(id), copiedTransit.id);
    assert((await snapshot()).entries.some(entry => entry.id === 'source-bus-payment'), 'Deleting the copy preserves the original payment');
    await page.reload(); await ready();
    assert.equal((await snapshot()).entries.length, 2);
    assert.equal((await snapshot()).items.filter(item => item.linkedReservationId === `entry:${purchase.id}`).length, 1);

    // Long names with all three actions (copy/edit/reorder) remain usable.
    await page.evaluate(async () => {
      const original = state.itineraryItems[0];
      original.place = '교토역 근처 긴 이름의 호텔 몬돈스 교토 고조';
      state.itineraryItems.push({ id: 'layout-second-stop', date: original.date, time: '18:00', place: '저녁 식사', theme: 'food' });
      state.selectedItineraryDate = original.date; await saveAndRender();
    });
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      assert(await page.locator('.timeline-drag-handle').first().isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('#itineraryList').screenshot({ path: path.join(output, `copy-and-reorder-${width}.png`), animations: 'disabled' });
    }
    // Double clicks while storage is pending still create one adjacent copy in
    // a manually ordered day, preserving the existing source and payments.
    const beforeRapid = await snapshot();
    await page.evaluate(id => {
      const source = findItineraryItem(id);
      state.itineraryItems.filter(item => item.date === source.date).forEach((item, index) => { item.itineraryOrder = { date: item.date, rank: (index + 1) * 1024 }; });
      return saveAndRender();
    }, original.id);
    await page.evaluate(() => {
      window.__realSave = saveAndRender;
      saveAndRender = () => { const saved = window.__realSave(); return new Promise(resolve => { window.__copyRelease = () => Promise.resolve(saved).then(resolve); }); };
    });
    await copyButton(original.id).dblclick();
    assert.equal((await snapshot()).items.length, beforeRapid.items.length + 1, 'A pending double click creates one copy');
    await page.evaluate(() => { window.__copyRelease(); saveAndRender = window.__realSave; });
    await page.waitForFunction(() => itineraryCopiesPending.size === 0);
    const rapidCopy = (await snapshot()).items.find(item => !beforeRapid.items.some(before => before.id === item.id));
    const ordered = await page.evaluate(() => getFilteredItineraryItems().map(item => item.id));
    assert.equal(ordered[ordered.indexOf(original.id) + 1], rapidCopy.id, 'A manually sorted copy is inserted immediately after its source');
    assert.equal((await snapshot()).entries.length, beforeRapid.entries.length);

    // Bookings created before nightly expansion are repaired on itinerary entry.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => {
      window.TripLog.features.redesign.workspace.navigate('overview');
      for (const [kind, rows] of [['itinerary', state.itineraryItems], ['expense', state.entries], ['reservation', state.travelCompanion.reservations]]) {
        rows.forEach(row => window.TripLog.persistence.stateStorage.markDeletedEntity(kind, row.id));
      }
      state.travelCompanion.reservations = [{ id: 'legacy-hotel', type: 'stay', title: '기존 예약 숙소', date: '2026-09-25', endDate: '2026-09-27', location: '교토', reference: 'OLD-HOTEL' }];
      state.entries = [{ id: 'legacy-paid-hotel', pretripType: 'hotel', hotelName: '다음 예약 숙소', hotelCheckIn: '2026-09-27', hotelCheckOut: '2026-09-28', amount: 120000, category: '숙소', date: '__pretrip__' }];
      state.itineraryItems = [{ id: 'custom-first-night', theme: 'lodging', date: '2026-09-25', time: '21:40', place: '내가 수정한 숙소명', memo: '보존할 메모', linkedReservationId: 'manual:legacy-hotel' }];
      if (!await saveAndRender()) throw new Error('Could not persist isolated legacy-booking fixture');
      window.__realSave = saveAndRender; saveAndRender = async () => false;
      window.TripLog.features.redesign.workspace.navigate('itinerary');
    });
    await page.waitForFunction(() => stayBackfillsPending.size === 0);
    assert.equal((await snapshot()).items.length, 1, 'Failed automatic backfill rolls back additions');
    await page.evaluate(() => { saveAndRender = window.__realSave; });
    await page.reload(); await ready();
    await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('itinerary'));
    await page.waitForFunction(() => stayBackfillsPending.size === 0 && state.itineraryItems.length === 3);
    const legacyDefaults = await snapshot();
    assert.deepEqual(legacyDefaults.items.map(item => item.date).sort(), ['2026-09-25','2026-09-26','2026-09-27']);
    assert.equal(legacyDefaults.items.find(item => item.id === 'custom-first-night').memo, '보존할 메모');
    assert.equal(legacyDefaults.items.find(item => item.id === 'custom-first-night').place, '내가 수정한 숙소명');
    assert.equal(legacyDefaults.entries.length, 1, 'Automatic defaults never create more hotel payments');
    await page.reload(); await ready();
    await page.waitForFunction(() => stayBackfillsPending.size === 0);
    assert.deepEqual((await snapshot()).items, legacyDefaults.items, 'Backfilled IDs and dates survive reload without duplicates');
    await page.locator('#itineraryList').screenshot({ path: path.join(output, 'legacy-booking-defaults-390.png'), animations: 'disabled' });
    // Receiving a read-only trip does not run an automatic write.
    await page.evaluate(async () => {
      await TripLogSyncRepository.update(state.id, record => {
        record.role = 'viewer'; record.snapshot.itineraryItems = []; return record;
      });
      window.TripLog.persistence.stateStorage.applyRepositoryChange(state.id);
      render();
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal((await snapshot()).items.length, 0, 'Read-only trips are not backfilled');
    assert.deepEqual(errors, []);
    console.log('PASS: daily hotel nights, no checkout stop, manual and paid reservation saves, stable IDs, edits/removals/reload, save rollback, immediate independent copy without an editor, keyboard access, 320/390/850/1440px.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
