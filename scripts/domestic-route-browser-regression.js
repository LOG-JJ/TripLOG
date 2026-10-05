// Browser plugin not available: isolated Playwright/Edge app regression.
// Flow: name-only Udo -> Seongsan itinerary -> transit dialog -> populated
// Naver origin/destination, without changing any saved itinerary fields.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('./serve-test');
const live = process.argv.includes('--live');
const places = {
  '우도': { name: '우도', lat: '33.5072572', lon: '126.9550015', display_name: '우도, 우도면, 제주시, 제주특별자치도, 대한민국', address: { country_code: 'kr', state: '제주특별자치도' }, namedetails: { name: '우도' } },
  '성산일출봉': { name: '성산일출봉', lat: '33.4588891', lon: '126.9408178', display_name: '성산일출봉, 성산읍, 서귀포시, 제주특별자치도, 대한민국', address: { country_code: 'kr', state: '제주특별자치도' }, namedetails: { name: '성산일출봉' } },
};

async function main() {
  const server = createServer({ pagesRedirects: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.TRIPLOG_TEST_URL || `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  const output = path.join(require('node:os').tmpdir(), 'TripLOG-Domestic-Route-QA'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const mobile of live ? [true] : [false, true]) {
      const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: mobile, viewport: { width: mobile ? 390 : 1440, height: 900 } });
      context.setDefaultTimeout(live ? 25000 : 12000);
      const user = { id: '00000000-0000-4000-8000-000000000099', email: 'route@example.test', user_metadata: {} };
      const expires_at = Math.floor(Date.now() / 1000) + 3600;
      const access_token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: expires_at, role: 'authenticated' })).toString('base64url'), 'fixture'].join('.');
      const seed = { id: 'domestic-route-fixture', tripName: '제주 여행', travelMode: 'domestic', city: '제주', country: '대한민국', countryCode: 'KR', startDate: '2026-09-25', endDate: '2026-09-25', entries: [], companions: [], packingList: [], itineraryItems: [
        { id: 'udo', date: '2026-09-25', place: '우도', theme: 'sightseeing', createdAt: 1, coordinateSource: 'google-query-preview', mapQuery: '우도 제주 대한민국', lat: 37.5, lon: 127 },
        { id: 'seongsan', date: '2026-09-25', place: '성산일출봉', theme: 'sightseeing', createdAt: 2, coordinateSource: 'map-match', mapQuery: '성산일출봉 제주 대한민국', lat: 37.6, lon: 127.1 },
      ] };
      await context.addInitScript(({ origin, seed, user, expires_at, access_token }) => {
        if (location.origin !== origin || localStorage.getItem('route-seed')) return;
        localStorage.setItem('route-seed', '1');
        localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token, refresh_token: 'fixture', token_type: 'bearer', expires_at, expires_in: 3600, user }));
        localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([seed]));
        localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', seed.id);
      }, { origin, seed, user, expires_at, access_token });
      const requests = []; let fail = false, delay = 150;
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        if (url.hostname === 'map.naver.com') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Naver route fixture</title><p>Isolated external navigation</p>' });
        // Headless regressions do not download public map tiles. Real map
        // appearance is checked in a visible browser at the current viewport.
        if (url.hostname === 'tile.openstreetmap.org') return route.fulfill({ contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eaf0e9"/></svg>' });
        if (url.hostname === 'nominatim.openstreetmap.org') {
          const q = url.searchParams.get('q'); requests.push({ q, at: Date.now() });
          if (live) return route.continue();
          const failed = fail;
          await new Promise(resolve => setTimeout(resolve, delay));
          if (failed) return route.fulfill({ status: 503, body: 'temporary failure' });
          const place = Object.keys(places).find(name => q.startsWith(name));
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify(place ? [places[place]] : []) });
        }
        return route.abort();
      });
      const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/Travel?page=itinerary`);
      await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in');
      await page.waitForFunction(() => state.itineraryItems.every(item => Number.isFinite(item._syncPosition)));
      const before = await page.evaluate(() => JSON.parse(JSON.stringify(state.itineraryItems)));
      const open = () => page.locator('[data-transit-open][data-id="seongsan"]').click();
      const close = () => page.locator('#itineraryTransitDialog [data-transit-cancel]').first().click();
      const resolved = () => page.waitForFunction(() => !document.querySelector('#itineraryTransitGoogleLink').hidden && document.querySelector('#itineraryTransitGoogleLink').href.includes('slat='));
      await open();
      assert.match(await page.locator('#itineraryTransitNaver strong').innerText(), /위치를 찾고/);
      assert.equal(await page.locator('#itineraryTransitGoogleLink').isVisible(), true);
      const mapLink = page.locator('#itineraryTransitMapLink');
      assert.equal(await mapLink.isVisible(), true, 'The map shortcut is available while location lookup is pending');
      assert.equal(await mapLink.getAttribute('aria-label'), '네이버지도에서 도착지 검색');
      assert.match(decodeURIComponent(await mapLink.getAttribute('href')), /성산일출봉.*제주/);
      await page.locator('[data-transit-map-mode="walking"]').click();
      await page.locator('[data-transit-map-mode="transit"]').click();
      await page.locator('[data-transit-map-mode="driving"]').click();
      await resolved();
      const url = new URL(await page.locator('#itineraryTransitGoogleLink').getAttribute('href'));
      assert.equal(url.hostname, 'map.naver.com');
      assert.equal(url.searchParams.get('stext'), '우도'); assert.equal(url.searchParams.get('etext'), '성산일출봉');
      assert.ok(Number(url.searchParams.get('slat')) > 33.45 && Number(url.searchParams.get('slat')) < 33.55);
      assert.ok(Number(url.searchParams.get('elat')) > 33.4 && Number(url.searchParams.get('elat')) < 33.5);
      assert.equal(url.searchParams.get('pathType'), '0');
      assert.equal(await mapLink.getAttribute('href'), url.toString());
      assert.equal(await mapLink.getAttribute('aria-label'), '네이버지도에서 길찾기 열기');
      for (const [mode, pathType] of [['walking', '3'], ['transit', '1'], ['driving', '0']]) {
        await page.locator(`[data-transit-map-mode="${mode}"]`).click();
        assert.equal(new URL(await mapLink.getAttribute('href')).searchParams.get('pathType'), pathType);
      }
      assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(state.itineraryItems))), before, 'A lookup must not rewrite itinerary selections, times or provenance');
      assert.equal(requests.length, 2, 'Rapid mode switches reuse the same lookups');
      assert.ok(requests[1].at - requests[0].at >= 900, 'Requests obey the shared geocoder rate limit');
      await page.locator('#itineraryTransitDomesticMap[data-map-state="ready"]').waitFor();
      assert.equal(await page.locator('#itineraryTransitDomesticMap .leaflet-marker-icon').count(), 2);
      assert.equal(await page.locator('#itineraryTransitDomesticMap .leaflet-control-attribution').isVisible(), true);
      const zoom = await page.evaluate(() => domesticMapViews.get(document.querySelector('#itineraryTransitDomesticMap')).map.getZoom());
      await page.locator('#itineraryTransitDomesticMap .leaflet-control-zoom-in').click();
      assert.ok(await page.evaluate(() => domesticMapViews.get(document.querySelector('#itineraryTransitDomesticMap')).map.getZoom()) > zoom);
      await page.screenshot({ path: path.join(output, `${live ? 'live-' : ''}${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' });
      if (!live) {
        for (const width of mobile ? [320, 390] : [1440]) {
          await page.setViewportSize({ width, height: 900 });
          const geometry = await mapLink.evaluate(el => {
            const b = el.getBoundingClientRect(), map = el.closest('.transit-map-stage').getBoundingClientRect();
            return { inside: b.left >= map.left && b.right <= map.right && b.top >= map.top && b.bottom <= map.bottom, hit: el.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)) };
          });
          assert(geometry.inside && geometry.hit, `The Naver shortcut is inside the map and can be tapped at ${width}px`);
          assert(await page.locator('#itineraryTransitDialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `No horizontal overflow at ${width}px`);
        }
        if (mobile) {
          await page.locator('#itineraryTransitManualTab').click();
          await page.locator('.transit-segment input[data-transit-field="duration"]').first().fill('23');
          await page.locator('#itineraryTransitRouteTab').click();
          assert.equal(await mapLink.getAttribute('target'), '_self');
          await Promise.all([page.waitForURL('https://map.naver.com/**'), mapLink.click()]);
          assert.equal(new URL(page.url()).searchParams.get('stext'), '우도');
          assert.equal(new URL(page.url()).searchParams.get('etext'), '성산일출봉');
          await page.goBack();
          await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in');
          await page.locator('#itineraryTransitDialog[open]').waitFor();
          await page.locator('#itineraryTransitManualTab').click();
          assert.equal(await page.locator('.transit-segment input[data-transit-field="duration"]').first().inputValue(), '23', 'Returning from Naver restores unsaved movement input');
          await page.locator('#itineraryTransitRouteTab').click();
        } else {
          assert.equal(await mapLink.getAttribute('target'), '_blank');
          const [popup] = await Promise.all([page.waitForEvent('popup'), mapLink.click()]);
          await popup.waitForURL('https://map.naver.com/**');
          assert.equal(new URL(popup.url()).searchParams.get('stext'), '우도');
          assert.equal(new URL(popup.url()).searchParams.get('etext'), '성산일출봉');
          await popup.close();
        }
      }
      await resolved(); const lookupsBeforeReopen = requests.length;
      await close(); await open(); await resolved(); assert.equal(requests.length, lookupsBeforeReopen, 'Reopening uses the verified cache');
      assert.equal(await page.evaluate(() => domesticMapViews.size), 1, 'Reopening reuses its map instance'); await close();
      await page.locator('#itineraryAddButton').click(); await page.locator('#itineraryRouteButton').click();
      assert.ok((await page.locator('#googleMapsLink').getAttribute('href')).includes('slat='), 'Full-day route uses the same resolved places');
      await page.locator('#itineraryEditorClose').click();

      if (!live) {
        // Retry actual transport failure, not a manually supplied coordinate.
        await page.evaluate(() => domesticRouteCache.clear()); fail = true;
        await open(); await page.locator('#itineraryTransitMapRetry').waitFor({ state: 'visible' });
        assert.match(await page.locator('#itineraryTransitNaver p').innerText(), /네이버지도에서 도착지를 검색/);
        assert.equal(await page.locator('#itineraryTransitGoogleLink').isVisible(), true);
        assert.equal(await mapLink.isVisible(), true);
        assert.equal(await mapLink.getAttribute('aria-label'), '네이버지도에서 도착지 검색');
        assert.match(new URL(await mapLink.getAttribute('href')).pathname, /^\/p\/search\//);
        await page.screenshot({ path: path.join(output, `lookup-unavailable-${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' });
        fail = false; await page.locator('#itineraryTransitMapRetry').click(); await resolved(); await close();
        // An old response cannot replace a newly opened route or reopen a modal.
        await page.evaluate(() => domesticRouteCache.clear()); delay = 550;
        await open(); await close();
        await page.waitForFunction(() => domesticRouteRequests.size === 0);
        assert.equal(await page.locator('#itineraryTransitDialog').getAttribute('open'), null);
        assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(state.itineraryItems))), before);
        await page.evaluate(() => domesticRouteCache.clear());
        await page.locator('#itineraryAddButton').click(); await page.locator('#itineraryRouteButton').click();
        await page.waitForFunction(() => document.querySelector('#googleMapsLink').href.includes('slat=') && document.querySelector('#naverMapPreview').getAttribute('aria-busy') === 'false');
        assert.equal(await page.locator('#naverMapPreview ol a').count(), 2);
        assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(state.itineraryItems))), before);
        await page.locator('#itineraryEditorClose').click();
        const candidates = await page.evaluate(() => {
          const base = { name: '우도', countrycode: 'kr', source: 'nominatim', location: '우도, 제주특별자치도', lat: 33.5, lon: 126.95 };
          return { ambiguous: pickDomesticRouteCandidate([base, { ...base, lat: 33.2 }], { place: '우도' }, state),
            unrelated: pickDomesticRouteCandidate([{ ...base, name: '우도 식당' }], { place: '우도' }, state),
            wrongRegion: pickDomesticRouteCandidate([{ ...base, location: '우도, 전라남도' }], { place: '우도' }, state) };
        });
        assert.deepEqual(candidates, { ambiguous: null, unrelated: null, wrongRegion: null });
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${live ? 'LIVE geocoding' : mobile ? 'mobile' : 'desktop'}: name-only Udo -> Seongsan, no API key, populated Naver route, legacy coordinates ignored, no trip mutation, cache/mode changes/rate limit${live ? '' : '/retry/closed-dialog/ambiguous-place guards'}.`);
      if (live) console.log(`Verified route: ${url.toString()}`);
      await context.close();
    }
    console.log(`Route screenshots: ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
