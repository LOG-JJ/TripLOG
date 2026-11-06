const { launchBrowser, blockExternalRequests } = require('./helpers/browser-fixture');
// Real service-worker checks in an isolated browser/account; no production writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { createTripHeaderPreview } = require('../scripts/preview-trip-header');
const cityRoot = '/src/assets/trip-scenes/cities/v99/';
const sceneData = require('../src/app/data/destination-scenes');
const suncheon = sceneData.catalog.find(city => city.id === 'kr-suncheon');
const osaka = sceneData.catalog.find(city => city.id === 'jp-osaka');
const incheon = sceneData.catalog.find(city => city.id === 'kr-incheon');
const tirana = sceneData.catalog.find(city => city.id === 'al-tirana');
const suncheonDesktop = '/' + suncheon.src;
const suncheonMobile = '/' + suncheon.mobileSrc;
const osakaMobile = '/' + osaka.mobileSrc;
const incheonMobile = '/' + incheon.mobileSrc;
const tiranaMobile = '/' + tirana.mobileSrc;
async function main() {
  const worker = fs.readFileSync('sw.js', 'utf8');
  const assets = JSON.parse(worker.match(/const ASSETS = (\[[^;]+\]);/)[1]);
  assert(!assets.some(file => file.includes('/trip-scenes/cities/')), 'City artwork is never installed with the app shell');
  const themeAssets = Object.values(sceneData.themes).flatMap(theme => [theme.src, theme.mobileSrc]);
  assert.equal(themeAssets.length, 20, 'Ten themes each have desktop and mobile artwork');
  for (const file of themeAssets) assert(assets.includes('/' + file), 'Offline theme is bundled: ' + file);
  const base = createTripHeaderPreview({ serviceWorkers: true }), requested = new Set();
  const tinyImage = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/src/assets/trip-scenes/cities/')) requested.add(url.pathname);
    if (/\/cache-\d+\.webp$/.test(url.pathname)) return res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-store' }).end(tinyImage);
    if (url.pathname === cityRoot + 'missing.webp') return res.writeHead(200, { 'content-type': 'text/html' }).end('<html>Hosting fallback</html>');
    if (url.pathname === '/api/cache-probe') return res.writeHead(200, { 'content-type': 'application/json' }).end('{"private":true}');
    base.emit('request', req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
    context.setDefaultTimeout(30000);
    await blockExternalRequests(context, origin);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && Boolean(navigator.serviceWorker.controller));
    const cacheKeys = () => page.evaluate(async () => (await (await caches.open('triplog-destination-scenes-v1')).keys()).map(request => new URL(request.url).pathname));
    const imageReady = async suffix => {
      try { await page.waitForFunction(suffix => { const img = document.querySelector('.th-hero-scene img'); return img?.complete && img.naturalWidth > 0 && (img.currentSrc || img.getAttribute('src')).endsWith(suffix); }, suffix, { timeout: 10000 }); }
      catch (error) {
        console.error('Artwork load state', await page.locator('.th-hero-scene img').evaluate(img => ({ currentSrc: img.currentSrc, src: img.getAttribute('src'), naturalWidth: img.naturalWidth, complete: img.complete, hidden: img.hidden, source: img.parentElement.querySelector('source')?.outerHTML })));
        console.error('Runtime errors', errors);
        throw error;
      }
    };
    const select = async id => {
      await page.locator('#rdOverviewTripButton').click();
      await page.locator('#rdTripSearch').fill('');
      await page.locator(`#rdTripChooser [data-rd-action="trip-select"][data-id="${id}"]`).click();
      await page.locator('#rdTripChooser').waitFor({ state: 'hidden' });
      await page.waitForFunction(id => state.id === id, id);
    };
    await page.goto(`${origin}/Travel?page=overview&trip=trip-header-suncheon`); await ready();
    await imageReady(suncheonMobile);
    await page.waitForFunction(async source => Boolean(await (await caches.open('triplog-destination-scenes-v1')).match(source)), suncheonMobile);
    // Require the indexed key set used by the assertion, rather than only a
    // successful response lookup during the first cache write.
    await page.waitForFunction(async source => {
      const keys = await (await caches.open('triplog-destination-scenes-v1')).keys();
      return keys.length === 1 && new URL(keys[0].url).pathname === source;
    }, suncheonMobile);
    assert.deepEqual([...requested], [suncheonMobile], 'First load requests only the selected mobile illustration');
    assert.deepEqual(await cacheKeys(), [suncheonMobile]);
    await context.setOffline(true);
    await page.reload(); await ready(); await imageReady(suncheonMobile);
    await page.setViewportSize({ width: 1440, height: 1000 }); await imageReady('/wetland.webp');
    await context.setOffline(false);
    await select('trip-header-unknown'); await select('trip-header-suncheon'); await imageReady(suncheonDesktop);
    await page.setViewportSize({ width: 390, height: 844 }); await imageReady(suncheonMobile);
    await context.setOffline(true);
    await select('trip-header-osaka'); await imageReady('/urban.webp');
    assert.equal(await page.locator('.th-trip-hero').getAttribute('data-destination-id'), 'jp-osaka');
    assert(!(await cacheKeys()).some(key => key === '/' + osaka.src || key === osakaMobile), 'An offline fallback is not cached as a city illustration');
    await context.setOffline(false);
    await select('trip-header-suncheon'); await select('trip-header-osaka'); await imageReady('/jp-osaka-mobile.webp');
    await page.waitForFunction(async source => Boolean(await (await caches.open('triplog-destination-scenes-v1')).match(source)), osakaMobile);
    assert.deepEqual(new Set(await cacheKeys()), new Set([suncheonMobile, suncheonDesktop, osakaMobile]));
    console.log('PASS scene cache: only selected mobile art loads, first-visible-source warming, offline mobile reload, uncached desktop/city fallback, online art-direction recovery');
    assert(incheonMobile.includes('/cities/v5/'), 'Domestic expansion uses immutable v5 artwork');
    requested.clear();
    await select('trip-header-incheon'); await imageReady(incheonMobile);
    await page.waitForFunction(async source => Boolean(await (await caches.open('triplog-destination-scenes-v1')).match(source)), incheonMobile);
    assert.deepEqual([...requested], [incheonMobile], 'Selecting a new domestic destination fetches only its visible v5 image');
    assert(!(await cacheKeys()).includes('/' + incheon.src), 'The unselected desktop variant is not prefetched');
    await context.setOffline(true);
    await page.reload(); await ready(); await imageReady(incheonMobile);
    assert.equal(await page.locator('.th-trip-hero').getAttribute('data-destination-id'), 'kr-incheon');
    await context.setOffline(false);
    console.log('PASS scene cache: v5 domestic artwork loads on demand and survives an offline reload');
    assert(tiranaMobile.includes('/cities/v6/'), 'World expansion uses immutable v6 artwork');
    requested.clear();
    await select('trip-header-tirana'); await imageReady(tiranaMobile);
    await page.waitForFunction(async source => Boolean(await (await caches.open('triplog-destination-scenes-v1')).match(source)), tiranaMobile);
    assert.deepEqual([...requested], [tiranaMobile], 'Selecting a new world destination fetches only its visible v6 image');
    assert(!(await cacheKeys()).includes('/' + tirana.src), 'The unselected v6 desktop variant is not prefetched');
    await context.setOffline(true);
    await page.reload(); await ready(); await imageReady(tiranaMobile);
    assert.equal(await page.locator('.th-trip-hero').getAttribute('data-destination-id'), 'al-tirana');
    await context.setOffline(false);
    console.log('PASS scene cache: v6 world artwork loads on demand and survives an offline reload');
    const rejectsHtml = await page.evaluate(async root => { try { await fetch(root + 'missing.webp'); return false; } catch (_) { return true; } }, cityRoot);
    assert(rejectsHtml, 'A 200 HTML fallback is rejected as an image');
    assert(!(await cacheKeys()).some(key => key.endsWith('/missing.webp')));
    await page.evaluate(() => fetch('/api/cache-probe'));
    await page.evaluate(root => Promise.all(Array.from({ length: 55 }, (_, i) => fetch(root + `cache-${i}.webp`))), cityRoot);
    const keys = await cacheKeys();
    assert.equal(keys.length, 48, 'Optional image storage is bounded after concurrent requests');
    assert(keys.every(key => key.startsWith(cityRoot)));
    assert(!keys.includes(suncheonMobile) && !keys.includes(suncheonDesktop), 'Older illustrations are evicted before the app shell');
    assert(await page.evaluate(async () => {
      const build = document.querySelector('meta[name="triplog-build"]').content;
      return Boolean(await (await caches.open('triplog-shell-' + build)).match('/Travel.html'));
    }), 'Image eviction leaves the app shell available');
    assert.deepEqual(errors, []);
    console.log('PASS scene cache: non-image and API responses excluded, 48-entry bound under concurrent fetches, app shell retained, zero runtime errors');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
