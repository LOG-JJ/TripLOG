const { launchBrowser, blockExternalRequests } = require('./helpers/browser-fixture');
// Browser plugin unavailable; use the existing isolated Playwright/Edge workflow.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTripHeaderPreview } = require('./preview-trip-header');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || path.join(require('node:os').tmpdir(), 'TripLOG-Trip-Header-20261004');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createTripHeaderPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, timezoneId: 'Asia/Seoul' });
    context.setDefaultTimeout(15000);
    await blockExternalRequests(context, origin);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in' && Boolean(state.collaboration?.ownerId));
    const hero = page.locator('.th-trip-hero');
    const readyImage = () => page.waitForFunction(() => { const img = document.querySelector('.th-hero-scene img'); return img?.complete && img.naturalWidth > 0; });
    const core = () => page.evaluate(() => {
      // Existing trip activation fills internal ordering metadata. Compare all
      // user fields and array order while excluding only that derived position.
      const records = list => (list || []).map(({ _syncPosition, ...record }) => record);
      return window.TripLog.persistence.stateStorage.getTrips().map(({ id, tripName, city, countryCode, startDate, endDate, entries, itineraryItems, companions }) => ({ id, tripName, city, countryCode, startDate, endDate, entries: records(entries), itineraryItems: records(itineraryItems), companions: records(companions) })).sort((a, b) => a.id.localeCompare(b.id));
    });
    const layout = async (name, maxHeight = 290) => {
      const metrics = await hero.evaluate(el => {
        const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        const title = el.querySelector('.th-trip-name');
        const image = el.querySelector('.th-hero-scene img');
        return { viewport: innerWidth, panel: rect(el), title: rect(title), titleSize: parseFloat(getComputedStyle(title).fontSize), facts: rect(el.querySelector('.th-trip-facts')), image: rect(el.querySelector('.th-hero-scene')), imageContent: rect(image), imageFit: getComputedStyle(image).objectFit, imagePosition: getComputedStyle(image).objectPosition, fits: el.scrollWidth <= el.clientWidth + 1, pageFits: document.documentElement.scrollWidth <= innerWidth };
      });
      assert(metrics.fits && metrics.pageFits, `${name}: no horizontal overflow ${JSON.stringify(metrics)}`);
      assert(metrics.panel.height <= maxHeight, `${name}: header remains compact (${metrics.panel.height}px)`);
      assert(metrics.titleSize >= 18 && metrics.titleSize <= 34, `${name}: title remains readable without an oversized display scale`);
      assert(metrics.title.bottom + 8 <= metrics.facts.y, `${name}: title clears dates and controls`);
      assert(metrics.facts.bottom <= metrics.panel.bottom - 8, `${name}: facts remain inside the panel`);
      assert(metrics.image.width > 80 && metrics.image.height > 70, `${name}: illustration stays visible`);
      assert(metrics.title.right <= metrics.image.x + 1, `${name}: title stays clear of the illustration`);
      assert(metrics.facts.right <= metrics.image.x + 1, `${name}: both mobile and desktop keep all information left of the art`);
      assert(Math.abs(metrics.image.bottom - metrics.panel.bottom) < 2, `${name}: no empty band remains below the illustration`);
      assert(metrics.image.y <= metrics.panel.y + 2, `${name}: the image uses the full height, not a floating thumbnail`);
      assert(metrics.imageContent.height >= metrics.image.height - 1, `${name}: artwork fills its vertical slot`);
      if (metrics.imageFit === 'contain') assert.equal(metrics.imagePosition, '100% 100%', `${name}: contained landscape stays flush to the right and bottom`);
      return metrics;
    };
    await page.goto(`${origin}/Travel?page=overview&trip=trip-header-suncheon`); await ready();
    await page.evaluate(() => document.fonts.ready); await readyImage();
    assert.equal(await page.title(), '여행 가계부');
    assert.equal(await hero.getAttribute('data-destination-id'), 'kr-suncheon');
    assert.match(await hero.innerText(), /D-6[\s\S]+1000일 순천[\s\S]+10\.10 토 – 10\.11 일[\s\S]+1박 2일[\s\S]+2명/);
    assert(await hero.locator('.th-trip-name').evaluate(el => {
      const family = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
      return [...document.fonts].some(font => font.family.replace(/["']/g, '') === family && font.status === 'loaded');
    }), 'The actual primary Korean font is loaded');
    const before = await core();
    for (const width of [320, 360, 390, 480, 599, 600, 613, 767, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      await page.waitForFunction(mobile => {
        const img = document.querySelector('.th-hero-scene img');
        return img?.complete && img.naturalWidth > 0 && img.currentSrc.endsWith(mobile ? '/kr-suncheon-mobile.webp' : '/kr-suncheon.webp');
      }, width < 768);
      await layout(String(width));
      await hero.screenshot({ path: path.join(output, `header-${width}.png`), animations: 'disabled' });
      if (width === 390 || width === 1440) await page.screenshot({ path: path.join(output, `overview-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    console.log('PASS postcard header: correct countdown/dates/members, loaded local typography and city artwork; 320/360/390/480/599/600/613/767/768/1024/1440 keep information left, artwork right, no bottom image gap');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#rdOverviewTripButton').focus(); await page.locator('#rdOverviewTripButton').press('Enter');
    const chooser = page.locator('#rdTripChooser');
    await chooser.waitFor({ state: 'visible' });
    await page.locator('#rdTripSearch').fill('오사카');
    await chooser.locator('[data-rd-action="trip-select"][data-id="trip-header-osaka"]').click();
    await chooser.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('.th-trip-hero')?.dataset.destinationId === 'jp-osaka'); await readyImage();
    assert.match(page.url(), /trip=trip-header-osaka/);
    assert.match(await hero.locator('img').getAttribute('src'), /jp-osaka\.webp$/);
    await page.reload(); await ready(); await readyImage();
    assert.equal(await hero.getAttribute('data-destination-id'), 'jp-osaka');
    for (const [id, expected] of [['trip-header-unknown', 'theme-travel'], ['trip-header-region', 'kr-jeju'], ['trip-header-generic', 'theme-mountain'], ['trip-header-suncheon', 'kr-suncheon']]) {
      await page.locator('#rdOverviewTripButton').click();
      await page.locator('#rdTripSearch').fill('');
      await chooser.locator(`[data-rd-action="trip-select"][data-id="${id}"]`).click();
      await chooser.waitFor({ state: 'hidden' });
      await page.waitForFunction(key => document.querySelector('.th-trip-hero')?.dataset.scene === key, expected); await readyImage();
    }
    await page.locator('#rdOverviewTripButton').click();
    await chooser.locator('.rd-dialog-head [data-rd-action="close"]').click();
    assert(await page.locator('#rdOverviewTripButton').evaluate(el => el === document.activeElement));
    await page.getByRole('button', { name: '여행 멤버 2명 보기', exact: true }).click();
    const memberDialog = page.locator('#tripInviteModal');
    await memberDialog.waitFor({ state: 'visible' });
    assert.match(await memberDialog.innerText(), /멤버|동행|초대/);
    await memberDialog.getByRole('button', { name: '초대 창 닫기', exact: true }).click();
    assert.deepEqual(await core(), before, 'Viewing and switching illustrations preserves every trip record');
    console.log('PASS postcard header: real trip selector, keyboard/focus return, city/region/theme switches, member dialog and reload; trip data preserved');
    // Pure rendering cases do not rewrite fixture state or persistence.
    const render = data => page.evaluate(data => {
      document.querySelector('.th-trip-hero').outerHTML = window.TripLog.features.overview.tripHero.render({
        trip: { countryCode: 'KR', city: '순천', tripName: '1000일 순천', ...data.trip },
        countdown: data.countdown || 'D-6', period: data.period || '10.10 토 – 10.11 일',
        duration: data.duration || '1박 2일', memberCount: data.members ?? 2,
      });
    }, data);
    await render({ trip: { tripName: '가족과 함께 떠나는 아주 길고 긴 이름의 가을 여행 기록' }, members: 120 });
    assert.equal(await hero.locator('.th-trip-name').getAttribute('title'), '가족과 함께 떠나는 아주 길고 긴 이름의 가을 여행 기록');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await layout(`long ${width}`, 390);
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await hero.screenshot({ path: path.join(output, 'long-320.png'), animations: 'disabled' });
    await render({ trip: { tripName: '<img src=x onerror=alert(1)>', city: '' }, countdown: 'PLANNING', period: '날짜 미정', duration: '기간 미정', members: 0 });
    assert.equal(await hero.locator('.th-trip-name img').count(), 0);
    assert.equal(await hero.getAttribute('data-scene'), 'theme-travel');
    await readyImage(); await layout('unknown/escaped');
    await render({ trip: { tripName: '당일 산책' }, countdown: 'ON THE GO', period: '10.4 일 – 10.4 일', duration: '당일치기' });
    await layout('same-day');
    // A failed optional city image falls back to its bundled scene, then universal.
    await context.route('**/src/assets/trip-scenes/cities/**', route => route.abort());
    await context.route('**/src/assets/trip-scenes/themes/v2/coast.webp', route => route.abort());
    // Use an unvisited city so an already-decoded image cannot bypass the failure.
    await render({ trip: { city: '여수' } });
    await page.waitForFunction(() => { const img = document.querySelector('.th-hero-scene img'); return img?.getAttribute('src')?.endsWith('/travel.webp') && img.complete && img.naturalWidth > 0; });
    assert.equal(await hero.locator('img').isVisible(), true);
    // An unavailable mobile crop must relinquish <source> selection so the
    // landscape and bundled theme fallbacks can actually become visible.
    for (const failDesktopToo of [false, true]) {
      const fallbackContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
      await fallbackContext.route('**/*', route => {
        const url = new URL(route.request().url());
        const failImage = url.pathname.endsWith('/kr-suncheon-mobile.webp') || (failDesktopToo && url.pathname.endsWith('/kr-suncheon.webp'));
        return url.origin === origin && !failImage ? route.continue() : route.abort();
      });
      const fallbackPage = await fallbackContext.newPage();
      fallbackPage.on('pageerror', error => errors.push(error.message));
      await fallbackPage.goto(`${origin}/Travel?page=overview&trip=trip-header-suncheon`);
      await fallbackPage.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && Boolean(state.collaboration?.ownerId));
      await fallbackPage.waitForFunction(suffix => {
        const img = document.querySelector('.th-hero-scene img');
        return img?.complete && img.naturalWidth > 0 && img.currentSrc.endsWith(suffix) && !img.parentElement.querySelector('source[data-trip-scene-mobile]');
      }, failDesktopToo ? '/wetland.webp' : '/kr-suncheon.webp');
      assert.equal(await fallbackPage.locator('source[data-trip-scene-mobile]').count(), 0);
      await fallbackContext.close();
    }
    assert.deepEqual(errors, []);
    console.log(`PASS postcard header: long/unknown/escaped/same-day data, optional image failure fallback, zero runtime errors. Screenshots: ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
