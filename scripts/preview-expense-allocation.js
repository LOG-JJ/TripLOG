const { createExperiencePreview } = require('./preview-companion-experience');
const fixture = require('./fixtures/expense-allocation');
const createAllocationPreview = () => createExperiencePreview({ trip: fixture, now: '2026-11-01T09:10:00+09:00' });
if (require.main === module) {
  const port = Number(process.env.PORT || 18134), server = createAllocationPreview();
  server.listen(port, '127.0.0.1', () => console.log(`Expense allocation preview: http://127.0.0.1:${port}/Travel?page=budget&trip=${fixture.id}`));
}
module.exports = { createAllocationPreview };
