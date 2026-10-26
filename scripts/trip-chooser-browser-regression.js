const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser } = require('./helpers/browser-fixture');
// Browser plugin unavailable: isolated Playwright/Edge fixtures; external requests blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve-test');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('trip-chooser');
const user = { id:'00000000-0000-4000-8000-000000000099', email:'chooser@example.test' };
const fixtures = [
  ['current','오사카&교토 추석 가족여행','오사카','일본','JP','overseas','2026-09-25','2026-09-28'],
  ['spare-one','새 여행','제주','대한민국','KR','domestic','2026-06-09','2026-06-16'],
  ['spare-two','새 여행','제주','대한민국','KR','domestic','2026-06-09','2026-06-16'],
  ['jeju','제주도 7박8일','제주','대한민국','KR','domestic','2026-06-09','2026-06-16'],
  ['shared','가족 모두 함께 떠나는 아주 긴 이름의 공유 여행','서울','대한민국','KR','domestic','2026-05-09','2026-05-12'],
].map(([id,tripName,city,country,countryCode,travelMode,startDate,endDate])=>({
  id,tripName,city,country,countryCode,travelMode,startDate,endDate,totalBudget:500000,
  currencyCode:countryCode==='JP'?'JPY':'KRW',currencySymbol:countryCode==='JP'?'¥':'₩',currencyUnit:countryCode==='JP'?'엔':'원',exchangeBase:countryCode==='JP'?100:1,exchangeRate:countryCode==='JP'?950:1,currencyAutoMatchedCountryCode:countryCode,
  entries:[{id:`expense-${id}`,date:startDate,category:'식비',description:'보존할 지출',amount:12000,paymentMethod:'card'}],
  itineraryItems:[{id:`plan-${id}`,date:startDate,time:'10:00',endTime:'11:00',place:'보존할 일정'}],
  packingList:[],companions:[],
}));

