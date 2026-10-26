const assert = require('node:assert/strict');
const model = require('../src/app/features/print/report-model');
const [trip, many, empty] = require('./fixtures/export-reports');
const original = JSON.stringify(trip), report = model.create(trip, { memberCount: 2 });
assert.equal(model.transitMode('walk').emoji, '🚶');
assert.equal(model.transitMode('car').emoji, '🚗');
assert.equal(model.transitMode('bus').emoji, '🚌');
assert.equal(model.transitMode('train').emoji, '🚆');
assert.equal(model.transitMode('subway').emoji, '🚇');
assert.equal(model.transitMode('flight').emoji, '✈️');
assert.deepEqual(model.transitMode('etc'), model.transitMode('flight'), 'Legacy flight records keep the same meaning as the itinerary editor');
assert.equal(model.transitMode('taxi').emoji, '🚕');
assert.equal(model.transitMode('ferry').emoji, '🚢');
assert.equal(model.transitMode('bicycle').emoji, '🚲');
assert.equal(model.transitMode('constructor').label, '기타 이동', 'Unknown and prototype-named values never become car journeys');
assert.equal(model.transitMode().label, '이동 수단 미정');
assert.equal(report.total, 486000); assert.equal(report.perPerson, 243000);
assert.equal(Object.hasOwn(report, 'budgetPercent'), false, 'No planned spending limit enters the report');
assert.equal(report.categories.reduce((sum, row) => sum + row.percent, 0), 100);
assert.equal(report.trend.reduce((sum, row) => sum + row.amount, 0), report.total);
assert.equal(report.entries.length, trip.entries.length);
const area = 420 * 232, boxes = model.treemap(report.categories);
assert(Math.abs(boxes.reduce((sum, row) => sum + row.width * row.height, 0) - area) < .0001);
boxes.forEach(box => {
  assert(Math.abs(box.width * box.height / area - box.amount / report.positive) < .00001);
  assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= 420.001 && box.y + box.height <= 232.001);
});
const full = model.create(many, { memberCount: 2 });
assert.equal(full.entries.length, 137); assert.equal(full.entries[0].date, '__pretrip__');
assert.equal(full.total, many.entries.reduce((sum, entry) => sum + entry.amount, 0));
assert.equal(full.positive + full.adjustments, full.total); assert.equal(full.adjustments, -2000);
assert.equal(full.trend.reduce((sum, row) => sum + row.amount, 0), full.total);
assert.equal(model.create(many, { expensePeriod: '__pretrip__' }).entries.length, 1);
assert(model.create(many, { expensePeriod: '2026-10-10' }).entries.every(entry => entry.date === '2026-10-10'));
const sparse = model.create({ ...trip, entries: [...trip.entries, { id: 'old', date: '2026-09-01', amount: 50, category: '기타' }, { id: 'undated', amount: 60, category: '기타' }] });
assert.equal(sparse.trend.reduce((sum, row) => sum + row.amount, 0), 486110);
const long = model.create({ ...trip, startDate: '2026-10-01', endDate: '2026-12-31' });
const buckets = model.trendBuckets(long.trend);
assert(buckets.length <= 7); assert.equal(buckets.reduce((sum, row) => sum + row.amount, 0), report.total);
const daily = model.dailyShares(report);
assert.deepEqual(model.expenseHighlights(report), { days: 3, average: 162000, peak: report.trend[0] });
const selectedReport = model.create(trip, { expensePeriod: '2026-10-10' });
assert.equal(model.expenseHighlights(selectedReport).average, 174000);
assert.equal(model.expenseHighlights(selectedReport).days, 1);
assert.equal(model.expenseHighlights(model.create(many, { expensePeriod: '__pretrip__' })).average, null);
assert.equal(model.expenseHighlights(model.create(empty)).peak, null);
assert.equal(model.expenseHighlights(model.create(empty)).average, null);
assert.deepEqual(daily.rows.map(row => Number(row.percent.toFixed(1))), [38.3, 35.8, 25.9]);
assert.equal(daily.zero, 0);
daily.rows.forEach(row => { assert.equal(row.barStart, 0); assert(Math.abs(row.barWidth - row.percent) < 1e-9); });
assert.equal(model.dailyShares(model.create(trip, { expensePeriod: '2026-10-10' })).rows[0].percent, 100, 'A selected day uses its own report total');
const signedReport = amounts => model.create({ ...trip, entries: amounts.map((amount, index) => ({ date: `2026-10-${String(index + 9).padStart(2, '0')}`, amount })) });
const signed = model.dailyShares(signedReport([100, -25]));
assert(Math.abs(signed.rows[0].percent - 400 / 3) < 1e-9);
assert(Math.abs(signed.rows[1].percent + 100 / 3) < 1e-9);
assert(Math.abs(signed.zero - 20) < 1e-9);
assert(Math.abs(signed.rows[0].barWidth - 80) < 1e-9);
assert(Math.abs(signed.rows[1].barWidth - 20) < 1e-9);
assert.equal(signed.rows[1].barStart, 0, 'Refunds extend left from the shared zero line');
for (const amounts of [[100, -100], [25, -100], [0, 0]]) {
  const chart = model.dailyShares(signedReport(amounts));
  assert.equal(chart.hasPercent, false);
  chart.rows.forEach(row => {
    assert.equal(row.percent, null, 'Zero and negative totals never invent a percentage');
    assert(Number.isFinite(row.barWidth) && row.barWidth >= 0 && row.barStart + row.barWidth <= 100 + 1e-9);
  });
}
const withSpecial = model.dailyShares(model.create({ ...trip, entries: [
  { date: '__pretrip__', amount: 100 }, { date: '2026-10-09', amount: 300 },
  { date: '2026-09-01', amount: 50 }, { date: '', amount: 50 },
] }));
assert.equal(withSpecial.rows.find(row => row.date === '__pretrip__').percent, 20);
assert.equal(withSpecial.rows.find(row => row.date === '2026-10-09').percent, 60);
assert.equal(withSpecial.rows.find(row => row.date === '2026-09-01').percent, 10);
assert.equal(withSpecial.rows.find(row => row.date === '').percent, 10);
for (const source of [full, sparse, long]) {
  const chart = model.dailyShares(source);
  assert(chart.rows.length <= 7);
  assert.equal(chart.rows.reduce((sum, row) => sum + row.amount, 0), source.total);
  assert(Math.abs(chart.rows.reduce((sum, row) => sum + row.percent, 0) - 100) < 1e-9);
  const highlight = model.expenseHighlights(source);
  assert.equal(highlight.average, Math.round(source.total / source.calendar.length));
  assert.equal(highlight.peak.amount, Math.max(...source.trend.map(row => row.amount)), 'Highlights use individual days before date grouping');
}
const layout = model.schedule(report.days, 624);
assert.equal(layout.start, 480); assert.equal(layout.end, 1200);
assert.equal(layout.columns.flatMap(day => day.timed).length, 9);
const first = layout.columns[0].timed.find(row => row.item.id === 'export-stop-0');
assert.equal(first.top, (630 - 480) * 624 / 720);
layout.columns.forEach(day => day.timed.forEach((row, i) => {
  assert(row.top >= 0 && row.top + row.height <= layout.height + .001);
  day.timed.slice(i + 1).forEach(other => {
    if (row.top < other.top + other.height + 3 && other.top < row.top + row.height + 3) assert.notEqual(row.lane, other.lane);
  });
}));
assert.deepEqual(model.timeRange({ date: '2026-10-09', time: '23:30', endTime: '01:15' }), { start: 1410, end: 1515 });
assert.deepEqual(model.timeRange({ date: '2026-10-09', time: '23:30', endTime: '07:00', theme: 'lodging' }), { start: 1410, end: 1860 });
assert.equal(model.timeRange({ date: '2026-10-09', time: '20:00', endTime: '09:00', transportReservation: { arrivalDate: '2026-10-11' } }).end, 3420);
assert.equal(model.dateValue('2026-02-30'), null); assert.equal(model.timeMinutes('25:00'), null);
assert.equal(model.create(empty).total, 0); assert.equal(model.create(empty).days.length, 0);
assert.equal(model.create(trip, { itineraryDay: '2026-10-10' }).itemCount, 3);
assert.equal(JSON.stringify(trip), original);
console.log('PASS print model: complete scopes, exact totals and refunds, proportional treemap, daily percentages and signed bars, zero/negative totals, conserved date groups, timed placement, overlap lanes, overnight events, empty states, immutable inputs.');
