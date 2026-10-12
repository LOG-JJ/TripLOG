// Browser plugin not available. Isolated Playwright/Edge fixtures block all
// external services; production trips and their real budgets are never edited.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createReservationPocketPreview } = require('./preview-reservation-pockets');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || path.join(require('node:os').tmpdir(), 'TripLOG-Budget-Edit-20261012');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createReservationPocketPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    context.setDefaultTimeout(12000);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in' && state.collaboration?.ownerId);
    const dialog = page.locator('#rdBudgetEditor'), amount = page.locator('#rdBudgetAmount'), submit = page.locator('#rdBudgetSave');
    const current = () => page.evaluate(() => ({ budget: state.totalBudget, entries: state.entries, items: state.itineraryItems, name: state.tripName, start: state.startDate, end: state.endDate, settlement: state.settlement }));
    const open = async () => { await page.locator('#rdBudgetSummary [data-rd-action="budget-edit"]').click(); await dialog.waitFor({ state: 'visible' }); };
    const close = async () => { await dialog.locator('[data-rd-action="close"]').click(); await dialog.waitFor({ state: 'hidden' }); };
    const save = async value => { await amount.fill(value); await submit.click(); await dialog.waitFor({ state: 'hidden' }); };
    await page.goto(`${origin}/Travel?page=budget&trip=reservation-empty-fixture`); await ready();
    assert.equal(await page.title(), '여행 가계부'); assert.match(page.url(), /page=budget/);
    await page.evaluate(async () => {
      state.totalBudget = 100000;
      state.entries = [{ id: 'budget-meal', date: state.startDate, description: '저녁 식사', category: '식비', amount: 60000, payerKey: 'leader' }];
      await saveAndRender();
    });
    const before = await current();
    await open(); assert.equal(await amount.inputValue(), '100,000');
    await amount.fill('250000'); assert.equal(await amount.inputValue(), '250,000');
    await close(); assert.equal((await current()).budget, 100000, 'Cancel preserves budget');
    await open();
    for (const bad of ['', '-500', '12.5', '1e6', '9007199254740992']) {
      await amount.fill(bad); await submit.click();
      assert(await dialog.isVisible()); assert.match(await page.locator('#rdBudgetError').innerText(), /정수/);
      assert.equal((await current()).budget, 100000);
    }
    await amount.fill('300000');
    await page.evaluate(() => { window.__saveBudget = saveAndRender; saveAndRender = async () => false; });
    await submit.click(); assert.match(await page.locator('#rdBudgetError').innerText(), /저장하지 못했어요/);
    assert.equal((await current()).budget, 100000); assert.equal(await amount.inputValue(), '300,000');
    await page.evaluate(() => { saveAndRender = window.__saveBudget; });
    await submit.click(); await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual({ ...await current(), budget: before.budget }, before, 'Only the budget changes');
    assert.match(await page.locator('#rdBudgetSummary').innerText(), /240,000원/);
    assert.equal(await page.locator('#rdBudgetSummary progress').getAttribute('aria-valuetext'), '20% 사용');
    await page.reload(); await ready(); assert.equal((await current()).budget, 300000);
    assert.equal(await page.locator('#budgetInput').inputValue(), '300,000', 'Trip editor reflects the new budget');
    await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('overview'));
    assert.match(await page.locator('.rd-overview-budget').innerText(), /300,000원/);
    await page.locator('.rd-overview-budget [data-rd-action="budget-edit"]').click();
    assert.equal(await amount.inputValue(), '300,000'); await save('50000');
    assert.match(await page.locator('.rd-overview-budget').innerText(), /초과 금액 10,000원/);
    await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('report'));
    assert.match(await page.locator('#rdReportSummary').innerText(), /예산 50,000원 · 120% 사용/);
    await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('budget'));
    assert.match(await page.locator('#rdBudgetSummary').innerText(), /초과 지출/);
    await open(); await save('0'); assert.match(await page.locator('#rdBudgetSummary').innerText(), /예산 미설정/);
    assert.equal((await current()).entries.length, 1);
    await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('today'));
    await page.locator('#ttCompanion [data-tt-action="budget-settings"]').click();
    await dialog.waitFor({ state: 'visible' }); assert.equal(await amount.inputValue(), '0'); await save('500000');

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('#rdBudgetSummary').screenshot({ path: path.join(output, `budget-summary-${width}.png`), animations: 'disabled' });
      await open(); const box = await dialog.boundingBox();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= page.viewportSize().height + 1);
      assert(box.height < 450, 'A one-field budget edit stays compact');
      await dialog.screenshot({ path: path.join(output, `budget-editor-${width}.png`), animations: 'disabled' }); await close();
    }
    await open(); await amount.fill('700000');
    await page.evaluate(async () => { state.totalBudget = 650000; await saveAndRender(); });
    await submit.click(); assert.match(await page.locator('#rdBudgetError').innerText(), /다른 곳에서 예산이 변경/);
    assert.equal((await current()).budget, 650000); await close();

    // Keyboard entry, native Escape and opening after an unset budget.
    await open(); await amount.fill('750000'); await amount.press('Enter'); await dialog.waitFor({ state: 'hidden' });
    assert.equal((await current()).budget, 750000);
    await open(); await amount.fill('800000'); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal((await current()).budget, 750000);
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden');
    assert.notEqual(await page.evaluate(() => window.TripLog.persistence.stateStorage.getTrips().find(trip => trip.id === 'reservation-pockets-fixture').totalBudget), 750000, 'Other trip budgets remain independent');
    await page.evaluate(async () => { await window.TripLogSyncRepository.update(state.id, record => ({ ...record, role: 'viewer' })); render(); });
    assert(await page.locator('#rdBudgetSummary [data-rd-action="budget-edit"]').isDisabled());
    assert.deepEqual(errors, []);
    console.log(`PASS budget editing: current value/formatting, validation, cancel/Escape/save/reload, failed writes, budget-only changes, overview/report/remaining/over-budget/unset values, trip isolation, stale and viewer guards, 320/390/1440 layout. ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
