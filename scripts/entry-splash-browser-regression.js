const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, startServer, stopServer, waitForApp } = require('./helpers/browser-fixture');
// Browser plugin not available: use the repository's isolated Playwright/Edge
// fixtures. The flow is a fresh app entry -> animated splash -> selectable trips.
// All external requests are blocked, including every CDN and live account API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('./fixtures/trip-library');

const output = artifactDirectory('entry-splash');
const user = { id: '00000000-0000-4000-8000-000000000099', email: 'splash@example.test', user_metadata: { display_name: '시작 화면 검증' } };
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 600, height: 800 }, { width: 1440, height: 900 }, { width: 844, height: 390 }];

async function makeContext(browser, origin, { signedIn = true, viewport = viewports[1], reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport, reducedMotion, timezoneId: 'Asia/Seoul' });
  context.setDefaultTimeout(12000);
  const expiry = Math.floor(Date.now() / 1000) + 86400;
  await context.addInitScript(({ origin, signedIn, fixtures, user, expiry, token }) => {
    if (location.origin !== origin) return;
    // Observe transitions from document creation so a fast startup cannot evade
    // assertions and timing is measured in the page's own monotonic clock.
    window.__splashEvidence = { states: [], readyAt: null };
    const observe = () => {
      const root = document.documentElement;
      if (!root) return;
      const status = root.dataset.splash;
      const evidence = window.__splashEvidence;
      if (status && evidence.states.at(-1)?.status !== status) evidence.states.push({ status, time: performance.now() });
      if (!evidence.readyAt && root.dataset.appReady === 'true' && root.dataset.triplogInitialized === 'true') evidence.readyAt = performance.now();
    };
    new MutationObserver(observe).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-splash', 'data-app-ready', 'data-triplog-initialized'] });
    observe();
    if (localStorage.getItem('entry-splash-fixture')) return;
    localStorage.setItem('entry-splash-fixture', '1');
    if (signedIn) localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_at: expiry, expires_in: 86400, user }));
    localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify(fixtures));
    localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', 'library-osaka');
  }, { origin, signedIn, fixtures, user, expiry, token: fixtureToken(user, expiry) });
  await blockExternalRequests(context, origin);
  return context;
}

async function waitForSplashEnd(page) {
  await page.waitForFunction(() => ['done', 'skipped'].includes(document.documentElement.dataset.splash));
  assert.equal(await page.locator('#entrySplash').isVisible(), false, 'The completed splash must release the app');
  assert.equal(await page.locator('#entrySplash').getAttribute('hidden') !== null, true, 'The splash leaves the accessibility and pointer trees');
  assert.equal(await page.evaluate(() => ['appShell', 'authGate'].some(id => document.getElementById(id)?.closest('[inert]'))), false, 'The app and login form must not remain inert');
}

async function assertTripSelection(page) {
  await page.waitForFunction(() => activePage === 'start' && document.querySelectorAll('[data-library-trip]').length === 3);
  assert(await page.locator('#tripLibrarySearch').isVisible());
  await page.locator('#tripLibrarySearch').fill('오사카');
  assert.equal(await page.locator('[data-library-trip]').count(), 1);
  await page.locator('#tripLibrarySearchClear').click();
  assert.equal(await page.locator('[data-library-trip]').count(), 3);
}

