const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { IDBFactory } = require('fake-indexeddb');
const M = require('../src/app/sync/model');
const { createDatabase, actors } = require('./sync-database-regression');

function runtime(factory = new IDBFactory()) {
  const timers=new Map(),intervals=new Map();let timerId=0;
  const context=vm.createContext({console,crypto,structuredClone,CustomEvent,indexedDB:factory,TripLogSyncModel:M,
    setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},setInterval(fn){intervals.set(++timerId,fn);return timerId;},clearInterval(id){intervals.delete(id);},dispatchEvent(){}});
  for(const file of ['repository','engine'])vm.runInContext(fs.readFileSync(`src/app/sync/${file}.js`,'utf8'),context);
  return {R:context.TripLogSyncRepository,factory,timers,intervals,engineFactory:context.TripLogSyncEngine,
    async flush(engine){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());for(let n=0;engine.status().running&&n<1000;n++)await new Promise(resolve=>setTimeout(resolve,2));assert.equal(engine.status().running,false);}};
}

async function main(){
  const viewRuntime=runtime();
  async function legacyView(id) {
    const source={id,tripName:'표시 정규화 검증',itineraryItems:[{id:'old',date:'2026-09-26',place:'후시미이나리',location:'old location',lat:34.9688924,lon:135.7692389,coordinateSource:'',coordinateSignature:'old',memo:'기존 메모'}],entries:[],companions:[],packingList:[]};
    await viewRuntime.R.update(id,()=>viewRuntime.R.makeRecord(source));
    const shown=M.clone(source);delete shown.itineraryItems[0].lat;delete shown.itineraryItems[0].lon;delete shown.itineraryItems[0].coordinateSignature;
    return {source,shown};
  }
  {
    const {source,shown}=await legacyView('view-noop');
    await viewRuntime.R.save(shown,shown,{sourceSnapshot:source});
    const saved=await viewRuntime.R.read(source.id);
    assert.equal(saved.localRevision,0);assert.equal(saved.snapshot.itineraryItems[0].lat,source.itineraryItems[0].lat);
  }
  {
    const {source,shown}=await legacyView('view-edit');
    await viewRuntime.R.update(source.id,r=>{r.snapshot.itineraryItems[0].memo='다른 탭 메모';return r;});
    const edited=M.clone(shown);edited.itineraryItems[0].place='새 장소';
    await viewRuntime.R.save(edited,shown,{sourceSnapshot:source});
    const saved=await viewRuntime.R.read(source.id);
    assert.equal(saved.conflicts.length,0);assert.equal(saved.snapshot.itineraryItems[0].place,'새 장소');assert.equal(saved.snapshot.itineraryItems[0].memo,'다른 탭 메모');
  }
  {
    const {source,shown}=await legacyView('view-delete');
    const deleted={...shown,itineraryItems:[]};
    await viewRuntime.R.save(deleted,shown,{sourceSnapshot:source,deletions:[{kind:'itinerary',id:'old'}]});
    const saved=await viewRuntime.R.read(source.id);assert.equal(saved.conflicts.length,0);assert.equal(saved.snapshot.itineraryItems.length,0);
    assert.ok((await viewRuntime.R.snapshots(source.id)).some(row=>row.state.itineraryItems[0]?.place==='후시미이나리'));
  }
  for(const action of ['place','delete']) {
    const {source,shown}=await legacyView('view-concurrent-'+action);
    // Even a concurrent raw-coordinate change remains protected; comparing
    // normalized fresh state alone would incorrectly overlook this change.
    await viewRuntime.R.update(source.id,r=>{r.snapshot.itineraryItems[0].lat=35;return r;});
    const edited=M.clone(shown);if(action==='delete')edited.itineraryItems=[];else edited.itineraryItems[0].place='내 수정';
    await viewRuntime.R.save(edited,shown,{sourceSnapshot:source,deletions:action==='delete'?[{kind:'itinerary',id:'old'}]:[]});
    const saved=await viewRuntime.R.read(source.id);assert.equal(saved.conflicts.length,1);assert.equal(saved.snapshot.itineraryItems[0].lat,35);assert.equal(saved.snapshot.itineraryItems[0].place,'후시미이나리');
  }
  viewRuntime.R.close();
  console.log('PASS: rendered legacy cleanup is not a write/conflict; edits/deletes use their exact stored baseline, preserve independent changes and protect genuinely changed raw fields');
  const db=await createDatabase();
  const rpc=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args.map(v=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].result;
  const snapshot={id:'client-trip',tripName:'클라이언트 회귀',startDate:'2026-09-25',endDate:'2026-09-28',entries:[],packingList:[],companions:[],itineraryItems:[{id:'one',date:'2026-09-26',time:'10:00',place:'교토역'}],collaboration:{privacy:{shareExpenses:true,shareItinerary:true}}};
  const tid=await rpc('triplog_create_sync',[actors[0],snapshot.id,snapshot,Object.values(M.encode(snapshot))]);
  await db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'editor','accepted')",[tid,actors[1]]);
  let offline=false,loseResponse=false,midUpload,duringPrepare;
  function transport(actor){return{async preparePatches(id,patches){if(duringPrepare){const callback=duringPrepare;duringPrepare=null;await callback();}return patches;},async request(body){
    if(offline)throw new Error('NETWORK_ERROR');
    if(body.action==='list')return{protocolVersion:2,trips:[await rpc('triplog_read_sync',[actor,tid,null])]};
    if(body.action==='read')return rpc('triplog_read_sync',[actor,body.tripId,body.after??null]);
    if(body.action==='apply'){
      if(midUpload){const cb=midUpload;midUpload=null;await cb();}
      const result=await rpc('triplog_apply_sync',[actor,body.tripId,body.operation]);
      if(loseResponse){loseResponse=false;throw new Error('NETWORK_ERROR');}
      return result;
    }
    throw new Error('UNEXPECTED_ACTION:'+body.action);
  }}};
  const a=runtime(),b=runtime();
  await a.R.migrate([snapshot]);await b.R.migrate([snapshot]);
  a.engine=a.engineFactory.createEngine({repository:a.R,transport:transport(actors[0])});
  b.engine=b.engineFactory.createEngine({repository:b.R,transport:transport(actors[1])});
  await a.engine.start(actors[0]);await b.engine.start(actors[1]);
  assert.equal((await a.R.read(snapshot.id)).conflicts.length,0);
  async function edit(device,update){const before=(await device.R.read(snapshot.id)).snapshot;const next=M.clone(before);update(next);await device.R.save(next,before);}
  await edit(a,s=>s.itineraryItems[0].place='清水寺');
  await edit(b,s=>s.itineraryItems[0].time='12:00');
  await a.flush(a.engine);await b.flush(b.engine);await a.engine.pump();
  for(const d of [a,b]){const s=(await d.R.read(snapshot.id)).snapshot;assert.equal(s.itineraryItems[0].place,'清水寺');assert.equal(s.itineraryItems[0].time,'12:00');}
  console.log('PASS: automatic wake and independent-field convergence across two devices');
  await edit(a,s=>s.itineraryItems[0].time='13:00');await edit(b,s=>s.itineraryItems[0].time='14:00');
  await a.engine.pump();await b.engine.pump();
  assert.equal((await b.R.read(snapshot.id)).conflicts.length,1);
  await edit(b,s=>s.itineraryItems.push({id:'two',date:'2026-09-27',time:'10:00',place:'嵐山'}));await b.engine.pump();
  assert.ok((await rpc('triplog_read_sync',[actors[0],tid,null])).entities.some(e=>e.entity_id==='two'));
  console.log('PASS: true conflict preserves the candidate without blocking independent items');
  const conflict=(await b.R.read(snapshot.id)).conflicts[0];await b.engine.resolve(snapshot.id,conflict.id,'server');
  offline=true;await edit(b,s=>s.itineraryItems.push({id:'offline',date:'2026-09-28',place:'帰国'}));await b.engine.pump();
  assert.ok((await b.R.read(snapshot.id)).queue.length);
  b.engine.stop();b.R.close();
  const reboot=runtime(b.factory);await reboot.R.migrate([]);reboot.engine=reboot.engineFactory.createEngine({repository:reboot.R,transport:transport(actors[1])});
  offline=false;await reboot.engine.start(actors[1]);await reboot.flush(reboot.engine);
  assert.ok((await rpc('triplog_read_sync',[actors[0],tid,null])).entities.some(e=>e.entity_id==='offline'));
  console.log('PASS: saved offline itinerary survives runtime restart and automatically uploads');
  await a.engine.pump();
  midUpload=()=>edit(a,s=>s.itineraryItems[0].memo='전송 중 추가 저장');
  await edit(a,s=>s.itineraryItems[0].place='金閣寺');await a.engine.pump();
  assert.equal((await a.R.read(snapshot.id)).queue.length,0);
  assert.equal((await a.R.read(snapshot.id)).snapshot.itineraryItems[0].memo,'전송 중 추가 저장');
  console.log('PASS: edits made while an upload is in flight remain queued and are delivered');
  loseResponse=true;await edit(a,s=>s.entries.push({id:'expense-once',amount:1000,description:'버스'}));await a.engine.pump();
  const beforeHead=(await rpc('triplog_read_sync',[actors[0],tid,null])).head;
  await a.engine.pump();assert.equal((await rpc('triplog_read_sync',[actors[0],tid,null])).head,beforeHead);
  console.log('PASS: commit with a lost response is retried without duplication');
  const tab=runtime(a.factory);await tab.R.migrate([]);
  const original=(await a.R.read(snapshot.id)).snapshot;
  const first=M.clone(original);first.itineraryItems[0].memo='탭 A';
  const second=M.clone(original);second.itineraryItems[0].memo='탭 B';
  await a.R.save(first,original);await tab.R.save(second,original);
  assert.ok((await tab.R.read(snapshot.id)).conflicts.some(c=>c.source==='tab'));
  assert.equal((await tab.R.read(snapshot.id)).snapshot.itineraryItems[0].memo,'탭 A');
  console.log('PASS: two tabs detect conflicting edits using the atomic local repository');
  await a.engine.pump();
  for(const c of (await a.R.read(snapshot.id)).conflicts)await a.engine.resolve(snapshot.id,c.id,'server');
  await edit(a,s=>s.itineraryItems[0].memo='준비 중 초안');
  duringPrepare=()=>a.R.update(snapshot.id,record=>{const intent=record.queue.find(q=>q.status==='queued'&&!q.request);intent.patches[0].fields['p:memo']='준비 도중 합쳐진 최신 초안';return record;});
  await a.engine.pump();
  assert.equal((await a.R.read(snapshot.id)).snapshot.itineraryItems[0].memo,'준비 도중 합쳐진 최신 초안');
  console.log('PASS: coalesced edits cannot disappear while an immutable request is prepared');
  await edit(a,s=>s.itineraryItems[0].memo='삭제와 겹친 내 수정');
  const beforeRemoval=M.fromRows((await rpc('triplog_read_sync',[actors[1],tid,null])).entities),afterRemoval=M.clone(beforeRemoval);delete afterRemoval[M.key('itinerary','one')];
  await rpc('triplog_apply_sync',[actors[1],tid,{protocolVersion:2,operationId:M.uuid(),patches:M.diff(beforeRemoval,afterRemoval)}]);
  await a.engine.pump();
  const conflicted=await a.R.read(snapshot.id);
  assert.equal(conflicted.snapshot.itineraryItems.find(i=>i.id==='one').memo,'삭제와 겹친 내 수정');
  await a.engine.resolve(snapshot.id,conflicted.conflicts[0].id,'copy');
  assert.ok((await a.R.all()).some(r=>r.quarantined&&r.snapshot.itineraryItems.some(i=>i.id==='one'&&i.memo==='삭제와 겹친 내 수정')));
  console.log('PASS: deleted-target conflicts keep the complete edited item and recover it in a separate copy');
  const privateDevice=runtime(),privateTrip={...M.clone(snapshot),id:'private-trip',totalBudget:1000,entries:[{id:'private-expense',amount:100}],companions:[{id:'private-person',name:'동행',individualSpent:200}],collaboration:{privacy:{shareItinerary:true,shareExpenses:false}}};
  await privateDevice.R.migrate([privateTrip]);
  await privateDevice.R.update(privateTrip.id,r=>({...r,base:M.encode(r.snapshot),role:'owner'}));
  const privateBefore=(await privateDevice.R.read(privateTrip.id)).snapshot,privateAfter=M.clone(privateBefore);privateAfter.entries[0].amount=150;privateAfter.totalBudget=2000;privateAfter.companions[0].individualSpent=300;
  await privateDevice.R.save(privateAfter,privateBefore);assert.equal((await privateDevice.R.read(privateTrip.id)).queue.length,0);
  const remotePrivate=M.encode(privateTrip);remotePrivate['itinerary:one'].fields['g:place'].place='공유 장소 변경';await privateDevice.R.receive(privateTrip.id,remotePrivate,1);
  const retained=(await privateDevice.R.read(privateTrip.id)).snapshot;assert.equal(retained.entries[0].amount,150);assert.equal(retained.totalBudget,2000);assert.equal(retained.companions[0].individualSpent,300);
  const shared=M.shared(M.encode(retained),retained.collaboration.privacy);assert.equal(shared['participant:private-person'].fields['p:individualSpent'],undefined);assert.equal(shared['trip:settings'].fields['p:totalBudget'],undefined);
  console.log('PASS: private expenses, budget and personal spending stay local during unrelated shared updates');
  const scoped=runtime();await scoped.R.migrate([]);let finishOld;
  const remote=await rpc('triplog_read_sync',[actors[0],tid,null]);
  const scopedEngine=scoped.engineFactory.createEngine({repository:scoped.R,transport:{request:body=>body.action==='list'&&!finishOld?new Promise(resolve=>{finishOld=()=>resolve({protocolVersion:2,trips:[remote]});}):Promise.resolve({protocolVersion:2,trips:[]})}});
  const oldSession=scopedEngine.start(actors[0],'project-a');
  while(!finishOld)await new Promise(resolve=>setTimeout(resolve,1));
  await scopedEngine.start(actors[1],'project-b');finishOld();await oldSession;
  assert.equal((await scoped.R.all()).length,0);assert.equal(scopedEngine.status().accountId,actors[1]);
  scopedEngine.stop();scoped.R.close();privateDevice.R.close();
  console.log('PASS: a delayed response from the previous account/project cannot import into the new session');
  const memberDevice=runtime();await memberDevice.R.migrate([{...M.clone(snapshot),id:'member-owned-device',collaboration:{ownerId:actors[0],privacy:{shareItinerary:true,shareExpenses:true}}}],{accountId:actors[1]});
  assert.equal((await memberDevice.R.read('member-owned-device')).accountId,actors[1]);
  assert.equal((await memberDevice.R.read('member-owned-device')).snapshot.collaboration.ownerId,actors[0]);
  memberDevice.R.close();
  console.log('PASS: migration binds a shared trip to the device account, not to the trip owner');
  const legacy=runtime(), cloudTrip={...M.clone(snapshot),id:'stale-device',totalBudget:900000,itineraryItems:Array.from({length:18},(_,i)=>({id:'day-'+i,date:'2026-09-26',place:'장소 '+i})),entries:[{id:'paid',date:'2026-09-26',amount:5000}]};
  const cloudId=await rpc('triplog_create_sync',[actors[0],cloudTrip.id,cloudTrip,Object.values(M.encode(cloudTrip))]);
  const staleTrip={...M.clone(cloudTrip),totalBudget:100000,itineraryItems:cloudTrip.itineraryItems.slice(0,5),entries:[]};
  staleTrip.itineraryItems.push({id:'device-only',date:'2026-09-27',place:'기기에만 있던 새 일정'});
  await legacy.R.migrate([staleTrip],{accountId:actors[0]});
  const cloudTrips=[cloudId];
  const safeTransport={async request(body){
    if(body.action==='list')return {protocolVersion:2,trips:await Promise.all(cloudTrips.map(id=>rpc('triplog_read_sync',[actors[0],id,null])))};
    if(body.action==='read')return rpc('triplog_read_sync',[actors[0],body.tripId,body.after??null]);
    if(body.action==='apply'){
      assert.equal(body.writeVersion,3);
      assert.ok(body.operation.patches.every(p=>p.action!=='delete'||body.deletions.some(d=>d.kind===p.kind&&d.id===p.id)));
      return rpc('triplog_apply_sync',[actors[0],body.tripId,body.operation]);
    }
    throw new Error('UNEXPECTED_ACTION');
  }};
  legacy.engine=legacy.engineFactory.createEngine({repository:legacy.R,transport:safeTransport});await legacy.engine.start(actors[0]);await legacy.engine.pump();
  let reconciled=await legacy.R.read(cloudTrip.id);
  assert.equal(reconciled.snapshot.itineraryItems.length,19);assert.equal(reconciled.snapshot.entries.length,1);assert.equal(reconciled.snapshot.totalBudget,900000);assert.equal(reconciled.conflicts.length,0);
  assert.ok((await legacy.R.snapshots(cloudTrip.id)).some(s=>s.state.itineraryItems.length===6));
  assert.equal((await rpc('triplog_read_sync',[actors[0],cloudId,null])).entities.filter(e=>e.kind==='itinerary'&&!e.deleted_at).length,19);
  console.log('PASS: a stale 5-item device cannot delete 13 cloud items or roll back budget; unique offline additions merge automatically');
  const partial=M.clone(reconciled.snapshot);partial.itineraryItems=partial.itineraryItems.slice(0,5);partial.entries=[];
  await assert.rejects(legacy.R.save(partial,reconciled.snapshot),/삭제/);
  assert.equal((await legacy.R.read(cloudTrip.id)).snapshot.itineraryItems.length,19);
  const deleting=M.clone(reconciled.snapshot);deleting.itineraryItems=deleting.itineraryItems.filter(i=>i.id!=='device-only');
  await legacy.R.save(deleting,reconciled.snapshot,{deletions:[{kind:'itinerary',id:'device-only'}]});await legacy.engine.pump();
  assert.ok((await rpc('triplog_read_sync',[actors[0],cloudId,null])).entities.find(e=>e.entity_id==='device-only').deleted_at);
  console.log('PASS: implicit snapshot removals are rejected atomically; explicit item deletion still synchronizes');
  const nextId=await rpc('triplog_create_sync',[actors[0],'created-elsewhere',{...cloudTrip,id:'created-elsewhere'},Object.values(M.encode(cloudTrip))]);cloudTrips.push(nextId);
  for(const poll of legacy.intervals.values())poll();
  for(let n=0;n<200&&!((await legacy.R.all()).some(r=>r.serverId===nextId));n++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.ok((await legacy.R.all()).some(r=>r.serverId===nextId));
  console.log('PASS: the automatic poll discovers a trip created on another device without reload or reconnect');
  await legacy.engine.refresh();legacy.engine.stop();legacy.R.close();
  for(const d of [a,b,reboot])d.engine.stop();for(const d of [a,b,reboot,tab])d.R.close();await db.close();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
