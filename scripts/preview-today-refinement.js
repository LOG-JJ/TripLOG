const { createExperiencePreview } = require('./preview-companion-experience');
const fixture = require('../tests/fixtures/today-refinement');
const createTodayPreview = () => createExperiencePreview({ trip: fixture, now: '2026-11-01T00:10:00Z' });
if (require.main === module) createTodayPreview().listen(Number(process.env.PORT) || 18132, '127.0.0.1', () => console.log('Synthetic Today preview: http://127.0.0.1:18132/Travel?page=itinerary&trip=today-refinement-fixture'));
module.exports = { createTodayPreview };