async function main() {
  fs.mkdirSync(output,{recursive:true});
  const server=createServer({pagesRedirects:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=process.env.TRIPLOG_TEST_URL || `http://127.0.0.1:${server.address().port}`;
  const browser=await launchBrowser();
  try {
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});context.setDefaultTimeout(12000);
    const expiry=Math.floor(Date.now()/1000)+3600;
    const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:expiry,role:'authenticated'})).toString('base64url'),'fixture'].join('.');
    await context.addInitScript(({origin,fixtures,user,expiry,token})=>{
      if(location.origin!==origin || localStorage.getItem('chooser-fixture-seeded'))return;
      localStorage.setItem('chooser-fixture-seeded','1');
      localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:expiry,expires_in:3600,token_type:'bearer',user}));
      localStorage.setItem('domesticTravelExpensePlanner.trips.v2',JSON.stringify(fixtures));
      localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2','current');
    },{origin,fixtures,user,expiry,token});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.auth==='signed-in');
    const open=()=>page.locator('#rdOverviewTripButton').click();
    const close=()=>page.locator('#rdTripChooser .rd-dialog-head [data-rd-action="close"]').click();
    const remove=id=>page.locator(`#rdTripChooser .rd-trip-delete[data-id="${id}"]`);
    const accept=()=>page.locator('#rdConfirm [data-rd-action="confirm-accept"]').click();
    const snapshot=id=>page.evaluate(id=>window.TripLogSyncRepository.cached(id)?.snapshot,id);
    const waitRemoved=id=>page.waitForFunction(id=>window.TripLogSyncRepository.cached(id)?.hidden&&!window.TripLog.persistence.stateStorage.getTrips().some(trip=>trip.id===id),id);
    await page.goto(`${origin}/Travel?page=overview&trip=current`);await ready();
    assert.equal(await page.title(),'여행 가계부');assert.match(page.url(),/page=overview/);
    await open();assert.equal(await page.locator('.rd-trip-choice').count(),5);
    const dimensions=[];
    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:width>600?1000:844});
      await page.locator('#rdTripChooser').screenshot({path:path.join(output,`chooser-${width}.png`),animations:'disabled'});
      const metrics=await page.locator('#rdTripChooser').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.getBoundingClientRect().height,viewport:innerHeight}));
      assert(metrics.scroll<=metrics.width+1&&metrics.height<=metrics.viewport,'Chooser fits viewport');
      assert.equal(await page.locator('button button').count(),0,'Selection and deletion must be separate buttons');
      for(const button of await page.locator('.rd-trip-delete').all()) {
        const box=await button.boundingBox();assert(box.width>=36&&box.height>=36,`Compact touch target remains usable: ${JSON.stringify({width,box})}`);
        const layout=await button.evaluate(el=>{const row=el.closest('.rd-trip-choice'),radio=row.querySelector('.rd-trip-choice-select>.ph').getBoundingClientRect(),trash=el.getBoundingClientRect();return {radioBottom:radio.bottom,trashTop:trash.top,rowWidth:row.clientWidth,scrollWidth:row.scrollWidth};});
        assert(layout.radioBottom<layout.trashTop,'Trash is below the selection indicator');assert(layout.scrollWidth<=layout.rowWidth+1);
      }
      dimensions.push({width,...metrics});
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('.rd-trip-choice-select[data-id="spare-two"]').click();
    await page.waitForFunction(()=>state.id==='spare-two');await page.locator('#rdTripChooser').waitFor({state:'hidden'});
    await open();await page.locator('.rd-trip-choice-select[data-id="current"]').click();
    await page.waitForFunction(()=>state.id==='current');await open();
    await page.locator('#rdTripSearch').fill('새 여행');assert.equal(await page.locator('.rd-trip-choice').count(),2);
    const before=await snapshot('spare-one');
    await remove('spare-one').press('Enter');
    assert.equal(await page.locator('#rdConfirmSubject').textContent(),'새 여행');
    assert.equal(await page.evaluate(()=>state.id),'current','Trash never selects the trip');
    await page.locator('#rdConfirmCancel').click();
    await remove('spare-one').waitFor({state:'visible'});
    assert.equal(await page.locator('#rdTripSearch').inputValue(),'새 여행');
    assert.equal(await page.evaluate(()=>window.TripLog.persistence.stateStorage.getTrips().length),5,'Cancel preserves every trip');
    await remove('spare-one').click();await accept();await waitRemoved('spare-one');
    assert.equal(await page.locator('#rdTripSearch').inputValue(),'새 여행');assert.equal(await page.locator('.rd-trip-choice').count(),1,'Search results update after deletion');
    assert.equal(await page.evaluate(()=>state.id),'current');
    assert.deepEqual((await snapshot('spare-one')).entries,[],'Deleted expense content is purged');
    assert.deepEqual((await snapshot('spare-one')).itineraryItems,[],'Deleted itinerary content is purged');
    assert.equal(await page.evaluate(()=>!!TripLogSyncRepository.cached('spare-one').removedAt),true);
    await page.reload();await ready();await page.waitForFunction(()=>state.id==='current');
    await open();assert.equal(await page.locator('.rd-trip-choice').count(),4,'Deletion survives reload');assert.equal(await remove('spare-one').count(),0);
    // Isolated server boundary mocks supplement the real SQL-backed removal suite.
    await page.evaluate(async user=>{
      window.__removalCalls=[];window.__removalFailure=false;
      window.TripLog.sync.controller.engine.removeTrip=async id=>{
        window.__removalCalls.push(id);if(window.__removalFailure)throw new Error('Offline fixture');
        await TripLogSyncRepository.removeTrip(id,{accountId:user.id});
        return {removed:true,serverDeleted:false,remainingMembers:1};
      };
      await TripLogSyncRepository.update('shared',r=>({...r,serverId:'fixture-shared',role:'owner',accountId:user.id}));
    },user);
    await remove('shared').click();assert.match(await page.locator('#rdConfirmMessage').textContent(),/동행이 남아/);
    await page.evaluate(()=>TripLogSyncRepository.update('shared',r=>({...r,role:'editor'})));await accept();
    await page.waitForFunction(()=>document.querySelector('#rdTripChooserList')?.getAttribute('aria-busy')==='false');
    assert.equal(await remove('shared').count(),1);assert.equal(await page.evaluate(()=>window.__removalCalls.length),0,'Changed sharing scope must be confirmed again');
    await page.evaluate(async()=>{await TripLogSyncRepository.update('shared',r=>({...r,role:'owner'}));window.__removalFailure=true;});
    await remove('shared').click();await accept();
    await page.waitForFunction(()=>document.querySelector('#rdTripChooserList')?.getAttribute('aria-busy')==='false');
    assert.equal(await page.evaluate(()=>!!TripLogSyncRepository.cached('shared').hidden),false,'Failed removal keeps the trip visible');
    assert(await remove('shared').isEnabled());
    await page.evaluate(()=>{window.__removalFailure=false;});await remove('shared').click();await accept();await waitRemoved('shared');
    assert.deepEqual(await page.evaluate(()=>window.__removalCalls),['shared','shared']);
    await page.evaluate(()=>TripLogSyncRepository.update('jeju',r=>({...r,serverId:'fixture-member',role:'editor'})));
    await remove('jeju').click();assert.match(await page.locator('#rdConfirmMessage').textContent(),/마지막 멤버/);await accept();await waitRemoved('jeju');
    assert.equal(await page.evaluate(()=>window.__removalCalls.length),3,'Members use the same server removal boundary');
    await remove('current').click();await accept();await waitRemoved('current');
    await page.locator('#rdTripChooser').waitFor({state:'hidden'});
    assert.notEqual(await page.evaluate(()=>state.id),'current','Deleting the active trip switches to another saved trip');
    await open();assert.equal(await page.locator('.rd-trip-choice').count(),1);
    assert.equal(await page.locator('.rd-trip-delete').isEnabled(),true,'The last trip can also be deleted');
    // Ordinary selection still works; deleting the final row returns to the empty library.
    await page.locator('.rd-trip-choice-select').click();await page.locator('#rdTripChooser').waitFor({state:'hidden'});
    const finalId=await page.evaluate(()=>state.id);await open();
    await remove(finalId).click();await accept();await waitRemoved(finalId);
    await page.waitForFunction(()=>activePage==='start'&&document.querySelectorAll('[data-library-trip]').length===0);
    assert(await page.locator('#tripLibraryEmpty').isVisible());
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({dimensions,errors},null,2));
    console.log('PASS trip chooser: compact mockup at 320/390/1440, separate selection/trash, named confirmation/cancel, filtered deletion/reload/content purge, owner/member scope, failed removal, changed sharing scope, active switch and final-trip empty state. '+output);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
