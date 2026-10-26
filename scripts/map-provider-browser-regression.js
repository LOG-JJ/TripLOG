const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, fixtureToken, startServer, stopServer } = require('./helpers/browser-fixture');
// Isolated Edge fixtures: no real trip or account is changed. External map
// navigation is intercepted; live Naver entry URLs are checked separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const { server, origin } = await startServer();
  const output = artifactDirectory('map-provider');
  fs.mkdirSync(output, { recursive: true });
  const browser = await launchBrowser();
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: mobile,
        viewport: { width: mobile ? 390 : 1440, height: 900 } });
      context.setDefaultTimeout(12000);
      const user = { id: '00000000-0000-4000-8000-000000000099', email: 'maps@example.test', user_metadata: { display_name: '지도 시험' } };
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      const token = fixtureToken(user, expiry);
      const seed = { id: 'map-provider-fixture', tripName: '서울 여행', travelMode: 'domestic', city: '서울', country: '대한민국', countryCode: 'KR', startDate: '2026-09-25', endDate: '2026-09-25', entries: [], companions: [], packingList: [], itineraryItems: [
        { id: 'a', date: '2026-09-25', place: '서울역', location: '서울 중구', time: '09:00', endTime: '09:30', theme: 'sightseeing', createdAt: 1, mapQuery: '37.5547,126.9706' },
        { id: 'b', date: '2026-09-25', place: '경복궁', location: '서울 종로구 사직로 161', time: '10:00', endTime: '11:00', theme: 'sightseeing', createdAt: 2, mapQuery: '37.5796,126.9769', voucherName: '경복궁 입장권', voucherCode: 'TEST' },
        { id: 'c', date: '2026-09-25', place: '장소만 입력한 식당', time: '12:00', endTime: '13:00', theme: 'food', createdAt: 3 },
      ] };
      await context.addInitScript(({ origin, seed, user, expiry, token }) => {
        if (location.origin !== origin || localStorage.getItem('maps-seed')) return;
        localStorage.setItem('maps-seed', '1');
        localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_at: expiry, expires_in: 3600, user }));
        localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([seed]));
        localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', seed.id);
      }, { origin, seed, user, expiry, token });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        if (url.hostname === 'map.naver.com' && route.request().resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: '<h1>Naver navigation fixture</h1>' });
        return route.abort();
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && document.documentElement.dataset.appReady === 'true');
      await page.goto(`${origin}/Travel?page=itinerary`); await ready();
      await page.locator('#itineraryAddButton').click();
      assert.match(await page.locator('#googleMapsLink').innerText(), /네이버지도/);
      assert.equal(new URL(await page.locator('#googleMapsLink').getAttribute('href')).hostname, 'map.naver.com');
      assert.equal(await page.locator('#googleMapFrame').getAttribute('src'), null);
      assert.equal(await page.locator('#itineraryDomesticMap').isVisible(), true);
      await page.locator('#itineraryRouteButton').click();
      assert.equal(await page.locator('#naverMapPreview ol a').count(), 3);
      const route = new URL(await page.locator('#googleMapsLink').getAttribute('href'));
      assert.equal(route.searchParams.get('slat'), '37.5547');
      assert.equal(route.searchParams.get('elat'), '37.5796');
      await page.waitForFunction(()=>document.querySelector('#naverMapPreview').getAttribute('aria-busy')==='false');
      assert.match(await page.locator('#naverMapPreview ol a').last().getAttribute('href'), /\/p\/search\//);
      await page.screenshot({ path: path.join(output, `domestic-${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' });

      // Native mobile navigation must preserve the unsaved itinerary draft.
      if (mobile) {
        await page.locator('#itineraryThemeSelect').selectOption('food');
        await page.locator('#itinerarySubtypeSelect').selectOption('cafe');
        await page.locator('#itineraryPlaceInput').fill('돌아와도 남는 장소');
        await page.locator('#placeSearchButton').click();
        await page.waitForFunction(() => document.querySelector('#googleMapsLink').dataset.mapQuery.includes('돌아와도'));
        assert.match(await page.locator('#placeSearchResults').innerText(), /네이버지도 검색/);
        await Promise.all([page.waitForURL('https://map.naver.com/**'), page.locator('#googleMapsLink').click()]);
        await page.goBack(); await ready();
        await page.locator('#itineraryEditor[open]').waitFor();
        assert.equal(await page.locator('#itineraryPlaceInput').inputValue(), '돌아와도 남는 장소');
        assert.equal(await page.locator('#itinerarySubtypeSelect').inputValue(), 'cafe');
        assert.match(await page.locator('#googleMapsLink').getAttribute('href'), /map\.naver\.com/);
      }
      await page.locator('#itineraryEditorClose').click();

      await page.locator('[data-transit-open][data-id="b"]').click();
      assert.equal(await page.locator('#itineraryTransitRouteTab').innerText(), '지도 · 길찾기');
      assert.equal(await page.locator('#itineraryTransitMap iframe').count(), 0);
      assert.equal(new URL(await page.locator('#itineraryTransitGoogleLink').getAttribute('href')).searchParams.get('pathType'), '0');
      await page.locator('[data-transit-map-mode="walking"]').click();
      assert.equal(new URL(await page.locator('#itineraryTransitGoogleLink').getAttribute('href')).searchParams.get('pathType'), '3');
      assert.equal(await page.locator('[data-transit-map-mode="walking"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-transit-map-mode="transit"]').getAttribute('aria-pressed'), 'false');
      await page.screenshot({ path: path.join(output, `route-${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' });
      await page.locator('#itineraryTransitDialog [data-transit-cancel]').first().click();
      await page.locator('[data-transit-open][data-id="c"]').click();
      await page.waitForFunction(() => document.querySelector('#itineraryTransitNaver').getAttribute('aria-busy') === 'false');
      assert.equal(await page.locator('#itineraryTransitGoogleLink').isVisible(), true);
      assert.equal(await page.locator('#itineraryTransitMapLink').getAttribute('aria-label'), '네이버지도에서 도착지 검색');
      assert.equal(await page.locator('#itineraryTransitMapRetry').isVisible(), true);
      assert.match(await page.locator('#itineraryTransitNaver').innerText(), /네이버지도에서 도착지를 검색/);
      await page.locator('#itineraryTransitDialog [data-transit-cancel]').first().click();

      await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('today'));
      assert.equal(new URL(await page.locator('#ttPrimary a').getAttribute('href')).hostname, 'map.naver.com');
      await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('wallet'));
      await page.locator('[data-tt-action="reservation-detail"]').first().click();
      assert.match(await page.locator('.tt-detail-map').innerText(), /네이버지도/);
      assert.equal(new URL(await page.locator('.tt-detail-map').getAttribute('href')).hostname, 'map.naver.com');

      // Switch providers on the same page: stale Naver panels/links must clear.
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
        state.travelMode = 'overseas'; state.country = '일본'; state.city = '교토'; state.countryCode = 'JP'; render();
      });
      await page.locator('#itineraryAddButton').click();
      assert.match(await page.locator('#googleMapsLink').innerText(), /Google 지도/);
      assert.equal(new URL(await page.locator('#googleMapsLink').getAttribute('href')).hostname, 'www.google.com');
      assert.equal(await page.locator('#naverMapPreview').isVisible(), false);
      assert.match(await page.locator('#googleMapFrame').getAttribute('src'), /google\.com/);
      await page.locator('#itineraryEditorClose').click();
      await page.locator('[data-transit-open][data-id="b"]').click();
      assert.equal(await page.locator('#itineraryTransitRouteTab').innerText(), 'Google 경로');
      assert.equal(await page.locator('#itineraryTransitMap iframe').count(), 1);
      assert.equal(await page.locator('#itineraryTransitNaver').isVisible(), false);
      assert.equal(new URL(await page.locator('#itineraryTransitGoogleLink').getAttribute('href')).hostname, 'www.google.com');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${mobile ? 'mobile' : 'desktop'} maps: domestic Naver, overseas Google, route modes, missing coordinates, full-day segments, today/wallet and draft preservation.`);
    }
    console.log(`Map QA screenshots: ${output}`);
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
