'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { IDBFactory } = require('fake-indexeddb');
const O = require('../src/app/shared/expense-order');
const M = require('../src/app/sync/model');
const D = require('../src/app/domain/commands');
const Costs = require('../src/app/shared/travel-costs');
const { createDatabase, actors } = require('./sync-database-regression');
const { artifactDirectory } = require('./helpers/artifact-output');
const rows = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, date: i === 3 ? '__pretrip__' : '2026-10-25', paymentDate: `2026-10-${25 - i}`, category: i % 2 ? '교통' : '식비', description: id,
  amount: 1000 + i, mode: 'domestic', note: `메모-${id}`, payerKey: 'leader', paymentMethod: 'card', receipt: { recognizedDate: `2026-10-${25 - i}` }, createdAt: i }));
const ids = items => O.sort(items).map(item => item.id);
const unchangedContent = items => items.map(({ expenseOrder, ...item }) => item);
const snapshot = { id: 'expense-order-fixture', tripName: '지출 순서 검증', startDate: '2026-10-25', endDate: '2026-10-27', travelMode: 'domestic', entries: rows,
  itineraryItems: [{ id: 'linked', date: '2026-10-25', time: '10:00', place: '연결 일정', expenseId: 'b', syncExpense: true, cost: 1001 }], companions: [], packingList: [], settlement: { itemSplits: { 'current:b': { mode: 'equal' } } } };
async function main() {
  const original = M.clone(rows), moved = O.move(rows, 'd', 'b');
  assert.deepEqual(ids(rows.slice().reverse()), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(moved.items), ['a', 'd', 'b', 'c']); assert.deepEqual(rows, original);
  assert.deepEqual(unchangedContent(moved.items), rows);
  assert.deepEqual(ids(O.move(moved.items, 'a', 'c', 'after').items), ['d', 'b', 'c', 'a']);
  for (const args of [['a', 'a'], ['unknown', 'a'], ['a', 'unknown'], ['a', 'b', 'invalid']]) assert.equal(O.move(rows, ...args).changed, false);
  assert.equal(O.move(moved.items, 'a', 'd').changed, false);
  assert.deepEqual(O.sort(null), []); assert.equal(O.rank(null), null); assert.equal(O.rank({ expenseOrder: Infinity }), null); assert.equal(O.rank({ expenseOrder: '1' }), null);
  assert.deepEqual(ids([...moved.items, { ...rows[0], id: 'new', paymentDate: '2027-01-01' }]), ['a', 'd', 'b', 'c', 'new']);
  let repeated = moved.items;
  for (let i = 0; i < 200; i++) { const sorted = O.sort(repeated); repeated = O.move(repeated, sorted.at(-1).id, sorted[1].id).items; assert.equal(ids(repeated)[1], sorted.at(-1).id); assert(repeated.every(entry => Number.isFinite(O.rank(entry)))); }
  assert.deepEqual(Costs.summarize({ entries: moved.items }), Costs.summarize(snapshot));

  const ranked = { ...snapshot, entries: moved.items }, changed = { ...ranked, entries: O.move(moved.items, 'c', 'd').items };
  assert.deepEqual(ids(M.decode(M.encode(ranked), ranked).entries), ['a', 'd', 'b', 'c']);
  const patches = M.diff(M.encode(ranked), M.encode(M.reposition(changed, M.encode(ranked))));
  assert.equal(patches.length, 1); assert.deepEqual(Object.keys(patches[0].fields), ['p:expenseOrder']);
  assert.deepEqual(changed.itineraryItems, snapshot.itineraryItems); assert.deepEqual(changed.settlement, snapshot.settlement);
  const domain = D.mutate(snapshot, 'expense', 'move', { id: 'd', target: 'b', placement: 'before' });
  assert.deepEqual(D.list(domain, 'expense').map(entry => entry.id), ['a', 'd', 'b', 'c']);
  assert.deepEqual(unchangedContent(domain.entries).sort((a, b) => a.id.localeCompare(b.id)), rows);
  const restored = JSON.parse(JSON.stringify(domain)); assert.deepEqual(D.list(restored, 'expense').map(entry => entry.id), ['a', 'd', 'b', 'c']);

  const context = vm.createContext({ console, crypto, structuredClone, indexedDB: new IDBFactory(), TripLogSyncModel: M, dispatchEvent() {}, CustomEvent });
  vm.runInContext(fs.readFileSync('src/app/sync/repository.js', 'utf8'), context);
  const R = context.TripLogSyncRepository;
  await R.migrate([ranked]);
  const before = (await R.read(ranked.id)).snapshot;
  await R.save({ ...before, entries: O.move(before.entries, 'c', 'd').items }, before); R.close();
  const saved = (await R.read(ranked.id)).snapshot;
  assert.deepEqual(ids(saved.entries), ['a', 'c', 'd', 'b']); assert.deepEqual(unchangedContent(saved.entries).map(entry => entry.amount), rows.map(entry => entry.amount)); R.close();

  const db = await createDatabase();
  try {
    const rpc = async (name, args) => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) result`, args.map(value => value && typeof value === 'object' ? JSON.stringify(value) : value))).rows[0].result;
    const tid = await rpc('triplog_create_sync', [actors[0], ranked.id, ranked, Object.values(M.encode(ranked))]);
    await db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'editor','accepted')", [tid, actors[1]]);
    const baseline = M.fromRows((await rpc('triplog_read_sync', [actors[0], tid, null])).entities);
    const applyMove = async (actor, id, target, placement = 'before') => {
      const current = M.decode(baseline, ranked), next = { ...current, entries: O.move(current.entries, id, target, placement).items };
      const changes = M.diff(baseline, M.encode(next)); assert.equal(changes.length, 1); assert.deepEqual(Object.keys(changes[0].fields), ['p:expenseOrder']);
      return rpc('triplog_apply_sync', [actor, tid, { protocolVersion: 2, operationId: M.uuid(), patches: changes }]);
    };
    assert.equal((await applyMove(actors[0], 'c', 'd')).status, 'applied');
    assert.equal((await applyMove(actors[1], 'b', 'c', 'after')).status, 'applied');
    assert.equal((await applyMove(actors[1], 'c', 'a')).status, 'conflict');
    const fresh = M.fromRows((await rpc('triplog_read_sync', [actors[0], tid, null])).entities);
    assert.deepEqual(ids(M.decode(fresh, ranked).entries), ['a', 'c', 'd', 'b']);
    assert.deepEqual(fresh['expense:b'].fields['g:money'], baseline['expense:b'].fields['g:money']);
  } finally { await db.close(); }
  fs.writeFileSync(path.join(artifactDirectory('expense-order'), 'model-result.json'), JSON.stringify({ passed: true, cases: ['latest default', 'before/after and first/last moves', 'invalid/no-op guards', 'new rows append to manual order', 'rank precision rebase', 'content/totals/linked itinerary unchanged', 'independent sync property', 'CLI and JSON roundtrip', 'IndexedDB reopen', 'concurrent independent SQL moves and same-row conflict'], at: new Date().toISOString() }, null, 2));
  console.log('PASS expense order: stable manual ranks, unchanged content/totals, CLI parity, reload and concurrent SQL synchronization.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
