const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TRIPLOG_TEST_URL || 'http://127.0.0.1:18080';
async function main() {
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),headless:true});
  try {
    const context = await browser.newContext(); context.setDefaultTimeout(20000);
    // A synthetic local session permits the offline screen. Every external request is blocked.
    const user={id:'00000000-0000-4000-8000-000000000001',email:'offline@example.test',user_metadata:{display_name:'오프라인 시험'}};
    const expiry=Math.floor(Date.now()/1000)+3600;
    const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:expiry,role:'authenticated'})).toString('base64url'),'fixture'].join('.');
    await context.addInitScript(({origin,user,expiry,token})=>{
      if(location.origin!==origin)return;
      if(!localStorage.getItem('offline-fixture')){
        localStorage.setItem('offline-fixture','1');
        localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:expiry,expires_in:3600,user}));
      }
    },{origin,user,expiry,token});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/Travel.html');
    await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&document.documentElement.dataset.auth==='signed-in');
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    await page.evaluate(async()=>{state.tripName='오프라인 시험 여행';state.itineraryItems.push({id:'offline-fixture',date:state.startDate,place:'와이파이 없는 교토 일정'});await saveAndRender();});
    const id=await page.evaluate(()=>state.id);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&document.documentElement.dataset.auth==='signed-in');
    await page.waitForFunction(()=>state.itineraryItems.some(i=>i.id==='offline-fixture'));
    assert.equal(await page.evaluate(()=>state.id),id);
    await page.evaluate(()=>{setActivePage('itinerary');startItineraryEdit(state.itineraryItems.find(i=>i.id==='offline-fixture'));document.querySelector('#itineraryExtraDetails').open=true;});
    await page.locator('#itineraryMemoInput').fill('앱을 닫기 전 작성 중인 초안');
    await page.waitForFunction(async()=>Boolean((await window.TripLog.sync.drafts.list(state.id)).find(row=>row.value.fields.itineraryMemoInput?.value==='앱을 닫기 전 작성 중인 초안')));
    await page.reload();
    await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&document.documentElement.dataset.auth==='signed-in');
    await page.evaluate(()=>window.TripLog.sync.statusUi.open());
    await page.getByRole('button',{name:'복구 기록',exact:true}).click();
    await page.getByRole('button',{name:'새 일정으로 이어서 작성',exact:true}).click();
    assert.equal(await page.locator('#itineraryMemoInput').inputValue(),'앱을 닫기 전 작성 중인 초안');
    assert.deepEqual(errors,[]);
    console.log('PASS PWA: cached shell starts without network, local session and saved itinerary survive, unfinished draft resumes without replacing the original');
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
