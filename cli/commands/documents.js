'use strict';
const M = require('../../src/app/sync/model');
const Y = require('yjs');
const { fail } = require('../lib/errors');
function documents(record) {
  return [...Object.values(record.entities || {}), ...(record.snapshot._syncRecovery?.documents || [])].filter((row, index, rows) => !row.deleted && ['note_update', 'comment'].includes(row.kind) && rows.findIndex(other => other.kind === row.kind && other.id === row.id) === index);
}
function noteDoc(record) {
  const doc = new Y.Doc();
  try { for (const row of documents(record).filter(row => row.kind === 'note_update')) Y.applyUpdate(doc, Buffer.from(row.fields['p:update'], 'base64')); }
  catch (_) { doc.destroy(); fail('INVALID_INPUT', '공동 메모의 복구 데이터가 손상됐습니다.'); }
  return doc;
}
async function applyDocuments(adapter, record, patches, options) {
  if (adapter.kind === 'cloud') return adapter.applyPatches(record, patches, options);
  if (record.archivedAt) fail('FORBIDDEN', '보관된 여행을 먼저 복원해 주세요.');
  if (options.dryRun) return { dryRun: true, source: 'file', tripId: record.id, patches };
  const current = Object.fromEntries(documents(record).map(row => [M.key(row.kind, row.id), row]));
  const next = structuredClone(record.snapshot);
  next._syncRecovery = { ...next._syncRecovery, sourceLocalId: next.id, documents: Object.values(M.apply(current, patches).entities) };
  return adapter.apply(record, next, options);
}
async function note(adapter, record, action, text, options) {
  const doc = noteDoc(record);
  try {
    const body = doc.getText('body');
    if (action === 'show') return { text: body.toString() };
    if (!['append', 'set'].includes(action)) fail('USAGE', 'note show/append/set 중 선택해 주세요.');
    if (typeof text !== 'string' || text.length > 100000) fail('INVALID_INPUT', '메모는 최대 100,000자입니다.');
    const before = Y.encodeStateVector(doc);
    if (action === 'set') body.delete(0, body.length);
    body.insert(body.length, text);
    if (body.length > 100000) fail('INVALID_INPUT', '전체 메모는 최대 100,000자입니다.');
    const update = Buffer.from(Y.encodeStateAsUpdate(doc, before)).toString('base64');
    return applyDocuments(adapter, record, [{ kind: 'note_update', id: M.uuid(), action: 'create', before: null, fields: { 'p:document': 'shared-notes', 'p:update': update } }], { ...options, label: `note ${action}` });
  } finally { doc.destroy(); }
}
async function comment(adapter, record, action, data, options) {
  const rows = documents(record).filter(row => row.kind === 'comment');
  if (action === 'list') return rows.map(row => ({ id: row.id, body: row.fields['p:body'], targetId: row.fields['p:targetId'], authorId: row.fields['p:authorId'], createdAt: row.fields['p:createdAt'] }));
  let patch;
  if (action === 'add') {
    if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 3000) fail('INVALID_INPUT', '댓글은 1~3,000자입니다.');
    if (data.target && !record.snapshot.itineraryItems.some(item => item.id === data.target)) fail('NOT_FOUND', '댓글 대상 일정을 찾을 수 없습니다.');
    patch = { kind: 'comment', id: M.uuid(), action: 'create', before: null, fields: { 'p:body': data.text, 'p:targetId': data.target || '' } };
  } else if (action === 'remove') {
    const row = rows.find(row => row.id === data.id); if (!row) fail('NOT_FOUND', '댓글을 찾을 수 없습니다.');
    patch = { kind: 'comment', id: row.id, action: 'delete', before: row.fields, expectedVersion: row.version || 0 };
  } else fail('USAGE', 'comment list/add/remove 중 선택해 주세요.');
  return applyDocuments(adapter, record, [patch], { ...options, label: `comment ${action}` });
}
module.exports = { note, comment, documents, noteDoc, applyDocuments };
