'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const M = require('../../src/app/sync/model');
const { readText, parseJson, hash, writeJson } = require('../lib/files');
const { fail } = require('../lib/errors');
function unpack(value) {
  if (Array.isArray(value)) return { app: 'TripLOG', schemaVersion: 3, trips: value, records: [] };
  if (!value || typeof value !== 'object') fail('INVALID_INPUT', 'TripLOG 백업 또는 여행 JSON이 필요합니다.');
  if (Array.isArray(value.trips)) return value;
  if (value.tripName && value.id) return { app: 'TripLOG', schemaVersion: 3, trips: [value], records: [] };
  if (Array.isArray(value.records)) return { ...value, trips: value.records.map(record => record.state).filter(Boolean) };
  fail('INVALID_INPUT', 'trips 배열 또는 단일 여행 객체가 필요합니다.');
}
class FileAdapter {
  constructor(file, payload, digest, options) { this.kind = 'file'; this.file = path.resolve(file); this.payload = payload; this.digest = digest; this.options = options; }
  static async open(file, options = {}) {
    if (!file || file === '-') fail('USAGE', '파일 모드는 --store <백업.json>을 지정해 주세요.');
    let text;
    try { text = await readText(file); } catch (error) { if (error.code !== 'NOT_FOUND' || !options.allowCreate) throw error; }
    return new FileAdapter(file, text === undefined ? { app: 'TripLOG', schemaVersion: 3, trips: [], records: [] } : unpack(parseJson(text)), text === undefined ? null : hash(text), options);
  }
  record(snapshot) {
    if (!snapshot?.id || typeof snapshot.id !== 'string') fail('INVALID_INPUT', '여행 ID가 없는 백업입니다.');
    return { id: snapshot.id, appTripId: snapshot.id, snapshot: structuredClone(snapshot), entities: M.encode(snapshot), cursor: 0, role: 'owner', archivedAt: (this.payload.cliArchivedTrips || []).includes(snapshot.id) ? 'local-archive' : null };
  }
  async list() { return this.payload.trips.map(trip => this.record(trip)); }
  async read(id) {
    if (!id) fail('USAGE', '--trip으로 여행 ID를 지정해 주세요.');
    const matches = this.payload.trips.filter(trip => trip.id === id);
    if (matches.length !== 1) fail(matches.length ? 'CONFLICT' : 'NOT_FOUND', '파일 안에서 여행 ID를 하나로 확인할 수 없습니다.');
    return this.record(matches[0]);
  }
  async save(payload) {
    const { out, inPlace, overwrite } = this.options;
    const target = out ? path.resolve(out) : (inPlace || this.digest === null ? this.file : null);
    if (!target) fail('USAGE', '파일 변경은 --out <새파일.json> 또는 --in-place를 지정해 주세요.');
    if (target === this.file && !inPlace && this.digest !== null) fail('USAGE', '입력 파일을 변경하려면 --in-place를 지정해 주세요.');
    let current;
    try { current = await fs.readFile(this.file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if ((current === undefined ? null : hash(current)) !== this.digest) fail('CONFLICT', '읽은 뒤 입력 파일이 바뀌었습니다. 다시 실행해 주세요.');
    payload.exportedAt = new Date().toISOString();
    await writeJson(target, payload, { overwrite: target === this.file ? inPlace : overwrite, ...(target === this.file ? { expectedHash: this.digest } : {}) });
    this.payload = payload;
    if (target === this.file) this.digest = hash(await fs.readFile(target));
    return { status: 'saved', source: 'file', file: target, serverSynced: false };
  }
  async apply(record, next, { dryRun = false, label } = {}) {
    if (record.archivedAt) fail('FORBIDDEN', '보관된 여행을 먼저 복원해 주세요.');
    const patches = M.diff(M.encode(record.snapshot), M.encode(next));
    if (dryRun) return { dryRun: true, source: 'file', tripId: record.id, patches };
    if (!patches.length && M.equal(record.snapshot._syncRecovery, next._syncRecovery)) return { status: 'unchanged', tripId: record.id };
    const payload = structuredClone(this.payload);
    payload.trips = payload.trips.map(trip => trip.id === record.id ? next : trip);
    payload.cliHistory = [...(payload.cliHistory || []), { id: M.uuid(), tripId: record.id, label, createdAt: new Date().toISOString(), before: record.snapshot, after: next }].slice(-100);
    return this.save(payload);
  }
  async create(snapshot, { dryRun = false } = {}) {
    if (this.payload.trips.some(trip => trip.id === snapshot.id)) fail('CONFLICT', '같은 여행 ID가 있습니다.');
    if (dryRun) return { dryRun: true, source: 'file', snapshot };
    return this.save({ ...this.payload, trips: [...this.payload.trips, snapshot] });
  }
  async control(record, control, data, { dryRun = false } = {}) {
    if (!['archive', 'restore', 'restore-change'].includes(control)) fail('UNSUPPORTED', '멤버·공유 설정은 cloud 모드에서 사용해 주세요.');
    if (control === 'restore-change') {
      const change = (this.payload.cliHistory || []).find(row => row.id === data.id && row.tripId === record.id);
      if (!change) fail('NOT_FOUND', '파일에 해당 변경 이력이 없습니다.');
      if (!M.equal(record.snapshot, change.after)) fail('CONFLICT', '이력 이후에 여행이 바뀌었습니다. 최신 변경부터 복원해 주세요.');
      return this.apply(record, change.before, { dryRun, label: `restore ${change.id}` });
    }
    if (dryRun) return { dryRun: true, source: 'file', tripId: record.id, control, data };
    const ids = new Set(this.payload.cliArchivedTrips || []);
    if (control === 'archive') ids.add(record.id); else ids.delete(record.id);
    return this.save({ ...this.payload, cliArchivedTrips: [...ids] });
  }
}
module.exports = { FileAdapter, unpack };
