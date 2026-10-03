// Browser plugin unavailable; run the repository's isolated Playwright/Edge checks.
// Synthetic preview only. Production services are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createReservationPocketPreview } = require('./preview-reservation-pockets');
const fixture = require('./fixtures/reservation-pockets');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || path.join(require('node:os').tmpdir(), 'TripLOG-Reservation-Summary-20261004');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createReservationPocketPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', deviceScaleFactor: 1 });
    context.setDefaultTimeout(12000);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in');
    const panel = page.locator('.rs-reservations');
    const transport = page.getByRole('button', { name: '교통 예약 3건, 예약 지갑 열기', exact: true });
    const stay = page.getByRole('button', { name: '숙소 예약 2건, 예약 지갑 열기', exact: true });
    const layout = async (width, stateName) => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${stateName}: page fits ${width}px`);
      assert.equal(await panel.locator('.rs-summary-columns').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2, 'Mobile retains two columns');
      const bounds = await panel.boundingBox();
      assert(bounds.height <= 280, `${stateName}: summary stays compact at ${width}px (${bounds.height}px high)`);
      const columns = await panel.locator('.rs-summary-column').evaluateAll(items => items.map(el => {
        const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        return { box: rect(el), heading: rect(el.querySelector('h2')), count: rect(el.querySelector('.rs-summary-count')), body: rect(el.querySelector('.rs-summary-body')), action: rect(el.querySelector('.rs-summary-action')), fits: el.scrollWidth <= el.clientWidth + 1 };
      }));
      assert(Math.abs(columns[0].box.y - columns[1].box.y) < 1 && Math.abs(columns[0].box.height - columns[1].box.height) < 1, 'Columns align and remain equal height');
      assert(Math.abs(columns[0].action.y - columns[1].action.y) < 1, 'Actions share one baseline');
      for (const column of columns) {
        assert(column.fits, 'Every column fits its allocated width');
        assert(column.heading.right + 3 <= column.count.x, 'Category title never overlaps its count');
        assert(column.count.right <= column.box.right + 1, 'Count stays inside the column');
        assert(column.body.bottom <= column.action.y - 6, 'Summary text clears the action');
        assert(column.action.height >= 36, 'The visible action remains a usable tap target');
        assert(column.action.bottom <= bounds.y + bounds.height - 8, 'Actions stay inside the panel');
      }
    };
    await page.goto(`${origin}/Travel?page=overview&trip=${fixture.id}`); await ready();
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => {
      const primary = getComputedStyle(document.querySelector('.rs-summary-heading h2')).fontFamily.split(',')[0].replace(/["']/g, '').trim();
      return [...document.fonts].some(face => face.family.replace(/["']/g, '') === primary && face.status === 'loaded');
    }), 'The computed primary Korean font is actually loaded');
    await page.waitForFunction(() => [...document.querySelectorAll('.rs-reservations img')].every(image => image.complete && image.naturalWidth > 0));
    const originalEntries = await page.evaluate(() => JSON.stringify(state.entries));
    const rows = await page.evaluate(() => window.TripLog.features.travelCompanion.model.reservations(state));
    assert.equal(await panel.locator('.rs-transport-body').count(), 1, 'Three transport records produce one representative summary');
    assert.equal(await panel.locator('.rs-summary-stay-item').count(), 2);
    assert.equal(await panel.locator('.rs-transport-body').getAttribute('data-summary-source-id'), 'entry:flight-1');
    assert.match(await panel.innerText(), /서울[\s\S]+오사카[\s\S]+제주항공[\s\S]+9\.25–9\.28/);
    assert.doesNotMatch(await panel.innerText(), /09:05|10:40|13:35|16:30/, 'Detailed schedules are kept in the wallet');
    assert.deepEqual(await panel.locator('.rs-summary-count').allTextContents(), ['3건', '2건']);
    for (const width of [320, 360, 390, 480, 600, 768, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      await layout(width, 'populated');
      const name = panel.locator('.rs-summary-name').first();
      assert.equal(await name.getAttribute('title'), fixture.entries[3].hotelName, 'Full hotel name remains available');
      assert(await name.evaluate(el => getComputedStyle(el).textOverflow === 'ellipsis' && el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) + 1), 'Preview names occupy one stable line');
      await panel.screenshot({ path: path.join(output, `summary-${width}.png`), animations: 'disabled' });
      if (width === 390 || width === 320) await page.screenshot({ path: path.join(output, `overview-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    console.log('PASS reservation summary: loaded font/art, one transport and two stay previews, preserved full counts, compact aligned two-column layout at 320/360/390/480/600/768/1440');
    await page.setViewportSize({ width: 390, height: 844 });
    await transport.click();
    const wallet = page.getByRole('dialog', { name: '예약 지갑', exact: true });
    assert.equal(await wallet.locator('[data-reservation-id]').count(), 3);
    assert.equal(await wallet.getByRole('button', { name: '교통 예약 3건', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.match(await wallet.innerText(), /간사이/, 'Airport qualifiers remain visible in full details');
    await wallet.getByRole('button', { name: '닫기', exact: true }).click();
    await stay.focus(); await stay.press('Enter');
    assert.equal(await wallet.locator('[data-reservation-id]').count(), 2);
    await wallet.getByRole('button', { name: '닫기', exact: true }).click();
    assert.equal(await stay.evaluate(el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => JSON.stringify(state.entries)), originalEntries);
    await page.reload(); await ready(); await transport.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => JSON.stringify(state.entries)), originalEntries, 'Summary navigation never merges, removes or edits bookings');
    console.log('PASS reservation summary: complete original records and airport qualifiers in filtered wallets, keyboard/focus return, reload preservation');
    // Rendering-only cases replace the widget, not application state or persistence.
    const renderRows = async records => {
      assert(await page.evaluate(records => {
        const before = JSON.stringify(records);
        document.querySelector('.rs-reservations').outerHTML = window.TripLog.features.overview.reservationPockets.render(records);
        return JSON.stringify(records) === before;
      }, records), 'Rendering does not mutate the input records');
    };
    const flight = rows.find(row => row.type === 'transport'), hotel = rows.find(row => row.type === 'stay');
    await renderRows([{ ...flight, endDate: '', endTime: '' }]);
    assert.equal(await panel.locator('.is-round-trip').count(), 0);
    assert.equal(await panel.locator('.rs-summary-route .ph-arrow-right').count(), 1);
    await renderRows([{ id: 'rail', type: 'transport', title: 'KTX 서울 → 부산', location: '서울역 → 부산역', date: '2026-10-03', time: '08:30' }]);
    assert.equal(await panel.locator('.rs-transport-symbol .ph-train').count(), 1);
    assert.match(await panel.innerText(), /KTX 서울 → 부산[\s\S]+10\.3/);
    assert.equal(await panel.locator('.rs-transport-illustration').count(), 0, 'Generic transport is not presented as a flight');
    await renderRows([{ ...flight, date: '2026-12-31', endDate: '2027-01-02' }, { ...hotel, date: '2026-12-31', endDate: '2027-01-02' }]);
    assert.match(await panel.innerText(), /2026\.12\.31–2027\.1\.2/);
    assert.match(await panel.innerText(), /2박/);
    await renderRows([{ ...flight, date: '', endDate: '' }, { ...hotel, date: '2026-10-04', endDate: '2026-10-03' }]);
    assert.match(await panel.innerText(), /날짜 미정/); assert.match(await panel.innerText(), /숙박 날짜 확인/); assert.doesNotMatch(await panel.innerText(), /-1박|NaN/);
    const many = Array.from({ length: 12 }, (_, i) => ({ ...flight, id: `flight-many-${i}`, to: i ? '오사카(간사이)' : flight.to, time: `10:${String(i).padStart(2, '0')}` }));
    await renderRows(many.concat(Array.from({ length: 4 }, (_, i) => ({ ...hotel, id: `stay-many-${i}`, title: '<img src=x onerror=alert(1)> ' + '아주 긴 숙소 이름 '.repeat(10) }))));
    assert.deepEqual(await panel.locator('.rs-summary-count').allTextContents(), ['12건', '4건']);
    assert.equal(await panel.locator('.rs-transport-body').count(), 1); assert.equal(await panel.locator('.rs-summary-stay-item').count(), 2);
    assert.equal(await panel.locator('.rs-summary-name img').count(), 0, 'User text is escaped');
    await page.setViewportSize({ width: 320, height: 844 }); await layout(320, 'many/long');
    await panel.screenshot({ path: path.join(output, 'many-long-320.png'), animations: 'disabled' });
    await renderRows([]);
    assert.equal(await panel.locator('.rs-summary-column.is-empty').count(), 2);
    for (const width of [320, 390, 600, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 }); await layout(width, 'empty');
      if (width === 390 || width === 1440) await panel.screenshot({ path: path.join(output, `empty-${width}.png`), animations: 'disabled' });
    }
    // Exercise real saves on the separate untouched synthetic empty trip.
    await page.goto(`${origin}/Travel?page=overview&trip=reservation-empty-fixture`); await ready();
    // Wait for account hydration so unrelated startup ownership metadata has settled.
    await page.waitForFunction(() => Boolean(state.collaboration?.ownerId));
    const editor = page.getByRole('dialog', { name: '예약 추가', exact: true });
    const beforeCancel = await page.evaluate(() => JSON.stringify(state));
    for (const [type, label] of [['transport', '교통'], ['stay', '숙소']]) {
      const trigger = page.getByRole('button', { name: `${label} 예약 0건, 예약 추가하기`, exact: true });
      await trigger.focus(); await trigger.press('Enter');
      assert.equal(await editor.locator('[name="type"]').inputValue(), type);
      assert.equal(await wallet.isVisible(), false);
      await editor.getByRole('button', { name: '취소', exact: true }).click();
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    }
    assert.equal(await page.evaluate(() => JSON.stringify(state)), beforeCancel);
    for (const [type, label] of [['transport', '교통'], ['stay', '숙소']]) {
      await page.getByRole('button', { name: `${label} 예약 0건, 예약 추가하기`, exact: true }).click();
      await editor.getByLabel('예약 이름').fill(`요약 UI 확인용 ${label} 예약`);
      await editor.getByRole('button', { name: '예약 저장', exact: true }).click();
      await editor.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: `${label} 예약 1건, 예약 지갑 열기`, exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(kind => state.travelCompanion.reservations.filter(row => row.type === kind).length, type), 1);
    }
    await page.reload(); await ready();
    assert.equal(await panel.locator('.is-empty').count(), 0);
    assert.equal(await page.evaluate(() => state.travelCompanion.reservations.length), 2);
    assert.deepEqual(errors, []);
    console.log(`PASS reservation summary: generic/one-way/cross-year/missing/many/escaped/empty states; direct add/cancel/save/reload; no runtime errors. Screenshots: ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
