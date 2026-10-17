'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { fail } = require('./errors');
const hash = value => createHash('sha256').update(value).digest('hex');
function safeObject(value, depth = 0) {
  if (depth > 32) fail('INVALID_INPUT', 'JSON이 너무 깊습니다.');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('INVALID_INPUT', `허용하지 않는 JSON 키: ${key}`);
    safeObject(child, depth + 1);
  }
  return value;
}
function parseJson(text, label = 'JSON') {
  try { return safeObject(JSON.parse(text.replace(/^\uFEFF/, ''))); }
  catch (error) { if (error.code) throw error; fail('INVALID_INPUT', `${label}: 올바른 JSON이 아닙니다.`); }
}
async function readText(file, max = 64 * 1024 * 1024) {
  if (file === '-') {
    if (process.stdin.isTTY) fail('USAGE', '표준입력으로 파일 내용을 전달해 주세요.');
    const chunks = []; let size = 0;
    for await (const chunk of process.stdin) { size += chunk.length; if (size > max) fail('INVALID_INPUT', '입력이 너무 큽니다.'); chunks.push(chunk); }
    return Buffer.concat(chunks).toString('utf8');
  }
  const stat = await fs.stat(file).catch(error => { if (error.code === 'ENOENT') fail('NOT_FOUND', `파일을 찾을 수 없습니다: ${file}`); throw error; });
  if (!stat.isFile() || stat.size > max) fail('INVALID_INPUT', '일반 파일만 사용할 수 있으며 크기 제한을 넘을 수 없습니다.');
  return fs.readFile(file, 'utf8');
}
async function readJson(file) { return parseJson(await readText(file), file); }
function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}
async function acquireLock(file) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(file, 'wx', 0o600), token = randomUUID();
      try { await handle.writeFile(JSON.stringify({ pid: process.pid, token, createdAt: Date.now() })); }
      catch (error) { await handle.close(); await fs.rm(file, { force: true }); throw error; }
      return { handle, token };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (attempt) break;
      // Serialize stale-lock recovery so concurrent callers cannot unlink a new owner.
      let recovery;
      try { recovery = await fs.open(`${file}.recovery`, 'wx', 0o600); }
      catch (recoveryError) { if (recoveryError.code === 'EEXIST') break; throw recoveryError; }
      try {
        let owner;
        try { owner = JSON.parse(await fs.readFile(file, 'utf8')); } catch (readError) { if (readError.code === 'ENOENT') continue; break; }
        if (processAlive(owner.pid)) break;
        await fs.rm(file, { force: true });
      } finally { await recovery.close(); await fs.rm(`${file}.recovery`, { force: true }); }
    }
  }
  fail('CONFLICT', `다른 CLI 작업이 사용 중인 잠금입니다: ${file}`);
}
async function releaseLock(file, lock) {
  await lock.handle.close();
  let owner;
  try { owner = JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (owner.token === lock.token) await fs.rm(file, { force: true });
}
async function atomicWrite(file, content, { overwrite = false, expectedHash } = {}) {
  const target = path.resolve(file), temporary = `${target}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const lock = `${target}.lock`;
  const ownership = await acquireLock(lock);
  try {
    let existing;
    try { existing = await fs.readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (expectedHash !== undefined && (existing === undefined ? null : hash(existing)) !== expectedHash) fail('CONFLICT', '읽은 뒤 파일이 변경됐습니다. 다시 읽고 실행해 주세요.');
    if (existing !== undefined && !overwrite) fail('CONFLICT', `출력 파일이 이미 있습니다. --overwrite로 명시해 주세요: ${target}`);
    const writer = await fs.open(temporary, 'wx', 0o600);
    try { await writer.writeFile(content); await writer.sync(); } finally { await writer.close(); }
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }); await releaseLock(lock, ownership); }
  return target;
}
const writeJson = (file, value, options) => atomicWrite(file, JSON.stringify(value, null, 2) + '\n', options);
async function withLock(file, action) {
  const lock = await acquireLock(file);
  try { return await action(); } finally { await releaseLock(file, lock); }
}
module.exports = { hash, safeObject, parseJson, readText, readJson, atomicWrite, writeJson, withLock };
