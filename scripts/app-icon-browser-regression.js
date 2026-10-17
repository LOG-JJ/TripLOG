const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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
      await page.waitForFunction(() => document.querySelectorAll('link[rel="apple-touch-icon"]').length === 1);
      const links = await page.locator('link[rel="apple-touch-icon"]').evaluateAll(nodes => nodes.map(node => ({ href: node.href, sizes: node.getAttribute('sizes') || '180x180' })));
      assert.equal(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'), 'TripLOG');
      const verified = [];
      for (const link of links) {
        const [size] = link.sizes.split('x').map(Number);
        const inline = link.href.startsWith('data:image/png;base64,');
        assert.equal(inline, size === 180);
        let image;
        if (inline) {
          image = Buffer.from(link.href.split(',')[1], 'base64');
          // A separate installer image fetch is the reported failure. Prove the
          // supplied icon still decodes when every network connection is offline.
          await context.setOffline(true);
          try {
            const decoded = await page.evaluate(async href => {
              const image = new Image();
              image.src = href;
              await image.decode();
              return { width: image.naturalWidth, height: image.naturalHeight };
            }, link.href);
            assert.deepEqual(decoded, { width: 180, height: 180 });
          } finally { await context.setOffline(false); }
        } else {
          assert.match(new URL(link.href).pathname, /\/icons\/apple-touch-icon-\d+-[a-f0-9]{12}\.png$/);
          const response = await page.request.get(link.href);
          assert.equal(response.status(), 200);
          assert.match(response.headers()['content-type'], /image\/png/);
          image = await response.body();
        }
        assert.equal(image.readUInt32BE(16), size); assert.equal(image.readUInt32BE(20), size);
        assert.deepEqual(image, fs.readFileSync(path.join(__dirname, '..', `icons/triplog-icon-${size}.png`)));
        verified.push({ size, delivery: inline ? 'embedded PNG; decoded while offline' : 'PNG URL; HTTP 200', bytes: image.length, sha256: crypto.createHash('sha256').update(image).digest('hex') });
      }
      checks.push({ route, icons: verified, title: 'TripLOG', status: 'passed' });
    }
    const output = artifactDirectory('app-icons');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ browser: 'isolated Edge; metadata/resource verification, not a physical iPhone installation', checks }, null, 2));
    console.log('PASS app icon browser: root/start/itinerary metadata, one embedded Apple PNG decodes offline with approved bytes; no sign-in required.');
    await context.close();
  } finally { await browser.close(); await stopServer(server); }
})().catch(error => { console.error(error); process.exitCode = 1; });
