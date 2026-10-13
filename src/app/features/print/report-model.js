(function (root, factory) {
  'use strict';
  const costs = typeof module === 'object' && module.exports
    ? require('../../shared/travel-costs') : root.TripLog.shared.travelCosts;
  const api = factory(costs);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TripLog?.register('features.print.model', api);
})(typeof window === 'undefined' ? globalThis : window, function (costs) {
  'use strict';
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const transitModes = {
    walk: { label: '도보', emoji: '🚶' }, car: { label: '차량', emoji: '🚗' },
    train: { label: '기차', emoji: '🚆' }, bus: { label: '버스', emoji: '🚌' },
    flight: { label: '비행', emoji: '✈️' }, subway: { label: '지하철', emoji: '🚇' },
    taxi: { label: '택시', emoji: '🚕' }, ferry: { label: '배·페리', emoji: '🚢' },
    bicycle: { label: '자전거', emoji: '🚲' }, none: { label: '이동 수단 미정', emoji: '🧭' },
    other: { label: '기타 이동', emoji: '🧭' },
  };
  function transitMode(value) {
    // Older itinerary records use "etc" for flights, as does the transit editor.
    const key = value === 'etc' ? 'flight' : value || 'none';
    return Object.hasOwn(transitModes, key) ? transitModes[key] : transitModes.other;
  }
  function dateValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const stamp = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
  }
  function dateLabel(value, year = false) {
    if (value === '__pretrip__') return '사전구매';
    const stamp = dateValue(value);
    if (stamp === null) return '날짜 미정';
    const date = new Date(stamp);
    return `${year ? date.getUTCFullYear() + '.' : ''}${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCDate()).padStart(2, '0')} (${ '일월화수목금토'[date.getUTCDay()] })`;
  }
  function dayRange(startDate, endDate) {
    const start = dateValue(startDate), end = dateValue(endDate);
    if (start === null || end === null || end < start) return [];
    const days = [];
    for (let stamp = start; stamp <= end; stamp += 86400000) {
      days.push(new Date(stamp).toISOString().slice(0, 10));
    }
    return days;
  }
  function timeMinutes(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }
  function timeRange(item) {
    const start = timeMinutes(item.time);
    let end = item.theme === 'lodging' ? null : timeMinutes(item.endTime);
    const departure = dateValue(item.date), arrival = dateValue(item.transportReservation?.arrivalDate);
    if (start !== null && end !== null) {
      if (departure !== null && arrival !== null && arrival > departure) end += (arrival - departure) / 86400000 * 1440;
      else if (end < start) end += 1440;
    }
    return { start, end };
  }
  const dateSortKey = value => value === '__pretrip__' ? '' : dateValue(value) !== null ? value : '9999-99-99';
  function sortedEntries(entries) {
    return (Array.isArray(entries) ? entries : []).filter(Boolean).slice().sort((a, b) =>
      dateSortKey(a.date).localeCompare(dateSortKey(b.date)) || number(a.createdAt) - number(b.createdAt) || String(a.id || '').localeCompare(String(b.id || '')));
  }
  function create(source = {}, options = {}) {
    const allEntries = sortedEntries(source.entries);
    const expensePeriod = options.expensePeriod || 'all';
    const entries = expensePeriod === 'all' ? allEntries : allEntries.filter(entry => entry.date === expensePeriod);
    const summary = costs.summarize({ ...source, entries }, { members: options.memberCount });
    const shares = costs.categoryShares(entries, 'print');
    const calendar = dayRange(source.startDate, source.endDate);
    const items = (Array.isArray(source.itineraryItems) ? source.itineraryItems : []).filter(Boolean);
    const additional = items.map(item => item.date).filter(date => dateValue(date) !== null && !calendar.includes(date));
    const allDates = [...new Set([...calendar, ...additional])].sort();
    if (items.some(item => dateValue(item.date) === null)) allDates.push('');
    const selectedDay = options.itineraryDay || 'all';
    const days = allDates.filter(date => selectedDay === 'all' || (selectedDay === '__undated__' ? !date : date === selectedDay)).map(date => ({
      date, index: calendar.indexOf(date) + 1, label: dateLabel(date),
      items: items.filter(item => (dateValue(item.date) === null ? '' : item.date) === date),
    }));
    // Include quiet days, pre-trip purchases and records outside the saved date
    // range. Every ledger amount belongs to exactly one chart bucket.
    const trend = costs.groupByDate(entries,
      entry => entry.date === '__pretrip__' ? entry.date : dateValue(entry.date) === null ? '' : entry.date,
      expensePeriod === 'all' ? calendar : [])
      .map(row => ({ ...row, label: dateLabel(row.date) }))
      .sort((a, b) => dateSortKey(a.date).localeCompare(dateSortKey(b.date)));
    const { members, perPerson } = summary;
    return {
      source, allEntries, entries, total: summary.total, positive: summary.positive, adjustments: summary.refunds, categories: shares,
      days, calendar, trend, members,
      perPerson, expensePeriod, selectedDay,
      allDates, allItemCount: items.length, itemCount: days.reduce((sum, day) => sum + day.items.length, 0),
    };
  }
  function treemap(rows, width = 420, height = 232) {
    const boxes = [];
    function split(items, x, y, w, h) {
      if (!items.length) return;
      if (items.length === 1) { boxes.push({ ...items[0], x, y, width: w, height: h }); return; }
      const total = items.reduce((sum, row) => sum + row.amount, 0);
      let amount = 0, index = 0;
      while (index < items.length - 1 && amount < total / 2) amount += items[index++].amount;
      const fraction = amount / total;
      if (w >= h) {
        split(items.slice(0, index), x, y, w * fraction, h);
        split(items.slice(index), x + w * fraction, y, w * (1 - fraction), h);
      } else {
        split(items.slice(0, index), x, y, w, h * fraction);
        split(items.slice(index), x, y + h * fraction, w, h * (1 - fraction));
      }
    }
    split(rows.filter(row => row.amount > 0), 0, 0, width, height);
    return boxes;
  }
  function trendBuckets(rows, maximum = 7) {
    if (rows.length <= maximum) return rows.map(row => ({ ...row, count: 1 }));
    const special = rows.filter(row => dateValue(row.date) === null).map(row => ({ ...row, count: 1 }));
    const dated = rows.filter(row => dateValue(row.date) !== null);
    const size = Math.max(1, Math.ceil(dated.length / Math.max(1, maximum - special.length)));
    const result = [];
    for (let index = 0; index < dated.length; index += size) {
      const group = dated.slice(index, index + size), first = group[0], last = group.at(-1);
      result.push({ date: first.date, count: group.length, amount: group.reduce((sum, row) => sum + row.amount, 0),
        label: group.length === 1 ? first.label : `${first.date.slice(5).replace('-', '.')}–${last.date.slice(5).replace('-', '.')}` });
    }
    return [...special.filter(row => row.date === '__pretrip__'), ...result, ...special.filter(row => row.date !== '__pretrip__')];
  }
  function dailyShares(report, maximum = 7) {
    const total = number(report.total), hasPercent = total > 0;
    const rows = trendBuckets(report.trend, maximum).map(row => ({
      ...row, percent: costs.percentOfTotal(row.amount, total),
    }));
    // The normal track represents 0–100% of this report's net total. Refund
    // days extend the common scale to the left; shares above 100% stay honest.
    // A non-positive total has no meaningful share, so use amounts for bars.
    const values = rows.map(row => hasPercent ? row.percent : row.amount);
    const minimum = Math.min(0, ...values), maximumValue = Math.max(hasPercent ? 100 : 0, ...values);
    const extent = Math.max(1, maximumValue - minimum), zero = Math.abs(minimum) / extent * 100;
    return { total, hasPercent, zero, hasNegative: minimum < 0, rows: rows.map((row, index) => ({
      ...row, barStart: (Math.min(0, values[index]) - minimum) / extent * 100,
      barWidth: Math.abs(values[index]) / extent * 100,
    })) };
  }
  function expenseHighlights(report) {
    const days = report.expensePeriod === 'all' ? report.calendar.length : dateValue(report.expensePeriod) !== null ? 1 : 0;
    const peak = report.trend.reduce((largest, row) => row.amount > (largest?.amount || 0) ? row : largest, null);
    return { days, average: days ? Math.round(report.total / days) : null, peak };
  }
  function schedule(days, height = 624) {
    const ranges = days.flatMap(day => day.items.map(timeRange)).filter(range => range.start !== null);
    const start = Math.floor(Math.min(480, ...ranges.map(range => range.start)) / 60) * 60;
    // A multi-day reservation is fully described in the details; this grid
    // shows its departure day through the first overnight boundary.
    const end = Math.min(1800, Math.ceil(Math.max(1200, ...ranges.map(range => Math.max(range.start + 75, Math.min(range.end ?? range.start + 60, 1800)))) / 60) * 60);
    const scale = height / (end - start);
    const columns = days.map(day => {
      const timed = day.items.map((item, index) => ({ item, index, ...timeRange(item) })).filter(row => row.start !== null).sort((a, b) => a.start - b.start || a.index - b.index);
      const clusters = [];
      let cluster = [], clusterBottom = -1;
      for (const [index, row] of timed.entries()) {
        row.top = (row.start - start) * scale;
        // A brief stop gets a single-line label, so a 10:30 arrival does not
        // visually consume the next 11:00 appointment's whole column.
        row.compact = (row.end !== null && row.end - row.start <= 45)
          || (row.end === null && timed[index + 1]?.start - row.start < 60);
        row.height = Math.min(height - row.top, Math.max(row.compact ? 22 : 58, ((row.end ?? row.start + (row.compact ? 15 : 45)) - row.start) * scale));
        if (row.top >= clusterBottom + 3 && cluster.length) { clusters.push(cluster); cluster = []; clusterBottom = -1; }
        cluster.push(row); clusterBottom = Math.max(clusterBottom, row.top + row.height);
      }
      if (cluster.length) clusters.push(cluster);
      clusters.forEach(group => {
        const lanes = [];
        group.forEach(row => {
          let lane = lanes.findIndex(bottom => bottom + 3 <= row.top);
          if (lane < 0) lane = lanes.length;
          lanes[lane] = row.top + row.height; row.lane = lane;
        });
        group.forEach(row => { row.lanes = lanes.length; });
      });
      return { ...day, timed, untimed: day.items.filter(item => timeMinutes(item.time) === null), maxLanes: Math.max(1, ...timed.map(row => row.lanes)) };
    });
    return { start, end, height, scale, columns };
  }
  return { create, treemap, trendBuckets, dailyShares, expenseHighlights, schedule, timeMinutes, timeRange, dateValue, dateLabel, dayRange, sortedEntries, number, transitMode };
});
