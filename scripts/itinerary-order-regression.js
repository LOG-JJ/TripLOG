const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { IDBFactory } = require('fake-indexeddb');
const O = require('../src/app/shared/itinerary-order');
const M = require('../src/app/sync/model');
const { createDatabase, actors } = require('./sync-database-regression');
const date = '2026-09-26';
const rows = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, date, place: id, time: `${10 + i}:00`, endTime: `${10 + i}:30`, createdAt: i,
  memo: `memo-${id}`, transits: [{ trans: 'walk', duration: i * 10 }], voucherCode: `voucher-${id}` }));
const ids = items => O.sort(items).map(item => item.id);
const original = M.clone(rows);
assert.deepEqual(ids([...rows].reverse()), ['a', 'b', 'c', 'd']);
assert.equal(O.rank({ id: 'undated' }), null);
assert.equal(O.rank(null), null);
assert.deepEqual(ids([{ id: 'undated' }]), ['undated']);
assert.deepEqual(O.sort(null), []);
const inserted = O.move(rows, 'd', 'b', 'before');
assert.equal(inserted.changed, true);
assert.deepEqual(ids(inserted.items), ['a', 'd', 'b', 'c']);
assert.deepEqual(rows, original);
assert.deepEqual(inserted.items.map(({ itineraryOrder, ...item }) => item), original);
assert.deepEqual(ids(O.move(inserted.items, 'a', 'd', 'after').items), ['d', 'a', 'b', 'c']);
assert.deepEqual(ids(O.move(inserted.items, 'a', 'c', 'after').items), ['d', 'b', 'c', 'a']);
assert.equal(O.move(inserted.items, 'a', 'd', 'before').changed, false);
assert.equal(O.move(rows, 'a', 'a').changed, false);
assert.equal(O.move(rows, 'unknown', 'a').changed, false);
assert.equal(O.move([...rows, { id: 'other', date: '2026-09-27' }], 'a', 'other').changed, false);
assert.deepEqual(ids([...inserted.items, { id: 'new', date, time: '08:00' }]), ['a', 'd', 'b', 'c', 'new']);
assert.equal(O.rank({ ...inserted.items[0], date: '2026-09-27' }), null);
const sameTime = rows.map(item => ({ ...item, time: '', createdAt: 0 }));
assert.deepEqual(ids(O.move(sameTime, 'd', 'b').items), ['a', 'd', 'b', 'c']);
const snapshot = { id: 'order-fixture', tripName: '순서 시험', startDate: date, endDate: '2026-09-28', itineraryItems: inserted.items, entries: [], packingList: [], companions: [] };
assert.deepEqual(ids(M.decode(M.encode(snapshot), snapshot).itineraryItems), ['a', 'd', 'b', 'c']);
const next = { ...snapshot, itineraryItems: O.move(inserted.items, 'c', 'd').items };
const patches = M.diff(M.encode(snapshot), M.encode(M.reposition(next, M.encode(snapshot))));
assert.equal(patches.length, 1);
assert.deepEqual(Object.keys(patches[0].fields), ['p:itineraryOrder']);

let repeated = inserted.items;
for (let i = 0; i < 150; i++) {
  const ordered = O.sort(repeated), moving = ordered.at(-1).id;
  repeated = O.move(repeated, moving, ordered[1].id, 'before').items;
  assert.equal(ids(repeated)[1], moving);
  assert.ok(repeated.every(item => Number.isFinite(O.rank(item))));
}

async function main() {
  const context = vm.createContext({ console, crypto, structuredClone, indexedDB: new IDBFactory(), TripLogSyncModel: M, dispatchEvent() {}, CustomEvent });
  vm.runInContext(fs.readFileSync('src/app/sync/repository.js', 'utf8'), context);
  const R = context.TripLogSyncRepository;
  await R.migrate([snapshot]);
  const before = (await R.read(snapshot.id)).snapshot;
  await R.save({ ...before, itineraryItems: O.move(before.itineraryItems, 'c', 'd').items }, before);
  const saved = (await R.read(snapshot.id)).snapshot;
  assert.deepEqual(ids(saved.itineraryItems), ['a', 'c', 'd', 'b']);
  assert.deepEqual(saved.itineraryItems.map(item => [item.id, item.time, item.endTime, item.memo, item.voucherCode]),
    rows.map(item => [item.id, item.time, item.endTime, item.memo, item.voucherCode]));
  R.close();

  const db = await createDatabase();
  try {
    const rpc = async (name, args) => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) result`, args.map(value => value && typeof value === 'object' ? JSON.stringify(value) : value))).rows[0].result;
    const tid = await rpc('triplog_create_sync', [actors[0], snapshot.id, snapshot, Object.values(M.encode(snapshot))]);
    await db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'editor','accepted')", [tid, actors[1]]);
    const baseline = M.fromRows((await rpc('triplog_read_sync', [actors[0], tid, null])).entities);
    const applyMove = async (actor, id, target, placement) => {
      const current = M.decode(baseline, snapshot);
      const changed = { ...current, itineraryItems: O.move(current.itineraryItems, id, target, placement).items };
      const patches = M.diff(baseline, M.encode(changed));
      assert.equal(patches.length, 1);
      assert.deepEqual(Object.keys(patches[0].fields), ['p:itineraryOrder']);
      return rpc('triplog_apply_sync', [actor, tid, { protocolVersion: 2, operationId: M.uuid(), patches }]);
    };
    assert.equal((await applyMove(actors[0], 'c', 'd', 'before')).status, 'applied');
    assert.equal((await applyMove(actors[1], 'b', 'c', 'after')).status, 'applied');
    assert.equal((await applyMove(actors[1], 'c', 'a', 'before')).status, 'conflict');
    const fresh = M.fromRows((await rpc('triplog_read_sync', [actors[0], tid, null])).entities);
    assert.deepEqual(ids(M.decode(fresh, snapshot).itineraryItems), ['a', 'c', 'd', 'b']);
    assert.deepEqual(fresh['itinerary:c'].fields['g:schedule'], baseline['itinerary:c'].fields['g:schedule']);
    console.log('PASS itinerary order: insertion before/after, first/last, no-op and cross-day guards, unchanged times/content, tied/missing times, rank precision, IndexedDB reload and concurrent independent server moves.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
