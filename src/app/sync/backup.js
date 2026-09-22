(function () {
  'use strict';
  const R=window.TripLogSyncRepository,M=window.TripLogSyncModel,C=window.TripLog.sync.controller;
  async function build(records){
    const identity=C.engine.status();
    const scope=()=>{const now=C.engine.status();if(now.active!==identity.active||now.accountId!==identity.accountId||now.projectId!==identity.projectId)throw new Error('계정이 변경됐습니다. 해당 계정에서 다시 백업해 주세요.');};
    const trips=(await R.all()).filter(r=>(!r.accountId||r.accountId===identity.accountId)&&(!r.projectId||r.projectId===identity.projectId));
    const payload=window.TripLog.persistence.archiveDb.buildArchiveExportPayload(records);
    payload.schemaVersion=3;payload.trips=[];payload.collaborationRecovery=[];payload.missingAttachments=[];
    // Legacy archives without an account remain user-owned local imports. Known
    // foreign-account archives are not included in this account's export.
    payload.records=payload.records.filter(r=>!r.state?.collaboration?.ownerId||r.state.collaboration.ownerId.startsWith('local_')||r.state.collaboration.ownerId===identity.accountId||trips.some(t=>t.localId===r.state.id));
    for(const record of trips){
      scope();
      const snapshot=M.clone(record.snapshot);
      const documents=Object.values(M.apply(record.base||{},record.queue.flatMap(q=>q.patches)).entities).filter(e=>!e.deleted&&['note_update','comment'].includes(e.kind));
      snapshot._syncRecovery={documents,sourceLocalId:record.localId};
      for(const item of snapshot.itineraryItems||[]){
        if(!String(item.voucherFile||'').startsWith('triplog-attachment:'))continue;
        try{item.voucherFile=await C.attachmentUrl(record.localId,item.voucherFile);}
        catch(_){payload.missingAttachments.push({tripId:record.localId,itineraryId:item.id,fileName:item.voucherFileName||''});}
        scope();
      }
      payload.trips.push(snapshot);
      payload.collaborationRecovery.push({localId:record.localId,serverId:record.serverId,cursor:record.cursor,queue:M.clone(record.queue),conflicts:M.clone(record.conflicts),hidden:Boolean(record.hidden),archivedAt:record.archivedAt||null});
    }
    for(const snapshot of window.TripLog.persistence.stateStorage.unsavedSnapshots()) {
      const index=payload.trips.findIndex(t=>t.id===snapshot.id);
      if(index>=0)payload.trips[index]={...snapshot,_syncRecovery:payload.trips[index]._syncRecovery};
    }
    payload.drafts=[];
    for(const trip of trips)payload.drafts.push(...await window.TripLog.sync.drafts.list(trip.localId));
    scope();return payload;
  }
  window.TripLog.register('sync.backup',{build});
})();
