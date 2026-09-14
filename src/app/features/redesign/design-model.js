(() => {
  const palette = { '숙소': '#fff05a', '교통': '#bce6fb', '식비': '#f7afc7', '관광': '#e4e5e9', '쇼핑': '#bdddcf', '기타': '#d5caed' };
  const icons = { '숙소': 'house', '교통': 'train', '식비': 'fork-knife', '관광': 'ticket', '쇼핑': 'shopping-bag', '기타': 'dots-three' };
  function localDate(date = new Date()) {
    if (!Number.isFinite(date.getTime())) return '';
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function paymentDate(entry) {
    const explicit = entry.paymentDate || entry.receipt?.recognizedDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(explicit || '')) return explicit;
    if (entry.date && !isPreTripExpenseDate(entry.date)) return entry.date;
    return entry.createdAt ? localDate(new Date(entry.createdAt)) : '';
  }
  function categoryShares(entries) {
    const sums = new Map();
    entries.forEach(e => sums.set(e.category || '기타', (sums.get(e.category || '기타') || 0) + Math.max(0, Number(e.amount) || 0)));
    const total = [...sums.values()].reduce((a, b) => a + b, 0);
    const rows = [...sums].filter(([, amount]) => amount > 0).map(([name, amount]) => ({ name, amount, color: palette[name] || palette['기타'], percent: total ? Math.floor(amount / total * 100) : 0, fraction: total ? amount / total * 100 % 1 : 0 })).sort((a, b) => b.amount - a.amount);
    let remainder = total ? 100 - rows.reduce((sum, row) => sum + row.percent, 0) : 0;
    [...rows].sort((a, b) => b.fraction - a.fraction).forEach(row => { if (remainder-- > 0) row.percent++; });
    return rows;
  }
  function paymentTrend(entries) {
    const sums = new Map();
    entries.forEach(e => { const date = paymentDate(e) || '날짜 미지정'; sums.set(date, (sums.get(date) || 0) + Math.max(0, Number(e.amount) || 0)); });
    return [...sums].map(([date, amount]) => ({date, amount})).sort((a, b) => a.date.localeCompare(b.date));
  }
  window.TripLog.register('features.redesign.model', { palette, icons, localDate, paymentDate, categoryShares, paymentTrend });
})();
