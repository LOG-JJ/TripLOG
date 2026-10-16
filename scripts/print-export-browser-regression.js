const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, blockExternalRequests } = require('./helpers/browser-fixture');
// Purpose-built isolated regression runner; interactive visual QA also uses the
// Codex in-app browser. No production credentials or trip data are touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createExportPreview } = require('./preview-export-reports');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('print-export');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createExportPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    context.setDefaultTimeout(15000);
    await blockExternalRequests(context, origin);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in');
    const previewReady = () => page.waitForFunction(() => document.querySelector('#rdPdf')?.open && !document.querySelector('#exSave').disabled && document.querySelector('#exPreview .ex-paper'));
    const artworkReady = () => page.waitForFunction(() => [...document.querySelectorAll('#exPreview img, #printReport img')].every(image => image.complete && image.naturalWidth > 0));
    const open = async (trip = 'export-suncheon') => {
      await page.goto(`${origin}/Travel?page=settings&trip=${trip}`); await ready();
      await page.locator('#settingsPage [data-rd-action="pdf"]').click(); await previewReady();
      await page.evaluate(() => document.fonts.ready);
    };
    const type = async name => { await page.locator(`[data-ex-type="${name}"]`).click(); await previewReady(); };
    const geometry = () => page.evaluate(() => {
      const root = document.createElement('div'); root.className = 'ex-document ex-measure'; root.innerHTML = document.querySelector('#printReport').innerHTML; document.body.append(root);
      try {
        const papers = [...root.querySelectorAll('.ex-paper')];
        const issues = papers.flatMap((paper, index) => {
          const body = paper.querySelector('.ex-paper-body'), bounds = body.getBoundingClientRect();
          const last = body.lastElementChild.getBoundingClientRect();
          const findings = [];
          if (last.bottom > bounds.bottom + 1) findings.push(`page ${index + 1}: content exceeds paper by ${last.bottom - bounds.bottom}`);
          if (body.scrollWidth > body.clientWidth + 1) findings.push(`page ${index + 1}: horizontal overflow`);
          paper.querySelectorAll('.ex-ledger tr').forEach(row => { if (row.getBoundingClientRect().bottom > bounds.bottom + 1) findings.push(`page ${index + 1}: clipped ledger row`); });
          if (paper.classList.contains('ex-expense-overview-paper')) {
            const highlights = paper.querySelector('.ex-expense-highlights'), chart = paper.querySelector('.ex-expense-charts');
            if (paper.querySelector('table')) findings.push('Overview contains a transaction table');
            if (Math.abs(highlights.getBoundingClientRect().bottom - bounds.bottom) > 2) findings.push('Overview does not fill the page');
            if (chart && chart.getBoundingClientRect().bottom > highlights.getBoundingClientRect().top) findings.push('Charts overlap highlights');
            for (const region of paper.querySelectorAll('.ex-daily-chart, .ex-category-chart')) {
              if (region.scrollHeight > region.clientHeight + 1 || region.scrollWidth > region.clientWidth + 1) findings.push(`${region.className}: chart overflow`);
            }
            for (const amount of paper.querySelectorAll('.ex-treemap-tile b:not([hidden])')) {
              if (amount.scrollWidth > amount.clientWidth + 1) findings.push('Clipped category amount');
            }
            for (const card of paper.querySelectorAll('.ex-spend-highlight')) {
              const box = card.getBoundingClientRect();
              for (const value of card.querySelectorAll('.ex-highlight-label, strong, small')) {
                const range = document.createRange(); range.selectNodeContents(value);
                for (const rect of range.getClientRects()) if (rect.left < box.left || rect.right > box.right + .5 || rect.bottom > box.bottom + .5) findings.push('Clipped spending highlight');
              }
            }
          }
          return findings;
        });
        const visibleIndex = [...document.querySelectorAll('#exPreview .ex-paper')].findIndex(paper => !paper.hidden);
        const compare = ['h1', '.ex-section-heading h2', '.ex-report-meta', '.ex-ledger td', '.ex-detail-place', '.ex-detail-memo', '.ex-time-range', '.ex-time-name', '.ex-time-transit', '.ex-daily-date', '.ex-daily-amount', '.ex-daily-share', '.ex-spend-highlight strong'];
        const mismatches = compare.flatMap(selector => {
          const actual = document.querySelector(`#exPreview .ex-paper:not([hidden]) ${selector}`), expected = papers[visibleIndex]?.querySelector(selector);
          if (!actual || !expected) return [];
          return ['fontSize', 'lineHeight', 'fontWeight'].filter(key => getComputedStyle(actual)[key] !== getComputedStyle(expected)[key]).map(key => `${selector} ${key}: ${getComputedStyle(actual)[key]} preview / ${getComputedStyle(expected)[key]} paper`);
        });
        return { issues, mismatches, pages: papers.length };
      } finally { root.remove(); }
    });
    const assertGeometry = async label => { const value = await geometry(); assert.deepEqual(value.issues, [], `${label}: ${value.issues.join('; ')}`); assert.deepEqual(value.mismatches, [], `${label}: identical print/preview typography`); return value; };
    const assertDayGroups = async () => {
      const groups = await page.locator('#printReport .ex-itinerary-detail-table tbody').evaluateAll(bodies => bodies.map(body => ({
        span: body.querySelector('.ex-detail-day')?.rowSpan, rows: body.rows.length,
        headers: body.querySelectorAll('.ex-detail-day').length,
        columns: [...body.rows].map((row, index) => row.cells.length + (index ? 1 : 0)),
      })));
      assert(groups.length > 0);
      groups.forEach(group => { assert.equal(group.span, group.rows); assert.equal(group.headers, 1); assert(group.columns.every(count => count === 5)); });
    };
    const assertTimetableType = async label => {
      const findings = await page.evaluate(() => {
        const root = document.createElement('div'); root.className = 'ex-document ex-measure'; root.innerHTML = document.querySelector('#printReport').innerHTML; document.body.append(root);
        try {
          const issues = [];
          if (![...document.fonts].some(face => face.family.includes('TripLOG Collaboration') && face.status === 'loaded')) issues.push('Bundled Pretendard is not loaded');
          root.querySelectorAll('.ex-time-event').forEach(event => {
            const id = event.dataset.scheduleEvent, box = event.getBoundingClientRect();
            const time = event.querySelector('.ex-time-range'), place = event.querySelector('.ex-time-place'), name = event.querySelector('.ex-time-name'), art = event.querySelector('.ex-event-art');
            if (box.width < 150) issues.push(`${id}: narrow event ${box.width}px`);
            if (!getComputedStyle(name).fontFamily.includes('TripLOG Collaboration')) issues.push(`${id}: wrong font`);
            if (parseFloat(getComputedStyle(name).fontSize) <= parseFloat(getComputedStyle(time).fontSize)) issues.push(`${id}: missing time/place hierarchy`);
            for (const element of [time, place, event.querySelector('.ex-time-transit')].filter(Boolean)) {
              const bounds = element.getBoundingClientRect();
              if (bounds.top < box.top - .5 || bounds.bottom > box.bottom + .5 || bounds.left < box.left - .5 || bounds.right > box.right + .5) issues.push(`${id}: ${element.className} escapes the event`);
              if (art) {
                const picture = art.getBoundingClientRect();
                if (Math.min(bounds.right, picture.right) - Math.max(bounds.left, picture.left) > 1 && Math.min(bounds.bottom, picture.bottom) - Math.max(bounds.top, picture.top) > 1) issues.push(`${id}: ${element.className} overlaps artwork`);
              }
            }
            const range = time.getBoundingClientRect(), title = place.getBoundingClientRect();
            if (event.classList.contains('is-compact-event') ? range.right > title.left + .5 : range.bottom > title.top + .5) issues.push(`${id}: time overlaps place`);
          });
          return issues;
        } finally { root.remove(); }
      });
      assert.deepEqual(findings, [], `${label}: ${findings.join('; ')}`);
    };
    const assertDailyChart = async label => {
      const findings = await page.evaluate(() => {
        const root = document.createElement('div'); root.className = 'ex-document ex-measure'; root.innerHTML = document.querySelector('#printReport').innerHTML; document.body.append(root);
        try {
          const issues = [], tracks = [...root.querySelectorAll('.ex-daily-track')];
          root.querySelectorAll('.ex-daily-item').forEach(row => {
            const box = row.getBoundingClientRect(), date = row.querySelector('.ex-daily-label'), amount = row.querySelector('.ex-daily-amount');
            if (date.getBoundingClientRect().right > amount.getBoundingClientRect().left - 1) issues.push('Date overlaps amount');
            for (const element of row.querySelectorAll('.ex-daily-date, .ex-daily-day, .ex-daily-amount, .ex-daily-share')) {
              const range = document.createRange(); range.selectNodeContents(element);
              for (const rect of range.getClientRects()) if (rect.left < box.left - .5 || rect.right > box.right + .5 || rect.top < box.top - .5 || rect.bottom > box.bottom + .5) issues.push(`${element.className}: clipped text`);
            }
            const bar = row.querySelector('.ex-daily-track > span'), start = parseFloat(bar.style.left), width = parseFloat(bar.style.width);
            if (!Number.isFinite(start + width) || start < 0 || width < 0 || start + width > 100.001) issues.push('Invalid bar geometry');
          });
          if (tracks.some(track => Math.abs(track.getBoundingClientRect().width - tracks[0].getBoundingClientRect().width) > .5)) issues.push('Rows use inconsistent chart scales');
          if (root.querySelector('.ex-daily-chart')?.textContent.match(/NaN|Infinity|undefined/)) issues.push('Invalid displayed value');
          return issues;
        } finally { root.remove(); }
      });
      assert.deepEqual(findings, [], `${label}: ${findings.join('; ')}`);
    };
    await open();
    const before = await page.evaluate(() => JSON.stringify({ entries: state.entries, itineraryItems: state.itineraryItems, companions: state.companions, totalBudget: state.totalBudget }));
    assert.equal(await page.locator('#printReport [data-entry-id]').count(), 14);
    assert.match(await page.locator('#exIncluded').innerText(), /14건 전체 포함/);
    await assertGeometry('expense sample');
    await assertDailyChart('daily shares sample');
    assert.deepEqual(await page.locator('#printReport .ex-daily-share').allTextContents(), ['38.3%', '35.8%', '25.9%']);
    assert.equal(await page.locator('#printReport .ex-paper').nth(0).locator('table').count(), 0, 'The overview never contains the detail ledger');
    assert.equal(await page.locator('#printReport .ex-paper').nth(1).locator('[data-entry-id]').count(), 14, 'All sample transactions start on the next page');
    assert.equal(await page.locator('#printReport [data-expense-average]').innerText(), '162,000 KRW');
    assert.equal(await page.locator('#printReport [data-expense-peak]').innerText(), '186,000 KRW');
    assert.deepEqual(await page.locator('#printReport .ex-highlight-label').allTextContents(), ['Daily average', 'Peak spending']);
    assert.deepEqual(await page.locator('#printReport .ex-spend-highlight small').allTextContents(), ['Total ÷ 3 days', 'Fri, Oct 9']);
    assert.equal(await page.locator('#printReport .ex-expense-highlights').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#printReport .ex-highlight-icon').count(), 0);
    assert.doesNotMatch(await page.locator('#printReport .ex-expense-highlights').innerText(), /[가-힣]/);
    await artworkReady();
    await page.screenshot({ path: path.join(output, 'expense-desktop.png') });
    await page.locator('#exPreview .ex-paper:not([hidden])').screenshot({ path: path.join(output, 'expense-paper-preview.png') });
    await page.pdf({ path: path.join(output, 'sample-expense.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.locator('[data-ex-action="next"]').click();
    assert.match(await page.locator('#exPageNumber').innerText(), /2 \/ 2/);
    assert.match(await page.locator('#exPreview .ex-paper:not([hidden])').innerText(), /상세 지출 내역[\s\S]+전체 14건/);
    await page.locator('[data-ex-action="previous"]').click();
    await type('itinerary');
    assert.equal(await page.locator('#printReport [data-schedule-event]').count(), 9);
    assert.equal(await page.locator('#printReport [data-itinerary-detail]').count(), 9);
    await assertGeometry('itinerary sample');
    await assertTimetableType('timetable sample');
    assert.match(await page.locator('#printReport [data-schedule-event="export-stop-1"] > .ex-time-transit').innerText(), /🚗 15분/);
    assert(await page.locator('#printReport [data-schedule-event="export-stop-0"]').evaluate(element => element.classList.contains('is-compact-event')));
    assert(await page.locator('#printReport [data-schedule-event="export-stop-2"]').evaluate(element => element.classList.contains('is-shallow-event')));
    await artworkReady();
    const artworks = await page.locator('#printReport [data-export-art]').evaluateAll(images => [...new Set(images.map(image => image.getAttribute('src')))]);
    assert(artworks.length >= 5, 'Schedule illustrations distinguish garden, cafe, lodging, market and other sightseeing types');
    const assetResults = await page.evaluate(async () => Promise.all(Object.values(window.TripLog.shared.itineraryArt.catalog).map(async art => {
      const image = new Image(); image.src = art.src;
      try { await image.decode(); return { id: art.id, width: image.naturalWidth, height: image.naturalHeight }; }
      catch { return { id: art.id, failed: true }; }
    })));
    assert.equal(assetResults.length, 50);
    assert(assetResults.every(row => !row.failed && row.width > 0 && row.height > 0), 'All 50 local type illustrations decode successfully');
    await page.screenshot({ path: path.join(output, 'itinerary-desktop.png') });
    await page.locator('#exPreview .ex-paper:not([hidden])').screenshot({ path: path.join(output, 'itinerary-paper-preview.png') });
    await page.pdf({ path: path.join(output, 'sample-itinerary.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.locator('[data-ex-action="next"]').click();
    assert.deepEqual(await page.locator('#exPreview .ex-itinerary-detail-table thead th').allTextContents(), ['날짜', '시간', '장소', '이동', '메모']);
    assert.deepEqual(await page.locator('#exPreview .ex-detail-day').evaluateAll(cells => cells.map(cell => cell.rowSpan)), [3, 3, 3]);
    await assertDayGroups(); await assertGeometry('five-column detailed itinerary');
    assert.equal(await page.locator('#printReport .ex-detail-location .ex-detail-transit').count(), 0, 'Transport no longer adds a line to the place cell');
    assert.equal(await page.locator('#printReport .ex-detail-transit-cell .ex-detail-transit').count(), 8);
    const detailType = await page.locator('#exPreview .ex-itinerary-detail-table').evaluate(table => ({
      font: getComputedStyle(table).fontFamily, padding: getComputedStyle(table.querySelector('td')).padding,
      place: getComputedStyle(table.querySelector('.ex-detail-place')).fontSize,
      memo: getComputedStyle(table.querySelector('.ex-detail-memo')).fontSize,
      height: parseFloat(getComputedStyle(table).height),
    }));
    assert(detailType.font.includes('TripLOG Collaboration'), 'The table uses the locally loaded Pretendard face');
    assert.equal(detailType.padding, '6px 8px'); assert.equal(detailType.place, '15px'); assert.equal(detailType.memo, '12.5px');
    assert(detailType.height < 650, 'Nine stops fit a compact table without forced tall rows');
    await page.screenshot({ path: path.join(output, 'detail-desktop.png') });
    await page.locator('[data-ex-day="2026-10-10"]').click(); await previewReady();
    assert.equal(await page.locator('#printReport [data-schedule-event]').count(), 3);
    assert.equal(await page.locator('#printReport [data-itinerary-detail]').count(), 3);
    await page.locator('[data-ex-option="transit"]').uncheck(); await previewReady();
    assert.equal(await page.locator('#printReport .ex-detail-transit, #printReport .ex-detail-route').count(), 0);
    assert.equal(await page.locator('#printReport .ex-time-transit').count(), 0);
    await page.locator('[data-ex-option="notes"]').uncheck(); await previewReady();
    assert.equal(await page.locator('#printReport .ex-detail-address').count(), 0);
    assert((await page.locator('#printReport .ex-detail-memo').allTextContents()).every(value => value === ''));
    assert.equal(await page.locator('#printReport .ex-detail-place').count(), 3);
    await page.locator('[data-ex-option="notes"]').check(); await previewReady();
    await page.locator('[data-ex-day="all"]').click(); await previewReady();
    await page.locator('[data-ex-option="transit"]').check(); await previewReady();
    await page.locator('[data-ex-action="next"]').click();
    for (const width of [320, 390, 599, 759, 760, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 760 ? 844 : 1050 });
      await page.waitForFunction(() => {
        const dialog = document.querySelector('#rdPdf'), footer = dialog.querySelector('.ex-studio-footer');
        return Math.abs(dialog.getBoundingClientRect().right - innerWidth) < innerWidth && footer.getBoundingClientRect().bottom <= innerHeight + 1;
      });
      const sizes = await page.evaluate(() => {
        const dialog = document.querySelector('#rdPdf'), controls = dialog.querySelector('.ex-controls'), footer = dialog.querySelector('.ex-studio-footer'), save = document.querySelector('#exSave');
        return { pageFits: document.documentElement.scrollWidth <= innerWidth + 1, dialogFits: dialog.scrollWidth <= dialog.clientWidth + 1, controlsFit: controls.scrollWidth <= controls.clientWidth + 1,
          footerBottom: footer.getBoundingClientRect().bottom, saveWidth: save.getBoundingClientRect().width, saveHeight: save.getBoundingClientRect().height,
          toggleDirection: getComputedStyle(document.querySelector('.ex-switch-row')).flexDirection };
      });
      assert(sizes.pageFits && sizes.dialogFits && sizes.controlsFit, `${width}px: no horizontal page overflow ${JSON.stringify(sizes)}`);
      assert(sizes.saveHeight >= 44 && sizes.saveWidth > 100, `${width}px: save remains tappable`);
      assert.equal(sizes.toggleDirection, 'row');
      await assertGeometry(`detailed table at ${width}px`);
      await assertTimetableType(`timetable at ${width}px`);
      if ([320, 390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `itinerary-${width}.png`) });
      if (width === 390) {
        assert.equal(await page.locator('#exMobileItinerary details').count(), 3);
        assert(await page.locator('#exMobileItinerary details').nth(0).evaluate(element => element.open));
        await page.locator('#exMobileItinerary summary').nth(0).click();
        await page.locator('#exMobileItinerary summary').nth(1).click();
        assert(await page.locator('#exMobileItinerary details').nth(1).evaluate(element => element.open));
        assert.match(await page.locator('#exMobileItinerary details').nth(1).innerText(), /낙안읍성[\s\S]+감성 카페[\s\S]+순천만습지/);
        await page.screenshot({ path: path.join(output, 'itinerary-390-expanded.png') });
        assert.equal(await page.locator('#printReport [data-itinerary-detail]').count(), 9, 'Accordion state does not change exported scope');
        await page.locator('#exPreviewTitle').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'detail-390.png') });
        await page.locator('[data-ex-action="zoom"]').click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Zoom scrolls inside the preview rather than widening the app');
        await page.screenshot({ path: path.join(output, 'detail-390-zoom.png') });
        await page.locator('[data-ex-action="zoom"]').click();
        await page.locator('[data-ex-action="previous"]').click();
        assert.match(await page.locator('#exPreview .ex-paper:not([hidden])').innerText(), /한눈에 보는 시간표/);
        await page.locator('#exPreviewTitle').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'timetable-390.png') });
        await page.locator('[data-ex-action="zoom"]').click();
        await page.locator('#exPreview [data-schedule-event="export-stop-1"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'timetable-390-zoom.png') });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Timetable zoom remains inside the preview');
        await page.locator('[data-ex-action="zoom"]').click();
        await page.locator('[data-ex-action="next"]').click();
      }
    }
    await type('expense');
    for (const width of [320, 390, 599, 759, 760, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 760 ? 844 : 1050 });
      await assertGeometry(`daily chart at ${width}px`); await assertDailyChart(`daily chart at ${width}px`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Daily chart does not widen the app');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#exPreviewTitle').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'expense-390.png') });
    await page.locator('[data-ex-action="zoom"]').click();
    await page.locator('#exPreview .ex-daily-chart').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'expense-390-zoom.png') });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Daily chart zoom pans within the preview');
    await page.locator('[data-ex-action="zoom"]').click();
    await page.locator('[data-ex-option="charts"]').uncheck(); await previewReady();
    assert.equal(await page.locator('#printReport .ex-expense-charts').count(), 0);
    assert.equal(await page.locator('#printReport [data-entry-id]').count(), 14);
    assert.equal(await page.locator('#printReport .ex-expense-overview-paper table').count(), 0);
    await assertGeometry('overview with charts disabled');
    await page.locator('[data-ex-option="charts"]').check(); await previewReady();
    await page.locator('#exExpensePeriodButton').click();
    await page.getByRole('option', { name: '2026.10.10 (토)', exact: true }).click(); await previewReady();
    assert.equal(await page.locator('#printReport [data-entry-id]').count(), 5);
    assert.match(await page.locator('#printReport .ex-total').innerText(), /174,000/);
    assert.deepEqual(await page.locator('#printReport .ex-daily-share').allTextContents(), ['100.0%']);
    assert.equal(await page.locator('#printReport .ex-paper').nth(0).locator('[data-entry-id]').count(), 0);
    assert.equal(await page.locator('#printReport .ex-paper').nth(1).locator('[data-entry-id]').count(), 5);
    assert.equal(await page.locator('#printReport [data-expense-average]').innerText(), '174,000 KRW');
    assert.equal(await page.locator('#printReport .ex-spend-highlight small').first().innerText(), 'Selected day');
    assert.equal(await page.evaluate(() => JSON.stringify({ entries: state.entries, itineraryItems: state.itineraryItems, companions: state.companions, totalBudget: state.totalBudget })), before, 'Preview controls never change saved records');
    await page.evaluate(() => { window.exportPrintCalls = 0; window.print = () => { window.exportPrintCalls++; window.dispatchEvent(new Event('afterprint')); }; });
    await page.locator('#exSave').click();
    await page.waitForFunction(() => window.exportPrintCalls === 1 && !document.querySelector('#exSave').disabled);
    assert.equal(await page.title(), '여행 가계부', 'The save action restores the document title after printing');
    assert.equal(await page.locator('#printReport [data-entry-id]').count(), 5, 'The print action uses the current explicit scope');
    await page.locator('[data-ex-action="close"]').click();
    assert(await page.locator('#settingsPage [data-rd-action="pdf"]').evaluate(el => el === document.activeElement));
    await open('export-many'); await page.setViewportSize({ width: 1440, height: 1050 });
    const ids = await page.locator('#printReport [data-entry-id]').evaluateAll(rows => rows.map(row => row.dataset.entryId));
    assert.equal(ids.length, 137); assert.equal(new Set(ids).size, 137);
    assert(ids.includes('ledger-000') && ids.includes('ledger-134') && ids.includes('foreign') && ids.includes('refund'));
    assert(await page.locator('#printReport [data-entry-continuation]').count() > 0);
    const longNote = await page.locator('#printReport [data-entry-id="ledger-018"] .ex-entry-note, #printReport [data-entry-continuation="ledger-018"] .ex-entry-note').allTextContents();
    assert.equal(longNote.join(''), '긴 메모도 잘리지 않고 다음 페이지로 이어져야 합니다. '.repeat(100));
    await assertGeometry('137 rows, long notes, foreign and refund');
    await assertDailyChart('pretrip purchases and refunds');
    await page.pdf({ path: path.join(output, 'all-137-expenses.pdf'), preferCSSPageSize: true, printBackground: true });
    const allPages = await page.locator('#printReport .ex-paper').count();
    assert(allPages > 3);
    assert.equal(await page.locator('#printReport .ex-ledger thead').count(), allPages - 1, 'The overview is followed by dedicated ledger pages');
    await type('full'); await assertGeometry('combined report');
    assert.equal(await page.locator('#printReport [data-entry-id]').count(), 137);
    assert.equal(await page.locator('#printReport [data-itinerary-detail]').count(), 9);
    assert.equal(await page.locator('#printReport .ex-expense-overview-paper').count(), 1);
    assert.equal(await page.locator('#printReport .ex-expense-overview-paper table').count(), 0);
    assert.equal(await page.locator('#printReport .ex-expense-detail-paper [data-entry-id]').count(), 137);
    const savedExpenseFixture = await page.evaluate(() => ({ entries: state.entries, startDate: state.startDate, endDate: state.endDate }));
    for (const amounts of [[100000, -25000], [100000, -100000], [25000, -100000], [0, 0], [1234567890, 500, 0.001]]) {
      await page.evaluate(values => {
        state.entries = values.map((amount, index) => ({ id: `daily-edge-${index}`, date: `2026-10-${String(index + 9).padStart(2, '0')}`, amount, category: '기타', description: '일자별 비중 검증' }));
      }, amounts);
      await type('expense'); await assertGeometry(`daily edge ${amounts}`); await assertDailyChart(`daily edge ${amounts}`);
      const shares = await page.locator('#printReport .ex-daily-share').allTextContents();
      if (amounts[1] === -25000) {
        assert.deepEqual(shares, ['133.3%', '-33.3%', '0.0%']);
        assert.match(await page.locator('#printReport .ex-daily-chart').innerText(), /0선 왼쪽은 환불/);
        await page.pdf({ path: path.join(output, 'daily-refunds.pdf'), preferCSSPageSize: true, printBackground: true });
      } else if (amounts.reduce((sum, value) => sum + value, 0) <= 0) {
        assert(shares.every(value => value === '—'));
        assert.match(await page.locator('#printReport .ex-daily-chart').innerText(), /합계가 0원 이하/);
      } else assert.equal(shares[1], '<0.1%');
    }
    await page.evaluate(() => {
      state.startDate = '2026-10-01'; state.endDate = '2026-10-31';
      state.entries = Array.from({ length: 31 }, (_, index) => ({ id: `daily-long-${index}`, date: `2026-10-${String(index + 1).padStart(2, '0')}`, amount: (index + 1) * 1000, category: '식비', description: '긴 여행의 지출' }));
      state.entries.push({ id: 'daily-pre', date: '__pretrip__', amount: 50000, category: '교통' }, { id: 'daily-undated', date: '', amount: 2000, category: '기타' });
    });
    await type('expense'); await assertGeometry('seven grouped daily rows'); await assertDailyChart('seven grouped daily rows');
    assert.equal(await page.locator('#printReport .ex-daily-item').count(), 7);
    assert.match(await page.locator('#printReport .ex-daily-chart').innerText(), /사전구매[\s\S]+날짜 미정/);
    await page.pdf({ path: path.join(output, 'daily-long-trip.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(value => Object.assign(state, value), savedExpenseFixture);
    // Exercise input shapes beyond the illustrative three-day trip. These are
    // in-memory fixtures in a disposable browser, never persisted user records.
    const multiline = Array.from({ length: 100 }, (_, index) => `메모 ${index + 1}`).join('\n');
    await page.evaluate(note => {
      state.entries[0].note = note;
      state.tripName = '온 가족이 함께 천천히 걸으며 남긴 순천과 남해의 가을 여행 기록';
    }, multiline);
    await type('expense'); await assertGeometry('multiline note and long trip title');
    const preservedLines = await page.locator('#printReport [data-entry-id="ledger-000"] .ex-entry-note, #printReport [data-entry-continuation="ledger-000"] .ex-entry-note').allTextContents();
    assert.equal(preservedLines.join(''), multiline, 'Every line of a multiline note survives pagination');
    await page.evaluate(() => {
      state.itineraryItems = Array.from({ length: 18 }, (_, i) => ({ id: `dense-${i}`, date: i < 12 ? '2026-10-09' : '2026-10-12', time: i < 12 ? '09:00' : '', endTime: i < 12 ? '11:00' : '', place: `겹치는 일정 ${i}`, memo: '상세 정보도 보존', createdAt: i }));
      state.itineraryItems.push({ id: 'night', date: '2026-10-10', time: '23:30', endTime: '01:15', place: '밤 기차', createdAt: 20 });
      state.itineraryItems.push({ id: 'no-date', date: '', time: '', place: '날짜 미정 장소', createdAt: 21 });
    });
    await type('itinerary'); await assertGeometry('dense, untimed, overnight, out-of-range itinerary');
    await assertTimetableType('dense, untimed and overnight timetable');
    assert.equal(await page.locator('#printReport [data-itinerary-detail]').count(), 20);
    const detailIds = await page.locator('#printReport [data-itinerary-detail]').evaluateAll(rows => rows.map(row => row.dataset.itineraryDetail));
    assert.equal(new Set(detailIds).size, 20);
    assert.match(await page.locator('#printReport').innerText(), /다음날 01:15/);
    assert.match(await page.locator('#printReport').innerText(), /날짜 미정 장소/);
    await assertDayGroups();
    const modes = [['walk', '🚶'], ['car', '🚗'], ['bus', '🚌'], ['train', '🚆'], ['flight', '✈️'], ['subway', '🚇'], ['taxi', '🚕'], ['ferry', '🚢'], ['bicycle', '🚲'], ['etc', '✈️'], ['unknown', '🧭'], ['none', '🧭']];
    await page.evaluate(values => {
      state.tripName = '교통수단별 상세 일정';
      state.itineraryItems = values.map(([mode], index) => ({ id: `mode-${mode}`, date: `2026-10-${String(9 + Math.floor(index / 4)).padStart(2, '0')}`, time: `${String(8 + (index % 4) * 2).padStart(2, '0')}:00`, endTime: `${String(8 + (index % 4) * 2).padStart(2, '0')}:30`, place: `${mode} 이동 예시`, theme: 'transport', trans: mode, duration: index + 7, cost: 0, memo: '저장한 교통수단과 이동 시간을 표시합니다.', createdAt: index }));
      state.itineraryItems.push({ id: 'multi-leg', date: '2026-10-11', time: '17:00', place: '복합 이동', trans: 'car', duration: 99, transits: [{ trans: 'walk', duration: 5, memo: '정류장까지' }, { trans: 'bus', duration: 20, cost: 1500, fromPlace: '중앙 정류장', memo: '급행' }, { trans: 'subway', duration: 12 }], createdAt: 20 });
      state.itineraryItems.push({ id: 'no-move', date: '2026-10-11', time: '18:00', place: '이동 없는 일정', trans: 'none', duration: 0, cost: 0, createdAt: 21 });
      state.itineraryItems.push({ id: 'reservation-route', date: '2026-10-11', time: '23:40', endTime: '08:00', place: '항공 예약', theme: 'transport', trans: 'walk', duration: 3, transportReservation: { kind: 'flight', from: '인천', to: '런던', arrivalDate: '2026-10-12' }, createdAt: 22 });
    }, modes);
    await type('itinerary'); await assertGeometry('all transport modes and multiple legs'); await assertDayGroups();
    await assertTimetableType('transport mode timetable');
    for (const [[mode, emoji], index] of modes.map((value, index) => [value, index])) {
      assert.equal(await page.locator(`#printReport [data-itinerary-detail="mode-${mode}"] .ex-detail-transit`).innerText(), `${emoji} ${index + 7}분`);
    }
    const multi = await page.locator('#printReport [data-itinerary-detail="multi-leg"] .ex-detail-transit').allTextContents();
    assert.equal(multi.length, 3); assert.match(multi[0], /🚶 5분/); assert.match(multi[1], /중앙 정류장 · 🚌 20분 · 1,500원 · 급행/); assert.match(multi[2], /🚇 12분/);
    assert(multi.every(value => !value.includes('🚗') && !value.includes('99분')));
    assert.equal(await page.locator('#printReport [data-itinerary-detail="no-move"] .ex-detail-transit').count(), 0);
    assert.equal(await page.locator('#printReport [data-itinerary-detail="reservation-route"] .ex-detail-route').innerText(), '✈️ 인천 → 런던');
    await page.pdf({ path: path.join(output, 'transport-modes.pdf'), preferCSSPageSize: true, printBackground: true });
    const longDetails = { place: '아주 긴 장소 이름 🏞️ '.repeat(100), location: '긴 상세 주소 <장소> & 동 100호 '.repeat(100), memo: '긴 메모 🧳 가족 👨‍👩‍👧‍👦\n'.repeat(100), transit: '긴 이동 메모 <버스>\n'.repeat(75) };
    await page.evaluate(values => {
      state.itineraryItems.push({ id: 'long-details', date: '2026-10-09', time: '19:00', place: values.place, location: values.location, memo: values.memo, transits: [{ trans: 'bus', duration: 43, cost: 2000, memo: values.transit }], createdAt: 30 });
    }, longDetails);
    await type('itinerary'); await assertGeometry('very long place, address, transit and multiline memo'); await assertDayGroups();
    const longRows = '#printReport [data-itinerary-detail="long-details"], #printReport [data-itinerary-continuation="long-details"]';
    for (const [field, expected] of Object.entries({ place: longDetails.place, address: longDetails.location, memo: longDetails.memo, transit: `🚌 43분 · 2,000원 · ${longDetails.transit}` })) {
      assert.equal((await page.locator(longRows).locator(`.ex-detail-${field}`).allTextContents()).join(''), expected, `No text lost while splitting ${field}`);
    }
    assert(await page.locator('#printReport [data-itinerary-continuation="long-details"]').count() > 0);
    assert.equal(await page.locator('#printReport .ex-itinerary-detail-table').count(), await page.locator('#printReport .ex-itinerary-detail-table thead').count());
    assert.equal(await page.locator('#printReport .ex-detail-location script, #printReport .ex-detail-location img').count(), 0, 'Input text is escaped, not interpreted as markup');
    await page.pdf({ path: path.join(output, 'long-itinerary-details.pdf'), preferCSSPageSize: true, printBackground: true });
    await assertTimetableType('long timetable labels');
    await page.evaluate(() => {
      state.tripName = '겹치는 일정의 글자 배치';
      state.itineraryItems = ['2026-10-09', '2026-10-10', '2026-10-11'].flatMap((date, day) => Array.from({ length: 4 }, (_, index) => ({
        id: `type-overlap-${day}-${index}`, date, time: index < 2 ? '09:00' : '12:30', endTime: index < 2 ? '09:20' : '14:30', theme: 'sightseeing',
        place: index % 2 ? '나란히 겹쳐도 읽을 수 있는 긴 장소 이름' : '짧은 일정', trans: 'walk', duration: 7, createdAt: day * 10 + index,
      })));
      state.itineraryItems.push({ id: 'type-overnight', date: '2026-10-09', time: '23:30', endTime: '01:15', theme: 'transport', place: '다음날 도착하는 긴 야간 이동 일정', trans: 'train', duration: 105, createdAt: 50 });
    });
    await type('itinerary'); await assertGeometry('overlapping short and medium event typography'); await assertTimetableType('overlap typography');
    assert.equal(await page.locator('#printReport [data-schedule-event]').count(), 13);
    assert.equal(await page.locator('#printReport [data-itinerary-detail]').count(), 13);
    assert(await page.locator('#printReport .is-narrow-event').count() > 0);
    await page.pdf({ path: path.join(output, 'timetable-overlap.pdf'), preferCSSPageSize: true, printBackground: true });
    await open();
    await page.evaluate(() => {
      state.startDate = '2026-10-10'; state.endDate = '2026-10-11';
      state.entries = [
        { id: 'summary-pretrip', date: '__pretrip__', paymentDate: '2026-10-01', amount: 195600, category: '교통' },
        { id: 'summary-day-one', date: '2026-10-10', amount: 47200, category: '식비' },
        { id: 'summary-day-two', date: '2026-10-11', amount: 44000, category: '관광' },
      ];
    });
    await type('expense');
    assert.equal(await page.locator('#printReport [data-expense-average]').innerText(), '143,400 KRW');
    assert.equal(await page.locator('#printReport [data-expense-peak]').innerText(), '195,600 KRW');
    assert.deepEqual(await page.locator('#printReport .ex-spend-highlight small').allTextContents(), ['Total ÷ 2 days', 'Pre-trip purchases']);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width < 760 ? 844 : 1050 });
      await assertGeometry(`English summary at ${width}px`);
      await page.locator('#exPreview .ex-expense-highlights').screenshot({ path: path.join(output, `summary-english-${width}.png`), animations: 'disabled' });
    }
    await page.pdf({ path: path.join(output, 'summary-english.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(() => { state.entries = [{ id: 'summary-undated', date: '', amount: 98765432100, category: '기타' }]; });
    await type('expense'); await assertGeometry('large English summary amounts');
    assert.equal(await page.locator('#printReport [data-expense-peak]').innerText(), '98,765,432,100 KRW');
    assert.equal(await page.locator('#printReport .ex-spend-highlight small').last().innerText(), 'Undated expenses');
    await page.evaluate(() => { state.startDate = state.endDate = '2026-10-10'; state.entries = [{ id: 'summary-single-day', date: '2026-10-10', amount: 9000, category: '기타' }]; });
    await type('expense');
    assert.equal(await page.locator('#printReport .ex-spend-highlight small').first().innerText(), 'Total ÷ 1 day');
    await open('export-empty'); await assertGeometry('empty expense');
    assert.equal(await page.locator('#printReport [data-expense-average]').innerText(), '—');
    assert.equal(await page.locator('#printReport [data-expense-peak]').innerText(), '—');
    assert.deepEqual(await page.locator('#printReport .ex-spend-highlight small').allTextContents(), ['Available for dated periods', 'No positive spending']);
    assert.doesNotMatch(await page.locator('#printReport .ex-expense-highlights').innerText(), /[가-힣]/);
    await type('itinerary'); await assertGeometry('empty itinerary');
    assert.match(await page.locator('#printReport').innerText(), /아직 일정이 없어요/);
    // Block the specific type and then its category fallback on a fresh document.
    // This verifies the real image-error path with no external service available.
    await context.route('**/itinerary-art/v1/garden.webp', route => route.abort());
    await context.route('**/itinerary-art/v1/sightseeing.webp', route => route.abort());
    await open(); await type('itinerary'); await artworkReady();
    const recovered = page.locator('#printReport img[data-illustration-type="garden"]');
    assert(await recovered.count() > 0);
    assert(await recovered.evaluateAll(images => images.every(image => image.getAttribute('src').endsWith('/travel.webp') && image.naturalWidth > 0 && !image.hidden)), 'Failed type/category images recover to the universal local artwork');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`PASS export browser: full-page expense overview, dedicated detail pages, calculated spending highlights, unclipped category amounts, daily percentages, proportional/signed bars, zero/negative totals, small shares, 7 date groups, native chart text/scale alignment, refined timetable typography, compact/shallow/medium/tall/overlap layouts, text/art separation, readable overlap pagination, 5-column compact itinerary, separate transport column, date rowspans, transport emojis/multiple legs/reservation routes, lossless long detail pagination, full ledger (137 unique rows), long notes, foreign/refund, matching preview typography, sample PDFs, timetable/date controls, 50 type illustrations and failed-image recovery, mobile 320/390/599/759/760/1024/1440, immutable data, focus return, empty/combined reports; ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
