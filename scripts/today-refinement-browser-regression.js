// User AGENTS.md requires isolated browser validation for UI changes.
// Existing Edge/Playwright fixture helpers supplement the in-app browser review.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, waitForApp, stopServer } = require('./helpers/browser-fixture');
const { artifactDirectory } = require('./helpers/artifact-output');
const { createTodayPreview } = require('./preview-today-refinement');
async function main() {
  const output = artifactDirectory('today-refinement'); fs.mkdirSync(output, { recursive: true });
  const server = createTodayPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, browser = await launchBrowser(), errors = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
    const dialog = page.locator('#ttCompanion'), expense = page.locator('#ttCostInfo');
    const open = async () => { await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('today')); await dialog.waitFor({ state: 'visible' }); };
    const capture = async name => {
      await page.mouse.move(0, 0);
      await page.locator('.toss-toast.show').waitFor({ state: 'hidden', timeout: 6000 });
      await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] img, #travelPage:not([hidden]) img')].every(image => image.complete && image.naturalWidth > 0));
      await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
    };
    const fits = async selector => assert(await page.locator(selector).evaluate(node => node.scrollWidth <= node.clientWidth + 1 && node.getBoundingClientRect().right <= innerWidth + 1), selector + ' fits viewport');
    await page.goto(`${origin}/Travel?page=itinerary&trip=today-refinement-fixture`); await waitForApp(page);
    await page.waitForFunction(() => Boolean(state.collaboration?.ownerId)); await open();
    const untouched = await page.evaluate(() => JSON.stringify({ entries: state.entries, items: state.itineraryItems }));
    const progress = dialog.getByRole('progressbar', { name: '일정 방문 완료' }), undo = dialog.locator('.cx-history-back');
    assert.equal(await dialog.locator('.trip-context-name').innerText(), '1000일 순천');
    assert.equal(await dialog.locator('.trip-context-art').count(), 1);
    assert.equal(await progress.getAttribute('aria-valuenow'), '0'); assert.equal(await progress.getAttribute('aria-valuemax'), '5');
    assert.equal(await progress.locator('i').count(), 5); assert(await undo.isDisabled());
    assert.match(await undo.locator('i').getAttribute('class'), /arrow-u-up-left/);
    assert(await undo.evaluate(node => node.getBoundingClientRect().right <= document.querySelector('#ttTodayControls .custom-select').getBoundingClientRect().left));
    assert.equal(await dialog.locator('.cx-start-here').innerText(), 'Start here');
    assert(await dialog.locator('#ttCompanionTitle').evaluate(node => parseFloat(getComputedStyle(node).fontSize) <= 18 && Number(getComputedStyle(node).fontWeight) <= 600));
    assert(await dialog.locator('.trip-context-name').evaluate(node => Number(getComputedStyle(node).fontWeight) <= 600));
    assert(await dialog.locator('.cx-copy-title').evaluate(node => Number(getComputedStyle(node).fontWeight) <= 600 && parseFloat(getComputedStyle(node).fontSize) <= 18));
    assert.match(await dialog.locator('.cx-next-place>img').getAttribute('src'), /noto-emoji/);
    assert.doesNotMatch(await dialog.locator('#ttContent').innerText(), /지난 일정|0\/5 완료|방금 조작 되돌리기/);
    await capture('today-initial-390');
    const measured = await page.evaluate(() => Object.fromEntries(['#ttCompanionTitle','.trip-context-name','.cx-copy-title','.cx-history-back','.cx-start-here','.cx-cost-strip strong'].map(selector => {
      const node = document.querySelector('#ttCompanion').querySelector(selector), style = getComputedStyle(node);
      return [selector, { text:node.textContent.trim(), fontFamily:style.fontFamily, fontSize:style.fontSize, fontWeight:style.fontWeight, bounds:node.getBoundingClientRect().toJSON() }];
    })));
    fs.writeFileSync(path.join(output, 'typography.json'), JSON.stringify(measured, null, 2));
    await dialog.getByRole('button', { name: '순천만 국가정원 완료하기', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.cx-day-progress')?.getAttribute('aria-valuenow') === '1');
    assert.equal(await dialog.locator('.cx-copy-title').innerText(), '순천 점심 식사'); assert(await undo.isEnabled()); await capture('today-completed-390');
    await undo.click(); await page.waitForFunction(() => document.querySelector('.cx-day-progress')?.getAttribute('aria-valuenow') === '0');
    assert.equal(await dialog.locator('.cx-copy-title').innerText(), '순천만 국가정원');
    assert.equal(await page.evaluate(() => JSON.stringify({ entries: state.entries, items: state.itineraryItems })), untouched);
    await dialog.locator('.cx-start-here').click(); await page.locator('#ttStartPicker [data-id="wetland"]').click();
    await page.waitForFunction(() => document.querySelector('.cx-copy-title')?.textContent === '순천만습지');
    assert.equal(await dialog.locator('.cx-copy-title').innerText(), '순천만습지'); assert.equal(await progress.getAttribute('aria-valuenow'), '0');
    await undo.click(); await page.waitForFunction(() => document.querySelector('.cx-copy-title')?.textContent === '순천만 국가정원');
    await dialog.locator('.cx-cost-strip').click(); await expense.waitFor({ state: 'visible' });
    assert.match(await expense.locator('.cx-spend-donut').innerText(), /44,000원/);
    assert.deepEqual(await expense.locator('.cx-spend-category small').allTextContents(), ['73%', '27%']);
    assert.match(await expense.locator('.cx-spend-total-link').innerText(), /286,800원.*9건/s);
    assert.match(await expense.locator('.cx-spend-pretrip').innerText(), /195,600원/);
    assert(await expense.locator('canvas').evaluate(canvas => [...canvas.getContext('2d').getImageData(0,0,400,400).data].some((value,index) => index % 4 === 3 && value > 0)), 'Real category chart is drawn');
    await capture('spending-390');
    for (const width of [320, 390, 759, 760, 1440]) {
      await page.setViewportSize({ width, height: width < 760 ? 844 : 1024 }); await fits('#ttCostInfo');
      if (width !== 390) await capture(`spending-${width}`);
      await expense.locator('.tt-header [data-tt-action="close"]').click();
      await fits('#ttCompanion'); await fits('#ttTodayControls'); await capture(`today-${width}`);
      await dialog.locator('.cx-cost-strip').click(); await expense.waitFor({ state: 'visible' });
    }
    await expense.locator('[data-tt-action="expenses-open"]').last().click();
    await page.waitForFunction(() => activePage === 'budget'); assert.equal(await page.locator('#rdExpenseList tr').count(), 9);
    assert.equal(await page.evaluate(() => JSON.stringify({ entries: state.entries, items: state.itineraryItems })), untouched, 'Read-only chart and navigation preserve all records');
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => { state.tripName = '긴 여행 이름 '.repeat(15); state.itineraryItems[0].location = '아주 긴 주소 '.repeat(25); render(); });
    await open(); await fits('#ttCompanion .cx-today-context'); await capture('today-long-320');
    await dialog.locator('#ttDay').selectOption('2026-10-31'); await page.waitForFunction(() => document.querySelector('.cx-day-progress')?.getAttribute('aria-valuemax') === '1'); assert.equal(await progress.getAttribute('aria-valuetext'), '전체 0개 중 0개 완료');
    assert.match(await dialog.locator('.cx-finished').innerText(), /일정이 없어요/);
    await dialog.locator('#ttDay').selectOption('2026-11-01');
    await page.waitForFunction(() => document.querySelector('.cx-day-progress')?.getAttribute('aria-valuemax') === '5');
    await page.evaluate(async () => { state.entries.push({ id:'refund-case',date:'2026-11-01',category:'식비',description:'부분 환불',amount:-5000 }); await saveAndRender(); });
    await dialog.locator('.cx-cost-strip').click(); assert.match(await expense.locator('.cx-spend-donut').innerText(), /39,000원/);
    assert.match(await expense.locator('.cx-spend-refund').innerText(), /5,000원.*환불 전/);
    await expense.locator('.tt-header [data-tt-action="close"]').click();
    await page.evaluate(async () => { state.entries = state.entries.filter(entry => entry.date !== '2026-11-01' || entry.amount < 0); await saveAndRender(); });
    await dialog.locator('.cx-cost-strip').click(); assert.match(await expense.locator('.cx-spend-donut').innerText(), /-5,000원/); assert.equal(await expense.locator('.cx-spend-category').count(), 0);
    await expense.locator('.tt-header [data-tt-action="close"]').click();
    await page.evaluate(async () => { state.entries = state.entries.filter(entry => entry.date !== '2026-11-01'); await saveAndRender(); });
    await dialog.locator('.cx-cost-strip').click(); assert.match(await expense.locator('.cx-spend-donut').innerText(), /0원/); assert.doesNotMatch(await expense.innerText(), /NaN|undefined/); await capture('spending-empty-320');
    assert.deepEqual(errors, []);
    console.log('PASS Today refinement: shared identity, visual progress, back-style Undo/date alignment, Start here, lighter type, real category donut/totals, refund and empty states, immutable records, ledger navigation, long content and 320/390/759/760/1440px. ' + output);
  } catch (error) { throw error; }
  finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
