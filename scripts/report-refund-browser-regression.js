const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, startServer, stopServer, seedTrip, blockExternalRequests, waitForApp } = require('./helpers/browser-fixture');

async function main() {
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  const errors = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
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
    assert.deepEqual(await page.locator('.rd-bar-item > strong').allTextContents(), ['80,000원']);
    assert.match(await page.locator('.rd-category-section').innerText(), /환불 전 금액 기준/);
    assert.equal(await page.locator('.rd-legacy, #triplogFormSources, #reportDailyBarChart, #expenseTableBody').count(), 0);
    const output = path.resolve('.test-output/refund-report'); fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'partial-refund-390.png'), fullPage: true });

    // A refund on another date is a signed bar below the zero baseline.
    await page.evaluate(() => { state.entries[1].paymentDate = '2026-10-14'; render(); });
    assert.deepEqual(await page.locator('.rd-bar-item > strong').allTextContents(), ['100,000원', '-20,000원']);
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
    assert.match(await page.locator('#rdDonut').getAttribute('aria-label'), /100%/);
    await page.locator('#rdReportItineraryTab').click();
    await page.locator('#rdReportExpenseTab').click();
    await page.locator('.rd-nav [data-rd-nav="overview"]').click();
    assert.match(await page.locator('.tc-total').innerText(), /^0원$/);
    assert.deepEqual(errors, []);
    console.log('PASS refund report: shared net totals, gross composition, signed payment dates, full refund, tab/navigation, no retired DOM, 390/1440 layout and no runtime errors.');
  } catch (error) { if (errors.length) console.error('Page errors:', errors); throw error; }
  finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
