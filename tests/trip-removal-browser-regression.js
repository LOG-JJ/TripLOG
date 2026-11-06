// Browser plugin unavailable: Playwright/Edge and a local SQL-backed API fixture.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../src/app/sync/model');
const {startCliFixture}=require('./helpers/cli-fixture');
const {artifactDirectory}=require('../scripts/helpers/artifact-output');
const {launchBrowser,startServer,stopServer,seedTrip,waitForApp}=require('./helpers/browser-fixture');
const output=artifactDirectory('trip-removal');
async function main(){
 const fixture=await startCliFixture(),{server,origin}=await startServer(),browser=await launchBrowser();
 const source={id:'remove-browser-shared',tripName:'동행과 함께 쓰는 여행',country:'대한민국',countryCode:'KR',city:'서울',travelMode:'domestic',startDate:'2026-10-26',endDate:'2026-10-28',itineraryItems:[{id:'stop',date:'2026-10-26',time:'10:00',place:'유지할 장소'}],entries:[{id:'cost',date:'2026-10-26',description:'유지할 지출',amount:1000}],packingList:[],companions:[]};
 const tid=await fixture.call('triplog_create_sync',[fixture.actors[0],source.id,source,Object.values(M.encode(source))]);
 await fixture.db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'editor','accepted')",[tid,fixture.actors[1]]);
 const contexts=[],errors=[];
 async function pageFor(actor,seed=source){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},hasTouch:true,timezoneId:'Asia/Seoul'});contexts.push(context);
  context.setDefaultTimeout(15000);
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const user={id:actor,email:'removal@example.test',user_metadata:{display_name:'검증 사용자'}};
  await seedTrip(context,{origin,user,expiry:Math.floor(Date.now()/1000)+3600,seed});
  const sdk=`window.supabase={createClient(){return {auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:{user:${JSON.stringify(user)}}},error:null};},async stopAutoRefresh(){}},functions:{async invoke(name,{body}){try{const r=await fetch('/__removal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();return r.ok?{data,error:null}:{data:null,error:{context:{status:r.status,json:async()=>data}}};}catch(_){return {error:{context:{json:async()=>({code:'NETWORK_ERROR'})}}};}}},channel(){return {on(){return this;},subscribe(){return this;},track(){},presenceState(){return {};}};},removeChannel(){}};}};`;
  await context.route('**/vendor/supabase-js-2.107.0.min.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:sdk}));
  await context.route('**/__removal',async route=>{
   try{const response=await route.fetch({url:fixture.origin+'/functions/v1/triplog-sync',headers:{'Content-Type':'application/json',Authorization:'Bearer '+actor},maxRetries:0});await route.fulfill({response});}
   catch(_){await route.abort();}
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/Travel?page=start');await waitForApp(page);
  await page.waitForFunction(()=>window.TripLog.features.collaboration.tripCollaboration.isTripListReady());
  return page;
 }
 try{
  const owner=await pageFor(fixture.actors[0]),sameAccount=await pageFor(fixture.actors[0]),peer=await pageFor(fixture.actors[1]);
  for(const page of [owner,sameAccount,peer])await page.waitForFunction(id=>TripLogSyncRepository.cached(id)?.serverId,source.id);
  const remove=page=>page.locator(`[data-library-remove="${source.id}"]`);
  const confirm=page=>page.locator('#rdConfirm');
  await remove(owner).click();await confirm(owner).waitFor();
  assert.equal(await owner.locator('#rdConfirmTitle').innerText(),'여행을 삭제할까요?');
  assert.equal(await owner.locator('#rdConfirmAccept').innerText(),'삭제');
  assert.match(await owner.locator('#rdConfirmMessage').innerText(),/동행이 남아/);
  await owner.locator('#rdConfirmCancel').click();
  assert.equal(fixture.requests.filter(r=>r.action==='remove-trip').length,0);
  fixture.dropNextRemoval();await remove(owner).click();await owner.locator('#rdConfirmAccept').click();
  await owner.waitForFunction(()=>document.body.textContent.includes('삭제 결과를 확인하지 못했어요'));
  assert(await remove(owner).isVisible(),'An uncertain response keeps the row and retry available');
  await peer.evaluate(()=>TripLog.sync.controller.engine.refresh());
  assert.equal((await fixture.db.query('select owner_id,archived_at from public.triplog_trips where id=$1',[tid])).rows[0].owner_id,fixture.actors[1]);
  assert.equal(await peer.evaluate(()=>state.itineraryItems[0].place),'유지할 장소');
  await remove(owner).click();await remove(owner).waitFor({state:'detached'});
  assert.equal(await confirm(owner).isVisible(),false,'A retry reuses the confirmed intent');
  const requests=fixture.requests.filter(r=>r.action==='remove-trip');assert.equal(requests.length,2);assert.equal(requests[0].operationId,requests[1].operationId);
  assert.equal(await owner.locator('[data-library-trip]').count(),0,'The last trip in my own list can be removed');
  assert(await owner.locator('#tripLibraryEmpty').isVisible());
  await sameAccount.evaluate(()=>TripLog.sync.controller.engine.refresh());
  await sameAccount.waitForFunction(()=>document.querySelectorAll('[data-library-trip]').length===0);
  await owner.reload();await waitForApp(owner);assert.equal(await owner.locator('[data-library-trip]').count(),0);
  await peer.locator('[data-library-view="list"]').click();await peer.setViewportSize({width:320,height:740});
  assert(await remove(peer).isEnabled());await remove(peer).click();await confirm(peer).waitFor();
  await confirm(peer).screenshot({path:path.join(output,'last-member-delete-320.png')});
  await peer.locator('#rdConfirmAccept').click();await remove(peer).waitFor({state:'detached'});
  assert.equal((await fixture.db.query('select count(*)::int n from public.triplog_trips where id=$1',[tid])).rows[0].n,0);
  assert.equal((await fixture.db.query('select count(*)::int n from public.triplog_entities where trip_id=$1',[tid])).rows[0].n,0);
  await peer.screenshot({path:path.join(output,'empty-after-last-delete-320.png')});
  const local=await pageFor(fixture.actors[3],{...source,id:'local-only',tripName:'기기에만 있는 여행',entries:[],itineraryItems:[]});
  await local.locator('[data-library-remove="local-only"]').click();await local.locator('#rdConfirmAccept').click();
  await local.locator('[data-library-remove="local-only"]').waitFor({state:'detached'});
  assert.equal(await local.locator('[data-library-trip]').count(),0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,flow:'delete -> leave and retain companions -> delete last member on server',lostResponseRetry:true,lastLocalTrip:true,otherDevice:true,serverId:tid,errors},null,2));
  console.log('PASS trip removal browser: delete/cancel, SQL-backed companion preservation and ownership transfer, lost-response retry, same-account devices, reload, final-member server purge, local-only final trip and 320/390px empty states. '+output);
 }finally{for(const context of contexts)await context.close();await browser.close();await stopServer(server);await fixture.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
