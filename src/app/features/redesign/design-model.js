(() => {
  'use strict';
  const costs = window.TripLog.shared.travelCosts;
  const categories = window.TripLog.data.expenseCategories.list('report');
  // Existing feature callers share the domain model through this facade.
  window.TripLog.register('features.redesign.model', {
    palette: Object.fromEntries(categories.map(category => [category.name, category.color])),
    icons: Object.fromEntries(categories.map(category => [category.name, category.icon])),
    localDate: costs.localDate, paymentDate: costs.paymentDate,
    categoryShares: costs.categoryShares, paymentTrend: costs.paymentTrend,
  });
})();
