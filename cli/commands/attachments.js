'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const M = require('../../src/app/sync/model');
const { atomicWrite } = require('../lib/files');
const { fail } = require('../lib/errors');
function contentType(bytes) {
  if (bytes.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (bytes[0] === 137 && bytes.subarray(1, 4).toString() === 'PNG') return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString() === 'GIF8') return 'image/gif';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  fail('INVALID_INPUT', 'PDF, PNG, JPEG, GIF, WebP 첨부파일만 지원합니다.');
}
function dataUrl(bytes) { if (!bytes.length || bytes.length > 1572864) fail('INVALID_INPUT', '첨부파일은 최대 1.5 MiB입니다.'); return `data:${contentType(bytes)};base64,${bytes.toString('base64')}`; }
function decodeDataUrl(value) {
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(value || '');
  if (!match) fail('INVALID_INPUT', '첨부파일 데이터 형식이 올바르지 않습니다.');
  const bytes = Buffer.from(match[2], 'base64'); if (dataUrl(bytes).split(';')[0] !== `data:${match[1]}`) fail('INVALID_INPUT', '첨부파일 형식이 내용과 다릅니다.'); return bytes;
}
async function downloadData(adapter, record, reference) {
  if (reference.startsWith('data:')) return decodeDataUrl(reference);
  if (adapter.kind !== 'cloud') fail('UNSUPPORTED', '서버 첨부파일이 포함되지 않은 백업입니다. cloud 모드에서 다시 내보내 주세요.');
  const result = await adapter.send({ action: 'attachment-download', tripId: record.id, reference });
  const url = new URL(result.url);
  if (url.origin !== new URL(adapter.config.url).origin) fail('INVALID_INPUT', '첨부파일 URL의 프로젝트가 일치하지 않습니다.');
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!response.ok) fail('NETWORK_ERROR', '첨부파일을 내려받지 못했습니다.');
  if (Number(response.headers.get('content-length')) > 1572864) fail('INVALID_INPUT', '첨부파일 크기 제한을 넘었습니다.');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) { length += chunk.length; if (length > 1572864) fail('INVALID_INPUT', '첨부파일 크기 제한을 넘었습니다.'); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks); dataUrl(bytes); return bytes;
}
async function attachment(adapter, record, action, options) {
  const item = record.snapshot.itineraryItems?.find(row => row.id === options.id);
  if (!item) fail('NOT_FOUND', '--id로 첨부파일을 사용할 일정 ID를 지정해 주세요.');
  if (action === 'download') {
    if (!options.out) fail('USAGE', '--out으로 저장 경로를 지정해 주세요.');
    if (!item.voucherFile) fail('NOT_FOUND', '첨부파일이 없습니다.');
    const bytes = await downloadData(adapter, record, item.voucherFile);
    return { file: await atomicWrite(options.out, bytes, { overwrite: options.overwrite }), size: bytes.length };
  }
  if (action !== 'upload') fail('USAGE', 'attachment upload/download 중 선택해 주세요.');
  if (!options.file || options.file === '-') fail('USAGE', '--file로 첨부할 파일을 지정해 주세요.');
  const stat = await fs.stat(options.file); if (!stat.isFile() || stat.size > 1572864) fail('INVALID_INPUT', '첨부파일은 최대 1.5 MiB입니다.');
  const data = dataUrl(await fs.readFile(options.file));
  const next = structuredClone(record.snapshot), target = next.itineraryItems.find(row => row.id === item.id);
  target.voucherFileName = path.basename(options.file); target.voucherFile = data;
  if (adapter.kind === 'cloud') {
    const probe = structuredClone(next); probe.itineraryItems.find(row => row.id === item.id).voucherFile = `triplog-attachment:${'0'.repeat(64)}`;
    adapter.plan(record, probe);
    if (options.dryRun) return { dryRun: true, tripId: record.id, itineraryId: item.id, fileName: target.voucherFileName, size: stat.size };
    const result = await adapter.journal.execute({ action: 'attachment-upload', tripId: record.id, data }, adapter.send, { label: 'attachment upload', retryable: true });
    target.voucherFile = result.reference;
  }
  return adapter.apply(record, next, { dryRun: options.dryRun, label: 'attachment link' });
}
module.exports = { attachment, downloadData, dataUrl, decodeDataUrl, contentType };
