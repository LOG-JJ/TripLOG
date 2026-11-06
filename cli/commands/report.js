'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const Report = require('../../src/app/features/print/report-model');
const Companion = require('../../src/app/features/travel-companion/model');
const { atomicWrite } = require('../lib/files');
const { root } = require('../lib/process-runner');
const { fail } = require('../lib/errors');
function csvCell(value) {
  let text = String(value ?? ''); if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
function expenseCsv(entries) {
  const columns = ['id', 'date', 'paymentDate', 'category', 'description', 'amount', 'currency', 'foreignAmount', 'payerKey', 'note'];
  return '\uFEFF' + [columns, ...entries.map(entry => columns.map(key => entry[key]))].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
function htmlReport(trip, type = 'full', options = {}) {
  const esc = Companion.esc;
  const report = Report.create(trip, { expensePeriod: options.date || 'all', itineraryDay: options.date || 'all' });
  const selected = { ...trip, entries: report.entries, itineraryItems: report.days.flatMap(day => day.items) };
  let html = Companion.createPocketNote(selected, { itinerary: type !== 'expense', references: true, costs: true });
  if (type !== 'itinerary') {
    const table = `<h2>전체 지출 내역</h2><table><thead><tr>${['날짜', '분류', '내용', '원화 금액', '외화', '메모'].map(label => `<th>${label}</th>`).join('')}</tr></thead><tbody>${report.entries.map(entry => `<tr><td>${esc(entry.date)}</td><td>${esc(entry.category)}</td><td>${esc(entry.description)}</td><td>${esc(entry.amount)}</td><td>${esc([entry.foreignAmount, entry.currency].filter(value => value !== undefined && value !== '').join(' '))}</td><td>${esc(entry.note)}</td></tr>`).join('')}</tbody></table>`;
    html = html.replace('<footer', `${table}<footer`);
  }
  return html.replace('</style>', 'table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}th,td{padding:6px;text-align:left;border-bottom:1px solid #ddd;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4;margin:14mm}</style>');
}
async function pdfBytes(html) {
  const { launchBrowser } = require('../../scripts/helpers/browser-launcher');
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext(); await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    const font = (await fs.readFile(path.join(root, 'vendor/pretendard-1.3.9/PretendardVariable.woff2'))).toString('base64');
    html = html.replace("default-src 'none';", "default-src 'none'; font-src data:;").replace('</style>', `@font-face{font-family:TripLOG;src:url(data:font/woff2;base64,${font}) format('woff2')}body{font-family:TripLOG,sans-serif}</style>`);
    await page.setContent(html, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally { await browser.close(); }
}
async function report(trip, options) {
  const format = options.format || 'json', type = options.type || 'full';
  if (!['full', 'expense', 'itinerary'].includes(type)) fail('USAGE', 'type: full, expense, itinerary');
  const result = Report.create(trip, { expensePeriod: options.date || 'all', itineraryDay: options.date || 'all' });
  let content;
  if (format === 'json') content = JSON.stringify(result, null, 2) + '\n';
  else if (format === 'csv') content = type === 'itinerary' ? '\uFEFF' + [['id', 'date', 'time', 'endTime', 'place', 'location', 'memo'], ...result.days.flatMap(day => day.items).map(item => [item.id, item.date, item.time, item.endTime, item.place, item.location, item.memo])].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n' : expenseCsv(result.entries);
  else if (format === 'ics') content = Companion.createCalendar({ ...trip, itineraryItems: result.days.flatMap(day => day.items) }, options.timezone || trip.travelCompanion?.timeZone || 'Asia/Seoul');
  else if (format === 'html' || format === 'pdf') content = htmlReport(trip, type, options);
  else fail('USAGE', 'format: json, csv, html, pdf, ics');
  if (format === 'pdf') { if (!options.out) fail('USAGE', 'PDF는 --out으로 저장 경로를 지정해 주세요.'); content = await pdfBytes(content); }
  if (options.out) return { file: await atomicWrite(options.out, content, { overwrite: options.overwrite }), format };
  return format === 'json' ? result : options.json ? { format, content } : content;
}
module.exports = { report, htmlReport, pdfBytes, expenseCsv };
