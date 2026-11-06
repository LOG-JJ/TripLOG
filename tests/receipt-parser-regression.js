// Pure receipt extraction checks; no browser, credentials or network needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let parser;
const context = vm.createContext({ window: { TripLog: { register(_name, api) { parser = api; } } } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/features/expenses/receipt-parser.js'), 'utf8'), context);
const cases = [
  ['Malformed OCR grouping never becomes 2', '광장시장\n합 계 36,0002! |', { amount: null }],
  ['Sparse receipt layout', '광장시장\n식사권\n2026-09-12 12:28\n식사권\n36,000\n합계\n36,000원', { merchant: '광장시장', amount: 36000, currency: 'KRW', date: '2026-09-12' }],
  ['Korean cash total', '서울카페\n2026-09-12 12:30\n공급가액 11,364\n부가세 1,136\n합 계 12,500원\n현금결제\n받은 돈 20,000\n거스름돈 7,500', { merchant: '서울카페', date: '2026-09-12', amount: 12500, currency: 'KRW', paymentMethod: 'cash', category: '식비' }],
  ['Japanese date and total', '東京カフェ\n2026年09月12日\n小計 1,000\n合計 1,100円\nお預り 2,000\nお釣り 900\n現金', { date: '2026-09-12', amount: 1100, currency: 'JPY', paymentMethod: 'cash' }],
  ['USD decimal total', 'PARK CAFE\n2026/09/12\nSUBTOTAL 10.00\nTAX 0.90\nTOTAL USD 10.90\nVISA', { amount: 10.9, currency: 'USD', paymentMethod: 'card' }],
  ['Comma decimal', 'CAFE PARIS\n13/09/2026\nTOTAL EUR 1.234,56', { date: '2026-09-13', amount: 1234.56, currency: 'EUR' }],
  ['Label on preceding line', 'CAFE\nTOTAL\nUSD 9.40', { amount: 9.4 }],
  ['Never use largest number', 'STORE\nTEL 02-123-4567\nRECEIPT #123456789\nCOFFEE 3000\n2026-09-12', { amount: null }],
  ['Conflicting totals', 'SHOP\nTOTAL 10.00\nTOTAL 20.00', { amount: null }],
  ['Refund', 'SHOP\n환불\n합계 10000원', { amount: null }],
  ['Ambiguous date', 'CAFE\n09/10/2026\nTOTAL USD 10.00', { date: '' }],
  ['Impossible date', 'CAFE\n2026-02-30\nTOTAL 100', { date: '' }],
  ['Yen symbol needs currency confirmation', 'CAFE\nTOTAL ¥ 1500', { amount: 1500, currency: '' }],
  ['DCC needs currency confirmation', 'SHOP\nTOTAL JPY 1500\nKRW 14250', { currency: '' }],
  ['Different total priorities', 'CAFE\nTOTAL 10000\n결제금액 9000원', { amount: 9000 }],
  ['No fake merchant from numeric metadata', '영수증\n사업자번호 123-45-67890\n2026-09-12\n합계 1000원', { merchant: '' }],
];
for (const [name, text, expected] of cases) {
  const actual = parser.parseReceipt(text);
  for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `${name}: ${key}`);
}
for (const [text, value] of [['12,500', 12500], ['10.90', 10.9], ['1.234,56', 1234.56], ['0', 0], ['oops', null]]) {
  assert.equal(parser.parseReceiptNumber(text), value, text);
}
const existing = { id: 'saved', date: '2026-09-12', description: '서울 카페', amount: 12500, mode: 'domestic', receipt: { fingerprint: 'abc' } };
assert.equal(parser.findReceiptDuplicate([existing], { fingerprint: 'abc' }).id, 'saved');
assert.equal(parser.findReceiptDuplicate([existing], { fingerprint: 'abc' }, 'saved'), undefined);
assert.equal(parser.findReceiptDuplicate([existing], { date: existing.date, merchant: '서울카페', amount: 12500, currency: 'KRW' }).id, 'saved');
assert.equal(parser.findReceiptDuplicate([existing], { date: existing.date, merchant: '서울카페', amount: 12500, currency: 'JPY' }), undefined);
console.log(`PASS: ${cases.length} receipt scenarios, 5 number formats, 4 duplicate checks`);
