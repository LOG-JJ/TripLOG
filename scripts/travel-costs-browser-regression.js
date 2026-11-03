const { artifactDirectory } = require('./helpers/artifact-output');
const { launchBrowser, blockExternalRequests } = require('./helpers/browser-fixture');
// Disposable browser fixture. Interactive visual QA also uses the in-app browser.
// No production services or trip data are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createExportPreview } = require('./preview-export-reports');
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory('travel-costs');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createExportPreview(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    context.setDefaultTimeout(12000);
    await blockExternalRequests(context, origin);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.auth === 'signed-in' && state.collaboration?.ownerId);
    const navigate = name => page.evaluate(value => window.TripLog.features.redesign.workspace.navigate(value), name);
    const capture = async (selector, filename) => {
      // Keep the entire card above the app's fixed footer before capturing it.
      await page.locator(selector).evaluate(node => window.scrollTo({ top:window.scrollY + node.getBoundingClientRect().top - 72, behavior:'instant' }));
      await page.locator(selector).screenshot({ path:path.join(output,filename), animations:'disabled' });
    };
    const readSummary = async (selector, total, count) => {
      const text = await page.locator(selector).innerText();
      assert.match(text, /여행 경비/);
      assert(text.includes(`${total.toLocaleString('ko-KR')}원`), `Expected ${total} in ${text}`);
      assert(text.includes(`${count}건`), `Expected ${count} records in ${text}`);
      assert.doesNotMatch(text, /예산|사용률|초과|남은 금액/);
      assert.equal(await page.locator(`${selector} progress, ${selector} [data-rd-action="budget-edit"]`).count(), 0);
    };
    const acrossPages = async (total, count) => {
      for (const [name, selector] of [['overview', '.rd-overview-cost'], ['budget', '#rdBudgetSummary'], ['report', '#rdReportSummary']]) {
        await navigate(name); await readSummary(selector, total, count);
      }
    };
    await page.goto(`${origin}/Travel?page=overview&trip=export-suncheon`); await ready();
    await acrossPages(486000, 14);
    assert.equal(await page.locator('#rdBudgetEditor, [data-rd-action="budget-edit"], [data-tt-action="budget-settings"]').count(), 0);
    assert.equal(await page.locator('#budgetInput').count(), 0, 'Retired budget control is absent; legacy values stay in data');

    const baseline = await page.evaluate(() => JSON.stringify({ entries:state.entries, totalBudget:state.totalBudget, companions:state.companions }));
    await navigate('overview');
    const frames = await page.locator('#rdOverview > .ov-card').evaluateAll(nodes=>nodes.map(node=>{
      const s=getComputedStyle(node);return {border:s.borderTopColor,borderWidth:s.borderTopWidth,radius:s.borderTopLeftRadius,surface:s.backgroundColor,ink:s.color,font:s.fontFamily,shadow:s.boxShadow};
    }));
    assert.equal(frames.length, 5, 'Hero, reservations, cost, schedule and packing share one card frame');
    frames.forEach(frame=>assert.deepEqual(frame,frames[0],'Overview card appearance comes from common tokens'));
    const headings = await page.locator('.ov-card-header h2').evaluateAll(nodes=>nodes.map(node=>{
      const s=getComputedStyle(node);return {font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,color:s.color,line:s.lineHeight};
    }));
    headings.forEach(heading=>assert.deepEqual(heading,headings[0],'Cost, schedule and reservation headings share the same type style'));
    const composition = await page.locator('.tc-composition').evaluate(node => ({
      width:node.getBoundingClientRect().width,
      segments:[...node.children].map(child=>({name:child.dataset.costShare,width:child.getBoundingClientRect().width,color:getComputedStyle(child).backgroundColor})),
      rows:[...document.querySelectorAll('.tc-category')].map(row=>({name:row.dataset.category,text:row.innerText,color:getComputedStyle(row.querySelector('.tc-color-dot')).backgroundColor,height:row.getBoundingClientRect().height}))
    }));
    const amounts = [180000,126000,90000,54000,36000];
    assert.deepEqual(composition.segments.map(row=>row.name), ['숙소','식비','교통','관광','기타']);
    composition.segments.forEach((row,i)=>{
      assert(Math.abs(row.width / composition.width - amounts[i] / 486000) < .005, 'Segment lengths encode actual amount ratios');
      assert.equal(row.color, composition.rows[i].color, 'Segment and directly labelled row use the same color');
      assert(composition.rows[i].height >= 44, 'Category rows are usable by touch');
    });
    for (const width of [320, 390, 599, 759, 760, 849, 850, 1024, 1440]) {
      await page.setViewportSize({ width, height: width >= 760 ? 1000 : 844 });
      for (const [name, selector] of [['overview', '.rd-overview-cost'], ['budget', '#rdBudgetSummary']]) {
        await navigate(name);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} fits ${width}px`);
        const fits = await page.locator(selector).evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
        assert(fits.scrollWidth <= fits.width + 1, `${name} card fits ${width}px`);
        if (name === 'overview') assert((await page.locator(selector).boundingBox()).height <= (width <= 600 ? 331 : 287), 'Mobile side-by-side shares add at most one 44px legend row');
        await capture(selector, `${name}-cost-${width}.png`);
        if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${name}-context-${width}.png`) });
      }
    }

    await page.clock.setFixedTime(new Date('2026-10-09T09:00:00+09:00'));
    await page.goto(`${origin}/Travel?page=overview&trip=export-overview-five`); await ready();
    for (const width of [320, 390, 849, 850, 1440]) {
      await page.setViewportSize({width,height:width>=850?1000:844});
      assert.equal(await page.locator('.rd-key-schedule .rd-plan-row').count(), 5, 'Five first-day stops are visible');
      assert.deepEqual(await page.locator('.rd-key-schedule .rd-plan-row time').allTextContents(), ['10:30','11:00','16:15','17:10','18:00']);
      await page.locator('.tc-card').evaluate(node=>window.scrollTo({top:scrollY+node.getBoundingClientRect().top-72,behavior:'instant'}));
      const pair = await page.evaluate(()=>{
        const cost=document.querySelector('.tc-card').getBoundingClientRect(), schedule=document.querySelector('.rd-key-schedule').getBoundingClientRect();
        return {costHeight:cost.height,scheduleHeight:schedule.height,x:Math.floor(Math.min(cost.x,schedule.x)),y:Math.floor(Math.min(cost.y,schedule.y)),width:Math.ceil(Math.max(cost.right,schedule.right)-Math.min(cost.x,schedule.x)),height:Math.ceil(Math.max(cost.bottom,schedule.bottom)-Math.min(cost.y,schedule.y))};
      });
      assert(pair.costHeight <= (width <= 600 ? 331 : 287));
      if(width>=850) assert(Math.abs(pair.costHeight-pair.scheduleHeight)<1,'Desktop cost and five-stop cards have equal heights');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if([390,1440].includes(width)) await page.screenshot({path:path.join(output,`compact-pair-${width}.png`),clip:{x:pair.x,y:pair.y,width:pair.width,height:pair.height}});
      if(width===1440){
        await page.setViewportSize({width,height:1200});
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        await page.locator('#rdOverview').screenshot({path:path.join(output,'overview-shared-cards-1440.png')});
      }
    }
    await page.evaluate(()=>{state.itineraryItems.push({id:'sixth',date:state.startDate,time:'19:00',place:'여섯 번째 일정',theme:'food'});render();});
    assert.equal(await page.locator('.rd-key-schedule .rd-plan-row').count(), 5);
    assert.doesNotMatch(await page.locator('.rd-key-schedule').innerText(), /여섯 번째 일정/);
    await page.goto(`${origin}/Travel?page=overview&trip=export-suncheon`); await ready();

    await navigate('budget');
    await page.locator('#expenseSearchInput').fill('식사');
    await readSummary('#rdBudgetSummary', 486000, 14);
    await page.locator('#exSearchClear').click();
    await page.locator('#rdExpenseTabs [data-tab="pretrip"]').click();
    await readSummary('#rdBudgetSummary', 486000, 14);
    await page.locator('#rdExpenseTabs [data-tab="all"]').click();
    await page.locator('#expenseSearchInput').fill('기존 검색');
    await page.locator('#rdExpenseTabs [data-tab="pretrip"]').click();
    await navigate('overview');
    await page.locator('.tc-category[data-category="식비"]').press('Enter');
    assert.match(page.url(), /page=budget/);
    assert.equal(await page.locator('#expenseSearchInput').inputValue(), '');
    assert.equal(await page.locator('#rdExpenseTabs [data-tab="all"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#exCategoryFilter').inputValue(), '식비');
    assert.equal(await page.locator('#rdExpenseList tr').count(), 3);
    assert.match(await page.locator('#exResultSummary').innerText(), /126,000원/);
    assert(await page.locator('#budgetPage .ex-heading h1').evaluate(el=>el===document.activeElement));
    await readSummary('#rdBudgetSummary', 486000, 14);
    assert.equal(await page.evaluate(() => JSON.stringify({ entries:state.entries, totalBudget:state.totalBudget, companions:state.companions })), baseline, 'Category drill-down does not mutate saved data');
    for (const legacyBudget of [0, 1, 999999999]) {
      await page.evaluate(async value => { state.totalBudget = value; await saveAndRender(); }, legacyBudget);
      await acrossPages(486000, 14);
    }

    await page.evaluate(async () => {
      state.entries.push({ id: 'cost-added', date: '__pretrip__', paymentDate: '2026-10-01', description: '사전구매', category: '교통', amount: 10000, mode: 'domestic' });
      await saveAndRender();
    });
    await acrossPages(496000, 15);
    await page.evaluate(async () => { state.entries.find(row => row.id === 'cost-added').amount = 25000; await saveAndRender(); });
    await acrossPages(511000, 15);
    await page.evaluate(async () => { state.entries.push({ id: 'cost-refund', date: state.startDate, description: '환불', category: '교통', amount: -5000, mode: 'domestic' }); await saveAndRender(); });
    await acrossPages(506000, 16);
    await navigate('overview');
    assert.match(await page.locator('.tc-refund-note').innerText(), /환불 5,000원 반영.*환불 전 금액 기준/);
    assert.match(await page.locator('.tc-composition').getAttribute('aria-label'), /환불 전 지출 기준/);
    await page.reload(); await ready(); await acrossPages(506000, 16);
    assert.equal(await page.evaluate(() => state.totalBudget), 999999999, 'The legacy field is preserved without affecting costs');
    await page.evaluate(() => window.TripLog.features.travelCompanion.workspace.open('today'));
    await page.locator('#ttCompanion:not([hidden])').waitFor();
    await page.locator('#ttDay').selectOption('2026-10-09');
    assert.match(await page.locator('.cx-cost-strip').innerText(), /181,000원/);
    await page.locator('.cx-cost-strip').click();
    const detail = await page.locator('#ttCostInfo').innerText();
    assert.match(detail, /181,000원/); assert.match(detail, /506,000원/); assert.match(detail, /25,000원/);
    assert.doesNotMatch(detail, /예산|가용|초과/);
    await page.locator('#ttCostInfo [data-tt-action="close"]').first().click();
    await page.locator('.rd-nav [data-trip-nav="report"]').click(); await page.waitForFunction(() => activePage === 'report');
    await page.evaluate(() => deleteEntry('cost-added'));
    await page.waitForFunction(() => document.querySelector('#rdReportSummary').textContent.includes('481,000원'));
    await page.evaluate(() => deleteEntry('cost-refund'));
    await page.waitForFunction(() => document.querySelector('#rdReportSummary').textContent.includes('486,000원'));
    await acrossPages(486000, 14);
    await page.reload(); await ready(); await acrossPages(486000, 14);

    await page.goto(`${origin}/Travel?page=overview&trip=export-empty`); await ready();
    await acrossPages(0, 0);
    await navigate('overview');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.tc-composition').count(), 0);
    await capture('.tc-card','cost-empty-390.png');
    await page.locator('.tc-empty [data-rd-action="expense-new"]').click();
    assert(await page.locator('#rdExpenseEditor').isVisible());
    await page.locator('#rdExpenseEditor [data-rd-action="close"]').first().click();
    await page.evaluate(()=>{state.entries=[{id:'only-refund',amount:-9000,category:'기타',description:'환불'}];render();});
    await readSummary('.rd-overview-cost', -9000, 1);
    assert.equal(await page.locator('.tc-composition').count(), 0);
    assert.match(await page.locator('.tc-refund-note').innerText(), /9,000원/);
    await capture('.tc-card','cost-refund-only-390.png');
    // Six categories and the longer tiny-share label must keep Korean names
    // horizontal on narrow phones, including enlarged browser text.
    await page.evaluate(() => {
      state.entries = ['교통','식비','쇼핑','숙소','관광','기타'].map((category, index) => ({
        id: `mobile-category-${index}`, category, amount: [950000,418000,398000,251000,77000,109][index], description: category,
      })); render();
    });
    for (const [width, enlarged] of [[320,false],[390,false],[430,false],[320,true],[390,true]]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('.tc-category').evaluateAll((nodes, enlarged) => nodes.forEach(node => {
        node.style.fontSize = enlarged ? '16px' : '';
        node.querySelector('.tc-category-percent').style.fontSize = enlarged ? '14px' : '';
      }), enlarged);
      const labels = await page.locator('.tc-category').evaluateAll(nodes => nodes.map(node => {
        const name = node.querySelector('.tc-category-name > span:last-child'), percent = node.querySelector('.tc-category-percent');
        const box = name.getBoundingClientRect(), share = percent.getBoundingClientRect(), row = node.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(name);
        return { name: name.textContent, lines: range.getClientRects().length, fits: name.scrollWidth <= name.clientWidth + 1,
          within: box.left >= row.left && box.right <= row.right + 1 && share.right <= row.right + 1,
          disjoint: box.right <= share.left && Math.abs((box.top + box.bottom) / 2 - (share.top + share.bottom) / 2) <= 1 };
      }));
      const cells = await page.locator('.tc-category').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
      assert.equal(new Set(cells.map(cell => cell.x)).size, 3, 'Mobile composition has three columns');
      assert.equal(new Set(cells.map(cell => cell.y)).size, 2, 'Six mobile categories use two rows');
      assert(labels.every(label => label.lines === 1 && label.fits && label.within && label.disjoint), `Horizontal mobile categories at ${width}, enlarged=${enlarged}: ${JSON.stringify(labels)}`);
      await capture('.tc-card', `cost-six-categories-${width}${enlarged ? '-large-text' : ''}.png`);
    }
    await page.setViewportSize({width:320,height:844});
    await page.evaluate(()=>{state.entries=[{id:'huge',amount:123456789012,category:'아주 긴 분류 이름 <img src=x onerror=alert(1)>',description:'많은 금액'},{id:'tiny',amount:1,category:'교통',description:'작은 금액'}];render();});
    assert.equal(await page.locator('.tc-card img').count(), 0, 'Imported category names remain text');
    assert.match(await page.locator('.tc-category[data-category="교통"]').innerText(), /<1%/);
    assert.match(await page.locator('.tc-composition').getAttribute('aria-label'), /1% 미만/);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert(await page.locator('.tc-card').evaluate(node=>node.scrollWidth<=node.clientWidth+1));
    await page.locator('.tc-card').screenshot({path:path.join(output,'cost-edge-320.png')});
    await page.goto(`${origin}/Travel?page=overview&trip=export-suncheon`); await ready();
    await readSummary('.rd-overview-cost', 486000, 14);
    await page.locator('.rd-overview-cost [data-rd-nav="budget"]').click();
    await readSummary('#rdBudgetSummary', 486000, 14);
    assert.deepEqual(errors, []);
    console.log(`PASS compact travel costs: horizontal six-category names with tiny shares and enlarged mobile text, at most half the previous height, equal desktop cards, 5 first-day stops/6th-stop cap, overview/expenses/report/today, add/edit/delete/refund/pretrip/reload, trip isolation, legacy budget independence, proportional categories/color keys/keyboard drill-down/filter reset, no budget UI, empty/refund-only/tiny/large/escaped input and 320/390/599/759/760/849/850/1024/1440 layout. ${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
