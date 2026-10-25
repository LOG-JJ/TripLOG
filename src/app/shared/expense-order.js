(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./travel-costs') : root.TripLog.shared.travelCosts);
  if (node) module.exports = api;
  root.TripLog?.register('shared.expenseOrder', api);
})(typeof window === 'undefined' ? globalThis : window, function (Costs) {
  'use strict';
  const step = 1024;
  function rank(entry) { return Number.isFinite(entry?.expenseOrder) && Math.abs(entry.expenseOrder) <= Number.MAX_SAFE_INTEGER ? entry.expenseOrder : null; }
  function newest(a, b) { return Costs.paymentDate(b).localeCompare(Costs.paymentDate(a)) || (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); }
  function sort(entries = []) {
    return (Array.isArray(entries) ? entries : []).filter(entry => entry && typeof entry === 'object').slice().sort((a, b) => {
      const left = rank(a), right = rank(b);
      if (left !== null && right !== null) return left - right || String(a.id).localeCompare(String(b.id));
      if (left !== null || right !== null) return left === null ? 1 : -1;
      return newest(a, b);
    });
  }
  function move(entries, id, targetId, placement = 'before') {
    const unchanged = { changed: false, items: entries };
    const ordered = sort(entries), moving = ordered.find(entry => entry.id === id);
    if (!moving || id === targetId || !ordered.some(entry => entry.id === targetId) || !['before', 'after'].includes(placement)) return unchanged;
    const next = ordered.filter(entry => entry.id !== id);
    next.splice(next.findIndex(entry => entry.id === targetId) + (placement === 'after' ? 1 : 0), 0, moving);
    if (ordered.every((entry, index) => entry.id === next[index].id)) return unchanged;
    const ranks = new Map();
    let tail = Math.max(0, ...ordered.map(entry => rank(entry) ?? 0));
    for (const entry of ordered) ranks.set(entry.id, rank(entry) ?? (tail += step));
    const index = next.findIndex(entry => entry.id === id);
    const previous = index ? ranks.get(next[index - 1].id) : null;
    const following = index + 1 < next.length ? ranks.get(next[index + 1].id) : null;
    const candidate = previous === null ? following - step : following === null ? previous + step : previous + (following - previous) / 2;
    if (!Number.isFinite(candidate) || Math.abs(candidate) > Number.MAX_SAFE_INTEGER
      || (previous !== null && candidate <= previous) || (following !== null && candidate >= following)
      || [...ranks.values()].some(value => Math.abs(value) > Number.MAX_SAFE_INTEGER)) next.forEach((entry, i) => ranks.set(entry.id, (i + 1) * step));
    else ranks.set(id, candidate);
    // A separate property keeps ordering independent of dates, amounts, linked
    // itineraries and the underlying array's synchronization positions.
    return { changed: true, items: entries.map(entry => ranks.has(entry.id) && ranks.get(entry.id) !== rank(entry) ? { ...entry, expenseOrder: ranks.get(entry.id) } : entry) };
  }
  return { sort, move, rank, newest };
});
