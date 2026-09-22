// Browser plugin unavailable: use the repository's isolated Playwright/Edge workflow.
// External requests are blocked. No real account, trip, or server data is edited.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { createServer } = require('./serve-test');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || path.join(require('node:os').tmpdir(), 'TripLOG-Controls-20260920');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createServer({ pagesRedirects: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.TRIPLOG_TEST_URL || `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  let page;
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } });
    context.setDefaultTimeout(12000);
    const user = { id: '00000000-0000-4000-8000-000000000099', email: 'controls@example.test', user_metadata: { display_name: '컨트롤 시험' } };
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: expiry, role: 'authenticated' })).toString('base64url'), 'fixture'].join('.');
    const seed = { id: 'controls-fixture', tripName: '교토 여행', city: '교토', country: '일본', travelMode: 'overseas', startDate: '2026-09-25', endDate: '2026-09-28', entries: [], companions: [], packingList: [], itineraryItems: [] };
    await context.addInitScript(({ origin, user, expiry, token, seed }) => {
      if (location.origin !== origin || localStorage.getItem('controls-seed')) return;
      localStorage.setItem('controls-seed', '1');
      localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_at: expiry, expires_in: 3600, user }));
      localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([seed]));
      localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', seed.id);
    }, { origin, user, expiry, token, seed });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    async function ready() {
      await page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && document.documentElement.dataset.appReady === 'true');
    }
    async function capture(selector, name) {
      const node = page.locator(selector); await node.waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, `${name}-context.png`), animations: 'disabled' });
      await node.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
      const box = await node.boundingBox(), viewport = page.viewportSize();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${name} must fit the viewport: ${JSON.stringify(box)}`);
    }
    await page.goto(`${origin}/Travel?page=itinerary`); await ready();
    await page.evaluate(() => setActivePage('itinerary'));
    await page.locator('#itineraryAddButton').click();
    await page.locator('#itineraryThemeSelectButton').click();
    assert.equal(await page.locator('#itineraryThemeSelectMenu .control-theme-emoji').count(), 6);
    await page.locator('#itineraryThemeSelectMenu [data-value="lodging"]').click();
    assert.equal(await page.locator('#itineraryEndTimeInput').isDisabled(), true);
    await page.locator('#itineraryThemeSelectButton').click();
    await capture('#itineraryThemeSelectMenu', '02-theme-desktop');
    await page.keyboard.press('Escape');
    await page.locator('#itineraryThemeSelectButton').press('ArrowDown');
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#itineraryThemeSelect').inputValue(), 'sightseeing');
    assert.equal(await page.locator('#itineraryEndTimeInput').isDisabled(), false);
    await page.locator('#itineraryThemeSelectButton').click();
    await page.locator('#itineraryThemeSelectMenu [data-value="lodging"]').click();
    await page.locator('#itineraryTimeInputText').click();
    await capture('#itineraryTimeInputPanel', '01-time-desktop');
    const hour = page.locator('#itineraryTimeInputPanel [data-time-part-input="hour"]');
    const minute = page.locator('#itineraryTimeInputPanel [data-time-part-input="minute"]');
    await hour.fill('23'); await minute.fill('59');
    await minute.press('ArrowUp');
    assert.equal(await minute.inputValue(), '00', 'Minute keyboard wraps at midnight');
    await page.locator('#itineraryTimeInputPanel [data-time-action="close"]').click();
    assert.equal(await page.locator('#itineraryTimeInput').inputValue(), '23:00');
    await page.locator('#itineraryTimeInputText').click();
    await hour.fill('07'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#itineraryTimeInput').inputValue(), '23:00', 'Escape restores the opening value');
    await page.locator('#itineraryTimeInputText').click();
    const wheel = page.locator('#itineraryTimeInputPanel [data-time-wheel="hour"]');
    await wheel.evaluate(node => { node.scrollTop = (24 + 9) * node.firstElementChild.offsetHeight; });
    await page.waitForFunction(() => document.querySelector('#itineraryTimeInput').value === '09:00');
    const wheelBox = await wheel.boundingBox();
    await page.mouse.move(wheelBox.x + 12, wheelBox.y + 20); await page.mouse.wheel(0, await wheel.evaluate(node => node.firstElementChild.offsetHeight * 2));
    await page.waitForFunction(() => document.querySelector('#itineraryTimeInput').value === '11:00');
    await hour.fill('09');
    await page.locator('#itineraryTimeInputPanel [data-time-action="close"]').click();
    await page.locator('#itineraryPlaceInput').fill('목업 검증 호텔');
    await page.locator('#itinerarySubmitButton').click();
    await page.waitForFunction(() => state.itineraryItems.some(item => item.place === '목업 검증 호텔' && item.theme === 'lodging' && item.time === '09:00' && !item.endTime));
    console.log('PASS theme, lodging arrival-only, wheel scrolling, editable time, keyboard boundary, Escape and real itinerary save.');

    await page.evaluate(() => setActivePage('budget'));
    await page.locator('#exCategoryFilterButton').click();
    await capture('#exCategoryFilterMenu', '03-category-desktop');
    await page.locator('#exCategoryFilterMenu [data-value="식비"]').click();
    assert.equal(await page.locator('#exCategoryFilter').inputValue(), '식비');
    await page.locator('.ex-desktop-add').click();
    await page.locator('#currencySelectButton').click();
    await page.locator('#currencySelectMenu [data-value="KRW"]').click();
    await page.locator('#currencySelectButton').click();
    await capture('#currencySelectMenu', '04-currency-desktop');
    const search = page.locator('#currencySelectMenu input[type="search"]');
    await search.fill('twd');
    assert.equal(await page.locator('#currencySelectMenu .custom-select-option:visible').count(), 1);
    await search.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#currencySelect').inputValue(), 'TWD');
    await page.locator('#currencySelectButton').click();
    await search.fill('없는 통화');
    assert.equal(await page.locator('#currencySelectMenu .control-search-empty').isVisible(), true);
    await search.fill('원화'); await search.press('Enter');
    await page.locator('#daySelectButton').click();
    await page.locator('#daySelectMenu [data-value="__pretrip__"]').click();
    await page.locator('#daySelectButton').click();
    await capture('#daySelectMenu', '05-day-desktop');
    await page.locator('#daySelectMenu [data-value="2026-09-26"]').click();
    await page.locator('#rdPaymentDateButton').click();
    await page.locator('#rdPaymentDatePanel [data-date="2026-09-26"]').click();
    await page.locator('#rdPaymentDateButton').click();
    await capture('#rdPaymentDatePanel', '06-calendar-desktop');
    assert.equal(await page.locator('#rdPaymentDatePanel [aria-selected="true"]').getAttribute('data-date'), '2026-09-26');
    await page.locator('#rdPaymentDatePanel [data-date="2026-09-26"]').focus();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#rdPaymentDate').inputValue(), '2026-09-27');
    await page.locator('#rdPaymentDateButton').press('ArrowDown');
    await page.keyboard.press('PageDown');
    assert.equal(await page.locator('#rdPaymentDatePanel .calendar-title').innerText(), '2026년 10월');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#rdPaymentDate').inputValue(), '2026-09-27', 'Month navigation does not change the stored date');
    console.log('PASS category filter, currency search/name/code/empty state/keyboard selection, travel day and calendar keyboard selection.');
    for (const width of [390, 320, 768]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [id, name] of [['currencySelect', '04-currency'], ['daySelect', '05-day'], ['rdPaymentDate', '06-calendar']]) {
        await page.locator(`#${id}Button`).click();
        await capture(`#${id}${id === 'rdPaymentDate' ? 'Panel' : 'Menu'}`, `${name}-${width}`);
        await page.keyboard.press('Escape');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No page overflow at ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 420 });
    await page.locator('#currencySelectButton').click();
    await capture('#currencySelectMenu', '04-currency-short');
    await search.fill('VND');
    assert.equal(await page.locator('#currencySelectMenu [data-value="VND"]').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('#foreignAmountInput').fill('12000');
    await page.locator('#descriptionInput').fill('목업 검증 점심');
    await page.locator('#rdExpenseSubmit').click();
    await page.waitForFunction(() => state.entries.some(entry => entry.description === '목업 검증 점심' && entry.amount === 12000 && entry.currency === 'KRW' && entry.date === '2026-09-26' && entry.paymentDate === '2026-09-27'));
    await page.evaluate(() => setActivePage('itinerary'));
    await page.locator('#itineraryAddButton').click();
    for (const width of [390, 320, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#itineraryThemeSelectButton').click();
      await capture('#itineraryThemeSelectMenu', `02-theme-${width}`); await page.keyboard.press('Escape');
      await page.locator('#itineraryTimeInputText').click();
      await capture('#itineraryTimeInputPanel', `01-time-${width}`);
      await page.locator('#itineraryTimeInputPanel [data-time-action="clear"]').click();
      assert.equal(await page.locator('#itineraryTimeInput').inputValue(), '');
    }
    await page.reload(); await ready();
    assert(await page.evaluate(() => state.itineraryItems.some(item => item.place === '목업 검증 호텔' && item.time === '09:00')), 'Saved itinerary survives reload');
    assert(await page.evaluate(() => state.entries.some(entry => entry.description === '목업 검증 점심' && entry.amount === 12000 && entry.paymentDate === '2026-09-27')), 'Expense values survive reload');
    assert.deepEqual(errors, []);
    console.log(`PASS viewport 320/390/768/1440, clear time, persisted itinerary after reload and no runtime errors. Screenshots: ${output}`);
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); console.error(await page.locator('body').innerText().catch(() => '')); }
    throw error;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
