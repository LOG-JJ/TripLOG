const assert = require('node:assert/strict');
const { summarize } = require('../src/app/shared/travel-costs');
const trip = { totalBudget: 999999999, companions: [{}], entries: [
  { date: '__pretrip__', amount: 180000 }, { date: '2026-10-09', amount: 50000 },
  { date: '2026-10-09', amount: -5000 }, { date: '', amount: 1500 },
  { date: '2027-01-01', amount: 14500, foreignAmount: 10, currency: 'USD' },
] };
const before = JSON.stringify(trip), result = summarize(trip, { date: '2026-10-09' });
assert.deepEqual([result.total, result.count, result.pretrip, result.during, result.refunds, result.dayTotal, result.dayCount, result.perPerson], [241000, 5, 180000, 61000, -5000, 45000, 2, 120500]);
assert.deepEqual(summarize({ ...trip, totalBudget: 0 }, { date: '2026-10-09' }), result);
assert.equal(summarize(trip, { members: 4 }).perPerson, 60250);
assert.equal(summarize({ entries: [] }).total, 0);
assert.equal(summarize({ entries: [{ amount: -500 }] }).total, -500, 'Refunds are not clamped away');
assert.equal(summarize({ entries: [null, { amount: '3500' }, { amount: 'not a number' }] }).total, 3500);
assert.equal(JSON.stringify(trip), before);
const changed = structuredClone(trip);
changed.entries.push({ amount: 1000 }); assert.equal(summarize(changed).total, 242000);
changed.entries.at(-1).amount = 3000; assert.equal(summarize(changed).total, 244000);
changed.entries.pop(); assert.equal(summarize(changed).total, 241000);
console.log('PASS travel costs: recorded cumulative totals, pretrip, refunds, undated/out-of-range entries, KRW conversion, add/edit/delete, member averages and legacy-budget independence.');

const costs = require('../src/app/shared/travel-costs');
const refunded = [
  { amount: 100000, category: '식비', paymentDate: '2026-10-13' },
  { amount: -20000, category: '식비', paymentDate: '2026-10-13' },
];
assert.equal(costs.summarize({ entries: refunded }).total, 80000);
assert.deepEqual(costs.paymentTrend(refunded), [{ date: '2026-10-13', amount: 80000 }]);
assert.equal(costs.categoryShares(refunded)[0].ratio, 1, 'Composition divides gross spending by gross spending');
refunded[1].paymentDate = '2026-10-14';
assert.equal(costs.paymentTrend(refunded)[1].amount, -20000, 'Refund-only days retain their sign');
refunded[1].amount = -100000;
assert.equal(costs.summarize({ entries: refunded }).total, 0);
assert.equal(costs.categoryShares(refunded)[0].ratio, 1, 'Full refunds never divide chart angles by zero');
assert.deepEqual(costs.categoryShares([{ category: '교통', amount: 100 }, { category: '식비', amount: 100 }]).map(row => row.name), ['교통', '식비'], 'Equal screen shares keep their original order');
console.log('PASS shared report accounting: signed payment totals, gross composition denominator, full refunds and stable equal-value order.');
