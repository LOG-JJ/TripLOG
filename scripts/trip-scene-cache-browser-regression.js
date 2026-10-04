// Real service-worker checks in an isolated browser/account; no production writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright');
const { createTripHeaderPreview } = require('./preview-trip-header');
const cityRoot = '/src/assets/trip-scenes/cities/v1/';
async function main() {
  const worker = fs.readFileSync('sw.js', 'utf8');
  const assets = JSON.parse(worker.match(/const ASSETS = (\[[^;]+\]);/)[1]);
  assert(!assets.some(file => file.includes('/trip-scenes/cities/')), 'City artwork is never installed with the app shell');
  assert.equal(assets.filter(file => file.includes('/trip-scenes/themes/')).length, 10, 'The ten offline theme images are bundled');
  const base = createTripHeaderPreview({ serviceWorkers: true }), requested = new Set();
  const tinyImage = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith(cityRoot)) requested.add(url.pathname);
    if (/\/cache-\d+\.webp$/.test(url.pathname)) return res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-store' }).end(tinyImage);
    if (url.pathname === cityRoot + 'missing.webp') return res.writeHead(200, { 'content-type': 'text/html' }).end('<html>Hosting fallback</html>');
    if (url.pathname === '/api/cache-probe') return res.writeHead(200, { 'content-type': 'application/json' }).end('{"private":true}');
    base.emit('request', req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
    context.setDefaultTimeout(30000);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && Boolean(navigator.serviceWorker.controller));
    const cacheKeys = () => page.evaluate(async () => (await (await caches.open('triplog-destination-scenes-v1')).keys()).map(request => new URL(request.url).pathname));
    const imageReady = suffix => page.waitForFunction(suffix => { const img = document.querySelector('.th-hero-scene img'); return img?.complete && img.naturalWidth > 0 && img.getAttribute('src').endsWith(suffix); }, suffix);
    const select = async id => {
      await page.locator('#rdOverviewTripButton').click();
      await page.locator('#rdTripSearch').fill('');
      await page.locator(`#rdTripChooser [data-rd-action="trip-select"][data-id="${id}"]`).click();
      await page.locator('#rdTripChooser').waitFor({ state: 'hidden' });
      await page.waitForFunction(id => state.id === id, id);
    };
    await page.goto(`${origin}/Travel?page=overview&trip=trip-header-suncheon`); await ready();
    await imageReady('/kr-suncheon.webp');
    await page.waitForFunction(async () => Boolean(await (await caches.open('triplog-destination-scenes-v1')).match('/src/assets/trip-scenes/cities/v1/kr-suncheon.webp')));
    assert.deepEqual([...requested], [cityRoot + 'kr-suncheon.webp'], 'First load requests only its selected city');
    assert.deepEqual(await cacheKeys(), [cityRoot + 'kr-suncheon.webp']);
    await context.setOffline(true);
    await page.reload(); await ready(); await imageReady('/kr-suncheon.webp');
    await select('trip-header-osaka'); await imageReady('/urban.webp');
    assert.equal(await page.locator('.th-trip-hero').getAttribute('data-destination-id'), 'jp-osaka');
    assert(!(await cacheKeys()).includes(cityRoot + 'jp-osaka.webp'), 'An offline fallback is not cached as a city illustration');
    await context.setOffline(false);
    await select('trip-header-suncheon'); await select('trip-header-osaka'); await imageReady('/jp-osaka.webp');
    await page.waitForFunction(async () => Boolean(await (await caches.open('triplog-destination-scenes-v1')).match('/src/assets/trip-scenes/cities/v1/jp-osaka.webp')));
    assert.deepEqual(new Set(await cacheKeys()), new Set([cityRoot + 'kr-suncheon.webp', cityRoot + 'jp-osaka.webp']));
    console.log('PASS scene cache: no bulk city install, first-visible-city warming, cached city on offline reload, unseen city uses bundled theme and recovers online');
    const rejectsHtml = await page.evaluate(async root => { try { await fetch(root + 'missing.webp'); return false; } catch (_) { return true; } }, cityRoot);
    assert(rejectsHtml, 'A 200 HTML fallback is rejected as an image');
    assert(!(await cacheKeys()).some(key => key.endsWith('/missing.webp')));
    await page.evaluate(() => fetch('/api/cache-probe'));
    await page.evaluate(root => Promise.all(Array.from({ length: 55 }, (_, i) => fetch(root + `cache-${i}.webp`))), cityRoot);
    const keys = await cacheKeys();
    assert.equal(keys.length, 48, 'Optional image storage is bounded after concurrent requests');
    assert(keys.every(key => key.startsWith(cityRoot)));
    assert(!keys.includes(cityRoot + 'kr-suncheon.webp'), 'Older illustrations are evicted before the app shell');
    assert(await page.evaluate(async () => {
      const build = document.querySelector('meta[name="triplog-build"]').content;
      return Boolean(await (await caches.open('triplog-shell-' + build)).match('/Travel.html'));
    }), 'Image eviction leaves the app shell available');
    assert.deepEqual(errors, []);
    console.log('PASS scene cache: non-image and API responses excluded, 48-entry bound under concurrent fetches, app shell retained, zero runtime errors');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
