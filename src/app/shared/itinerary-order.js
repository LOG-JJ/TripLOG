(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TripLogItineraryOrder = api;
  root.TripLog?.register('shared.itineraryOrder', api);
})(typeof window === 'undefined' ? globalThis : window, function () {
  const step = 1024;
  function rank(item) {
    const value = item?.itineraryOrder;
    return value && typeof value === 'object' && !Array.isArray(value) && typeof item?.date === 'string'
      && value.date === item.date && Number.isFinite(value.rank) && Math.abs(value.rank) <= Number.MAX_SAFE_INTEGER
      ? value.rank : null;
  }
  function chronological(a, b) {
    return String(a.time || '99:99').localeCompare(String(b.time || '99:99'))
      || (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)
      || String(a.id).localeCompare(String(b.id));
  }
  function sort(items = []) {
    const list = (Array.isArray(items) ? items : []).filter(item => item && typeof item === 'object');
    const manualDates = new Set(list.filter(item => rank(item) !== null).map(item => item.date));
    return list.sort((a, b) => {
      const day = String(a.date || '').localeCompare(String(b.date || ''));
      if (day) return day;
      if (manualDates.has(a.date)) {
        const left = rank(a), right = rank(b);
        // New stops join the end of a manually ordered day. Moving an item to
        // another date does not carry its old day's position into that date.
        if (left !== null && right !== null) return left - right || String(a.id).localeCompare(String(b.id));
        if (left !== null || right !== null) return left === null ? 1 : -1;
      }
      return chronological(a, b);
    });
  }
  function move(items, draggedId, targetId, placement = 'before') {
    const unchanged = { changed: false, items };
    const dragged = items.find(item => item.id === draggedId), target = items.find(item => item.id === targetId);
    if (!dragged || !target || draggedId === targetId || dragged.date !== target.date || !['before', 'after'].includes(placement)) return unchanged;
    const day = sort(items.filter(item => item.date === dragged.date));
    const ordered = day.filter(item => item.id !== draggedId);
    ordered.splice(ordered.findIndex(item => item.id === targetId) + (placement === 'after' ? 1 : 0), 0, dragged);
    if (day.every((item, index) => item.id === ordered[index].id)) return unchanged;

    const ranks = new Map();
    let tail = Math.max(0, ...day.map(item => rank(item) ?? 0));
    // Establish ranks only when first using manual order or adding unranked rows.
    // Later moves normally update only the dragged row's independent order field.
    for (const item of day) ranks.set(item.id, rank(item) ?? (tail += step));
    const index = ordered.findIndex(item => item.id === draggedId);
    const previous = index ? ranks.get(ordered[index - 1].id) : null;
    const next = index + 1 < ordered.length ? ranks.get(ordered[index + 1].id) : null;
    const candidate = previous === null ? next - step : next === null ? previous + step : previous + (next - previous) / 2;
    if (!Number.isFinite(candidate) || Math.abs(candidate) > Number.MAX_SAFE_INTEGER
      || (previous !== null && candidate <= previous) || (next !== null && candidate >= next)
      || [...ranks.values()].some(value => Math.abs(value) > Number.MAX_SAFE_INTEGER)) {
      // Rebase if concurrent moves tie or floating point precision is exhausted.
      ordered.forEach((item, i) => ranks.set(item.id, (i + 1) * step));
    } else ranks.set(draggedId, candidate);
    return { changed: true, items: items.map(item => ranks.has(item.id) && ranks.get(item.id) !== rank(item)
      ? { ...item, itineraryOrder: { date: item.date, rank: ranks.get(item.id) } } : item) };
  }
  return { sort, move, rank };
});

function sortItineraryItems(items) { return window.TripLogItineraryOrder.sort(items); }
