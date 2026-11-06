const assert = require('node:assert/strict');
const Y = require('yjs');
const M = require('../src/app/sync/model');
const settlement = require('../src/app/sync/settlement-model');
const { createDatabase, actors } = require('./sync-database-regression');
async function main() {
  const db=await createDatabase();
  try {
    await db.exec("create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$ insert into realtime.messages(topic,extension) values(topic,'broadcast') $$;");
    const rpc=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args.map(v=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].result;
    const seed={id:'service-tests',tripName:'서비스 검증',startDate:'2026-09-25',endDate:'2026-09-28',itineraryItems:[],entries:[],packingList:[],companions:[],collaboration:{privacy:{shareItinerary:true,shareExpenses:true,showMemberEmail:false,allowInviteRequests:true}}};
    const tid=await rpc('triplog_create_sync',[actors[0],seed.id,seed,Object.values(M.encode(seed))]);
    await db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'editor','accepted')",[tid,actors[1]]);
    const read=()=>rpc('triplog_read_sync',[actors[0],tid,null]);
    const apply=patches=>rpc('triplog_apply_sync',[actors[0],tid,{protocolVersion:2,operationId:M.uuid(),patches}]);
    const initial=M.fromRows((await read()).entities);
    const linked=M.clone(seed);linked.itineraryItems=[{id:'linked',date:'2026-09-26',place:'교토역',syncExpense:true,expenseId:'bus',cost:2000}];linked.entries=[{id:'bus',date:'2026-09-26',amount:2000}];
    await apply(M.diff(initial,M.encode(linked)));
    let baseline=M.fromRows((await read()).entities),after=M.clone(baseline);after['expense:bus'].fields['g:money'].amount=3000;
    await assert.rejects(apply(M.diff(baseline,after)),/INVALID_LINKED_EXPENSE/);
    assert.equal((await read()).head,1,'Broken linked transaction rolls back its cursor as well');
    after['itinerary:linked'].fields['g:transit'].cost=3000;await apply(M.diff(baseline,after));
    baseline=M.fromRows((await read()).entities);after=M.clone(baseline);after['itinerary:linked'].fields['g:schedule'].date='2026-02-31';
    await assert.rejects(apply(M.diff(baseline,after)),/INVALID_DATE/);
    const pretrip={kind:'expense',id:'pretrip',fields:{'p:date':'__pretrip__','g:money':{amount:50000}}};await apply(M.diff({}, {[M.key(pretrip.kind,pretrip.id)]:pretrip}));
    await assert.rejects(apply([{kind:'itinerary',id:'fake-attachment',action:'create',fields:{'g:voucher':{voucherFile:'triplog-attachment:'+'a'.repeat(64)}}}]),/INVALID_ATTACHMENT_REFERENCE/);
    await assert.rejects(apply([{kind:'expense',id:'duplicate',action:'create',fields:{}},{kind:'expense',id:'duplicate',action:'delete'}]),/DUPLICATE/);
    console.log('PASS service: linked ledger atomicity, invalid dates, valid prepurchases, attachment isolation, duplicate-patch rejection');

    baseline=M.fromRows((await read()).entities);after=M.clone(baseline);delete after['itinerary:linked'];delete after['expense:bus'];
    const removal=await apply(M.diff(baseline,after)),restoreId=M.uuid();
    await assert.rejects(rpc('triplog_restore_change',[actors[1],tid,removal.cursor,M.uuid()]),/FORBIDDEN/);
    const restored=await rpc('triplog_restore_change',[actors[0],tid,removal.cursor,restoreId]);
    assert.ok(restored.changes.some(e=>e.entity_id==='linked'&&!e.deleted_at));
    assert.ok(restored.changes.some(e=>e.entity_id==='bus'&&!e.deleted_at));
    assert.equal((await rpc('triplog_restore_change',[actors[0],tid,removal.cursor,restoreId])).cursor,restored.cursor);
    assert.equal((await read()).head,restored.cursor);
    await assert.rejects(rpc('triplog_restore_change',[actors[0],tid,removal.cursor,M.uuid()]),/HISTORY_CHANGED/);
    assert.equal((await read()).head,restored.cursor);
    await db.exec('set role authenticated;');
    await assert.rejects(rpc('triplog_restore_change',[actors[0],tid,removal.cursor,M.uuid()]),/permission denied/);
    await db.exec('reset role;');
    console.log('PASS service: atomic in-place recovery of deleted linked records, idempotent retry, newer-edit protection and restore permissions');

    const incidentSeed={...seed,id:'incident-repair',itineraryItems:Array.from({length:18},(_,i)=>({id:'incident-day-'+i,date:'2026-09-26',place:'장소 '+i})),entries:Array.from({length:8},(_,i)=>({id:'incident-paid-'+i,date:'2026-09-26',amount:1000})),settlement:{itemSplits:{'current:incident-paid-7':{mode:'equal',shares:{}}}}};
    const incidentTrip=await rpc('triplog_create_sync',[actors[0],incidentSeed.id,incidentSeed,Object.values(M.encode(incidentSeed))]);
    const incidentBefore=M.fromRows((await rpc('triplog_read_sync',[actors[0],incidentTrip,null])).entities),incidentAfter=M.clone(incidentBefore);
    for(const [key,e] of Object.entries(incidentAfter)){
      if((e.kind==='itinerary'&&Number(e.id.split('-').at(-1))>=5)||(e.kind==='expense'&&e.id==='incident-paid-7')||e.kind==='split')delete incidentAfter[key];
      else if(['itinerary','expense'].includes(e.kind))e.fields['p:memo']='오래된 값';
    }
    await db.query('update public.triplog_trips set sync_revision=87 where id=$1',[incidentTrip]);
    const incidentResult=await rpc('triplog_apply_sync',[actors[0],incidentTrip,{protocolVersion:2,operationId:M.uuid(),patches:M.diff(incidentBefore,incidentAfter)}]);
    assert.equal(incidentResult.cursor,88);assert.equal(incidentResult.changes.length,27);
    await db.query("update public.triplog_change_log set created_at='2026-09-21 10:20:27.135086+00' where trip_id=$1 and sequence=88",[incidentTrip]);
    const repair=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supabase/migrations/20260921134941_restore_stale_snapshot_incident.sql'),'utf8');
    await db.exec(repair);await db.exec(repair);
    const incidentRepaired=await rpc('triplog_read_sync',[actors[0],incidentTrip,null]);
    assert.equal(incidentRepaired.head,89);assert.equal(incidentRepaired.entities.filter(e=>e.kind==='itinerary'&&!e.deleted_at).length,18);assert.equal(incidentRepaired.entities.filter(e=>e.kind==='expense'&&!e.deleted_at).length,8);
    for(const e of incidentRepaired.entities)assert.deepEqual(e.data,incidentBefore[M.key(e.kind,e.entity_id)].fields);
    console.log('PASS service: exact incident repair restores 18 schedules and 8 expenses, all previous values, and remains idempotent');

    const participantOperation={protocolVersion:2,operationId:M.uuid(),patches:[{kind:'participant',id:'private-paid',action:'create',fields:{'p:name':'동행','p:individualSpent':5000}}]};
    await rpc('triplog_apply_sync',[actors[1],tid,participantOperation]);

    const privacy=seed.collaboration.privacy;
    await rpc('triplog_sync_control',[actors[0],tid,'privacy',{...privacy,shareExpenses:false,_expected:privacy}]);
    await rpc('triplog_sync_control',[actors[0],tid,'privacy',{...privacy,showMemberEmail:true,_expected:privacy}]);
    assert.equal((await read()).privacy.shareExpenses,false);assert.equal((await read()).privacy.showMemberEmail,true);
    const replay=await rpc('triplog_apply_sync',[actors[1],tid,participantOperation]);
    assert.equal(replay.changes[0].data['p:individualSpent'],undefined,'Receipt replay must honor current privacy');
    const memberView=M.fromRows((await rpc('triplog_read_sync',[actors[1],tid,null])).entities),changedMember=M.clone(memberView);changedMember['participant:private-paid'].fields['p:name']='이름 변경';
    const reply=await rpc('triplog_apply_sync',[actors[1],tid,{protocolVersion:2,operationId:M.uuid(),patches:M.diff(memberView,changedMember)}]);
    assert.equal(reply.changes[0].data['p:individualSpent'],undefined,'Write echo must not expose private participant spending');
    assert.equal((await read()).entities.find(e=>e.entity_id==='private-paid').data['p:individualSpent'],5000);
    await rpc('triplog_sync_control',[actors[0],tid,'archive',{}]);
    await assert.rejects(apply([{kind:'packing',id:'archived-write',action:'create',fields:{'p:name':'안됨'}}]),/TRIP_ARCHIVED/);
    await assert.rejects(rpc('triplog_sync_control',[actors[1],tid,'restore',{}]),/OWNER_REQUIRED/);
    await rpc('triplog_sync_control',[actors[0],tid,'restore',{}]);
    assert.equal(await rpc('triplog_rate_limit',[actors[0],'fixture',2]),true);assert.equal(await rpc('triplog_rate_limit',[actors[0],'fixture',2]),true);assert.equal(await rpc('triplog_rate_limit',[actors[0],'fixture',2]),false);
    console.log('PASS service: independent privacy settings merge, owner archive/restore, request rate limiting');
    const commentId=M.uuid();
    await apply([{kind:'comment',id:commentId,action:'create',fields:{'p:body':'교토역에서 만나요','p:targetId':'linked'}}]);
    const comment=(await read()).entities.find(e=>e.entity_id===commentId);
    assert.equal(comment.data['p:authorId'],actors[0]);
    await assert.rejects(rpc('triplog_apply_sync',[actors[1],tid,{protocolVersion:2,operationId:M.uuid(),patches:[{kind:'comment',id:commentId,action:'delete',before:comment.data,expectedVersion:comment.version}]}]),/INVALID_COMMENT_PERMISSION/);
    baseline=M.fromRows((await read()).entities);after=M.clone(baseline);after['itinerary:linked'].fields['p:assigneeId']=actors[3];
    await assert.rejects(apply(M.diff(baseline,after)),/INVALID_ASSIGNEE/);
    after['itinerary:linked'].fields['p:assigneeId']=actors[1];await apply(M.diff(baseline,after));
    console.log('PASS service: server-stamped comment authors, ownership checks and trip-scoped assignees');

    const doc=new Y.Doc(),lagging=new Y.Doc(),updates=[];
    doc.on('update',u=>updates.push(u));
    for(let n=0;n<64;n++){
      doc.getText('body').insert(doc.getText('body').length,String(n)+',');
      const update=updates.at(-1);if(n===10)Y.applyUpdate(lagging,Y.encodeStateAsUpdate(doc));
      await apply([{kind:'note_update',id:M.uuid(),action:'create',fields:{'p:document':'shared-notes','p:update':Buffer.from(update).toString('base64')}}]);
    }
    lagging.getText('body').insert(0,'오프라인 초안:');
    const head=(await read()).head;
    assert.equal(await rpc('triplog_compact_note',[actors[0],tid,head-1,Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')]),false);
    assert.equal(await rpc('triplog_compact_note',[actors[0],tid,head,Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')]),true);
    const checkpoint=(await read()).entities.filter(e=>e.kind==='note_update'&&!e.deleted_at);assert.equal(checkpoint.length,1);
    Y.applyUpdate(lagging,Buffer.from(checkpoint[0].data['p:update'],'base64'));
    assert.equal(lagging.getText('body').toString(),'오프라인 초안:'+doc.getText('body').toString());
    doc.destroy();lagging.destroy();
    assert.ok(await rpc('triplog_flush_notifications',[1000])>0);
    assert.equal((await db.query('select pending_notifications from public.triplog_sync_health')).rows[0].pending_notifications,0);
    await db.query("update public.triplog_change_log set created_at=now()-interval '31 days' where trip_id=$1",[tid]);
    await rpc('triplog_retention',[]);
    const reset=await rpc('triplog_read_sync',[actors[0],tid,0]);assert.equal(reset.full,true);assert.equal(reset.cursor,head+1);
    assert.ok((await db.query('select count(*)::int n from public.triplog_operation_receipts')).rows[0].n>=64);
    console.log('PASS service: Yjs compaction preserves offline edits, compaction CAS, outbox retry, cursor reset after retention, receipts retained');

    const fresh=await read();const topic=`triplog:${tid}:${fresh.epoch}`;
    await db.query("insert into realtime.messages values($1,'broadcast')",[topic]);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${actors[1]}';`);await db.query("select set_config('request.channel',$1,false)",[topic]);
    assert.ok((await db.query('select * from realtime.messages')).rows.length>0);
    await assert.rejects(db.query('select travel_state from public.triplog_trips'),/permission denied/);
    await db.exec('reset role;');
    await rpc('triplog_sync_control',[actors[0],tid,'member',{userId:actors[1],role:'remove'}]);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${actors[1]}';`);
    assert.equal((await db.query('select * from realtime.messages')).rows.length,0);
    await db.exec('reset role;');
    console.log('PASS service: private Broadcast membership policy, legacy read denial, removed member channel denial');
    const sample={entries:[{id:'a',amount:1001,payerKey:'leader'}],companions:[{id:'peer',name:'동행',individualSpent:0}],settlement:{itemSplits:{}}};
    const calculated=settlement.calculate(sample);
    assert.equal(calculated.total,1001);assert.deepEqual(calculated.transfers,[{from:'companion:peer',to:'leader',amount:500}]);
    assert.throws(()=>settlement.calculate({...sample,entries:[{id:'bad',amount:100,payerKey:'unknown'}]}),/INVALID_SETTLEMENT_PAYER/);
    assert.throws(()=>settlement.calculate({...sample,settlement:{itemSplits:{'current:a':{mode:'custom',shares:{leader:0,'companion:peer':1}}}}}),/INVALID_SETTLEMENT_SHARES/);
    await rpc('triplog_sync_control',[actors[0],tid,'privacy',seed.collaboration.privacy]);
    const financialCursor=(await read()).cursor,operation=M.uuid(),hash='a'.repeat(64);
    const finalized=await rpc('triplog_finalize_settlement',[actors[0],tid,operation,financialCursor,hash,calculated]);
    const replayed=await rpc('triplog_finalize_settlement',[actors[0],tid,operation,financialCursor,hash,calculated]);
    assert.equal(finalized.id,replayed.id);
    await assert.rejects(rpc('triplog_finalize_settlement',[actors[0],tid,M.uuid(),financialCursor,hash,calculated]),/SETTLEMENT_STALE/);
    console.log('PASS service: integer settlement conserves totals, unknown payers and bad shares rejected, finalization CAS and idempotency');
    await require('./trip-removal-regression').run(db);
  } finally { await db.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
