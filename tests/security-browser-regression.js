const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, startServer, stopServer, blockExternalRequests } = require('./helpers/browser-fixture');
const { artifactDirectory } = require('../scripts/helpers/artifact-output');

(async () => {
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await blockExternalRequests(context, origin);
    const page = await context.newPage();
    await page.goto(origin + '/Travel?page=start');
    await page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true');
    const flag = await page.evaluate(() => {
      setNewTripCountryFlag({ flagImage: '/missing-flag.png', flag: '🌐' });
      const image = document.querySelector('#newTripCountryFlag img');
      image.dispatchEvent(new Event('error'));
      return { hidden: image.hidden, fallbackVisible: !image.nextElementSibling.hidden, inlineHandler: image.hasAttribute('onerror') };
    });
    assert.deepEqual(flag, { hidden: true, fallbackVisible: true, inlineHandler: false });
    const result = await page.evaluate(async () => {
      const violations = [];
      document.addEventListener('securitypolicyviolation', event => violations.push(event.violatedDirective));
      const probe = document.createElement('div');
      probe.innerHTML = '<img src="/missing-security-probe.png" onerror="window.securityProbe=1">';
      document.body.appendChild(probe);
      const script = document.createElement('script'); script.textContent = 'window.securityProbe=2'; document.head.appendChild(script);
      await new Promise(resolve => setTimeout(resolve, 250));
      probe.remove(); script.remove();
      return { executed: window.securityProbe || false, violations, sdk: typeof window.supabase?.createClient };
    });
    assert.equal(result.executed, false, 'Injected inline scripts and event handlers must not execute');
    assert(result.violations.some(value => value.startsWith('script-src')));
    assert.equal(result.sdk, 'function', 'Bundled authentication SDK still loads');
    const ocr = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 220;
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#000'; context.font = '64px Arial'; context.fillText('TOTAL 12345', 50, 130);
      const api = window.TripLog.features.expenses.receiptOcr;
      try { return (await api.recognize(canvas, 'eng', () => {}, new AbortController().signal)).map(row => row.text).join(' '); }
      finally { api.release(); }
    });
    assert.match(ocr, /12345/, 'Local OCR Worker and WebAssembly remain functional under CSP');
    fs.writeFileSync(path.join(artifactDirectory('security-browser'), 'results.json'), JSON.stringify({ ...result, flag, ocr }, null, 2));
    await context.close();
    console.log('PASS browser security: real CSP blocks script/event injection; local SDK, flag fallback and OCR Worker/WebAssembly remain functional.');
  } finally { await browser.close(); await stopServer(server); }
})().catch(error => { console.error(error); process.exitCode = 1; });
