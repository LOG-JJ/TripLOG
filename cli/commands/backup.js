'use strict';
const M = require('../../src/app/sync/model');
const Domain = require('../../src/app/domain/commands');
const { unpack } = require('../adapters/file');
const { readJson, writeJson } = require('../lib/files');
const { fail } = require('../lib/errors');
const { documents } = require('./documents');
const { dataUrl, decodeDataUrl, downloadData } = require('./attachments');
async function exportBackup(adapter, options) {
  const records = options.trip ? [await adapter.read(options.trip)] : await adapter.list();
  const payload = adapter.kind === 'file' ? structuredClone(adapter.payload) : { app: 'TripLOG', schemaVersion: 3, storage: 'Cloud synchronized data', scope: 'cloud-synchronized', localOnlyDataIncluded: false, records: [], missingAttachments: [] };
  payload.exportedAt = new Date().toISOString(); payload.trips = records.map(record => structuredClone(record.snapshot));
  payload.activeTripId = payload.trips[0]?.id || '';
  if (options.trip) {
    const ids = new Set(records.map(row => row.appTripId));
    for (const key of ['records', 'drafts', 'collaborationRecovery', 'cliHistory']) if (Array.isArray(payload[key])) payload[key] = payload[key].filter(row => ids.has(row.tripId || row.localId || row.state?.id));
  }
  if (adapter.kind === 'cloud') {
    payload.collaborationRecovery = [];
    for (const [index, record] of records.entries()) {
      const snapshot = payload.trips[index]; snapshot._syncRecovery = { sourceLocalId: snapshot.id, documents: documents(record) };
      payload.collaborationRecovery.push({ localId: snapshot.id, serverId: record.id, cursor: record.cursor, queue: [], conflicts: [] });
      for (const item of snapshot.itineraryItems || []) {
        if (!item.voucherFile) continue;
        try { item.voucherFile = dataUrl(await downloadData(adapter, record, item.voucherFile)); }
        catch (error) { payload.missingAttachments.push({ tripId: snapshot.id, itineraryId: item.id, fileName: item.voucherFileName || '', code: error.code || 'NETWORK_ERROR' }); }
      }
    }
  }
  if (options.out) {
    await writeJson(options.out, payload, { overwrite: options.overwrite });
    return { file: require('node:path').resolve(options.out), trips: payload.trips.length, scope: payload.scope || 'file-backup', missingAttachments: payload.missingAttachments || [] };
  }
  return payload;
}
function prepareImport(value, source) {
  const payload = unpack(value), mapping = new Map();
  const trips = payload.trips.map(original => {
    if (!original || typeof original !== 'object' || Array.isArray(original)) fail('INVALID_INPUT', '여행 백업 형식이 올바르지 않습니다.');
    if (typeof original.id !== 'string' || !original.id) fail('INVALID_INPUT', '여행 ID가 없는 백업입니다.');
    if (mapping.has(original.id)) fail('INVALID_INPUT', '백업 안에 같은 여행 ID가 여러 번 있습니다.');
    const metadata = Object.fromEntries(Domain.fields.trip.split(' ').filter(key => Object.hasOwn(original, key)).map(key => [key, original[key]]));
    const next = { ...Domain.createTrip(metadata), ...structuredClone(original), id: M.uuid() }; mapping.set(original.id, next.id);
    next.collaboration = { privacy: { shareItinerary: true, shareExpenses: true, showMemberEmail: false, allowInviteRequests: true, ...original.collaboration?.privacy } };
    next.travelCompanion ||= {}; next.travelCompanion.reservations ||= []; next.settlement ||= {};
    for (const [kind, field] of Object.entries({ itinerary: 'itineraryItems', expense: 'entries', packing: 'packingList', companion: 'companions' })) {
      next[field] ||= []; if (!Array.isArray(next[field]) || next[field].length > 10000) fail('INVALID_INPUT', '여행 목록 크기 또는 형식이 올바르지 않습니다.');
      const seen = new Set();
      for (const item of next[field]) {
        if (!item || typeof item !== 'object') fail('INVALID_INPUT', '여행 항목 형식이 올바르지 않습니다.');
        item.id ||= M.uuid(); if (seen.has(item.id)) fail('INVALID_INPUT', '중복 항목 ID가 있습니다.'); seen.add(item.id);
        if (kind === 'itinerary') { item.transits ||= []; if (source === 'cloud' && item.voucherFile && !item.voucherFile.startsWith('data:')) fail('INVALID_INPUT', '첨부파일 원본이 빠졌습니다. cloud backup export로 원본을 포함해 주세요.'); if (item.voucherFile?.startsWith('data:')) decodeDataUrl(item.voucherFile); }
        if (kind === 'expense') item.mode ||= 'domestic';
        if (kind === 'packing') item.checked ??= false;
        // File backups retain historical refunds. The existing cloud API rejects them.
        if (!(kind === 'expense' && source === 'file' && item.amount < 0)) Domain.validateItem(kind, item, next);
      }
    }
    for (const reservation of next.travelCompanion.reservations) { reservation.id ||= M.uuid(); Domain.validateItem('reservation', reservation, next); }
    if (next._syncRecovery) next._syncRecovery.sourceLocalId = next.id;
    if (source === 'cloud') {
      if (next.collaboration.privacy.shareItinerary === false && (next.itineraryItems.length || next.travelCompanion.reservations.length || next._syncRecovery?.documents?.length)) fail('FORBIDDEN', '비공개 일정은 파일 모드에서 복원해 주세요. 가져오기가 공유 범위를 자동 변경하지 않습니다.');
      if (next.collaboration.privacy.shareExpenses === false && (next.entries.length || next.totalBudget || next.companions.some(row => row.individualSpent) || Object.keys(next.settlement.itemSplits || {}).length || Object.keys(next.settlement.customShares || {}).length)) fail('FORBIDDEN', '비공개 지출은 파일 모드에서 복원해 주세요.');
      if (Object.keys(M.encode(next)).length > 20000) fail('INVALID_INPUT', '서버의 여행 항목 제한을 넘었습니다.');
      const attachments = next.itineraryItems.filter(item => item.voucherFile).length, docs = next._syncRecovery?.documents || [];
      if (attachments + docs.length > 500) fail('INVALID_INPUT', '한 여행의 첨부파일·공동 메모 복구 항목이 500개를 넘습니다. 파일 모드에서 먼저 정리해 주세요.');
      for (const document of docs) {
        if (!['note_update', 'comment'].includes(document.kind) || !document.fields) fail('INVALID_INPUT', '지원하지 않는 복구 문서입니다.');
        if (document.kind === 'comment' && (typeof document.fields['p:body'] !== 'string' || document.fields['p:body'].length > 3000 || document.fields['p:targetId'] && !next.itineraryItems.some(item => item.id === document.fields['p:targetId']))) fail('INVALID_INPUT', '댓글 내용 또는 대상 일정을 확인해 주세요.');
      }
      const note = require('./documents').noteDoc({ snapshot: next });
      try { if (note.getText('body').length > 100000) fail('INVALID_INPUT', '공동 메모 크기 제한을 넘었습니다.'); } finally { note.destroy(); }
    }
    return next;
  });
  if (!trips.length) fail('INVALID_INPUT', '가져올 여행이 없습니다.');
  return { payload, trips, mapping };
}
async function importBackup(adapter, options) {
  if (!options.file) fail('USAGE', '--file <백업.json> 또는 --file -를 지정해 주세요.');
  const prepared = prepareImport(await readJson(options.file), adapter.kind);
  const summary = prepared.trips.map(trip => ({ id: trip.id, name: trip.tripName, itinerary: trip.itineraryItems.length, expenses: trip.entries.length }));
  if (options.dryRun) return { dryRun: true, mode: 'new-trips', source: adapter.kind, trips: summary, recoveryQueuesReplayed: false };
  if (adapter.kind === 'file') {
    const payload = structuredClone(adapter.payload); payload.trips.push(...prepared.trips);
    const archives = (prepared.payload.records || []).map(record => { const copy = structuredClone(record); if (copy.state && prepared.mapping.has(copy.state.id)) copy.state.id = prepared.mapping.get(copy.state.id); copy.id = M.uuid(); return copy; });
    payload.records = [...(payload.records || []), ...archives];
    payload.importedRecovery = [...(payload.importedRecovery || []), { importedAt: new Date().toISOString(), idMapping: Object.fromEntries(prepared.mapping), collaborationRecovery: prepared.payload.collaborationRecovery || [], drafts: prepared.payload.drafts || [], missingAttachments: prepared.payload.missingAttachments || [] }];
    return { ...await adapter.save(payload), trips: summary, recoveryQueuesReplayed: false };
  }
  const results = [];
  for (const trip of prepared.trips) {
    const snapshot = structuredClone(trip), attachments = snapshot.itineraryItems.filter(item => item.voucherFile).map(item => ({ id: item.id, data: item.voucherFile }));
    const docs = snapshot._syncRecovery?.documents || []; delete snapshot._syncRecovery;
    snapshot.itineraryItems.forEach(item => { delete item.voucherFile; });
    let created;
    try {
      created = await adapter.create(snapshot); results.push({ ...created, name: trip.tripName, restoration: 'pending' });
      const record = await adapter.read(created.tripId), next = structuredClone(record.snapshot);
      for (const attachment of attachments) {
        const result = await adapter.journal.execute({ action: 'attachment-upload', tripId: record.id, data: attachment.data }, adapter.send, { retryable: true, label: 'backup attachment' });
        next.itineraryItems.find(item => item.id === attachment.id).voucherFile = result.reference;
      }
      const patches = adapter.plan(record, next).operation.patches;
      for (const document of docs) {
        const fields = { ...document.fields }; delete fields['p:authorId']; delete fields['p:createdAt'];
        patches.push({ kind: document.kind, id: M.uuid(), action: 'create', before: null, fields });
      }
      if (patches.length) await adapter.applyPatches(record, patches, { label: 'backup restore documents' });
      results.at(-1).restoration = 'complete';
    } catch (error) { error.details = { ...error.details, importedTrips: results, recoveryQueuesReplayed: false, message: '생성된 여행을 확인해 주세요. 전체 가져오기를 다시 실행하면 새 여행이 추가됩니다.' }; throw error; }
  }
  return { trips: results, recoveryQueuesReplayed: false, localRecoveryIncluded: false, preservedInSourceFile: ['drafts', 'collaborationRecovery', 'records'] };
}
module.exports = { exportBackup, importBackup, prepareImport };