async function main() {
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  const report = { origin, browser: process.platform === 'win32' ? 'Edge' : 'Chromium', viewports: [], checks: [] };
  try {
    // Hold only app bootstrap long enough to capture the real entrance pose.
    // This also exercises a slow application without injecting a test-only UI.
    for (const viewport of viewports) {
      const context = await makeContext(browser, origin, { viewport });
      let releaseBootstrap;
      const bootstrapGate = new Promise(resolve => { releaseBootstrap = resolve; });
      await context.route('**/src/app/bootstrap/start.js*', async route => { await bootstrapGate; await route.continue().catch(() => {}); });
      try {
        const page = await context.newPage();
        const errors = [], motionRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (/\/vendor\/motion[^/]*\.js/.test(new URL(request.url()).pathname)) motionRequests.push(request.url()); });
        await page.goto(origin + '/Travel?page=start', { waitUntil: 'commit' });
        await page.waitForFunction(() => document.documentElement.dataset.splash === 'showing');
        assert(await page.locator('#entrySplash').isVisible());
        assert(await page.evaluate(() => ['authGate', 'appShell'].every(id => document.getElementById(id).inert)), 'Background controls are inert during the entrance');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.querySelectorAll('#entrySplash img')].every(image => image.complete && image.naturalWidth > 0));
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('#entrySplash').getAttribute('data-motion'), 'motion', 'The real local Motion engine animates the normal entrance');
        const bounds = await page.evaluate(() => {
          const rect = element => {
            const { x, y, width, height, top, right, bottom, left } = element.getBoundingClientRect();
            return { x, y, width, height, top, right, bottom, left };
          };
          const overlay = document.querySelector('#entrySplash');
          return { viewport: { width: innerWidth, height: innerHeight }, overlay: rect(overlay), scrollWidth: document.documentElement.scrollWidth,
            logo: rect(overlay.querySelector('.entry-splash-logo')), passports: [...overlay.querySelectorAll('.entry-splash-passport')].map(rect),
            images: [...overlay.querySelectorAll('img')].map(image => ({ src: image.currentSrc, loaded: image.complete && image.naturalWidth > 0 })) };
        });
        const label = `${viewport.width}x${viewport.height}`;
        assert(bounds.scrollWidth <= viewport.width, `No horizontal page overflow at ${label}`);
        for (const [name, box] of [['logo', bounds.logo], ...bounds.passports.map((box, index) => [`passport ${index + 1}`, box])]) {
          assert(box.width > 0 && box.height > 0, `${name} has visible dimensions at ${label}`);
          assert(box.left >= -1 && box.right <= viewport.width + 1 && box.top >= -1 && box.bottom <= viewport.height + 1, `${name} stays in the viewport at ${label}: ${JSON.stringify(box)}`);
        }
        assert(bounds.passports.every(box => bounds.logo.bottom <= box.top || box.bottom <= bounds.logo.top || bounds.logo.right <= box.left || box.right <= bounds.logo.left), `The logo and passport artwork do not overlap at ${label}`);
        assert(bounds.images.length > 0 && bounds.images.every(image => image.loaded && new URL(image.src).origin === origin), 'Splash artwork is loaded from local app assets');
        await page.screenshot({ path: path.join(output, `splash-${label}.png`), fullPage: false });
        releaseBootstrap();
        await waitForApp(page);
        await waitForSplashEnd(page);
        await assertTripSelection(page);
        const timing = await page.evaluate(() => window.__splashEvidence);
        assert(timing.states.some(entry => entry.status === 'showing'), 'An ordinary entry presents the splash');
        assert(timing.states.at(-1).time - timing.readyAt < 3600, 'A ready app becomes interactive within about three seconds');
        assert(motionRequests.length > 0 && motionRequests.every(url => new URL(url).origin === origin), 'Motion is loaded locally while every external origin is blocked');
        await page.screenshot({ path: path.join(output, `trip-selection-${label}.png`), fullPage: false });
        if (viewport.width === 390) {
          const snapshot = () => page.evaluate(() => window.TripLog.persistence.stateStorage.getTrips().map(trip => ({ id: trip.id, name: trip.tripName,
            itinerary: trip.itineraryItems.map(({ id, date, place, time, endTime }) => ({ id, date, place, time, endTime })),
            entries: trip.entries.map(({ id, date, amount, description, category, paymentMethod }) => ({ id, date, amount, description, category, paymentMethod })),
          })).sort((a, b) => a.id.localeCompare(b.id)));
          const before = await snapshot();
          await page.locator('[data-library-trip="library-jeju"]').click();
          await page.waitForFunction(() => activePage === 'overview' && state.id === 'library-jeju');
          await page.locator('.rd-brand-link').click();
          await page.waitForFunction(() => activePage === 'start');
          assert.equal(await page.locator('#entrySplash').isVisible(), false, 'In-app return to the collection does not replay the splash');
          assert.deepEqual(await page.evaluate(() => window.__splashEvidence.states), timing.states, 'Navigation leaves the completed entrance lifecycle unchanged');
          assert.deepEqual(await snapshot(), before, 'Entrance and trip navigation preserve all fixture travel data');
        }
        assert.deepEqual(errors, [], `No runtime errors at ${label}`);
        report.viewports.push({ ...viewport, bounds, timing });
      } finally { releaseBootstrap(); await context.close(); }
    }
    console.log('PASS splash: local Motion/artwork, responsive 320/390/600/1440/landscape composition, automatic trip selection, accessible search and no replay or trip-data changes');
    report.checks.push('responsive entrance, automatic collection reveal, local assets, navigation and data preservation');

    for (const failure of ['missing-motion', 'slow-motion']) {
      const context = await makeContext(browser, origin);
      let releaseMotion;
      const motionGate = new Promise(resolve => { releaseMotion = resolve; });
      let intercepted = 0;
      await context.route(/\/vendor\/motion[^/]*\.js(?:\?|$)/, async route => {
        intercepted++;
        if (failure === 'missing-motion') return route.abort();
        await motionGate;
        await route.continue().catch(() => {});
      });
      try {
        const page = await context.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin + '/Travel?page=start', { waitUntil: 'commit' });
        await waitForApp(page);
        await waitForSplashEnd(page);
        assert(intercepted > 0, 'The failure fixture must actually intercept Motion');
        await assertTripSelection(page);
        releaseMotion();
        await page.waitForTimeout(250);
        assert.equal(await page.locator('#entrySplash').isVisible(), false, 'A late animation library cannot restart the entrance');
        assert.deepEqual(errors, [], `${failure} must not cause a runtime exception`);
      } finally { releaseMotion(); await context.close(); }
    }
    console.log('PASS splash: a missing or stalled Motion file does not block startup or restart a finished entrance');
    report.checks.push('missing and indefinitely stalled animation library');

    for (const failure of ['slow-app-loader', 'slow-bootstrap', 'missing-bootstrap']) {
      const context = await makeContext(browser, origin);
      let releaseBootstrap;
      const bootstrapGate = new Promise(resolve => { releaseBootstrap = resolve; });
      await context.route(failure === 'slow-app-loader' ? '**/app.js*' : '**/src/app/bootstrap/start.js*', async route => {
        if (failure === 'missing-bootstrap') return route.abort();
        await bootstrapGate;
        await route.continue().catch(() => {});
      });
      try {
        const page = await context.newPage();
        await page.goto(origin + '/Travel?page=start', { waitUntil: 'commit' });
        if (failure === 'slow-app-loader') {
          await page.waitForFunction(() => document.getElementById('appShell') && document.getElementById('authGate'));
          assert(await page.evaluate(() => ['authGate', 'appShell'].every(id => document.getElementById(id).inert)), 'A stalled app loader must not expose background controls before mounting');
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('#authGate, #appShell'))), false, 'Tab cannot enter the loading app behind the splash');
          releaseBootstrap();
          await waitForApp(page);
          await waitForSplashEnd(page);
          await assertTripSelection(page);
        } else if (failure === 'slow-bootstrap') {
          await page.locator('.entry-splash-continue').waitFor({ state: 'visible' });
          await page.locator('.entry-splash-continue').focus();
          await page.locator('.entry-splash-continue').press('Enter');
          await waitForSplashEnd(page);
          assert.equal(await page.locator('#authGateTitle').evaluate(element => element === document.activeElement), true, 'Keyboard continuation transfers focus out of the hidden overlay');
          releaseBootstrap();
          await waitForApp(page);
          await assertTripSelection(page);
          assert.equal(await page.locator('#entrySplash').isVisible(), false, 'Late bootstrap does not replay a dismissed entrance');
        } else {
          await page.waitForFunction(() => document.documentElement.dataset.appReady === 'error');
          await waitForSplashEnd(page);
          assert.match(await page.locator('#authGateStatus').innerText(), /불러오지 못|새로고침/, 'A required script error is readable after the splash releases');
        }
      } finally { releaseBootstrap(); await context.close(); }
    }
    console.log('PASS splash: slow loader blocks background focus, keyboard continuation restores focus, and required-script failure reveals its recovery message');
    report.checks.push('slow app-loader focus protection, slow bootstrap keyboard continuation and focus transfer, mandatory-script failure');

    for (const { signedIn, reducedMotion } of [{ signedIn: true, reducedMotion: 'reduce' }, { signedIn: false, reducedMotion: 'reduce' }, { signedIn: false, reducedMotion: 'no-preference' }]) {
      const context = await makeContext(browser, origin, { signedIn, reducedMotion });
      try {
        const page = await context.newPage();
        await page.goto(origin + '/Travel?page=start');
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.triplogInitialized === 'true');
        await waitForSplashEnd(page);
        const evidence = await page.evaluate(() => window.__splashEvidence);
        if (reducedMotion === 'reduce') assert(evidence.states.at(-1).time - (evidence.readyAt || 0) < 1000, 'Reduced motion avoids the long entrance sequence');
        if (signedIn) await assertTripSelection(page);
        else {
          await page.locator('#authGateEmailInput').fill('accessible@example.test');
          assert.equal(await page.locator('#authGateEmailInput').inputValue(), 'accessible@example.test', 'The login form is reachable after a signed-out entry');
          await page.screenshot({ path: path.join(output, `signed-out-${reducedMotion}.png`), fullPage: false });
        }
      } finally { await context.close(); }
    }
    console.log('PASS splash: reduced motion skips prolonged movement and the signed-out login form stays accessible');
    report.checks.push('reduced motion, signed-in and signed-out accessibility');

    const preferenceContext = await makeContext(browser, origin);
    let releasePreferenceBootstrap;
    const preferenceGate = new Promise(resolve => { releasePreferenceBootstrap = resolve; });
    await preferenceContext.route('**/src/app/bootstrap/start.js*', async route => { await preferenceGate; await route.continue().catch(() => {}); });
    try {
      const page = await preferenceContext.newPage();
      await page.goto(origin + '/Travel?page=start', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#entrySplash').dataset.motion === 'motion');
      assert.equal(await page.evaluate(() => document.documentElement.dataset.splash), 'showing');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !document.querySelector('#entrySplash').getAnimations({ subtree: true }).some(animation => animation.playState === 'running'));
      assert.equal(await page.evaluate(() => document.querySelector('#entrySplash').getAnimations({ subtree: true }).some(animation => animation.playState === 'running')), false, 'Enabling reduced motion stops the active entrance immediately');
      releasePreferenceBootstrap();
      await waitForApp(page);
      await waitForSplashEnd(page);
      await assertTripSelection(page);
    } finally { releasePreferenceBootstrap(); await preferenceContext.close(); }
    console.log('PASS splash: enabling reduced motion during the live sequence stops movement and releases ready trip selection');
    report.checks.push('live reduced-motion preference change');

    const recoveryExpiry = Math.floor(Date.now() / 1000) + 86400;
    const recoveryParams = new URLSearchParams({ access_token: fixtureToken(user, recoveryExpiry), refresh_token: 'fixture-recovery', type: 'recovery' });
    for (const route of [
      { url: '/Travel?page=overview&trip=library-jeju', page: 'overview', trip: 'library-jeju' },
      { url: '/Travel?page=itinerary&trip=library-osaka', page: 'itinerary', trip: 'library-osaka' },
      { url: '/Travel?page=itinerary', page: 'itinerary' },
      { url: '/Travel?page=start#' + recoveryParams, recovery: true },
    ]) {
      const context = await makeContext(browser, origin);
      try {
        if (route.recovery) await context.route('**/auth/v1/user', request => request.fulfill({ json: user }));
        const page = await context.newPage();
        await page.goto(origin + route.url);
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
        await waitForSplashEnd(page);
        assert.equal(await page.evaluate(() => window.__splashEvidence.states.some(entry => entry.status === 'showing')), false, 'Explicit destinations and auth callbacks skip the entrance');
        if (route.page) {
          await waitForApp(page);
          assert.equal(await page.evaluate(() => activePage), route.page, 'An explicit destination is not replaced by the trip collection');
          if (route.trip) assert.equal(await page.evaluate(() => state.id), route.trip);
        } else {
          await page.waitForFunction(() => document.querySelector('#authGateTitle')?.textContent === '새 비밀번호 설정');
          assert(await page.locator('#authGatePasswordInput').isVisible(), 'Recovery controls remain visible');
        }
      } finally { await context.close(); }
    }
    console.log('PASS splash: trip links, itinerary routes and password recovery retain their intended destinations');
    report.checks.push('trip and itinerary direct links, password recovery');
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  } finally { await browser.close(); await stopServer(server); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
