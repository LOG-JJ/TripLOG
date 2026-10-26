// Browser plugin not available: isolated repository Playwright/Edge fixtures.
// Flow: trip collection -> passport/list switch -> search, reopen, create/remove.
// Only synthetic account data is used and every external request is blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, startServer, stopServer, waitForApp } = require('./helpers/browser-fixture');
const fixtures = require('./fixtures/trip-library');

const output = artifactDirectory('trip-library-views');
const preferenceKey = 'triplog.tripLibraryView.v1';
const fixedDate = new Date('2026-10-03T09:00:00+09:00');
const user = { id: '00000000-0000-4000-8000-000000000096', email: 'library-views@example.test', user_metadata: { display_name: '보기 전환 시험' } };

async function main() {
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  const errors = [], consoleIssues = [], layouts = [], checks = [];
  const pass = message => { checks.push(message); console.log(`PASS library views: ${message}`); };
  async function fixture({ preference, storageFailure = '', reducedMotion = 'reduce' } = {}) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', reducedMotion });
    context.setDefaultTimeout(15000);
    const expiry = Math.floor(fixedDate.getTime() / 1000) + 86400;
    await context.addInitScript(({ origin, fixtures, user, expiry, token, preferenceKey, preference, storageFailure }) => {
      if (location.origin !== origin) return;
      if (!localStorage.getItem('trip-library-views-fixture')) {
        localStorage.setItem('trip-library-views-fixture', '1');
        localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_at: expiry, expires_in: 86400, user }));
        localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify(fixtures));
        localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', 'library-osaka');
        if (preference !== undefined) localStorage.setItem(preferenceKey, preference);
      }
      // Fail only this UI preference; authentication and trip persistence stay real.
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      window.__viewPreferenceFailures = { reads: 0, writes: 0 };
      if (storageFailure === 'read-write') Storage.prototype.getItem = function (key) {
        if (this === localStorage && key === preferenceKey) { window.__viewPreferenceFailures.reads++; throw new DOMException('Fixture preference access denied', 'SecurityError'); }
        return get.call(this, key);
      };
      if (storageFailure) Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key === preferenceKey) { window.__viewPreferenceFailures.writes++; throw new DOMException('Fixture preference quota', 'QuotaExceededError'); }
        return set.call(this, key, value);
      };
      window.__viewSplashStates = [];
      const observe = () => {
        const status = document.documentElement?.dataset.splash;
        if (status && window.__viewSplashStates.at(-1) !== status) window.__viewSplashStates.push(status);
      };
      new MutationObserver(observe).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-splash'] });
      observe();
    }, { origin, fixtures, user, expiry, token: fixtureToken(user, expiry), preferenceKey, preference, storageFailure });
    await blockExternalRequests(context, origin);
    const page = await context.newPage();
    await page.clock.setFixedTime(fixedDate);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type()) && !/net::ERR_FAILED|Failed to fetch|fixture|Fixture|QuotaExceeded|AbortError|Service Worker registration blocked by Playwright/.test(message.text())) consoleIssues.push(message.text());
    });
    return { page, context };
  }
  async function open(page) {
    await page.goto(origin + '/Travel?page=start');
    await waitForApp(page);
    await page.waitForFunction(() => activePage === 'start' && document.querySelectorAll('[data-library-trip]').length === 3);
    assert.equal(await page.title(), '여행 가계부');
    assert.equal(new URL(page.url()).searchParams.get('page'), 'start');
    assert.equal(await page.locator('#tripLibraryTitle').innerText(), '내 여행');
    assert.equal(await page.locator('vite-error-overlay, nextjs-portal').count(), 0);
  }
  async function expectView(page, view) {
    await page.waitForFunction(view => document.querySelector('.tl-library')?.dataset.view === view, view);
    for (const candidate of ['passport', 'list']) {
      const control = page.locator(`button[data-library-view="${candidate}"]`);
      assert.equal(await control.getAttribute('aria-pressed'), String(candidate === view));
      assert.equal(await control.getAttribute('aria-controls'), 'rdTripList');
      assert(await control.isVisible(), 'Both view controls remain available');
    }
    const count = await page.locator('[data-library-trip]').count();
    assert.equal(await page.locator('.tl-trip-row').count(), view === 'list' ? count : 0);
    if (view === 'list') assert.equal(await page.locator('.tl-passport-entry.tl-trip-list-entry').count(), count);
  }
  async function switchView(page, view, keyboard = false) {
    const button = page.locator(`[data-library-view="${view}"]`);
    if (keyboard) { await button.focus(); await button.press('Enter'); }
    else await button.click();
    await expectView(page, view);
    assert.equal(await button.evaluate(element => element === document.activeElement), true, 'The selected view control retains keyboard focus');
  }
  // Opening the fallback trip after deletion can lazily normalize internal order
  // metadata. Compare every user-owned field while omitting only that metadata.
  const snapshot = page => page.evaluate(() => JSON.parse(JSON.stringify(window.TripLog.persistence.stateStorage.getTrips().map(trip => ({ id: trip.id, tripName: trip.tripName, city: trip.city, country: trip.country, countryCode: trip.countryCode, startDate: trip.startDate, endDate: trip.endDate, entries: trip.entries, itineraryItems: trip.itineraryItems, companions: trip.companions, packingList: trip.packingList, totalBudget: trip.totalBudget })).sort((a, b) => a.id.localeCompare(b.id)), (key, value) => key === '_syncPosition' ? undefined : value)));
  async function home(page) {
    await page.locator('.rd-brand-link').click();
    await page.waitForFunction(() => activePage === 'start');
  }
  async function settleRows(page) {
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.querySelectorAll('#rdTripList img')].map(image => image.decode().catch(() => {}))));
  }
  async function assertLayout(page, width, view) {
    await settleRows(page);
    const geometry = await page.evaluate(() => {
      const rect = element => { const { x, y, width, height, right, bottom } = element.getBoundingClientRect(); return { x, y, width, height, right, bottom }; };
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, columns: getComputedStyle(document.querySelector('#rdTripList')).gridTemplateColumns.split(' ').length,
        items: [...document.querySelectorAll('[data-library-trip]')].map(element => ({ ...rect(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })),
        controls: [...document.querySelectorAll('[data-library-view]')].map(rect),
        rows: [...document.querySelectorAll('.tl-trip-row')].map(element => ({ row: rect(element), copy: rect(element.querySelector('.tl-trip-row-copy')), status: rect(element.querySelector('.tl-trip-row-status')) })),
      };
    });
    assert(geometry.scrollWidth <= width, `${view} has no horizontal overflow at ${width}`);
    assert.equal(geometry.columns, view === 'list' ? 1 : width >= 960 ? 4 : width >= 600 ? 3 : 2);
    assert(geometry.controls.every(control => control.width >= 40 && control.height >= 40), 'View controls have usable touch targets');
    for (const item of geometry.items) {
      assert(item.x >= -1 && item.right <= width + 1, `Travel entry stays within ${width}px viewport`);
      if (view === 'list') assert(item.scrollWidth <= item.clientWidth + 1, `List content stays within its border at ${width}: ${JSON.stringify(item)}`);
    }
    if (view === 'list') {
      const first = geometry.items[0];
      assert(geometry.items.every(item => Math.abs(item.x - first.x) < 1 && Math.abs(item.width - first.width) < 1), 'List entries use one consistent column');
      assert(geometry.items.every((item, index, items) => !index || item.y >= items[index - 1].bottom), 'List rows never overlap');
      assert(geometry.items.every(item => item.height <= 140), 'Ordinary list rows remain compact');
      for (const { copy, status } of geometry.rows) assert(copy.right <= status.x + 1 || copy.bottom <= status.y + 1 || status.bottom <= copy.y + 1, 'Status and title/date copy do not overlap');
    }
    await page.screenshot({ path: path.join(output, `${view}-${width}.png`), fullPage: true, animations: 'disabled' });
    layouts.push({ view, ...geometry });
    return geometry;
  }
  try {
    const { page, context } = await fixture();
    await open(page);
    await expectView(page, 'passport');
    const before = await snapshot(page);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width >= 600 ? 1000 : 844 });
      await switchView(page, 'passport');
      const passports = await assertLayout(page, width, 'passport');
      await switchView(page, 'list', true);
      const list = await assertLayout(page, width, 'list');
      assert(list.items.every((row, index) => row.height < passports.items[index].height * 0.7), 'List mode visibly reduces each trip height');
    }
    pass('passport default and accessible view controls; compact list and passport layouts at 320/390/768/1440 without overflow');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#tripLibrarySearch').fill('제 주');
    await page.locator('[data-library-filter="past"]').click();
    for (const view of ['passport', 'list']) {
      await switchView(page, view, true);
      assert.equal(await page.locator('#tripLibrarySearch').inputValue(), '제 주');
      assert.equal(await page.locator('[data-library-filter="past"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-library-trip]').count(), 1);
      assert.equal(await page.locator('[data-library-trip]').getAttribute('data-library-trip'), 'library-jeju');
      assert.match(await page.locator('#tripLibraryResult').innerText(), /1개의 여행/);
    }
    await page.evaluate(() => {
      for (let index = 0; index < 15; index++) document.querySelector(`[data-library-view="${index % 2 ? 'passport' : 'list'}"]`).click();
    });
    await expectView(page, 'list');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), preferenceKey), 'list');
    assert.equal(await page.locator('[data-library-trip]').count(), 1);
    for (const [key, view] of [['ArrowLeft', 'passport'], ['ArrowRight', 'list'], ['Home', 'passport'], ['End', 'list']]) {
      await page.keyboard.press(key); await expectView(page, view);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.libraryView), view, `${key} moves both mode and keyboard focus`);
    }
    await switchView(page, 'passport');
    await page.locator('[data-library-view="list"]').focus();
    await page.keyboard.press('ArrowLeft'); await expectView(page, 'passport');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.libraryView), 'passport', 'ArrowLeft from the inactive list control focuses its left neighbor');
    await switchView(page, 'list');
    await page.locator('[data-library-view="passport"]').focus();
    await page.keyboard.press('ArrowRight'); await expectView(page, 'list');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.libraryView), 'list', 'ArrowRight from the inactive passport control focuses its right neighbor');
    await page.locator('#tripLibrarySearch').fill('존재하지 않는 여행');
    assert.equal(await page.locator('[data-library-trip]').count(), 0);
    assert.match(await page.locator('#tripLibraryEmpty').innerText(), /검색 결과/);
    for (const view of ['passport', 'list']) { await switchView(page, view); assert(await page.locator('#tripLibraryEmpty').isVisible()); }
    await page.locator('[data-library-reset]').click();
    assert.equal(await page.locator('[data-library-trip]').count(), 3);
    assert.equal(await page.locator('#tripLibrarySearch').inputValue(), '');
    assert.equal(await page.locator('[data-library-filter="all"]').getAttribute('aria-pressed'), 'true');
    pass('search and period survive keyboard/rapid view switches; no-result reset restores every trip');

    await page.locator('[data-library-trip="library-osaka"]').focus();
    await page.locator('[data-library-trip="library-osaka"]').press('Enter');
    await page.waitForFunction(() => activePage === 'overview' && state.id === 'library-osaka');
    await home(page);
    await expectView(page, 'list');
    assert.equal(await page.locator('#entrySplash').isVisible(), false);
    await page.reload(); await waitForApp(page); await expectView(page, 'list');
    assert.equal(await page.locator('[data-library-trip]').count(), 3);
    assert.deepEqual(await snapshot(page), before, 'View changes, filtering, navigation and reload preserve stored trip data');
    pass('list preference survives trip selection/return and reload, with expenses, itineraries and trip details unchanged');

    await page.locator('#rdTripCreate').click();
    await page.locator('#newTripModal').waitFor({ state: 'visible' });
    await page.locator('#newTripCloseButton').click();
    await expectView(page, 'list');
    assert.deepEqual(await snapshot(page), before, 'Canceling creation must not change travel data');
    await page.locator('#rdTripCreate').click();
    await page.locator('#newTripNameInput').fill('목록에서 만든 여행');
    await page.locator('#newTripModeToggle [data-mode="domestic"]').click();
    await page.locator('#newTripCityInput').fill('서울');
    await page.locator('#newTripForm button[type="submit"]').click();
    await page.waitForFunction(() => activePage === 'overview' && state.tripName === '목록에서 만든 여행');
    const newId = await page.evaluate(() => state.id);
    await home(page); await expectView(page, 'list');
    assert.equal(await page.locator('[data-library-trip]').count(), 4);
    assert.deepEqual((await snapshot(page)).filter(trip => trip.id !== newId), before);
    await page.locator(`[data-library-remove="${newId}"]`).click();
    await page.locator('#rdConfirm').waitFor({ state: 'visible' });
    assert.match(await page.locator('#rdConfirm').innerText(), /목록에서 만든 여행/);
    await page.locator('#rdConfirmCancel').click();
    await page.waitForFunction(id => !document.querySelector(`[data-library-remove="${id}"]`)?.disabled, newId);
    assert.equal(await page.locator('[data-library-trip]').count(), 4);
    assert.equal(await page.locator(`[data-library-remove="${newId}"]`).evaluate(element => element === document.activeElement), true);
    await page.locator(`[data-library-remove="${newId}"]`).click();
    await page.locator('#rdConfirmAccept').click();
    await page.waitForFunction(id => !document.querySelector(`[data-library-trip="${id}"]`), newId);
    await page.evaluate(() => window.TripLog.persistence.stateStorage.whenSaved());
    assert.deepEqual(await snapshot(page), before, 'Removing the new fixture preserves every original trip');
    assert.equal(await page.locator('#tripLibrarySearch').evaluate(element => element === document.activeElement), true);
    pass('list creation cancel/save and removal cancel/confirm preserve existing trips and return usable keyboard focus');

    const longName = '가족 & 친구 <img src=x onerror="window.__injectedView=true">와 함께 떠나는 아주 긴 이름의 프랑스 겨울 여행';
    await page.evaluate(async ({ longName }) => {
      await window.TripLogSyncRepository.update('library-jeju', record => ({ ...record, snapshot: { ...record.snapshot, tripName: longName, city: '아주 긴 목적지 이름이 이어지는 아름다운 프랑스 시골 마을', country: '프랑스 & 주변', countryCode: 'FR', travelMode: 'overseas', startDate: '', endDate: '' } }));
    }, { longName });
    await page.waitForFunction(name => document.querySelector('[data-library-trip="library-jeju"]')?.textContent.includes(name), longName);
    await page.setViewportSize({ width: 320, height: 844 });
    const longTrip = page.locator('[data-library-trip="library-jeju"]');
    assert.match(await longTrip.innerText(), /날짜를 정해 주세요/);
    assert.equal(await longTrip.getAttribute('aria-label'), `${longName} 여행 열기`);
    assert.equal(await longTrip.locator('img[src="x"]').count(), 0);
    assert.equal(await page.evaluate(() => Boolean(window.__injectedView)), false);
    assert(await longTrip.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, 'list-long-undated-320.png'), fullPage: true, animations: 'disabled' });
    await page.evaluate(async () => {
      for (const record of await window.TripLogSyncRepository.all()) if (!record.removedAt) await window.TripLogSyncRepository.update(record.localId, current => ({ ...current, hidden: true }));
    });
    await page.waitForFunction(() => !document.querySelector('[data-library-trip]'));
    assert.match(await page.locator('#tripLibraryEmpty').innerText(), /첫 여행/);
    assert(await page.locator('#rdTripCreate').isVisible());
    await switchView(page, 'passport'); await switchView(page, 'list');
    assert(await page.locator('#tripLibraryEmpty').isVisible());
    await page.screenshot({ path: path.join(output, 'list-empty-320.png'), fullPage: true, animations: 'disabled' });
    pass('long escaped titles/destinations and undated trips fit 320px; both empty states keep creation and view controls reachable');
    await context.close();

    for (const options of [{ preference: 'unknown-view' }, { preference: 'passport', storageFailure: 'write' }, { preference: 'list', storageFailure: 'read-write' }]) {
      const fixtureResult = await fixture(options), p = fixtureResult.page;
      try {
        await open(p); await expectView(p, 'passport');
        const original = await snapshot(p);
        await switchView(p, 'list');
        await p.locator('#tripLibrarySearch').fill('오사카'); await p.locator('#tripLibrarySearchClear').click();
        await expectView(p, 'list');
        await p.locator('[data-library-trip="library-osaka"]').click();
        await p.waitForFunction(() => activePage === 'overview'); await home(p); await expectView(p, 'list');
        assert.deepEqual(await snapshot(p), original);
        if (options.storageFailure) {
          const failures = await p.evaluate(() => window.__viewPreferenceFailures);
          assert(failures.writes > 0, 'Storage failure fixture actually intercepted preference writes');
          if (options.storageFailure === 'read-write') assert(failures.reads > 0, 'Storage failure fixture actually intercepted preference reads');
        } else assert.equal(await p.evaluate(key => localStorage.getItem(key), preferenceKey), 'list', 'A valid selection repairs an invalid preference');
      } finally { await fixtureResult.context.close(); }
    }
    pass('invalid preferences default safely; unavailable/quota-limited preference storage keeps the selected mode in memory');

    for (const reducedMotion of ['no-preference', 'reduce']) {
      const fixtureResult = await fixture({ preference: 'list', reducedMotion }), p = fixtureResult.page;
      let releaseBootstrap;
      const gate = new Promise(resolve => { releaseBootstrap = resolve; });
      if (reducedMotion === 'no-preference') await fixtureResult.context.route('**/src/app/bootstrap/start.js*', async route => { await gate; await route.continue().catch(() => {}); });
      try {
        if (reducedMotion === 'no-preference') {
          await p.goto(origin + '/Travel?page=start', { waitUntil: 'commit' });
          await p.waitForFunction(() => document.documentElement.dataset.splash === 'showing');
          assert(await p.locator('#entrySplash').isVisible());
          releaseBootstrap(); await waitForApp(p);
        } else await open(p);
        await expectView(p, 'list');
        assert.equal(await p.locator('[data-library-trip]').count(), 3);
        assert.equal(await p.locator('#entrySplash').isVisible(), false);
        assert.equal(await p.evaluate(() => ['appShell', 'authGate'].some(id => document.getElementById(id)?.closest('[inert]'))), false);
        await p.evaluate(() => {
          for (let index = 0; index < 12; index++) document.querySelector(`[data-library-view="${index % 2 ? 'list' : 'passport'}"]`).click();
        });
        await expectView(p, 'list');
        await p.waitForFunction(() => {
          const grid = document.getElementById('rdTripList');
          return !grid.style.opacity && !grid.style.transform && !grid.getAnimations({ subtree: true }).some(animation => animation.playState === 'running');
        });
        assert.equal(await p.locator('#rdTripList').evaluate(element => getComputedStyle(element).opacity), '1', 'Rapid switching leaves a fully visible interactive collection');
        await p.locator('[data-library-trip="library-gangneung"]').click();
        await p.waitForFunction(() => activePage === 'overview' && state.id === 'library-gangneung');
        await home(p); await expectView(p, 'list');
        assert.equal(await p.locator('#entrySplash').isVisible(), false);
      } finally { releaseBootstrap(); await fixtureResult.context.close(); }
    }
    pass('stored list mode works after animated/reduced-motion entry; rapid animations clean up and trip return does not replay the splash');
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleIssues, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ environment: { origin, browser: process.platform === 'win32' ? 'Edge' : 'Chromium', version: browser.version(), reason: 'Browser plugin not available', isolated: true, externalRequests: 'blocked' }, layouts, checks, errors, consoleIssues }, null, 2));
    console.log(`PASS library views: ${checks.length} interaction groups, ${layouts.length} layout snapshots; ${output}`);
  } catch (error) {
    let index = 0;
    for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: path.join(output, `failure-${index++}.png`), fullPage: true, animations: 'disabled' }).catch(() => {});
    throw error;
  } finally { await browser.close(); await stopServer(server); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
