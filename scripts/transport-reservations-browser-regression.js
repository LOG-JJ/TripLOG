const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, blockExternalRequests } = require('./helpers/browser-fixture');
// Browser plugin not available. Use the repository's isolated Playwright/Edge
// preview with synthetic records and blocked external services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createReservationPocketPreview } = require('./preview-reservation-pockets');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('transport-reservations');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createReservationPocketPreview();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
    context.setDefaultTimeout(12000);
    await blockExternalRequests(context, origin);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in' && state.collaboration?.ownerId);
    const set = values => page.evaluate(values => {
      for (const [id, value] of Object.entries(values)) {
        const control = document.getElementById(id); control.value = value;
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, values);
    const current = () => page.evaluate(() => ({ reservation: state.travelCompanion.reservations[0], item: state.itineraryItems.find(item => item.linkedReservationId?.startsWith('manual:')) }));
    const editor = page.locator('#ttReservationEditor');
    const submit = () => editor.getByRole('button', { name: '예약 저장', exact: true }).click();
    const openWallet = async () => {
      await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('overview'));
      await page.locator('[data-rd-action="companion-transport"]').click();
    };
    const openDetail = async () => { await openWallet(); await page.locator('#ttCompanion [data-tt-action="reservation-detail"]').first().click(); };
    const closeWallet = async () => {
      if (await page.locator('#ttReservationDetail').isVisible()) await page.locator('#ttReservationDetail [data-tt-action="close"]').click();
      if (await page.locator('#ttCompanion').isVisible()) await page.locator('#ttCompanion [data-tt-action="close"]').first().click();
    };
    await page.goto(`${origin}/Travel?page=overview&trip=reservation-empty-fixture`); await ready();
    assert.equal(await page.title(), '여행 가계부');
    await page.locator('[data-rd-action="companion-transport-new"]').click();
    await page.locator('#ttReservationName').fill('KTX 503');
    await page.locator('#ttReservationKindButton').click();
    await page.locator('#ttReservationKindMenu [data-value="train"]').click();
    await page.locator('#ttReservationFrom').fill('용산'); await page.locator('#ttReservationTo').fill('순천');
    await set({ ttReservationDate: '2026-09-25', ttReservationTime: '08:00', ttReservationArrivalTime: '11:10' });
    await page.locator('#ttReservationReference').fill('RAIL-503');
    await page.locator('#ttReservationLocation').fill('용산역');
    await page.locator('#ttReservationExtras').evaluate(el => { el.open = true; });
    await page.locator('#ttReservationNote').fill('5호차 8A');
    await editor.locator('.tt-scroll').evaluate(el => { el.scrollTop = 0; });
    await editor.screenshot({ path: path.join(output, 'reservation-form-390.png') });
    // Failed writes retain both the unsaved input and the original state.
    await page.evaluate(() => { window.__realSave = saveAndRender; saveAndRender = async () => false; });
    await submit(); await page.locator('#ttReservationError').filter({ hasText: '저장하지 못했어요' }).waitFor();
    assert.equal((await current()).reservation, undefined);
    assert.equal(await page.locator('#ttReservationFrom').inputValue(), '용산');
    await page.evaluate(() => { saveAndRender = window.__realSave; });
    await submit(); await editor.waitFor({ state: 'hidden' });
    const saved = (await current()).reservation;
    assert.deepEqual([saved.transportKind, saved.from, saved.to, saved.time, saved.endTime], ['train', '용산', '순천', '08:00', '11:10']);
    await page.reload(); await ready(); assert.deepEqual((await current()).reservation, saved);
    for (const width of [320, 390, 599, 600, 850, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.locator('.rs-transport-body').evaluate(el => {
        const box = node => { const b = node.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
        return { icon: box(el.querySelector('.rs-transport-symbol')), route: box(el.querySelector('.rs-summary-route')), name: box(el.querySelector('.rs-summary-booking-name')), date: box(el.querySelector('.rs-summary-period')), width: el.clientWidth, scroll: el.scrollWidth };
      });
      assert(geometry.icon.right <= geometry.route.left && geometry.route.top < geometry.icon.bottom, 'Emoji stays to the left of the route');
      assert(Math.abs(geometry.name.top - geometry.date.top) < 2 && geometry.name.right <= geometry.date.left, 'Reservation name and date share one line');
      assert(geometry.scroll <= geometry.width + 1 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Fits ${width}px`);
      await page.locator('.rs-reservations').screenshot({ path: path.join(output, `transport-summary-${width}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await openDetail();
    assert.match(await page.locator('#ttReservationDetailBody').innerText(), /기차 · 용산 → 순천/);
    assert.match(await page.locator('#ttReservationDetailBody').innerText(), /08:00 → 11:10/);
    await page.locator('#ttReservationDetail [data-tt-action="reservation-link"]').click();
    await page.locator('#itineraryEditor').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#itineraryTransportFields').count(), 0);
    assert.equal(await page.locator('.time-field-item > span').allTextContents().then(rows => rows.join('/')), '시작/종료');
    assert.equal(await page.locator('#itineraryEndTimeInput').inputValue(), '11:10');
    const initialItem = (await current()).item;
    await set({ itineraryTimeInput: '09:00', itineraryEndTimeInput: '12:20' });
    await page.locator('#itineraryEditor').screenshot({ path: path.join(output, 'itinerary-transport-390.png') });
    await page.locator('#itinerarySubmitButton').click(); await page.locator('#itineraryEditor').waitFor({ state: 'hidden' });
    let linked = await current();
    assert.deepEqual([linked.reservation.title, linked.reservation.to, linked.reservation.time, linked.reservation.endTime], ['KTX 503', '순천', '09:00', '12:20']);
    assert.deepEqual(linked.item.transportReservation, initialItem.transportReservation, 'Schedule edits preserve booking kind, route and arrival date');
    assert.equal(linked.item.voucherCode, 'RAIL-503');
    assert.equal(linked.item.id, initialItem.id);
    assert.equal(await page.evaluate(() => window.TripLog.features.travelCompanion.model.reservations(state).length), 1);
    await openDetail(); await page.locator('#ttReservationDetail [data-tt-action="reservation-edit"]').click();
    assert.equal(await page.locator('#ttReservationTo').inputValue(), '순천');
    await page.locator('#ttReservationName').fill('KTX 505');
    await page.locator('#ttReservationTo').fill('여수엑스포');
    await submit(); await editor.waitFor({ state: 'hidden' });
    linked = await current();
    assert.deepEqual([linked.reservation.title, linked.reservation.to, linked.item.transportReservation.to], ['KTX 505', '여수엑스포', '여수엑스포']);
    assert.equal(linked.item.id, initialItem.id);
    await openDetail(); await page.locator('#ttReservationDetail [data-tt-action="reservation-edit"]').click();
    await page.locator('#ttReservationName').fill('심야 고속버스');
    await set({ ttReservationKind: 'bus', ttReservationFrom: '서울 센트럴시티', ttReservationTo: '여수종합터미널', ttReservationTime: '23:00', ttReservationArrivalTime: '02:10' });
    await submit(); assert.match(await page.locator('#ttReservationError').textContent(), /다음 날/);
    assert.equal((await current()).reservation.title, 'KTX 505');
    await set({ ttReservationArrivalDate: '2026-09-26' });
    await submit(); await editor.waitFor({ state: 'hidden' });
    linked = await current();
    assert.deepEqual([linked.item.time, linked.item.endTime, linked.item.transportReservation.kind, linked.item.transportReservation.arrivalDate], ['23:00', '02:10', 'bus', '2026-09-26']);
    assert.equal(linked.item.voucherCode, 'RAIL-503');
    assert.equal(linked.item.memo, '5호차 8A');
    assert.equal(await page.evaluate(() => state.itineraryItems.length), 1);
    assert.match(await page.evaluate(() => window.TripLog.features.travelCompanion.model.createCalendar(state, 'Asia/Seoul')), /DTEND:20260925T171000Z/);
    await closeWallet(); await page.reload(); await ready();
    assert.equal((await current()).item.transportReservation.arrivalDate, '2026-09-26');
    // An unrelated linked edit while a reservation form is open cannot be overwritten.
    await openDetail(); await page.locator('#ttReservationDetail [data-tt-action="reservation-edit"]').click();
    await page.evaluate(async () => { state.itineraryItems[0].transportReservation.to = '부산종합터미널'; await saveAndRender(); });
    await page.locator('#ttReservationName').fill('오래된 입력'); await submit();
    assert.match(await page.locator('#ttReservationError').textContent(), /다른 곳에서 수정/);
    assert.equal((await current()).reservation.to, '부산종합터미널');
    await editor.getByRole('button', { name: '취소', exact: true }).click(); await closeWallet();
    console.log('PASS transport: mode/route/time save/reload, failed-save retention, compact responsive summary, bidirectional itinerary edits, no duplicate or lost voucher/memo, overnight validation/export, stale-edit guard');

    // Collection delete: independent action, named confirmation, filter retention,
    // content purge, failure and final-trip empty state.
    await page.locator('.rd-brand-link').click(); await page.waitForFunction(() => activePage === 'start');
    const remove = id => page.locator(`[data-library-remove="${id}"]`);
    const accept = () => page.locator('#rdConfirm [data-rd-action="confirm-accept"]').click();
    const waitIdle = () => page.waitForFunction(() => document.querySelector('#rdTripList').getAttribute('aria-busy') === 'false');

    await page.locator('#tripLibrarySearch').fill('추석');
    await remove('reservation-pockets-fixture').press('Enter');
    assert.match(await page.locator('#rdConfirmMessage').innerText(), /오사카&교토 추석 가족여행/);
    assert.equal(await page.evaluate(() => state.id), 'reservation-empty-fixture');
    await page.locator('#rdConfirmCancel').click(); await waitIdle();
    assert.equal(await page.locator('#tripLibrarySearch').inputValue(), '추석');
    assert.equal(await page.evaluate(() => window.TripLog.persistence.stateStorage.getTrips().length), 2);
    await remove('reservation-pockets-fixture').click(); await accept(); await waitIdle();
    assert.equal(await remove('reservation-pockets-fixture').count(), 0);
    assert.equal(await page.locator('#tripLibrarySearch').inputValue(), '추석');
    assert.deepEqual(await page.evaluate(() => TripLogSyncRepository.cached('reservation-pockets-fixture').snapshot.entries), []);
    assert.deepEqual(await page.evaluate(() => TripLogSyncRepository.cached('reservation-pockets-fixture').snapshot.itineraryItems), []);
    await page.reload(); await ready();
    assert.equal(await page.locator('[data-library-trip]').count(), 1);
    assert.equal(await remove('reservation-empty-fixture').isEnabled(), true);
    // Role boundary is stubbed only for isolated failure verification.
    await page.evaluate(async () => {
      await TripLogSyncRepository.update('reservation-empty-fixture', record => ({ ...record, role: 'owner', serverId: 'synthetic-only' }));
      window.__removalFailed = true;
      TripLog.sync.controller.engine.removeTrip = async id => {
        if (window.__removalFailed) throw new Error('Offline fixture');
        await TripLogSyncRepository.removeTrip(id); return {removed:true,serverDeleted:true};
      };
    });
    await remove('reservation-empty-fixture').click(); await accept(); await waitIdle();
    assert.equal(await remove('reservation-empty-fixture').count(), 1);
    await page.evaluate(() => { window.__removalFailed = false; });
    await remove('reservation-empty-fixture').click(); await accept(); await waitIdle();
    assert.equal(await page.evaluate(() => activePage), 'start');
    assert.equal(await page.locator('[data-library-trip]').count(), 0);
    assert(await page.locator('#tripLibraryEmpty').isVisible());
    assert.equal(await page.locator('button button').count(), 0);
    await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('.tl-passport-art')].map(image => image.decode())); });
    await page.screenshot({ path: path.join(output, 'library-remove-390.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`PASS library removal: keyboard/named cancel, search retention, deleted content/reload, failed deletion, final-trip empty state; no runtime errors. Screenshots: ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
