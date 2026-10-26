// Browser plugin not available. Isolated Playwright/Edge data; external APIs blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, startServer, stopServer, seedTrip, blockExternalRequests, waitForApp } = require('./helpers/browser-fixture');
const output = artifactDirectory('itinerary-default-date');
const dates = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];
const seed = { id: 'default-date-fixture', tripName: '날짜별 일정 검증', startDate: dates[0], endDate: dates.at(-1), country: '일본', countryCode: 'JP', city: '교토', travelMode: 'overseas',
  entries: [], companions: [], packingList: [], itineraryItems: dates.map((date, index) => ({ id: `day-${index}`, date, place: `${index + 1}일차 장소`, theme: 'sightseeing', time: '10:00', endTime: '11:00', createdAt: index })) };
async function main() {
  const { server, origin } = await startServer(), browser = await launchBrowser();
  const cases = [], errors = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true, timezoneId: 'Asia/Seoul' });
    context.setDefaultTimeout(12000);
    await blockExternalRequests(context, origin);
    await seedTrip(context, { origin, user: { id: '00000000-0000-4000-8000-000000000099', email: 'default-date@example.test' }, expiry: Math.floor(Date.now()/1000)+3600, seed });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-23T12:00:00+09:00'));
    await page.goto(`${origin}/Travel?page=overview`); await waitForApp(page);
    const navigate = (pageName, date) => page.evaluate(({ pageName, date }) => window.TripLog.features.redesign.workspace.navigate(pageName, date ? { date } : {}), { pageName, date });
    const selected = async date => {
      await page.waitForFunction(date => state.selectedItineraryDate === date && document.querySelector('#itineraryDayStrip .active')?.dataset.date === date, date);
      assert.equal(await page.locator('#itineraryList .timeline-place').innerText(), `${dates.indexOf(date) + 1}일차 장소`);
    };
    for (const [now, date, title] of [
      ['2026-10-23', dates[0], '첫날 일정'], ['2026-10-24', dates[0], '오늘 일정'],
      ['2026-10-26', dates[2], '오늘 일정'], ['2026-10-28', dates[4], '오늘 일정'],
      ['2026-10-29', dates[4], '마지막 날 일정'], ['2026-11-02', dates[4], '마지막 날 일정'],
    ]) {
      await page.clock.setFixedTime(new Date(`${now}T12:00:00+09:00`));
      await navigate('overview');
      assert.equal(await page.locator('#rdOverviewScheduleTitle').innerText(), title);
      assert.equal(await page.locator('.rd-key-schedule .rd-plan-row b').innerText(), `${dates.indexOf(date) + 1}일차 장소`);
      await page.locator('[data-rd-action="overview-itinerary"]').click(); await selected(date);
      // A manual day remains selected while rendering/saving the current screen.
      await page.locator(`#itineraryDayStrip [data-date="${dates[1]}"]`).click();
      await selected(dates[1]); await page.evaluate(() => render()); await selected(dates[1]);
      // Reopening Schedule through the actual dock/menu resets to the current date.
      await page.locator('.tl-bottom-nav:not(.tl-nav-dock) [data-trip-nav="itinerary"]').last().click();
      await page.locator('#tripNavigationMenu [data-nav-item="itinerary"]').click(); await selected(date);
      cases.push({ now, date, title });
    }
    await page.clock.setFixedTime(new Date('2026-10-26T09:00:00+09:00'));
    await page.evaluate(() => { state.itineraryItems = state.itineraryItems.filter(item => item.date !== '2026-10-26'); });
    await navigate('overview');
    assert.equal(await page.locator('#rdOverviewScheduleTitle').innerText(), '오늘 일정');
    assert.equal(await page.locator('.rd-key-schedule .rd-plan-row').count(), 0, 'An empty today must not fall back to another day');
    await page.locator('[data-rd-action="overview-add-plan"]').click();
    assert.equal(await page.locator('#itineraryDaySelect').inputValue(), dates[2]);
    await page.locator('#itineraryEditorClose').click();
    await navigate('itinerary', 'all');
    assert.equal(await page.evaluate(() => state.selectedItineraryDate), 'all', 'Explicit All links remain available');
    await page.clock.setFixedTime(new Date('2026-10-25T15:30:00Z'));
    await page.evaluate(() => { state.countryCode = 'GB'; state.travelCompanion.timeZone = 'Europe/London'; });
    await navigate('overview');
    assert.equal(await page.locator('[data-rd-action="overview-itinerary"]').getAttribute('data-date'), dates[1], 'Use the destination day near midnight');
    await navigate('itinerary'); await selected(dates[1]);
    await page.screenshot({ path: path.join(output, 'current-day-mobile-390.png') });
    await navigate('itinerary', dates[0]); await selected(dates[0]);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, cases, emptyToday: true, destinationTimeZone: true, manualDayPreserved: true, explicitDateAndAll: true, errors }, null, 2));
    console.log('PASS default itinerary date: overview and actual Schedule menu, before/during/after travel, start/end boundaries, empty today, destination timezone, manual selection and explicit date/All links. '+output);
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
