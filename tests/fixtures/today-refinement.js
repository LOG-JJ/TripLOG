// Synthetic figures for the selected Today mockup. Never production travel data.
const day = '2026-11-01';
module.exports = {
  id: 'today-refinement-fixture', tripName: '1000일 순천', travelMode: 'domestic', country: '대한민국', countryCode: 'KR', city: '순천',
  startDate: '2026-10-31', endDate: day, companions: [], packingList: [],
  travelCompanion: { timeZone: 'Asia/Seoul', completedItineraryIds: [], lockedItineraryIds: [], reservations: [] },
  entries: [
    { id: 'lunch-payment', date: day, category: '식비', description: '점심 식사', amount: 32000 },
    { id: 'transit-payment', date: day, category: '교통', description: '이동', amount: 12000 },
    { id: 'advance-rail', date: '__pretrip__', category: '교통', description: '미리 기록한 교통비', amount: 100000 },
    { id: 'advance-stay', date: '__pretrip__', category: '숙소', description: '미리 기록한 숙박비', amount: 75600 },
    { id: 'advance-ticket', date: '__pretrip__', category: '관광', description: '미리 기록한 입장권', amount: 20000 },
    ...[12000,15000,14000,6200].map((amount, i) => ({ id: `previous-${i}`, date: '2026-10-31', category: i % 2 ? '식비' : '기타', description: `전날 기록 ${i + 1}`, amount }))
  ],
  itineraryItems: [
    ['garden','09:30','11:30','순천만 국가정원','sightseeing','전남 순천시 · 순천만 국가정원'],
    ['lunch','12:00','13:00','순천 점심 식사','food','순천시 일대 맛집'],
    ['wetland','15:00','16:30','순천만습지','sightseeing','전남 순천시 · 순천만습지'],
    ['cafe','17:00','18:00','순천 카페','food','순천시 카페거리'],
    ['dinner','18:30','19:30','순천 저녁 식사','food','순천시 일대 맛집']
  ].map(([id,time,endTime,place,theme,location], index) => ({ id,date:day,time,endTime,place,theme,location,createdAt:index+1 }))
};
