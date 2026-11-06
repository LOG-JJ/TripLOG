const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, waitForApp, stopServer } = require('./browser-fixture');
const { artifactDirectory } = require('../../scripts/helpers/artifact-output');
const { createExperiencePreview } = require('../../scripts/preview-companion-experience');
async function run(scope = 'all') {
  const output = artifactDirectory(`companion-experience-${scope}`);
  fs.mkdirSync(output, { recursive: true });
  const server = createExperiencePreview();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  const dialog = page.locator('#ttCompanion');
  const open = async tab => { await page.evaluate(tab => window.TripLog.features.travelCompanion.workspace.open(tab), tab); await dialog.waitFor({ state: 'visible' }); };
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.TripLogSyncRepository.cached('companion-experience-fixture').snapshot)));
  const capture = async name => {
    await page.locator('.toss-toast.show').waitFor({ state: 'hidden', timeout: 6000 });
    await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] img, #travelPage:not([hidden]) img')].every(image => image.complete && image.naturalWidth > 0));
    await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
  };
  const fits = async selector => {
    const size = await page.locator(selector).evaluate(node => ({ scroll: node.scrollWidth, width: node.clientWidth, rect: node.getBoundingClientRect().toJSON(), vh: innerHeight }));
    assert(size.scroll <= size.width + 2, `${selector} fits horizontally`);
    assert(size.rect.right <= 1 + (await page.evaluate(() => innerWidth)), `${selector} stays inside viewport`);
  };
  try {
    await page.goto(`${origin}/Travel?page=itinerary&trip=companion-experience-fixture`); await waitForApp(page);
    await page.waitForFunction(() => document.documentElement.dataset.auth === 'signed-in' && window.TripLog.features.travelCompanion.workspace);
    if (scope === 'all' || scope === 'today-tools') {
      await open('today');
      assert.equal(await dialog.locator('.cx-copy-title').innerText(), '시부야 스카이');
      assert.equal(await dialog.locator('.cx-transits [data-tt-action="transit-edit"]').count(), 3);
      assert.equal(await dialog.locator('.cx-quick-actions button').count(), 3);
      await capture('today-390');
      assert(await dialog.locator('.cx-cost-strip').evaluate(node => node.getBoundingClientRect().bottom <= document.querySelector('#ttCompanion .tt-scroll').getBoundingClientRect().bottom + 1), 'The default mobile day exposes its expense summary above the dock');
      const originalTimes = (await state()).itineraryItems.map(item => [item.id, item.date, item.time, item.endTime]);
      await dialog.locator('[data-tt-action="skip"]').click();
      await page.waitForFunction(() => document.querySelector('.cx-copy-title')?.textContent === '저녁 식사');
      assert(!(await state()).travelCompanion.completedItineraryIds.includes('sky'));
      await page.reload(); await waitForApp(page); await open('today');
      assert.equal(await dialog.locator('.cx-copy-title').innerText(), '저녁 식사', 'Private skip persists on reload');
      await dialog.locator('[data-tt-action="resume"][data-id="sky"]').click();
      await dialog.getByRole('button', { name: '시부야 스카이 완료하기', exact: true }).click();
      await page.waitForFunction(() => state.travelCompanion.completedItineraryIds.includes('sky'));
      await dialog.locator('[data-tt-action="progress-undo"]').click();
      await page.waitForFunction(() => !state.travelCompanion.completedItineraryIds.includes('sky'));
      assert.equal(await dialog.locator('.cx-copy-title').innerText(), '시부야 스카이');
      await dialog.locator('[data-tt-action="start-picker"]').click();
      await page.locator('#ttStartPicker [data-id="dinner"]').click();
      await page.waitForFunction(() => document.querySelector('.cx-copy-title')?.textContent === '저녁 식사');
      assert(!(await state()).travelCompanion.completedItineraryIds.includes('sky'));
      await dialog.locator('[data-tt-action="start-picker"]').click(); await page.locator('#ttStartPicker [data-id="sky"]').click();
      assert.deepEqual((await state()).itineraryItems.map(item => [item.id, item.date, item.time, item.endTime]), originalTimes);
      const count = (await state()).entries.length;
      await dialog.locator('[data-tt-action="quick-expense"]').click();
      await page.locator('#rdExpenseEditor[open]').waitFor();
      assert.equal(await page.locator('#descriptionInput').inputValue(), '시부야 스카이');
      assert.equal(await page.locator('#cxQuickOptions').getAttribute('open'), null);
      await page.locator('#foreignAmountInput').fill('2700');
      await capture('quick-expense-390');
      await page.locator('#rdExpenseSubmit').click();
      await page.waitForFunction(n => state.entries.length === n + 1, count);
      await dialog.waitFor({ state: 'visible' });
      assert.equal((await state()).entries.at(-1).amount, 25650);
      await page.evaluate(() => { window.experienceSave = saveAndRender; saveAndRender = async () => false; });
      await dialog.getByRole('button', { name: '시부야 스카이 완료하기', exact: true }).click();
      await page.waitForFunction(() => !state.travelCompanion.completedItineraryIds.includes('sky'));
      assert.equal(await dialog.locator('.cx-copy-title').innerText(), '시부야 스카이');
      await page.evaluate(() => { saveAndRender = window.experienceSave; delete window.experienceSave; });
      await open('tools'); assert.equal(await dialog.locator('.ct-tool').count(),7); await capture('tools-390');
      await dialog.locator('[data-tool-action="packing"]').click();
      const packing=page.locator('#ctToolDialog');
      await packing.locator('[data-tt-packing="pack-3"]').check();
      await page.waitForFunction(() => state.packingList.find(item => item.id === 'pack-3').checked);
      await packing.locator('#ttPackingAdd input').fill('교통패스'); await packing.locator('#ttPackingAdd button').click();
      await page.waitForFunction(() => state.packingList.some(item => item.name === '교통패스'));
      await packing.locator('.cx-packing-row').filter({hasText:'교통패스'}).locator('[data-tt-action="packing-rename"]').click();
      await page.locator('#ttPackingName').fill('기차패스'); await page.locator('[form="ttPackingRenameForm"]').click();
      await page.waitForFunction(() => state.packingList.some(item => item.name === '기차패스'));
      await packing.locator('.ct-close').click();
      await dialog.locator('[data-tool-action="calendar"]').click();
      const pendingCalendar=page.waitForEvent('download'); await page.locator('[data-tool-action="calendar-save"]').click();
      const calendar=await pendingCalendar;assert.match(fs.readFileSync(await calendar.path(),'utf8'),/BEGIN:VCALENDAR/);
      await page.locator('#ctToolDialog .ct-close').click();
      await open('today');
      await page.evaluate(() => {
        window.experienceDate = Date;
        window.experienceNow = '2026-11-03T15:05:00Z';
        window.Date = class extends window.experienceDate { constructor(...args) { super(...(args.length ? args : [window.experienceNow])); } };
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForFunction(() => document.querySelector('#ttDay')?.value === '2026-11-04');
      await dialog.locator('#ttDay').selectOption('2026-11-03');
      await page.evaluate(() => { window.experienceNow = '2026-11-04T15:05:00Z'; document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal(await dialog.locator('#ttDay').inputValue(), '2026-11-03', 'A manually selected date survives the next local midnight');
      await page.evaluate(() => { window.Date = window.experienceDate; delete window.experienceDate; delete window.experienceNow; document.dispatchEvent(new Event('visibilitychange')); });
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: width >= 768 ? 1024 : 844 });
        for (const tab of ['today', 'tools']) { await open(tab); await fits('#ttCompanion'); await fits('#ttCompanion .tt-scroll'); await capture(`${tab}-${width}`); }
      }
    }
    if (scope === 'all' || scope === 'wallet') {
      await page.setViewportSize({ width: 390, height: 844 }); await open('wallet');
      assert.equal(await dialog.locator('.cx-needed article').count(), 1);
      assert.doesNotMatch(await dialog.locator('.cx-needed').innerText(), /니시스가모/);
      await capture('wallet-390');
      await dialog.locator('.cx-needed [data-tt-action="reservation-detail"]').first().click();
      await page.locator('#ttReservationDetail[open]').waitFor();
      assert.match(await page.locator('#ttReservationDetailBody').innerText(), /2명|K82M7N|25,650원/);
      await capture('reservation-detail-390');
      await page.locator('#ttReservationDetail [data-tt-action="close"]').click();
      await dialog.locator('#ttWalletFilters').selectOption('stay');
      assert.equal(await dialog.locator('.cx-needed article').count(), 0); assert.match(await dialog.locator('#ttWalletList').innerText(), /니시스가모/);
      await dialog.locator('#ttWalletFilters').selectOption('all');
      await dialog.locator('#ttWalletSearch').fill('ZG123456'); assert.equal(await dialog.locator('.cx-booking').count(), 2);
      await dialog.locator('#ttWalletSearch').fill('');
      const count = (await state()).entries.length;
      await dialog.locator('[data-tt-action="reservation-new"]').click();
      await page.locator('[data-tt-action="reservation-type"][data-type="activity"]').click();
      await page.locator('#ttReservationName').fill('予約テスト 입장권');
      await page.locator('#ttReservationReference').fill('NEW-123');
      await page.locator('#ttReservationPayment summary').click();
      await page.locator('#ttQuotedAmount').fill('2700'); await page.locator('#ttQuotedCurrency').selectOption('JPY');
      await page.locator('#ttPaymentMode').selectOption('create');
      await page.locator('#ttPaymentRate').fill('950'); await page.locator('#ttPaymentBase').fill('100');
      await capture('reservation-payment-390');
      await page.locator('[form="ttReservationForm"][type="submit"]').click();
      await page.locator('#ttReservationEditor').waitFor({ state: 'hidden' });
      const saved = await state(), booking = saved.travelCompanion.reservations.find(row => row.reference === 'NEW-123');
      assert(booking); assert.equal(saved.entries.length, count + 1); assert.equal(saved.entries.find(row => row.id === booking.linkedExpenseId).amount, 25650);
      await dialog.locator(`[data-tt-action="reservation-edit"][data-id="manual:${booking.id}"]`).click();
      await page.locator('#ttReservationPayment summary').click(); await page.locator('#ttQuotedAmount').fill('9000');
      await page.locator('[form="ttReservationForm"][type="submit"]').click(); await page.locator('#ttReservationEditor').waitFor({ state: 'hidden' });
      assert.equal((await state()).entries.find(row => row.id === booking.linkedExpenseId).amount, 25650);
      await dialog.locator(`[data-tt-action="reservation-edit"][data-id="manual:${booking.id}"]`).click();
      await page.locator('#ttReservationPayment summary').click(); await page.locator('#ttPaymentMode').selectOption('link');
      await page.locator('#ttChooseExpense').click(); await page.locator('[data-payment-expense="food"]').click();
      await page.locator('[form="ttReservationForm"][type="submit"]').click(); await page.locator('#ttReservationEditor').waitFor({ state: 'hidden' });
      assert.equal((await state()).entries.length, count + 1);
      assert.equal((await state()).travelCompanion.reservations.find(row => row.id === booking.id).linkedExpenseId, 'food');
      await page.reload(); await waitForApp(page); await open('wallet');
      assert.equal((await state()).travelCompanion.reservations.find(row => row.id === booking.id).quotedAmount, 9000);
      for (const width of [320, 768, 1440]) { await page.setViewportSize({ width, height: width >= 768 ? 1024 : 844 }); await open('wallet'); await fits('#ttCompanion'); await fits('#ttCompanion .tt-scroll'); await capture(`wallet-${width}`); }
    }
    if (scope === 'all' || scope === 'analysis') {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => { document.querySelectorAll('.tt-dialog[open]').forEach(dialog => dialog.close()); window.TripLog.features.redesign.workspace.navigate('report'); window.TripLog.features.reports.workspace.setTab('itinerary'); });
      assert.equal(await page.locator('#rdReportSummary').isVisible(), true);
      assert.match(await page.locator('#rdReportSummary').innerText(), /계획 일정[\s\S]*체류[\s\S]*이동/);
      assert.equal(await page.locator('.rp-day-bar').count(), 5); assert.match(await page.locator('#rdPlanAnalytics').innerText(), /계획 기준/);
      await capture('analysis-all-390');
      assert.equal(await page.locator('#rdTimeDonut').count(), 1);
      assert(await page.locator('#rdTimeDonut + div > b').isVisible(),'The combined time stays visible in the mobile donut');
      assert.match(await page.locator('#rdPlanAnalytics .rd-legend').innerText(), /체류[\s\S]*이동/);
      await page.locator('[data-analysis-day="2026-11-04"]').click(); await page.locator('#rdReportStaySort').selectOption('shortest');
      assert.match(await page.locator('.rp-time-place').last().innerText(), /미입력/);
      await capture('analysis-day-390');
      await page.locator('[data-analysis-missing]').click(); await page.locator('#rdAnalysisMissing[open]').waitFor(); await capture('analysis-missing-390');
      await page.locator('#rdAnalysisMissing .cx-missing-section').last().locator('[data-missing-index]').first().click();
      await page.locator('#itineraryTransitDialog[open]').waitFor(); await page.locator('#itineraryTransitDialog [data-transit-cancel]').first().click();
      await page.locator('#rdPlanAnalytics').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#rdReportDay').inputValue(), '2026-11-04'); assert.equal(await page.locator('#rdReportStaySort').inputValue(), 'shortest');
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: width >= 768 ? 1024 : 844 });
        await page.evaluate(() => window.TripLog.features.reports.workspace.setTab('expenses'));
        const before = await page.locator('#reportPage .rd-tabs').boundingBox();
        await page.evaluate(() => window.TripLog.features.reports.workspace.setTab('itinerary'));
        const after = await page.locator('#reportPage .rd-tabs').boundingBox();
        assert(Math.abs(before.y - after.y) <= 1, 'Report tabs keep their vertical position at ' + width + ': ' + before.y + ' vs ' + after.y);
        assert.equal(before.x, after.x); assert.equal(before.width, after.width); assert.equal(before.height, after.height);
        await fits('#rdPlanAnalytics'); await capture(`analysis-${width}`);
      }
      const reportOriginal=await page.evaluate(()=>JSON.stringify({entries:state.entries,itineraryItems:state.itineraryItems}));
      for(const variant of ['long','empty']) {
        await page.evaluate(variant=>{state.entries=variant==='long'?[{id:'large-report',amount:9876543210987,category:'기타',description:'큰 금액',date:state.startDate}]:[];if(variant==='empty')state.itineraryItems=[];},variant);
        for(const width of [320,1440]) {
          await page.setViewportSize({width,height:1000});
          await page.evaluate(()=>window.TripLog.features.reports.workspace.setTab('expenses'));
          const before=await page.locator('#reportPage .rd-tabs').boundingBox();
          await page.evaluate(()=>window.TripLog.features.reports.workspace.setTab('itinerary'));
          const after=await page.locator('#reportPage .rd-tabs').boundingBox();
          assert(Math.abs(before.y-after.y)<=1,variant+' report summaries preserve tab position at '+width);
          assert(!/NaN|Infinity/.test(await page.locator('#reportPage').innerText()));
          assert.equal(await page.locator('#rdReportSummary .rp-summary-slot[aria-hidden="false"]').count(),1);
          await fits('#rdPlanAnalytics');
        }
      }
      await page.evaluate(value=>{Object.assign(state,JSON.parse(value));window.TripLog.features.reports.workspace.render();},reportOriginal);
    }
    assert.deepEqual(errors, [], 'No uncaught browser exceptions');
    console.log(`PASS companion browser ${scope}. Evidence: ${output}`);
  } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
  finally { await browser.close(); await stopServer(server); }
}
module.exports = { run };
