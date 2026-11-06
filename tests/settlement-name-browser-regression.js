const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const { launchBrowser } = require('./helpers/browser-fixture');
// Browser plugin not available. Isolated Playwright/Edge fixtures use a local
// auth stub and never modify a production profile, participant or expense.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createReservationPocketPreview } = require('../scripts/preview-reservation-pockets');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('settlement-name');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createReservationPocketPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    context.setDefaultTimeout(12000);
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.endsWith('/vendor/supabase-js-2.107.0.min.js')) {
        const response = await route.fetch();
        return route.fulfill({ response, body: (await response.text()).replace('"display_name":"예약 목업"', '"display_name":"JH"') });
      }
      return route.continue();
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in' && state.collaboration?.ownerId);
    const dialog = page.locator('#rdCompanions');
    const open = async () => { await page.locator('#rdSettlement [data-rd-action="settlement-name"]').click(); await dialog.waitFor({ state: 'visible' }); };
    const close = async () => { await dialog.locator('.rd-dialog-head [data-rd-action="close"]').click(); await dialog.waitFor({ state: 'hidden' }); };
    const name = () => page.locator('#rdSettlement .st-member-identity').first().getAttribute('aria-label');
    const details = () => page.evaluate(() => ({ name: state.settlement.leaderName, entries: structuredClone(state.entries), shares: structuredClone(state.settlement.itemSplits), members: buildSettlementModel({ id: 'current', state }).memberSummaries.map(({ key, paid, owed, balance }) => ({ key, paid, owed, balance })) }));
    await page.goto(`${origin}/Travel?page=settlement&trip=reservation-empty-fixture`); await ready();
    assert.equal(await page.title(), '여행 가계부'); assert.match(page.url(), /page=settlement/);
    await page.evaluate(async () => {
      state.companions = [{ id: 'friend', name: '동행', individualSpent: 0 }];
      state.entries = [{ id: 'hotel', date: state.startDate, category: '숙소', description: '숙소', amount: 120000, payerKey: 'leader' }, { id: 'meal', date: state.startDate, category: '식비', description: '식사', amount: 20000, payerKey: 'companion:friend' }];
      state.settlement = { ...state.settlement, leaderName: '여행 대표', itemSplits: { 'current:hotel': { mode: 'custom', shares: { leader: 60000, 'companion:friend': 60000 } } } };
      await saveAndRender();
    });
    const before = await details();
    assert.equal(await name(), 'JH', 'Default leader label resolves the actual owner profile');
    await page.evaluate(() => { window.TripLog.features.redesign.workspace.navigate('budget'); startEdit(findEntry('hotel')); });
    assert.equal(await page.locator('#rdPayer option[value="leader"]').textContent(), 'JH', 'Expense payer uses the same owner-name fallback');
    assert.equal(await page.locator('#rdPayer').inputValue(), 'leader', 'Display names do not replace stable payer keys');
    await page.locator('#rdExpenseMemo').evaluate(node => { node.open = true; });
    await page.locator('#rdExpenseMemo label').filter({has:page.locator('#rdPayer')}).screenshot({path:path.join(output,'profile-payer-JH-390.png'),animations:'disabled'});
    await page.locator('#rdExpenseEditor .rd-dialog-head [data-rd-action="close"]').click();
    await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('settlement'));
    await open(); await page.locator('#rdSettlementNameProfile').click();
    assert.equal(await page.locator('#rdSettlementName').inputValue(), 'JH');
    await close(); assert.equal(await name(), 'JH');
    assert.equal((await details()).name, '여행 대표', 'Display fallback does not silently rename the shared trip');
    await open(); await page.locator('#rdSettlementName').fill('');
    await page.locator('#rdSettlementNameSave').click(); assert(await dialog.isVisible());
    assert.equal(await page.locator('#rdSettlementName').evaluate(el => el.validity.valueMissing), true);
    await page.locator('#rdSettlementNameProfile').click();
    await page.evaluate(() => { window.__save = saveAndRender; saveAndRender = async () => false; });
    await page.locator('#rdSettlementNameSave').click();
    assert.match(await page.locator('#rdSettlementNameError').innerText(), /저장하지 못했어요/);
    assert.equal((await details()).name, before.name); assert.equal(await page.locator('#rdSettlementName').inputValue(), 'JH');
    await page.evaluate(() => { saveAndRender = window.__save; });
    await page.locator('#rdSettlementNameSave').click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await name(), 'JH');
    const after = await details(); assert.deepEqual({ ...after, name: before.name }, before, 'Renaming keeps payer IDs, money and all shares intact');
    assert.match(await page.locator('.rd-transfers .st-transfer').getAttribute('aria-label'), /동행 → JH/);
    await open(); assert.equal(await page.locator('#settlementMembersList .leader').innerText(), 'JH'); await close();
    await page.reload(); await ready(); assert.equal(await name(), 'JH', 'Name survives reload');
    await page.evaluate(() => { window.TripLog.features.redesign.workspace.navigate('budget'); startEdit(findEntry('hotel')); });
    assert.equal(await page.locator('#rdPayer option[value="leader"]').textContent(), 'JH');
    assert.equal(await page.locator('#rdPayer').inputValue(), 'leader');
    await page.locator('#rdExpenseEditor .rd-dialog-head [data-rd-action="close"]').click();
    await page.evaluate(() => window.TripLog.features.redesign.workspace.navigate('settlement'));
    await open(); await page.locator('#rdSettlementName').fill('  정현  '); await page.locator('#rdSettlementNameSave').click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await name(), '정현');
    assert.equal(await page.evaluate(() => window.TripLog.features.collaboration.tripCollaboration.getCurrentAccount().displayName), 'JH', 'Trip label does not change the account profile');
    assert.notEqual(await page.evaluate(() => window.TripLog.persistence.stateStorage.getTrips().find(trip => trip.id === 'reservation-pockets-fixture').settlement?.leaderName), '정현', 'Other trips stay independent');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('#rdSettlement').screenshot({ path: path.join(output, `settlement-${width}.png`), animations: 'disabled' });
      await open(); await dialog.screenshot({ path: path.join(output, `name-editor-${width}.png`), animations: 'disabled' }); await close();
    }
    await open(); await page.locator('#rdSettlementName').fill('덮어쓰지 말 것');
    await page.evaluate(async () => { state.settlement.leaderName = '다른 기기 이름'; await saveAndRender(); });
    await page.locator('#rdSettlementNameSave').click(); assert.match(await page.locator('#rdSettlementNameError').innerText(), /다른 곳에서 이름이 변경/); await close();
    assert.equal(await name(), '다른 기기 이름');
    const fallbacks = await page.evaluate(() => {
      const previous = { name: state.settlement.leaderName, collaboration: structuredClone(state.collaboration) };
      state.settlement.leaderName = '여행 대표';
      state.collaboration.ownerId = 'different-trip-owner'; state.collaboration.ownerName = '원래 여행장';
      const otherOwner = getSettlementLeaderName();
      state.settlement.leaderName = '저장한 정산 이름'; const explicit = getSettlementLeaderName();
      state.collaboration.ownerName = '나'; state.settlement.leaderName = '여행 대표'; const unknown = getSettlementLeaderName();
      state.settlement.leaderName = previous.name; state.collaboration = previous.collaboration;
      return { otherOwner, explicit, unknown };
    });
    assert.deepEqual(fallbacks, { otherOwner: '원래 여행장', explicit: '저장한 정산 이름', unknown: '여행 대표' }, 'Never replace another owner with the viewing account profile');
    await page.evaluate(async () => { await window.TripLogSyncRepository.update(state.id, record => ({ ...record, role: 'viewer' })); render(); });
    assert(await page.locator('#rdSettlement [data-rd-action="settlement-name"]').isDisabled());
    await page.locator('#rdSettlement [data-rd-action="companions"]').click();
    assert(await page.locator('#rdSettlementNameSave').isDisabled()); assert(await page.locator('#rdSettlementNameProfile').isDisabled());
    assert.deepEqual(errors, []);
    console.log(`PASS settlement names: manual/profile choice, cancel/validation/failure, persisted shared field, unchanged money/payers/shares, all labels, isolated trips, stale edits, viewer guard and 320/390/1440 layout. ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
