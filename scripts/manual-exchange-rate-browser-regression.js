// Isolated browser regression for manual settings rates and per-entry snapshots.
// External requests are blocked. No real account, trip, or server data is edited.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createServer } = require('./serve-test');

async function main() {
  const server = createServer({ pagesRedirects: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.TRIPLOG_TEST_URL || `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  let page;
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } });
    context.setDefaultTimeout(12000);
    const user = { id: '00000000-0000-4000-8000-000000000099', email: 'controls@example.test', user_metadata: { display_name: '컨트롤 시험' } };
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: expiry, role: 'authenticated' })).toString('base64url'), 'fixture'].join('.');
    const seed = { id: 'controls-fixture', tripName: '교토 여행', city: '교토', country: '일본', countryCode: 'JP', currencyAutoMatchedCountryCode: 'JP', travelMode: 'overseas', startDate: '2026-09-25', endDate: '2026-09-28', totalBudget: 1000000, currencyCode: 'JPY', exchangeRate: 900, entries: [
      {id:'expense-hotel',date:'__pretrip__',paymentDate:'2026-09-20',category:'숙소',description:'교토 호텔 · 2박',amount:162000,foreignAmount:18000,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'card',note:'체크인 15:00 · 조식 포함',createdAt:1},
      {id:'expense-flight',date:'__pretrip__',paymentDate:'2026-09-20',category:'교통',description:'오사카 왕복 항공권',amount:280000,currency:'KRW',paymentMethod:'card',note:'위탁 수하물 15kg 포함',createdAt:2},
      {id:'expense-lunch',date:'2026-09-26',paymentDate:'2026-09-26',category:'식비',description:'니시키 시장 점심',amount:21600,foreignAmount:2400,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'cash',note:'시장 안쪽 우동 가게',createdAt:3},
      {id:'expense-train',date:'2026-09-25',paymentDate:'2026-09-25',category:'교통',description:'간사이 공항 라피트',amount:13410,foreignAmount:1490,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'card',note:'공항 → 난바',createdAt:4},
      {id:'expense-temple',date:'2026-09-26',paymentDate:'2026-09-26',category:'관광',description:'텐류지 입장권',amount:4500,foreignAmount:500,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'cash',note:'정원 입장',createdAt:5},
      {id:'expense-shop',date:'2026-09-26',paymentDate:'2026-09-26',category:'쇼핑',description:'교토 기념품',amount:16200,foreignAmount:1800,currency:'JPY',exchangeRate:900,exchangeBase:100,paymentMethod:'card',note:'말차 과자',createdAt:6}
    ], companions: [], packingList: [], itineraryItems: [] };
    await context.addInitScript(({ origin, user, expiry, token, seed }) => {
      if (location.origin !== origin || localStorage.getItem('controls-seed')) return;
      localStorage.setItem('controls-seed', '1');
      localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_at: expiry, expires_in: 3600, user }));
      localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([seed]));
      localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', seed.id);
    }, { origin, user, expiry, token, seed });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    async function ready() {
      await page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true' && document.documentElement.dataset.auth === 'signed-in' && document.documentElement.dataset.appReady === 'true');
    }
    await page.goto(`${origin}/Travel?page=budget`); await ready();
    await page.setViewportSize({width:390,height:844});
    async function setRate(rate) {
      await page.evaluate(() => document.querySelector('#rdCurrency').showModal());
      await page.locator('#settingsExchangeRateInput').fill(String(rate));
      assert.equal(await page.evaluate(() => state.exchangeRate), rate);
      await page.evaluate(() => document.querySelector('#rdCurrency').close());
    }
    async function addExpense(rate, name) {
      await page.evaluate(() => setActivePage('budget'));
      await page.locator('.ex-mobile-add [data-rd-action="expense-new"]').click();
      await page.locator('#currencySelectButton').click();
      await page.locator('#currencySelectMenu [data-value="JPY"]').click();
      assert.equal(await page.locator('#exchangeRateInput').inputValue(), String(rate));
      await page.locator('#foreignAmountInput').fill('1000');
      await page.locator('#descriptionInput').fill(name);
      await page.locator('#daySelectButton').click();
      await page.locator('#daySelectMenu [data-value="2026-09-26"]').click();
      await page.evaluate(() => { document.querySelector('#rdPaymentDate').value = '2026-09-26'; syncCustomDatePicker(document.querySelector('#rdPaymentDate')); });
      await page.locator('#rdExpenseSubmit').click();
      await page.waitForFunction(() => !document.querySelector('#rdExpenseEditor').open);
      const saved = await page.evaluate(name => state.entries.find(e => e.description === name), name);
      assert.equal(saved.exchangeRate, rate);
      assert.equal(saved.amount, rate * 10);
      return saved.id;
    }
    // A response already in flight must not overwrite the manual setting.
    await page.evaluate(() => {
      fetchLatestExchangeRateToKrw = () => new Promise(resolve => { window.resolveRate = resolve; });
      requestLatestExchangeRateForCurrency();
    });
    await setRate(860);
    await page.evaluate(async () => { window.resolveRate({rate:999,source:'Frankfurter',date:'2026-09-25'}); await Promise.resolve(); });
    assert.equal(await page.evaluate(() => state.exchangeRate),860);
    // Re-selecting the current currency must not reset its manual rate.
    await page.evaluate(() => document.querySelector('#rdCurrency').showModal());
    await page.locator('#settingsCurrencySelectButton').click();
    await page.locator('#settingsCurrencySelectMenu [data-value="JPY"]').click();
    assert.equal(await page.evaluate(() => state.exchangeRate),860);
    assert.equal(await page.evaluate(() => state.exchangeRateSource),'수동 입력');
    await page.evaluate(() => document.querySelector('#rdCurrency').close());
    const first = await addExpense(860, 'manual-860');
    await setRate(870);
    await addExpense(870, 'manual-870');
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => state.exchangeRate),870);
    assert.equal(await page.evaluate(id => state.entries.find(e => e.id === id).amount, first),8600);
    await page.evaluate(() => setActivePage('budget'));
    await page.locator(`#rdExpenseList [data-id="${first}"].ex-entry-title`).click();
    assert.equal(await page.locator('#exchangeRateInput').inputValue(),'860');
    await page.locator('#descriptionInput').fill('manual-860-edited');
    await page.locator('#rdExpenseSubmit').click();
    await page.waitForFunction(() => !document.querySelector('#rdExpenseEditor').open);
    assert.equal(await page.evaluate(() => state.exchangeRate),870);
    assert.equal(await page.evaluate(id => state.entries.find(e => e.id === id).amount, first),8600);
    await addExpense(870, 'after-edit');
    await page.evaluate(() => document.querySelector('#rdCurrency').showModal());
    await page.locator('#settingsExchangeRateInput').fill('0');
    assert.equal(await page.evaluate(() => state.exchangeRate),870);
    await page.locator('#settingsExchangeRateInput').fill('870');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('Manual exchange rate browser regression passed: 860 → 870, persistence, old-entry editing, delayed fetch, invalid input.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
