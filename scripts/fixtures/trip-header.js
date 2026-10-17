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
  { ...structuredClone(fixture), id: 'trip-header-region', tripName: '제주도 일주 여행', city: '제주도' },
  { ...structuredClone(fixture), id: 'trip-header-generic', tripName: '홋카이도 숲속 여행', travelMode: 'overseas', country: '일본', countryCode: 'JP', city: '홋카이도' },
  { ...structuredClone(fixture), id: 'trip-header-pyeongchang', tripName: '평창 산속 여행', city: '평창' },
  { ...structuredClone(fixture), id: 'trip-header-incheon', tripName: '인천 주말 여행', city: '인천' },
  { ...structuredClone(fixture), id: 'trip-header-tirana', tripName: '티라나 문화 여행', travelMode: 'overseas', country: '알바니아', countryCode: 'AL', city: '티라나', currencyCode: 'ALL' },
  { ...structuredClone(fixture), id: 'trip-header-jeju-city', tripName: '제주시 용연 여행', city: '제주시' },
  { ...structuredClone(fixture), id: 'trip-header-seogwipo', tripName: '서귀포 폭포 여행', city: '서귀포시' },
  { ...structuredClone(fixture), id: 'trip-header-gwangju-gyeonggi', tripName: '경기 광주 성곽 여행', city: '경기도 광주시' },
  { ...structuredClone(fixture), id: 'trip-header-gwangju-area', tripName: '광주 무등산 여행', city: '광주광역시' },
  { ...structuredClone(fixture), id: 'trip-header-jeonnam-gwangju', tripName: '전남광주통합특별시 산과 바다를 잇는 긴 여행', city: '전남광주통합특별시' },
];
