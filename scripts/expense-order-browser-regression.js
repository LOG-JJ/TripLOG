'use strict';
// Browser plugin not available: use the repository's isolated Playwright/Edge
// workflow. All accounts/trips are fixtures and external requests are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, seedTrip, waitForApp, startServer, stopServer } = require('./helpers/browser-fixture');
const output = artifactDirectory('expense-order-browser');
const fixture = { id: 'expense-order-browser-fixture', tripName: '가을 서울 여행', country: '대한민국', countryCode: 'KR', city: '서울', travelMode: 'domestic', startDate: '2026-10-25', endDate: '2026-10-28',
  entries: [
    ['a', '서울행 기차', '교통', 32000], ['b', '카페 라떼', '식비', 6500], ['c', '시장 점심', '식비', 18000],
    ['d', '한옥 숙소 예약', '숙소', 120000], ['e', '미술관 입장권', '관광', 15000], ['f', '시내버스', '교통', 1500],
  ].map(([id, description, category, amount], i) => ({ id, description, category, amount, date: id === 'd' ? '__pretrip__' : '2026-10-26', paymentDate: '2026-10-26', mode: 'domestic', currency: 'KRW', paymentMethod: i % 2 ? 'cash' : 'card', note: id === 'd' ? '체크인 15:00 · 예약 정보 보존' : '', bookingCode: id === 'd' ? 'FIXTURE-123' : '', createdAt: 100 - i })),
  itineraryItems: [{ id: 'linked', date: '2026-10-26', place: '서울 도착', time: '10:00', trans: 'train', cost: 32000, syncExpense: true, expenseId: 'a' },
    { id: 'stop-two', date: '2026-10-26', place: '미술관', time: '14:00', trans: 'none', cost: 0, syncExpense: false }], companions: [], packingList: [] };
