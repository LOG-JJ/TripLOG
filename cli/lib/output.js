'use strict';
function width(text) { return [...text].reduce((sum, character) => sum + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff01-\uff60]/u.test(character) ? 2 : 1), 0); }
function table(rows) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  if (!keys.length || keys.length > 10 || rows.some(row => Object.values(row).some(value => value && typeof value === 'object'))) return null;
  const values = rows.map(row => keys.map(key => String(row[key] ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')));
  const widths = keys.map((key, column) => Math.min(48, Math.max(width(key), ...values.map(row => width(row[column])))));
  const cell = (text, size) => { if (width(text) > size) { let clipped = ''; for (const character of text) { if (width(clipped + character) > size - 1) break; clipped += character; } text = clipped + '…'; } return text + ' '.repeat(Math.max(0, size - width(text))); };
  return [keys.map((key, index) => cell(key, widths[index])).join('  '), widths.map(size => '-'.repeat(size)).join('  '), ...values.map(row => row.map((value, index) => cell(value, widths[index])).join('  '))].join('\n');
}
function output(value, options = {}) {
  if (options.json) { process.stdout.write(JSON.stringify({ ok: true, data: value }) + '\n'); return; }
  if (typeof value === 'string') { process.stdout.write(value + (value.endsWith('\n') ? '' : '\n')); return; }
  if (Array.isArray(value) && value.length && value.every(row => row && typeof row === 'object' && !Array.isArray(row))) { const rendered = table(value); if (rendered) { process.stdout.write(rendered + '\n'); return; } }
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}
function errorOutput(error, options = {}) {
  const value = { code: error.code || 'INTERNAL_ERROR', message: error.message || '실행에 실패했습니다.', ...(error.details ? { details: error.details } : {}) };
  if (options.json) process.stdout.write(JSON.stringify({ ok: false, error: value }) + '\n');
  else { process.stderr.write(`${value.code}: ${value.message}\n`); if (value.details) process.stderr.write(JSON.stringify(value.details, null, 2) + '\n'); }
  process.exitCode = error.exitCode || 1;
}
module.exports = { output, errorOutput };
