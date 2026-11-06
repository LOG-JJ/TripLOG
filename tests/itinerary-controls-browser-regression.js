const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const { launchBrowser, fixtureToken, blockExternalRequests, seedTrip, startServer, stopServer } = require('./helpers/browser-fixture');
// Browser plugin unavailable: use the repository's isolated Playwright/Edge workflow.
// External requests are blocked. No real account, trip, or server data is edited.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('itinerary-controls');

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
    const seed = { id: 'controls-fixture', tripName: '교토 여행', city: '교토', country: '일본', travelMode: 'overseas', startDate: '2026-09-25', endDate: '2026-09-28', entries: [], companions: [], packingList: [], itineraryItems: [{id:'stop-a',date:'2026-09-25',place:'교토역',theme:'sightseeing',time:'09:00',endTime:'09:30',createdAt:1},{id:'stop-b',date:'2026-09-25',place:'텐류지',theme:'sightseeing',time:'10:00',endTime:'11:00',createdAt:2}] };
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

    await page.goto(`${origin}/Travel?page=itinerary`); await ready();
    await page.evaluate(() => setActivePage('itinerary'));
    await page.locator('#itineraryAddButton').click();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width,height:900});
      await page.locator('#itineraryThemeSelectButton').click();
      const metrics = await page.locator('#itineraryThemeSelectMenu').evaluate(menu => {
        const option=menu.querySelector('.custom-select-option'), trigger=document.querySelector('#itineraryThemeSelectButton');
        return { width:menu.getBoundingClientRect().width, height:menu.getBoundingClientRect().height, triggerWidth:trigger.getBoundingClientRect().width, left:menu.getBoundingClientRect().left, triggerLeft:trigger.getBoundingClientRect().left, row:option.getBoundingClientRect().height, font:getComputedStyle(option).fontSize, emoji:getComputedStyle(option.querySelector('.control-theme-emoji')).fontSize };
      });
      assert(Math.abs(metrics.width - metrics.triggerWidth) < 1 && Math.abs(metrics.left - metrics.triggerLeft) < 1, JSON.stringify(metrics));
      assert(metrics.height <= 330 && metrics.row === 44, JSON.stringify(metrics));
      assert.equal(metrics.font,'14px'); assert.equal(metrics.emoji,'18px');
      await capture('#itineraryThemeSelectMenu', `theme-compact-${width}`);
      await page.locator('#itineraryThemeSelectMenu [data-value="lodging"]').click();
      assert.equal(await page.locator('#itineraryThemeSelect').inputValue(),'lodging');
    }
    await page.locator('#itineraryThemeSelectButton').click();
    await page.setViewportSize({width:768,height:900});
    await page.waitForFunction(() => {
      const menu=document.querySelector('#itineraryThemeSelectMenu').getBoundingClientRect();
      const field=document.querySelector('#itineraryThemeSelectButton').getBoundingClientRect();
      return Math.abs(menu.width-field.width)<1 && Math.abs(menu.left-field.left)<1;
    });
    await page.keyboard.press('Escape');
    const panel=page.locator('#itineraryTimeInputPanel');
    const trigger=page.locator('[data-time-id="itineraryTimeInput"] .custom-time-toggle');
    const spin=panel.locator('[data-time-part-input="hour"]');
    // Keep focus in the popup while pressing the arrow, including a long press.
    await trigger.click(); assert.equal(await panel.isVisible(),true);
    await spin.fill('11');
    let box=await trigger.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve,100)));
    assert.equal(await panel.isVisible(),true,'Pointer press must not close before click');
    await page.mouse.up();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await panel.isVisible(),false,'Arrow closes without label focus reopening');
    assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    for (let i=0;i<3;i++) {
      await trigger.click(); assert.equal(await panel.isVisible(),true);
      await trigger.click();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await panel.isVisible(),false);
    }
    await trigger.focus(); await page.keyboard.press('Enter'); assert.equal(await panel.isVisible(),true);
    await page.keyboard.press('Space'); assert.equal(await panel.isVisible(),false);
    const cdp=await context.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    for(let i=0;i<2;i++) {
      const tap=await trigger.boundingBox(), point={x:tap.x+tap.width/2,y:tap.y+tap.height/2};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await panel.isVisible(),i===0,'Touch arrow toggles once per tap');
    }
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await page.locator('#itineraryEditorClose').click();
    await page.setViewportSize({width:390,height:640});
    await page.locator('.timeline-transit-button').first().click();
    await page.locator('#itineraryTransitManualTab').click();
    const dialog=page.locator('#itineraryTransitDialog');
    for(let i=0;i<3;i++) await page.locator('#itineraryTransitAdd').click();
    const scroll=dialog.locator('.transit-editor-scroll');
    const scrolling=await scroll.evaluate(node => ({overflow:getComputedStyle(node).overflowY,bar:getComputedStyle(node).scrollbarWidth,content:node.scrollHeight,visible:node.clientHeight,webkit:getComputedStyle(node,'::-webkit-scrollbar').display}));
    assert.equal(scrolling.overflow,'auto'); assert.equal(scrolling.bar,'none'); assert.equal(scrolling.webkit,'none');
    assert(scrolling.content>scrolling.visible,'Fixture must really overflow');
    await scroll.evaluate(node => node.scrollTop=0);
    const scrollBox=await scroll.boundingBox();
    await page.mouse.move(scrollBox.x+scrollBox.width-12,scrollBox.y+60); await page.mouse.wheel(0,300);
    await page.waitForFunction(() => document.querySelector('#itineraryTransitDialog .transit-editor-scroll').scrollTop>30);
    await capture('#itineraryTransitDialog','transit-hidden-scrollbar');
    await scroll.evaluate(node => node.scrollTop=0);
    const mode=dialog.locator('.custom-select[data-select-id^="transitMode"]').first();
    await mode.locator('.custom-select-button').click();
    const menu=mode.locator('.custom-select-menu');
    assert.equal(await menu.locator('.custom-select-option').first().evaluate(node => getComputedStyle(node).textAlign),'center');
    // The selected journey mock uses a leading transport icon and left-aligned field text.
    assert.equal(await mode.locator('.custom-select-value').evaluate(node => getComputedStyle(node).textAlign),'left');
    assert.equal(await menu.evaluate(node => getComputedStyle(node).scrollbarWidth),'none');
    await capture('.custom-select[data-select-id^="transitMode"] .custom-select-menu:not([hidden])','transit-centered-menu');
    await menu.locator('[data-value="walk"]').click();
    assert.equal(await mode.locator('select').inputValue(),'walk');
    // Keyboard focus still brings the bottom controls into view with no track.
    await page.locator('#itineraryTransitAdd').focus();
    assert((await scroll.evaluate(node=>node.scrollTop))>0);
    assert.deepEqual(errors,[]);
    console.log('PASS theme matches field width and left edge at 1440/390/320 and on resize, with 44px/14px/18px sizing; repeated arrow close, held pointer, keyboard Enter/Space; transit overflow scroll preserved with invisible tracks, centered options and icon-aligned field text.');
  } catch(error) {
    if(page) await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
    throw error;
  } finally {await browser.close();await stopServer(server);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