const user = { id: '00000000-0000-4000-8000-000000000099', email: 'order-fixture@example.invalid' };
const cases = [], errors = [], consoleIssues = [], fixtureWarnings = [];
async function main() {
  const { server, origin } = await startServer(), browser = await launchBrowser();
  try {
    const createPage = async (mobile = false) => {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1100 }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
      context.setDefaultTimeout(12000);
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      await seedTrip(context, { origin, user, expiry, token: fixtureToken(user, expiry), seed: fixture });
      await blockExternalRequests(context, origin);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (!['error', 'warning'].includes(message.type())) return;
        if (/net::ERR_FAILED|Failed to fetch|WebSocket|Realtime|AbortError|Service Worker registration blocked by Playwright/.test(message.text())) fixtureWarnings.push(message.text());
        else consoleIssues.push(message.text());
      });
      await page.goto(`${origin}/Travel?page=budget`); await waitForApp(page);
      await page.waitForFunction(() => document.querySelectorAll('#rdExpenseList tr:not([data-dnd-placeholder])').length === 6);
      return { page, context };
    };
    const rowIds = page => page.locator('#rdExpenseList tr:not([data-dnd-placeholder])').evaluateAll(rows => rows.map(row => row.dataset.id));
    const expectOrder = async (page, ids) => {
      try { await page.waitForFunction(expected => document.querySelector('#rdExpenseList').getAttribute('aria-busy') === 'false'
        && JSON.stringify([...document.querySelectorAll('#rdExpenseList tr:not([data-dnd-placeholder])')].map(row => row.dataset.id)) === JSON.stringify(expected), ids); }
      catch (error) {
        await page.screenshot({ path: path.join(output, 'failure.png') });
        const diagnostic = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#rdExpenseList tr:not([data-dnd-placeholder])')].map(row => ({ id: row.dataset.id, y: row.getBoundingClientRect().y, height: row.getBoundingClientRect().height })), status: document.querySelector('#budgetPage .tl-sort-announcement[role=status]').textContent, hint: document.querySelector('#exReorderHint').hidden, width: innerWidth, height: innerHeight, scroll: scrollY, events: window.orderPointerEvents }));
        fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify(diagnostic, null, 2));
        throw new Error(`Expected order ${ids.join(',')}; observed ${JSON.stringify(diagnostic)}`, { cause: error });
      }
      assert.deepEqual(await rowIds(page), ids);
    };
    const content = page => page.evaluate(() => ({ entries: state.entries.map(({ expenseOrder, _syncPosition, ...entry }) => entry).sort((a, b) => a.id.localeCompare(b.id)), itinerary: state.itineraryItems.map(({ _syncPosition, ...item }) => item), total: calculateTotals().total }));
    const { page } = await createPage();
    assert.match(await page.title(), /여행|TripLOG/); assert.match(page.url(), /page=budget/);
    const before = await content(page); assert.deepEqual(await rowIds(page), ['a', 'b', 'c', 'd', 'e', 'f']);
    await page.screenshot({ path: path.join(output, 'before-desktop.png'), fullPage: true });
    assert.equal(await page.locator('#exReorderToggle, [data-ex-move]').count(), 0);
    assert.equal(await page.locator('#rdExpenseList').getAttribute('data-reorder-engine'), 'dnd-kit-dom-0.5.1');
    assert.equal(await page.locator('#rdExpenseList').getAttribute('data-reorder-component'), 'shared-sortable-list');
    await page.evaluate(() => { state.selectedItineraryDate = '2026-10-26'; setActivePage('itinerary'); render(); });
    assert.equal(await page.locator('#itineraryList').getAttribute('data-reorder-component'), 'shared-sortable-list');
    const handleStyle = await page.evaluate(() => {
      const metrics = selector => { const s = getComputedStyle(document.querySelector(selector)); return [s.width, s.height, s.backgroundColor, s.color, s.touchAction, s.borderRadius]; };
      return { itinerary: metrics('.timeline-drag-handle'), expense: metrics('.ex-drag-handle') };
    });
    assert.deepEqual(handleStyle.expense, handleStyle.itinerary, 'both screens use the same handle dimensions, colors and pointer behavior');
    await page.evaluate(() => setActivePage('budget'));
    assert.equal(await page.locator('#rdExpenseList .ex-drag-handle').count(), 6);
    await page.getByRole('button', { name: '서울행 기차 순서 이동', exact: true }).focus(); await page.keyboard.press('Alt+ArrowDown'); await expectOrder(page, ['b', 'a', 'c', 'd', 'e', 'f']);
    await page.getByRole('button', { name: '서울행 기차 순서 이동', exact: true }).focus(); await page.keyboard.press('Alt+ArrowUp');
    await expectOrder(page, ['a', 'b', 'c', 'd', 'e', 'f']);
    assert.equal(await page.locator('#rdExpenseEditor').isVisible(), false);
    cases.push('shared dnd-kit list and one handle per row; keyboard reorder without opening the editor');

    const dragStart = await page.locator('tr[data-id="f"] .ex-drag-handle').boundingBox(), target = await page.locator('tr[data-id="c"]').boundingBox();
    const originalDragWidth = (await page.locator('tr[data-id="f"]').boundingBox()).width;
    const contentBeforeDrag = await content(page), beforeRanks = await page.evaluate(() => JSON.stringify(state.entries));
    await page.mouse.move(dragStart.x + dragStart.width / 2, dragStart.y + dragStart.height / 2); await page.mouse.down();
    await page.mouse.move(dragStart.x + dragStart.width / 2, target.y + 4, { steps: 15 });
    await page.waitForFunction(() => document.querySelector('#rdExpenseList').classList.contains('is-sorting'));
    const dragBox = await page.locator('[data-dnd-dragging]').boundingBox();
    assert(Math.abs(dragBox.width - originalDragWidth) < 2, 'desktop feedback preserves row width');
    await page.screenshot({ path: path.join(output, 'drag-desktop.png') });
    assert.equal(await page.evaluate(() => JSON.stringify(state.entries)), beforeRanks, 'drag preview must not write data');
    await page.mouse.up(); await expectOrder(page, ['a', 'b', 'f', 'c', 'd', 'e']);
    assert.deepEqual(await content(page), contentBeforeDrag);
    const originalOrder = await rowIds(page), originalState = await page.evaluate(() => JSON.stringify(state.entries));
    const cancelStart = await page.locator('tr[data-id="b"] .ex-drag-handle').boundingBox(), last = await page.locator('tr[data-id="e"]').boundingBox();
    await page.mouse.move(cancelStart.x + 10, cancelStart.y + 10); await page.mouse.down(); await page.mouse.move(cancelStart.x + 10, last.y + last.height - 4, { steps: 10 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await rowIds(page), originalOrder); assert.equal(await page.evaluate(() => JSON.stringify(state.entries)), originalState);
    cases.push('mouse drag saves only on drop, and Escape cancels the preview');
    await page.waitForFunction(() => !document.querySelector('.toss-toast')?.classList.contains('show'));
    await page.screenshot({ path: path.join(output, 'reorder-desktop.png'), fullPage: true, animations: 'disabled' });
    await page.locator('.ex-table-wrap').screenshot({ path: path.join(output, 'expense-list-desktop.png'), animations: 'disabled' });
    await page.reload(); await waitForApp(page); await expectOrder(page, ['a', 'b', 'f', 'c', 'd', 'e']);
    assert.deepEqual(await content(page), before);
    await page.locator('#expenseSortSelectButton').click(); await page.locator('#expenseSortSelectMenu [data-value="amountDesc"]').click();
    assert.equal((await rowIds(page))[0], 'd');
    await page.locator('#expenseSortSelectButton').click(); await page.locator('#expenseSortSelectMenu [data-value="default"]').click();
    await expectOrder(page, ['a', 'b', 'f', 'c', 'd', 'e']);
    cases.push('reload and alternate sort preserve saved manual order, totals, metadata and linked itinerary');

    await page.locator('#exCategoryFilterButton').click(); await page.locator('#exCategoryFilterMenu [data-value="교통"]').click();
    await expectOrder(page, ['a', 'f']);
    const hiddenRanks = await page.evaluate(() => state.entries.filter(entry => !['a', 'f'].includes(entry.id)).map(entry => [entry.id, entry.expenseOrder]));
    await page.getByRole('button', { name: '시내버스 순서 이동', exact: true }).focus(); await page.keyboard.press('Alt+ArrowUp'); await expectOrder(page, ['f', 'a']);
    assert.deepEqual(await page.evaluate(() => state.entries.filter(entry => !['a', 'f'].includes(entry.id)).map(entry => [entry.id, entry.expenseOrder])), hiddenRanks);
    await page.locator('#exCategoryFilterButton').click(); await page.locator('#exCategoryFilterMenu [data-value="전체"]').click(); await expectOrder(page, ['f', 'a', 'b', 'c', 'd', 'e']);
    await page.locator('#expenseSearchInput').fill('카페'); assert.equal(await page.locator('#rdExpenseList tr:not([data-dnd-placeholder])').count(), 1);
    assert.equal(await page.locator('#rdExpenseList .ex-drag-handle').count(), 0); await page.locator('#exSearchClear').click();
    cases.push('filtered moves leave hidden rows intact; single visible row has no unnecessary move handle');

    await page.evaluate(() => { const cached = window.TripLogSyncRepository.cached; window.TripLogSyncRepository.cached = id => ({ ...cached(id), role: 'viewer' }); render(); });
    assert.equal(await page.locator('#rdExpenseList .tl-sort-handle').count(), 0); assert.equal(await page.locator('#rdExpenseList .ex-drag-handle').count(), 0);
    cases.push('read-only trips do not expose reorder controls');

    const { page: mobile, context: mobileContext } = await createPage(true);
    const assertAmountHandle = async () => {
      const boxes = await mobile.locator('#rdExpenseList tr').evaluateAll(rows => rows.map(row => {
        const amount = row.querySelector('.ex-row-amount').getBoundingClientRect(), handle = row.querySelector('.ex-drag-handle').getBoundingClientRect();
        return { id: row.dataset.id, right: handle.left >= amount.right - 1, aligned: handle.top < amount.bottom && amount.top < handle.bottom, fits: handle.right <= innerWidth + 1, width: handle.width, height: handle.height };
      }));
      assert(boxes.every(box => box.right && box.aligned && box.fits && box.width >= 44 && box.height >= 44), `Move handles stay to the right of amounts: ${JSON.stringify(boxes)}`);
    };
    await assertAmountHandle();
    await mobile.evaluate(() => { window.orderPointerEvents = []; for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(name, event => window.orderPointerEvents.push({ name, type: event.pointerType, primary: event.isPrimary, button: event.button, id: event.pointerId, target: event.target.closest('.ex-drag-handle')?.getAttribute('aria-label'), y: event.clientY }), true); });
    const client = await mobileContext.newCDPSession(mobile);
    await mobile.evaluate(() => window.scrollTo({ top: 260, behavior: 'instant' }));
    await mobile.waitForFunction(() => window.scrollY >= 200);
    const start = await mobile.locator('tr[data-id="a"] .ex-drag-handle').boundingBox(), below = await mobile.locator('tr[data-id="b"]').boundingBox();
    const x = start.x + start.width / 2, y = start.y + start.height / 2, endY = below.y + below.height - 4;
    fs.writeFileSync(path.join(output, 'touch-layout.json'), JSON.stringify(await mobile.locator('tr[data-id="a"]').evaluate(row => {
      const parents = []; for(let node = row; node; node = node.parentElement) parents.push({ tag: node.tagName, id: node.id, cls: node.className, top: node.getBoundingClientRect().top, height: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop, overflow: getComputedStyle(node).overflowY });
      return { y: row.getBoundingClientRect().top, innerHeight, scrollY, parents };
    }), null, 2));
    assert(endY < 844 * .75, 'the single-row touch test stays outside the edge-scroll activation zone');
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 12; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (endY - y) * i / 12 }] });
    const touchDragBox = await mobile.locator('[data-dnd-dragging]').boundingBox();
    assert(touchDragBox.width <= 391, 'touch feedback stays within the mobile viewport');
    await mobile.screenshot({ path: path.join(output, 'drag-mobile.png') });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expectOrder(mobile, ['b', 'a', 'c', 'd', 'e', 'f']);
    assert.equal(await mobile.locator('#rdExpenseEditor').isVisible(), false);
    await mobile.evaluate(() => window.scrollTo(0, 0));
    await mobile.waitForFunction(() => !document.querySelector('.toss-toast')?.classList.contains('show'));
    await mobile.screenshot({ path: path.join(output, 'reorder-mobile-390.png'), animations: 'disabled' });
    cases.push('native mobile touch drag reorders from its handle without accidental editing');
    cases.push('shared feedback preserves desktop row width and mobile geometry during the drag');

    const mobileBeforeCancel = await mobile.evaluate(() => JSON.stringify(state.entries));
    const cancelTouch = await mobile.locator('tr[data-id="b"] .ex-drag-handle').boundingBox();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cancelTouch.x + 10, y: cancelTouch.y + 10 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cancelTouch.x + 10, y: cancelTouch.y + 80 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal(await mobile.evaluate(() => JSON.stringify(state.entries)), mobileBeforeCancel); await expectOrder(mobile, ['b', 'a', 'c', 'd', 'e', 'f']);
    await mobile.reload(); await waitForApp(mobile); await expectOrder(mobile, ['b', 'a', 'c', 'd', 'e', 'f']);
    cases.push('touch cancellation and mobile reload preserve the saved order');

    await mobile.setViewportSize({ width: 320, height: 740 });
    await mobile.evaluate(() => { state.entries[0].description = '아주 긴 지출 내용과 예약 정보 '.repeat(12); state.entries[0].amount = 123456789012; state.entries[0].foreignAmount = 123456789; state.entries[0].currency = 'JPY'; render(); });
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px layout must not overflow');
    await assertAmountHandle();
    for (const button of await mobile.locator('tr[data-id="a"] .tl-sort-handle').all()) { const box = await button.boundingBox(); assert(box.x >= 0 && box.x + box.width <= 321); }
    await mobile.locator('tr[data-id="a"]').evaluate(row => row.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await mobile.screenshot({ path: path.join(output, 'reorder-mobile-320-long.png') });
    cases.push('320px layout keeps long descriptions, large amounts and move controls within the viewport');

    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.evaluate(() => { window.orderOriginalSave = window.TripLogSyncRepository.save; window.TripLogSyncRepository.save = async () => { throw new Error('fixture storage failure'); }; });
    await mobile.locator('tr[data-id="b"] .tl-sort-handle').focus(); await mobile.keyboard.press('Alt+ArrowDown');
    await mobile.waitForFunction(() => document.querySelector('#rdExpenseList').getAttribute('aria-busy') === 'false' && document.body.textContent.includes('순서를 저장하지 못했어요'));
    assert.equal(await mobile.locator('tr[data-id="b"] .tl-sort-handle').isDisabled(), false);
    await mobile.evaluate(async () => { window.TripLogSyncRepository.save = window.orderOriginalSave; await saveStateSilently(); });
    cases.push('storage failure is reported without a false success, and controls recover for retry');

    assert.deepEqual(errors, []); assert.deepEqual(consoleIssues, []);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, flow: 'budget -> reorder -> shared handle drag/keyboard -> persisted manual order', browser: 'Playwright/Edge; Browser plugin not available', origin, viewports: ['1440x1100', '390x844 touch', '320x740'], cases, errors, consoleIssues, fixtureWarnings, at: new Date().toISOString() }, null, 2));
    console.log(`PASS expense order browser: ${cases.length} interaction groups; desktop/mobile, persistence, filters, cancellation, permissions and failure recovery. ${output}`);
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
