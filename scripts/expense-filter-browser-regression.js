const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, startServer, stopServer } = require('./helpers/browser-fixture');
// Browser plugin unavailable: isolated Playwright/Edge fixtures; external requests blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('expense-filter');
const common = { mode: 'domestic', currency: 'KRW', paymentMethod: 'card', paymentDate: '2026-09-25', date: '2026-09-25' };
const fixture = { id: 'expense-filter-fixture', tripName: '서울 검증 여행', country: '대한민국', countryCode: 'KR', city: '서울', travelMode: 'domestic', startDate: '2026-09-25', endDate: '2026-09-28', totalBudget: 1000000, entries: [
  { ...common, id: 'train', category: '교통', description: '검증 기차표', amount: 25000, createdAt: 1 },
  { ...common, id: 'lunch', category: '식비', description: '검증 점심', amount: 15000, createdAt: 2 },
  { ...common, id: 'flight', category: '교통', description: '검증 항공권', amount: 150000, createdAt: 3, date: '__pretrip__', paymentDate: '2026-09-20', pretripType: 'flight', flightAirline: '검증 항공', flightFrom: '서울', flightTo: '제주', flightDepartDate: '2026-09-25', pretripMemo: '기존 기록 보존' }
], companions: [], packingList: [], itineraryItems: [] };

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } }); context.setDefaultTimeout(12000);
    const user = { id: '00000000-0000-4000-8000-000000000099', email: 'filter@example.test' }, expiry = Math.floor(Date.now() / 1000) + 3600;
    const token = fixtureToken(user, expiry);
    await context.addInitScript(({ origin, fixture, user, expiry, token }) => {
      if (location.origin !== origin || localStorage.getItem('filter-fixture-seeded')) return;
      localStorage.setItem('filter-fixture-seeded', '1');
      localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', expires_at: expiry, expires_in: 3600, token_type: 'bearer', user }));
      localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([fixture])); localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', fixture.id);
    }, { origin, fixture, user, expiry, token });
    await blockExternalRequests(context, origin);
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/Travel?page=budget`);
    await page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in');
    const controls = () => page.evaluate(() => ({ category: document.querySelector('#exCategoryFilter').value, sort: document.querySelector('#expenseSortSelect').value, query: document.querySelector('#expenseSearchInput').value, tab: document.querySelector('#rdExpenseTabs [aria-pressed="true"]').dataset.tab }));
    const pick = async (id, value) => { await page.locator(`#${id}Button`).click(); await page.locator(`#${id}Menu [data-value="${value}"]`).click(); };
    const closeEditor = () => page.locator('#rdExpenseEditor .rd-dialog-head [data-rd-action="close"]').click();
    const initial = await controls();
    for (const target of ['tr[data-id="train"] .ex-row-category', '.ex-entry-title[data-id="train"]', '.ex-entry-title[data-id="flight"]']) {
      await page.locator('#rdExpenseList ' + target).click();
      assert(await page.locator('#rdExpenseEditor').isVisible()); assert.equal(await page.locator('#rdReservation').isVisible(), false);
      assert.deepEqual(await controls(), initial, 'Opening a row, badge, or old flight must not filter the ledger');
      await closeEditor(); assert.deepEqual(await controls(), initial);
    }
    await pick('exCategoryFilter', '교통'); await pick('expenseSortSelect', 'amountDesc');
    await page.locator('#expenseSearchInput').fill('검증'); await page.locator('#rdExpenseTabs [data-tab="pretrip"]').click();
    const chosen = await controls();
    await page.locator('.ex-entry-title[data-id="flight"]').click();
    await page.locator('#amountInput').fill('151000'); await page.locator('#rdExpenseSubmit').click();
    await page.locator('#rdExpenseEditor').waitFor({ state: 'hidden' });
    assert.deepEqual(await controls(), chosen, 'Saving preserves explicit category, sort, search, and tab');
    assert.equal(await page.evaluate(() => findEntry('flight').amount), 151000);
    // Creation previously forced a category on open and again on save, also clearing search/tab.
    await pick('exCategoryFilter', '식비'); await page.locator('#rdExpenseTabs [data-tab="during"]').click();
    const beforeCreate = await controls();
    for (const mode of ['hotel', 'flight']) {
      await page.evaluate(mode => window.TripLog.features.redesign.workspace.openPretripEditor(mode), mode);
      assert.deepEqual(await controls(), beforeCreate, `Opening ${mode} preserves ledger controls`);
      if (mode === 'hotel') {
        await page.locator('#pretripHotelNameInput').fill('검증 새 호텔'); await page.locator('#pretripHotelAmountInput').fill('120000');
      } else {
        await page.locator('#pretripFlightAirlineInput').fill('검증 새 항공'); await page.locator('#pretripFlightFromInput').fill('서울'); await page.locator('#pretripFlightToInput').fill('제주'); await page.locator('#pretripFlightAmountInput').fill('170000');
      }
      await page.locator('#pretripPurchaseSubmit').click(); await page.locator('#rdReservation').waitFor({ state: 'hidden' });
      assert.deepEqual(await controls(), beforeCreate, `Saving ${mode} preserves ledger controls`);
      assert.equal(await page.locator('#rdExpenseList tr').count(), 1, 'The existing food result remains visible');
    }
    assert.equal(await page.evaluate(() => state.entries.length), 5);
    await page.locator('#exFilterReset').click(); await pick('expenseSortSelect', 'default');
    const all = await controls();
    await page.locator('#exCategoryFilterButton').press('ArrowDown'); await page.keyboard.press('End'); await page.keyboard.press('Escape');
    assert.deepEqual(await controls(), all, 'Arrow navigation without selection does not filter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'exCategoryFilterButton');
    await page.locator('#expenseSortSelectButton').press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#expenseSortSelect').inputValue(), 'dateAsc');
    await pick('expenseSortSelect', 'default');
    const measurements = [];
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      if (width <= 760 && await page.locator('#exFilterToggle').getAttribute('aria-expanded') === 'false') await page.locator('#exFilterToggle').click();
      for (const id of ['exCategoryFilter', 'expenseSortSelect']) {
        await page.locator(`#${id}Button`).click(); const menu = page.locator(`#${id}Menu`);
        const bounds = await menu.boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= (width > 600 ? 1000 : 844));
        assert(bounds.width <= 210, 'Menus remain compact at every viewport');
        assert(bounds.height <= await menu.locator('.custom-select-option').count() * 34 + 4, 'No inherited gaps between compact options');
        assert((await page.locator(`#${id}Button`).boundingBox()).height <= 36);
        assert((await page.locator('.ex-search').boundingBox()).height <= 36);
        const style = await menu.locator('.custom-select-option').first().evaluate(el => { const s = getComputedStyle(el); return { font: s.fontSize, height: el.getBoundingClientRect().height }; });
        assert.equal(style.font, '12px'); assert(style.height >= 32 && style.height <= 36);
        assert.equal(await menu.locator('[aria-selected="true"] .control-option-check').count(), 1);
        measurements.push({ width, id, bounds, ...style });
        await menu.screenshot({ path: path.join(output, `${id}-${width}.png`), animations: 'disabled' });
        await page.screenshot({ path: path.join(output, `${id}-${width}-context.png`), animations: 'disabled' });
        await page.keyboard.press('Escape');
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
      await page.locator('.ex-toolbar').screenshot({ path: path.join(output, `toolbar-${width}.png`), animations: 'disabled' });
    }
    await page.locator('#exCategoryFilterButton').click(); await page.locator('#expenseSearchInput').click();
    assert.equal(await page.locator('#exCategoryFilterMenu').isVisible(), false, 'Outside click dismisses the menu');
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ measurements, errors }, null, 2));
    console.log('PASS expense row/badge/old-reservation edit and save preserve filters; pre-purchase open/save preserve search, sort and tabs; explicit filtering/sort/keyboard/dismissal; compact dropdowns fit 320/390/1440px. ' + output);
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
