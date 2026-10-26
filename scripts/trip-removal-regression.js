'use strict';
const assert=require('node:assert/strict');
const M=require('../src/app/sync/model');
const {createDatabase,actors}=require('./sync-database-regression');
async function run(existing){
 const db=existing||await createDatabase();
 const rpc=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args.map(v=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].result;
 const seed={id:'remove-fixture',tripName:'삭제 규칙 검증',startDate:'2026-10-26',endDate:'2026-10-28',itineraryItems:[{id:'hotel',date:'2026-10-26',time:'18:00',endTime:'19:00',place:'예약 숙소'}],entries:[{id:'paid',date:'2026-10-26',amount:10000,description:'공동 지출'}],packingList:[],companions:[]};
 const create=(actor,id=M.uuid())=>rpc('triplog_create_sync',[actor,id,{...seed,id},Object.values(M.encode({...seed,id}))]);
 const remove=(actor,id,op=M.uuid())=>rpc('triplog_remove_trip',[actor,id,op]);
 const member=(id,actor,role='editor',status='accepted')=>db.query('insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,$3,$4)',[id,actor,role,status]);
 const count=async(table,id)=>(await db.query(`select count(*)::int n from public.${table} where ${table==='triplog_trips'?'id':'trip_id'}=$1`,[id])).rows[0].n;
 try{
  const solo=await create(actors[0]),op=M.uuid();
  await member(solo,actors[1],'viewer','pending');
  const digest='a'.repeat(64),objectPath=`${solo}/${digest}`;
  await db.query("insert into public.triplog_attachments(trip_id,digest,object_path,content_type,byte_size,created_by) values($1,$2,$3,'application/pdf',5,$4)",[solo,digest,objectPath,actors[0]]);
  await assert.rejects(remove(actors[2],solo),/FORBIDDEN/);
  const result=await remove(actors[0],solo,op);
  assert.deepEqual(result,{ok:true,removed:true,serverDeleted:true,remainingMembers:0});
  for(const table of ['triplog_trips','triplog_trip_members','triplog_trip_invites','triplog_entities','triplog_change_log','triplog_operation_receipts','triplog_recovery_snapshots','triplog_settlement_snapshots','triplog_attachments','triplog_notification_outbox'])assert.equal(await count(table,solo),0,`${table} must be purged`);
  assert.deepEqual((await db.query('select object_paths from public.triplog_attachment_cleanup where trip_id=$1',[solo])).rows[0].object_paths,[objectPath]);
  assert.deepEqual(await remove(actors[0],solo,op),result,'Lost-response replay returns the existing result');
  const other=await create(actors[0]);
  await assert.rejects(remove(actors[0],other,op),/OPERATION_ID_REUSED/);
  assert.equal(await count('triplog_trips',other),1);

  const appId=M.uuid(),shared=await create(actors[0],appId),collision=await create(actors[1],appId);
  await member(shared,actors[1]);await member(shared,actors[2],'viewer');
  await db.query("insert into public.triplog_trip_invites(token,trip_id,app_trip_id,trip_name,created_by,expires_at) values($1,$2,$3,'초대',$4,now()+interval '1 day')",[M.uuid(),shared,appId,actors[0]]);
  const before=M.fromRows((await rpc('triplog_read_sync',[actors[1],shared,null])).entities);
  const firstOp=M.uuid();
  assert.deepEqual(await remove(actors[0],shared,firstOp),{ok:true,removed:true,serverDeleted:false,remainingMembers:2});
  let trip=(await db.query('select owner_id,archived_at,app_trip_id from public.triplog_trips where id=$1',[shared])).rows[0];
  assert.equal(trip.owner_id,actors[1]);assert.equal(trip.archived_at,null);assert.notEqual(trip.app_trip_id,appId,'A colliding local alias cannot prevent owner transfer');
  assert.equal(await count('triplog_trips',collision),1,'A separate trip owned by the next owner is unchanged');
  assert.deepEqual(M.fromRows((await rpc('triplog_read_sync',[actors[1],shared,null])).entities),before,'Remaining companions retain every shared item');
  await assert.rejects(rpc('triplog_read_sync',[actors[0],shared,null]),/FORBIDDEN/);
  assert.equal((await db.query('select status from public.triplog_trip_invites where trip_id=$1',[shared])).rows[0].status,'revoked');
  assert.equal((await remove(actors[1],shared)).remainingMembers,1);
  trip=(await db.query('select owner_id from public.triplog_trips where id=$1',[shared])).rows[0];assert.equal(trip.owner_id,actors[2]);
  assert.equal((await remove(actors[2],shared)).serverDeleted,true);
  assert.equal(await count('triplog_trips',shared),0);
  assert.equal((await remove(actors[0],shared,firstOp)).serverDeleted,false,'An old leave retry never removes a later member');
  await assert.rejects(remove(actors[0],shared),/FORBIDDEN/);

  const pair=await create(actors[0]);await member(pair,actors[1]);
  const pairResults=await Promise.all([remove(actors[0],pair),remove(actors[1],pair)]);
  assert.equal(pairResults.filter(row=>row.serverDeleted).length,1);assert.equal(await count('triplog_trips',pair),0);
  await db.exec('set role authenticated;');
  await assert.rejects(remove(actors[0],other),/permission denied/);
  await assert.rejects(db.query('select * from public.triplog_trip_removal_receipts'),/permission denied/);
  await db.exec('reset role;');
  console.log('PASS trip removal SQL: solo/last-member purge, pending-member exclusion, retained companion data, owner transfer/alias collision, idempotent replay, nonmember/role isolation, attachment cleanup outbox and unrelated-trip preservation.');
 }finally{if(!existing)await db.close();}
}
module.exports={run};
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
