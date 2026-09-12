// Exercise synchronization with in-memory storage, without an account or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const storage = new Map();
const rendered = [];
const state = {};
const context = vm.createContext({
  state,
  console,
  PRE_TRIP_EXPENSE_DATE: 'pretrip',
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  CustomEvent: class {},
  window: { dispatchEvent() {}, TripLog: { core: { config: { STORAGE_KEY: 'legacy' } }, register() {} } },
  render: () => rendered.push(JSON.parse(JSON.stringify(state))),
});
for (const file of ['shared/date-time.js', 'navigation/trip-dates.js', 'persistence/state-storage.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app', file), 'utf8'), context);
}
const run = code => vm.runInContext(code, context);
const reset = () => {
  storage.clear();
  rendered.length = 0;
  run(`Object.assign(state, getFallbackState('trip_test'), {
    selectedDate: '2026-06-12', selectedItineraryDate: '2026-06-14', lastActiveItineraryDate: '2026-06-14'
  }); localStorage.setItem(TRIPS_KEY, JSON.stringify([state])); localStorage.setItem(ACTIVE_TRIP_ID_KEY, state.id);`);
};
const checkNavigation = expected => {
  for (const view of [...rendered, state, run('getTrips().find(trip => trip.id === state.id)')]) {
    assert.deepEqual([view.selectedDate, view.selectedItineraryDate, view.lastActiveItineraryDate], expected);
  }
};

reset();
run(`syncTripsFromSnapshots([{...getFallbackState('trip_test'), tripName: 'Remote update'}]);`);
checkNavigation(['2026-06-12', '2026-06-14', '2026-06-14']);
assert.equal(state.tripName, 'Remote update');

reset();
run(`importSharedTripSnapshot({...getFallbackState('trip_test'), tripName: 'Remote download'});`);
checkNavigation(['2026-06-12', '2026-06-14', '2026-06-14']);
assert.equal(state.tripName, 'Remote download');

reset();
run(`state.selectedDate = PRE_TRIP_EXPENSE_DATE; state.selectedItineraryDate = 'all';
  syncTripsFromSnapshots([getFallbackState('trip_test')]);
  importSharedTripSnapshot(getFallbackState('trip_test'));`);
checkNavigation(['pretrip', 'all', '2026-06-14']);

reset();
run(`syncTripsFromSnapshots([{...getFallbackState('trip_test'), endDate: '2026-06-12'}]);`);
checkNavigation(['2026-06-12', '2026-06-09', '2026-06-09']);

reset();
run(`syncTripsFromSnapshots([{...getFallbackState('trip_test'), startDate: '2026-06-15'}]);`);
checkNavigation(['2026-06-15', '2026-06-15', '2026-06-15']);

reset();
run(`syncTripsFromSnapshots([getFallbackState('other_trip')], {preferredActiveId: 'other_trip'});`);
checkNavigation(['2026-06-09', '2026-06-09', '2026-06-09']);
assert.equal(state.id, 'other_trip');

reset();
run(`syncTripsFromSnapshots([getStateSnapshot()]); syncTripsFromSnapshots([getStateSnapshot()]);`);
checkNavigation(['2026-06-12', '2026-06-14', '2026-06-14']);
console.log('PASS: 7 sync navigation scenarios, including every intermediate render and persisted selection.');
