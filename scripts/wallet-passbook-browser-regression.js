const { launchBrowser, fixtureToken, blockExternalRequests, startServer, stopServer } = require('./helpers/browser-fixture');
// Browser plugin not available; use the established isolated Playwright/Edge workflow.
// All non-app requests are blocked; fixtures and clipboard are isolated from real accounts/data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = require('./fixtures/wallet-passbook');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || path.join(require('node:os').tmpdir(), 'TripLOG-Wallet-Passbook-20260923');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); context.setDefaultTimeout(12000);
    const user = { id: '00000000-0000-4000-8000-000000000099', email: 'wallet@example.test' }, expiry = Math.floor(Date.now() / 1000) + 3600;
    const token = fixtureToken(user, expiry);
    await context.addInitScript(({ origin, fixture, user, expiry, token }) => {
      if (location.origin !== origin) return;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.walletCopiedText = text; } } });
      if (localStorage.getItem('wallet-passbook-seeded')) return;
      localStorage.setItem('wallet-passbook-seeded', '1'); localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', expires_at: expiry, expires_in: 3600, token_type: 'bearer', user }));
      localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([fixture])); localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', fixture.id);
    }, { origin, fixture, user, expiry, token });
    await blockExternalRequests(context, origin);
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && document.documentElement.dataset.appReady === 'true');
    const wallet = page.locator('#ttCompanion');
    const open = async () => { await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('wallet')); await wallet.waitFor({ state: 'visible' }); };
    const filter = key => wallet.locator(`#ttWalletFilters [data-filter="${key}"]`).click();
    const sort = async key => { await wallet.locator('#ttWalletSortButton').click(); await page.locator(`#ttWalletSortMenu [data-value="${key}"]`).click(); };
    const close = id => page.locator(`#${id} .tt-header [data-tt-action="close"]`).click();
    const fit = async () => {
      assert(await wallet.evaluate(el => el.querySelector('.tt-scroll').scrollWidth <= el.querySelector('.tt-scroll').clientWidth + 1), 'No horizontal content overflow');
      const nav = await wallet.locator('#ttNav').boundingBox(); assert(nav.y + nav.height <= page.viewportSize().height + 1, 'Navigation fits viewport');
      assert(await wallet.locator('#ttPrimary [data-tt-action="reservation-new"]').isVisible());
      for (const img of await wallet.locator('img').all()) assert(await img.evaluate(el => el.complete && el.naturalWidth > 0), 'Real image assets loaded');
    };
    await page.goto(`${origin}/Travel?page=budget`); await ready(); await open();
    assert.equal(await wallet.locator('.pw-wallet-ticket').count(), 1); assert.equal(await wallet.locator('.pw-wallet-row').count(), 4);
    assert.equal(await wallet.locator('[data-reservation-id]').count(), 5);
    assert.equal(await wallet.locator('.pw-wallet-ticket').getAttribute('data-reservation-id'), 'entry:flight-1');
    assert.equal(await wallet.locator('.pw-ticket-band .ph-airplane-tilt').count(), 1);
    assert.match(await wallet.locator('.pw-ticket-route').innerText(), /서울[\s\S]+오사카/);
    assert.match(await wallet.locator('.pw-ticket-dates').innerText(), /09:05[\s\S]+13:35/);
    for (const width of [390, 320, 768, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1024 : 844 }); await fit();
      await wallet.screenshot({ path: path.join(output, `wallet-${width}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await wallet.locator('.pw-ticket-main').click();
    assert.match(await page.locator('#ttReservationDetailBody').innerText(), /수하물 15kg/); await close('ttReservationDetail');
    await filter('stay'); assert.equal(await wallet.locator('[data-reservation-id]').count(), 2);
    assert.match(await wallet.locator('.pw-ticket-dates').innerText(), /체크인[\s\S]+체크아웃/);
    assert.equal(await wallet.locator('.pw-ticket-band .ph-bed').count(), 1);
    await wallet.screenshot({ path: path.join(output, 'wallet-stays.png'), animations: 'disabled' });
    await filter('all'); await wallet.locator('#ttWalletSearch').fill('10:40'); assert.equal(await wallet.locator('[data-reservation-id]').count(), 1);
    assert.equal(await wallet.locator('.pw-wallet-ticket').getAttribute('data-reservation-id'), 'entry:flight-3');
    await wallet.locator('#ttWalletSearch').fill('예약없음'); assert.match(await wallet.locator('#ttWalletList').innerText(), /검색 결과가 없어요/);
    await wallet.locator('[data-tt-action="wallet-reset"]').click(); assert.equal(await wallet.locator('[data-reservation-id]').count(), 5);
    await sort('recent'); assert.equal(await wallet.locator('.pw-wallet-ticket').getAttribute('data-reservation-id'), 'entry:hotel-5');
    await sort('name'); await sort('date');
    await wallet.locator('.pw-wallet-ticket [data-field="reference"]').click();
    await page.locator('#rdExpenseEditor').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'exReservation_bookingCode');
    await page.locator('#exReservation_bookingCode').fill('FLIGHT-TEST-001'); await page.locator('#rdExpenseSubmit').click();
    await page.locator('#rdExpenseEditor').waitFor({ state: 'hidden' }); await open();
    assert.equal(await page.evaluate(() => findEntry('flight-1').bookingCode), 'FLIGHT-TEST-001');
    await wallet.locator('.pw-wallet-ticket [data-tt-action="copy"]').click(); assert.equal(await page.evaluate(() => window.walletCopiedText), 'FLIGHT-TEST-001');
    assert.equal(await page.evaluate(() => state.entries.length), 5);
    await wallet.locator('#ttPrimary [data-tt-action="reservation-new"]').click();
    await page.locator('#ttReservationTypes [data-type="other"]').click(); await page.locator('#ttReservationName').fill('저녁 식당 예약'); await page.locator('#ttReservationReference').fill('DINNER-001');
    await page.locator('#ttReservationDate').evaluate(el => { el.value = '2026-09-26'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.locator('#ttReservationEditor [type="submit"]').click(); await page.locator('#ttReservationEditor').waitFor({ state: 'hidden' });
    assert.match(await wallet.locator('.pw-ticket-title').innerText(), /저녁 식당 예약/);
    await page.reload(); await ready(); await open(); await filter('other'); assert.match(await wallet.locator('.pw-ticket-title').innerText(), /저녁 식당 예약/);
    await wallet.locator('.pw-ticket-main').click(); await page.locator('#ttReservationDetail [data-tt-action="reservation-edit"]').click();
    await page.locator('#ttReservationName').fill('저녁 식당 예약 변경'); await page.locator('#ttReservationEditor [type="submit"]').click();
    await page.locator('#ttReservationEditor').waitFor({ state: 'hidden' }); assert.match(await page.locator('#ttReservationDetailBody').innerText(), /저녁 식당 예약 변경/); await close('ttReservationDetail');
    await wallet.locator('#ttNav [data-tab="today"]').click(); assert.equal(await wallet.getAttribute('data-tab'), 'today');
    await wallet.locator('#ttNav [data-tab="review"]').click(); await wallet.locator('#ttNav [data-tab="tools"]').click(); await wallet.locator('#ttNav [data-tab="wallet"]').click(); assert.equal(await wallet.getAttribute('data-tab'), 'wallet');
    // Unknown dates, long routes, and references must remain readable through the detail view.
    await page.evaluate(() => { state.entries[0].flightFrom = '아주 긴 출발 공항 이름 '.repeat(5); state.entries[0].flightTo = '아주 긴 도착 공항 이름 '.repeat(5); state.entries[0].bookingCode = 'LONG-'.repeat(50); render(); });
    await open(); await page.setViewportSize({ width: 320, height: 740 }); await fit();
    await wallet.screenshot({ path: path.join(output, 'wallet-long-320.png'), animations: 'disabled' });
    await page.evaluate(() => { state.entries = []; state.itineraryItems = []; state.travelCompanion.reservations = [{ id: 'unknown', type: 'transport', title: '날짜 미정 기차', date: '', reference: '' }]; render(); });
    await open(); assert.match(await wallet.locator('.pw-ticket-heading').innerText(), /날짜 미정/); assert.equal(await wallet.locator('.pw-ticket-band .ph-train').count(), 1); await fit();
    await page.evaluate(() => { state.travelCompanion.reservations = []; render(); }); assert.match(await wallet.locator('#ttWalletList').innerText(), /첫 예약/);
    assert.deepEqual(errors, []); console.log('PASS Ticket Passbook: 320/390/768/1440 layout, flight/stay/generic tickets, counts, search/filter/sort, details, original booking edit/save, copy, manual create/edit/reload, tabs, long/unknown/empty states. ' + output);
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
