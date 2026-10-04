const base = structuredClone(require('./wallet-passbook'));
const fixture = {
  ...base, id: 'trip-header-suncheon', tripName: '1000일 순천', travelMode: 'domestic',
  countryCode: 'KR', country: '대한민국', city: '순천', startDate: '2026-10-10', endDate: '2026-10-11',
  selectedDate: '2026-10-10', selectedItineraryDate: '2026-10-10', lastActiveItineraryDate: '2026-10-10',
  currencyCode: 'KRW', exchangeRateSource: '수동 입력', entries: [], itineraryItems: [], packingList: [],
  companions: [{ id: 'header-companion', name: '동행' }], travelCompanion: { reservations: [] },
};
module.exports = [
  fixture,
  { ...structuredClone(base), id: 'trip-header-osaka', tripName: '오사카 주말여행', country: '일본', countryCode: 'JP', city: '오사카' },
  { ...structuredClone(fixture), id: 'trip-header-unknown', tripName: '새로운 마을 여행', city: '아직 등록하지 않은 마을' },
  { ...structuredClone(fixture), id: 'trip-header-region', tripName: '제주 남쪽 여행', city: '서귀포시' },
  { ...structuredClone(fixture), id: 'trip-header-generic', tripName: '호수와 산 사이', travelMode: 'overseas', country: '스위스', countryCode: 'CH', city: '인터라켄' },
];
