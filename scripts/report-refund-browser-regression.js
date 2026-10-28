const { artifactDirectory } = require('./helpers/artifact-output');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, startServer, stopServer, seedTrip, blockExternalRequests, waitForApp } = require('./helpers/browser-fixture');

async function main() {
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  const errors = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    await blockExternalRequests(context, origin);
    await seedTrip(context, {
      origin, user: { id: '00000000-0000-4000-8000-000000000097', email: 'refund@example.test', user_metadata: { display_name: '리포트 검증' } },
      expiry: Math.floor(Date.now() / 1000) + 3600,
      seed: { id: 'refund-review', tripName: '경비 집계 검증', startDate: '2026-10-13', endDate: '2026-10-15', travelMode: 'domestic',
        companions: [], itineraryItems: [], packingList: [], entries: [
          { id: 'charge', date: '2026-10-13', paymentDate: '2026-10-13', category: '식비', description: '식사', amount: 100000, createdAt: 1 },
          { id: 'refund', date: '2026-10-13', paymentDate: '2026-10-13', category: '식비', description: '환불', amount: -20000, createdAt: 2 },
        ] },
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/Travel?page=report&trip=refund-review`);
    await waitForApp(page);
    assert.match(await page.locator('#rdReportSummary').innerText(), /80,000원/);
    assert.deepEqual(await page.locator('.rd-bar-amount').allTextContents(), ['80,000원']);
    assert.deepEqual(await page.locator('.rd-bar-percent').allTextContents(), ['100.0%']);
    assert.match(await page.locator('.rd-category-section').innerText(), /환불 전 금액 기준/);
    assert.equal(await page.locator('.rd-legacy, #triplogFormSources, #reportDailyBarChart, #expenseTableBody').count(), 0);
    const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('report-refund'); fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'partial-refund-390.png'), fullPage: true });

    // A refund on another date is a signed bar below the zero baseline.
    await page.evaluate(() => { state.entries[1].paymentDate = '2026-10-14'; render(); });
    assert.deepEqual(await page.locator('.rd-bar-amount').allTextContents(), ['100,000원', '-20,000원']);
    assert.deepEqual(await page.locator('.rd-bar-percent').allTextContents(), ['125.0%', '-25.0%']);
    assert.equal(await page.locator('.rd-bars-signed .is-refund').count(), 1);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const position = await page.locator('.is-refund').evaluate(item => ({
        middle: item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2,
        top: item.querySelector('.rd-bar').getBoundingClientRect().top,
      }));
      assert(Math.abs(position.top - position.middle) < 1, 'Refund starts at zero and extends down');
      await page.screenshot({ path: path.join(output, `signed-refund-${width}.png`), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.evaluate(() => { state.entries[1].amount = -100000; render(); });
    assert.match(await page.locator('#rdReportSummary').innerText(), /0원/);
    assert.deepEqual(await page.locator('.rd-bar-percent').allTextContents(), ['—', '—']);
    assert.match(await page.locator('.rd-trend-note').innerText(), /0원 이하/);
    assert.match(await page.locator('#rdDonut').getAttribute('aria-label'), /100%/);
    await page.locator('#rdReportItineraryTab').click();
    await page.locator('#rdReportExpenseTab').click();
    await page.locator('.rd-nav [data-trip-nav="overview"]').click();
    assert.match(await page.locator('.tc-total').innerText(), /^0원$/);

    await page.evaluate(() => {
      const days = ['2026-10-01', '2026-10-10', '2026-10-11'];
      const amounts = [[180000, 12600, 3000], [23000, 18200, 6000], [22000, 18000, 4000]];
      state.entries = days.flatMap((date, day) => amounts[day].map((amount, index) => ({
        id: `payment-${day}-${index}`, date, paymentDate: date, category: '식비', description: '비중 검증', amount, createdAt: day * 3 + index,
      })));
      render();
    });
    await page.locator('.rd-nav [data-trip-nav="report"]').click();
    await page.locator('#tripNavigationMenu [data-nav-item="report-expenses"]').click();
    await page.locator('#tripNavigationMenu').waitFor({ state: 'hidden' });
    await page.evaluate(() => document.fonts.ready);
    const shares = () => page.locator('.rd-bar-percent').allTextContents();
    assert.deepEqual(await shares(), ['68.2%', '16.5%', '15.3%']);
    assert.deepEqual(await page.locator('.rd-bar-amount').allTextContents(), ['195,600원', '47,200원', '44,000원']);
    assert.match(await page.locator('.rd-trend').innerText(), /9건의 지출 기록/);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
      await page.locator('.rd-trend').evaluate(node => window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - 72, behavior: 'instant' }));
      await page.locator('.rd-trend').screenshot({ path: path.join(output, `payment-share-${width}.png`), animations: 'disabled' });
      const layout = await page.locator('.rd-bars').evaluate(chart => [...chart.children].map(item => {
        const label = item.querySelector('.rd-bar-label'), amount = item.querySelector('.rd-bar-amount').getBoundingClientRect();
        const percent = item.querySelector('.rd-bar-percent').getBoundingClientRect(), bar = item.querySelector('.rd-bar').getBoundingClientRect();
        return { labelTop: label.getBoundingClientRect().top, labelBottom: label.getBoundingClientRect().bottom, chartTop: chart.getBoundingClientRect().top,
          labelWidth: label.clientWidth, textWidth: label.scrollWidth, percentBottom: percent.bottom, amountTop: amount.top, barTop: bar.top, barHeight: bar.height };
      }));
      layout.forEach(row => {
        assert(row.labelTop >= row.chartTop - 1, `Labels stay inside the chart at ${width}px: ${JSON.stringify(row)}`);
        assert(row.labelBottom <= row.barTop + 1, `Labels do not overlap bars at ${width}px`);
        assert(row.percentBottom <= row.amountTop, `Percentage and amount stay on separate lines at ${width}px`);
        assert(row.textWidth <= row.labelWidth + 1, `Labels do not overflow their columns at ${width}px`);
      });
      assert(Math.abs(layout[1].barHeight / layout[0].barHeight - 47200 / 195600) < .01, 'Bar heights remain proportional to actual amounts');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page fits ${width}px`);
    }
    await page.locator('#rdReportItineraryTab').click();
    await page.locator('#rdReportExpenseTab').click();
    assert.deepEqual(await shares(), ['68.2%', '16.5%', '15.3%'], 'Returning to the expense tab keeps the calculated percentages');
    await page.evaluate(() => { state.entries[0].amount += 100000; render(); });
    assert.deepEqual(await shares(), ['76.4%', '12.2%', '11.4%'], 'Shares recalculate when an amount changes');
    const pretripBefore = await page.evaluate(() => {
      state.entries = [
        { id: 'pretrip-flight', date: '__pretrip__', paymentDate: '2026-10-13', category: '교통', amount: 60000 },
        { id: 'pretrip-hotel', date: '__pretrip__', paymentDate: '2026-10-14', category: '숙소', amount: 40000 },
        { id: 'pretrip-refund', date: '__pretrip__', paymentDate: '2026-10-15', category: '숙소', amount: -10000 },
        { id: 'pretrip-undated', date: '__pretrip__', category: '관광', amount: 5000 },
        { id: 'ordinary-same-date', date: '2026-10-14', paymentDate: '2026-10-13', category: '식비', amount: 10000 },
        { id: 'ordinary-next-date', date: '2026-10-14', paymentDate: '2026-10-14', category: '식비', amount: 20000 },
      ];
      const before = JSON.stringify(state.entries); render(); return before;
    });
    const expectedDates = await page.evaluate(() => ['사전구매', ...['2026-10-13', '2026-10-14'].map(formatTripShortDate)]);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      assert.deepEqual(await page.locator('.rd-bar-date').allTextContents(), expectedDates, 'Pretrip purchases use one named group before ordinary payment dates');
      assert.deepEqual(await page.locator('.rd-bar-amount').allTextContents(), ['95,000원', '10,000원', '20,000원']);
      assert.deepEqual(await shares(), ['76.0%', '8.0%', '16.0%']);
      assert.match(await page.locator('#rdReportSummary').innerText(), /125,000원/);
      assert.match(await page.locator('.rd-trend').innerText(), /사전구매 별도 집계/);
      const labelFits = await page.locator('.rd-bar-date').first().evaluate(label => {
        const rect = label.getBoundingClientRect(), chart = label.closest('.rd-bars').getBoundingClientRect();
        return rect.left >= chart.left && rect.right <= chart.right && label.clientHeight >= parseFloat(getComputedStyle(label).lineHeight);
      });
      assert(labelFits, `Pretrip label stays visible on one line at ${width}px`);
      await page.locator('.rd-trend').evaluate(node => window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - 72, behavior: 'instant' }));
      await page.locator('.rd-trend').screenshot({ path: path.join(output, `pretrip-group-${width}.png`), animations: 'disabled' });
    }
    await page.locator('#rdReportItineraryTab').click();
    await page.locator('#rdReportExpenseTab').click();
    assert.deepEqual(await page.locator('.rd-bar-date').allTextContents(), expectedDates);
    assert.equal(await page.evaluate(() => JSON.stringify(state.entries)), pretripBefore, 'Report grouping preserves original expense records and payment dates');
    await page.evaluate(() => { state.entries = [{ id: 'pretrip-only-refund', date: '__pretrip__', paymentDate: '2026-10-13', amount: -1000 }]; render(); });
    assert.deepEqual(await page.locator('.rd-bar-date').allTextContents(), ['사전구매']);
    assert.deepEqual(await page.locator('.rd-bar-amount').allTextContents(), ['-1,000원']);
    assert.equal(await page.locator('.is-refund').count(), 1);
    await page.evaluate(() => { state.entries = [{ id: 'only-refund', amount: -1000, date: '2026-10-13' }]; render(); });
    assert.deepEqual(await shares(), ['—']);
    assert.match(await page.locator('.rd-trend-note').innerText(), /0원 이하/);
    await page.evaluate(() => { state.entries = []; render(); });
    assert.equal(await page.locator('.rd-bar-item').count(), 0);
    assert.match(await page.locator('.rd-trend').innerText(), /지출을 기록하면/);
    assert.doesNotMatch(await page.locator('.rd-trend').innerText(), /NaN|Infinity/);

    // Sorting changes only the report view, with unknown durations last.
    const itineraryBefore = await page.evaluate(() => {
      state.itineraryItems = [
        { id: 'long', date: '2026-10-14', time: '10:00', endTime: '12:00', place: '미술관', theme: 'sightseeing' },
        { id: 'first', date: '2026-10-13', time: '09:00', endTime: '10:00', place: '아침 산책', theme: 'sightseeing' },
        { id: 'missing', date: '2026-10-13', time: '11:00', endTime: '', place: '시간 미정 장소', theme: 'sightseeing' },
        { id: 'equal', date: '2026-10-13', time: '15:00', endTime: '16:00', place: '박물관', theme: 'sightseeing' },
        { id: 'short', date: '2026-10-13', time: '13:00', endTime: '13:30', place: '점심 식사', theme: 'food' },
        { id: 'hotel', date: '2026-10-13', time: '18:00', endTime: '23:00', place: '검증 호텔', theme: 'lodging' },
      ];
      render(); return JSON.stringify(state.itineraryItems);
    });
    await page.locator('#rdReportItineraryTab').click();
    const stayIds = () => page.locator('.rd-analysis-place').evaluateAll(rows => rows.map(row => row.dataset.id));
    const sort = async value => {
      await page.locator('#rdReportStaySortButton').click();
      await page.locator(`#rdReportStaySortMenu [data-value="${value}"]`).click();
    };
    const metrics = await page.locator('.rd-analysis-metrics').innerText();
    assert.deepEqual(await stayIds(), ['first', 'missing', 'short', 'equal', 'long']);
    await sort('longest');
    assert.deepEqual(await stayIds(), ['long', 'first', 'equal', 'short', 'missing']);
    assert.equal(await page.locator('#rdReportStaySortButton').evaluate(node => node === document.activeElement), true, 'Sort retains keyboard focus after rendering');
    await sort('shortest');
    assert.deepEqual(await stayIds(), ['short', 'first', 'equal', 'long', 'missing']);
    assert.equal(await page.locator('.rd-analysis-metrics').innerText(), metrics, 'Sort does not change summary totals');
    await page.locator('#rdReportDay').selectOption('2026-10-13');
    assert.deepEqual(await stayIds(), ['short', 'first', 'equal', 'missing']);
    assert.equal(await page.locator('#rdReportStaySort').inputValue(), 'shortest');
    await page.locator('#rdReportExpenseTab').click();
    await page.locator('#rdReportItineraryTab').click();
    assert.deepEqual(await stayIds(), ['short', 'first', 'equal', 'missing']);
    await page.locator('#rdReportDay').selectOption('2026-10-15');
    assert.equal(await page.locator('.rd-analysis-place').count(), 0);
    assert.match(await page.locator('#rdPlanAnalytics').innerText(), /체류 시간을 기록할 일정이 없어요/);
    await page.locator('#rdReportDay').selectOption('all');
    await sort('schedule');
    assert.deepEqual(await stayIds(), ['first', 'missing', 'short', 'equal', 'long']);
    await sort('longest');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
      const fits = await page.locator('.rd-analysis-heading').evaluate(node => {
        const rect = node.getBoundingClientRect(), select = node.querySelector('.custom-select-button').getBoundingClientRect();
        const heading = node.querySelector('h2').getBoundingClientRect();
        return select.left >= rect.left && select.right <= rect.right + 1 && select.height >= 40
          && (select.left >= heading.right || select.top >= heading.bottom);
      });
      assert(fits, `Stay heading and sorting filter fit without overlap at ${width}px`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if ([390, 1440].includes(width)) {
        await page.locator('#rdPlanAnalytics').evaluate(node => window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - 72, behavior: 'instant' }));
        await page.locator('#rdPlanAnalytics').screenshot({ path: path.join(output, `stay-sort-${width}.png`), animations: 'disabled' });
      }
    }
    assert.equal(await page.evaluate(() => JSON.stringify(state.itineraryItems)), itineraryBefore, 'Report sorting never reorders or changes the saved itinerary');
    await page.locator('.rd-analysis-place').first().click();
    await page.waitForFunction(() => editingItineraryId === 'long' && document.getElementById('itineraryEditor').open);
    assert.deepEqual(errors, []);
    console.log('PASS reports: payment shares/pretrip/refunds, stay schedule/longest/shortest sorting, missing durations last, stable ties, date and tab persistence, unchanged itinerary/totals, edit navigation, 320/390/768/1440 layout and no runtime errors.');
  } catch (error) { if (errors.length) console.error('Page errors:', errors); throw error; }
  finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
