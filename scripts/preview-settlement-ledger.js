const { createExperiencePreview } = require('./preview-companion-experience');
const trip = require('./fixtures/settlement-ledger');
const createSettlementPreview = () => createExperiencePreview({ trip, now: '2026-11-01T09:00:00Z' });
if (require.main === module) {
  const port = Number(process.env.PORT) || 18136;
  createSettlementPreview().listen(port, '127.0.0.1', () => console.log(`Synthetic settlement preview: http://127.0.0.1:${port}/Travel?page=settlement&trip=${trip.id}`));
}
module.exports = { createSettlementPreview };
