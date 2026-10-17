'use strict';
const M = require('../../src/app/sync/model');
const { createTransport } = require('../lib/transport');
const { Journal } = require('../lib/operation-journal');
const { fail } = require('../lib/errors');
class CloudAdapter {
  constructor(config, identity, { send, journal } = {}) {
    this.kind = 'cloud'; this.config = config; this.identity = identity;
    this.send = send || createTransport(config, identity); this.journal = journal || new Journal(config, identity);
  }
  async list() {
    const result = await this.send({ action: 'list' });
    if (result.protocolVersion !== 2 || !Array.isArray(result.trips)) fail('UNSUPPORTED', '지원하지 않는 서버 프로토콜입니다.');
    return result.trips.map(row => this.record(row));
  }
  record(row) {
    const entities = M.fromRows(row.entities);
    const snapshot = M.decode(entities, { id: row.appTripId, collaboration: { ownerId: row.ownerId, privacy: row.privacy } });
    return { id: row.tripId, appTripId: row.appTripId, snapshot, entities, cursor: row.cursor, role: row.role, privacy: row.privacy || {}, archivedAt: row.archivedAt || null };
  }
  async read(id) {
    if (!id) fail('USAGE', '--trip으로 여행 ID를 지정해 주세요.');
    // app IDs and server IDs differ; resolve both without treating a name as an ID.
    const matches = (await this.list()).filter(row => row.id === id || row.appTripId === id);
    if (matches.length !== 1) fail(matches.length ? 'CONFLICT' : 'NOT_FOUND', matches.length ? '여행 ID가 중복됩니다. 서버 ID로 지정해 주세요.' : '접근 가능한 여행을 찾을 수 없습니다.');
    return this.record(await this.send({ action: 'read', tripId: matches[0].id }));
  }
  writable(record) {
    if (record.role === 'viewer') fail('FORBIDDEN', '조회 전용 여행입니다.');
    if (record.archivedAt) fail('FORBIDDEN', '보관된 여행을 먼저 복원해 주세요.');
  }
  plan(record, next) {
    this.writable(record);
    // Compare displayed snapshots, but use exact server versions for conflict checks.
    // This deliberately leaves note/comment entities and normalization defaults alone.
    const before = M.encode(record.snapshot), after = M.encode(next);
    const patches = M.diff(before, after, { source: record.entities });
    return this.planPatches(record, patches);
  }
  planPatches(record, patches) {
    this.writable(record);
    if (patches.length > 500) fail('INVALID_INPUT', '한 번에 최대 500개 항목까지 변경할 수 있습니다.');
    for (const patch of patches) {
      if (record.privacy.shareItinerary === false && ['itinerary', 'reservation', 'progress', 'note_update', 'comment'].includes(patch.kind)) fail('FORBIDDEN', '이 여행은 일정 데이터를 서버에 공유하지 않습니다. 파일 모드로 작업해 주세요.');
      if (record.privacy.shareExpenses === false && (['expense', 'split', 'share'].includes(patch.kind) || patch.kind === 'settings' && patch.id === 'settlement' || patch.kind === 'participant' && Object.hasOwn(patch.fields || {}, 'p:individualSpent') || patch.kind === 'trip' && Object.hasOwn(patch.fields || {}, 'p:totalBudget'))) fail('FORBIDDEN', '이 여행은 지출 데이터를 서버에 공유하지 않습니다. 파일 모드로 작업해 주세요.');
    }
    const body = { action: 'apply', writeVersion: 3, tripId: record.id, deletions: patches.filter(p => p.action === 'delete').map(p => ({ kind: p.kind, id: p.id })), operation: { protocolVersion: 2, operationId: M.uuid(), patches } };
    if (Buffer.byteLength(JSON.stringify(body)) > 3 * 1024 * 1024) fail('INVALID_INPUT', '변경 요청이 서버 크기 제한(3 MiB)을 넘습니다.');
    return body;
  }
  async apply(record, next, options = {}) { return this.applyPatches(record, this.plan(record, next).operation.patches, options); }
  async applyPatches(record, patches, { dryRun = false, label } = {}) {
    const body = this.planPatches(record, patches);
    if (dryRun) return { dryRun: true, source: 'cloud', tripId: record.id, cursor: record.cursor, patches, deletions: body.deletions };
    if (!patches.length) return { status: 'unchanged', tripId: record.id };
    return this.journal.execute(body, this.send, { label, retryable: true });
  }
  async create(snapshot, { dryRun = false } = {}) {
    const body = { action: 'create', snapshot };
    if (Buffer.byteLength(JSON.stringify(body)) > 3 * 1024 * 1024) fail('INVALID_INPUT', '새 여행 요청이 서버 제한(3 MiB)을 넘습니다.');
    if (dryRun) return { dryRun: true, source: 'cloud', snapshot };
    const result = await this.journal.execute(body, this.send, { label: 'trip create', retryable: true });
    return { status: 'applied', tripId: result.tripId, appTripId: result.appTripId, cursor: result.cursor, journalId: result.journalId };
  }
  async control(record, control, data, { dryRun = false } = {}) {
    if (!['profile', 'leave'].includes(control) && record.role !== 'owner') fail('FORBIDDEN', '여행 소유자 권한이 필요합니다.');
    const body = { action: 'control', tripId: record.id, control, data };
    if (dryRun) return { dryRun: true, ...body };
    return this.journal.execute(body, this.send, { label: `control ${control}`, retryable: control === 'restore-change' });
  }
}
module.exports = { CloudAdapter };
