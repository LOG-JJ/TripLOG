// Browser plugin not available. Real mouse DnD in isolated Playwright/Edge.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const {createServer}=require(path.join(root,'scripts/serve-test'));
const output=process.env.TRIPLOG_UI_SNAPSHOT_DIR||path.join(require('node:os').tmpdir(),'TripLOG-Drag-Preview');
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const server=createServer({pagesRedirects:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=process.env.TRIPLOG_TEST_URL||`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 let activePage;
 try{
  const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'no-preference',viewport:{width:1440,height:1200}});context.setDefaultTimeout(15000);
  const user={id:'00000000-0000-4000-8000-000000000099',email:'order@example.test',user_metadata:{display_name:'순서 시험'}};
  const expiry=Math.floor(Date.now()/1000)+3600;
  const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:expiry,role:'authenticated'})).toString('base64url'),'fixture'].join('.');
  const seed={id:'order-fixture',tripName:'교토 순서 시험 여행',city:'교토',country:'일본',travelMode:'overseas',startDate:'2026-09-26',endDate:'2026-09-28',entries:[],companions:[],packingList:[],itineraryItems:['A','B','C','D'].map((id,i)=>({id,date:'2026-09-26',place:['교토역','텐류지','니시키 시장','교토 호텔'][i],theme:i===3?'lodging':'sightseeing',time:`${10+i}:00`,endTime:i===3?'':`${10+i}:30`,memo:`메모 ${id}`,createdAt:i}))};
  await context.addInitScript(({origin,user,expiry,token,seed})=>{
   if(location.origin!==origin||localStorage.getItem('order-seed'))return;
   localStorage.setItem('order-seed','1');localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:expiry,expires_in:3600,user}));
   localStorage.setItem('domesticTravelExpensePlanner.trips.v2',JSON.stringify([seed]));localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2',seed.id);
  },{origin,user,expiry,token,seed});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];activePage=page;page.on('pageerror',error=>errors.push(error.message));
  async function ready(){await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&document.documentElement.dataset.auth==='signed-in'&&document.documentElement.dataset.appReady==='true');await page.evaluate(()=>setActivePage('itinerary'));await page.locator('#itineraryPage').waitFor({state:'visible'});}
  const row=id=>page.locator(`.timeline-stop[data-id="${id}"]`);
  const order=()=>page.locator('#itineraryList .timeline-stop').evaluateAll(rows=>rows.map(row=>row.dataset.id));
  async function drag(id,target,placement,expected,screenshot=false){

   const beforeRevision=await page.evaluate(()=>window.TripLogSyncRepository.cached(state.id).localRevision);
   await row(target).scrollIntoViewIfNeeded();const source=await row(id).boundingBox(),dest=await row(target).boundingBox();
   assert(source&&dest);
   await page.mouse.move(source.x+source.width-8,source.y+source.height*.65);await page.mouse.down();
   let activationTimer;try{await Promise.race([page.mouse.move(source.x+source.width-18,source.y+source.height*.65+10,{steps:4}),new Promise((_,reject)=>{activationTimer=setTimeout(()=>reject(new Error('Drag activation timed out')),10000);})]);}finally{clearTimeout(activationTimer);}
   await page.mouse.move(dest.x+dest.width-8,dest.y+dest.height*(placement==='before'?.2:.8),{steps:16});

   await page.waitForFunction(expected=>document.querySelector('#itineraryList').dataset.dragPreviewOrder===expected,expected.join(','));
   if(screenshot){
    assert.equal(await page.locator('.timeline-drag-placeholder').count(),1);
    assert.deepEqual(await page.evaluate(()=>getFilteredItineraryItems().map(i=>i.id)),['A','B','C','D']);
    assert.equal(await page.evaluate(()=>window.TripLogSyncRepository.cached(state.id).localRevision),beforeRevision);
    assert.equal(await page.locator('.is-dragging').evaluate(node=>getComputedStyle(node).opacity),'0');
    await page.waitForFunction(()=>window.__dragMotion.includes('transform'));
    const running=await page.evaluate(()=>window.__dragMotion.includes('transform'));
    assert.equal(running,true,'Neighbor cards must animate while opening the preview slot');
    const samples=await page.evaluate(()=>new Promise(resolve=>{const seen=[];const end=performance.now()+350;function frame(){seen.push(document.querySelector('#itineraryList').dataset.dragPreviewOrder);if(performance.now()<end)setTimeout(frame,35);else resolve([...new Set(seen)]);}frame();}));
    assert.deepEqual(samples,[expected.join(',')],'A stationary pointer must not make the preview alternate between positions');
    assert((await row('B').boundingBox()).y>dest.y+30,'Neighbor shifts down to make room');
    await page.screenshot({path:path.join(output,'live-preview-desktop.png'),animations:'disabled',timeout:5000});
   }
   await page.mouse.up();
   await page.waitForFunction(expected=>!itineraryReorderPending&&getFilteredItineraryItems().map(i=>i.id).join('')===expected,expected.join(''));
   assert.deepEqual(await order(),expected);
   assert.equal(await page.locator('.is-drop-before,.is-drop-after,.is-dragging,.timeline-drag-placeholder,.timeline-drag-capture,.itinerary-drag-image').count(),0);
  }
  await page.goto(origin+'/Travel?page=itinerary');await ready();assert.match(await page.title(),/TripLOG|여행/);
  await page.evaluate(()=>{window.__dragMotion=[];document.querySelector('#itineraryList').addEventListener('transitionrun',event=>window.__dragMotion.push(event.propertyName));});
  assert.deepEqual(await order(),['A','B','C','D']);
  const before=await page.evaluate(()=>state.itineraryItems.map(({_syncPosition,...item})=>item));
  await drag('D','B','before',['A','D','B','C'],true);
  assert.deepEqual(await page.evaluate(()=>state.itineraryItems.map(({_syncPosition,itineraryOrder,...item})=>item)),before);
  await page.screenshot({path:path.join(output,'inserted-order-desktop.png'),animations:'disabled'});
  await drag('A','B','after',['D','B','A','C']);
  await drag('C','D','before',['C','D','B','A']);
  await drag('C','A','after',['D','B','A','C']);
  await page.waitForFunction(()=>![...document.querySelector('#itineraryList').children].some(node=>node.getAnimations().some(animation=>animation.playState==='running')));await row('A').focus();await page.keyboard.press('Alt+ArrowUp');
  await page.waitForFunction(()=>!itineraryReorderPending&&getFilteredItineraryItems().map(i=>i.id).join('')==='DABC');
  assert.deepEqual(await order(),['D','A','B','C']);
  await page.reload();await ready();assert.deepEqual(await order(),['D','A','B','C']);
  const cancelRevision=await page.evaluate(()=>window.TripLogSyncRepository.cached(state.id).localRevision);
  const startCancel=async()=>{
   await page.evaluate(()=>setActivePage('itinerary'));await row('C').waitFor({state:'visible'});
   const source=await row('C').boundingBox(),dest=await row('A').boundingBox();
   await page.mouse.move(source.x+source.width-8,source.y+source.height*.65);await page.mouse.down();
   await page.mouse.move(source.x+source.width-18,source.y+source.height*.65+10,{steps:4});
   await page.mouse.move(dest.x+dest.width-8,dest.y+dest.height*.2,{steps:16});
   await page.waitForFunction(()=>document.querySelector('#itineraryList').dataset.dragPreviewOrder==='D,C,A,B');
  };
  await startCancel();await page.keyboard.press('Escape');await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('.timeline-drag-placeholder'));
  assert.deepEqual(await order(),['D','A','B','C']);
  assert.equal(await page.evaluate(()=>window.TripLogSyncRepository.cached(state.id).localRevision),cancelRevision);
  await page.waitForFunction(()=>![...document.querySelector('#itineraryList').children].some(node=>node.getAnimations().some(animation=>animation.playState==='running')));
  await startCancel();await page.evaluate(()=>renderItineraryPage());await page.mouse.up();
  assert.equal(await page.locator('.timeline-drag-placeholder,.timeline-drag-capture,.itinerary-drag-image').count(),0);
  assert.deepEqual(await order(),['D','A','B','C']);
  assert.equal(await page.evaluate(()=>window.TripLogSyncRepository.cached(state.id).localRevision),cancelRevision);
  await startCancel();await page.mouse.move(20,200,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('.timeline-drag-placeholder'));
  assert.deepEqual(await order(),['D','A','B','C']);
  assert.equal(await page.evaluate(()=>window.TripLogSyncRepository.cached(state.id).localRevision),cancelRevision);
  console.log('PASS cancel: Escape, remote rerender and dropping outside restore the original order without writes.');
  await page.emulateMedia({reducedMotion:'reduce'});await startCancel();
  assert.equal(await page.locator('#itineraryList').evaluate(list=>[...list.children].some(node=>node.getAnimations().some(animation=>animation.playState==='running'))),false);
  await page.keyboard.press('Escape');await page.mouse.up();await page.emulateMedia({reducedMotion:'no-preference'});
  console.log('PASS accessibility: reduced-motion preference keeps placement preview without animated movement.');

  assert.deepEqual(await page.evaluate(()=>window.TripLog.features.itinerary.summary.buildModel().groups[0].items.map(i=>i.id)),['D','A','B','C']);
  assert.deepEqual(await page.evaluate(()=>getSortedItineraryItemsForPrint().map(i=>i.id)),['D','A','B','C']);
  assert.deepEqual(await page.evaluate(()=>window.TripLog.features.travelCompanion.model.dayItems(state,'2026-09-26').map(i=>i.id)),['D','A','B','C']);
  await page.locator('#itineraryMapButton').click();
  await page.getByRole('button',{name:'전체 동선',exact:true}).click();
  const route=new URL(await page.locator('#googleMapsLink').getAttribute('href'));
  assert.match(route.searchParams.get('origin'),/교토 호텔/);assert.match(route.searchParams.get('destination'),/니시키 시장/);
  assert.match(route.searchParams.get('waypoints'),/교토역.*텐류지/);
  await page.locator('#itineraryEditorClose').click();
  console.log('PASS preview: animated slot, stationary-pointer stability, no persistence before drop, cleanup, real mouse insertion before/after, first/last, indicator cleanup, keyboard movement, unchanged times/data, reload, summary, print, companion and route order.');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'inserted-order-mobile.png'),animations:'disabled'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const payload=await page.evaluateHandle(()=>{const d=new DataTransfer();d.setData('text/plain','A');d.setData('application/x-triplog-itinerary','A');return d;});
  await row('C').dispatchEvent('drop',{dataTransfer:payload});assert.deepEqual(await order(),['D','A','B','C']);
  await page.setViewportSize({width:1440,height:1200});
  await page.evaluate(()=>scrollTo(0,0));
  const grip=await row('C').locator('.timeline-drag-handle').boundingBox(),first=await row('D').boundingBox();
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
  assert.equal(await page.locator('.itinerary-touch-ghost').count(),1,'Mouse handle uses immediate pointer pickup too');
  await page.mouse.move(grip.x+grip.width/2,first.y+first.height*.2,{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>!itineraryReorderPending&&getFilteredItineraryItems().map(item=>item.id).join('')==='CDAB');
  assert.equal(await page.locator('.itinerary-touch-ghost').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS browser: mobile rendering, external drop ignored, no horizontal overflow or uncaught runtime errors.');
  console.log(JSON.stringify({origin,output}));
 }catch(error){console.error('TEST FAILED',error);throw error;}finally{await activePage?.keyboard.press('Escape').catch(()=>{});await activePage?.mouse.up().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
