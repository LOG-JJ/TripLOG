// Synthetic settlement figures from the approved mockup; never user trip data.
const base = require('./today-refinement');
module.exports = { ...structuredClone(base), id: 'settlement-ledger-fixture',
  companions: [{ id: 'yundi', name: '윤디', individualSpent: 0 }],
  entries: [
    { id: 'dinner', date: '2026-11-01', paymentDate: '2026-11-01', category: '식비', description: '저녁 식사', amount: 120000, mode: 'domestic', paymentMethod: 'card', payerKey: 'leader' },
    { id: 'taxi', date: '2026-11-01', paymentDate: '2026-11-01', category: '교통', description: '택시', amount: 40000, mode: 'domestic', paymentMethod: 'cash', payerKey: 'companion:yundi' },
    { id: 'cafe', date: '2026-11-01', paymentDate: '2026-11-01', category: '식비', description: '카페', amount: 20000, mode: 'domestic', paymentMethod: 'card', payerKey: 'leader' },
  ],
  settlement: { leaderName: 'JH', sourceId: 'stale-snapshot', itemSplits: {
    'current:taxi': { mode: 'custom', shares: { leader: 30000, 'companion:yundi': 10000 } },
    'current:cafe': { mode: 'custom', shares: { leader: 5000, 'companion:yundi': 15000 } },
  } },
};
