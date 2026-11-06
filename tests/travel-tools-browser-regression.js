'use strict';
// Browser plugin is not available; use the project's isolated Playwright fixture.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchBrowser,waitForApp,stopServer,blockExternalRequests}=require('./helpers/browser-fixture');
const {artifactDirectory}=require('../scripts/helpers/artifact-output');
const {createExperiencePreview}=require('../scripts/preview-companion-experience');
async function main(){
  const out=artifactDirectory('travel-tools'),server=createExperiencePreview();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,browser=await launchBrowser(),errors=[];
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',acceptDownloads:true,reducedMotion:'reduce'});await blockExternalRequests(context,origin);
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${origin}/Travel?page=travel&travelTab=tools&trip=companion-experience-fixture`);await waitForApp(page);await page.locator('.ct-tools-grid').waitFor();
    const dialog=page.locator('#ctToolDialog'),open=async tool=>{await page.locator(`.ct-tools-grid [data-tool-action="${tool}"]`).click();await dialog.waitFor({state:'visible'});},close=async()=>{await dialog.locator('.ct-close').click();await dialog.waitFor({state:'hidden'});};
    const set=async(id,value)=>page.evaluate(({id,value})=>{const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));},{id,value});
    const fits=async()=>{const result=await dialog.evaluate(node=>({width:node.clientWidth,scroll:node.scrollWidth,left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right,viewport:innerWidth}));assert(result.scroll<=result.width+1);assert(result.left>=0&&result.right<=result.viewport);};
    assert.equal(await page.locator('.ct-tool').count(),7);await page.screenshot({path:path.join(out,'main-390.png')});
    await open('packing');await page.locator('[data-tt-packing="pack-3"]').check();await page.waitForFunction(()=>state.packingList.find(row=>row.id==='pack-3').checked);
    await page.locator('#ttPackingAdd input').fill('교통패스');await page.locator('#ttPackingAdd button').click();await page.waitForFunction(()=>state.packingList.some(row=>row.name==='교통패스'));await close();
    await open('timezone');await set('ctZone','Europe/London');await page.locator('#ctZoneSave').click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>state.travelCompanion.timeZone==='Europe/London');
    await open('calendar');await page.locator('[name=ctCalendarRange][value=day]').check();await set('ctCalendarDate','2026-11-03');
    const pending=page.waitForEvent('download');await page.locator('[data-tool-action=calendar-save]').click();const file=await pending,ics=fs.readFileSync(await file.path(),'utf8');assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,4);assert.match(ics,/BEGIN:VCALENDAR/);await close();
    await open('sun');await set('ctSunDate','2026-11-03');await page.waitForFunction(()=>/06:/.test(document.querySelector('#ctSunResult')?.textContent));await fits();await dialog.screenshot({path:path.join(out,'sun-390.png')});await close();
    await open('time');await set('ctTimeFrom','Asia/Seoul');await set('ctTimeTo','America/New_York');await set('ctTimeDate','2026-11-03');await set('ctTimeClock','09:00');assert.match(await page.locator('#ctTimeResult').innerText(),/11\.2.*\(월\)/s);assert.match(await page.locator('#ctTimeResult').innerText(),/19:00/);await close();
    await open('wifi');await page.locator('#ctWifiSsid').fill('한글 카페');await page.locator('#ctWifiPassword').fill('password1');await page.locator('[form=ctWifiForm]').click();await page.locator('#ctWifiQr svg').waitFor();await close();
    await open('wifi');assert.equal(await page.locator('#ctWifiPassword').inputValue(),'');assert.equal(await page.locator('#ctWifiQr svg').count(),0);await close();
    await open('units');await set('ctUnitCountry','US');await page.locator('#ctUnitValue').fill('68');assert.match(await page.locator('#ctUnitResult').innerText(),/20.*°C/s);await page.locator('[data-tool-action=unit-swap]').click();await page.locator('#ctUnitValue').fill('-40');assert.match(await page.locator('#ctUnitResult').innerText(),/-40.*°F/s);await fits();await close();
    // Model/controller changes must also work on a viewer's expense-edit allocation.
    await page.evaluate(async()=>{await window.TripLogSyncRepository.update(state.id,record=>({...record,role:'viewer'}));window.TripLog.features.redesign.workspace.navigate('budget');startEdit(findEntry('food'));});
    await page.locator('#rdExpenseEditor').waitFor({state:'visible'});if(!await page.locator('#exAllocation').isVisible())await page.locator('#rdExpenseMemo>summary').click();
    await page.locator('#exAllocation [data-allocation-mode=amount]').click();const split=page.locator('#exAllocation [data-split-key]');await split.nth(0).fill('20000');await split.nth(1).fill('19000');
    assert(await page.locator('#rdExpenseSubmit').isEnabled());await page.locator('#rdExpenseSubmit').click();await page.locator('#rdExpenseEditor').waitFor({state:'hidden'});
    await page.waitForFunction(()=>state.settlement.itemSplits['current:food']?.shares.leader===20000);
    await page.evaluate(async()=>{await window.TripLogSyncRepository.update(state.id,record=>({...record,role:'owner'}));window.TripLog.features.redesign.workspace.navigate('overview');});
    for(const count of [3,4,5,6]){
      await page.evaluate(count=>{state.entries=['교통','식비','숙소','관광','쇼핑','기타'].slice(0,count).map((category,index)=>({id:'grid-'+index,category,amount:1000,date:state.startDate,description:category}));render();},count);
      const rows=await page.locator('.tc-category-list li').evaluateAll(nodes=>Object.values(nodes.reduce((groups,node)=>{const y=Math.round(node.getBoundingClientRect().top);groups[y]=(groups[y]||0)+1;return groups;},{})));
      assert.deepEqual(rows,count===3?[3]:count===4?[2,2]:count===5?[3,2]:[3,3]);
    }
    for(const width of [320,1440]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>window.TripLog.features.travelCompanion.workspace.open('tools'));
      assert(await page.locator('.ct-tools-grid').evaluate(node=>node.scrollWidth<=node.clientWidth+1));await page.screenshot({path:path.join(out,`main-${width}.png`)});
      for(const tool of ['timezone','calendar','sun','time','wifi','units']){await open(tool);await fits();await close();}
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({ok:true,origin,viewports:[320,390,1440],checks:['seven tools','packing save','timezone save','filtered ICS','solar','date/time rollover','Wi-Fi QR and clear on close','unit direction','viewer split save','category count 3/4/5/6'],errors},null,2));
    console.log(`PASS tools browser + member allocation + category grids: ${out}`);await context.close();
  }finally{await browser.close();await stopServer(server);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
