const assert = require('node:assert/strict');
const M = require('../src/app/features/travel-companion/model');
const Domain = require('../src/app/domain/commands');
const Sync = require('../src/app/sync/model');
const fixture = require('./fixtures/companion-experience');
const { createDatabase, actors } = require('./sync-database-regression');
const clone = value => JSON.parse(JSON.stringify(value));
async function main() {
  const original = clone(fixture), trip = clone(fixture);
  const wallet = M.walletGroups(trip, '2026-11-03');
  assert.deepEqual(wallet.today.map(row => row.sourceId), ['sky-booking']);
  assert(M.walletGroups(trip, '2026-11-06').today.some(row => row.returnJourney && row.from === '나리타'));
  assert.equal(M.walletGroups(trip, '2026-11-01').today.length, 0);
  const journeys = M.reservationOccurrences(trip).filter(row => row.sourceId === 'roundtrip');
  const linkedRoundtrip = { ...trip, itineraryItems: journeys.map((row, i) => M.itineraryForReservation(row, { id: `journey-${i}`, linkedReservationId: row.id })) };
  const changedFlight = { ...trip.entries.find(row => row.id === 'roundtrip'), flightReturnDate: '2026-11-05', flightReturnDepartTime: '16:10' };
  const changedJourneys = M.updateEntryItinerary(linkedRoundtrip, changedFlight, trip.entries.find(row => row.id === 'roundtrip'));
  assert.equal(changedJourneys[0].date, '2026-11-02'); assert.equal(changedJourneys[1].date, '2026-11-05'); assert.equal(changedJourneys[1].time, '16:10');
  assert.equal(changedJourneys[1].transportReservation.from, '나리타');
  assert.equal(M.activeStays(trip, '2026-11-06').length, 0);
  assert.equal(M.defaultItineraryDate(trip, new Date('2026-12-01T00:00Z')), trip.endDate);
  const progress = M.progress(trip, '2026-11-03', { cursor: 'dinner' });
  assert.equal(progress.next.id, 'dinner'); assert(progress.earlier.some(row => row.id === 'sky'));
  assert.equal(M.progress(trip, '2026-11-03', { skipped: ['sky'] }).next.id, 'dinner');
  assert.equal(M.progress(trip, '2026-11-03', { cursor: 'deleted' }).next.id, 'sky');
  const analysis = M.analysis(trip, '2026-11-03');
  assert.equal(analysis.stayMinutes, 330); assert.equal(analysis.transitMinutes, 55);
  assert.equal(M.analysis(trip, '2026-11-04').missing.length, 3);
  assert.equal(M.analysis(trip, '2026-11-04', 'shortest').stays.at(-1).id, 'unknown');
  const entry = { date: '__pretrip__', paymentDate: '2026-10-25', category: '관광', description: '새 예약 결제', amount: 25650, mode: 'overseas', currency: 'JPY', foreignAmount: 2700, exchangeRate: 950, exchangeBase: 100, paymentMethod: 'card', payerKey: 'leader' };
  const data = { type: 'activity', title: '새 예약', date: '2026-11-04', quotedAmount: 2700, quotedCurrency: 'JPY', ticketUrl: 'https://example.test/ticket', guests: '2', payment: { mode: 'create', expenseId: 'new-payment', entry } };
  const paid = Domain.mutate(trip, 'reservation', 'add', { id: 'new-reservation', data });
  assert.equal(paid.entries.length, trip.entries.length + 1);
  assert.equal(paid.travelCompanion.reservations.at(-1).linkedExpenseId, 'new-payment');
  assert(!Object.hasOwn(paid.travelCompanion.reservations.at(-1), 'payment'));
  const quoted = Domain.mutate(paid, 'reservation', 'update', { id: 'new-reservation', data: { quotedAmount: 9000, payment: { mode: 'none' } } });
  assert.equal(quoted.entries.find(row => row.id === 'new-payment').amount, 25650);
  const updated = Domain.mutate(quoted, 'reservation', 'update', { id: 'new-reservation', data: { payment: { mode: 'update', entry: { ...entry, amount: 28500, foreignAmount: 3000 } } } });
  assert.equal(updated.entries.length, paid.entries.length); assert.equal(updated.entries.find(row => row.id === 'new-payment').amount, 28500);
  const unlinked = Domain.mutate(updated, 'reservation', 'update', { id: 'new-reservation', data: { payment: { mode: 'unlink' } } });
  assert.equal(unlinked.entries.length, updated.entries.length);
  const removed = Domain.mutate(updated, 'reservation', 'remove', { id: 'new-reservation' });
  assert(removed.entries.some(row => row.id === 'new-payment'));
  assert.throws(() => Domain.mutate(trip, 'reservation', 'add', { id: 'bad', data: { ...data, payment: { mode: 'create', expenseId: 'bad-payment', entry: { ...entry, amount: 1 } } } }), /환산/);
  assert.deepEqual(trip, original, 'All domain changes leave the captured source immutable');
  const enc = Sync.encode(paid), privateRows = Sync.shared(enc, { shareExpenses: false });
  assert.equal(privateRows[Sync.key('reservation', 'new-reservation')].fields['p:quotedAmount'], undefined);
  assert.equal(Sync.decode(enc, paid).travelCompanion.reservations.at(-1).ticketUrl, data.ticketUrl);

  const db = await createDatabase();
  const call = async (name, args) => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`, args.map(value => value && typeof value === 'object' ? JSON.stringify(value) : value))).rows[0].result;
  try {
    const source = { ...trip, collaboration: { privacy: { shareItinerary: true, shareExpenses: true } } };
    const id = await call('triplog_create_sync', [actors[0], source.id, source, Object.values(Sync.encode(source))]);
    await db.query("insert into public.triplog_trip_members(trip_id,user_id,role,status) values($1,$2,'editor','accepted')", [id, actors[1]]);
    const read = actor => call('triplog_read_sync', [actor, id, null]);
    let before = Sync.fromRows((await read(actors[0])).entities);
    const operation = { protocolVersion: 2, operationId: Sync.uuid(), patches: Sync.diff(before, Sync.encode({ ...paid, collaboration: source.collaboration })) };
    const result = await call('triplog_apply_sync', [actors[0], id, operation]);
    assert.equal(result.status, 'applied');
    const head = (await read(actors[0])).head;
    assert.equal((await call('triplog_apply_sync', [actors[0], id, operation])).status, 'applied');
    assert.equal((await read(actors[0])).head, head, 'Same operation remains idempotent');
    before = Sync.fromRows((await read(actors[0])).entities);
    assert(before[Sync.key('expense', 'new-payment')]);
    const invalid = { protocolVersion: 2, operationId: Sync.uuid(), patches: [
      { kind: 'expense', id: 'atomic-orphan', action: 'create', fields: { 'g:money': { amount: 123 } }, before: null },
      { kind: 'reservation', id: 'invalid-money', action: 'create', fields: { 'p:title': '잘못된 예약', 'p:quotedAmount': -1 }, before: null }
    ] };
    await assert.rejects(call('triplog_apply_sync', [actors[0], id, invalid]), /INVALID_RESERVATION_AMOUNT/);
    assert(!Sync.fromRows((await read(actors[0])).entities)[Sync.key('expense', 'atomic-orphan')]);
    await call('triplog_sync_control', [actors[0], id, 'privacy', { shareExpenses: false, shareItinerary: true, showMemberEmail: false, allowInviteRequests: true }]);
    const member = (await read(actors[1])).entities.find(row => row.kind === 'reservation' && row.entity_id === 'new-reservation');
    assert(member); assert.equal(member.data['p:quotedAmount'], undefined); assert.equal(member.data['p:linkedExpenseId'], undefined); assert.equal(member.field_versions['p:quotedAmount'], undefined);
    const owner = (await read(actors[0])).entities.find(row => row.kind === 'reservation' && row.entity_id === 'new-reservation');
    assert.equal(owner.data['p:quotedAmount'], 2700);
    const delta = await call('triplog_read_sync', [actors[1], id, 0]);
    assert(delta.entities.filter(row => row.kind === 'reservation').every(row => !Object.hasOwn(row.data, 'p:quotedAmount')));
  } finally { await db.close(); }
  console.log('PASS companion experience: date clamp, progress cursor/skip, roundtrip occurrences, stay exclusion, multi-leg analytics, atomic reservation/payment, original IDs, quote vs paid, unlink/delete preservation, retry, SQL rollback and private money redaction.');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
