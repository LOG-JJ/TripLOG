// Browser plugin not available: use a fresh Playwright/Edge context and synthetic
// trip data on a random-port repository server. All external requests are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, startServer, stopServer, seedTrip, blockExternalRequests, waitForApp } = require('./helpers/browser-fixture');
const { createServer } = require('./serve-test');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('trip-navigation');
const seed = {
  ...require('./fixtures/trip-library').find(trip => trip.id === 'library-osaka'),
  id: 'navigation-fixture',
  itineraryItems: Array.from({ length: 10 }, (_, index) => ({
    id: `navigation-stop-${index}`, date: '2026-09-25', time: `${String(8 + index).padStart(2, '0')}:00`,
    endTime: `${String(8 + index).padStart(2, '0')}:30`, place: `오사카 여행 장소 ${index + 1}`, theme: 'sightseeing', createdAt: index,
  })),
};
const groups = { itinerary: { title: '일정', count: 5 }, budget: { title: '지출', count: 4 }, report: { title: '리포트', count: 3 } };

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer(() => createServer({ pagesRedirects: true }));
  const browser = await launchBrowser();
  const evidence = [], errors = [], consoleIssues = [], dockComparisons = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', hasTouch: true });
    context.setDefaultTimeout(12000);
    await blockExternalRequests(context, origin);
    await seedTrip(context, {
      origin, user: { id: '00000000-0000-4000-8000-000000000087', email: 'navigation@example.test', user_metadata: { display_name: '탐색 검증' } },
      expiry: Math.floor(Date.now() / 1000) + 3600, seed, marker: 'navigation-fixture',
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-09-25T09:00:00+09:00'));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type()) && !/net::ERR_FAILED|Failed to fetch|Service Worker registration blocked by Playwright/.test(message.text())) consoleIssues.push(message.text());
    });
    const menu = page.locator('#tripNavigationMenu'), panel = page.locator('#tripNavigationPanel');
    const original = key => page.locator(`.tl-bottom-nav:not(.tl-nav-dock):visible [data-trip-nav="${key}"]`).last();
    const dock = key => menu.locator(`.tl-nav-dock [data-trip-nav="${key}"]`);
    const closed = () => menu.waitFor({ state: 'hidden' });
    const settled = () => page.waitForFunction(() => document.querySelector('#tripNavigationMenu')?.dataset.animating !== 'true' && [...(document.querySelector('#tripNavigationMenu')?.getAnimations({ subtree: true }) || [])].every(animation => animation.playState !== 'running'));
    const waitPage = name => page.waitForFunction(name => activePage === name && document.body.dataset.page === name, name);
    const data = () => page.evaluate(() => JSON.stringify({ entries: state.entries, itineraryItems: state.itineraryItems, companions: state.companions, packingList: state.packingList }));
    async function open(key) {
      const dockBefore = await original(key).evaluate(button => [...button.closest('nav').querySelectorAll('[data-trip-nav]')].map(node => {
        const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height };
      }));
      await original(key).click(); await menu.waitFor();
      await page.waitForFunction(title => document.querySelector('#tripNavigationTitle')?.textContent.trim() === title, groups[key].title);
      await settled();
      assert.equal(await menu.locator('[data-nav-item]').count(), groups[key].count);
      const surfaces = await menu.locator('.tl-nav-panel, .tl-nav-dock, [data-nav-item]').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
      assert(surfaces.every(color => color === 'rgb(255, 255, 255)'), `Navigation uses the main white surface: ${surfaces}`);
      assert.equal(await dock(key).getAttribute('aria-expanded'), 'true');
      const dockAfter = await menu.locator('.tl-nav-dock [data-trip-nav]').evaluateAll(nodes => nodes.map(node => {
        const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height };
      }));
      for (let index = 0; index < 5; index++) for (const axis of ['x', 'y', 'width', 'height']) {
        assert(Math.abs(dockBefore[index][axis] - dockAfter[index][axis]) <= 1, `Opening ${key} preserves dock button ${index} ${axis}: ${dockBefore[index][axis]} vs ${dockAfter[index][axis]}`);
      }
      dockComparisons.push({ group: key, viewport: page.viewportSize(), before: dockBefore, after: dockAfter });
    }
    async function choose(group, item) {
      await open(group); await menu.locator(`[data-nav-item="${item}"]`).click(); await closed();
    }
    async function capture(name) {
      const file = `${name}.png`; await page.screenshot({ path: path.join(output, file), animations: 'disabled' }); evidence.push(file);
    }
    async function fits(width, height) {
      const geometry = await menu.evaluate(node => {
        const box = selector => { const b = node.querySelector(selector).getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
        return { panel: box('#tripNavigationPanel'), dock: box('.tl-nav-dock'),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          targets: [...node.querySelectorAll('.tl-nav-dock button, [data-nav-item], .tl-nav-close')].map(el => ({ label: el.textContent.trim() || el.getAttribute('aria-label'), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
        };
      });
      assert(!geometry.overflow, `No horizontal page overflow at ${width}`);
      for (const [name, box] of Object.entries({ panel: geometry.panel, dock: geometry.dock })) {
        assert(box.left >= -1 && box.right <= width + 1 && box.top >= -1 && box.bottom <= height + 1, `${name} fits ${width}×${height}: ${JSON.stringify(box)}`);
      }
      assert(geometry.panel.bottom <= geometry.dock.top + 1, 'The menu does not cover its navigation dock');
      for (const target of geometry.targets) assert(target.width >= 40 && target.height >= 40, `Reachable touch target ${target.label}: ${JSON.stringify(target)}`);
    }

    await page.goto(`${origin}/Travel?page=overview&trip=${seed.id}`); await waitForApp(page); await waitPage('overview');
    assert.equal(await page.title(), '여행 가계부'); assert.equal(new URL(page.url()).origin, origin);
    assert.match(await page.locator('#rdOverview').innerText(), /오사카/);
    assert.equal(await page.locator('vite-error-overlay, nextjs-portal').count(), 0);
    // Finish the fixture's first persistence/normalization before comparing
    // later navigation with it, including the generated stable sort positions.
    assert.equal(await page.evaluate(() => saveStateSilently()), true);
    await page.evaluate(() => window.TripLog.persistence.stateStorage.whenSaved());
    const baseline = await data();
    for (const [width, height] of [[320, 568], [320, 740], [390, 844], [844, 390], [1280, 900]]) {
      await page.setViewportSize({ width, height });
      const labels = await page.locator('.rd-nav [data-trip-nav] > span:not(.tl-nav-expand)').allTextContents();
      assert.deepEqual(labels, ['개요', '일정', '지출', '리포트', '설정']);
      for (const key of Object.keys(groups)) {
        const before = { url: page.url(), page: await page.evaluate(() => activePage), y: await page.evaluate(() => scrollY) };
        await open(key); await fits(width, height); await capture(`${key}-${width}x${height}`);
        assert.equal(await page.locator('.tl-bottom-nav:not(.tl-nav-dock):visible').count(), 0, 'Only the modal dock is visible while the menu is open');
        await menu.locator('[data-nav-item]').last().scrollIntoViewIfNeeded();
        const last = await menu.locator('[data-nav-item]').last().boundingBox(), dockBox = await menu.locator('.tl-nav-dock').boundingBox();
        assert(last.y + last.height <= dockBox.y + 1, 'The last destination remains reachable above the dock on short screens');
        assert.equal(page.url(), before.url, 'Opening a menu preserves the route');
        assert.equal(await page.evaluate(() => activePage), before.page, 'Opening a menu preserves its underlying page');
        assert(Math.abs(await page.evaluate(() => scrollY) - before.y) <= 1, 'Opening a menu preserves the reading position');
        await menu.locator('.tl-nav-close').click(); await closed();
      }
    }
    console.log('PASS navigation: meaningful app, five labels, 5/4/3 submenu items, 320/390/844/1280 including short/landscape fit, touch targets and route/scroll preservation');

    await page.setViewportSize({ width: 390, height: 844 });
    await choose('itinerary', 'itinerary'); await waitPage('itinerary');
    await page.evaluate(() => scrollTo(0, 480));
    const scroll = await page.evaluate(() => scrollY), currentUrl = page.url();
    assert(scroll > 100, 'The itinerary fixture supports a meaningful reading-position test');
    await open('itinerary');
    assert.equal(await page.evaluate(() => scrollY), scroll);
    await dock('budget').click();
    await page.waitForFunction(() => document.querySelector('#tripNavigationTitle').textContent.trim() === '지출');
    await dock('report').click();
    await page.waitForFunction(() => document.querySelector('#tripNavigationTitle').textContent.trim() === '리포트');
    await dock('itinerary').click();
    await page.waitForFunction(() => document.querySelector('#tripNavigationTitle').textContent.trim() === '일정');
    await settled(); assert.equal(await menu.locator('.tl-nav-content').count(), 1, 'Switching leaves one live menu content tree');
    await page.keyboard.press('Escape'); await closed();
    assert.equal(page.url(), currentUrl); assert.equal(await page.evaluate(() => scrollY), scroll);
    await open('budget'); await dock('budget').click(); await closed();
    await open('report'); await menu.locator('.tl-nav-backdrop').click({ position: { x: 5, y: 5 } }); await closed();
    await open('itinerary'); await page.goBack(); await closed(); await waitPage('itinerary');
    assert.equal(page.url(), currentUrl, 'Back first dismisses the menu without leaving the page');
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden', 'Dismissal releases background scrolling');
    console.log('PASS navigation: rapid group switching, toggle, close, backdrop, Escape and browser Back dismiss cleanly without stale layers');

    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('#itineraryList .timeline-edit[data-itinerary-action="edit"]').first().click();
    await page.locator('#itineraryEditor').waitFor();
    await page.locator('#itineraryExtraDetails > summary').click();
    await page.locator('#itineraryMemoInput').fill('저장하지 않은 편집 내용');
    await page.locator('#itineraryEditor .tl-bottom-nav [data-trip-nav="budget"]').click(); await menu.waitFor(); await settled();
    assert(await page.locator('#itineraryEditor').evaluate(el => el.open), 'Opening the navigation menu keeps the editor underneath');
    await page.keyboard.press('Escape'); await closed();
    assert.equal(await page.locator('#itineraryMemoInput').inputValue(), '저장하지 않은 편집 내용');
    assert(await page.locator('#itineraryEditor').isVisible());
    await page.locator('#itineraryEditor .tl-bottom-nav [data-trip-nav="budget"]').click(); await menu.waitFor();
    await menu.locator('[data-nav-item="expenses"]').click(); await closed(); await waitPage('budget');
    await page.locator('#itineraryEditor').waitFor({ state: 'hidden' });
    assert.equal(await data(), baseline, 'Navigation does not submit an unfinished itinerary edit');
    console.log('PASS navigation: nested menu preserves unfinished itinerary input; destination selection closes the editor without changing saved data');

    for (const [item, title] of [['today', '오늘의 여행'], ['review', '일정 점검'], ['wallet', '예약 지갑'], ['tools', '여행 도구']]) {
      await choose('itinerary', item); await page.locator('#ttCompanion').waitFor();
      assert.equal(await page.locator('#ttCompanionTitle').innerText(), title);
      assert.equal(await page.locator('#ttNav [aria-current="page"]').getAttribute('data-tab'), item);
      await page.locator('#ttCompanion .tt-header [data-tt-action="close"]').click(); await page.locator('#ttCompanion').waitFor({ state: 'hidden' });
    }
    await choose('budget', 'expense-new'); await page.locator('#rdExpenseEditor').waitFor();
    assert.match(await page.locator('#rdExpenseEditorTitle').innerText(), /지출/);
    await page.locator('#rdExpenseEditor [data-rd-action="close"]').first().click(); await page.locator('#rdExpenseEditor').waitFor({ state: 'hidden' });
    await choose('budget', 'receipt'); await page.locator('#receiptDialog').waitFor();
    assert.match(await page.locator('#receiptDialogTitle').innerText(), /영수증|지출 정보 가져오기/);
    await page.locator('#receiptCloseButton').click(); await page.locator('#receiptDialog').waitFor({ state: 'hidden' });
    if (await page.locator('#rdExpenseEditor').isVisible()) { await page.locator('#rdExpenseEditor [data-rd-action="close"]').first().click(); await page.locator('#rdExpenseEditor').waitFor({ state: 'hidden' }); }
    await choose('budget', 'settlement'); await waitPage('settlement');
    assert.equal(await original('budget').getAttribute('aria-current'), 'page', 'Settlement belongs to the expense navigation group');
    await choose('budget', 'expenses'); await waitPage('budget');
    for (const [item, target] of [['report-expenses', '#rdReportExpenses'], ['report-itinerary', '#rdReportItinerary']]) {
      await choose('report', item); await waitPage('report'); assert(await page.locator(target).isVisible());
    }
    await choose('report', 'pdf');
    await page.waitForFunction(() => document.querySelector('#rdPdf')?.open && !document.querySelector('#exSave')?.disabled && document.querySelector('#exPreview .ex-paper'));
    assert(await page.locator('#exPreview').innerText(), 'PDF destination builds a real preview');
    await page.locator('#rdPdf [data-ex-action="close"]').click(); await page.locator('#rdPdf').waitFor({ state: 'hidden' });
    console.log('PASS navigation: itinerary, today, review, wallet, tools, expenses, new expense, receipt, settlement, both report tabs and generated PDF preview');

    await original('settings').click(); await waitPage('settings'); assert.equal(await menu.isVisible(), false);
    for (const action of ['trip-edit-current', 'invite', 'history', 'backup', 'sync-status', 'advanced']) assert(await page.locator(`#settingsPage [data-rd-action="${action}"]`).isVisible(), `Settings retains ${action}`);
    await page.locator('#settingsPage [data-rd-action="sync-status"]').click(); await page.locator('#triplogSyncStatus').waitFor();
    await page.locator('#triplogSyncStatus .sync-close').click();
    await original('overview').click(); await waitPage('overview');
    await page.locator('#rdMenuButton').click(); await waitPage('settings');
    assert.equal(await menu.isVisible(), false, 'Header settings opens the settings page directly');
    assert.equal(await data(), baseline, 'Every navigation path preserves itinerary, expenses, members and packing');

    await original('overview').click(); await waitPage('overview');
    await open('itinerary');
    await page.evaluate(() => document.querySelector('#tripNavigationMenu').close()); await closed();
    await page.waitForFunction(() => !document.documentElement.style.overflow && !history.state?.tripNavigation);
    await open('budget'); await page.keyboard.press('Escape'); await closed();
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden', 'External native close cleans up scroll lock and remains reopenable');
    await open('itinerary');
    await page.evaluate(() => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Back did not remove menu marker: ' + JSON.stringify(history.state))), 3000);
      history.back();
      function afterBack() {
        if (!history.state?.tripNavigation) { clearTimeout(timeout); history.forward(); resolve(); }
        else requestAnimationFrame(afterBack);
      }
      requestAnimationFrame(afterBack);
    }));
    await page.waitForFunction(() => history.state?.tripNavigation && document.querySelector('#tripNavigationMenu').open);
    await settled();
    assert.equal(await dock('itinerary').getAttribute('aria-expanded'), 'true', 'Immediate Back/Forward restores the matching open menu');
    await page.keyboard.press('Escape'); await closed();
    console.log('PASS navigation: external close and rapid Back/Forward');
    await open('itinerary');
    await page.evaluate(() => {
      const dock = document.querySelector('#tripNavigationMenu .tl-nav-dock');
      dock.querySelector('[data-trip-nav="itinerary"]').click();
      dock.querySelector('[data-trip-nav="budget"]').click();
    });
    await page.waitForFunction(() => document.querySelector('#tripNavigationMenu').open && document.querySelector('#tripNavigationTitle').textContent === '지출');
    await settled();
    await page.keyboard.press('Escape'); await closed();

    // A destination click must not overtake a second Back during its exit.
    await choose('budget', 'expenses'); await waitPage('budget');
    await open('report');
    await page.evaluate(() => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Selection did not remove menu marker: ' + JSON.stringify(history.state))), 3000);
      document.querySelector('[data-nav-item="report-itinerary"]').click();
      function afterMenuBack() {
        if (!history.state?.tripNavigation) { clearTimeout(timeout); history.back(); resolve(); }
        else requestAnimationFrame(afterMenuBack);
      }
      requestAnimationFrame(afterMenuBack);
    }));
    await closed(); await waitPage('overview');
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => activePage), 'overview', 'A canceled selection cannot override a later history navigation');
    console.log('PASS navigation: external native close, immediate Back/Forward and interrupted destination selection leave consistent history, scrolling and focus');

    const motion = await page.evaluate(async () => {
      const samples = [], frames = [];
      const baseline = [...document.querySelectorAll('.rd-nav [data-trip-nav]')].map(node => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; });
      document.querySelector('.rd-nav [data-trip-nav="itinerary"]').click();
      const panel = document.querySelector('#tripNavigationPanel');
      const start = performance.now();
      await new Promise(resolve => {
        function frame(now) {
          const drift = [...document.querySelectorAll('#tripNavigationMenu .tl-nav-dock [data-trip-nav]')].flatMap((node, index) => { const box = node.getBoundingClientRect(); return ['x', 'y', 'width', 'height'].map(axis => Math.abs(box[axis] - baseline[index][axis])); });
          frames.push(now); samples.push({ elapsed: now - start, top: panel.getBoundingClientRect().top, opacity: Number(getComputedStyle(panel).opacity), dockDrift: Math.max(...drift) });
          if (now - start < 550) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
      });
      return { samples, frameIntervals: frames.slice(1).map((time, index) => time - frames[index]) };
    });
    assert.equal(await menu.getAttribute('data-motion'), 'motion', 'The bundled Motion library drives the transition');
    assert(motion.samples.some(sample => sample.opacity > 0 && sample.opacity < 1), 'Normal motion includes an actual gradual entrance');
    await settled();
    assert.equal(await panel.evaluate(node => Number(getComputedStyle(node).opacity)), 1, 'The completed entrance is fully visible');
    assert(motion.samples.every(sample => sample.dockDrift <= 1), 'Dock position stays fixed throughout the complete Motion entrance');
    await page.keyboard.press('Escape'); await closed();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await original('overview').click(); await waitPage('overview');
    await open('itinerary'); await capture('reduced-motion-390');
    assert.equal(await panel.evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0);
    await dock('report').click(); await page.waitForFunction(() => document.querySelector('#tripNavigationTitle').textContent.trim() === '리포트'); await settled();
    await page.keyboard.press('Escape'); await closed();
    assert.deepEqual(errors, [], 'No uncaught application errors'); assert.deepEqual(consoleIssues, [], 'No unexpected console warnings/errors');
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ origin, browser: 'Playwright/Edge isolated fixture (Browser plugin not available)', viewports: ['320×568', '320×740', '390×844', '844×390', '1280×900'], evidence, errors, consoleIssues, motion, dockComparisons, checks: ['responsive menus', 'unchanged dock geometry', 'all destinations', 'rapid switching', 'all dismissals', 'route and scroll', 'editor draft', 'settings', 'history interruption', 'external native close', 'Motion library animation', 'reduced motion', 'data preservation'] }, null, 2));
    console.log('PASS navigation: settings/header migration, reduced motion, unchanged saved data and clean runtime/console');
    await context.close();
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
