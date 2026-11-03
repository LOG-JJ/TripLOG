const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, blockExternalRequests } = require('./helpers/browser-fixture');
// Browser plugin not available. Isolated Playwright/Edge fixtures exercise
// real wheel/touch scrolling without reading or changing production trips.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createReservationPocketPreview } = require('./preview-reservation-pockets');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('scroll-lock');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createReservationPocketPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    for (const width of [390, 320, 1440]) {
      const mobile = width < 600;
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: mobile ? 844 : 1000 }, hasTouch: mobile, isMobile: mobile });
      context.setDefaultTimeout(12000);
      await blockExternalRequests(context, origin);
      const page = await context.newPage(), errors = [], cdp = await context.newCDPSession(page);
      page.on('pageerror', error => errors.push(error.message));
      const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ x, y })) });
      const scrollState = () => page.evaluate(() => ({ rootClass: document.documentElement.className, root: getComputedStyle(document.documentElement).overflowY, body: getComputedStyle(document.body).overflowY, dialogs: [...document.querySelectorAll('dialog[open]')].map(el => el.id), y: scrollY, height: document.scrollingElement.scrollHeight }));
      async function assertBackgroundLocked(label) {
        const state = await scrollState();
        assert(state.dialogs.length > 0, label);
        assert.equal(state.root, 'hidden', `${label}: background is locked while a dialog remains open`);
      }
      async function assertPageScrolls(label) {
        await frame();
        const state = await scrollState();
        assert.deepEqual(state.dialogs, [], label);
        assert.notEqual(state.root, 'hidden', label);
        if (state.height <= await page.evaluate(() => innerHeight + 1)) return;
        // Reset only the test starting point; actual movement below must come
        // from native input, not a programmatic scroll that bypasses overflow.
        await page.evaluate(() => scrollTo(0, 0)); await frame();
        const before = await page.evaluate(() => scrollY);
        if (mobile) {
          await touch('touchStart', [[width / 2, 610]]);
          for (let i = 1; i <= 7; i++) { await touch('touchMove', [[width / 2, 610 - i * 35]]); await frame(); }
          await touch('touchEnd');
        } else { await page.mouse.move(width / 2, 550); await page.mouse.wheel(0, 380); }
        await frame();
        const after = await page.evaluate(() => scrollY);
        if (after <= before + 30) {
          await page.screenshot({ path: path.join(output, `blocked-${width}.png`) });
          assert.fail(`${label}: page did not scroll (${before} -> ${after}); ${JSON.stringify(state)}`);
        }
        assert.notEqual((await scrollState()).root, 'hidden', label);
        await page.evaluate(() => scrollTo(0, 0)); await frame();
      }
      const editor = page.locator('#itineraryEditor'), confirm = page.locator('#rdConfirm');
      const openFirst = () => page.locator('#itineraryList .timeline-stop .timeline-edit[data-itinerary-action="edit"]').first().click();
      const closeEditor = async () => { await page.locator('#itineraryEditorClose').click(); await editor.waitFor({ state: 'hidden' }); };
      await page.goto(`${origin}/Travel?page=itinerary&trip=reservation-empty-fixture`);
      await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in' && state.collaboration?.ownerId);
      assert.equal(await page.title(), '여행 가계부'); assert.match(page.url(), /page=itinerary/);
      await page.evaluate(async () => {
        state.itineraryItems = Array.from({ length: 12 }, (_, index) => ({ id: `scroll-stop-${index}`, date: state.startDate, time: `${String(8 + index).padStart(2, '0')}:00`, place: `스크롤 검증 장소 ${index + 1}`, theme: 'sightseeing', memo: '일정 편집과 창 전환 후 스크롤 확인', createdAt: index }));
        state.selectedItineraryDate = state.startDate; await saveAndRender();
      });
      assert(await page.locator('#itineraryList .timeline-stop').count() >= 10, 'Meaningful timeline content renders');
      await assertPageScrolls('Initial timeline');

      // Regression: closing the nested confirmation used to leave rd-modal-open
      // on html, because the underlying editor only removed its own class.
      await openFirst(); await page.locator('#itineraryDeleteButton').click();
      await confirm.waitFor({ state: 'visible' }); await assertBackgroundLocked('Nested delete confirmation');
      await page.locator('#rdConfirmCancel').click(); await confirm.waitFor({ state: 'hidden' });
      await assertBackgroundLocked('Cancel confirmation keeps editor open');
      await closeEditor(); await assertPageScrolls('Cancel deletion then close editor');

      await openFirst(); await page.locator('#itineraryDeleteButton').click();
      await confirm.locator('[data-rd-action="confirm-accept"]').click(); await editor.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#itineraryList .timeline-stop').count(), 11);
      await assertPageScrolls('Confirm deletion auto-closes editor');

      await openFirst(); await page.locator('#itineraryDeleteButton').click(); await page.keyboard.press('Escape');
      await confirm.waitFor({ state: 'hidden' }); await assertBackgroundLocked('Escape closes only top confirmation');
      await page.locator('#itinerarySubmitButton').click(); await editor.waitFor({ state: 'hidden' });
      await assertPageScrolls('Cancel then save editor');

      // Wallet -> itinerary -> wallet and inline packing must keep one valid scroll lock.
      await page.evaluate(async () => {
        state.travelCompanion.reservations.push({ id: 'scroll-reservation', type: 'activity', title: '스크롤 검증 입장권', date: state.startDate, reference: 'SCROLL-TICKET' });
        await saveAndRender(); window.TripLog.features.travelCompanion.workspace.open('wallet');
      });
      await page.locator('#ttCompanion:not([hidden])').waitFor();
      if (await page.locator('#ttCompanion .cx-past').count()) await page.locator('#ttCompanion .cx-past summary').click();
      await page.locator('#ttCompanion .cx-booking-title[data-id="manual:scroll-reservation"]').click();
      await page.locator('#ttReservationDetail [data-tt-action="reservation-link"]').click(); await editor.waitFor({ state: 'visible' });
      await assertBackgroundLocked('Wallet to itinerary handoff');
      await page.keyboard.press('Escape'); await editor.waitFor({ state: 'hidden' });
      await page.locator('#ttCompanion:not([hidden])').waitFor(); await assertPageScrolls('Closing itinerary returns to the wallet page');
      await page.locator('.rd-nav [data-trip-nav="itinerary"]').click(); await page.locator('#itineraryDayStrip [data-date]').first().click();
      await assertPageScrolls('Wallet return then close');

      await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('tools'));
      await page.locator('#ttCompanion [data-tt-action="packing-filter"][data-filter="all"]').click();
      await page.locator('#ttPackingAdd').waitFor({ state: 'visible' }); await assertPageScrolls('Inline packing editor remains part of the travel page');
      await page.locator('.rd-nav [data-trip-nav="itinerary"]').click(); await page.locator('#itineraryDayStrip [data-date]').first().click(); await assertPageScrolls('Close packing tools');

      await page.locator('#itineraryPageButton').click(); await page.locator('#triplogSyncStatus').waitFor({ state: 'visible' });
      await assertBackgroundLocked('Sync status dialog');
      await page.locator('#triplogSyncStatus .sync-close').click(); await assertPageScrolls('Close sync status');

      // A nested dialog must still scroll internally while the page is locked.
      await openFirst(); await assertBackgroundLocked('Editor background');
      const scroller = page.locator(mobile ? '.itinerary-editor-scroll' : '.itinerary-editor-sheet');
      await page.locator('#itineraryExtraDetails').evaluate(el => { el.open = true; });
      const box = await scroller.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 60); await page.mouse.wheel(0, 450); await frame();
      assert(await scroller.evaluate(el => el.scrollHeight <= el.clientHeight || el.scrollTop > 0), 'Editor content remains scrollable');
      await closeEditor(); await assertPageScrolls('Final editor close');
      await page.mouse.move(width / 2, 500); await page.mouse.wheel(0, 400); await frame();
      await page.screenshot({ path: path.join(output, `scroll-restored-${width}.png`), animations: 'disabled' });
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(`PASS scroll recovery: cancel/confirm/delete/save, Escape, wallet -> itinerary, packing tools, sync dialog, internal editor scroll and native touch/wheel scrolling at 320/390/1440px. ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
