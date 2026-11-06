const assert = require('node:assert/strict');
const path = require('node:path');
const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const { launchBrowser, startServer, stopServer, blockExternalRequests, waitForApp } = require('./helpers/browser-fixture');
const { createSummaryPreview } = require('../scripts/preview-itinerary-summary');
const output = artifactDirectory('itinerary-summary');
async function main() {
  const { server, origin } = await startServer(createSummaryPreview), browser = await launchBrowser();
  const errors = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
    await blockExternalRequests(context, origin);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/Travel?page=itinerary&trip=summary-icons-fixture`); await waitForApp(page);
    await page.evaluate(() => document.fonts.ready);
    const day = date => page.locator(`[data-summary-day="${date}"]`);
    const first = day('2026-10-20'), second = day('2026-10-21');
    // Initial persistence may attach internal sync positions asynchronously.
    const readItems = () => page.evaluate(() => state.itineraryItems.map(({ _syncPosition, ...item }) => item));
    const original = await readItems();
    assert.equal(await page.locator('#itinerarySummaryTab').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('.itinerary-summary-day.is-open').count(), 0, 'New summary views start collapsed');
    assert.equal(await page.locator('.itinerary-summary-warning').count(), 0);
    assert.equal((await first.locator('[data-issue-kind="transit"]').innerText()).replace(/\s/g, ''), '?5');
    assert.deepEqual(await first.locator('.summary-preview-place > span').allTextContents(), ['나리타공항', '니시스가모 호텔', '멘야무사시', '도쿄도청']);
    assert.equal(await first.locator('.summary-preview-more').innerText(), '+4', 'Only the viewport limit hides stops; hotels stay in itinerary order');
    const links = await first.locator('.summary-route-link').evaluateAll(nodes => nodes.map(node => ({ missing: node.classList.contains('is-missing'), label: node.getAttribute('aria-label') })));
    assert.deepEqual(links.map(link => link.missing), [true, true, false]);
    assert.match(links[0].label, /나리타공항 → 니시스가모 호텔: 이동 시간 미입력 1구간/);
    assert.match(links[2].label, /1시간 10분/);
    const assetState = await page.locator('.summary-preview-place img').evaluateAll(nodes => nodes.map(node => ({ src: node.getAttribute('src'), ok: node.complete && node.naturalWidth > 0 })));
    assert(assetState.every(image => image.ok && image.src.startsWith('src/assets/noto-emoji/')), 'Previews load original local category SVGs');
    for (const width of [320, 390, 767, 768, 899, 900, 1440]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
      const limit = width >= 900 ? 8 : width >= 600 ? 6 : 4;
      await page.waitForFunction(({ date, count }) => document.querySelector(`[data-summary-day="${date}"]`).querySelectorAll('.summary-preview-place').length === count, { date: '2026-10-21', count: limit });
      assert.equal(await second.locator('.summary-preview-place').count(), limit, `Preview capacity adapts at ${width}px`);
      if (width >= 900) {
        assert.equal(await first.locator('.summary-preview-place').count(), 8, 'Desktop shows all eight Day 1 stops, including both hotel entries');
        assert.equal(await first.locator('.summary-preview-more').count(), 0, 'No remaining counter when all eight stops fit');
        assert.deepEqual(await first.locator('.summary-preview-place > span').allTextContents(), ['나리타공항', '니시스가모 호텔', '멘야무사시', '도쿄도청', '신주쿠 쇼핑', '저녁 카페', '신주쿠 산책', '니시스가모 호텔']);
      }
      const columns = await page.locator('.itinerary-summary-day').evaluateAll(cards => cards.map(card => Math.round(card.getBoundingClientRect().left)));
      assert.equal(new Set(columns).size, 1, `Dates stay in one column at ${width}px`);
      const fits = await page.locator('.itinerary-summary-day').evaluateAll(cards => cards.every(card => {
        const outer = card.getBoundingClientRect();
        return [...card.querySelectorAll('.summary-metric, .summary-issue-badge, .summary-preview-place, .summary-preview-more')].every(node => {
          const r = node.getBoundingClientRect(); return r.left >= outer.left - 1 && r.right <= outer.right + 1;
        });
      }));
      assert(fits, `Card controls fit at ${width}px`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if ([320, 390, 1440].includes(width)) {
        await first.screenshot({ path: path.join(output, `day-card-${width}.png`), animations: 'disabled' });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({ path: path.join(output, `viewport-${width}.png`), animations: 'disabled' });
        await page.screenshot({ path: path.join(output, `summary-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await first.locator('[data-issue-kind="transit"]').click();
    assert.equal(await first.locator('.itinerary-summary-issues li').count(), 5);
    assert.equal(await first.locator('.summary-issues-head b').getAttribute('aria-label'), '이동 시간 미입력 5구간');
    assert.equal(await first.locator('.summary-issue-action').count(), 5);
    assert.equal(await first.locator('.summary-issue-place img').count(), 10, 'Each missing route has actual origin and destination icons');
    assert.equal(await first.locator('.itinerary-summary-day-body').isVisible(), false, 'Checking missing travel does not expand the itinerary');
    await first.screenshot({ path: path.join(output, 'missing-segments-390.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    assert.equal(await first.locator('.itinerary-summary-issues').isVisible(), false);
    await first.locator('.summary-preview-more').click();
    assert.equal(await first.locator('.itinerary-summary-day-body li').count(), 8);
    assert.equal(await first.locator('.itinerary-summary-route').isVisible(), false);
    assert.equal(await first.locator('.itinerary-summary-toggle').evaluate(node => document.activeElement === node), true);
    assert.equal(await first.locator('.itinerary-summary-edit').isVisible(), true);
    await page.keyboard.press('Enter');
    assert.equal(await first.locator('.itinerary-summary-route').isVisible(), true);
    await day('2026-10-23').locator('[data-issue-kind="time"]').click();
    assert.equal(await day('2026-10-23').locator('.summary-issues-head b').getAttribute('aria-label'), '시각 미입력 1개');
    await page.keyboard.press('Escape');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__summaryCopy = text; } } }));
    await page.locator('#itinerarySummaryCopy').click();
    const copied = await page.evaluate(() => window.__summaryCopy);
    assert.match(copied, /니시스가모 호텔/); assert.match(copied, /이동 시간 미입력 5구간/); assert.match(copied, /차이나타운/);
    await page.locator('#itineraryEditTab').click(); await page.locator('#itinerarySummaryTab').click();
    assert.equal(await first.locator('.itinerary-summary-day-body').isVisible(), false);
    assert.deepEqual(await readItems(), original, 'Summary interactions preserve saved itinerary fields and order');
    await page.evaluate(() => {
      state.itineraryItems.find(item => item.id === 'day1-1').transits = [
        { trans: 'walk', duration: 5, memo: '원본 메모' },
        { trans: 'train', duration: 0, lineName: '나리타 익스프레스', fromPlace: '공항역', ticketRef: 'preserve' },
        { trans: 'bus', duration: 12, lineName: '시내버스' },
        { trans: 'car', duration: 7 },
        { trans: 'train', duration: 0, lineName: '야마노테선' },
        { trans: 'walk', duration: 4 }
      ]; render();
    });
    await first.locator('[data-issue-kind="transit"]').click();
    const entry = first.locator('.summary-issue-action[data-summary-transit="day1-1"][data-summary-segment="1"]');
    await entry.click();
    const transitDialog = page.locator('#itineraryTransitDialog');
    assert.equal(await page.locator('#itineraryTransitManualTab').getAttribute('aria-selected'), 'true', 'Missing-time entry opens the existing manual editor directly');
    const durations = transitDialog.locator('[data-transit-field="duration"]');
    assert.equal(await durations.count(), 6);
    assert.equal(await durations.nth(1).evaluate(node => document.activeElement === node), true, 'The requested leg duration receives focus');
    await transitDialog.locator('[data-transit-cancel]').first().click();
    assert.equal(await entry.evaluate(node => document.activeElement === node), true, 'Cancel returns focus to the matching action');
    await entry.click(); await durations.nth(1).fill('35'); await page.locator('#itineraryTransitSave').click();
    await page.waitForFunction(() => !document.querySelector('#itineraryTransitDialog').open);
    assert.equal(await first.locator('.itinerary-summary-issues').isVisible(), true, 'Open missing panel stays open after saving and refreshes');
    assert.equal(await first.locator('.summary-issue-action').count(), 5);
    assert.equal(await first.locator('[data-issue-kind="transit"]').evaluate(node => document.activeElement === node), true, 'Saving a completed missing leg returns focus to the remaining badge');
    assert.equal(await first.locator('[data-issue-kind="transit"]').getAttribute('aria-expanded'), 'true', 'Editor focus return preserves the open missing-panel state');
    const savedLegs = await page.evaluate(() => state.itineraryItems.find(item => item.id === 'day1-1').transits);
    assert.deepEqual(savedLegs.map(leg => leg.duration), [5, 35, 12, 7, 0, 4]);
    assert.equal(savedLegs[1].ticketRef, 'preserve'); assert.equal(savedLegs[0].memo, '원본 메모');
    assert.equal((await readItems()).find(item => item.id === 'day1-1').time, '15:00', 'Recording travel never shifts stop times');
    await first.locator('.summary-issues-close').click();
    assert.equal(await first.locator('.itinerary-summary-issues').isVisible(), false, 'Close works after a time save and rerender');
    await first.locator('.itinerary-summary-toggle').click();
    assert.equal(await first.locator('.summary-stop-icon img').count(), 8, 'All expanded stops use runtime category icons');
    const strip = first.locator('[data-stop-id="day1-1"] .summary-transit-strip');
    assert.equal(await strip.locator('.summary-transit-leg').count(), 6, 'All saved legs appear between the same two stops without a cap');
    assert.deepEqual(await strip.locator('.summary-transit-leg').allTextContents(), ['5분', '나리타 익스프레스35분', '시내버스12분', '7분', '야마노테선?', '4분']);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `All legs remain within the page at ${width}px`);
      const dimensions = await strip.evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
      if (width < 768) assert(dimensions.scroll > dimensions.client, 'Long transport chains scroll locally on mobile');
      await first.screenshot({ path: path.join(output, `detail-transits-${width}.png`), animations: 'disabled', style: '.toss-toast { visibility: hidden !important; }' });
      if ([390, 1440].includes(width)) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({ path: path.join(output, `detail-viewport-${width}.png`), animations: 'disabled', style: '.toss-toast { visibility: hidden !important; }' });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await strip.locator('button').first().focus(); await page.keyboard.press('End');
    assert.equal(await strip.locator('button').last().evaluate(node => document.activeElement === node), true);
    assert(await strip.evaluate(node => node.scrollLeft > 0), 'Keyboard navigation reveals the last transport leg');
    await strip.locator('button').last().click();
    assert.equal(await durations.nth(5).evaluate(node => document.activeElement === node), true, 'Timeline leg opens the same editor at the selected segment');
    await transitDialog.locator('[data-transit-cancel]').first().click();
    await page.evaluate(() => {
      const leg = state.itineraryItems.find(item => item.id === 'day1-1').transits[2]; leg.trans = 'train'; leg.lineName = '변경된 노선'; render();
    });
    assert.match(await strip.locator('button').nth(2).innerText(), /변경된 노선/);
    assert.match(await strip.locator('button').nth(2).locator('img').getAttribute('src'), /emoji_u1f686/, 'Mode and line changes rerender even when total duration stays equal');
    await first.locator('.itinerary-summary-toggle').click();
    await page.evaluate(() => {
      delete state.itineraryItems.find(item => item.id === 'day1-1').transits;
      state.itineraryItems.find(item => item.id === 'day1-0').themeSubtype = 'train';
      state.itineraryItems.filter(item => item.date === '2026-10-20').forEach(item => { item.duration = 10; });
      render();
    });
    assert.match(await first.locator('.summary-preview-place img').first().getAttribute('src'), /emoji_u1f686/);
    assert.equal(await first.locator('[data-issue-kind="transit"]').count(), 0, 'Missing badge disappears when all durations are recorded');
    assert.equal(await first.locator('.summary-route-link.is-missing').count(), 0);
    const multiLeg = await page.evaluate(() => window.TripLog.features.itinerary.summary.buildModel({ id: 'multi', startDate: '2026-10-20', endDate: '2026-10-20', itineraryItems: [
      { id: 'a', date: '2026-10-20', time: '10:00', place: '출발', duration: 500 },
      { id: 'b', date: '2026-10-20', time: '11:00', place: '경유', transits: [{ duration: 10 }, { duration: 0 }] },
      { id: 'c', date: '2026-10-20', time: '12:00', place: '도착', duration: 0 },
    ] }).groups[0]);
    assert.deepEqual([multiLeg.minutes, multiLeg.missing, multiLeg.segments, multiLeg.missingRoutes.length], [10, 2, 3, 2], 'Multi-leg counts exclude the first stop incoming transit');
    await page.evaluate(() => {
      state.itineraryItems.find(item => item.id === 'day1-2').place = '매우 긴 장소 이름 <img src=x onerror=alert(1)> '.repeat(6);
      state.itineraryItems.push({ id: 'outside1', date: '2026-10-19', time: '23:00', endTime: '01:00', theme: 'lodging', place: '기간 외 숙소' }, { id: 'undated1', date: '', theme: 'etc', place: '날짜 미정 장소' });
      render();
    });
    assert.equal(await page.locator('.summary-preview-place img[src="x"]').count(), 0, 'Place names remain escaped');
    assert.match(await day('2026-10-19').innerText(), /다음날 01:00/);
    assert.equal(await day('undated').locator('.summary-route-link').count(), 0, 'Undated items do not imply known travel segments');
    await page.setViewportSize({ width: 320, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await first.locator('.itinerary-summary-toggle').click();
    await first.locator('.itinerary-summary-edit').click();
    assert.equal(await page.locator('#itineraryEditTab').getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => state.selectedItineraryDate), '2026-10-20');
    await page.locator('#itinerarySummaryTab').click();
    const untimedDay = day('2026-10-23');
    await untimedDay.locator('[data-issue-kind="time"]').click();
    await untimedDay.locator('[data-summary-time]').click();
    assert.equal(await page.locator('#itineraryPlaceInput').inputValue(), '시간을 정하지 않은 장소', 'Missing start-time action opens the actual itinerary item');
    assert.equal(await page.evaluate(() => state.selectedItineraryDate), '2026-10-23');
    await page.locator('#itineraryEditorClose').click();
    await page.locator('#itinerarySummaryTab').click();
    await page.evaluate(() => { state.itineraryItems = []; render(); });
    assert.equal(await page.locator('#itinerarySummaryEmpty').isVisible(), true);
    assert.equal(await page.locator('#itinerarySummaryCopy').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS itinerary summary: original category SVGs, all-leg horizontal timelines, direct per-leg editing/cancel/save/focus, preserved fields and stop times, live missing panels, responsive previews, copy, long names and 320–1440px layout.');
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
