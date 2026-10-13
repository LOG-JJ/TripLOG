(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TripLog?.register('data.expenseCategories', api);
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  // The category identity is shared. Approved views keep their existing colors
  // and icon variants instead of maintaining separate copies of the category list.
  const catalog = Object.freeze([
    { name: '숙소', icon: 'house', colors: { legacy: '#ccb7ff', report: '#fff05a', ledger: '#bce6fb', print: '#bce6fb', overview: '#ffda63' } },
    { name: '식비', icon: 'fork-knife', colors: { legacy: '#ffe45c', report: '#f7afc7', ledger: '#f7afc7', print: '#f7afc7', overview: '#94caff' } },
    { name: '관광', icon: 'ticket', colors: { legacy: '#6ee7b7', report: '#e4e5e9', ledger: '#e4e5e9', print: '#bce8d5', overview: '#9be7c2' } },
    { name: '교통', icon: 'train', colors: { legacy: '#fda4af', report: '#bce6fb', ledger: '#fff05a', print: '#fff05a', overview: '#ffabc4' } },
    { name: '쇼핑', icon: 'shopping-bag', colors: { legacy: '#7dd3fc', report: '#bdddcf', ledger: '#bdddcf', print: '#e7d4ef', overview: '#c8b0fa' } },
    { name: '기타', icon: 'dots-three', colors: { legacy: '#cbd5e1', report: '#d5caed', ledger: '#d5caed', print: '#d7cef0', overview: '#c8b0fa' } },
  ].map(category => Object.freeze({ ...category, colors: Object.freeze(category.colors) })));
  const names = Object.freeze(catalog.map(category => category.name));
  const ledgerOrder = Object.freeze(['식비', '교통', '숙소', '관광', '쇼핑', '기타']);

  function get(name, view = 'report') {
    const canonical = name === '숙박' && ['print', 'overview'].includes(view) ? '숙소' : name;
    const category = catalog.find(item => item.name === canonical) || catalog.at(-1);
    const color = view === 'overview' && !names.includes(canonical)
      ? '#dbe3ed' : (category.colors[view] || category.colors.report);
    const icon = category.name === '숙소' && ['ledger', 'print'].includes(view) ? 'bed'
      : category.name === '관광' && view === 'ledger' ? 'camera' : category.icon;
    return { name: name || '기타', color, icon };
  }

  function list(view = 'report') { return names.map(name => get(name, view)); }
  return Object.freeze({ names, ledgerOrder, get, list });
});
