// Synthetic allocation data. Never read or write a production trip.
const base = require('./today-refinement');
module.exports = {
  ...JSON.parse(JSON.stringify(base)), id: 'expense-allocation-fixture',
  companions: [{ id: 'jh', name: 'JH', individualSpent: 0 }, { id: 'minji', name: '민지', individualSpent: 0 }],
  settlement: { leaderName: 'JJ', splitMode: 'equal', itemSplits: {}, customShares: {} },
  entries: [
    { id: 'split-dinner', date: '2026-11-01', category: '식비', description: '저녁 식사', amount: 120000, mode: 'domestic', payerKey: 'leader', paymentDate: '2026-11-01', paymentMethod: 'card', createdAt: 1 },
    { id: 'split-other', date: '2026-11-01', category: '교통', description: '공항 이동', amount: 30000, mode: 'domestic', payerKey: 'companion:jh', paymentDate: '2026-11-01', paymentMethod: 'cash', createdAt: 2 },
    { id: 'split-fx', date: '2026-11-01', category: '식비', description: '외화 결제 예시', amount: 30000, mode: 'overseas', currency: 'JPY', currencySymbol: '¥', currencyUnit: '엔', foreignAmount: 3000, exchangeRate: 1000, exchangeBase: 100, payerKey: 'leader', paymentDate: '2026-11-01', paymentMethod: 'card', createdAt: 3 },
  ],
};
