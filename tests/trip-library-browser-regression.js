const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, startServer, stopServer } = require('./helpers/browser-fixture');
// Browser plugin unavailable: repository Playwright/Edge fixtures; every external
// request is blocked. Live visual QA is additionally performed in the in-app browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('./fixtures/trip-library');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('trip-library');
const fixedDate = new Date('2026-10-03T09:00:00+09:00');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' }); context.setDefaultTimeout(15000);
    const user = { id: '00000000-0000-4000-8000-000000000098', email: 'library@example.test', user_metadata: { display_name: '여행 보관함 시험' } };
    const expiry = Math.floor(fixedDate.getTime() / 1000) + 86400;
    const token = fixtureToken(user, expiry);
    await context.addInitScript(({ origin, fixtures, user, expiry, token }) => {
      if (location.origin !== origin || localStorage.getItem('trip-library-fixture')) return;
      localStorage.setItem('trip-library-fixture', '1');
      localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_at: expiry, expires_in: 86400, user }));
      localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify(fixtures));
      localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', 'library-osaka');
    }, { origin, fixtures, user, expiry, token });
    await blockExternalRequests(context, origin);
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(fixedDate);
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in' && document.querySelector('#entrySplash')?.hidden !== false);
    const home = async () => { await page.locator('.rd-brand-link').click(); await page.waitForFunction(() => activePage === 'start'); };
    const cards = page.locator('[data-library-trip]');
    const snapshot = () => page.evaluate(() => window.TripLog.persistence.stateStorage.getTrips().map(t => ({ id: t.id, name: t.tripName, items: t.itineraryItems.map(i => [i.id, i.place, i.time]), entries: t.entries.map(e => [e.id, e.amount, e.description]) })).sort((a, b) => a.id.localeCompare(b.id)));
    await page.goto(origin + '/Travel?page=overview'); await ready();
    await page.waitForFunction(() => document.querySelectorAll('[data-library-trip]').length === 3);
    assert.equal(new URL(page.url()).searchParams.get('page'), 'start', 'Old home bookmark opens the collection');
    assert.equal(await page.locator('.rd-nav').isVisible(), false, 'No trip navigation before selecting a passport');
    assert.equal(await page.locator('[data-library-trip].selected,[data-library-trip][aria-pressed="true"]').count(), 0, 'A cached active trip is not visually selected');
    assert.match(await page.locator('[data-library-trip="library-gangneung"]').innerText(), /D-14/);
    const before = await snapshot();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.querySelectorAll('.tl-passport img')].every(image => image.complete && image.naturalWidth > 0));
    for (const width of [390, 320, 768, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      await page.evaluate(() => Promise.all([...document.querySelectorAll('.tl-passport-art')].map(image => image.decode())));
      await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true, animations: 'disabled' });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}`);
      const grid = await page.locator('#rdTripList').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(grid, width >= 960 ? 4 : width >= 600 ? 3 : 2);
    }
    console.log('PASS library: legacy home enters unselected passports, correct dates/counts, real artwork and responsive 320/390/768/1440 grid');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#tripLibrarySearch').fill('오 사 카'); assert.equal(await cards.count(), 1);
    await page.locator('#tripLibrarySearchClear').click(); assert.equal(await cards.count(), 3);
    await page.locator('[data-library-filter="upcoming"]').click(); assert.equal(await cards.count(), 1);
    await page.locator('[data-library-filter="past"]').click(); assert.equal(await cards.count(), 2);
    await page.locator('#tripLibrarySearch').fill('없는여행'); assert.equal(await cards.count(), 0); assert(await page.locator('#tripLibraryEmpty').isVisible());
    await page.locator('[data-library-reset]').click(); assert.equal(await cards.count(), 3);
    await page.evaluate(async () => {
      await window.TripLogSyncRepository.update('library-jeju', record => ({ ...record, snapshot: { ...record.snapshot, tripName: '다른 기기에서 바꾼 제주 여행' } }));
    });
    await page.getByRole('button', { name: '다른 기기에서 바꾼 제주 여행 여행 열기', exact: true }).waitFor();
    await page.evaluate(async () => {
      await window.TripLogSyncRepository.update('library-jeju', record => ({ ...record, snapshot: { ...record.snapshot, tripName: '제주도 7박 8일' } }));
    });
    await page.getByRole('button', { name: '제주도 7박 8일 여행 열기', exact: true }).waitFor();
    await page.locator('.tl-library-profile').click(); await page.locator('#rdProfile').waitFor({ state: 'visible' });
    await page.locator('#rdProfile [data-rd-action="close"]').click();
    await page.waitForFunction(() => document.activeElement.matches('.tl-library-profile'));
    await page.locator('.tl-library-profile').click();
    assert(await page.evaluate(async () => {
      const dialog = document.querySelector('#rdProfile'), card = document.querySelector('[data-library-trip="library-jeju"]');
      const closed = new Promise(resolve => dialog.addEventListener('close', resolve, { once: true }));
      dialog.close();
      card.focus();
      await closed;
      return document.activeElement === card;
    }), 'A delayed dialog close event must preserve focus moved to the next action');
    await page.locator('[data-library-trip="library-jeju"]').press('Enter');
    await page.waitForFunction(() => activePage === 'overview' && state.id === 'library-jeju');
    assert.equal(new URL(page.url()).searchParams.get('trip'), 'library-jeju');
    assert(await page.locator('.rd-nav').isVisible());
    await page.reload(); await ready(); await page.waitForFunction(() => state.id === 'library-jeju' && activePage === 'overview');
    await page.goBack(); await page.waitForFunction(() => activePage === 'start');
    await page.goForward(); await page.waitForFunction(() => activePage === 'overview' && state.id === 'library-jeju');
    await home();
    await page.locator('[data-library-trip="library-osaka"]').click(); await page.waitForFunction(() => activePage === 'overview' && state.id === 'library-osaka');
    await page.goBack(); await page.waitForFunction(() => activePage === 'start');
    assert.deepEqual(await snapshot(), before, 'Selection/search/filter/back/reload preserve every expense and itinerary');
    console.log('PASS library: search/filter/empty/profile, keyboard selection, explicit trip URL, reload and browser back/forward preserve trip data');
    await page.locator('#rdTripCreate').click(); await page.locator('#newTripModal').waitFor({ state: 'visible' });
    await page.locator('#newTripCloseButton').click(); assert.equal(await cards.count(), 3);
    await page.locator('#rdTripCreate').click();
    await page.locator('#newTripNameInput').fill('새 여권 생성 검증');
    await page.locator('#newTripModeToggle [data-mode="domestic"]').click();
    await page.locator('#newTripCityInput').fill('서울');
    await page.evaluate(() => {
      const storage = window.TripLog.persistence.stateStorage, create = storage.createNewTrip;
      window.__createCalls = 0;
      storage.createNewTrip = async (...args) => { window.__createCalls++; await new Promise(resolve => { window.__releaseCreate = resolve; }); return create(...args); };
    });
    await page.locator('#newTripForm button[type="submit"]').click();
    await page.waitForFunction(() => Boolean(window.__releaseCreate));
    assert.equal(await page.locator('#newTripForm button[type="submit"]').isDisabled(), true);
    await page.evaluate(() => { document.querySelector('#newTripForm').requestSubmit(); window.__releaseCreate(); });
    await page.waitForFunction(() => activePage === 'overview' && state.tripName === '새 여권 생성 검증');
    assert.equal(await page.evaluate(() => window.__createCalls), 1, 'A repeated submit during storage latency must not duplicate the trip');
    const newId = await page.evaluate(() => state.id);
    await home(); assert.equal(await cards.count(), 4);
    assert.match(await page.locator('[data-library-filter="ongoing"]').innerText(), /ON THE GO\s*1/);
    assert.equal((await snapshot()).filter(t => t.id !== newId).length, 3);
    console.log('PASS library: cancel preserves the collection; create opens the new trip and adds exactly one passport');
    await page.locator(`[data-library-trip="${newId}"]`).click();
    await page.locator('#rdMenuButton').click();
    await page.locator('[data-rd-action="trip-edit-current"]').click();
    await page.locator('.rd-trip-edit').waitFor({ state: 'visible' });
    await page.locator('#tripNameInput').fill('취소할 수정');
    await page.locator('[data-rd-action="trip-cancel"]').click();
    assert(await page.locator('.tl-library').isVisible(), 'Cancel returns to the passport collection');
    assert.match(await page.locator(`[data-library-trip="${newId}"]`).innerText(), /새 여권 생성 검증/);
    await page.locator(`[data-library-trip="${newId}"]`).click(); await page.locator('#rdMenuButton').click(); await page.locator('[data-rd-action="trip-edit-current"]').click();
    await page.locator('.rd-trip-edit').waitFor({ state: 'visible' });
    await page.locator('#tripNameInput').fill('수정한 여행 여권'); await page.locator('#rdTripSave').click();
    await page.getByRole('button', { name: '수정한 여행 여권 여행 열기', exact: true }).waitFor();
    console.log('PASS library: repository updates refresh other passports; trip editing/cancel/save remains reachable');
    await page.goto(origin + '/Travel?page=overview&trip=missing-fixture'); await ready();
    await page.waitForFunction(() => activePage === 'start');
    assert.equal(await cards.count(), 4, 'Unavailable deep links return to the account collection');
    await page.goto(origin + '/Travel?page=budget&trip=library-osaka'); await ready();
    await page.waitForFunction(() => activePage === 'budget' && state.id === 'library-osaka');
    await page.goto(origin + '/Travel'); await ready(); await page.waitForFunction(() => activePage === 'start');
    assert.equal(await page.locator('#rdOverview').isVisible(), false);
    await page.evaluate(async id => {
      await window.TripLogSyncRepository.update(id, record => ({ ...record, snapshot: { ...record.snapshot,
        tripName: '가족과 친구 모두 함께 떠나는 아주 긴 이름의 프랑스 겨울 여행', city: '파리', country: '프랑스', countryCode: 'FR', travelMode: 'overseas', startDate: '', endDate: '',
      } }));
    }, newId);
    const longTrip = page.locator(`[data-library-trip="${newId}"]`);
    await page.waitForFunction(id => document.querySelector(`[data-library-trip="${id}"]`)?.textContent.includes('PLANNING'), newId);
    assert.match(await longTrip.locator('.tl-passport-art').getAttribute('src'), /generic/);
    await page.setViewportSize({ width: 320, height: 844 });
    assert(await longTrip.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Long titles and unspecified dates stay inside the passport');
    await page.screenshot({ path: path.join(output, 'home-long-title-320.png'), fullPage: true });
    assert.deepEqual(await page.evaluate(() => {
      const library = window.TripLog.features.home.tripLibrary;
      return [library.status({ startDate: '2026-02-31', endDate: '2026-03-02' }), library.dates({ startDate: '2026-12-31', endDate: '2027-01-02' })];
    }), ['undated', '26.12.31 – 27.01.02']);
    await page.evaluate(async () => {
      for (const record of await window.TripLogSyncRepository.all()) await window.TripLogSyncRepository.update(record.localId, current => ({ ...current, hidden: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll('[data-library-trip]').length === 0);
    assert.match(await page.locator('#tripLibraryEmpty').innerText(), /첫 여행/);
    assert(await page.locator('#rdTripCreate').isVisible());
    await page.screenshot({ path: path.join(output, 'home-empty-320.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS library: missing-trip links, explicit expense links and a fresh app entry resolve correctly without runtime errors');
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
