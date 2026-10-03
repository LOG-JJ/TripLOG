// Browser plugin unavailable; use the repository's isolated Playwright/Edge checks.
// The local preview supplies synthetic records; every external request is blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createReservationPocketPreview } = require('./preview-reservation-pockets');
const fixture = require('./fixtures/reservation-pockets');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || path.join(require('node:os').tmpdir(), 'TripLOG-Reservation-Pockets-20261003');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createReservationPocketPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul', deviceScaleFactor: 1 });
    context.setDefaultTimeout(12000);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in');
    const transport = page.getByRole('button', { name: '교통 예약 3건, 예약 지갑 열기', exact: true });
    const stay = page.getByRole('button', { name: '숙소 예약 2건, 예약 지갑 열기', exact: true });
    const grid = page.locator('.rs-reservations');
    await page.goto(`${origin}/Travel?page=overview&trip=${fixture.id}`); await ready();
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => {
      const primary = getComputedStyle(document.querySelector('.rs-pocket-heading strong')).fontFamily.split(',')[0].replace(/["']/g, '').trim();
      return [...document.fonts].some(face => face.family.replace(/["']/g, '') === primary && face.status === 'loaded');
    }), 'The displayed reservation text uses a loaded local webfont, not a missing-family fallback');
    await page.waitForFunction(() => [...document.querySelectorAll('.rs-pocket-art')].every(image => image.complete && image.naturalWidth > 0));
    const originalEntries = await page.evaluate(() => JSON.stringify(state.entries));
    assert.equal(await transport.locator('.rs-flight-row').count(), 2, 'Three bookings have two complete matching schedules');
    assert.equal(await transport.locator('[data-reservation-group-size="2"]').count(), 1);
    assert.equal(await transport.locator('.rs-pocket-heading strong').innerText(), '교통 예약');
    assert.equal(await transport.locator('.rs-route').count(), 1);
    assert.equal(await stay.locator('.rs-stay').count(), 2);
    assert.match(await stay.innerText(), /1박[\s\S]+2박/);
    for (const width of [320, 390, 480, 600, 768, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page fits ${width}px`);
      assert.equal(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), width < 600 ? 1 : 2);
      const nameLayout = await stay.locator('.rs-stay strong').first().evaluate(el => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight), weight: Number(getComputedStyle(el).fontWeight) }));
      assert(nameLayout.height > nameLayout.line && nameLayout.height <= nameLayout.line * 3 + 1, 'The full representative hotel name wraps into readable lines');
      assert(Number(await stay.locator('.rs-stay-dates').first().evaluate(el => getComputedStyle(el).fontWeight)) < nameLayout.weight, 'Dates retain a lighter weight than reservation names');
      for (const card of await grid.locator('.rs-pocket').all()) {
        assert(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `Card content fits ${width}px`);
        const img = await card.locator('img').boundingBox(), content = await card.locator('.rs-pocket-body').boundingBox();
        assert(content.y + content.height <= img.y + img.height - 42, 'Text ends above the illustrated pocket edge');
      }
      await page.screenshot({ path: path.join(output, `overview-${width}.png`), fullPage: true, animations: 'disabled' });
      if (width >= 600) await grid.screenshot({ path: path.join(output, `pockets-${width}.png`), animations: 'disabled' });
    }
    console.log('PASS reservation pockets: real artwork, single headings, grouped schedule count, full stay dates and responsive 320/390/480/600/768/1440 layout');
    await page.setViewportSize({ width: 390, height: 844 });
    await transport.click();
    const wallet = page.getByRole('dialog', { name: '예약 지갑', exact: true });
    assert.equal(await wallet.locator('[data-reservation-id]').count(), 3, 'Grouping never removes stored bookings');
    assert.equal(await wallet.getByRole('button', { name: '교통 예약 3건', exact: true }).getAttribute('aria-pressed'), 'true');
    await wallet.getByRole('button', { name: '닫기', exact: true }).click();
    await stay.focus(); await stay.press('Enter');
    assert.equal(await wallet.locator('[data-reservation-id]').count(), 2);
    await wallet.getByRole('button', { name: '닫기', exact: true }).click();
    assert.equal(await stay.evaluate(el => el === document.activeElement), true, 'Keyboard focus returns to its card');
    assert.equal(await page.evaluate(() => JSON.stringify(state.entries)), originalEntries);
    await page.reload(); await ready();
    await transport.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => JSON.stringify(state.entries)), originalEntries, 'Opening/filtering cards and reloading preserve every reservation');
    const grouping = await page.evaluate(() => {
      const M = window.TripLog.features.travelCompanion.model, P = window.TripLog.features.overview.reservationPockets;
      const first = M.reservations(state).find(row => row.type === 'transport');
      const counts = patch => P.groupTransport([first, { ...first, id: 'different-record', ...patch }]).map(group => group.rows.length);
      return {
        exact: counts({}), airportQualifier: counts({ to: '오사카(간사이)' }), operator: counts({ operator: '다른 항공사' }),
        flight: counts({ serviceNumber: '7C9999' }), departure: counts({ time: '10:40' }), returning: counts({ endTime: '16:30' }),
        unknown: counts({ time: '' }), invalid: counts({ endDate: '2026-09-01' }),
        bothUnknown: P.groupTransport([{ ...first, time: '' }, { ...first, time: '' }]).map(group => group.rows.length),
      };
    });
    assert.deepEqual(grouping.exact, [2]);
    for (const [name, counts] of Object.entries(grouping)) if (name !== 'exact') assert.deepEqual(counts, [1, 1], `${name} must remain separate`);
    console.log('PASS reservation pockets: mouse/keyboard open correctly filtered wallet; all original bookings survive; incomplete/different airport/operator/flight/time schedules remain separate');
    const renderEntries = async (entries, manual = []) => {
      await page.evaluate(async ({ entries, manual }) => {
        state.entries = entries; state.travelCompanion = { ...state.travelCompanion, reservations: manual };
        await saveAndRender();
        window.TripLog.features.redesign.workspace.render();
      }, { entries, manual });
    };
    await renderEntries([{ ...fixture.entries[0], flightReturnDate: '', flightReturnDepartTime: '' }]);
    assert.equal(await grid.locator('.is-one-way').count(), 1);
    assert.doesNotMatch(await grid.innerText(), /오는 편/);
    await renderEntries([], [{ id: 'rail', type: 'transport', title: 'KTX 서울 → 부산', location: '서울역 → 부산역', date: '2026-10-03', time: '08:30' }]);
    assert.match(await grid.innerText(), /서울역 → 부산역[\s\S]+08:30/);
    assert.doesNotMatch(await grid.innerText(), /귀국|오는 편/);
    const many = Array.from({ length: 6 }, (_, index) => ({ ...fixture.entries[0], id: `flight-many-${index}`, flightDepartTime: `10:${String(index).padStart(2, '0')}` }));
    await renderEntries(many.concat([{ ...fixture.entries[3], hotelName: '<img src=x onerror=alert(1)> ' + '아주 긴 숙소 이름 '.repeat(14) }]));
    assert.equal(await grid.locator('[data-reservation-group-size]').count(), 3);
    assert.match(await grid.innerText(), /외 3건/);
    assert.equal(await grid.locator('.rs-stay img').count(), 0, 'User text stays escaped');
    await page.setViewportSize({ width: 320, height: 844 });
    assert(await grid.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: path.join(output, 'long-name-320.png'), fullPage: true });
    await renderEntries([]);
    assert.equal(await grid.locator('.rs-pocket.is-empty').count(), 2);
    assert.equal(await grid.locator('.rs-empty-action').count(), 2);
    await page.screenshot({ path: path.join(output, 'empty-320.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`PASS reservation pockets: one-way/general transport, extra bookings, long/escaped names, empty states, and no runtime errors. Screenshots: ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
