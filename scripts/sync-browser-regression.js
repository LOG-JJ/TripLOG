const { launchBrowser } = require('./helpers/browser-fixture');
// Browser plugin is not installed in this workspace. Use Playwright's installed Edge browser.
// All accounts, trips and network responses in this test are isolated fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const M = require('../src/app/sync/model');
const { createDatabase, actors } = require('./sync-database-regression');
const origin = process.env.TRIPLOG_TEST_URL || 'http://127.0.0.1:18080';
async function main() {
  const db = await createDatabase();
  const rpc = async (name, args) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`, args.map(v=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].result;
  const seed = { id:'browser-kyoto',tripName:'교토 공동 여행',startDate:'2026-09-25',endDate:'2026-09-28',entries:[],packingList:[],companions:[],itineraryItems:[{id:'kyoto',date:'2026-09-26',time:'10:00',endTime:'11:00',place:'교토역',location:'교토역',memo:'원본 메모'}],collaboration:{privacy:{shareItinerary:true,shareExpenses:true,showMemberEmail:false,allowInviteRequests:true}} };
  // Use a complete currency baseline so a member-cache save does not trigger
  // an unrelated first-run domestic-currency migration in this legacy fixture.
  Object.assign(seed,{country:'일본',countryCode:'JP',city:'교토',travelMode:'overseas',currencyCode:'JPY',currencySymbol:'¥',currencyUnit:'엔',exchangeBase:100,exchangeRate:950,exchangeRateSource:'기본값',exchangeRateUpdatedAt:'',currencyAutoMatchedCountryCode:'JP'});
  // Old saved coordinates are intentionally hidden by the rendering normalizer.
  // Their raw storage shape must still be the comparison baseline for edits/deletes.
  const legacyCoordinates={lat:34.9688924,lon:135.7692389,coordinateSource:'',coordinateSignature:'legacy-signature',coordinateAddress:'old address',coordinatePrecision:'',googlePlaceId:''};
  Object.assign(seed.itineraryItems[0],legacyCoordinates);
  seed.itineraryItems.push({id:'legacy-delete',date:'2026-09-27',time:'16:30',endTime:'17:30',place:'후시미이나리 삭제 검증',location:'후시미이나리',...legacyCoordinates,trans:'train',transits:[{trans:'train',cost:1200,duration:15}],cost:1200,duration:15,syncExpense:true,expenseId:'legacy-fare'});
  seed.itineraryItems.push({id:'legacy-offline',date:'2026-09-28',time:'09:00',place:'오프라인 삭제 검증',location:'교토',...legacyCoordinates});
  seed.entries.push({id:'legacy-fare',date:'2026-09-27',description:'연결된 이동 비용',category:'교통',amount:1200,currency:'KRW',mode:'domestic',payerKey:'leader'});
  seed.settlement={itemSplits:{'current:legacy-fare':{mode:'equal',shares:{}}}};
  seed.travelCompanion={completedItineraryIds:['legacy-delete'],lockedItineraryIds:['legacy-delete']};
  // Legacy snapshots contain emails; the current membership endpoint omits them.
  // Both copies previously survived normalization and appeared as two people.
  Object.assign(seed.collaboration, {
    ownerId:actors[0],ownerName:'JJ',ownerEmail:'jj@example.test',
    inviteToken:'fixture-invite',lastInviteUrl:origin+'/Travel?invite=fixture-invite',
    members:[
      {id:actors[1],name:'JH',email:'jh@example.test',role:'editor',status:'accepted'},
      {id:actors[1],name:'JH',email:'',role:'editor',status:'accepted',source:'supabase'},
      {id:'legacy-departed',name:'이전 멤버',email:'old@example.test',status:'accepted'},
    ],
  });
  const initialRoster = [
    {user_id:actors[0],display_name:'JJ',role:'owner',status:'accepted'},
    {user_id:actors[1],display_name:'JH',role:'editor',status:'accepted'},
  ];
  let memberRoster = initialRoster, membersUnavailable = true;
  const tid = await rpc('triplog_create_sync',[actors[0],seed.id,seed,Object.values(M.encode(seed))]);
  await db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'editor','accepted')",[tid,actors[1]]);
  const browser = await launchBrowser();
  const pages=[], contexts=[], errors=[]; let offline = false;
  try {
    for (const [index, actor] of actors.slice(0,2).entries()) {
      const context = await browser.newContext({ serviceWorkers:'block', viewport: index ? {width:390,height:844} : {width:1440,height:1000} }); contexts.push(context);
      context.setDefaultTimeout(15000);
      await context.exposeBinding('__testGateway', async (_,body) => {
        if (offline && index === 1) return {error:'NETWORK_ERROR'};
        try {
          if (body.action==='list') return {protocolVersion:2,trips:[await rpc('triplog_read_sync',[actor,tid,null])]};
          if (body.action==='read') return await rpc('triplog_read_sync',[actor,body.tripId,body.after??null]);
          if (body.action==='apply') {
            assert.equal(body.writeVersion,3);
            assert.ok(body.operation.patches.every(p=>p.action!=='delete'||!['itinerary','expense','packing','participant','reservation'].includes(p.kind)||body.deletions.some(d=>d.kind===p.kind&&d.id===p.id)), 'Deletion requires an explicit user command');
            const result=await rpc('triplog_apply_sync',[actor,body.tripId,body.operation]);
            setTimeout(()=>pages.forEach(page=>page.evaluate(()=>window.__testBroadcast?.()).catch(()=>{})),10);
            return result;
          }
          if (body.action==='members') return membersUnavailable ? {error:'NETWORK_ERROR'} : {members:memberRoster};
          if(body.action==='attachment-upload'){
            const bytes=Buffer.from(body.data.split(',')[1],'base64'),digest=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
            await db.query("insert into public.triplog_attachments(trip_id,digest,object_path,content_type,byte_size,created_by) values($1,$2,$3,'image/png',$4,$5) on conflict do nothing",[tid,digest,`${tid}/${digest}`,bytes.length,actor]);
            return {reference:`triplog-attachment:${digest}`};
          }
          if(body.action==='settlement-preview'||body.action==='settlement-finalize'){
            const current=await rpc('triplog_read_sync',[actor,tid,null]);
            const calculation=require('../src/app/sync/settlement-model').calculate(M.decode(M.fromRows(current.entities),{collaboration:{ownerName:'방장'}}));
            const sourceHash=require('node:crypto').createHash('sha256').update(JSON.stringify(calculation.source)).digest('hex');delete calculation.source;
            if(body.action==='settlement-finalize'){
              if(body.sourceHash!==sourceHash)throw new Error('SETTLEMENT_STALE');
              const finalized=await rpc('triplog_finalize_settlement',[actor,tid,body.operationId,current.cursor,sourceHash,calculation]);
              setTimeout(()=>pages.forEach(page=>page.evaluate(()=>window.__testBroadcast?.()).catch(()=>{})),10);return {finalized};
            }
            const finalized=(await db.query('select * from public.triplog_settlement_snapshots where trip_id=$1 order by created_at desc limit 1',[tid])).rows[0]||null;
            return {calculation,sourceHash,cursor:current.cursor,finalized,stale:Boolean(finalized&&finalized.source_hash!==sourceHash)};
          }
          if (body.action==='history') return {history:(await db.query('select * from public.triplog_change_log where trip_id=$1 order by sequence desc',[tid])).rows};
          if (body.action==='control'&&body.control==='restore-change') {
            const result=await rpc('triplog_restore_change',[actor,body.tripId,body.data.sequence,body.data.operationId]);
            setTimeout(()=>pages.forEach(page=>page.evaluate(()=>window.__testBroadcast?.()).catch(()=>{})),10);return result;
          }
          throw new Error('UNEXPECTED_ACTION');
        } catch(error) { return {error:error.message}; }
      });
      await context.addInitScript(({seed,actor,origin})=>{
        if (location.origin !== origin) return;
        if (!localStorage.getItem('test-seeded')) { localStorage.setItem('domesticTravelExpensePlanner.trips.v2',JSON.stringify([seed])); localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2',seed.id); localStorage.setItem('test-seeded','1'); }
        window.__testActor=actor;
      },{seed,actor,origin});
      await context.route('**/*', async route => {
        const url=new URL(route.request().url());
        if (url.pathname.endsWith('/vendor/supabase-js-2.107.0.min.js')) return route.fulfill({contentType:'application/javascript',body:`
          window.supabase={createClient(){const listeners=new Set();window.__testBroadcast=()=>listeners.forEach(fn=>fn());return {
            auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:{user:{id:window.__testActor,email:'fixture@example.test',user_metadata:{display_name:'테스트'}}}},error:null};}},
            functions:{async invoke(name,{body}){const result=await window.__testGateway(body);return result.error?{error:{context:{json:async()=>({code:result.error})}}}:{data:result,error:null};}},
            channel(){let cb;return {on(type,filter,fn){if(type==='broadcast'){cb=fn;listeners.add(fn);}return this;},subscribe(fn){queueMicrotask(()=>fn('SUBSCRIBED'));return this;},track(){},presenceState(){return {};},_remove(){listeners.delete(cb);}};},removeChannel(channel){channel._remove();}
          };}};`});
        if (url.origin !== origin) return route.abort();
        return route.continue();
      });
      const page=await context.newPage(); pages.push(page); page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+'/Travel.html?page=itinerary');
      await page.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&document.documentElement.dataset.auth==='signed-in');
      await page.waitForFunction(()=>window.TripLogSyncRepository.cached(state.id)?.serverId);
      // The intentionally minimal legacy fixture gains normalized defaults during startup.
      // Choose the server baseline explicitly, as a real migration review would require.
      await page.evaluate(async()=>{for(const c of window.TripLogSyncRepository.cached(state.id).conflicts) await window.TripLog.sync.controller.engine.resolve(state.id,c.id,'server');});
      await page.waitForFunction(()=>window.TripLogSyncRepository.cached(state.id)?.queue.length===0);
    }
    const [a,b]=pages;
    const refreshMembers = page => page.evaluate(()=>window.TripLog.features.collaboration.tripCollaboration.syncSupabaseSession());
    const memberNames = page => page.evaluate(()=>window.TripLog.features.collaboration.tripCollaboration.getTripMembers().map(m=>m.name));
    for (const page of pages) {
      assert.equal((await memberNames(page)).filter(name=>name==='JH').length,1,'Cached copies of the same account count once, even offline');
    }
    membersUnavailable = false;
    for (const page of pages) {
      await refreshMembers(page);
      assert.deepEqual(await memberNames(page),['JJ','JH'],'The authoritative roster removes stale local memberships');
      assert.deepEqual(await page.evaluate(()=>state.collaboration.members.map(m=>[m.role,m.source,m.email])),[['editor','supabase','']]);
      await page.locator('#rdMenuButton').click();
      await page.locator('#rdMore [data-rd-action="invite"]').click();
      assert.deepEqual(await page.locator('#rdInviteMembers .rd-invite-member > b').allTextContents(),['JJ','JH'],'The open invite sheet must reflect the current roster');
      const output=process.env.TRIPLOG_TEST_OUTPUT || path.join(process.cwd(),'.test-output');fs.mkdirSync(output,{recursive:true});
      await page.screenshot({path:path.join(output,page===a?'members-desktop.png':'members-mobile.png'),animations:'disabled'});
      await page.locator('#tripInviteCloseButton').click();
    }
    const stableRoster = await a.evaluate(()=>JSON.stringify(state.collaboration));
    await refreshMembers(a);
    assert.equal(await a.evaluate(()=>JSON.stringify(state.collaboration)),stableRoster,'Repeated normalization and sync preserve roles and provenance');
    // The same display name can legitimately belong to two different accounts.
    memberRoster=[...initialRoster,{user_id:actors[2],display_name:'JH',role:'viewer',status:'accepted'}];
    await refreshMembers(a);
    assert.deepEqual(await memberNames(a),['JJ','JH','JH']);
    assert.equal(await a.evaluate(()=>state.collaboration.members.find(m=>m.id.endsWith('3')).role),'viewer');
    memberRoster=[initialRoster[0],{...initialRoster[1],display_name:'JH 새 이름'}];
    await refreshMembers(a);
    assert.deepEqual(await memberNames(a),['JJ','JH 새 이름'],'Renames replace stale names and departed accounts disappear');
    membersUnavailable=true;
    await a.reload();
    await a.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&document.documentElement.dataset.auth==='signed-in');
    await a.waitForFunction(id=>state.id===id&&window.TripLogSyncRepository.cached(id)?.serverId,seed.id);
    assert.deepEqual(await memberNames(a),['JJ','JH 새 이름'],'A failed member refresh preserves the persisted roster');
    membersUnavailable=false;memberRoster=initialRoster;
    await refreshMembers(a);
    await a.waitForFunction(()=>state.collaboration.members[0]?.name==='JH',null,{timeout:30000});
    const companionCheck=await a.evaluate(actor=>{
      const original=state.companions;
      const fixture=[{id:'settlement-only',userId:actor,name:'JH',individualSpent:7000},{id:'independent-person',name:'JH',individualSpent:9000}];
      state.companions=fixture;
      try { return {names:window.TripLog.features.collaboration.tripCollaboration.getTripMembers().map(m=>m.name),unchanged:JSON.stringify(state.companions)===JSON.stringify(fixture)}; }
      finally {state.companions=original;}
    },actors[1]);
    assert.deepEqual(companionCheck,{names:['JJ','JH','JH'],unchanged:true},'Linked companions count once without deleting financial records or namesakes');
    console.log('PASS browser: duplicate legacy membership heals on both devices; invite sheets, stable identity, role persistence, namesakes, rename/removal and offline reload verified');
    await a.evaluate(()=>startItineraryEdit(state.itineraryItems.find(item=>item.id==='legacy-delete')));
    await a.evaluate(()=>window.TripLog.persistence.stateStorage.whenSaved());
    await b.evaluate(async()=>{
      const item=state.itineraryItems.find(item=>item.id==='legacy-delete');item.cost=1500;item.transits[0].cost=1500;item.trans='bus';item.transits[0].trans='bus';
      state.entries.find(entry=>entry.id==='legacy-fare').amount=1500;await saveAndRender();
    });
    await a.waitForFunction(()=>window.TripLogSyncRepository.cached(state.id).snapshot.entries.find(entry=>entry.id==='legacy-fare').amount===1500);
    await a.locator('#itineraryChangePlace').click();await a.locator('#itineraryPlaceInput').fill('후시미이나리 변경 검증');
    await a.locator('#itinerarySubmitButton').click();await a.locator('#itineraryEditor').waitFor({state:'hidden'});
    await b.waitForFunction(()=>state.itineraryItems.find(item=>item.id==='legacy-delete').place==='후시미이나리 변경 검증');
    assert.equal(await b.evaluate(()=>state.itineraryItems.find(item=>item.id==='legacy-delete').cost),1500,'Place edits preserve another device’s updated transit');
    assert.equal(await b.evaluate(()=>state.entries.find(entry=>entry.id==='legacy-fare').amount),1500,'Place edits never revert linked money');
    assert.match(await b.evaluate(()=>state.entries.find(entry=>entry.id==='legacy-fare').description),/버스/,'The linked description uses the latest transit mode');
    assert.equal(await b.evaluate(()=>state.itineraryItems.find(item=>item.id==='legacy-delete').lat),undefined,'Changed places discard stale coordinates');
    // Exercise direct place replacement on another legacy coordinate record.
    await a.evaluate(()=>startItineraryEdit(state.itineraryItems.find(item=>item.id==='kyoto')));
    await a.locator('#itineraryChangePlace').click();await a.locator('#itineraryPlaceInput').fill('교토역 변경 검증');
    await a.locator('#itinerarySubmitButton').click();await a.locator('#itineraryEditor').waitFor({state:'hidden'});
    await b.waitForFunction(()=>state.itineraryItems.find(item=>item.id==='kyoto').place==='교토역 변경 검증');
    await a.evaluate(()=>startItineraryEdit(state.itineraryItems.find(item=>item.id==='legacy-delete')));
    await a.evaluate(()=>window.TripLog.persistence.stateStorage.whenSaved());
    await a.locator('#itineraryExtraDetails > summary').click();
    await a.locator('#itineraryMemoInput').fill('삭제 실패 후에도 남을 입력');
    await a.evaluate(()=>{window.__deleteOriginalSave=window.TripLogSyncRepository.save;window.TripLogSyncRepository.save=async()=>{throw new Error('QuotaExceededError delete fixture');};});
    await a.locator('#itineraryDeleteButton').click();await a.locator('#rdConfirm').getByRole('button',{name:'확인',exact:true}).click();
    await a.getByText('삭제를 저장하지 못했어요. 일정은 유지됩니다. 다시 시도해 주세요.',{exact:true}).waitFor();
    await a.waitForFunction(()=>!document.querySelector('#itineraryDeleteButton').disabled);
    assert(await a.locator('#itineraryEditor').isVisible());assert.equal(await a.locator('#itineraryMemoInput').inputValue(),'삭제 실패 후에도 남을 입력');
    assert(await a.evaluate(()=>state.itineraryItems.some(item=>item.id==='legacy-delete')&&state.entries.some(entry=>entry.id==='legacy-fare')),'Failed delete restores the linked records');
    await a.evaluate(()=>{window.TripLogSyncRepository.save=window.__deleteOriginalSave;});
    await a.locator('#itineraryDeleteButton').click();
    await a.locator('#rdConfirm').getByRole('button',{name:'확인',exact:true}).click();
    await b.waitForFunction(()=>!state.itineraryItems.some(item=>item.id==='legacy-delete'),null,{timeout:8000});
    assert.equal(await a.evaluate(()=>window.TripLogSyncRepository.cached(state.id).conflicts.length),0,'Normalization must not manufacture delete conflicts');
    assert.equal(await b.evaluate(()=>state.entries.some(entry=>entry.id==='legacy-fare')),false,'Linked fare is removed in the same command');
    assert.equal(await b.evaluate(()=>state.travelCompanion.completedItineraryIds.includes('legacy-delete')||state.travelCompanion.lockedItineraryIds.includes('legacy-delete')),false);
    assert.equal(await a.evaluate(async()=> (await window.TripLog.sync.drafts.list(state.id)).some(row=>row.value.editId==='legacy-delete')),false,'Successful deletion clears its obsolete form draft');
    console.log('PASS browser: legacy-coordinate deletion removes exactly the itinerary, linked fare and progress on both devices');
    offline=true;
    await b.evaluate(()=>startItineraryEdit(state.itineraryItems.find(item=>item.id==='legacy-offline')));
    await b.locator('#itineraryDeleteButton').click();await b.locator('#rdConfirm').getByRole('button',{name:'확인',exact:true}).click();
    await b.waitForFunction(()=>!state.itineraryItems.some(item=>item.id==='legacy-offline'));
    await b.reload();await b.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true'&&state.id==='browser-kyoto');
    assert.equal(await b.evaluate(()=>state.itineraryItems.some(item=>item.id==='legacy-offline')),false);
    offline=false;await b.evaluate(()=>window.dispatchEvent(new Event('online')));
    await a.waitForFunction(()=>!state.itineraryItems.some(item=>item.id==='legacy-offline'));
    console.log('PASS browser: actual place changes preserve concurrent transit/money; failed delete keeps editor/input; offline legacy delete survives reload and reconnect');
    await a.evaluate(()=>{setActivePage('itinerary');startItineraryEdit(state.itineraryItems.find(i=>i.id==='kyoto'));});
    await a.locator('#itineraryMemoInput').fill('작성 중인 내 메모');
    await a.locator('#itineraryVoucherFile').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1sAAAAASUVORK5CYII=','base64')});
    await b.evaluate(async()=>{state.itineraryItems[0].time='12:00';state.itineraryItems[0].endTime='13:00';await saveAndRender();});
    await a.waitForFunction(()=>window.TripLogSyncRepository.cached(state.id)?.base['itinerary:kyoto'].fields['g:schedule'].time==='12:00');
    assert.equal(await a.locator('#itineraryMemoInput').inputValue(),'작성 중인 내 메모');
    await a.locator('#itinerarySubmitButton').click();
    await b.waitForFunction(()=>state.itineraryItems[0].memo==='작성 중인 내 메모');
    assert.equal(await b.evaluate(()=>state.itineraryItems[0].time),'12:00');
    console.log('PASS browser: remote updates preserve open form input and field-level merge');

    offline=true;
    await b.evaluate(async()=>{state.itineraryItems.push({id:'offline28',date:'2026-09-28',place:'오프라인 귀국 일정'});await saveAndRender();});
    await b.reload(); await b.waitForFunction(()=>document.documentElement.dataset.triplogInitialized==='true');
    await b.waitForFunction(()=>state.itineraryItems.some(i=>i.id==='offline28'));
    offline=false; await b.evaluate(()=>window.dispatchEvent(new Event('online')));
    await a.waitForFunction(()=>state.itineraryItems.some(i=>i.id==='offline28'));
    console.log('PASS browser: local schedule survives reload and automatically converges on reconnect');

    for(const page of pages){await page.evaluate(()=>window.TripLog.sync.statusUi.open());await page.getByRole('button',{name:'공동 메모',exact:true}).click();}
    await a.locator('#triplogSharedNote').fill('함께 작성하는 여행 메모');
    await b.waitForFunction(()=>document.querySelector('#triplogSharedNote')?.value==='함께 작성하는 여행 메모');
    await b.locator('#triplogSharedNote').fill('함께 작성하는 여행 메모\n둘째 날 예약');
    await a.waitForFunction(()=>document.querySelector('#triplogSharedNote')?.value.includes('둘째 날 예약'));
    console.log('PASS browser: shared Yjs note automatically reaches the other browser');
    for(const page of pages)await page.getByRole('button',{name:'댓글·담당자',exact:true}).click();
    await b.locator('#triplogCommentTarget').selectOption('kyoto');
    await b.locator('#triplogCommentText').fill('교토역에서 12시에 만나요.');
    await b.getByRole('button',{name:'댓글 남기기',exact:true}).click();
    await a.getByText('교토역에서 12시에 만나요.',{exact:true}).waitFor();
    await b.locator('#triplogAssignee').selectOption(actors[0]);
    await b.getByRole('button',{name:'담당자 지정',exact:true}).click();
    await a.waitForFunction(actor=>state.itineraryItems[0].assigneeId===actor,actors[0]);
    console.log('PASS browser: comments and itinerary assignees automatically reach collaborators');
    await a.evaluate(async()=>{state.itineraryItems[0].voucherFile='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1sAAAAASUVORK5CYII=';state.itineraryItems[0].voucherFileName='fixture.png';await saveAndRender();});
    await b.waitForFunction(()=>state.itineraryItems[0].voucherFile?.startsWith('triplog-attachment:'));
    const backup=await a.evaluate(async()=>{
      const originalId=state.id,payload=await window.TripLog.sync.backup.build([]),snapshot=payload.trips.find(t=>t.id===originalId);
      const copy={...snapshot,id:crypto.randomUUID(),tripName:'검증 복원 사본'};
      await window.TripLog.persistence.stateStorage.importSharedTripSnapshot(copy,{makeActive:false});
      const record=await window.TripLogSyncRepository.read(copy.id);
      return {unchanged:state.id===originalId,missing:payload.missingAttachments.length,embedded:snapshot.itineraryItems[0].voucherFile.startsWith('data:'),documents:Object.values(record.base).filter(e=>['note_update','comment'].includes(e.kind)).length,quarantined:record.quarantined};
    });
    assert.ok(backup.unchanged&&backup.embedded&&backup.quarantined&&backup.documents>=2);assert.equal(backup.missing,0);
    console.log('PASS browser: attachments use separate commands; backup embeds cached bytes, notes and comments; restore preserves the original');
    await b.getByRole('button',{name:'공동 메모',exact:true}).click();
    await a.getByRole('button',{name:'복구 기록',exact:true}).click();
    await a.locator('#triplogSyncStatus .sync-conflict').first().waitFor();
    const output=process.env.TRIPLOG_TEST_OUTPUT || path.join(process.cwd(),'.test-output');fs.mkdirSync(output,{recursive:true});
    await a.screenshot({path:path.join(output,'sync-recovery-desktop.png')});
    await b.screenshot({path:path.join(output,'sync-notes-mobile.png')});
    await a.getByRole('button',{name:'닫기',exact:true}).last().click();
    await a.evaluate(()=>{setActivePage('itinerary');startItineraryEdit(state.itineraryItems.find(i=>i.id==='kyoto'));});
    await a.evaluate(()=>{document.querySelector('#itineraryExtraDetails').open=true;});
    await a.locator('#itineraryMemoInput').fill('저장 실패 시에도 유지할 입력');
    await a.evaluate(()=>{window.__originalSave=window.TripLogSyncRepository.save;window.TripLogSyncRepository.save=async()=>{throw new Error('QuotaExceededError fixture');};});
    await a.locator('#itinerarySubmitButton').click();
    assert.equal(await a.locator('#itineraryMemoInput').inputValue(),'저장 실패 시에도 유지할 입력');
    assert.ok(await a.locator('#itineraryMemoInput').isVisible());
    await a.evaluate(()=>{window.TripLogSyncRepository.save=window.__originalSave;});
    await a.locator('#itinerarySubmitButton').click();
    await b.waitForFunction(()=>state.itineraryItems[0].memo==='저장 실패 시에도 유지할 입력');
    await a.evaluate(async()=>{state.entries.push({id:'shared-meal',date:'2026-09-26',category:'식비',description:'공동 식사',amount:1001,payerKey:'leader'});state.companions.push({id:'traveler',name:'동행',individualSpent:0});await saveAndRender();});
    await b.waitForFunction(()=>state.entries.some(e=>e.id==='shared-meal'));
    await a.waitForFunction(()=>!window.TripLogSyncRepository.cached(state.id).queue.length);
    for(const page of pages){await page.evaluate(()=>window.TripLog.sync.statusUi.open());await page.getByRole('button',{name:'정산 확정',exact:true}).click();}
    await a.getByRole('button',{name:'이 계산으로 정산 확정',exact:true}).click();
    await b.getByText(/현재 내용 확정됨/).waitFor();
    await a.evaluate(async()=>{state.entries.find(e=>e.id==='shared-meal').amount=1200;await saveAndRender();});
    await b.getByText(/이전에 확정한 뒤 금액/).waitFor();
    console.log('PASS browser: server settlement finalization is shared and later financial edits invalidate it');
    // Review fixtures use the real current base so UI decisions go through the
    // same repository, command queue and PostgreSQL CAS as ordinary edits.
    await a.waitForFunction(()=>!window.TripLogSyncRepository.cached(state.id).queue.length);
    for (const page of pages) {
      await page.evaluate(async()=>{
        const R=window.TripLogSyncRepository,M=window.TripLogSyncModel;
        await R.update(state.id,r=>{
          const candidate=M.clone(r.snapshot);candidate.itineraryItems.find(i=>i.id==='kyoto').time='10:00';
          const patches=M.diff(M.encode(r.snapshot),M.encode(candidate)).filter(p=>p.id==='kyoto');
          const deleted=M.clone(r.snapshot);deleted.itineraryItems=deleted.itineraryItems.filter(i=>i.id!=='offline28');
          const removal=M.diff(M.encode(r.snapshot),M.encode(deleted)).filter(p=>p.id==='offline28');
          r.conflicts=[{id:'ui-review-time',source:'server',patches,snapshot:candidate,originalEntities:M.clone(r.base)}, {id:'ui-review-delete',source:'server',patches:removal,snapshot:deleted,originalEntities:M.clone(r.base)}];return r;
        });
      });
      await page.getByRole('button',{name:'저장 상태',exact:true}).click();
      await page.getByText('확인이 필요한 변경 2건',{exact:true}).waitFor();
      assert.equal(await page.locator('#itineraryPageButton [data-sync-label]').textContent(),'확인 2건');
      assert.equal(await page.locator('#sync-menu-status').getAttribute('aria-current'),'page');
      assert.equal(await page.locator('.sync-review-card').count(),2);
      assert.equal(await page.locator('.sync-review-card').first().locator('.is-local .sync-value').textContent(),'10:00');
      assert.equal(await page.locator('.sync-review-card').first().locator('.is-shared .sync-value').textContent(),'12:00');
      assert.equal(await page.locator('.sync-diagnostics').getAttribute('open'),null);
      assert.equal(await page.locator('.sync-content pre').count(),0);
      const dimensions=await page.locator('#triplogSyncStatus').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.clientHeight,viewport:innerHeight}));
      assert(dimensions.scroll<=dimensions.width+1,'Dialog must not scroll horizontally');
      assert(dimensions.height<=dimensions.viewport,'Dialog must stay within viewport');
    }
    await a.screenshot({path:path.join(output,'sync-design-desktop.png')});
    await b.screenshot({path:path.join(output,'sync-design-mobile.png')});
    await b.setViewportSize({width:360,height:800});
    await b.screenshot({path:path.join(output,'sync-design-mobile-360.png')});
    assert(await b.locator('.sync-tabs').evaluate(el=>el.scrollWidth>el.clientWidth),'Mobile menu must scroll instead of wrapping');
    await a.locator('.sync-diagnostics > summary').click();
    await a.evaluate(()=>window.dispatchEvent(new CustomEvent('triplog:presence',{detail:{tripId:state.id,members:{}}})));
    await a.locator('.sync-diagnostics[open]').waitFor();
    await a.locator('.sync-review-card').first().getByRole('button',{name:'내 변경 적용',exact:true}).click();
    await a.waitForFunction(()=>window.TripLogSyncRepository.cached(state.id).conflicts.length===1&&!window.TripLogSyncRepository.cached(state.id).queue.length);
    await b.waitForFunction(()=>state.itineraryItems.find(i=>i.id==='kyoto').time==='10:00');
    await a.getByRole('button',{name:'공유 내용 사용',exact:true}).click();
    await a.waitForFunction(()=>window.TripLogSyncRepository.cached(state.id).conflicts.length===0);
    assert(await a.evaluate(()=>state.itineraryItems.some(i=>i.id==='offline28')),'Shared choice must retain the item');
    const copiesBefore=await b.evaluate(async()=> (await window.TripLogSyncRepository.all()).length);
    await b.locator('.sync-review-card').first().getByRole('button',{name:'내 사본 보관 후 공유 내용 사용',exact:true}).click();
    await b.waitForFunction(()=>window.TripLogSyncRepository.cached(state.id).conflicts.length===1);
    assert.equal(await b.evaluate(async()=> (await window.TripLogSyncRepository.all()).length),copiesBefore+1);
    await b.getByRole('button',{name:'공유 내용 사용',exact:true}).click();
    await b.waitForFunction(()=>window.TripLogSyncRepository.cached(state.id).conflicts.length===0);
    await a.locator('.sync-close').click();
    await a.locator('#itineraryPageButton').click();
    await a.getByText('모두 저장됨',{exact:true}).last().waitFor();
    assert.equal(await a.locator('#triplogSyncStatus').getAttribute('open'),'');
    console.log('PASS browser: mockup desktop/mobile review, compact badge, correct comparisons, persistent disclosures, all three resolution choices and saved-state reopening');
    await a.locator('.sync-close').click();
    await a.evaluate(()=>{setActivePage('itinerary');startItineraryEdit(state.itineraryItems.find(i=>i.id==='offline28'));});
    await a.locator('#itineraryDeleteButton').click();
    await a.locator('#rdConfirm').getByRole('button',{name:'확인',exact:true}).click();
    await b.waitForFunction(()=>!state.itineraryItems.some(i=>i.id==='offline28'));
    await a.locator('#itineraryPageButton').click();await a.getByRole('button',{name:'변경 기록',exact:true}).click();
    await a.getByRole('button',{name:'이 변경 되돌리기',exact:true}).first().click();
    await a.locator('#rdConfirm').getByRole('button',{name:'확인',exact:true}).click();
    await b.waitForFunction(()=>state.itineraryItems.some(i=>i.id==='offline28'));
    await a.waitForFunction(()=>state.itineraryItems.some(i=>i.id==='offline28'));
    console.log('PASS browser: real delete control syncs, native history undo restores the same record on both devices without files');
    assert.deepEqual(errors,[]);
    console.log('PASS browser: quota failure keeps editor open; retry persists and shares input; no runtime errors');
  } catch (error) {
    for (const page of pages) console.error('Conflict detail:',JSON.stringify(await page.evaluate(()=>window.TripLogSyncRepository.cached(state.id)?.conflicts.map(c=>({source:c.source,patches:c.patches,details:c.details}))).catch(()=>[])));
    for (const page of pages) console.error(await page.evaluate(()=>({trip:state.id,page:activePage,items:state.itineraryItems.map(i=>({id:i.id,time:i.time,memo:i.memo})),engine:window.TripLog.sync.controller.engine.status(),queue:window.TripLogSyncRepository.cached(state.id)?.queue,conflicts:window.TripLogSyncRepository.cached(state.id)?.conflicts})).catch(()=>({closed:true})));
    throw error;
  } finally { await browser.close(); await db.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
