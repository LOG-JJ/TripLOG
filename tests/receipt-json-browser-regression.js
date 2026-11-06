const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, seedTrip, startServer, stopServer } = require('./helpers/browser-fixture');
// Isolated Playwright/Edge fixture for structured expense import.
// External requests are blocked. No real account, trip, or server data is edited.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('receipt-json');

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
    const payload = {description:'JSON 식당',paymentDate:'2026-09-24',expenseDate:'__pretrip__',amount:2400,currency:'JPY',category:'식비',paymentMethod:'cash',note:'JSON 메모',payerKey:'leader',exchangeRate:950,checkIn:null,checkOut:null};
    await page.locator('.ex-desktop-add').click();
    await page.locator('#rdExpenseEditor [data-rd-action="receipt"]').click();
    assert.match(await page.locator('#receiptJsonPrompt').inputValue(), /2026-09-25/);
    await page.waitForTimeout(1000);
    await page.screenshot({path:path.join(output,'json-desktop.png')});
    await page.locator('#receiptJsonText').fill(JSON.stringify({...payload,amount:-1}));
    await page.locator('#receiptParseJson').click();
    assert.match(await page.locator('#receiptJsonStatus').innerText(), /0보다 큰/);
    assert.equal(await page.locator('#receiptApplyButton').isDisabled(),true);
    await page.locator('#receiptJsonText').fill(JSON.stringify({...payload,payerKey:'missing'}));
    await page.locator('#receiptParseJson').click();
    assert.match(await page.locator('#receiptJsonStatus').innerText(), /payerKey/);
    await page.locator('#receiptJsonText').fill('```json\n'+JSON.stringify(payload)+'\n```');
    await page.locator('#receiptParseJson').click();
    await page.locator('#receiptApplyButton').click();
    assert.equal(await page.locator('#noteInput').inputValue(),'JSON 메모');
    assert.equal(await page.locator('#rdPaymentDate').inputValue(),'2026-09-24');
    assert.equal(await page.locator('#daySelect').inputValue(),'__pretrip__');
    assert.equal(await page.locator('#paymentMethodInput').inputValue(),'cash');
    assert.equal(await page.evaluate(()=>parseFormattedNumber(els.amountInput.value)),22800);
    assert.equal(await page.evaluate(()=>state.entries.length),6);
    await page.locator('#rdExpenseSubmit').click();
    await page.waitForFunction(()=>state.entries.length===7 && !document.querySelector('#rdExpenseEditor').open);
    await page.reload(); await ready();
    assert.equal(await page.evaluate(()=>state.entries.find(e=>e.description==='JSON 식당').exchangeRate),950);
    await page.evaluate(() => setActivePage('budget'));
    await page.setViewportSize({width:390,height:844});
    await page.locator('.ex-mobile-add [data-rd-action="expense-new"]').click();
    await page.locator('#rdExpenseEditor [data-rd-action="receipt"]').click();
    await page.waitForTimeout(1000);
    await page.screenshot({path:path.join(output,'json-mobile.png')});
    assert(await page.locator('#receiptJsonText').isVisible());
    assert(await page.evaluate(()=>document.querySelector('#receiptDialog').scrollWidth<=document.querySelector('#receiptDialog').clientWidth+1));
    await page.locator('#receiptJsonText').fill(JSON.stringify({...payload,description:'JSON 숙소',category:'숙소',amount:18000,expenseDate:'2026-09-25',checkIn:'2026-09-25',checkOut:'2026-09-27'}));
    await page.locator('#receiptParseJson').click();
    await page.locator('#receiptApplyButton').click();
    assert.equal(await page.locator('#lodgingCheckInInput').inputValue(),'2026-09-25');
    assert.equal(await page.locator('#lodgingCheckOutInput').inputValue(),'2026-09-27');
    await page.locator('#rdExpenseSubmit').click();
    await page.waitForFunction(()=>state.entries.length===9);
    assert.equal(await page.evaluate(()=>state.entries.filter(e=>e.description==='JSON 숙소').reduce((sum,e)=>sum+e.amount,0)),171000);
    await page.reload(); await ready();
    assert.equal(await page.evaluate(()=>state.entries.length),9);
    assert.deepEqual(errors,[]);
    console.log('PASS: JSON errors, prompt, pretrip, JPY conversion, payment metadata, save/reload, lodging split and mobile layout');
  } finally { await browser.close(); await stopServer(server); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
