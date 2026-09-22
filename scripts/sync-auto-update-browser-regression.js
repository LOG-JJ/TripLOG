// Real service workers and IndexedDB in an isolated Edge profile. The server
// changes its build while two tabs remain open; no user refresh/update action.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright');
const { createServer } = require('./serve-test');
const builds = ['a'.repeat(20), 'b'.repeat(20), 'c'.repeat(20)];
const actor = '00000000-0000-4000-8000-000000000001';
const assets = JSON.parse(fs.readFileSync('sw.js','utf8').match(/const ASSETS = (\[[^;]+\]);/)[1]);
const worker = fs.readFileSync('scripts/service-worker-template.js','utf8');
const html = fs.readFileSync('Travel.html','utf8');
const lifecycle = fs.readFileSync('src/app/sync/lifecycle.js','utf8');
const authFixture = `window.supabase = {
  createClient() {
    return {
      auth: {
        onAuthStateChange() { return {data:{subscription:{unsubscribe(){}}}}; },
        async getSession() { return {data:{session:{user:{id:'${actor}',email:'update@example.test',user_metadata:{display_name:'자동 갱신 시험'}}}},error:null}; }
      },
      functions: { async invoke() { return {error:{context:{status:503,json:async()=>({code:'NETWORK_ERROR'})}}}; } }
    };
  }
};`;
new (require('node:vm').Script)(authFixture);
async function main() {
  let version = 0, failAsset = false;
  const files = createServer({pagesRedirects:true});
  const server = http.createServer((req,res) => {
    const url = new URL(req.url,'http://localhost');
    const build = builds[version];
    const send = (type, body) => res.writeHead(200,{'content-type':type,'cache-control':'no-store'}).end(body);
    if (url.pathname === '/sw.js') return send('application/javascript', worker.replace('__CACHE_NAME__',JSON.stringify('triplog-shell-'+build)).replace('__BUILD_ID__',JSON.stringify(build)).replace('__ASSETS__',JSON.stringify(assets)));
    if (['/Travel','/Travel.html','/'].includes(url.pathname)) {
      if (url.pathname === '/Travel.html') return res.writeHead(308,{location:'/Travel'+url.search}).end();
      return send('text/html; charset=utf-8', html.replace(/(name="triplog-build" content=")[^"]+/, '$1'+build).replace(/\?v=[a-f0-9]{20}/g, '?v='+build));
    }
    if (url.pathname === '/vendor/supabase-js-2.107.0.min.js') return send('application/javascript',authFixture);
    if (url.pathname === '/src/app/sync/lifecycle.js') return send('application/javascript',lifecycle+'\nwindow.__releaseBuildFixture = '+JSON.stringify(build)+';');
    if (failAsset && url.pathname === '/src/app/sync/notes.js') return res.writeHead(503).end('fixture asset unavailable');
    files.emit('request',req,res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:'+server.address().port;
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || (process.platform==='win32'?'msedge':undefined),headless:true});
  const errors=[], pages=[];
  try {
    const context=await browser.newContext({viewport:{width:1280,height:900}});context.setDefaultTimeout(20000);
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await context.addInitScript(()=>{if(location.protocol.startsWith('http')){sessionStorage.setItem('fixture-boots',String(Number(sessionStorage.getItem('fixture-boots')||0)+1));}});
    const a=await context.newPage();pages.push(a);a.on('pageerror',e=>errors.push(e.message));
    await a.goto(origin+'/Travel?page=itinerary');
    await a.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&window.TripLog.sync.controller.engine.status().active&&!!navigator.serviceWorker.controller);
    const ids=await a.evaluate(async()=>{
      state.tripName='자동 갱신 시험';state.itineraryItems=[{id:'retained-item',date:state.startDate,time:'10:00',place:'보존할 일정',memo:'기존 내용'}];
      await saveAndRender();
      const R=window.TripLogSyncRepository,M=window.TripLogSyncModel;
      const operationId=crypto.randomUUID();
      await R.update(state.id,r=>({...r,serverId:'00000000-0000-4000-8000-000000000002',base:M.encode(r.snapshot),role:'owner',placeholder:false,
        queue:[{id:operationId,status:'queued',dependsOn:[],createdAt:Date.now(),patches:[{kind:'itinerary',id:'retained-item',action:'patch',fields:{'p:memo':'전송을 기다리는 내용'},before:{'p:memo':'기존 내용'},expectedFields:{'p:memo':0}}]}]}));
      return {tripId:state.id,operationId};
    });
    const b=await context.newPage();pages.push(b);b.on('pageerror',e=>errors.push(e.message));
    await b.goto(origin+'/Travel?page=itinerary');
    await b.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&window.TripLog.sync.controller.engine.status().active&&state.itineraryItems.some(i=>i.id==='retained-item'));
    await b.evaluate(()=>{setActivePage('itinerary');startItineraryEdit(state.itineraryItems.find(i=>i.id==='retained-item'));});
    await b.locator('#itineraryExtraDetails').evaluate(el=>el.open=true);
    await b.locator('#itineraryMemoInput').fill('업데이트 도중 작성한 한글 입력');
    await b.waitForFunction(()=>window.TripLog.sync.drafts.inMemory(state.id).every(r=>r.persisted));
    version=1;
    // Run the same check used by the automatic background timer, without waiting a minute.
    await a.evaluate(()=>window.TripLog.sync.lifecycle.checkForUpdate(true));
    await a.waitForFunction(expected=>document.querySelector('meta[name="triplog-build"]').content===expected&&document.documentElement.dataset.triplogInitialized==='true',builds[1]);
    await a.waitForFunction(id=>state.id===id,ids.tripId);
    assert.equal(await b.locator('meta[name="triplog-build"]').getAttribute('content'),builds[0]);
    assert.equal(await b.locator('#itineraryMemoInput').inputValue(),'업데이트 도중 작성한 한글 입력');
    assert.equal(await b.evaluate(()=>sessionStorage.getItem('fixture-boots')),'1');
    const pinned=await b.evaluate(async old=>(await (await fetch('/src/app/sync/lifecycle.js?v='+old)).text()).includes('window.__releaseBuildFixture = '+JSON.stringify(old)),builds[0]);
    assert(pinned,'The editing tab must retain its old modules while another tab uses the new build');
    const persisted=await a.evaluate(async id=>{const r=await window.TripLogSyncRepository.read(id);return {queue:r.queue.map(q=>q.id),items:r.snapshot.itineraryItems.length};},ids.tripId);
    assert(persisted.queue.includes(ids.operationId));assert.equal(persisted.items,1);
    assert.equal(await a.getByRole('button',{name:'새 버전 적용',exact:true}).count(),0);
    console.log('PASS automatic update: idle tab advances without a button/reload, open editor and Korean input stay intact, old modules stay pinned, pending command survives');

    await b.locator('#itinerarySubmitButton').click();
    await b.waitForFunction(expected=>document.querySelector('meta[name="triplog-build"]').content===expected&&document.documentElement.dataset.triplogInitialized==='true',builds[1]);
    await b.waitForFunction(()=>state.itineraryItems.find(i=>i.id==='retained-item')?.memo==='업데이트 도중 작성한 한글 입력');
    assert.equal(await b.evaluate(()=>sessionStorage.getItem('fixture-boots')),'2');
    assert.equal(new URL(b.url()).searchParams.get('page'),'itinerary');
    assert((await b.evaluate(async id=>(await window.TripLogSyncRepository.read(id)).queue.map(q=>q.id),ids.tripId)).includes(ids.operationId));
    console.log('PASS deferred update: normal save closes the editor, commits input first and then automatically advances with trip, route and outbox preserved');

    version=2;failAsset=true;
    await a.evaluate(()=>window.TripLog.sync.lifecycle.checkForUpdate(true));
    await a.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing;});
    assert.equal(await a.locator('meta[name="triplog-build"]').getAttribute('content'),builds[1]);
    assert.equal(await b.locator('meta[name="triplog-build"]').getAttribute('content'),builds[1]);
    console.log('PASS incomplete deployment: an asset download failure keeps the complete previous app and saved records');

    await a.evaluate(()=>window.TripLog.sync.controller.setLocalFailure(new Error('fixture storage unavailable')));
    failAsset=false;
    await b.evaluate(()=>window.TripLog.sync.lifecycle.checkForUpdate(true));
    await b.waitForFunction(expected=>document.querySelector('meta[name="triplog-build"]').content===expected&&document.documentElement.dataset.triplogInitialized==='true',builds[2]);
    assert.equal(await a.locator('meta[name="triplog-build"]').getAttribute('content'),builds[1]);
    await a.evaluate(()=>window.TripLog.sync.controller.setLocalFailure(null));
    await a.waitForFunction(expected=>document.querySelector('meta[name="triplog-build"]').content===expected&&document.documentElement.dataset.triplogInitialized==='true',builds[2]);
    const boots=await a.evaluate(()=>sessionStorage.getItem('fixture-boots'));
    await a.evaluate(()=>window.TripLog.sync.lifecycle.checkForUpdate(true));
    await a.waitForTimeout(2000);
    assert.equal(await a.evaluate(()=>sessionStorage.getItem('fixture-boots')),boots);
    console.log('PASS storage safety: update waits for a failed device save to recover, retries automatically and does not reload an already-current app');

    await context.setOffline(true);await b.reload();
    await b.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&state.itineraryItems.find(i=>i.id==='retained-item')?.memo==='업데이트 도중 작성한 한글 입력');
    assert.equal(await b.locator('meta[name="triplog-build"]').getAttribute('content'),builds[2]);
    assert((await b.evaluate(async id=>(await window.TripLogSyncRepository.read(id)).queue.map(q=>q.id),ids.tripId)).includes(ids.operationId));
    assert.deepEqual(errors,[]);
    console.log('PASS offline restart: automatically updated cached app opens without network, input and pending commands remain, no app runtime errors');
  } catch(error) {
    console.error({runtimeErrors:errors});
    for(const page of pages)console.error(await page.evaluate(()=>({build:document.querySelector('meta[name="triplog-build"]')?.content,initialized:document.documentElement.dataset.triplogInitialized,auth:document.documentElement.dataset.auth,trip:window.TripLog?.core.state.state.id,engine:window.TripLog?.sync.controller.engine.status(),openDialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),focused:document.activeElement?.id})).catch(()=>({closed:true})));
    throw error;
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
