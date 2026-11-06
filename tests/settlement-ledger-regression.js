const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sandbox = { state: structuredClone(require('./fixtures/settlement-ledger')),
  compareExpenseEntryDates: (a,b) => a.date.localeCompare(b.date),
  normalizeSettlementSettings: value => ({ itemSplits: {}, ...value }),
  window: { TripLog: { register(_name, api) { Object.assign(sandbox, api); } } } };
vm.createContext(sandbox);
for (const file of ['settlement-sources.js','settlement-model.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/app/features/settlement',file),'utf8'),sandbox);
const build = () => sandbox.buildSettlementModel({ id: 'current', state: sandbox.state });
const before = JSON.stringify(sandbox.state), model = build();
assert.equal(model.totalTripSpent,180000);
assert.deepEqual(Array.from(model.memberSummaries,m=>[m.paid,m.owed,m.balance]),[[140000,95000,45000],[40000,85000,-45000]]);
assert.deepEqual(Array.from(model.transactions,t=>[t.from,t.to,t.amount]),[['윤디','JH',45000]]);
assert.equal(JSON.stringify(sandbox.state),before,'Read-only calculation must preserve all persisted allocation settings');
sandbox.state.entries.push({ id:'refund',date:'2026-11-01',amount:-101,payerKey:'leader' });
let result = build();
assert.equal(result.totalTripSpent,179899);
assert.deepEqual(Array.from(result.entryRows.find(r=>r.raw.id==='refund').shares?Object.values(result.entryRows.find(r=>r.raw.id==='refund').shares):[]),[-51,-50]);
assert.equal(result.memberSummaries.reduce((n,m)=>n+m.balance,0),0);
sandbox.state.settlement.itemSplits['current:refund']={mode:'custom',shares:{leader:-90,'companion:yundi':-11}};
assert.equal(build().invalidEntries.length,0);
for (const shares of [{leader:50,'companion:yundi':51},{leader:-20},{leader:-101,removed:-1},{leader:NaN}]) {
  sandbox.state.settlement.itemSplits['current:refund']={mode:'custom',shares};
  assert.equal(build().transactions.length,0); assert(build().invalidEntries.length);
}
delete sandbox.state.settlement.itemSplits['current:refund'];
sandbox.state.entries.at(-1).payerKey='removed';
assert(build().invalidEntries.at(-1).unknownPayer);
sandbox.state.entries.pop();
sandbox.state.companions[0].individualSpent=9000;
result=build();assert.equal(result.outsideSpent,9000);assert.equal(result.totalTripSpent,180000);assert(result.blocked);assert.equal(result.transactions.length,0);
sandbox.state.companions[0].individualSpent=0;
sandbox.state.entries=[{id:'max',date:'2026-11-01',amount:Number.MAX_SAFE_INTEGER},{id:'overflow',date:'2026-11-01',amount:1}];
assert(build().invalidTotal);assert.equal(build().transactions.length,0);
sandbox.state.entries=[];
assert.equal(build().transactions.length,0);assert.equal(build().totalTripSpent,0);
console.log('PASS: ledger-only totals, canonical custom shares, signed refunds, integer remainders, stale members, invalid payers, overflow, legacy migration guard and read purity.');
