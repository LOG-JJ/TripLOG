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
    await page.evaluate(() => { state.entries = [{ id: 'only-refund', amount: -1000, date: '2026-10-13' }]; render(); });
    assert.deepEqual(await shares(), ['—']);
    assert.match(await page.locator('.rd-trend-note').innerText(), /0원 이하/);
    await page.evaluate(() => { state.entries = []; render(); });
    assert.equal(await page.locator('.rd-bar-item').count(), 0);
    assert.match(await page.locator('.rd-trend').innerText(), /지출을 기록하면/);
    assert.doesNotMatch(await page.locator('.rd-trend').innerText(), /NaN|Infinity/);
    assert.deepEqual(errors, []);
    console.log('PASS report shares: exact example percentages, live recalculation, signed/zero/negative/empty totals, refund baseline, tab/navigation, proportional bars, 320/390/768/1440 layout and no runtime errors.');
  } catch (error) { if (errors.length) console.error('Page errors:', errors); throw error; }
  finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
