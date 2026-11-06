const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const { launchBrowser, seedTrip, blockExternalRequests, startServer, stopServer, waitForApp } = require('./helpers/browser-fixture');

// Browser plugin not available. Use the repository's isolated Playwright/Edge
// runner; all external requests are blocked and no live travel data is used.
const output = artifactDirectory('itinerary-subtypes');
async function main() {
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  let page;
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', timezoneId: 'Asia/Seoul' });
    context.setDefaultTimeout(12000);
    const user = { id: '00000000-0000-4000-8000-000000000099', email: 'subtypes@example.test', user_metadata: { display_name: '분류 검증' } };
    const seed = { id: 'subtypes-fixture', tripName: '세부 분류 여행', country: '대한민국', city: '서울', travelMode: 'domestic', startDate: '2026-11-07', endDate: '2026-11-09', entries: [], companions: [], packingList: [], itineraryItems: [
      { id: 'legacy-food', date: '2026-11-07', time: '08:00', endTime: '09:00', place: '기존 식사', theme: 'food', memo: '보존할 메모', createdAt: 1 },
    ] };
    await seedTrip(context, { origin, user, expiry: Math.floor(Date.now() / 1000) + 3600, seed, marker: 'subtypes-seed' });
    await blockExternalRequests(context, origin);
    page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const chooseTheme = async theme => {
      await page.locator('#itineraryThemeSelectButton').click();
      await page.locator(`#itineraryThemeSelectMenu [data-value="${theme}"]`).click();
    };
    const chooseSubtype = async subtype => {
      await page.locator('#itinerarySubtypeSelectButton').click();
      await page.locator(`#itinerarySubtypeSelectMenu [data-value="${subtype}"]`).click();
    };
    const edit = id => page.locator(`.timeline-edit[data-itinerary-action="edit"][data-id="${id}"]`).click();
    const saved = async () => { await page.waitForFunction(() => !document.querySelector('#itineraryEditor').open); };
    const row = id => page.locator(`.timeline-stop[data-id="${id}"]`);
    const capture = async name => page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
    await page.goto(`${origin}/Travel?page=itinerary`);
    await waitForApp(page);
    assert.equal(await page.title(), '여행 가계부');
    assert.match(page.url(), /page=itinerary/);
    assert.equal(await row('legacy-food').locator('.timeline-theme').innerText(), '맛집');
    await page.locator('#itineraryAddButton').click();
    await page.locator('#itineraryPlaceInput').fill('아틀리에');
    await chooseTheme('food');
    assert.equal(await page.locator('#itinerarySubtypeSelect option').count(), 5);
    await chooseSubtype('cafe');
    assert.match(await page.locator('#itinerarySubtypeSelectButton').innerText(), /카페/);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#itinerarySubtypeSelectButton').click();
      const metrics = await page.locator('#itinerarySubtypeSelectMenu').evaluate(menu => {
        const box = menu.getBoundingClientRect(), trigger = document.querySelector('#itinerarySubtypeSelectButton').getBoundingClientRect();
        const fields = document.querySelector('.itinerary-theme-fields');
        return { x: box.x, right: box.right, y: box.y, bottom: box.bottom, width: box.width, row: menu.querySelector('button').getBoundingClientRect().height,
          columns: getComputedStyle(fields).gridTemplateColumns.split(' ').length, triggerWidth: trigger.width, triggerLeft: trigger.left, triggerRight: trigger.right, scrollWidth: menu.scrollWidth, clientWidth: menu.clientWidth };
      });
      assert(metrics.x >= 0 && metrics.right <= width && metrics.y >= 0 && metrics.bottom <= 900, JSON.stringify(metrics));
      assert.equal(metrics.columns, 2);
      assert(Math.abs(metrics.width - metrics.triggerWidth) < 1 && Math.abs(metrics.x - metrics.triggerLeft) < 1 && Math.abs(metrics.right - metrics.triggerRight) < 1, JSON.stringify(metrics));
      assert(metrics.scrollWidth <= metrics.clientWidth + 1, 'Subtype options stay inside the matched menu width');
      assert(metrics.row >= 44);
      await capture(`cafe-menu-${width}`);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#itinerarySubtypeSelectButton').evaluate(el => el === document.activeElement), true);
    }
    await page.locator('#itinerarySubtypeSelectButton').press('ArrowDown');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#itinerarySubtypeSelect').inputValue(), 'bakery');
    await chooseSubtype('cafe');
    await page.setViewportSize({ width: 390, height: 844 });
    await capture('cafe-selected-390');
    await page.locator('#itineraryForm').screenshot({ path: path.join(output, 'cafe-form-390.png'), animations: 'disabled' });
    await page.evaluate(() => {
      els.itineraryTimeInput.value = '10:00'; els.itineraryEndTimeInput.value = '12:00';
      syncCustomTimePicker(els.itineraryTimeInput); syncCustomTimePicker(els.itineraryEndTimeInput);
    });
    await page.locator('#itinerarySubmitButton').click(); await saved();
    const item = await page.evaluate(() => state.itineraryItems.find(item => item.place === '아틀리에'));
    assert.equal(item.themeSubtype, 'cafe');
    assert.equal(await row(item.id).locator('.timeline-theme').innerText(), '카페');
    assert.equal(await row(item.id).locator('.timeline-place-icon .ph-coffee').count(), 1);
    await page.reload(); await waitForApp(page);
    assert.equal(await row(item.id).locator('.timeline-theme').innerText(), '카페');
    await edit(item.id);
    assert.equal(await page.locator('#itinerarySubtypeSelect').inputValue(), 'cafe');
    await page.evaluate(() => { els.itineraryMemoInput.value = '분류를 유지한 메모 수정'; });
    await page.locator('#itinerarySubmitButton').click(); await saved();
    assert.equal(await page.evaluate(id => state.itineraryItems.find(item => item.id === id).themeSubtype, item.id), 'cafe');
    await row(item.id).locator('[data-itinerary-action="copy"]').click();
    await page.waitForFunction(() => state.itineraryItems.filter(item => item.place === '아틀리에').length === 2);
    assert.equal(await page.evaluate(() => state.itineraryItems.filter(item => item.place === '아틀리에').every(item => item.themeSubtype === 'cafe')), true);
    const copiedId = await page.evaluate(id => state.itineraryItems.find(item => item.place === '아틀리에' && item.id !== id).id, item.id);
    await edit(copiedId);
    await page.evaluate(() => { els.itineraryTimeInput.value = '13:00'; els.itineraryEndTimeInput.value = '15:00'; });
    await page.locator('#itinerarySubmitButton').click(); await saved();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.TripLog.features.print.studio.open('itinerary'));
    await page.waitForFunction(() => !document.querySelector('#exSave').disabled && document.querySelector('#printReport [data-illustration-type="cafe"]'));
    const printArt = page.locator('#printReport img[data-illustration-type="cafe"]');
    assert(await printArt.count() >= 2);
    await page.waitForFunction(() => [...document.querySelectorAll('#printReport img[data-illustration-type="cafe"]')].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.locator('#printReport .ex-time-place .ph-coffee').count(), 2);
    await capture('pdf-subtype-preview');
    await page.pdf({ path: path.join(output, 'selected-subtypes.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(() => document.querySelector('#rdPdf').close());

    await edit(item.id); await chooseSubtype('');
    await page.locator('#itinerarySubmitButton').click(); await saved();
    assert.equal(await page.evaluate(id => state.itineraryItems.find(item => item.id === id).themeSubtype, item.id), undefined);
    assert.equal(await row(item.id).locator('.timeline-theme').innerText(), '맛집');
    await edit(item.id); await chooseSubtype('cafe'); await chooseTheme('sightseeing');
    assert.equal(await page.locator('#itinerarySubtypeSelect').inputValue(), '');
    assert.equal(await page.locator('#itinerarySubtypeSelect option').count(), 31);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#itinerarySubtypeSelectButton').click();
      assert.equal(await page.locator('#itinerarySubtypeSelectMenu').evaluate(el => el.scrollHeight > el.clientHeight), true);
      await capture(`sightseeing-menu-${width}`);
      await page.locator('#itinerarySubtypeSelectMenu [data-value="hiking"]').click();
      assert.equal(await page.locator('#itinerarySubtypeSelect').inputValue(), 'hiking');
    }
    await page.locator('#itinerarySubmitButton').click(); await saved();
    assert.equal(await row(item.id).locator('.timeline-theme').innerText(), '하이킹');
    await edit('legacy-food');
    assert.equal(await page.locator('#itinerarySubtypeSelect').inputValue(), '');
    await page.locator('#itinerarySubmitButton').click(); await saved();
    assert.equal(await page.evaluate(() => Object.hasOwn(state.itineraryItems.find(item => item.id === 'legacy-food'), 'themeSubtype')), false);

    // Draft recovery must rebuild the dependent options before restoring value.
    await page.locator('#itineraryAddButton').click(); await chooseTheme('shopping'); await chooseSubtype('market');
    await page.locator('#itineraryPlaceInput').fill('초안 장소');
    const draft = await page.evaluate(async () => (await window.TripLog.sync.drafts.list(state.id)).find(row => !row.value.editId && row.value.fields.itineraryPlaceInput?.value === '초안 장소'));
    assert(draft);
    await page.locator('#itineraryEditorClose').click();
    await page.evaluate(row => window.TripLog.sync.drafts.resume(row), draft);
    assert.equal(await page.locator('#itineraryThemeSelect').inputValue(), 'shopping');
    assert.equal(await page.locator('#itinerarySubtypeSelect').inputValue(), 'market');
    await page.setViewportSize({ width: 320, height: 844 });
    await chooseTheme('lodging');
    await page.locator('#itinerarySubtypeSelectButton').click();
    const longLabel = await page.locator('#itinerarySubtypeSelectMenu').evaluate(menu => {
      const box = menu.getBoundingClientRect(), field = document.querySelector('#itinerarySubtypeSelectButton').getBoundingClientRect();
      const option = menu.querySelector('[data-value="hostel"]'), label = option.querySelector('.control-option-label');
      return { width: box.width, fieldWidth: field.width, left: box.left, fieldLeft: field.left, menuWidth: menu.clientWidth, menuScroll: menu.scrollWidth, labelWidth: label.clientWidth, labelScroll: label.scrollWidth, labelHeight: label.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(label).lineHeight), rowHeight: option.getBoundingClientRect().height };
    });
    assert(Math.abs(longLabel.width - longLabel.fieldWidth) < 1 && Math.abs(longLabel.left - longLabel.fieldLeft) < 1, JSON.stringify(longLabel));
    assert(longLabel.menuScroll <= longLabel.menuWidth + 1 && longLabel.labelScroll <= longLabel.labelWidth + 1 && longLabel.labelHeight > longLabel.lineHeight && longLabel.rowHeight >= 44, JSON.stringify(longLabel));
    await capture('long-subtype-menu-320');
    await page.keyboard.press('Escape');
    await page.locator('#itineraryEditorClose').click();
    await page.setViewportSize({ width: 390, height: 844 }); await capture('timeline-mobile');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ ok: true, origin, browser: 'Playwright / Edge', fallback: 'Browser plugin not available', viewports: [320, 390, 768, 1440], errors, checked: ['50 shared types', 'dependent options', 'save/reload/edit/copy', 'manual PDF artwork and icons', 'automatic fallback', 'theme reset', 'legacy items', 'draft recovery', 'scroll and keyboard focus'] }, null, 2));
    console.log(`PASS itinerary subtypes: matched field/menu width, wrapped long labels, dependent selection, manual labels/icons/PDF, save/reload/copy, automatic fallback, theme reset, legacy preservation, drafts and 320/390/768/1440 layout. ${output}`);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
