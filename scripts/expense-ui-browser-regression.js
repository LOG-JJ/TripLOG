const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, seedTrip, startServer, stopServer } = require('./helpers/browser-fixture');
// Browser plugin unavailable: use the repository's isolated Playwright/Edge workflow.
// External requests are blocked. No real account, trip, or server data is edited.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('expense-ui');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  let page;
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } });
    context.setDefaultTimeout(12000);
    const user = { id: '00000000-0000-4000-8000-000000000099', email: 'controls@example.test', user_metadata: { display_name: '컨트롤 시험' } };
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const token = fixtureToken(user, expiry);
    const seed = { id: 'controls-fixture', tripName: '교토 여행', city: '교토', country: '일본', travelMode: 'overseas', startDate: '2026-09-25', endDate: '2026-09-28', totalBudget: 1000000, currencyCode: 'JPY', exchangeRate: 900, entries: [
      {id:'expense-hotel',date:'__pretrip__',paymentDate:'2026-09-20',category:'숙소',description:'교토 호텔 · 2박',amount:162000,foreignAmount:18000,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'card',note:'체크인 15:00 · 조식 포함',createdAt:1},
      {id:'expense-flight',date:'__pretrip__',paymentDate:'2026-09-20',category:'교통',description:'오사카 왕복 항공권',amount:280000,currency:'KRW',paymentMethod:'card',note:'위탁 수하물 15kg 포함',createdAt:2},
      {id:'expense-lunch',date:'2026-09-26',paymentDate:'2026-09-26',category:'식비',description:'니시키 시장 점심',amount:21600,foreignAmount:2400,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'cash',note:'시장 안쪽 우동 가게',createdAt:3},
      {id:'expense-train',date:'2026-09-25',paymentDate:'2026-09-25',category:'교통',description:'간사이 공항 라피트',amount:13410,foreignAmount:1490,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'card',note:'공항 → 난바',createdAt:4},
      {id:'expense-temple',date:'2026-09-26',paymentDate:'2026-09-26',category:'관광',description:'텐류지 입장권',amount:4500,foreignAmount:500,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'cash',note:'정원 입장',createdAt:5},
      {id:'expense-shop',date:'2026-09-26',paymentDate:'2026-09-26',category:'쇼핑',description:'교토 기념품',amount:16200,foreignAmount:1800,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'card',note:'말차 과자',createdAt:6}
    ], companions: [], packingList: [], itineraryItems: [] };
    await seedTrip(context, { origin, user, expiry, token, seed });
    await blockExternalRequests(context, origin);
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    async function ready() {
      await page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && document.documentElement.dataset.appReady === 'true');
    }
    async function capture(selector, name) {
      const node = page.locator(selector); await node.waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, `${name}-context.png`), animations: 'disabled' });
      await node.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
      const box = await node.boundingBox(), viewport = page.viewportSize();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${name} must fit the viewport: ${JSON.stringify(box)}`);
    }

    await page.goto(`${origin}/Travel?page=budget`); await ready();
    await page.evaluate(() => setActivePage('budget'));
    await page.waitForFunction(() => document.querySelectorAll('#rdExpenseList tr').length === 6);
    await page.screenshot({path:path.join(output,'ledger-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(output,'ledger-mobile.png')});
    await page.locator('.ex-mobile-add [data-rd-action="expense-new"]').click();
    await page.evaluate(() => {
      state.collaboration.members = [{ id: 'payer-member', name: '민지', role: 'member', status: 'accepted' },
        { id: 'pending-member', name: '초대 대기', role: 'member', status: 'pending' }];
      render();
    });
    assert.deepEqual(await page.locator('#rdPayer option').allTextContents(), [user.user_metadata.display_name, '민지']);
    await page.locator('#rdExpenseMemo summary').click();
    await page.locator('#rdPayerButton').click();
    await page.locator('#rdPayerMenu [data-value="companion:payer-member"]').click();
    await page.locator('#rdExpenseMemo summary').click();
    await page.locator('#currencySelectButton').click();
    await page.locator('#currencySelectMenu [data-value="JPY"]').click();
    await page.locator('#exRateToggle').click();
    await page.locator('#exchangeRateInput').fill('900');
    await page.locator('#exRateToggle').click();
    await page.locator('#foreignAmountInput').fill('2400');
    await page.locator('#descriptionInput').fill('니시키 시장 점심');
    await page.locator('#daySelectButton').click();
    await page.locator('#daySelectMenu [data-value="2026-09-26"]').click();
    await page.locator('[data-payment-method="cash"]').click();
    await page.evaluate(()=>{document.querySelector('#rdPaymentDate').value='2026-09-26';syncCustomDatePicker(document.querySelector('#rdPaymentDate'));});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-payment-method="cash"]')).backgroundColor==='rgb(255, 240, 90)');
    assert.match(await page.locator('#exConversionSummary').innerText(), /21,600원/);
    assert.match(await page.locator('#exRateToggle').innerText(), /100엔 = 900원/);
    await page.locator('#rdExpenseEditor').screenshot({path:path.join(output,'editor-mobile.png')});
    await page.setViewportSize({width:1440,height:1100});
    await capture('#rdExpenseEditor','editor-desktop');
    await page.setViewportSize({width:390,height:844});
    await page.locator('#exRateToggle').click();
    await page.locator('#exchangeRateInput').fill('');
    await page.locator('#rdExpenseSubmit').click();
    assert.match(await page.locator('#exExpenseError').innerText(), /환율을 0보다 크게/);
    assert.equal(await page.evaluate(()=>state.entries.length),6);
    await page.locator('#exchangeRateInput').fill('900');
    await page.locator('#exRateToggle').click();
    await page.locator('#rdExpenseMemo summary').click();
    await page.locator('#noteInput').fill('저장 검증 메모');
    await page.locator('#rdExpenseSubmit').click();
    await page.waitForFunction(()=>!document.querySelector('#rdExpenseEditor').open && state.entries.length===7);
    const saved = await page.evaluate(()=>state.entries.find(e=>e.note==='저장 검증 메모'));
    assert.equal(saved.payerKey, 'companion:payer-member');
    assert.deepEqual([saved.amount,saved.foreignAmount,saved.currency,saved.paymentMethod,saved.date,saved.paymentDate],[21600,2400,'JPY','cash','2026-09-26','2026-09-26']);
    await page.reload(); await ready();
    await page.evaluate(()=>setActivePage('budget'));
    await page.waitForFunction(()=>state.entries.some(e=>e.note==='저장 검증 메모'));
    await page.locator(`#rdExpenseList [data-id="${saved.id}"].ex-entry-title`).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#noteInput').inputValue(),'저장 검증 메모');
    assert.equal(await page.locator('#rdPayer').inputValue(), 'companion:payer-member');
    await page.locator('#descriptionInput').fill('니시키 시장 점심 · 수정');
    await page.locator('#rdExpenseSubmit').click();
    await page.waitForFunction(()=>!document.querySelector('#rdExpenseEditor').open);
    assert.equal(await page.evaluate(id=>state.entries.find(e=>e.id===id).amount,saved.id),21600);
    await page.locator('.ex-mobile-add [data-rd-action="expense-new"]').click();
    await page.locator('#currencySelectButton').click();
    await page.locator('#currencySelectMenu [data-value="KRW"]').click();
    assert.equal(await page.locator('.ex-conversion-row').isVisible(),false);
    await page.locator('#foreignAmountInput').fill('162000');
    await page.locator('#descriptionInput').fill('교토 호텔');
    await page.locator('[data-ex-category="숙소"]').click();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-ex-category="숙소"]')).backgroundColor==='rgb(255, 240, 90)' && getComputedStyle(document.querySelector('[data-ex-category="식비"]')).backgroundColor==='rgb(255, 255, 255)');
    assert.equal(await page.locator('#exCategoryChoices [aria-pressed="true"]').count(),1);
    await page.evaluate(()=>{els.lodgingCheckInInput.value='2026-09-26';els.lodgingCheckOutInput.value='2026-09-28';handleLodgingDateChange('checkOut');});
    assert.match(await page.locator('#lodgingPreview').innerText(),/81,000/);
    await page.locator('#rdExpenseEditor .rd-dialog-body').evaluate(node=>node.scrollTop=0);
    await page.locator('#rdExpenseEditor').screenshot({path:path.join(output,'lodging-mobile.png')});
    await page.setViewportSize({width:320,height:740});
    assert(await page.evaluate(()=>document.querySelector('#rdExpenseEditor').scrollWidth<=320),'320px editor fits');
    await capture('#rdExpenseEditor','lodging-320');
    await page.evaluate(()=>{els.lodgingCheckOutInput.value='2026-09-26';updateLodgingPreview();});
    assert.equal(await page.locator('#lodgingPreview.is-error').count(),1);
    await page.locator('#rdExpenseSubmit').click();
    assert.equal(await page.locator('#exExpenseError').isVisible(),true);
    assert.equal(await page.evaluate(()=>state.entries.length),7);
    await page.evaluate(()=>{els.lodgingCheckOutInput.value='2026-09-28';handleLodgingDateChange('checkOut');});
    await page.locator('#foreignAmountInput').fill('162001');
    assert.match(await page.locator('#lodgingPreview').innerText(),/1박당 약/);
    await page.locator('#exSaveAnother').click();
    await page.waitForFunction(()=>state.entries.length===9 && document.querySelector('#rdExpenseEditor').open && !document.querySelector('#exSaveAnother').disabled);
    const nights=await page.evaluate(()=>state.entries.filter(e=>e.description==='교토 호텔'));
    assert.deepEqual(nights.map(e=>e.date),['2026-09-26','2026-09-27']);
    assert.equal(nights.reduce((n,e)=>n+e.amount,0),162001);
    assert.equal(await page.locator('#descriptionInput').inputValue(),'');
    await page.locator('#rdExpenseEditor [data-rd-action="close"]').click();
    await page.setViewportSize({width:390,height:844});
    await page.locator('#expenseSearchInput').fill('니시키');
    await page.waitForFunction(()=>document.querySelectorAll('#rdExpenseList tr').length===2);
    assert.match(await page.locator('#exResultSummary').innerText(),/43,200원/);
    await page.locator('#exSearchClear').click();
    await page.locator('#rdExpenseTabs [data-tab="pretrip"]').click();
    assert.equal(await page.locator('#rdExpenseList tr').count(),2);
    await page.locator('#rdExpenseTabs [data-tab="all"]').click();
    await page.locator('#exFilterToggle').click();
    await page.locator('#exCategoryFilterButton').click();
    await page.locator('#exCategoryFilterMenu [data-value="숙소"]').click();
    assert.equal(await page.locator('#rdExpenseList tr').count(),3);
    await page.locator('#expenseSearchInput').fill('검색결과없음');
    await page.locator('#exExpenseEmpty .ex-button').click();
    assert.equal(await page.locator('#rdExpenseList tr').count(),9);
    await page.locator('#expenseSortSelectButton').click();
    await page.locator('#expenseSortSelectMenu [data-value="dateAsc"]').click();
    assert.equal(await page.locator('#rdExpenseList tr').first().getAttribute('data-id'),'expense-hotel');
    await page.locator('#expenseSortSelectButton').click();
    await page.locator('#expenseSortSelectMenu [data-value="default"]').click();
    const recordedCosts = await page.locator('#rdBudgetSummary').innerText();
    for (const legacyBudget of [100, 0, 999999999]) {
      await page.evaluate(value => { state.totalBudget = value; render(); }, legacyBudget);
      assert.equal(await page.locator('#rdBudgetSummary').innerText(), recordedCosts, 'Legacy planned budget never changes actual spending');
    }
    assert.equal(await page.locator('#rdBudgetSummary progress, #rdBudgetSummary [data-rd-action="budget-edit"]').count(), 0);
    assert.doesNotMatch(recordedCosts, /예산|남은|초과 지출/);
    await page.evaluate(()=>{state.entries[0].description='아주 긴 여행 지출 이름 '.repeat(12);state.entries[0].note='기록한 메모 전체 내용 '.repeat(30);state.entries[0].amount=123456789012;render();});
    await page.setViewportSize({width:320,height:740});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=320),'long titles and amounts fit at 320px');
    await page.locator('#rdExpenseList tr[data-id="expense-hotel"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,'ledger-long-320.png')});
    await page.evaluate(()=>{state.entries=[];render();});
    assert.equal(await page.locator('#exExpenseEmpty').isVisible(),true);
    assert.match(await page.locator('#rdBudgetSummary').innerText(),/0원/);
    assert.equal(await page.locator('#rdExpenseTabs [data-count="all"]').innerText(),'0');
    const styles=await page.evaluate(()=>Object.fromEntries(['.ex-heading h1','#rdBudgetSummary .cost-summary-primary strong','#rdBudgetSummary .cost-summary-fact:first-child strong','.ex-entry-title','.ex-row-amount strong','#rdExpenseEditorTitle','#foreignAmountInput','#rdExpenseEditor label','#rdExpenseEditor .ex-category-choices button','#exConversionSummary'].map(selector=>{const node=document.querySelector(selector),s=node&&getComputedStyle(node);return [selector,node?{font:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,text:node.textContent?.trim().slice(0,180)}:null]})));
    fs.writeFileSync(path.join(output,'audit-after.json'),JSON.stringify({styles,errors},null,2));
    assert.deepEqual(errors,[]);
    console.log('PASS expense conversion, rate validation, save/edit/reload, lodging allocation and dates, save-and-continue, category state, search/filter/tabs, accumulated costs independent of legacy budget, empty state and 320px layout. '+output);
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
