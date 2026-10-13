const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sandbox = {
  window: {TripLog: {register(_name, api) {Object.assign(sandbox, api);}}},
  state: {companions: [{name:'민지',individualSpent:0},{name:'준호',individualSpent:0}],settlement:{itemSplits:{}}},
  normalizeSettlementSettings: s => ({itemSplits:{},...s}),
  compareExpenseEntryDates: (a,b) => a.date.localeCompare(b.date),
  isPreTripExpenseDate: date => date === '__pretrip__',
};
sandbox.window.TripLog.shared = { travelCosts: require('../src/app/shared/travel-costs') };
sandbox.window.TripLog.data = { expenseCategories: require('../src/app/data/expense-categories') };
vm.createContext(sandbox);
for (const file of ['src/app/shared/totals.js','src/app/features/expenses/lodging.js','src/app/features/settlement/settlement-sources.js','src/app/features/settlement/settlement-model.js','src/app/features/redesign/design-model.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
}
const entries = [
  {id:'hotel',date:'__pretrip__',category:'숙소',amount:180000,payerKey:'leader',paymentDate:'2026-09-10'},
  {id:'train',date:'__pretrip__',category:'교통',amount:72000,payerKey:'companion:민지',paymentDate:'2026-09-11'},
  {id:'food',date:'__pretrip__',category:'식비',amount:36000,payerKey:'companion:준호',paymentDate:'2026-09-12'},
  {id:'ticket',date:'__pretrip__',category:'관광',amount:24000,payerKey:'companion:민지',paymentDate:'2026-09-13'},
];
const build = list => sandbox.buildSettlementModel({id:'current',state:{entries:list}});
const assigned=build(entries);
assert.equal(assigned.totalTripSpent,312000);
assert.deepEqual(Array.from(assigned.memberSummaries,m=>m.paid),[180000,96000,36000]);
assert.deepEqual(Array.from(assigned.memberSummaries,m=>m.balance),[76000,-8000,-68000]);
assert.deepEqual(Array.from(assigned.transactions,t=>t.amount),[8000,68000]);
assert.equal(assigned.memberSummaries.reduce((n,m)=>n+m.balance,0),0);
const legacy=build(entries.map(({payerKey,...e})=>e));
assert.deepEqual(Array.from(legacy.memberSummaries,m=>m.paid),[312000,0,0]);
const odd=build([{id:'odd',date:'2026-09-18',amount:100,payerKey:'leader'}]);
assert.equal(odd.memberSummaries.reduce((n,m)=>n+m.owed,0),100);
assert.ok(odd.memberSummaries.every(m=>Number.isInteger(m.owed)));
assert.equal(build([{id:'x',date:'2026-09-18',amount:700,payerKey:'removed-person'}]).memberSummaries[0].paid,700);
sandbox.state.companions[0].individualSpent=900;
assert.equal(build(entries).totalTripSpent,312900);
assert.equal(build(entries).memberSummaries[1].paid,96900);
sandbox.state.companions[0].individualSpent=0;
sandbox.state.settlement.itemSplits['current:hotel']={mode:'custom',shares:{leader:1000}};
assert.equal(build(entries).invalidEntries.length,1);
assert.equal(build(entries).transactions.length,0);
const shares=sandbox.categoryShares(entries);
assert.equal(shares.reduce((sum,row)=>sum+row.percent,0),100);
assert.deepEqual(Array.from(shares,r=>r.percent),[58,23,11,8]);
assert.equal(sandbox.paymentTrend(entries).length,4);
assert.equal(sandbox.paymentTrend(entries)[0].date,'2026-09-10');
assert.equal(sandbox.paymentDate({date:'__pretrip__',receipt:{recognizedDate:'2026-09-12'}}),'2026-09-12');
assert.equal(sandbox.categoryShares([]).length,0);
sandbox.state.settlement.itemSplits = {};
sandbox.state.companions = [{ id: 'local-minji', name: '민지', email: 'minji@example.test' }];
sandbox.window.TripLog.features = { collaboration: { tripCollaboration: { getTripMembers: () => [
  { id: 'owner', name: '나', role: 'owner' },
  { id: 'account-minji', name: '민지', email: 'MINJI@example.test', status: 'accepted' },
  { id: 'account-junho', name: '준호', status: 'accepted' },
  { id: 'pending', name: '대기', status: 'pending' },
] } } };
assert.deepEqual(Array.from(sandbox.getSettlementMembers(), member => member.key), ['leader', 'companion:local-minji', 'companion:account-junho']);
const memberPaid = build([{ id: 'member-paid', date: '2026-09-18', amount: 300, payerKey: 'companion:account-junho' }]);
assert.equal(memberPaid.invalidEntries.length, 0);
assert.deepEqual(Array.from(memberPaid.memberSummaries, member => member.paid), [0, 0, 300]);
console.log('PASS: payer allocation, legacy records, integer rounding, missing payer, outside expenses, invalid split, chart shares, payment dates, empty data.');
