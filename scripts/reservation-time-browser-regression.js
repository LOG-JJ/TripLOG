const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, blockExternalRequests } = require('./helpers/browser-fixture');
// Browser plugin unavailable: isolated Playwright/Edge fixtures, no production
// requests. Compare the wallet with the shared picker in the itinerary editor.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createReservationPocketPreview } = require('./preview-reservation-pockets');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('reservation-time');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createReservationPocketPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: width > 600 ? 1000 : 844 }, hasTouch: width < 600, timezoneId: 'Asia/Seoul' });
      context.setDefaultTimeout(12000);
      await blockExternalRequests(context, origin);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const ready = () => page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in' && state.collaboration?.ownerId);
      const setFields = values => page.evaluate(values => {
        for (const [id, value] of Object.entries(values)) {
          const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, values);
      const panelFor = id => page.locator(`#${id}Panel`);
      const open = async id => { await page.locator(`[data-time-id="${id}"] .custom-time-toggle`).click(); await panelFor(id).waitFor({ state: 'visible' }); };
      const style = panel => panel.locator('.time-wheel-input').evaluateAll(inputs => inputs.map(input => {
        const cs = getComputedStyle(input);
        return Object.fromEntries(['backgroundColor', 'color', 'borderTopWidth', 'paddingTop', 'height', 'minHeight', 'fontSize', 'fontWeight', 'lineHeight', 'pointerEvents'].map(key => [key, cs[key]]));
      }));
      const editPart = async (panel, part, value) => {
        const frame = panel.locator('.time-wheel-frame').filter({ has: page.locator(`[data-time-part-input="${part}"]`) });
        const b = await frame.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        await frame.locator('.time-wheel-input').fill(value);
      };
      const checkBounds = async panel => {
        const b = await panel.boundingBox(), viewport = page.viewportSize();
        assert(b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1, `Time picker stays inside ${width}px viewport`);
      };
      await page.goto(`${origin}/Travel?page=overview&trip=reservation-empty-fixture`); await ready();
      await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('itinerary')); await page.locator('#itineraryAddButton').click();
      await setFields({ itineraryTimeInput: '06:00' }); await open('itineraryTimeInput');
      const baseline = await style(panelFor('itineraryTimeInput'));
      assert.equal(baseline[0].backgroundColor, 'rgba(0, 0, 0, 0)');
      await panelFor('itineraryTimeInput').locator('[data-time-part-input="hour"]').focus();
      await page.keyboard.press('ArrowUp');
      const focusedBaseline = await style(panelFor('itineraryTimeInput'));
      await page.keyboard.press('Escape'); await page.locator('#itineraryEditorClose').click();
      await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('overview'));
      await page.locator('[data-rd-action="companion-transport-new"]').click();
      await page.locator('#ttReservationName').fill('KTX 순천 → 용산');
      await setFields({ ttReservationTime: '20:44', ttReservationArrivalTime: '06:00', ttReservationArrivalDate: '2026-09-26' });
      await open('ttReservationArrivalTime');
      const panel = panelFor('ttReservationArrivalTime');
      await panel.screenshot({ path: path.join(output, `arrival-${width}.png`), animations: 'disabled' });
      await page.screenshot({ path: path.join(output, `arrival-context-${width}.png`), animations: 'disabled' });
      const actual = await style(panel);
      assert.deepEqual(actual, baseline, `Reservation wheel must use the same transparent overlay and row geometry as itinerary at ${width}px; actual ${JSON.stringify(actual)}`);
      await checkBounds(panel);
      assert.equal(await panel.locator('[data-time-wheel="hour"]').getAttribute('data-visual-value'), '6');
      assert.equal(await panel.locator('[data-time-wheel="minute"]').getAttribute('data-visual-value'), '0');
      const hour = panel.locator('[data-time-part-input="hour"]');
      await hour.focus(); await page.keyboard.press('ArrowUp');
      assert.deepEqual(await style(panel), focusedBaseline, 'Focus cannot paint a box over the selected time');
      assert.equal(await page.locator('#ttReservationArrivalTime').inputValue(), '07:00');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#ttReservationArrivalTime').inputValue(), '06:00');
      assert(await page.locator('#ttReservationEditor').isVisible(), 'Escape closes only the picker');
      await open('ttReservationArrivalTime');
      await panel.locator('[data-time-action="type"]').click();
      assert.equal(await panel.isVisible(), false, 'Direct input closes the reservation time picker');
      assert(await page.locator('#ttReservationEditor').isVisible(), 'Direct input keeps the reservation editor open');
      const text = page.locator('#ttReservationArrivalTimeText');
      assert(await text.evaluate(node => node === document.activeElement));
      await text.fill('0825'); await text.press('Enter');
      assert.equal(await page.locator('#ttReservationArrivalTime').inputValue(), '08:25');
      assert.equal(await page.locator('#ttReservationTime').inputValue(), '20:44', 'Arrival changes do not replace departure');
      await open('ttReservationTime');
      const departure = panelFor('ttReservationTime');
      assert.deepEqual(await style(departure), baseline);
      const wheel = departure.locator('[data-time-wheel="minute"]'), wheelBox = await wheel.boundingBox();
      await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + 30); await page.mouse.wheel(0, 80);
      await page.waitForFunction(() => document.querySelector('#ttReservationTime').value !== '20:44');
      await departure.locator('[data-time-action="close"]').click();
      const departureValue = await page.locator('#ttReservationTime').inputValue();
      await open('ttReservationArrivalTime'); await panel.locator('[data-time-action="clear"]').click();
      assert.equal(await page.locator('#ttReservationArrivalTime').inputValue(), '');
      await open('ttReservationArrivalTime'); await editPart(panel, 'hour', '08'); await editPart(panel, 'minute', '25');
      await panel.locator('[data-time-action="close"]').click();
      await page.locator('[form="ttReservationForm"][type="submit"]').click();
      await page.locator('#ttReservationEditor').waitFor({ state: 'hidden' });
      await page.reload(); await ready();
      assert.deepEqual(await page.evaluate(() => {
        const row = state.travelCompanion.reservations[0]; return [row.time, row.endTime, row.arrivalDate];
      }), [departureValue, '08:25', '2026-09-26']);
      assert.deepEqual(errors, []);
      console.log(`PASS reservation time ${width}: shared picker appearance, visible selected row, focus/explicit input/wheel, confirm/Escape/clear, independent departure/arrival, overnight save/reload`);
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
