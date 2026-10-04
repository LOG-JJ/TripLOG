// Render every dedicated city in the real header, using an isolated fixture.
// These are visual/asset checks; the existing header suite owns live UI flows.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { createTripHeaderPreview } = require('./preview-trip-header');
const data = require('../src/app/data/destination-scenes');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || path.join(os.tmpdir(), 'TripLOG-City-Scene-Review-20261004');
const requestedIds = new Set((process.env.TRIPLOG_SCENE_REVIEW_IDS || '').split(',').map(id => id.trim()).filter(Boolean));
const cities = data.catalog.filter(entry => entry.dedicated && (!requestedIds.size || requestedIds.has(entry.id)));
for (const id of requestedIds) assert(cities.some(city => city.id === id), 'Unknown dedicated city requested for review: ' + id);
assert(cities.length, 'At least one dedicated city must be reviewed');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createTripHeaderPreview();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  const results = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', deviceScaleFactor: 1 });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/Travel?page=overview&trip=trip-header-suncheon');
    await page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && Boolean(state.collaboration?.ownerId));
    await page.evaluate(() => document.fonts.ready);
    const originalTrip = await page.evaluate(() => ({ id: state.id, name: state.tripName, city: state.city }));
    for (const width of [320, 390, 599, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      for (const city of cities) {
        await page.evaluate(city => {
          document.querySelector('.th-trip-hero').outerHTML = window.TripLog.features.overview.tripHero.render({
            trip: { countryCode: city.countryCodes[0], city: city.name, tripName: city.name + ' 여행' },
            countdown: 'D-6', period: '10.10 토 – 10.11 일', duration: '1박 2일', memberCount: 2,
          });
        }, city);
        const expected = width < 768 ? city.mobileSrc : city.src;
        assert(expected, city.id + ': responsive artwork is supplied');
        await page.waitForFunction(({ id, expected }) => {
          const panel = document.querySelector('.th-trip-hero'), image = panel?.querySelector('img');
          return panel?.dataset.destinationId === id && image?.complete && image.naturalWidth > 0 && image.currentSrc.endsWith('/' + expected);
        }, { id: city.id, expected });
        const metrics = await page.locator('.th-trip-hero').evaluate(panel => {
          const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          const image = panel.querySelector('img');
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let visible = 0, transparent = 0;
          for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] > 200) visible++; if (pixels[i] < 8) transparent++; }
          return {
            panel: rect(panel), copy: rect(panel.querySelector('.th-hero-copy')), art: rect(panel.querySelector('.th-hero-scene')),
            title: rect(panel.querySelector('.th-trip-name')), titleSize: parseFloat(getComputedStyle(panel.querySelector('.th-trip-name')).fontSize),
            imageFit: getComputedStyle(image).objectFit, imagePosition: getComputedStyle(image).objectPosition,
            visibleFraction: visible / (pixels.length / 4), transparentFraction: transparent / (pixels.length / 4),
            fits: panel.scrollWidth <= panel.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth,
          };
        });
        assert(metrics.fits, city.id + '/' + width + ': no overflow');
        assert(metrics.titleSize >= 20 && metrics.titleSize <= 40, city.id + ': requested title scale');
        assert(metrics.copy.right <= metrics.art.x + 1, city.id + ': information remains to the left of the artwork');
        assert(metrics.title.right <= metrics.art.x + 1, city.id + ': title does not cross the illustration');
        assert(Math.abs(metrics.panel.bottom - metrics.art.bottom) < 2, city.id + ': no empty band under artwork');
        assert.equal(metrics.imageFit, 'contain', city.id + '/' + width + ': wider phone slots keep the full portrait instead of cropping the foreground');
        assert.equal(metrics.imagePosition, '100% 100%', city.id + ': artwork touches the right and bottom edges');
        assert(metrics.visibleFraction > .1 && metrics.transparentFraction > .005, city.id + ': visible transparent illustration');
        const filename = city.id + '-' + width + '.png';
        await page.locator('.th-trip-hero').screenshot({ path: path.join(output, filename), animations: 'disabled' });
        results.push({ city: city.id, width, expected, filename, metrics });
      }
    }
    assert.deepEqual(await page.evaluate(() => ({ id: state.id, name: state.tripName, city: state.city })), originalTrip, 'Visual rendering never changes the saved trip');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, count: results.length, results }, null, 2));
    console.log('PASS city illustrations: ' + results.length + ' rendered city/viewport combinations, selected image variants, transparency, left/right layout, compact typography and preserved trip data. ' + output);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
