(function (root, factory) {
  'use strict';
  const categories = typeof module === 'object' && module.exports
    ? require('../data/expense-categories') : root.TripLog.data.expenseCategories;
  const api = factory(categories);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TripLog?.register('shared.travelCosts', api);
})(typeof window === 'undefined' ? globalThis : window, function (categories) {
  'use strict';
  const amount = entry => Number.isFinite(Number(entry?.amount)) ? Number(entry.amount) : 0;
  // Travel costs are derived only from recorded amounts. Legacy totalBudget
  // remains in saved snapshots for compatibility and never enters this model.
  function summarize(trip = {}, { members, date = '' } = {}) {
    const entries = (Array.isArray(trip.entries) ? trip.entries : []).filter(entry => entry && typeof entry === 'object');
    const people = Math.max(1, Math.floor(Number(members) || (Array.isArray(trip.companions) ? trip.companions.length : 0) + 1));
    const result = { total: 0, positive: 0, count: entries.length, pretrip: 0, during: 0, refunds: 0, dayTotal: 0, dayCount: 0, members: people };
    entries.forEach(entry => {
      const value = amount(entry);
      result.total += value;
      result.positive += Math.max(0, value);
      result[entry.date === '__pretrip__' ? 'pretrip' : 'during'] += value;
      result.refunds += Math.min(0, value);
      if (date && entry.date === date) { result.dayTotal += value; result.dayCount++; }
    });
    result.perPerson = Math.round(result.total / people);
    return result;
  }
  function localDate(date = new Date()) {
    if (!Number.isFinite(date.getTime())) return '';
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function paymentDate(entry) {
    const explicit = entry.paymentDate || entry.receipt?.recognizedDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(explicit || '')) return explicit;
    if (entry.date && entry.date !== '__pretrip__') return entry.date;
    return entry.createdAt ? localDate(new Date(entry.createdAt)) : '';
  }
  // Category composition uses gross spending; daily shares use signed totals.
  function categoryShares(entries, view = 'report') {
    const sums = new Map();
    (entries || []).filter(Boolean).forEach(entry => {
      const name = String(entry.category || '기타');
      sums.set(name, (sums.get(name) || 0) + Math.max(0, amount(entry)));
    });
    const total = [...sums.values()].reduce((sum, value) => sum + value, 0);
    const rows = [...sums].filter(([, value]) => value > 0).map(([name, value]) => ({
      ...categories.get(name, view), amount: value, ratio: total ? value / total : 0,
      percent: total ? Math.floor(value / total * 100) : 0,
    })).sort((a, b) => b.amount - a.amount || (view === 'print' ? a.name.localeCompare(b.name) : 0));
    let remainder = rows.length ? 100 - rows.reduce((sum, row) => sum + row.percent, 0) : 0;
    [...rows].sort((a, b) => (b.ratio * 100 % 1) - (a.ratio * 100 % 1)).forEach(row => {
      if (remainder-- > 0) row.percent++;
    });
    return rows;
  }
  function groupByDate(entries, dateForEntry, initialDates = []) {
    const sums = new Map(initialDates.map(date => [date, 0]));
    (entries || []).filter(Boolean).forEach(entry => {
      const date = dateForEntry(entry);
      sums.set(date, (sums.get(date) || 0) + amount(entry));
    });
    return [...sums].map(([date, value]) => ({ date, amount: value }));
  }
  function paymentTrend(entries) {
    return groupByDate(entries, entry => paymentDate(entry) || '날짜 미지정')
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  function percentOfTotal(value, total) {
    return Number.isFinite(value) && Number.isFinite(total) && total > 0 ? value / total * 100 : null;
  }
  function formatShare(percent) {
    if (percent === null || !Number.isFinite(percent)) return '—';
    if (percent && Math.abs(percent) < .05) return `${percent < 0 ? '-' : ''}<0.1%`;
    return `${Number(percent.toFixed(1)).toFixed(1)}%`;
  }
  return Object.freeze({ summarize, amount, localDate, paymentDate, categoryShares, groupByDate, paymentTrend, percentOfTotal, formatShare });
});
