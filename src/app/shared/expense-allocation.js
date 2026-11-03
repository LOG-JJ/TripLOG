(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.TripLog?.register) root.TripLog.register('shared.expenseAllocation', api);
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const validMoney = value => Number.isSafeInteger(value) && value >= 0;
  function parse(value, percent = false) {
    const raw = String(value ?? '').trim().replaceAll(',', '');
    if (!raw) return 0;
    if (!(percent ? /^\d+(?:\.\d{0,2})?$/ : /^\d+$/).test(raw)) return NaN;
    if (!percent) { const n = Number(raw); return validMoney(n) ? n : NaN; }
    const [whole, fraction = ''] = raw.split('.');
    const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isInteger(n) && n >= 0 && n <= 10000 ? n : NaN;
  }
  function sum(values) {
    if (!values.every(validMoney)) return NaN;
    const result = values.reduce((total, value) => total + BigInt(value), 0n);
    return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : NaN;
  }
  // Largest remainder keeps the exact won total, including ties and very large amounts.
  function distribute(total, weights) {
    const denominator = sum(weights);
    if (!validMoney(total) || !validMoney(denominator) || !denominator) throw new Error('INVALID_ALLOCATION');
    const divisor = BigInt(denominator), amount = BigInt(total);
    const rows = weights.map((weight, index) => ({ index, value: amount * BigInt(weight) / divisor, remainder: amount * BigInt(weight) % divisor }));
    let remaining = amount - rows.reduce((n, row) => n + row.value, 0n);
    for (const row of [...rows].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)) {
      if (!remaining) break; row.value++; remaining--;
    }
    return rows.map(row => Number(row.value));
  }
  const percentText = units => Number.isFinite(units) ? (units / 100).toFixed(2).replace(/\.?0+$/, '') || '0' : '—';
  function percentages(total, shares) {
    if (!total || !validMoney(total)) return shares.map(() => 0);
    if (sum(shares) === total) return distribute(10000, shares);
    return shares.map(value => validMoney(value) ? Math.min(999999, Number(BigInt(value) * 10000n / BigInt(total))) : NaN);
  }
  function preview(mode, total, values) {
    const moneyOK = validMoney(total);
    let shares = [], units = [], inputOK = true;
    if (mode === 'equal') {
      shares = moneyOK && values.length ? distribute(total, values.map(() => 1)) : values.map(() => 0);
      units = percentages(total, shares);
    } else if (mode === 'percent') {
      units = values.map(value => parse(value, true)); inputOK = units.every(Number.isFinite);
      shares = inputOK && moneyOK ? (sum(units) === 10000 ? distribute(total, units) : units.map(value => Number(BigInt(total) * BigInt(value) / 10000n))) : values.map(() => 0);
    } else {
      shares = values.map(value => parse(value)); inputOK = shares.every(validMoney);
      units = percentages(total, shares);
    }
    const allocated = sum(shares), percentTotal = sum(units);
    const valid = moneyOK && inputOK && allocated === total && (mode !== 'percent' || percentTotal === 10000);
    return { shares, units, allocated, percentTotal, valid, inputOK, moneyOK, diff: moneyOK && Number.isFinite(allocated) ? total - allocated : NaN };
  }
  return { parse, sum, distribute, percentages, preview, percentText, validMoney };
});
