const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, fixtureToken, startServer, stopServer } = require('./helpers/browser-fixture');
// Isolated browser fixtures: route imagery is not fetched by automated tests.
// The visible local preview verifies real provider maps separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('transit-journey');
const fixture = {
  id: 'transit-journey-fixture', tripName: '교토 여행 · 디자인 확인', travelMode: 'overseas', city: '교토', country: '일본', countryCode: 'JP',
  startDate: '2026-09-25', endDate: '2026-09-25', entries: [], companions: [], packingList: [],
  itineraryItems: [
    { id: 'journey-hotel', date: '2026-09-25', place: 'Hotel Mondonce Kyoto Gojo', location: '228-1 Gojo, Kyoto, 600-8183, 일본', theme: 'lodging', time: '09:00', endTime: '10:00', createdAt: 1 },
    { id: 'journey-temple', date: '2026-09-25', place: '텐류지', location: '616-8385 Kyoto, Ukyo Ward, 일본', theme: 'sightseeing', time: '11:00', endTime: '12:00', createdAt: 2,
      transits: [
        { trans: 'bus', duration: 46, lineName: '시내버스', memo: '교토 시내버스 탑승 (Hotel → 가라스마)', cost: 0, ticketRef: 'preserve-unknown-field' },
        { trans: 'walk', duration: 5, fromPlace: '가라스마', memo: '', cost: 0 },
        { trans: 'train', duration: 55, fromPlace: '가라스마', lineName: '한큐 전철', memo: '가라스마 → 아라시야마', cost: 0 },
        { trans: 'walk', duration: 14, fromPlace: '아라시야마', memo: '역에서 텐류지까지 도보', cost: 0 },
      ] },
  ],
};

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1536, height: 1050 }, deviceScaleFactor: 1 });
  context.setDefaultTimeout(12000);
  const user = { id: '00000000-0000-4000-8000-000000000099', email: 'journey@example.test', user_metadata: { display_name: '디자인 확인' } };
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const token = fixtureToken(user, expiry);
  await context.addInitScript(({ origin, fixture, user, expiry, token }) => {
    if (location.origin !== origin || localStorage.getItem('journey-seed')) return;
    localStorage.setItem('journey-seed', '1');
    localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_at: expiry, expires_in: 3600, user }));
    localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([fixture]));
    localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', fixture.id);
  }, { origin, fixture, user, expiry, token });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'www.google.com' && route.request().resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: '<title>Isolated map fixture</title>' });
    return route.abort();
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && document.documentElement.dataset.appReady === 'true');
  const dialog = page.locator('#itineraryTransitDialog');
  const open = async () => {
    await page.locator('[data-transit-open][data-id="journey-temple"]').click();
    await dialog.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
  };
  const close = () => dialog.locator('[data-transit-cancel]').first().click();
  const rows = () => dialog.locator('.transit-segment');
  const duration = index => rows().nth(index).locator('[data-transit-field="duration"]');
  const saved = () => page.evaluate(() => JSON.parse(JSON.stringify(state.itineraryItems.find(item => item.id === 'journey-temple'))));
  const capture = name => dialog.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
  try {
    await page.goto(`${origin}/Travel?page=itinerary`); await ready();
    assert.equal(await page.title(), '여행 가계부');
    await open();
    const mapSize = await page.locator('.transit-map-stage').evaluate(node => ({ stage: node.getBoundingClientRect().width, map: document.querySelector('#itineraryTransitMapArea').getBoundingClientRect().width, height: document.querySelector('#itineraryTransitMap').getBoundingClientRect().height }));
    assert(Math.abs(mapSize.map / mapSize.stage - 1) < .01, 'Map fills the content width with controls inside it');
    assert.equal(mapSize.height, 192, 'Desktop map height is reduced by another 20%');
    assert.equal(await page.locator('[data-transit-map-stop]').count(), 0, 'Keep origin-to-destination directions, not separate place previews');
    const firstRoute = new URL(await page.locator('#itineraryTransitMap iframe').getAttribute('src'));
    assert(firstRoute.searchParams.get('saddr') && firstRoute.searchParams.get('daddr'));
    await page.locator('[data-transit-map-mode="walking"]').click();
    assert.equal(new URL(await page.locator('#itineraryTransitMap iframe:not([hidden])').getAttribute('src')).searchParams.get('dirflg'), 'w');
    await page.locator('[data-transit-map-mode="transit"]').click();
    assert.equal(new URL(await page.locator('#itineraryTransitMap iframe:not([hidden])').getAttribute('src')).searchParams.get('dirflg'), 'r');
    assert.equal(await dialog.locator('.transit-journey-leg').count(), 4);
    assert.deepEqual(await dialog.locator('.transit-journey-stop time').allTextContents(), ['09:00', '09:46', '09:51', '10:46', '11:00']);
    assert.equal(await page.locator('#itineraryTransitTotal').innerText(), '2시간 0분');
    assert.equal(await page.locator('#itineraryTransitArrival').innerText(), '11:00');
    await page.locator('#itineraryTransitManualTab').click();
    await capture('manual-desktop-initial');
    const original = await saved();
    assert.equal(await rows().nth(2).locator('.custom-select-value').innerText(), '기차');
    await rows().nth(0).getByRole('button', { name: '이동 구간 1 초록', exact: true }).click();
    assert.equal(await rows().nth(0).getByRole('button', { name: '이동 구간 1 초록', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await rows().nth(0).evaluate(node => node.style.getPropertyValue('--leg-color')), '#248452');
    for (const swatch of await rows().nth(2).locator('[data-transit-color]').all()) {
      await swatch.click();
      assert.equal(await swatch.getAttribute('aria-pressed'), 'true', 'Every color swatch must be reachable, including beside the row options');
    }
    // Editing a leg updates every following clock and the map-tab timeline without saving.
    await duration(0).fill('30');
    assert.equal(await page.locator('#itineraryTransitEndTime').innerText(), '10:44');
    await rows().nth(1).locator('[data-transit-field="fromPlace"]').fill('四条駅 <script>');
    await rows().nth(2).locator('.transit-segment-menu summary').click();
    await rows().nth(2).locator('[data-transit-field="lineName"]').fill('阪急京都線');
    await rows().nth(2).locator('[data-transit-field="lineName"]').press('Escape');
    assert(await dialog.isVisible(), 'Escape closes only the row options');
    await page.locator('#itineraryTransitRouteTab').click();
    assert.equal(await dialog.locator('.transit-journey-leg').first().evaluate(node => node.style.getPropertyValue('--leg-color')), '#248452');
    assert.match(await page.locator('#itineraryTransitJourney').innerText(), /四条駅 <script>/);
    assert.equal(await page.locator('#itineraryTransitJourney script').count(), 0);
    assert.deepEqual(await dialog.locator('.transit-journey-stop time').allTextContents(), ['09:00', '09:30', '09:35', '10:30', '10:44']);
    await dialog.locator('[data-transit-edit]').nth(2).click();
    assert.equal(await page.locator('#itineraryTransitManualTab').getAttribute('aria-selected'), 'true');
    await page.locator('#itineraryTransitSave').click(); await dialog.waitFor({ state: 'hidden' });
    const updated = await saved();
    assert.equal(updated.time, original.time); assert.equal(updated.endTime, original.endTime);
    assert.equal(updated.transits[0].ticketRef, 'preserve-unknown-field');
    assert.equal(updated.transits[0].color, '#248452');
    assert.equal(updated.transits[1].fromPlace, '四条駅 <script>');
    assert.equal(updated.transits[2].lineName, '阪急京都線');
    assert.equal(updated.duration, 104);
    await page.reload(); await ready(); await open();
    assert.equal(await page.locator('#itineraryTransitArrival').innerText(), '10:44');
    await page.locator('#itineraryTransitManualTab').click();
    assert.equal(await rows().nth(0).getByRole('button', { name: '이동 구간 1 초록', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await rows().nth(1).locator('[data-transit-field="fromPlace"]').inputValue(), '四条駅 <script>');
    // Cancel does not persist additions, removal, memo or duration edits.
    const beforeCancel = await saved();
    await rows().nth(0).getByRole('button', { name: '이동 구간 1 빨강', exact: true }).click();
    await page.locator('#itineraryTransitAdd').click();
    assert.equal(await rows().count(), 5);
    assert.equal(await page.locator('#itineraryTransitArrival').innerText(), '—');
    await rows().last().locator('.transit-segment-menu summary').click();
    await rows().last().locator('[data-transit-remove]').click();
    assert.equal(await rows().count(), 4);
    await duration(0).fill('oops');
    await page.locator('#itineraryTransitSave').click();
    assert.equal(await duration(0).getAttribute('aria-invalid'), 'true');
    await close(); assert.deepEqual(await saved(), beforeCancel);
    // Missing and overnight times do not manufacture a scheduled arrival.
    await page.evaluate(() => { state.itineraryItems[0].time = '23:50'; state.itineraryItems[1].time = ''; render(); });
    await open(); assert.equal(await page.locator('#itineraryTransitArrival').innerText(), '+1일 01:34'); await close();
    await page.evaluate(() => { state.itineraryItems[0].time = ''; render(); });
    await open(); assert.equal(await page.locator('#itineraryTransitArrival').innerText(), '—'); await close();
    // Use the same source content for the visual comparison and responsive checks.
    await page.evaluate(fixture => { state.itineraryItems = fixture.itineraryItems; render(); }, fixture);
    await open(); await page.locator('#itineraryTransitManualTab').click();
    for (const width of [1536, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1050 });
      await dialog.locator('.transit-editor-scroll').evaluate(node => { node.scrollTop = 0; });
      await capture(`manual-${width}`);
      await page.locator('#itineraryTransitRoute').screenshot({ path: path.join(output, `route-summary-${width}.png`), animations: 'disabled' });
      await page.locator('.transit-estimate').screenshot({ path: path.join(output, `estimate-${width}.png`), animations: 'disabled' });
      const bounds = await dialog.boundingBox(), viewport = page.viewportSize();
      assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, JSON.stringify(bounds));
      const overflow = await dialog.locator('.transit-editor-scroll').evaluate(node => node.scrollWidth > node.clientWidth + 1);
      assert.equal(overflow, false, `No horizontal overflow at ${width}`);
      const saveBox = await page.locator('#itineraryTransitSave').boundingBox();
      assert(saveBox.y + saveBox.height <= viewport.height, 'Save stays visible while the timeline scrolls');
      if (width < 600) {
        if (width === 390) assert(bounds.height <= 725, 'Four edited legs should fit in a compact mobile sheet');
        await duration(3).fill('20');
        assert.equal(await page.locator('#itineraryTransitArrival').innerText(), '11:06');
        assert.match(await page.locator('#itineraryTransitTiming').innerText(), /6분 늦게/);
        await duration(3).fill('14');
      }
      await page.locator('#itineraryTransitRouteTab').click();
      await capture(`route-${width}`);
      const mapBox = await page.locator('.transit-map-stage').boundingBox();
      for (const control of ['#itineraryTransitModes', '#itineraryTransitMapLink']) {
        const controlBox = await page.locator(control).boundingBox();
        assert(controlBox.x >= mapBox.x && controlBox.y >= mapBox.y && controlBox.x + controlBox.width <= mapBox.x + mapBox.width + 1 && controlBox.y + controlBox.height <= mapBox.y + mapBox.height + 1, `Map controls stay inside the map at ${width}`);
      }
      if (width < 600) {
        assert.equal(await page.locator('#itineraryTransitMap').evaluate(node => node.getBoundingClientRect().height), 160);
        assert((await page.locator('#itineraryTransitGoogleLink').boundingBox()).width <= 32, 'External map action is an icon-sized button');
      }
      await page.locator('#itineraryTransitManualTab').click();
    }
    await page.setViewportSize({ width: 1536, height: 1050 });
    await dialog.locator('.transit-editor-scroll').evaluate(node => { node.scrollTop = 0; });
    await capture('manual-desktop');
    // A mobile map-icon round trip preserves unsaved edits, including the new color.
    await close(); await page.evaluate(() => saveAndRender()); await page.reload(); await ready();
    const navigationSource = await saved();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await open(); await page.locator('#itineraryTransitManualTab').click();
    await duration(0).fill('61');
    await rows().first().getByRole('button', { name: '이동 구간 1 초록', exact: true }).click();
    await page.locator('#itineraryTransitRouteTab').click();
    assert.equal(await page.locator('#itineraryTransitMapLink').getAttribute('target'), '_self');
    await Promise.all([page.waitForURL('https://www.google.com/maps/dir/**'), page.locator('#itineraryTransitMapLink').click()]);
    await page.goBack(); await ready(); await dialog.waitFor({ state: 'visible' });
    await page.locator('#itineraryTransitManualTab').click();
    assert.equal(await duration(0).inputValue(), '61');
    assert.equal(await rows().first().getByRole('button', { name: '이동 구간 1 초록', exact: true }).getAttribute('aria-pressed'), 'true');
    await close(); assert.deepEqual(await saved(), navigationSource);
    // A normal sync encode/decode changes object key order and internal positions,
    // but must not invalidate an otherwise unchanged manual train draft.
    await page.evaluate(() => { state.itineraryItems.forEach(item => { delete item._syncPosition; }); render(); });
    await open(); await page.locator('#itineraryTransitManualTab').click();
    await rows().first().locator('.custom-select-button').click();
    await rows().first().locator('.custom-select-option[data-value="train"]').click();
    await duration(0).fill('31');
    const syncEquality = await page.evaluate(() => {
      const strip = list => list.map(({ _syncPosition, ...item }) => item);
      const before = strip(state.itineraryItems);
      const decoded = TripLogSyncModel.decode(TripLogSyncModel.encode(state), state);
      state.itineraryItems = decoded.itineraryItems; state.entries = decoded.entries;
      render(); return TripLogSyncModel.equal(before, strip(state.itineraryItems));
    });
    assert(syncEquality, 'Sync round trip preserves all actual itinerary fields');
    await page.locator('#itineraryTransitSave').click();
    await page.waitForFunction(() => !document.querySelector('#itineraryTransitDialog').open || !document.querySelector('#itineraryTransitError').hidden);
    assert(await page.locator('#itineraryTransitError').isHidden(), `Unchanged train save rejected: ${await page.locator('#itineraryTransitError').textContent()}`);
    await dialog.waitFor({ state: 'hidden' });
    assert.equal((await saved()).transits[0].trans, 'train');
    assert.equal((await saved()).transits[0].duration, 31);
    await page.reload(); await ready();
    assert.equal((await saved()).transits[0].trans, 'train');
    assert.equal((await saved()).transits[0].duration, 31);
    // Real schedule, route and linked-expense edits still require a fresh draft.
    const conflictBase = await page.evaluate(() => JSON.parse(JSON.stringify({ items: state.itineraryItems, entries: state.entries })));
    for (const kind of ['destination', 'transit', 'previous', 'neighbor', 'expense']) {
      await page.evaluate(({ base, kind }) => {
        state.itineraryItems = base.items; state.entries = base.entries;
        if (kind === 'expense') {
          state.itineraryItems.find(item => item.id === 'journey-temple').expenseId = 'transit-conflict-expense';
          state.entries.push({ id: 'transit-conflict-expense', date: state.startDate, amount: 1000, category: '교통', description: '연결 지출' });
        }
        render();
      }, { base: conflictBase, kind });
      await open(); await page.locator('#itineraryTransitManualTab').click(); await duration(0).fill('45');
      const concurrent = await page.evaluate(kind => {
        if (kind === 'destination') state.itineraryItems.find(item => item.id === 'journey-temple').time = '13:00';
        if (kind === 'transit') state.itineraryItems.find(item => item.id === 'journey-temple').transits[0].memo = '다른 곳에서 수정한 이동';
        if (kind === 'previous') state.itineraryItems.find(item => item.id === 'journey-hotel').place = '다른 출발지';
        if (kind === 'neighbor') state.itineraryItems.push({ id: 'new-neighbor', date: state.startDate, time: '10:30', place: '추가된 경유지', theme: 'sightseeing' });
        if (kind === 'expense') state.entries.find(entry => entry.id === 'transit-conflict-expense').amount = 2500;
        return JSON.stringify({ items: state.itineraryItems, entries: state.entries });
      }, kind);
      await page.locator('#itineraryTransitSave').click();
      assert(await page.locator('#itineraryTransitError').isVisible(), `${kind} conflict is retained`);
      assert.equal(await page.evaluate(() => JSON.stringify({ items: state.itineraryItems, entries: state.entries })), concurrent, 'A conflicting draft never overwrites the current data');
      await close();
    }
    assert.deepEqual(errors, []);
    console.log(`PASS compact journey: train save after an unchanged sync round trip, schedule/transit/origin/neighbor/expense conflicts preserved, color edit/save/reload/cancel, full-width map with internal controls and 192/160px height, intact transit/walking directions, cumulative times, transfer/line fields, tab continuity, edit shortcuts, unknown-field preservation, invalid/overnight/missing times, 1536/768/390/320 layout. Screenshots: ${output}`);
  } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error; }
  finally { await browser.close(); await stopServer(server); }
}
module.exports = { fixture };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
