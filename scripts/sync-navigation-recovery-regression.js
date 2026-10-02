const assert = require('node:assert/strict');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {createServer} = require('./serve-test');
// Match the previous production worker, including its redirected cached HTML.
const legacyWorker = `
const CACHE='triplog-shell-broken-navigation-fixture';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.add('/Travel.html'))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'&&['/','/Travel','/Travel.html','/index.html'].includes(new URL(e.request.url).pathname))e.respondWith(caches.open(CACHE).then(c=>c.match('/Travel.html')));});`;
async function main(){
  let fixed=false;
  const files=createServer({pagesRedirects:true});
  const server=http.createServer((req,res)=>{
    if(req.url==='/sw.js'&&!fixed){res.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'}).end(legacyWorker);return;}
    files.emit('request',req,res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
  try{
    const context=await browser.newContext();context.setDefaultTimeout(20000);
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();
    await page.goto(origin+'/Travel');
    await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&Boolean(navigator.serviceWorker.controller));
    const before=await page.evaluate(async()=>{
      const R=window.TripLogSyncRepository;
      localStorage.setItem('triplog-repair-fixture','preserve-local-data');
      const snapshot={id:'navigation-repair-fixture',tripName:'접속 복구 시험 여행',itineraryItems:[{id:'item',date:'2026-09-26',place:'보관할 일정'}],entries:[],packingList:[],companions:[]};
      await R.update(snapshot.id,()=>({...R.makeRecord(snapshot),queue:[{id:'untransmitted-fixture',patches:[],status:'queued',dependsOn:[]}]}));
      await R.draft('navigation-repair-draft',{tripId:snapshot.id,text:'아직 전송하지 않은 초안'});
      return {record:await R.read(snapshot.id),draft:await R.draft('navigation-repair-draft')};
    });
    await assert.rejects(page.reload(),/ERR_FAILED/,'The old redirected-response cache must reproduce the reported outage');
    await page.waitForFunction(()=>document.documentURI.startsWith('chrome-error://'));
    fixed=true;
    await page.goto(origin+'/repair');
    await page.waitForURL('**/Travel?page=start');
    await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true');
    const after=await page.evaluate(async()=>({record:await window.TripLogSyncRepository.read('navigation-repair-fixture'),draft:await window.TripLogSyncRepository.draft('navigation-repair-draft'),local:localStorage.getItem('triplog-repair-fixture')}));
    assert.deepEqual(after.record,before.record);assert.deepEqual(after.draft,before.draft);assert.equal(after.local,'preserve-local-data');
    for(const route of ['/','/Travel?page=itinerary','/Travel.html','/index.html']){
      await page.goto(origin+route);await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true');
      await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true');
    }
    assert.equal(await page.evaluate(async()=>{const names=(await caches.keys()).filter(n=>n.startsWith('triplog-shell-'));return (await (await caches.open(names[0])).match('/Travel.html')).redirected;}),false);
    console.log('PASS navigation recovery: reproduce ERR_FAILED with Pages 308, repair existing worker, preserve trip/queue/draft/localStorage, and reload all four entry routes.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
