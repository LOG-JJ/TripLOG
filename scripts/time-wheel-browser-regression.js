const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, seedTrip, startServer, stopServer } = require('./helpers/browser-fixture');
// Browser plugin unavailable: use the repository's isolated Playwright/Edge workflow.
// External requests are blocked. No real account, trip, or server data is edited.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('time-wheel');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  let page;
  try {
    const recordDemo = !!process.env.TRIPLOG_RECORD_DEMO;
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: recordDemo ? { width: 560, height: 900 } : { width: 1440, height: 1100 }, ...(recordDemo ? { recordVideo: { dir: output, size: { width: 560, height: 900 } } } : {}) });
    context.setDefaultTimeout(12000);
    const user = { id: '00000000-0000-4000-8000-000000000099', email: 'controls@example.test', user_metadata: { display_name: '컨트롤 시험' } };
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const token = fixtureToken(user, expiry);
    const seed = { id: 'controls-fixture', tripName: '교토 여행', city: '교토', country: '일본', travelMode: 'overseas', startDate: '2026-09-25', endDate: '2026-09-28', entries: [], companions: [], packingList: [], itineraryItems: [] };
    await seedTrip(context, { origin, user, expiry, token, seed });
    await blockExternalRequests(context, origin);
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    async function ready() {
      await page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && document.documentElement.dataset.appReady === 'true');
    }
    async function capture(selector, name) {
      const node = page.locator(selector); await node.waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, `${name}-context.png`), animations: 'disabled' });
      await node.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
      const box = await node.boundingBox(), viewport = page.viewportSize();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${name} must fit the viewport: ${JSON.stringify(box)}`);
    }

    await page.goto(`${origin}/Travel?page=itinerary`); await ready();
    await page.evaluate(() => setActivePage('itinerary'));
    await page.locator('#itineraryAddButton').click();
    const panel = page.locator('#itineraryTimeInputPanel');
    const field = page.locator('#itineraryTimeInput');
    const trigger = page.locator('#itineraryTimeInputText');
    const hour = panel.locator('[data-time-part-input="hour"]');
    const minute = panel.locator('[data-time-part-input="minute"]');
    const wheel = panel.locator('[data-time-wheel="hour"]');
    const minuteWheel = panel.locator('[data-time-wheel="minute"]');
    const confirm = panel.locator('[data-time-action="close"]');
    const settled = () => page.waitForFunction(() => !document.querySelector('#itineraryTimeInputPanel [data-animating]'));
    async function reset(value = '09:30') {
      await page.evaluate(value => {
        const input = document.querySelector('#itineraryTimeInput');
        closeCustomTimePicker(input, { commit: false }); input.value = value;
        syncCustomTimePicker(input); openCustomTimePicker(input);
        window.__timeEvents = { input: 0, change: 0 };
        if (!input.dataset.observed) {
          input.dataset.observed = 'true';
          input.addEventListener('input', () => window.__timeEvents.input++);
          input.addEventListener('change', () => window.__timeEvents.change++);
        }
      }, value);
    }
    const actualValue = () => field.inputValue();
    await reset();
    assert.equal(await hour.evaluate(e => getComputedStyle(e).fontSize), '18px');
    assert.equal(await panel.locator('.time-wheel-label').first().evaluate(e => getComputedStyle(e).fontSize), '13px');
    await capture('#itineraryTimeInputPanel', 'time-compact-desktop');
    if (recordDemo) {
      const box = await panel.boundingBox();
      fs.writeFileSync(path.join(output, 'demo-crop.json'), JSON.stringify({ x: Math.max(0, Math.floor(box.x - 8)), y: Math.max(0, Math.floor(box.y - 55)), width: Math.ceil(box.width + 16), height: Math.ceil(box.height + 70) }));
      await page.waitForTimeout(800);
      await wheel.locator('[data-time-option="11"]').nth(1).click(); await settled();
      await page.waitForTimeout(550);
      const bounds = await minuteWheel.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 40); await page.mouse.wheel(0, 108);
      await page.waitForTimeout(950);
      await hour.focus(); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(160); await page.keyboard.press('ArrowUp');
      await settled(); await page.waitForTimeout(600);
      await minute.focus(); await page.keyboard.press('ArrowDown'); await settled();
      await page.waitForTimeout(800);
      await panel.screenshot({ path: path.join(output, 'time-final-demo.png') });
      await page.waitForTimeout(500);
      console.log('Recorded actual time-picker interactions for preview.');
      return;
    }
    // Record intermediate rendered positions, not just the final DOM value.
    await page.evaluate(() => {
      window.__motionFrames = [];
      const end = performance.now() + 750;
      function sample(now) {
        const list = document.querySelector('#itineraryTimeInputPanel [data-time-wheel="hour"]');
        window.__motionFrames.push({ top: list.scrollTop, visual: list.dataset.visualValue, actual: document.querySelector('#itineraryTimeInput').value });
        if (now < end) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    const start = await wheel.evaluate(e => e.scrollTop);
    await wheel.locator('[data-time-option="11"]').nth(1).click();
    assert.equal(await actualValue(), '11:30');
    await settled();
    const finish = await wheel.evaluate(e => e.scrollTop);
    const samples = await page.evaluate(() => window.__motionFrames);
    const middle = new Set(samples.filter(s => s.top > start + 1 && s.top < finish - 1).map(s => Math.round(s.top)));
    assert(middle.size >= 3, `Click must animate intermediate frames; observed ${middle.size}`);
    assert(samples.some(s => s.actual === '11:30' && s.top < finish - 1), 'Selection updates immediately while visual motion continues');
    await hour.focus();
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');
    await settled();
    assert.equal(await actualValue(), '19:30', 'Rapid key input retains the latest requested value');
    assert.equal(await wheel.getAttribute('data-visual-value'), '19');
    await reset('23:59');
    await hour.focus(); await page.keyboard.press('ArrowUp');
    await minute.focus(); await page.keyboard.press('ArrowUp');
    await settled(); assert.equal(await actualValue(), '00:00');
    await minute.press('ArrowDown'); await settled(); assert.equal(await actualValue(), '00:59');
    assert.equal(await minuteWheel.getAttribute('data-visual-value'), '59');
    // Native scroll must update before the old 140 ms idle debounce would run.
    await reset();
    await wheel.evaluate(list => { list.scrollTop += list.firstElementChild.offsetHeight * 1.2; });
    await page.waitForFunction(() => document.querySelector('#itineraryTimeInput').value === '10:30', null, { timeout: 1000 });
    await settled();
    const wheelBox = await wheel.boundingBox();
    await page.mouse.move(wheelBox.x + 20, wheelBox.y + 55); await page.mouse.wheel(0, 72);
    await page.waitForFunction(() => document.querySelector('#itineraryTimeInput').value === '12:30');
    await settled();
    // Mouse drag includes bounded momentum and still snaps to a complete row.
    await reset();
    await page.mouse.move(wheelBox.x + 40, wheelBox.y + 150); await page.mouse.down();
    await page.mouse.move(wheelBox.x + 40, wheelBox.y + 65, { steps: 12 }); await page.mouse.up();
    await settled();
    assert.notEqual(await actualValue(), '09:30');
    assert.equal(await wheel.evaluate(list => list.scrollTop % list.firstElementChild.offsetHeight), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await reset();
    await page.mouse.move(wheelBox.x + 40, wheelBox.y + 150); await page.mouse.down();
    await page.mouse.move(wheelBox.x + 40, wheelBox.y + 65, { steps: 6 }); await page.mouse.up();
    await page.mouse.click(wheelBox.x + wheelBox.width / 2, wheelBox.y + wheelBox.height / 2);
    assert.equal(await panel.locator('.is-editing').count(), 1, 'A new center tap immediately after dragging must not be suppressed');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Committing mid-animation must preserve the requested target exactly once.
    await reset(); await hour.focus(); await page.keyboard.press('PageUp'); await confirm.click();
    assert.equal(await actualValue(), '14:30');
    assert.equal(await page.evaluate(() => window.__timeEvents.change), 1);
    // The chevron works even after focus was restored to the time text field.
    await page.locator('[data-time-id="itineraryTimeInput"] .custom-select-chevron').click();
    assert.equal(await panel.isVisible(), true);
    await hour.press('PageUp'); await page.keyboard.press('Escape');
    assert.equal(await actualValue(), '14:30');
    assert.equal(await panel.locator('[data-animating]').count(), 0);
    await reset(); await hour.fill('07'); await minute.fill('45');
    await minute.press('Enter'); assert.equal(await actualValue(), '07:45');
    await trigger.click(); await hour.fill('99'); await minute.fill('99');
    await confirm.click(); assert.equal(await actualValue(), '23:59');
    await reset(); await hour.focus(); await page.keyboard.press('PageUp');
    await panel.locator('[data-time-action="clear"]').click();
    assert.equal(await actualValue(), ''); assert.equal(await panel.locator('[data-animating]').count(), 0);
    await reset(); await page.emulateMedia({ reducedMotion: 'reduce' });
    await hour.focus(); await page.keyboard.press('ArrowUp');
    assert.equal(await actualValue(), '10:30');
    assert.equal(await panel.locator('[data-animating]').count(), 0);
    assert.equal(await wheel.getAttribute('data-visual-value'), '10');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Realistic mobile touch uses the same scroller, including the center band.
    await page.setViewportSize({ width: 390, height: 844 }); await reset();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await reset();
    assert.equal(await page.locator('[data-time-id="itineraryTimeInput"] .custom-time-button > .ph-clock').count(), 0, 'No duplicate clock/left chevron from the old itinerary decorator');
    assert.equal(await page.locator('[data-time-id="itineraryTimeInput"] .custom-time-icon svg').count(), 1);
    // Switching an existing desktop context to touch can resize/reposition the
    // focused dialog on the next frame. Touch the final rendered coordinates.
    await wheel.evaluate(list => new Promise(resolve => {
      let previous = '', sameFrames = 0;
      function check() {
        const box = list.getBoundingClientRect();
        const current = [box.x, box.y, box.width, box.height].join(',');
        sameFrames = current === previous ? sameFrames + 1 : 0; previous = current;
        if (sameFrames >= 3) resolve(); else requestAnimationFrame(check);
      }
      requestAnimationFrame(check);
    }));
    assert.equal(await wheel.evaluate(list => list.firstElementChild.offsetHeight), 44);
    const touchBox = await wheel.boundingBox();
    const x = touchBox.x + touchBox.width / 2, y = touchBox.y + touchBox.height / 2;
    await wheel.evaluate(list => {
      window.__touchProbe = [];
      for (const type of ['pointerdown','pointermove','pointercancel','pointerup','scroll','touchstart','touchmove','touchend']) {
        list.addEventListener(type, event => window.__touchProbe.push({ type, top: list.scrollTop, actual: document.querySelector('#itineraryTimeInput').value, target: event.target.className, y: event.clientY, at: performance.now() }), { passive: true });
      }
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 8 }] });
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('#itineraryTimeInput').value !== '09:30');
    await page.waitForFunction(() => {
      const list = document.querySelector('#itineraryTimeInputPanel [data-time-wheel="hour"]');
      return !list.dataset.animating && list.scrollTop % list.firstElementChild.offsetHeight === 0;
    });
    await capture('#itineraryTimeInputPanel', 'time-touch-mobile');
    await reset();
    await page.locator('#itineraryTimeInputPanel').screenshot({ path: path.join(output, 'time-final-mobile.png') });
    // Center tap enters direct editing; dragging from the center did not open a keyboard.
    const editingBefore = await panel.locator('.is-editing').count(); assert.equal(editingBefore, 0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('#itineraryTimeInputPanel .is-editing'));
    await hour.fill('08'); await confirm.click(); assert.equal(await actualValue(), '08:30');
    await page.locator('#itineraryPlaceInput').fill('시간 애니메이션 검증');
    await page.locator('#itinerarySubmitButton').click();
    await page.waitForFunction(() => state.itineraryItems.some(item => item.place === '시간 애니메이션 검증' && item.time === '08:30'));
    await page.reload(); await ready();
    assert(await page.evaluate(() => state.itineraryItems.some(item => item.place === '시간 애니메이션 검증' && item.time === '08:30')));
    assert.deepEqual(errors, []);
    console.log(`PASS time motion: ${middle.size} intermediate positions, live scroll value, rapid keys, mouse drag/inertia, 23/00 and 59/00 wrap, interruption/confirm/cancel/clear, typing/clamping, reduced motion, CDP touch scroll/center edit, stored value after reload. Screenshots: ${output}`);
  } catch (error) {
    if (page) console.error(await page.evaluate(() => JSON.stringify({ events: window.__touchProbe, active: document.activeElement?.outerHTML?.slice(0,250), view: {width: innerWidth,height:innerHeight} })).catch(() => ''));
    if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    throw error;
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
