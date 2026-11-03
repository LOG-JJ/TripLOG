const assert = require('node:assert/strict');
const M = require('../src/app/shared/expense-allocation');
assert.equal(M.parse('60,000'), 60000);
assert.equal(M.parse('33.33', true), 3333);
for (const value of ['-1', '3.5', 'abc', '1e6']) assert(Number.isNaN(M.parse(value)));
for (const value of ['100.01', '33.333', '-5', 'Infinity']) assert(Number.isNaN(M.parse(value, true)));
assert.deepEqual(M.preview('equal', 1001, [0,0,0]).shares, [334,334,333]);
assert.deepEqual(M.preview('percent', 1001, ['50','30','20']).shares, [501,300,200]);
assert.deepEqual(M.preview('amount', 120000, ['60000','36000','24000']).units, [5000,3000,2000]);
assert(!M.preview('percent', 120000, ['50','30','10']).valid);
assert(!M.preview('amount', 120000, ['60000','36000','25000']).valid);
assert.deepEqual(M.preview('percent', 1, ['33.33','33.33','33.34']).shares, [0,0,1]);
assert.deepEqual(M.percentages(1, [1,0,0]), [10000,0,0]);
assert(M.preview('amount', 0, ['0','0']).valid);
assert(!M.preview('equal', Number.MAX_SAFE_INTEGER + 1, [0,0]).valid);
assert.equal(M.sum(M.distribute(Number.MAX_SAFE_INTEGER, [50,30,20])), Number.MAX_SAFE_INTEGER);
assert(Number.isNaN(M.sum([Number.MAX_SAFE_INTEGER,1])));
for (let total=1;total<=301;total++) {
  for (const weights of [[1,1,1],[50,30,20],[3333,3333,3334],[0,100,0]]) {
    const shares=M.distribute(total,weights);
    assert.equal(M.sum(shares),total); assert(shares.every(M.validMoney));
    assert.equal(M.sum(M.percentages(total,shares)),10000);
  }
}
assert.equal(M.percentText(5000),'50'); assert.equal(M.percentText(3333),'33.33'); assert.equal(M.percentText(0),'0');
console.log('PASS allocation: exact won totals, largest remainders, fixed decimal percentages, invalid/partial/overflow input, zero shares and safe-integer limits.');
