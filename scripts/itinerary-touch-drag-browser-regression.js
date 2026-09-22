// Browser plugin not available. Isolated Edge/Chrome touch context; all external
// requests are blocked so production verification never edits a real trip.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright'),{createServer}=require('./serve-test');
const output=process.env.TRIPLOG_UI_SNAPSHOT_DIR||path.join(require('node:os').tmpdir(),'TripLOG-Touch-Drag-20260920');
async function main(){
 fs.mkdirSync(output,{recursive:true});const server=createServer({pagesRedirects:true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=process.env.TRIPLOG_TEST_URL||`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 let page;
 try{
  const record=!!process.env.TRIPLOG_RECORD_DEMO;
  const context=await browser.newContext({serviceWorkers:'block',hasTouch:true,isMobile:true,viewport:{width:390,height:844},deviceScaleFactor:1,
   ...(record?{recordVideo:{dir:output,size:{width:390,height:844}}}:{})});context.setDefaultTimeout(15000);
  const user={id:'00000000-0000-4000-8000-000000000099',email:'touch@example.test',user_metadata:{display_name:'터치 시험'}};
  const expiry=Math.floor(Date.now()/1000)+3600;
  const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:expiry,role:'authenticated'})).toString('base64url'),'fixture'].join('.');
  const seed={id:'touch-fixture',tripName:'교토 여행',city:'교토',country:'일본',travelMode:'overseas',startDate:'2026-09-26',endDate:'2026-09-28',entries:[],companions:[],packingList:[],itineraryItems:['A','B','C','D'].map((id,i)=>({id,date:'2026-09-26',place:['교토역','텐류지','니시키 시장','교토 호텔'][i],theme:i===3?'lodging':'sightseeing',time:`${10+i}:00`,endTime:i===3?'':`${10+i}:30`,memo:`메모 ${id}`,createdAt:i}))};
  await context.addInitScript(({origin,user,expiry,token,seed})=>{
   if(location.origin!==origin||localStorage.getItem('touch-seed'))return;
   localStorage.setItem('touch-seed','1');localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:expiry,expires_in:3600,user}));
   localStorage.setItem('domesticTravelExpensePlanner.trips.v2',JSON.stringify([seed]));localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2',seed.id);
  },{origin,user,expiry,token,seed});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const cdp=await context.newCDPSession(page);
  const touch=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y])=>({x,y}))});
  const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const row=id=>page.locator(`#itineraryList > .timeline-stop[data-id="${id}"]`);
  const handle=id=>row(id).locator('.timeline-drag-handle');
  const order=()=>page.locator('#itineraryList > .timeline-stop').evaluateAll(nodes=>nodes.map(node=>node.dataset.id));
  const revision=()=>page.evaluate(()=>window.TripLogSyncRepository.cached(state.id).localRevision);
  async function ready(){
   await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.auth==='signed-in');
   await page.evaluate(()=>setActivePage('itinerary'));
   await page.waitForFunction(()=>{const handle=document.querySelector('#itineraryList .timeline-drag-handle');return handle&&getComputedStyle(handle).touchAction==='none';});
  }
  await page.goto(origin+'/Travel?page=itinerary');await ready();
  await page.evaluate(()=>{
   window.__pickupMs=[];
   document.querySelector('#itineraryList').addEventListener('pointerdown',event=>{
    if(event.target.closest('.timeline-drag-handle'))window.__pickupStarted=performance.now();
   },true);
   document.querySelector('#itineraryList').addEventListener('pointerdown',event=>{
    if(event.target.closest('.timeline-drag-handle'))window.__pickupMs.push({delay:performance.now()-window.__pickupStarted,picked:document.body.classList.contains('itinerary-pointer-dragging')});
   });
  });
  const controls=await page.evaluate(()=>{const row=document.querySelector('#itineraryList .timeline-stop[data-id="B"]');return {touchAction:getComputedStyle(row.querySelector('.timeline-drag-handle')).touchAction,draggable:row.draggable};});
  assert.equal(controls.touchAction,'none');
  assert.equal(controls.draggable,false,'Touch must not wait for native HTML drag');
  const initial=await page.evaluate(()=>state.itineraryItems.map(({_syncPosition,...item})=>item));
  if(!record){
  const body=await row('A').locator('.timeline-stop-detail').boundingBox();
  await touch('touchStart',[[body.x+35,body.y+10]]);
  for(let i=1;i<=7;i++){await touch('touchMove',[[body.x+35,body.y+10-i*16]]);await frame();}
  await touch('touchEnd');await frame();
  assert(await page.evaluate(()=>scrollY)>30,'Dragging card text keeps native page scroll');
  assert.equal(await page.locator('.itinerary-touch-ghost').count(),0);
  await page.evaluate(()=>scrollTo(0,0));await frame();
  }
  let pickupRect;
  async function pickup(id){
   await handle(id).scrollIntoViewIfNeeded();await frame();const box=await handle(id).boundingBox();
   const point=[box.x+box.width/2,box.y+box.height/2];
   await touch('touchStart',[point]);
   assert.equal(await page.locator('.itinerary-touch-ghost').count(),1,'Pickup is synchronous, with no hold timer');
   pickupRect=await page.locator('.itinerary-touch-ghost').boundingBox();
   return point;
  }
  if(record)await page.waitForTimeout(600);
  const before=await revision();const start=await pickup('B');
  if(record)await page.waitForTimeout(180);
  assert.deepEqual(await order(),['A','B','C','D']);assert.equal(await revision(),before);
  const destination=await row('C').boundingBox(),end=[start[0],destination.y+destination.height*.7];
  const steps=record?20:10;
  for(let i=1;i<=steps;i++){await touch('touchMove',[[start[0],start[1]+(end[1]-start[1])*i/steps]]);await frame();if(record)await page.waitForTimeout(22);}
  await page.waitForFunction(()=>document.querySelector('#itineraryList').dataset.dragPreviewOrder==='A,C,B,D');
  assert.equal(await revision(),before,'Preview must not save or sync before release');
  const following=await page.locator('.itinerary-touch-ghost').boundingBox();
  assert(Math.abs(following.y-pickupRect.y-(end[1]-start[1]))<2,'Card follows the finger without an easing delay');
  const pickupSamples=await page.evaluate(()=>window.__pickupMs);
  assert(pickupSamples.every(sample=>sample.picked&&sample.delay<100),JSON.stringify(pickupSamples));
  await page.screenshot({path:path.join(output,'mobile-drag-preview.png')});
  const stable=await page.evaluate(()=>new Promise(resolve=>{const positions=[];const end=performance.now()+240;function tick(){positions.push(document.querySelector('#itineraryList').dataset.dragPreviewOrder);if(performance.now()<end)requestAnimationFrame(tick);else resolve([...new Set(positions)]);}tick();}));
  assert.deepEqual(stable,['A,C,B,D'],'Stationary touch must not oscillate between slots');
  if(record)await page.waitForTimeout(250);
  await touch('touchEnd');
  await page.waitForFunction(()=>!itineraryReorderPending&&getFilteredItineraryItems().map(item=>item.id).join('')==='ACBD');
  assert.equal(await page.locator('.itinerary-touch-ghost,.timeline-drag-placeholder,.timeline-drag-capture').count(),0);
  assert.deepEqual(await page.evaluate(()=>state.itineraryItems.map(({_syncPosition,itineraryOrder,...item})=>item)),initial);
  await page.screenshot({path:path.join(output,'mobile-drag-dropped.png'),animations:'disabled'});
  if(record){await page.waitForTimeout(900);console.log('Recorded real touch reorder demo.');return;}
  await page.reload();await ready();assert.deepEqual(await order(),['A','C','B','D']);
  const cancelRevision=await revision();
  await pickup('B');await touch('touchCancel');await frame();assert.deepEqual(await order(),['A','C','B','D']);
  await pickup('B');await page.keyboard.press('Escape');await touch('touchEnd');await frame();assert.deepEqual(await order(),['A','C','B','D']);
  await pickup('B');await page.evaluate(()=>renderItineraryPage());await touch('touchEnd');await frame();
  assert.equal(await page.locator('.itinerary-touch-ghost,.timeline-drag-placeholder').count(),0);assert.equal(await revision(),cancelRevision);
  await pickup('B');await page.setViewportSize({width:390,height:800});await frame();
  assert.equal(await page.locator('.itinerary-touch-ghost').count(),1,'Height-only viewport changes must not cancel the touch');
  await page.setViewportSize({width:400,height:800});await frame();
  assert.equal(await page.locator('.itinerary-touch-ghost').count(),0,'Width changes invalidate the measured slots');
  await touch('touchEnd');await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo(0,0));await frame();const edgeStart=await pickup('A');
  const scrollBefore=await page.evaluate(()=>scrollY);
  await touch('touchMove',[[edgeStart[0],730]]);
  await page.waitForFunction(previous=>scrollY>previous+35,scrollBefore);
  await touch('touchCancel');await frame();assert.equal(await revision(),cancelRevision);
  await page.emulateMedia({reducedMotion:'reduce'});await pickup('B');
  assert.equal(await page.locator('.itinerary-touch-ghost').evaluate(node=>node.getAnimations({subtree:true}).some(animation=>animation.playState==='running')),false);
  await touch('touchCancel');await page.emulateMedia({reducedMotion:'no-preference'});
  await handle('B').focus();await page.keyboard.press('Alt+ArrowUp');
  await page.waitForFunction(()=>!itineraryReorderPending&&getFilteredItineraryItems().map(item=>item.id).join('')==='ABCD');
  await page.locator('#itineraryViewAllButton').click();assert.equal(await page.locator('#itineraryList .timeline-drag-handle').count(),0);
  await page.locator('#itineraryViewAllButton').click();await page.setViewportSize({width:320,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(output,'mobile-drag-320.png'),animations:'disabled'});
  assert.deepEqual(errors,[]);
  console.log(`PASS touch: pickup ${pickupSamples.map(sample=>sample.delay.toFixed(1)).join('/')}ms in this run, no hold, native body scroll, preview without writes, stable slot, release/reload, unchanged content, cancel/Escape/rerender, viewport changes, edge scroll, reduced motion, keyboard and 320px layout.`);
 }catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
