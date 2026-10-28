const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, seedTrip, blockExternalRequests, startServer, stopServer, waitForApp } = require('./helpers/browser-fixture');
// Browser plugin not available. Use isolated Playwright/Edge fixtures; no live data.
const output = artifactDirectory('itinerary-editor');
async function main() {
  const { server, origin } = await startServer(), browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: true, reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
    context.setDefaultTimeout(12000);
    const seed = { id: 'editor-fixture', tripName: '일정 편집 검증', country: '일본', city: '도쿄', travelMode: 'overseas', startDate: '2026-10-20', endDate: '2026-10-22', entries: [], companions: [], packingList: [], itineraryItems: [
      { id: 'first', date: '2026-10-21', time: '13:00', endTime: '14:30', place: '도쿄역', location: '도쿄도 지요다구', mapQuery: '35.6812,139.7671', theme: 'transport', createdAt: 1 },
      { id: 'hotel', date: '2026-10-21', time: '16:00', endTime: '17:00', place: '니시스가모 호텔', location: '도쿄도 도시마구 니시스가모', mapQuery: '35.743,139.729', lat: 35.743, lon: 139.729, coordinateSource: 'google-places', coordinateAddress: '도쿄도 도시마구 니시스가모', googlePlaceId: 'fixture-hotel', theme: 'lodging', memo: '예약 안내\nhttps://example.test/booking', voucherName: '기존 예약', voucherCode: 'KEEP-123', voucherFile: 'data:application/pdf;base64,JVBERi0xLjQK', voucherFileName: '기존티켓.pdf', createdAt: 2 },
    ] };
    await seedTrip(context, { origin, user: { id: '00000000-0000-4000-8000-000000000099', email: 'editor@example.test' }, expiry: Math.floor(Date.now() / 1000) + 3600, seed, marker: 'editor-seed' });
    await blockExternalRequests(context, origin);
    await context.route('https://www.google.com/maps/**', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: '<h1>External map fixture</h1>' }) : route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    await page.goto(`${origin}/Travel?page=itinerary`); await waitForApp(page);
    assert.equal(await page.title(), '여행 가계부');
    const colorAssets = await page.evaluate(() => Promise.all(Object.values(TripLog.shared.itineraryArt.catalog).map(row => new Promise(resolve => {
      const image = new Image(); image.onload = () => resolve({ id: row.id, ok: image.naturalWidth > 0 }); image.onerror = () => resolve({ id: row.id, ok: false }); image.src = row.colorIcon;
    }))));
    assert(colorAssets.every(asset => asset.ok), JSON.stringify(colorAssets.filter(asset => !asset.ok)));
    await page.evaluate(() => {
      const item = state.itineraryItems.find(row => row.id === 'hotel'); item.coordinateSignature = buildItemCoordinateSignature(item);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copied = text; } } });
    });
    const edit = id => page.evaluate(id => startItineraryEdit(state.itineraryItems.find(row => row.id === id)), id);
    const save = async () => { await page.locator('#itinerarySubmitButton').click(); await page.waitForFunction(() => !document.querySelector('#itineraryEditor').open); };
    const item = () => page.evaluate(() => JSON.parse(JSON.stringify(state.itineraryItems.find(row => row.id === 'hotel'))));
    await edit('hotel');
    assert.equal(await page.locator('#itineraryEditorTitle').isVisible(), false, 'Remove the redundant edit heading from layout');
    for (const width of [320, 390, 767, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.locator('#itineraryEditorDays').count(), 0, 'Remove date selection from the editor at every width');
      assert.equal(await page.locator('.itinerary-map-actions > *').count(), 2);
      assert.equal(await page.locator('#itineraryNearbyButton, #itineraryNearbyDialog').count(), 0, 'Nearby search is removed');
      assert.equal(await page.locator('#itineraryEditorTripName').isVisible(), true);
      assert.equal(await page.locator('#itineraryEditorTripName').innerText(), seed.tripName);
      assert.equal(await page.locator('#itineraryEditorDate strong').innerText(), 'Day 2');
      assert.equal(await page.locator('#itineraryEditorDate span').innerText(), '10.21 (수)');
      const metrics = await page.evaluate(() => {
        const controls = [...document.querySelector('.itinerary-map-actions').children].map(node => { const r = node.getBoundingClientRect(), icon = node.querySelector('.ph, img').getBoundingClientRect(), label = node.querySelector('span').getBoundingClientRect(), css = getComputedStyle(node); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, scroll: node.scrollWidth, client: node.clientWidth, inline: icon.right <= label.left && Math.abs((icon.top + icon.bottom) / 2 - (label.top + label.bottom) / 2) < 2, filled: css.backgroundImage !== 'none', shadow: css.boxShadow !== 'none' }; });
        const date = document.querySelector('#itineraryEditorDate').getBoundingClientRect(), close = document.querySelector('#itineraryEditorClose').getBoundingClientRect();
        const tripName = document.querySelector('#itineraryEditorTripName').getBoundingClientRect();
        const heading = document.querySelector('#itineraryEditorTripName').previousElementSibling.getBoundingClientRect();
        return { controls, dateRight: date.right, closeLeft: close.left, tripNameVisible: tripName.width > 0 && tripName.height > 0, tripNameRight: tripName.right, dateLeft: date.left, nameBelowHeading: tripName.top >= heading.bottom, overflow: document.querySelector('#itineraryEditor').scrollWidth > innerWidth };
      });
      assert(metrics.controls.every(box => box.height >= 44 && box.x >= 0 && box.right <= width + 1 && box.scroll <= box.client + 1), JSON.stringify(metrics));
      assert(metrics.controls.every(box => Math.abs(box.y - metrics.controls[0].y) < 1 && Math.abs(box.width - metrics.controls[0].width) < 1), JSON.stringify(metrics));
      assert(metrics.controls.every(box => box.inline), 'Map icons and labels share one line: ' + JSON.stringify(metrics));
      assert(metrics.controls.every(box => box.filled && box.shadow), 'All map buttons have colored fills and shadows');
      assert(metrics.dateRight <= metrics.closeLeft && !metrics.overflow, JSON.stringify(metrics));
      assert(metrics.tripNameVisible && metrics.tripNameRight <= metrics.dateLeft && metrics.nameBelowHeading, JSON.stringify(metrics));
      const summary = await page.locator('#itineraryPlaceSummary').evaluate(node => {
        const bounds = element => element.getBoundingClientRect(), bullet = bounds(node.querySelector('.itinerary-place-bullet')), name = bounds(document.querySelector('#itineraryPlaceName')), address = bounds(document.querySelector('#itineraryPlaceAddress'));
        const form = bounds(document.querySelector('#itineraryForm'));
        return { bulletLeft: bullet.left, bulletRight: bullet.right, nameLeft: name.left, addressLeft: address.left, summaryTop: bounds(node).top, formTop: form.top };
      });
      assert(summary.bulletLeft >= 0 && summary.bulletRight < summary.nameLeft && Math.abs(summary.nameLeft - summary.addressLeft) < 1, JSON.stringify(summary));
      assert(Math.abs(summary.summaryTop - summary.formTop) < 1, 'Place summary starts at the top of the form with no heading gap');
      await page.screenshot({ path: path.join(output, `editor-${width}.png`), animations: 'disabled' });
    }
    const longTripName = '2026 일본 도쿄 가족 여행 — 아주 긴 여행 이름도 현재 여행을 확인할 수 있어요';
    await page.evaluate(name => { state.tripName = name; TripLog.features.itinerary.workspace.render(); }, longTripName);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.locator('#itineraryEditorTripName').getAttribute('title'), longTripName);
      assert.equal(await page.locator('#itineraryEditorTripName').isVisible(), true);
      assert.equal(await page.locator('#itineraryEditorTripName').evaluate(node => { const rect = node.getBoundingClientRect(), date = document.querySelector('#itineraryEditorDate').getBoundingClientRect(); return rect.right <= date.left && rect.width > 30 && getComputedStyle(node).textOverflow === 'ellipsis'; }), true);
      await page.screenshot({ path: path.join(output, `long-trip-name-${width}.png`), animations: 'disabled' });
    }
    await page.evaluate(name => { state.tripName = name; TripLog.features.itinerary.workspace.render(); }, seed.tripName);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.itinerary-map-actions').screenshot({ path: path.join(output, 'map-actions.png'), animations: 'disabled' });
    await page.locator('#itineraryPlaceSummary').screenshot({ path: path.join(output, 'place-actions.png'), animations: 'disabled' });
    assert.equal(await page.locator('.itinerary-place-edit-buttons .ph').evaluateAll(icons => icons.every(icon => {
      const css = getComputedStyle(icon); return css.backgroundColor === 'rgba(0, 0, 0, 0)' && css.backgroundImage === 'none' && css.borderTopWidth === '0px';
    })), true, 'Edit icons sit directly on the button fill without inner boxes');
    await page.locator('#itinerarySubtypeSelectButton').click();
    await page.waitForFunction(() => [...document.querySelectorAll('#itinerarySubtypeSelectMenu img')].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.locator('#itinerarySubtypeSelectMenu .control-subtype-image').count(), 5);
    await page.screenshot({ path: path.join(output, 'color-subtypes-390.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.locator('#itineraryPlaceName').click(); assert.equal(await page.evaluate(() => window.__copied), '니시스가모 호텔');
    await page.locator('#itineraryPlaceAddress').click(); assert.equal(await page.evaluate(() => window.__copied), '도쿄도 도시마구 니시스가모');
    const original = await item();
    await page.locator('#itineraryChangeName').click(); await page.locator('#itineraryNameEdit').fill('숙소 체크인');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const box = await page.locator('#itineraryNameDialog').boundingBox();
      const action = await page.locator('#itineraryNameForm [type="submit"]').boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && action.y + action.height <= 844, JSON.stringify({ box, action }));
      if (width < 768) assert(Math.abs(box.y + box.height - 844) < 1, 'Name editor anchors to the mobile bottom');
      await page.screenshot({ path: path.join(output, `name-sheet-${width}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { Object.defineProperty(visualViewport, 'height', { configurable: true, value: 420 }); visualViewport.dispatchEvent(new Event('resize')); });
    const keyboardAction = await page.locator('#itineraryNameForm [type="submit"]').boundingBox();
    assert(keyboardAction.y >= 0 && keyboardAction.y + keyboardAction.height <= 420, 'Apply remains above a mobile keyboard');
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    await page.locator('#itineraryNameClear').click(); assert.equal(await page.locator('#itineraryNameEdit').inputValue(), '');
    await page.locator('#itineraryNameEdit').fill('숙소 체크인');
    await page.screenshot({ path: path.join(output, 'rename-390.png'), animations: 'disabled' });
    await page.locator('#itineraryNameDialog').screenshot({ path: path.join(output, 'name-sheet-only.png'), animations: 'disabled' });
    await page.locator('#itineraryNameForm [type="submit"]').click();
    assert.equal((await item()).place, original.place, 'Applying an edit changes the draft until schedule save');
    assert.equal(new URL(await page.locator('#googleMapsLink').getAttribute('href')).searchParams.get('query_place_id'), 'fixture-hotel', JSON.stringify(await page.evaluate(() => ({ selectedPlaceCandidate, place: els.itineraryPlaceInput.value, href: els.googleMapsLink.href }))));
    assert.equal(await page.locator('#itineraryMemoLinks a').getAttribute('href'), 'https://example.test/booking');
    assert.equal(await page.locator('#ticketFileSelectBtn').isVisible(), false);
    assert.equal(await page.locator('#itineraryVoucherFile').isDisabled(), true);
    await save();
    const renamed = await item();
    for (const key of ['location', 'lat', 'lon', 'mapQuery', 'googlePlaceId', 'coordinateSource', 'coordinateAddress', 'voucherFile', 'voucherFileName', 'voucherName', 'voucherCode']) assert.deepEqual(renamed[key], original[key], key);
    assert.equal(renamed.place, '숙소 체크인');
    assert.equal(await page.evaluate(() => hasMatchingCoordinateSignature(state.itineraryItems.find(row => row.id === 'hotel'))), true);
    await edit('hotel');
    const direction = new URL(await page.locator('#itineraryDirectionsLink').getAttribute('href'));
    assert.equal(direction.searchParams.get('destination'), '35.743,139.729');
    assert.equal(direction.searchParams.get('origin'), '35.6812,139.7671');
    await page.locator('#itineraryChangePlace').click();
    assert.equal(await page.locator('#itineraryAddressMap #googleMapFrame').count(), 1, 'Reuse the existing map in the address sheet');
    assert.notEqual(await page.evaluate(() => document.activeElement.id), 'itineraryPlaceInput', 'Opening address search does not summon the mobile keyboard');
    await page.locator('#itineraryPlaceInput').fill('취소할 장소');
    await page.locator('#manualAddressToggleButton').click();
    await page.locator('#manualAddressInput').fill('도쿄도 다른 주소');
    await page.locator('#manualAddressApplyButton').click();
    assert.equal(await page.locator('#itineraryAddressPreview').innerText(), '도쿄도 다른 주소');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#itineraryPlaceInput').closest('#itineraryForm'));
    assert.equal(await page.locator('#itineraryPlaceInput').inputValue(), '숙소 체크인');
    assert.equal(await page.locator('#itineraryLocationInput').inputValue(), original.location);
    assert.equal(await page.locator('#itineraryEditor .map-frame-wrap #googleMapFrame').count(), 1, 'Cancel restores the same map to the editor');
    await page.locator('#itineraryChangePlace').click();
    await page.evaluate(() => renderPlaceSearchResults([{ id: 'new-location', place: '새 호텔', location: '도쿄도 신주쿠구', lat: 35.69, lon: 139.7, source: 'google-places' }], '새 호텔'));
    await page.locator('[data-place-id="new-location"]').click();
    assert.equal(await page.locator('#itineraryAddressDialog').isVisible(), true);
    assert.equal(await page.locator('[data-place-id="new-location"]').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#placeSearchResults').isVisible(), true, 'Keep results visible after choosing a location');
    assert.equal(await page.locator('#itineraryAddressPreview').innerText(), '도쿄도 신주쿠구');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const box = await page.locator('#itineraryAddressDialog').boundingBox(), action = await page.locator('#itineraryAddressApply').boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && action.y + action.height <= 844, JSON.stringify({ box, action }));
      assert.equal(await page.locator('#itineraryAddressDialog').evaluate(node => node.scrollWidth <= node.clientWidth), true);
      await page.screenshot({ path: path.join(output, `address-sheet-${width}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'address-390.png'), animations: 'disabled' });
    await page.locator('#itineraryAddressDialog').screenshot({ path: path.join(output, 'address-sheet-only.png'), animations: 'disabled' });
    await page.evaluate(() => { Object.defineProperty(visualViewport, 'height', { configurable: true, value: 420 }); visualViewport.dispatchEvent(new Event('resize')); });
    const addressKeyboardAction = await page.locator('#itineraryAddressApply').boundingBox();
    assert(addressKeyboardAction.y >= 0 && addressKeyboardAction.y + addressKeyboardAction.height <= 420, 'Address Apply remains above a mobile keyboard');
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    await page.locator('#itineraryAddressApply').click();
    assert.equal(await page.locator('#itineraryPlaceInput').inputValue(), '숙소 체크인');
    assert.equal(await page.locator('#itineraryLocationInput').inputValue(), '도쿄도 신주쿠구');
    assert.equal(new URL(await page.locator('#googleMapsLink').getAttribute('href')).searchParams.has('query_place_id'), false);
    await page.locator('#itineraryMemoInput').fill('도착 후 연락\nhttps://example.test/new\n<script>alert(1)</script> javascript:alert(1)');
    assert.equal(await page.locator('#itineraryMemoLinks a').count(), 1);
    await save(); await page.reload(); await waitForApp(page); await edit('hotel');
    const relocated = await item();
    assert.equal(relocated.place, '숙소 체크인'); assert.equal(relocated.location, '도쿄도 신주쿠구'); assert.equal(relocated.lat, 35.69);
    assert.equal(relocated.voucherFile, original.voucherFile); assert.equal(relocated.voucherCode, original.voucherCode);
    assert.match(await page.locator('#itineraryMemoInput').inputValue(), /도착 후 연락/);
    assert.equal(await page.locator('#itineraryExtraDetails').getAttribute('open'), '');
    // Mobile directions handoff must preserve current edits and return to the place map, not a full-day route.
    await page.locator('#itineraryMemoInput').fill('지도에서 돌아와도 남는 메모');
    // Chromium can reset touch emulation after fixture reloads; explicitly set the device for each handoff.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await Promise.all([page.waitForURL('https://www.google.com/maps/dir/**'), page.locator('#itineraryDirectionsLink').click()]);
    await page.goBack(); await waitForApp(page); await page.locator('#itineraryEditor[open]').waitFor();
    assert.equal(await page.locator('#itineraryMemoInput').inputValue(), '지도에서 돌아와도 남는 메모');
    assert.equal(await page.locator('#itineraryPlaceInput').inputValue(), '숙소 체크인');
    assert.equal(new URL(await page.locator('#googleMapsLink').getAttribute('href')).pathname, '/maps/search/');
    // The cross-origin Chromium fixture return resets touch emulation. Restore it for the second mobile handoff.
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await Promise.all([page.waitForURL('https://www.google.com/maps/search/**'), page.locator('#googleMapsLink').click()]);
    await page.goBack(); await waitForApp(page); await page.locator('#itineraryEditor[open]').waitFor();
    assert.equal(await page.locator('#itineraryMemoInput').inputValue(), '지도에서 돌아와도 남는 메모');
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } }); document.execCommand = () => false; });
    await page.locator('#itineraryPlaceAddress').click(); await page.locator('#itineraryCopyDialog[open]').waitFor();
    assert.equal(await page.locator('#itineraryCopyText').inputValue(), '도쿄도 신주쿠구'); await page.keyboard.press('Escape');
    await page.locator('#itineraryEditorClose').click(); await edit('first');
    assert.equal(new URL(await page.locator('#itineraryDirectionsLink').getAttribute('href')).searchParams.has('origin'), false);
    assert.equal(await page.locator('#itineraryLegacyVoucher').isVisible(), false);
    await page.locator('#itineraryEditorClose').click();
    const recovery = await page.evaluate(async () => {
      const row = (await TripLog.sync.drafts.list(state.id)).find(row => row.value.editId === 'hotel' && row.value.placeCandidate?.place === '숙소 체크인');
      if (!row) return false;
      TripLog.sync.drafts.resume(row); return true;
    });
    assert.equal(recovery, true, 'Recovery drafts preserve renamed place metadata');
    assert.equal(await page.locator('#itineraryPlaceInput').inputValue(), '숙소 체크인');
    assert.equal(new URL(await page.locator('#googleMapsLink').getAttribute('href')).searchParams.get('query'), '35.69,139.7');
    await page.locator('#itineraryEditorClose').click();
    await page.evaluate(() => {
      state.travelMode = 'domestic'; state.country = '대한민국'; state.countryCode = 'KR'; state.city = '서울';
      state.itineraryItems.push({ id: 'kr', date: '2026-10-21', place: '서울역', location: '서울 중구', mapQuery: '37.5547,126.9706', theme: 'sightseeing' });
    });
    await edit('kr'); await page.locator('#itineraryChangePlace').click();
    await page.locator('#itineraryAddressMap #itineraryDomesticMap').waitFor({ state: 'visible' });
    await page.waitForFunction(() => { const view = domesticMapViews.get(document.querySelector('#itineraryDomesticMap')); return view?.map && Math.abs(view.map.getSize().y - view.host.clientHeight) < 1; });
    await page.keyboard.press('Escape');
    await page.locator('#itineraryEditor .map-frame-wrap #itineraryDomesticMap').waitFor({ state: 'visible' });
    await page.locator('#itineraryEditorClose').click();
    await page.locator('#itineraryAddButton').click();
    assert.equal(await page.locator('#itineraryEditorTitle').isVisible(), true, 'The new-place search heading is retained');
    await page.locator('#itineraryPlaceInput').fill('도쿄역에서 숙소로 이동');
    for (const theme of ['food', 'lodging', 'transport']) {
      await page.locator('#itineraryThemeSelectButton').click();
      await page.locator(`#itineraryThemeSelectMenu [data-value="${theme}"]`).click();
      assert.equal(await page.locator('#itineraryTransportFields').count(), 0);
      assert.deepEqual(await page.locator('.time-field-item > span').allTextContents(), ['시작', '종료']);
      assert.equal(await page.locator('#itineraryLegacyVoucher').isVisible(), false);
    }
    await page.evaluate(() => { els.itineraryTimeInput.value = '16:00'; els.itineraryEndTimeInput.value = '17:00'; syncCustomTimePicker(els.itineraryTimeInput); syncCustomTimePicker(els.itineraryEndTimeInput); });
    await page.screenshot({ path: path.join(output, 'plain-transport-390.png'), animations: 'disabled' });
    await save();
    const plainTransport = await page.evaluate(() => {
      const item = state.itineraryItems.find(item => item.place === '도쿄역에서 숙소로 이동');
      return { item, reservations: TripLog.features.travelCompanion.model.reservations(state).filter(row => row.sourceId === item.id) };
    });
    assert.equal(plainTransport.item.theme, 'transport');
    assert.equal(Object.hasOwn(plainTransport.item, 'transportReservation'), false, 'Theme selection never creates reservation metadata');
    assert.equal(Boolean(plainTransport.item.voucherName), false);
    assert.deepEqual(plainTransport.reservations, [], 'Ordinary transport plans do not appear as new bookings');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, viewports: [320, 390, 767, 768, 1440], errors, productionDataModified: false }, null, 2));
    await context.close(); console.log('PASS itinerary editor: responsive header and two map actions without nearby search, copy/fallback, name/address saves, legacy attachments, memo links, directions/map opening and mobile draft return.');
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
