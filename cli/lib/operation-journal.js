'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { home } = require('./config');
const { hash, readJson, writeJson, withLock } = require('./files');
const { fail, CliError } = require('./errors');
class Journal {
  constructor(config, identity, root = home()) {
    this.scope = { url: config.url, userId: identity.user.id };
    this.directory = path.join(root, 'operations', hash(JSON.stringify(this.scope)).slice(0, 24));
  }
  file(id) { if (!/^[a-f0-9-]{36}$/i.test(id || '')) fail('USAGE', '올바른 요청 ID가 필요합니다.'); return path.join(this.directory, `${id}.json`); }
  async list() {
    const names = await fs.readdir(this.directory).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    const records = await Promise.all(names.filter(name => /^[a-f0-9-]{36}\.json$/i.test(name)).map(name => readJson(path.join(this.directory, name))));
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ id, createdAt, updatedAt, status, retryable, label, tripId }) => ({ id, createdAt, updatedAt, status, retryable, label, tripId }));
  }
  async read(id) {
    const record = await readJson(this.file(id));
    if (record.scope.url !== this.scope.url || record.scope.userId !== this.scope.userId || record.digest !== hash(JSON.stringify(record.body))) fail('CONFLICT', '요청의 계정·프로젝트 또는 내용이 일치하지 않습니다.');
    return record;
  }
  async execute(body, send, { label, retryable = false } = {}) {
    const id = body.operation?.operationId || body.operationId || body.data?.operationId || randomUUID();
    const record = { id, scope: this.scope, label: label || body.action, tripId: body.tripId || body.snapshot?.id, body: structuredClone(body), digest: hash(JSON.stringify(body)), retryable, status: 'pending', createdAt: new Date().toISOString() };
    await writeJson(this.file(id), record);
    return this.submit(record, send);
  }
  async retry(id, send) {
    const record = await this.read(id);
    if (record.status === 'applied') return { ...record.result, journalId: id, replayed: true };
    if (!record.retryable || !['pending', 'unknown'].includes(record.status)) fail('CONFLICT', '이 요청은 자동 재시도할 수 없습니다. 최신 상태를 확인하고 새 명령을 실행해 주세요.', { id, status: record.status });
    return this.submit(record, send);
  }
  async submit(record, send) {
    return withLock(`${this.file(record.id)}.sending`, async () => {
      record = await this.read(record.id);
      if (record.status === 'applied') return { ...record.result, journalId: record.id, replayed: true };
      try {
        const result = await send(record.body);
        const action = record.body.action;
        if ((action === 'apply' && !['applied', 'conflict'].includes(result.status))
          || (['create', 'accept'].includes(action) && !result.tripId)
          || (action === 'attachment-upload' && !/^triplog-attachment:[a-f0-9]{64}$/.test(result.reference || ''))
          || (action === 'settlement-finalize' && !result.finalized)) throw new CliError('NETWORK_ERROR', '서버의 저장 확인 응답이 올바르지 않습니다.');
        record.result = result; record.status = result.status === 'conflict' ? 'conflict' : 'applied';
        record.updatedAt = new Date().toISOString(); await writeJson(this.file(record.id), record, { overwrite: true });
        if (record.status === 'conflict') fail('CONFLICT', '다른 변경과 겹쳤습니다. 현재 값을 확인한 뒤 다시 실행해 주세요.', { journalId: record.id, conflicts: result.conflicts });
        return { ...result, journalId: record.id };
      } catch (error) {
        if (record.status === 'conflict') throw error;
        const definitive = ['AUTH_REQUIRED', 'FORBIDDEN', 'INVALID_INPUT', 'UNSUPPORTED', 'CONFLICT'].includes(error.code);
        record.status = definitive ? 'rejected' : 'unknown';
        record.error = { code: error.code || 'NETWORK_ERROR', details: error.details }; record.updatedAt = new Date().toISOString();
        await writeJson(this.file(record.id), record, { overwrite: true });
        if (definitive) { error.details = { ...error.details, journalId: record.id }; throw error; }
        throw new CliError('REQUEST_UNCERTAIN', '서버 반영 여부를 확인하지 못했습니다. 동일한 명령을 새로 만들지 말고 요청 기록을 확인해 주세요.', { journalId: record.id, retryable: record.retryable, retry: record.retryable ? `triplog operation retry --id ${record.id}` : null });
      }
    });
  }
}
module.exports = { Journal };
