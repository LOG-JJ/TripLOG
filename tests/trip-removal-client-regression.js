'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb');
const M=require('../src/app/sync/model');
const {createDatabase,actors}=require('./sync-database-regression');
async function run(){
 const db=await createDatabase(),clients=[];let loseResponse=false,capability=true;
 const rpc=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args.map(v=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].result;
 const source={id:'removal-client',tripName:'공동 여행',startDate:'2026-10-26',endDate:'2026-10-28',itineraryItems:[{id:'stop',date:'2026-10-26',time:'10:00',place:'보존할 장소'}],entries:[{id:'cost',date:'2026-10-26',description:'보존할 지출',amount:1000}],packingList:[],companions:[],collaboration:{privacy:{shareExpenses:true,shareItinerary:true}}};
 const tripId=await rpc('triplog_create_sync',[actors[0],source.id,source,Object.values(M.encode(source))]);
 await db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'editor','accepted')",[tripId,actors[1]]);
 const requests=[];
 async function client(actor){
  const context=vm.createContext({console,crypto,structuredClone,CustomEvent,indexedDB:new IDBFactory(),TripLogSyncModel:M,setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},dispatchEvent(){}});
  for(const file of ['repository','engine'])vm.runInContext(fs.readFileSync(`src/app/sync/${file}.js`,'utf8'),context);
  const R=context.TripLogSyncRepository;await R.migrate([]);
  const transport={async request(body){
   requests.push({actor,...body});
   if(body.action==='list'){
    const trips=[];for(const row of (await db.query('select id,owner_id from public.triplog_trips')).rows)if(await rpc('triplog_sync_role',[actor,row.id]))trips.push({...await rpc('triplog_read_sync',[actor,row.id,null]),ownerId:row.owner_id});
    return{protocolVersion:2,...(capability?{tripRemovalVersion:1}:{}),trips};
   }
   if(body.action==='read')return rpc('triplog_read_sync',[actor,body.tripId,body.after??null]);
   if(body.action==='remove-trip'){const result=await rpc('triplog_remove_trip',[actor,body.tripId,body.operationId]);if(loseResponse){loseResponse=false;throw new Error('NETWORK_ERROR');}return result;}
   if(body.action==='apply')return rpc('triplog_apply_sync',[actor,body.tripId,body.operation]);
   throw new Error('Unexpected request '+body.action);
  }};
  const engine=context.TripLogSyncEngine.createEngine({repository:R,transport});await engine.start(actor,'fixture-project');
  const value={R,engine};clients.push(value);return value;
 }
 try{
  const a=await client(actors[0]),otherDevice=await client(actors[0]),b=await client(actors[1]);
  const localId=(await a.R.all())[0].localId;
  const snapshot=M.clone((await a.R.read(localId)).snapshot);
  await a.R.draft('kept-draft',{tripId:localId,fields:{memo:{value:'기기 초안'}}});
  await a.R.update(localId,r=>r,{snapshot:true});
  loseResponse=true;await assert.rejects(a.engine.removeTrip(localId),/NETWORK_ERROR/);
  let record=await a.R.read(localId);assert(record.removal?.id);assert(!record.hidden);
  const edit=M.clone(snapshot);edit.itineraryItems[0].place='삭제 도중 수정';
  await assert.rejects(a.R.save(edit,snapshot),/삭제 결과/);
  await a.engine.refresh();assert(!(await a.R.read(localId)).removedAt,'An uncertain own request waits for its receipt');
  assert.equal((await a.engine.removeTrip(localId)).serverDeleted,false);
  const removalRequests=requests.filter(row=>row.actor===actors[0]&&row.action==='remove-trip');
  assert.equal(removalRequests.length,2);assert.equal(removalRequests[0].operationId,removalRequests[1].operationId);
  record=await a.R.read(localId);assert(record.removedAt);assert.equal(record.snapshot.itineraryItems.length,0);assert.equal((await a.R.snapshots(localId)).length,0);assert.equal(await a.R.draft('kept-draft'),null);
  await assert.rejects(a.R.save(edit,snapshot),/TRIP_REMOVED/);
  await assert.rejects(a.R.update(localId,r=>({...r,hidden:false})),/TRIP_REMOVED/);
  await assert.rejects(a.R.draft('late-draft',{tripId:localId,fields:{memo:{value:'오래 열린 편집창'}}}),/TRIP_REMOVED/);
  assert.equal(await a.R.draft('late-draft'),null,'A stale editor cannot recreate deleted local content');
  await otherDevice.engine.refresh();assert((await otherDevice.R.all()).some(row=>row.serverId===tripId&&row.removedAt),'Other devices remove revoked membership without recreating the trip');
  await b.engine.refresh();let survivor=(await b.R.all()).find(row=>row.serverId===tripId);
  assert.equal(survivor.role,'owner');assert.equal(survivor.snapshot.itineraryItems[0].place,'보존할 장소');assert.equal(survivor.snapshot.entries[0].amount,1000);

  // Only an explicit accepted invite can revive a previously removed local ID.
  await db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'viewer','accepted')",[tripId,actors[0]]);
  const remote={...await rpc('triplog_read_sync',[actors[0],tripId,null]),ownerId:actors[1]};
  await a.engine.acceptRemote(remote);assert((await a.R.read(localId)).removedAt);
  await a.engine.acceptRemote(remote,undefined,{restoreRemoved:true});assert(!(await a.R.read(localId)).removedAt);
  await a.engine.removeTrip(localId);
  loseResponse=true;await assert.rejects(b.engine.removeTrip(survivor.localId),/NETWORK_ERROR/);
  assert.equal((await b.engine.removeTrip(survivor.localId)).serverDeleted,true,'A last-member retry succeeds after the server trip is gone');
  assert.equal((await db.query('select count(*)::int n from public.triplog_trips where id=$1',[tripId])).rows[0].n,0);
  assert((await b.R.read(survivor.localId)).removedAt);
  const offlineId='legacy-offline';await otherDevice.R.update(offlineId,()=>({...otherDevice.R.makeRecord({...source,id:offlineId}),accountId:actors[0],projectId:'fixture-project',serverId:M.uuid()}));
  capability=false;await otherDevice.engine.refresh();assert(!(await otherDevice.R.read(offlineId)).removedAt,'An older server without the capability cannot purge device records');
  console.log('PASS trip removal client: lost-response ID reuse, pending-write guard, local record/history/draft purge, other-device cleanup, retained companion data/ownership, stale-tab rejection, explicit rejoin and older-server compatibility.');
 }finally{for(const c of clients){c.engine.stop();c.R.close();}await db.close();}
}
module.exports={run};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
