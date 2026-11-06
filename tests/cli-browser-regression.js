'use strict';
// Browser plugin not available. Use the repository's isolated Playwright workflow.
// Flow: CLI creates a trip -> web itinerary renders -> web edit reaches CLI ->
// CLI edit refreshes the web itinerary -> export is readable at desktop/mobile sizes.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const { launchBrowser, startServer, stopServer } = require('./helpers/browser-fixture');
const { startCliFixture } = require('./helpers/cli-fixture');
const M = require('../src/app/sync/model');
const root = path.resolve(__dirname, '..');
const output = artifactDirectory('cli-browser');
async function main() {
  const fixture = await startCliFixture(), app = await startServer(), browser = await launchBrowser();
  const errors = [], consoleErrors = [];
  async function cli(args) {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(root, 'bin/triplog.js'), ...args, '--json'], { windowsHide: true, cwd: root, env: { ...process.env, TRIPLOG_CLI_HOME: path.join(output, 'home'), TRIPLOG_URL: fixture.origin, TRIPLOG_PUBLISHABLE_KEY: 'sb_publishable_cli_fixture', TRIPLOG_ACCESS_TOKEN: fixture.actors[0] }, stdio: ['ignore', 'pipe', 'pipe'] });
      const chunks = [], stderr = []; child.stdout.on('data', chunk => chunks.push(chunk)); child.stderr.on('data', chunk => stderr.push(chunk)); child.once('error', reject); child.once('exit', code => code ? reject(new Error(Buffer.concat([...chunks, ...stderr]).toString())) : resolve(JSON.parse(Buffer.concat(chunks).toString()).data));
    }); return result;
  }
  try {
    const created = await cli(['trip', 'create', '--name', '순천 CLI 연동 검증', '--start', '2026-11-07', '--end', '2026-11-09', '--city', '순천']);
    await cli(['itinerary', 'add', '--trip', created.tripId, '--date', '2026-11-07', '--time', '10:00', '--end-time', '11:00', '--place', '순천만 국가정원', '--trans', 'bus', '--duration', '20', '--cost', '4000', '--sync-expense', 'true']);
    await cli(['expense', 'add', '--trip', created.tripId, '--date', '2026-11-07', '--category', '식비', '--description', '정원 점심', '--amount', '18000']);
    await cli(['reservation', 'add', '--trip', created.tripId, '--type', 'stay', '--title', '순천 호텔', '--date', '2026-11-07', '--end-date', '2026-11-09']);
    const shown = await cli(['trip', 'show', '--trip', created.tripId]), seed = shown.snapshot;
    const item = seed.itineraryItems.find(row => row.place === '순천만 국가정원');
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    context.setDefaultTimeout(20000);
    await context.exposeBinding('__cliFixtureGateway', async (_, body) => {
      const response = await fetch(`${fixture.origin}/functions/v1/triplog-sync`, { method: 'POST', headers: { Authorization: `Bearer ${fixture.actors[0]}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json(); return response.ok ? data : { error: data.code };
    });
    await context.addInitScript(({ origin, seed, actor }) => {
      if (location.origin !== origin) return;
      if (!localStorage.getItem('cli-seeded')) { localStorage.setItem('cli-seeded', '1'); localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([seed])); localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', seed.id); }
      window.__cliActor = actor;
    }, { origin: app.origin, seed, actor: fixture.actors[0] });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/vendor/supabase-js-2.107.0.min.js')) return route.fulfill({ contentType: 'application/javascript', body: `window.supabase={createClient(){const listeners=new Set();window.__cliBroadcast=()=>listeners.forEach(fn=>fn());return {auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},async getSession(){return {data:{session:{user:{id:window.__cliActor,email:'fixture@example.test',user_metadata:{display_name:'CLI 검증'}}}},error:null}}},functions:{async invoke(name,{body}){const result=await window.__cliFixtureGateway(body);return result.error?{error:{context:{json:async()=>({code:result.error})}}}:{data:result,error:null}}},channel(){let cb;return {on(type,filter,fn){if(type==='broadcast'){cb=fn;listeners.add(fn)}return this},subscribe(fn){queueMicrotask(()=>fn('SUBSCRIBED'));return this},track(){},presenceState(){return {}},_remove(){listeners.delete(cb)}}},removeChannel(channel){channel._remove()}}}};` });
      return url.origin === app.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url }); });
    await page.goto(`${app.origin}/Travel?page=itinerary&trip=${encodeURIComponent(seed.id)}`);
    await page.waitForFunction(id => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && state.id === id && window.TripLogSyncRepository.cached(id)?.serverId, seed.id);
    await page.evaluate(async () => { for (const conflict of window.TripLogSyncRepository.cached(state.id).conflicts) await window.TripLog.sync.controller.engine.resolve(state.id, conflict.id, 'server'); });
    await page.waitForFunction(() => window.TripLogSyncRepository.cached(state.id).queue.length === 0);
    assert.equal(await page.title(), '여행 가계부'); assert((await page.locator('body').innerText()).includes('순천만 국가정원'));
    assert.equal(await page.locator('nextjs-portal, vite-error-overlay').count(), 0);
    await page.locator(`[data-itinerary-action="edit"][data-id="${item.id}"]`).last().click();
    await page.locator('#itineraryExtraDetails > summary').click();
    await page.locator('#itineraryMemoInput').fill('웹에서 입력한 메모');
    await page.locator('#itinerarySubmitButton').click(); await page.locator('#itineraryEditor').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.TripLogSyncRepository.cached(state.id).queue.length === 0);
    assert.equal((await cli(['itinerary', 'show', '--trip', created.tripId, '--id', item.id])).memo, '웹에서 입력한 메모');
    await cli(['itinerary', 'update', '--trip', created.tripId, '--id', item.id, '--place', 'CLI에서 변경한 국가정원', '--cost', '6500']);
    await page.evaluate(() => window.__cliBroadcast());
    await page.waitForFunction(id => state.itineraryItems.find(row => row.id === id)?.place === 'CLI에서 변경한 국가정원', item.id);
    assert.equal(await page.evaluate(() => state.entries.reduce((sum, entry) => sum + entry.amount, 0)), 24500);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, 'cli-web-desktop.png'), fullPage: false, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'cli-web-mobile.png'), fullPage: false, animations: 'disabled' });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const pdf = path.join(output, 'trip-report.pdf'), html = path.join(output, 'trip-report.html');
    await cli(['report', 'export', '--trip', created.tripId, '--format', 'pdf', '--out', pdf, '--overwrite']);
    await cli(['report', 'export', '--trip', created.tripId, '--format', 'html', '--out', html, '--overwrite']);
    assert((await fs.readFile(pdf)).subarray(0, 5).equals(Buffer.from('%PDF-')));
    const reportContext = await browser.newContext({ viewport: { width: 960, height: 1100 } }); await reportContext.route('**/*', route => route.abort());
    const reportPage = await reportContext.newPage(); await reportPage.setContent(await fs.readFile(html, 'utf8'));
    assert((await reportPage.locator('body').innerText()).includes('24500') || (await reportPage.locator('body').innerText()).includes('24,500'));
    assert.equal(await reportPage.locator('tbody tr').count(), 2);
    await reportPage.screenshot({ path: path.join(output, 'cli-report.png'), fullPage: true });
    const expectedExternalBlocks = consoleErrors.filter(error => error.text === 'Failed to load resource: net::ERR_FAILED' && /^(https:\/\/fonts\.googleapis\.com\/|https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@|https:\/\/(tile|nominatim)\.openstreetmap\.org\/)/.test(error.url));
    const applicationErrors = consoleErrors.filter(error => !expectedExternalBlocks.includes(error));
    assert.deepEqual(errors, []); assert.deepEqual(applicationErrors, []);
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, browser: 'Playwright', reason: 'Browser plugin not available', viewports: ['1440x1000', '390x844'], identity: await page.title(), pageErrors: errors, applicationErrors, expectedExternalBlocks, checks: ['CLI to web', 'web to CLI', 'linked expense parity', 'no horizontal overflow', 'PDF and HTML export'], productionDataUsed: false }, null, 2));
    console.log('PASS CLI browser: CLI ↔ web edits, atomic linked cost, desktop/mobile rendering, no application errors, and HTML/PDF exports (external fonts/maps intentionally blocked).');
  } finally { await browser.close(); await stopServer(app.server); await fixture.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
