'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb');
const M=require('../src/app/sync/model');
const {createDatabase,actors}=require('./sync-database-regression');
async function main(){
  const trip={id:'member-splits',tripName:'멤버 분담',entries:[{id:'meal',date:'2026-11-03',amount:10000,category:'식비',description:'식사'}],itineraryItems:[],companions:[],packingList:[],collaboration:{privacy:{shareExpenses:true,shareItinerary:true}}};
  const next=M.clone(trip);next.settlement={itemSplits:{'current:meal':{mode:'custom',shares:{leader:4000,'companion:friend':6000}}}};
  // Derive against a decoded baseline, so the test exercises the same normalization as the app.
  const baseline=M.decode(M.encode(trip),trip),changed=M.clone(baseline);changed.settlement.itemSplits=next.settlement.itemSplits;
  const patches=M.diff(M.encode(baseline),M.encode(changed));assert(M.splitOnly(patches));
  assert(!M.splitOnly([{...patches[0],kind:'expense'}]));assert(!M.splitOnly([{...patches[0],fields:{'p:value':{},'p:role':'owner'}}]));
  const runtime=vm.createContext({console,crypto,structuredClone,CustomEvent,indexedDB:new IDBFactory(),TripLogSyncModel:M,dispatchEvent(){}});
  vm.runInContext(fs.readFileSync('src/app/sync/repository.js','utf8'),runtime);const R=runtime.TripLogSyncRepository;
  await R.update(trip.id,()=>({...R.makeRecord(baseline),role:'viewer'}));
  await R.save(changed,baseline);assert.equal((await R.read(trip.id)).snapshot.settlement.itemSplits['current:meal'].shares.leader,4000);
  await assert.rejects(R.save(changed,changed,{expectedScope:{accountId:'another-account'}}),/계정이 변경/);
  await assert.rejects(R.save({...changed,tripName:'cannot edit'},changed),/보기 전용/);R.close();
  const db=await createDatabase();
  try{
    const call=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args.map(value=>value&&typeof value==='object'?JSON.stringify(value):value))).rows[0].result;
    const id=await call('triplog_create_sync',[actors[0],trip.id,baseline,Object.values(M.encode(baseline))]);
    await db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'viewer','accepted')",[id,actors[2]]);
    const operation={protocolVersion:2,operationId:M.uuid(),patches};
    assert.equal((await call('triplog_apply_sync',[actors[2],id,operation])).status,'applied');
    assert.equal((await call('triplog_apply_sync',[actors[2],id,operation])).status,'applied');
    const read=await call('triplog_read_sync',[actors[2],id,null]);assert(read.entities.some(row=>row.kind==='split'));
    await assert.rejects(call('triplog_apply_sync',[actors[3],id,{...operation,operationId:M.uuid()}]),/FORBIDDEN/);
    await assert.rejects(call('triplog_apply_sync',[actors[2],id,{...operation,operationId:M.uuid(),patches:[{kind:'expense',id:'evil',action:'create',fields:{'g:money':{amount:1}}}]}]),/FORBIDDEN/);
    await call('triplog_sync_control',[actors[0],id,'privacy',{shareExpenses:false,shareItinerary:true,showMemberEmail:false,allowInviteRequests:true}]);
    await assert.rejects(call('triplog_apply_sync',[actors[2],id,{...operation,operationId:M.uuid()}]),/PRIVATE_DATA_NOT_SHARED/);
  }finally{await db.close();}
  console.log('PASS member splits: viewer allocation saves, SQL persistence/replay, outsider/mixed-write rejection and expense privacy.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
