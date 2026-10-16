// Browser plugin not available: isolated Playwright/Edge, no production requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, startServer, stopServer, seedTrip, blockExternalRequests, waitForApp } = require('./helpers/browser-fixture');
const concepts = require('../artifacts/design/20261017-delete-dialogs/brief.json').sheets.slice(0, 4).flatMap(sheet => sheet.cases);
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('delete-dialogs');
const user = { id: '00000000-0000-4000-8000-000000000088', email: 'delete-dialogs@example.test' };
const seed = {
  id: 'delete-dialogs', tripName: '오사카·교토 여행', startDate: '2026-10-17', endDate: '2026-10-20', country: '일본', countryCode: 'JP', city: '오사카', travelMode: 'overseas', currencyCode: 'JPY', currencySymbol: '¥', exchangeBase: 100, exchangeRate: 950,
  entries: [
    { id: 'dinner', date: '2026-10-17', description: '저녁 식사', category: '식비', amount: 38000, paymentMethod: 'card' },
    { id: 'fare', date: '2026-10-17', description: '공항 이동', category: '교통', amount: 24000, paymentMethod: 'card' },
    { id: 'failure', date: '2026-10-17', description: '보존할 지출', category: '식비', amount: 12000, paymentMethod: 'card' },
  ],
  itineraryItems: [
    { id: 'castle', date: '2026-10-17', time: '10:00', endTime: '11:30', place: '오사카성 산책', theme: 'sightseeing', voucherFile: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=', voucherFileName: '호텔 예약.pdf' },
    { id: 'airport', date: '2026-10-17', time: '12:30', endTime: '13:00', place: '공항에서 숙소로', theme: 'transport', expenseId: 'fare', syncExpense: true, transits: [{ trans: 'walk', duration: 10, cost: 0 }, { trans: 'train', duration: 25, cost: 24000 }] },
    { id: 'restaurant', date: '2026-10-17', time: '18:00', endTime: '19:00', place: '저녁 식사 장소', theme: 'food', expenseId: 'dinner', syncExpense: true },
  ],
  packingList: [{ id: 'pack-1', name: '여권', checked: true }, { id: 'custom-packing', name: '우비', checked: false }],
  companions: [{ id: 'companion-minsu', name: '민수', individualSpent: 5000 }],
  settlement: { leaderName: '나', splitMode: 'equal', customShares: { 'companion:companion-minsu': 100 }, itemSplits: {} },
  travelCompanion: { reservations: [{ id: 'manual-hotel', type: 'stay', title: '난바 호텔 · 2박', date: '2026-10-17', endDate: '2026-10-19', reference: 'FIXTURE' }] },
};

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer(), browser = await launchBrowser();
  const errors = [], consoleIssues = [], dimensions = [], flows = [];
  async function fixture() {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    context.setDefaultTimeout(12000);
    await blockExternalRequests(context, origin);
    await seedTrip(context, { origin, user, expiry: Math.floor(Date.now() / 1000) + 3600, seed, marker: 'delete-fixture' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type()) && !/net::ERR_FAILED|Failed to fetch|fixture|QuotaExceeded|AbortError|Service Worker registration blocked by Playwright/.test(message.text())) consoleIssues.push(message.text());
    });
    await page.goto(`${origin}/Travel?page=itinerary&trip=${seed.id}`); await waitForApp(page);
    assert.equal(await page.title(), '여행 가계부'); assert.match(page.url(), /page=itinerary/);
    assert(await page.locator('#itineraryList').innerText(), 'Meaningful itinerary renders');
    return { page, context };
  }
  function helpers(page) {
    const confirm = page.locator('#rdConfirm');
    const cancel = async () => { await page.locator('#rdConfirmCancel').click(); await confirm.waitFor({ state: 'hidden' }); };
    const accept = async () => { await page.locator('#rdConfirmAccept').click(); await confirm.waitFor({ state: 'hidden' }); await page.evaluate(() => window.TripLog.persistence.stateStorage.whenSaved()); };
    const closes = () => page.evaluate(async () => {
      const closed = [...document.querySelectorAll('dialog[open]')].map(node => new Promise(resolve => { node.addEventListener('close', resolve, { once: true }); node.close(); }));
      closeHistoryModal(); await Promise.all(closed);
    });
    const show = id => page.evaluate(id => window.TripLog.features.redesign.workspace.open(id), id);
    const editItinerary = async id => { await page.evaluate(id => startItineraryEdit(findItineraryItem(id)), id); await page.evaluate(() => window.TripLog.persistence.stateStorage.whenSaved()); };
    const askKind = async kind => { await confirm.waitFor(); assert.equal(await confirm.getAttribute('data-kind'), kind); };
    return { confirm, cancel, accept, closes, show, editItinerary, askKind };
  }
  try {
    const { page, context } = await fixture();
    const { confirm, cancel, accept, closes, show, editItinerary, askKind } = helpers(page);
    for (const width of [320, 390, 599, 600, 768, 1440]) {
      await page.setViewportSize({ width, height: width >= 600 ? 1000 : 844 });
      for (const concept of concepts) {
        await page.evaluate(c => { window.TripLog.ui.confirmation.ask({ kind: c.id, subject: c.subject, ...(c.id === 'expense' ? { message: c.message } : {}) }); }, concept);
        await askKind(concept.id);
        assert.equal(await page.locator('#rdConfirmTitle').innerText(), concept.title);
        assert.equal(await page.locator('#rdConfirmAccept').innerText(), concept.confirmLabel);
        assert.equal(await page.locator('#rdConfirmDescription').textContent(), concept.message);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'rdConfirmCancel');
        const box = await confirm.boundingBox();
        assert(box.width <= 342.1 && box.x >= 15 && box.x + box.width <= width - 15, 'Compact width at every breakpoint');
        assert(box.height < 300, `No empty full-height confirmation: ${concept.id} at ${width}, ${box.height}`);
        assert(await confirm.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'No horizontal overflow');
        assert.equal(await page.locator('#rdConfirmTitle').evaluate(node => getComputedStyle(node).fontSize), '18px');
        for (const button of await confirm.locator('button').all()) assert((await button.boundingBox()).height >= 44, 'Usable touch targets');
        dimensions.push({ kind: concept.id, viewport: width, width: box.width, height: box.height });
        if (width === 390) await confirm.screenshot({ path: path.join(output, `${concept.id}-390.png`), animations: 'disabled' });
        if (concept.id === 'itinerary' && [320, 390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `itinerary-context-${width}.png`), animations: 'disabled' });
        await cancel();
      }
    }
    console.log('PASS deletion visuals: 16 states at 320/390/599/600/768/1440px, compact height, copy and 44px controls');
    await page.setViewportSize({ width: 390, height: 844 });
    await editItinerary('castle'); await page.locator('#itineraryDeleteButton').click(); await askKind('itinerary');
    await page.screenshot({ path: path.join(output, 'itinerary-active-editor-390.png'), animations: 'disabled' });
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'rdConfirmAccept');
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter'); await confirm.waitFor({ state: 'hidden' });
    assert(await page.locator('#itineraryEditor').isVisible()); assert(await page.evaluate(() => !!findItineraryItem('castle')));
    await page.locator('#itineraryDeleteButton').click(); await page.keyboard.press('Escape'); await confirm.waitFor({ state: 'hidden' });
    assert(await page.locator('#itineraryEditor').isVisible(), 'Escape dismisses only the nested confirmation');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'itineraryDeleteButton', 'Focus returns to delete control');
    await page.locator('#itineraryDeleteButton').click(); await page.mouse.click(5, 5); await confirm.waitFor({ state: 'hidden' });
    assert(await page.evaluate(() => !!findItineraryItem('castle')));
    flows.push('Nested cancel, Enter on default cancel, Escape, backdrop and focus restoration');

    // Long, untrusted names are text, remain accessible, and do not hide the actions.
    await closes();
    const longName = '<img src=x onerror=alert(1)>아주 긴 여행 이름 '.repeat(20);
    await page.evaluate(subject => { window.__confirmResult = null; window.TripLog.ui.confirmation.ask({ kind: 'trip', subject }).then(value => { window.__confirmResult = value; }); }, longName);
    assert.equal(await page.locator('#rdConfirmSubject').textContent(), longName);
    assert.equal(await confirm.locator('img').count(), 0);
    assert.equal(await page.locator('#rdConfirmSubject').getAttribute('tabindex'), '0');
    assert.equal(await page.evaluate(() => window.TripLog.ui.confirmation.ask({ kind: 'packing', subject: '중복 요청' })), false);
    assert.equal(await page.locator('#rdConfirmSubject').textContent(), longName);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    assert(await confirm.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await page.locator('#rdConfirmCancel').scrollIntoViewIfNeeded(); await cancel();
    assert.equal(await page.evaluate(() => window.__confirmResult), false);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.setViewportSize({ width: 390, height: 844 });
    flows.push('Long names, safe text, duplicate opens and 200% text at 320px');

    // Draft-only removals do not change saved records until the editor is saved.
    await editItinerary('castle');
    if (!await page.locator('#itineraryExtraDetails').evaluate(node => node.open)) await page.locator('#itineraryExtraDetails > summary').click();
    await page.locator('.ticket-file-row').locator('..').screenshot({ path: path.join(output, 'voucher-removal-390.png'), animations: 'disabled' });
    await page.locator('#ticketFileResetBtn').click();
    assert.equal(await confirm.isVisible(), false);
    assert.equal(await page.locator('#ticketFileNameDisplay').textContent(), '선택된 파일 없음');
    assert.equal(await page.evaluate(() => findItineraryItem('castle').voucherFileName), '호텔 예약.pdf');
    await page.locator('#itineraryEditorClose').click();
    await page.waitForFunction(() => !editingItineraryId && !document.querySelector('#itineraryEditor').open);
    await editItinerary('castle'); assert.equal(await page.locator('#ticketFileNameDisplay').textContent(), '호텔 예약.pdf');
    await closes();
    await page.evaluate(() => window.TripLog.features.itinerary.transitEditor.open('airport', 'castle'));
    await page.locator('#itineraryTransitManualTab').click();
    await page.locator('.transit-segment-menu > summary').first().click();
    await page.locator('.transit-segment-options').first().screenshot({ path: path.join(output, 'transit-removal-390.png'), animations: 'disabled' });
    await page.locator('[data-transit-remove]').first().click();
    assert.equal(await confirm.isVisible(), false);
    assert.equal(await page.locator('.transit-segment').count(), 1);
    assert.equal(await page.evaluate(() => findItineraryItem('airport').transits.length), 2);
    await closes(); flows.push('Attachment and transit removal stay in the unsaved editor');

    await editItinerary('castle'); await page.locator('#itineraryDeleteButton').click(); await accept();
    await page.locator('#itineraryEditor').waitFor({ state: 'hidden' }); assert.equal(await page.evaluate(() => !!findItineraryItem('castle')), false);
    await editItinerary('airport'); await page.locator('#itineraryDeleteButton').click(); await askKind('itinerary-linked');
    assert.match(await page.locator('#rdConfirmDescription').innerText(), /지출도 함께/); await cancel();
    assert(await page.evaluate(() => !!findEntry('fare')));
    await page.locator('#itineraryDeleteButton').click(); await accept(); await page.locator('#itineraryEditor').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => !!findItineraryItem('airport') || !!findEntry('fare')), false);
    flows.push('Itinerary deletion and its linked expense are accurately disclosed and persisted');

    async function editExpense(id) {
      await page.evaluate(id => { window.TripLog.features.redesign.workspace.navigate('budget'); startEdit(findEntry(id)); }, id);
      if (!await page.locator('#rdExpenseMemo').evaluate(node => node.open)) await page.locator('#rdExpenseMemo > summary').click();
    }
    await editExpense('dinner'); await page.locator('#rdDeleteExpense').click(); await askKind('expense');
    assert.match(await page.locator('#rdConfirmSubject').innerText(), /저녁 식사 · 38,000원/);
    assert.equal(await page.locator('#rdConfirmDescription').innerText(), '연결된 일정은 유지돼요.'); await cancel();
    assert(await page.evaluate(() => !!findEntry('dinner')));
    await page.locator('#rdDeleteExpense').click(); await accept(); await page.locator('#rdExpenseEditor').waitFor({ state: 'hidden' });
    assert(await page.evaluate(() => !!findItineraryItem('restaurant') && !findItineraryItem('restaurant').expenseId));
    await editExpense('failure');
    await page.evaluate(() => { window.__originalSave = window.TripLogSyncRepository.save; window.TripLogSyncRepository.save = async () => { throw new Error('QuotaExceededError deletion fixture'); }; });
    await page.locator('#rdDeleteExpense').click(); await accept();
    await page.getByText('지출을 삭제하지 못했어요. 다시 시도해 주세요.', { exact: true }).waitFor();
    assert(await page.locator('#rdExpenseEditor').isVisible()); assert(await page.evaluate(() => !!findEntry('failure')));
    await page.evaluate(() => { window.TripLogSyncRepository.save = window.__originalSave; });
    await page.locator('#rdDeleteExpense').click(); await accept(); await page.locator('#rdExpenseEditor').waitFor({ state: 'hidden' });
    flows.push('Expense deletion keeps its itinerary; failed persistence retains the record/editor and retry succeeds');

    await closes(); await show('rdMore'); await page.locator('#rdMore [data-rd-action="packing"]').click();
    const removePacking = page.locator('[data-rd-action="packing-delete"][data-id="custom-packing"]');
    await removePacking.click(); await askKind('packing'); await cancel(); assert.equal(await removePacking.count(), 1);
    await removePacking.click(); await accept(); await removePacking.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => state.packingList.find(item => item.id === 'pack-1').checked), true);
    await page.locator('[data-rd-action="packing-reset"]').click(); await askKind('packing-reset'); await cancel();
    await page.locator('[data-rd-action="packing-reset"]').click(); await accept();
    assert.equal(await page.evaluate(() => state.packingList.length === 6 && state.packingList.every(item => !item.checked)), true);
    await closes(); await show('rdCompanions');
    await page.locator('.companion-delete-btn').click(); await askKind('companion'); await cancel();
    assert.equal(await page.evaluate(() => state.companions.length), 1);
    await page.locator('.companion-delete-btn').click(); await accept();
    assert.equal(await page.evaluate(() => state.companions.length), 0);
    flows.push('Preparation item, default list reset and settlement companion cancel/commit');

    await closes(); await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('wallet'));
    await page.locator('[data-tt-action="reservation-detail"][data-id="manual:manual-hotel"]').click();
    await page.locator('[data-tt-action="reservation-delete"]').click(); await askKind('reservation'); await cancel();
    assert(await page.locator('#ttReservationDetail').isVisible());
    await page.locator('[data-tt-action="reservation-delete"]').click(); await accept();
    await page.locator('#ttReservationDetail').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => state.travelCompanion.reservations.length), 0);
    assert(await page.evaluate(() => !!findItineraryItem('restaurant')));
    flows.push('Manual reservation deletion keeps its source itinerary and expenses');

    await closes(); await page.evaluate(() => saveCurrentSnapshot());
    await page.waitForFunction(async () => (await loadArchiveRecords()).length > 0); await page.evaluate(() => openHistoryModal());
    await page.locator('[data-history-action="delete"]').first().click(); await askKind('history');
    await page.keyboard.press('Escape'); await confirm.waitFor({ state: 'hidden' });
    assert(await page.locator('#historyModal').isVisible(), 'Escape must not close the underlying legacy overlay');
    await page.locator('[data-history-action="delete"]').first().click(); await accept();
    await page.waitForFunction(() => historyRecords.length === 0);
    assert.equal(await page.evaluate(async () => (await loadArchiveRecords()).length), 0);
    assert(await page.evaluate(() => !!findItineraryItem('restaurant')));
    flows.push('Saved snapshot delete, persistence and nested legacy-overlay Escape');

    await closes(); await page.evaluate(() => { setActivePage('itinerary'); window.TripLog.features.itinerary.workspace.show({ previewMap: false }); });
    await page.locator('#itineraryPlaceInput').fill('작성 중인 새 장소');
    await page.waitForFunction(async () => (await window.TripLog.sync.drafts.list(state.id)).some(row => row.value.fields.itineraryPlaceInput?.value === '작성 중인 새 장소'));
    await page.locator('#itineraryEditorClose').click(); await page.locator('#itineraryPageButton').click();
    await page.locator('#sync-menu-recovery').click();
    const draft = page.locator('#triplogSyncStatus .sync-conflict').filter({ hasText: '작성 중인 새 장소' });
    await draft.getByRole('button', { name: '초안 삭제', exact: true }).click(); await askKind('draft'); await cancel();
    await draft.getByRole('button', { name: '초안 삭제', exact: true }).click(); await accept(); await draft.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(async () => (await window.TripLog.sync.drafts.list(state.id)).some(row => row.value.fields.itineraryPlaceInput?.value === '작성 중인 새 장소')), false);
    flows.push('Draft confirmation and persistent discard');

    await closes(); await show('rdAdvanced');
    await page.evaluate(() => { saveGoogleGeocodingApiKey('fixture-map-key'); syncMapGeocodingSettings(); });
    await page.locator('#settingsGoogleGeocodingKeyClearButton').click(); await askKind('map-key'); await cancel();
    assert(await page.evaluate(() => hasGoogleGeocodingApiKey()));
    await page.locator('#settingsGoogleGeocodingKeyClearButton').click(); await accept();
    assert.equal(await page.evaluate(() => hasGoogleGeocodingApiKey()), false);
    assert(await page.locator('#settingsGoogleGeocodingKeyClearButton').isDisabled());
    flows.push('Map key removal exposes no credential and requires confirmation');
    await closes(); await page.reload(); await waitForApp(page);
    assert.equal(await page.evaluate(() => state.entries.length), 0);
    assert.equal(await page.evaluate(() => state.itineraryItems.length), 1);
    assert.equal(await page.evaluate(() => state.packingList.length), 6);
    flows.push('Committed record deletions and packing reset survive reload');

    // The existing reset starts a new trip and deletes saved snapshots, not existing trips.
    await page.evaluate(() => saveCurrentSnapshot()); await page.waitForFunction(async () => (await loadArchiveRecords()).length > 0);
    await show('rdBackup'); await page.locator('#settingsResetButton').click(); await askKind('reset'); await cancel();
    assert.equal(await page.evaluate(() => state.id), seed.id);
    await page.locator('#settingsResetButton').click(); await accept();
    await page.waitForFunction(() => state.id !== 'delete-dialogs' && historyRecords.length === 0);
    assert(await page.evaluate(() => window.TripLog.persistence.stateStorage.getTrips().some(trip => trip.id === 'delete-dialogs')));
    assert.equal(await page.evaluate(async () => (await loadArchiveRecords()).length), 0);
    flows.push('Reset copy matches new-trip creation, retained trips and deleted saved snapshots');
    await context.close();

    // Exercise shared UI against the command boundary, with synthetic roles and data.
    const shared = await fixture(), p = shared.page, h = helpers(p);
    await p.evaluate(async user => {
      window.__controls = [];
      window.TripLog.sync.controller.request = async kind => kind === 'members' ? { members: [{ user_id: user.id, display_name: '나', role: 'owner' }, { user_id: 'fixture-member', display_name: '지은', role: 'editor' }] } : { history: [] };
      window.TripLog.sync.controller.engine.control = async (id, action, value) => { window.__controls.push({ id, action, value }); return {}; };
      window.TripLog.sync.controller.engine.refresh = async () => {};
      await window.TripLogSyncRepository.update(state.id, record => ({ ...record, serverId: 'fixture-shared-trip', role: 'owner' }));
    }, user);
    await p.locator('#itineraryPageButton').click(); await p.locator('#sync-menu-comments').click();
    await p.locator('#triplogCommentText').fill('내일 9시에 로비에서 만나요.');
    await p.getByRole('button', { name: '댓글 남기기', exact: true }).click();
    await p.getByRole('button', { name: '댓글 삭제', exact: true }).waitFor();
    await p.getByRole('button', { name: '댓글 삭제', exact: true }).click(); await h.askKind('comment'); await h.cancel();
    assert.equal(await p.getByRole('button', { name: '댓글 삭제', exact: true }).count(), 1);
    await p.getByRole('button', { name: '댓글 삭제', exact: true }).click(); await h.accept();
    await p.getByRole('button', { name: '댓글 삭제', exact: true }).waitFor({ state: 'detached' });
    await p.locator('#sync-menu-members').click();
    await p.getByRole('button', { name: '멤버 내보내기', exact: true }).click(); await h.askKind('member'); await h.cancel();
    assert.equal(await p.evaluate(() => window.__controls.length), 0);
    await p.getByRole('button', { name: '멤버 내보내기', exact: true }).click(); await h.accept();
    await p.waitForFunction(() => window.__controls.length === 1);
    assert.deepEqual(await p.evaluate(() => window.__controls[0]), { id: seed.id, action: 'member', value: { userId: 'fixture-member', role: 'remove' } });
    await p.evaluate(() => window.TripLogSyncRepository.update(state.id, record => ({ ...record, role: 'editor' })));
    await p.locator('#sync-menu-members').click();
    await p.getByRole('button', { name: '공유 여행 나가기', exact: true }).click(); await h.askKind('leave'); await h.cancel();
    assert.equal(await p.evaluate(() => window.__controls.length), 1);
    await p.getByRole('button', { name: '공유 여행 나가기', exact: true }).click(); await h.accept();
    await p.waitForFunction(() => window.__controls.some(row => row.action === 'leave'));
    await p.waitForFunction(() => window.TripLogSyncRepository.cached('delete-dialogs').hidden);
    flows.push('Shared comment, member removal and leave: cancel is inert and accept sends the intended operation');
    await shared.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(consoleIssues, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ environment: { origin, browser: 'Playwright/Edge', reason: 'Browser plugin not available', isolated: true }, dimensions, flows, errors, consoleIssues }, null, 2));
    console.log(`PASS deletion dialogs: ${dimensions.length} compact state/viewport checks; ${flows.length} interaction groups; no app errors. ${output}`);
  } catch (error) {
    let index = 0;
    for (const context of browser.contexts()) for (const page of context.pages()) {
      await page.screenshot({ path: path.join(output, `failure-${index++}.png`), animations: 'disabled' }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
