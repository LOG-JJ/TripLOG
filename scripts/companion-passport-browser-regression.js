const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, startServer, stopServer, waitForApp } = require('./helpers/browser-fixture');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = require('./fixtures/companion-passport');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('companion-passport');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, acceptDownloads: true });
  context.setDefaultTimeout(10000);
  const user = { id: '00000000-0000-4000-8000-000000000099', email: 'passport@example.test', user_metadata: { display_name: '디자인 확인' } };
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const token = fixtureToken(user, expiry);
  await context.addInitScript(({ origin, fixture, user, expiry, token }) => {
    if (location.origin !== origin || localStorage.getItem('passport-seed')) return;
    localStorage.setItem('passport-seed', '1');
    localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_at: expiry, expires_in: 3600, user }));
    localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([fixture]));
    localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', fixture.id);
  }, { origin, fixture, user, expiry, token });
  await blockExternalRequests(context, origin);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && document.querySelector('#ttCompanion'));
  const dialog = page.locator('#ttCompanion');
  const open = async tab => { await page.evaluate(tab => window.TripLog.features.travelCompanion.workspace.open(tab), tab); await dialog.waitFor({ state: 'visible' }); await dialog.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {})))); };
  const tab = key => dialog.locator(`#ttNav [data-tab="${key}"]`).click();
  const saved = () => page.evaluate(() => JSON.parse(JSON.stringify(state)));
  const capture = name => dialog.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
  const fits = async () => {
    const sizes = await dialog.evaluate(node => {
      const scroll = node.querySelector('.tt-scroll'), nav = node.querySelector('#ttNav').getBoundingClientRect();
      return { scroll: scroll.scrollWidth, client: scroll.clientWidth, bottom: nav.bottom, viewport: innerHeight };
    });
    assert(sizes.scroll <= sizes.client + 1, 'No horizontal content overflow');
    assert(sizes.bottom <= sizes.viewport + 1, 'Bottom navigation remains reachable');
  };
  try {
    await page.goto(`${origin}/Travel?page=overview&trip=${fixture.id}`); await waitForApp(page); await ready(); await open('today');
    // Inspect the fixture's populated day even when the real calendar has advanced.
    await dialog.locator(`[data-date="${fixture.startDate}"]`).click();
    assert.deepEqual(await dialog.evaluate(node => ({ left: node.scrollLeft, top: node.querySelector('.tt-scroll').scrollTop })), { left: 0, top: 0 }, 'Selecting a visible day keeps the complete header and dialog position');
    await dialog.locator('.tt-scroll').evaluate(node => { node.scrollTop = 35; });
    await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.render());
    assert.equal(await dialog.locator('.tt-scroll').evaluate(node => node.scrollTop), 35, 'Rerender preserves the reader position');
    await dialog.locator('.tt-scroll').evaluate(node => { node.scrollTop = 0; });
    assert.equal(await dialog.locator('.pp-place-title').innerText(), '경복궁');
    assert.equal(await dialog.locator('.pp-pass-caption b').innerText(), '03 / 06');
    assert.equal(new URL(await dialog.locator('#ttPrimary a').getAttribute('href')).hostname, 'map.naver.com');
    await capture('today-mobile');
    await dialog.getByRole('button', { name: '경복궁 완료하기', exact: true }).click();
    await page.waitForFunction(() => state.travelCompanion.completedItineraryIds.includes('palace'));
    assert.equal(await dialog.locator('.pp-place-title').innerText(), '북촌 한옥마을');
    await dialog.getByRole('button', { name: '경복궁 완료 취소', exact: true }).click();
    await page.waitForFunction(() => !state.travelCompanion.completedItineraryIds.includes('palace'));
    await dialog.locator('[data-pp-fold="completed"] summary').click();
    await tab('tools'); await tab('today');
    assert.equal(await dialog.locator('[data-pp-fold="completed"]').getAttribute('open'), null, 'Fold state survives tabs');
    await dialog.locator('[data-pp-fold="completed"] summary').click();
    await tab('review');
    const before = (await saved()).itineraryItems;
    assert.match(await dialog.locator('[data-review-id="palace"] .pp-review-proposed').innerText(), /10:35/);
    assert.match(await dialog.locator('[data-review-id="village"] .pp-review-proposed').innerText(), /12:05/);
    assert.equal(await dialog.locator('[data-id="river"][data-tt-action="lock"]').getAttribute('aria-pressed'), 'true');
    await capture('review-mobile');
    assert.deepEqual((await saved()).itineraryItems, before, 'Reading the proposal does not change times');
    await dialog.locator('[data-id="river"][data-tt-action="lock"]').click();
    await page.waitForFunction(() => !state.travelCompanion.lockedItineraryIds.includes('river'));
    await dialog.locator('[data-id="river"][data-tt-action="lock"]').click();
    await page.waitForFunction(() => state.travelCompanion.lockedItineraryIds.includes('river'));
    await dialog.getByRole('button', { name: '조정안 확인' }).click();
    assert.equal(await page.locator('#ttApply').isEnabled(), true);
    await page.locator('#ttApply').click();
    await page.locator('#ttAdjustment').waitFor({ state: 'hidden' });
    const changed = (await saved()).itineraryItems;
    assert.equal(changed.find(row => row.id === 'palace').time, '10:35');
    for (const id of ['station', 'cafe', 'river']) assert.deepEqual(changed.find(row => row.id === id), before.find(row => row.id === id), 'Completed / locked times are preserved');
    await dialog.locator('[data-tt-action="undo"]').click();
    await page.waitForFunction(() => state.itineraryItems.find(row => row.id === 'palace').time === '10:20');
    assert.deepEqual((await saved()).itineraryItems, before);
    await dialog.locator('[data-tt-action="transit-edit"][data-id="palace"]').click();
    await page.locator('#itineraryTransitDialog[open]').waitFor();
    assert.match(await page.locator('#itineraryTransitDialog').innerText(), /경복궁/);
    await page.locator('#itineraryTransitDialog [data-transit-cancel]').first().click();
    await open('tools'); await capture('tools-mobile');
    await dialog.locator('[data-tt-packing="p4"]').check();
    await page.waitForFunction(() => state.packingList.find(row => row.id === 'p4').checked);
    await page.reload(); await ready(); await open('tools');
    assert(await dialog.locator('[data-tt-packing="p4"]').isChecked(), 'Packing persists across reload');
    await dialog.locator('[data-tt-packing="p4"]').uncheck();
    await page.waitForFunction(() => !state.packingList.find(row => row.id === 'p4').checked);
    // A failed local save must restore the checkbox and trip data, not leave a false success.
    await page.evaluate(() => { window.passportRealSave = saveAndRender; saveAndRender = async () => false; });
    try {
      await dialog.locator('[data-tt-packing="p4"]').click();
      await page.waitForFunction(() => !state.packingList.find(row => row.id === 'p4').checked && !document.querySelector('[data-tt-packing="p4"]').disabled);
      assert.equal(await dialog.locator('[data-tt-packing="p4"]').isChecked(), false);
    } finally { await page.evaluate(() => { saveAndRender = window.passportRealSave; delete window.passportRealSave; }); }
    await dialog.locator('[data-tt-option="references"]').uncheck();
    await dialog.locator('[data-tt-option="costs"]').check();
    await tab('today'); await tab('tools');
    assert.equal(await dialog.locator('[data-tt-option="references"]').isChecked(), false);
    const pocketPromise = page.waitForEvent('download');
    await dialog.locator('[data-tt-action="pocket"]').click();
    const pocket = await pocketPromise, html = fs.readFileSync(await pocket.path(), 'utf8');
    assert.match(html, /경복궁/); assert.match(html, /여행 경비/); assert.doesNotMatch(html, /여행 예산|REF-PRIVATE-123/);
    const calendarPromise = page.waitForEvent('download');
    await dialog.locator('[data-tt-action="calendar"]').click();
    const calendar = await calendarPromise, ics = fs.readFileSync(await calendar.path(), 'utf8');
    assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /DTSTART:20260922T012000Z/);
    assert.equal(await dialog.locator('#ttExportHelp').isVisible(), true);
    await dialog.locator('#ttTimeZone').selectOption('Asia/Tokyo');
    await page.waitForFunction(() => state.travelCompanion.timeZone === 'Asia/Tokyo');
    await tab('wallet');
    assert.match(await dialog.locator('#ttWalletList').innerText(), /미술관 예약/);
    await tab('tools');
    assert.equal(await dialog.locator('[data-select-id="ttTimeZone"] .custom-select-button').getAttribute('aria-label'), '일정 시간대');
    await dialog.locator('#ttTimeZone').selectOption('Asia/Seoul');
    await page.waitForFunction(() => state.travelCompanion.timeZone === 'Asia/Seoul');
    await dialog.locator('[data-tt-option="references"]').check();
    await dialog.locator('[data-tt-option="costs"]').uncheck();
    // Wait for the live status toast to clear before visual baselines.
    await page.locator('.toss-toast.show').waitFor({ state: 'hidden' });
    await tab('today');
    await dialog.locator('[data-date="2026-09-23"]').click();
    assert.match(await dialog.locator('#ttContent').innerText(), /아직 일정이 없어요/);
    await dialog.locator('[data-date="2026-09-22"]').click();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1050 : 844 });
      for (const key of ['today', 'review', 'tools']) {
        await tab(key); await fits();
        await page.waitForFunction(()=>[...document.querySelectorAll('#ttCompanion img')].every(img=>img.complete&&img.naturalWidth>0));
        assert.equal(await dialog.locator('img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), true);
        await capture(`${key}-${width}`);
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    for (const key of ['today', 'review', 'tools']) { await tab(key); await fits(); await capture(`${key}-reference`); }
    // Missing times, large names, empty packing and a legacy budget use real render paths.
    await page.evaluate(() => { state.itineraryItems.find(row => row.id === 'palace').place = '매우 긴 장소 이름 '.repeat(12); state.itineraryItems.find(row => row.id === 'palace').time = ''; state.totalBudget = 3000; state.packingList = []; window.TripLog.features.travelCompanion.workspace.render(); });
    await page.setViewportSize({ width: 320, height: 680 }); await tab('today'); await fits();
    assert.match(await dialog.locator('.pp-cost-strip').innerText(), /이날 여행 경비/);
    assert.doesNotMatch(await dialog.locator('.pp-cost-strip').innerText(), /예산|초과/);
    await tab('review'); await fits();
    assert.match(await dialog.locator('.pp-review-status').innerText(), /먼저 확인/);
    await dialog.getByRole('button', { name: '조정안 확인' }).click();
    assert.equal(await page.locator('#ttApply').isEnabled(), false);
    await page.locator('#ttAdjustment [data-tt-action="close"]').first().click();
    await tab('tools'); await fits(); assert.match(await dialog.locator('.pp-packing').innerText(), /준비물 추가/);
    assert.deepEqual(errors, [], 'No uncaught browser exceptions');
    console.log(`Companion passport browser regression passed. Screenshots: ${output}`);
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
