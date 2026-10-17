const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, startServer, stopServer, blockExternalRequests } = require('./helpers/browser-fixture');
const { artifactDirectory } = require('./helpers/artifact-output');

(async () => {
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  const checks = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    await blockExternalRequests(context, origin);
    const page = await context.newPage();
    for (const route of ['/', '/Travel?page=start', '/Travel?page=itinerary']) {
      await page.goto(origin + route);
      await page.waitForFunction(() => document.querySelectorAll('link[rel="apple-touch-icon"]').length === 5);
      const links = await page.locator('link[rel="apple-touch-icon"]').evaluateAll(nodes => nodes.map(node => ({ href: node.href, sizes: node.getAttribute('sizes') || '180x180' })));
      assert.equal(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'), 'TripLOG');
      for (const link of links) {
        assert.match(new URL(link.href).pathname, /\/icons\/apple-touch-icon-\d+-[a-f0-9]{12}\.png$/);
        const response = await page.request.get(link.href);
        assert.equal(response.status(), 200);
        assert.match(response.headers()['content-type'], /image\/png/);
        const image = await response.body(), [size] = link.sizes.split('x').map(Number);
        assert.equal(image.readUInt32BE(16), size); assert.equal(image.readUInt32BE(20), size);
        assert.deepEqual(image, fs.readFileSync(path.join(__dirname, '..', new URL(link.href).pathname)));
      }
      checks.push({ route, links, title: 'TripLOG', status: 'passed' });
    }
    const output = artifactDirectory('app-icons');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ browser: 'isolated Edge; metadata/resource verification, not a physical iPhone installation', checks }, null, 2));
    console.log('PASS app icon browser: root/direct/start/itinerary entry metadata, five links, correct PNG resources and approved pixels; no sign-in required.');
    await context.close();
  } finally { await browser.close(); await stopServer(server); }
})().catch(error => { console.error(error); process.exitCode = 1; });
