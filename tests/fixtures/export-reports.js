const base = structuredClone(require('./trip-header')[0]);
const trip = {
  ...base, id: 'export-suncheon', tripName: '순천의 사흘', startDate: '2026-10-09', endDate: '2026-10-11', totalBudget: 600000,
  selectedDate: '2026-10-09', selectedItineraryDate: '2026-10-09', lastActiveItineraryDate: '2026-10-09',
  companions: [{ id: 'export-companion', name: '여행 친구' }], entries: [], itineraryItems: [],
};
const dates = ['2026-10-09', '2026-10-10', '2026-10-11'];
const categories = ['숙소', '식비', '교통', '관광', '기타'];
const amounts = [[90000, 48000, 24000, 18000, 6000], [90000, 42000, 18000, 12000, 12000], [0, 36000, 48000, 24000, 18000]];
const labels = ['순천 호텔', '맛있는 식사', '이동 경비', '입장권', '여행에서 만난 작은 것들'];
dates.forEach((date, day) => amounts[day].forEach((amount, category) => {
  if (amount) trip.entries.push({ id: `export-entry-${day}-${category}`, date, paymentDate: date, category: categories[category],
    amount, description: `${labels[category]} · ${day + 1}일차`, note: category === 1 ? '둘이 함께한 한 끼' : '', mode: 'domestic', createdAt: day * 100 + category });
}));
const stops = [
  ['10:30', '10:50', '순천역', 'transport', '전남 순천시 팔마로 135', '기차에서 내려 여행 시작'],
  ['11:00', '16:00', '순천만국가정원', 'sightseeing', '전남 순천시 국가정원1호길 47', '입장권과 편한 신발 챙기기'],
  ['18:00', '', '순천 호텔', 'lodging', '순천 시내', '체크인 후 저녁 산책'],
  ['09:30', '11:30', '낙안읍성', 'sightseeing', '전남 순천시 낙안면 충민길 30', '성곽길 천천히 걷기'],
  ['12:30', '14:00', '감성 카페', 'food', '낙안면', '커피와 함께 쉬어 가기'],
  ['16:00', '18:00', '순천만습지', 'sightseeing', '전남 순천시 순천만길 513-25', '갈대길 걷기와 해질녘 풍경'],
  ['09:30', '10:30', '중앙시장', 'shopping', '순천 중앙시장', '아침과 작은 선물'],
  ['11:30', '13:00', '죽도봉', 'sightseeing', '순천 죽도봉공원', '순천 시내를 한눈에'],
  ['14:00', '14:30', '순천역', 'transport', '전남 순천시 팔마로 135', '돌아가는 기차'],
];
trip.itineraryItems = stops.map(([time, endTime, place, theme, location, memo], index) => ({
  id: `export-stop-${index}`, date: dates[Math.floor(index / 3)], time, endTime, place, theme, location, memo,
  trans: index ? 'car' : 'none', duration: index ? 15 : 0, cost: 0, createdAt: index,
}));
const many = { ...structuredClone(trip), id: 'export-many', tripName: '빠짐없이 담는 여행', entries: [] };
for (let index = 0; index < 135; index++) many.entries.push({
  id: `ledger-${String(index).padStart(3, '0')}`, date: index === 0 ? '__pretrip__' : dates[index % 3], paymentDate: index === 0 ? '2026-10-01' : dates[index % 3],
  category: categories[index % categories.length], description: `전체 내역 검증 ${String(index).padStart(3, '0')}`, amount: (index + 1) * 100,
  note: index === 18 ? '긴 메모도 잘리지 않고 다음 페이지로 이어져야 합니다. '.repeat(100) : '', mode: 'domestic', createdAt: index,
});
many.entries.push({ id: 'foreign', date: '2026-10-11', category: '식비', amount: 14500, mode: 'overseas', foreignAmount: 10, currency: 'USD', currencyUnit: '달러', description: '외화 원금과 원화 환산금액', createdAt: 200 });
many.entries.push({ id: 'refund', date: '2026-10-11', category: '관광', amount: -2000, mode: 'domestic', description: '취소 환불', createdAt: 201 });
const empty = { ...structuredClone(trip), id: 'export-empty', tripName: '새로운 여행', startDate: '', endDate: '', entries: [], itineraryItems: [], totalBudget: 0 };
const five = { ...structuredClone(trip), id: 'export-overview-five' };
five.itineraryItems.push(
  { id: 'five-walk', date: dates[0], time: '16:15', endTime: '17:00', place: '동천 산책', theme: 'sightseeing', location: '순천 동천', memo: '강변을 따라 천천히 걷기', trans: 'walk', duration: 15, cost: 0, createdAt: 20 },
  { id: 'five-meal', date: dates[0], time: '17:10', endTime: '17:40', place: '저녁 식사', theme: 'food', location: '순천 시내', memo: '', trans: 'walk', duration: 10, cost: 0, createdAt: 21 }
);
module.exports = [trip, many, empty, five];
