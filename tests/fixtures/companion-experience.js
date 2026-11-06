// Synthetic data matching the approved design, never a production travel record.
const start = '2026-11-02', day = '2026-11-03';
module.exports = {
  id: 'companion-experience-fixture', tripName: '도쿄, 느긋한 가을 여행', travelMode: 'overseas', country: '일본', countryCode: 'JP', city: '도쿄',
  startDate: start, endDate: '2026-11-06', currencyCode: 'JPY', currencySymbol: '¥', currencyUnit: '엔', exchangeRate: 950, exchangeBase: 100,
  companions: [{ id: 'friend', name: '지민' }],
  entries: [
    { id: 'food', date: day, paymentDate: day, category: '식비', description: '점심과 커피', amount: 39000, mode: 'domestic', paymentMethod: 'card', payerKey: 'leader' },
    { id: 'ticket-expense', date: '__pretrip__', paymentDate: '2026-10-25', category: '관광', description: '시부야 스카이 입장권', amount: 25650, mode: 'overseas', currency: 'JPY', foreignAmount: 2700, exchangeRate: 950, exchangeBase: 100, paymentMethod: 'card', payerKey: 'leader' },
    { id: 'roundtrip', date: '__pretrip__', paymentDate: '2026-10-20', category: '교통', description: '인천 → 나리타 왕복', amount: 320000, mode: 'domestic', paymentMethod: 'card', payerKey: 'leader', pretripType: 'flight', flightAirline: 'ZIPAIR', flightNumber: 'ZG041', flightFrom: '인천', flightTo: '나리타', flightDepartDate: start, flightDepartTime: '10:20', flightReturnDate: '2026-11-06', flightReturnDepartTime: '13:10', bookingCode: 'ZG123456' }
  ],
  packingList: ['여권', 'eSIM', '충전기', '보조배터리', '상비약', '접이식 우산', '엔화 현금'].map((name, i) => ({ id: `pack-${i}`, name, checked: i < 3 })),
  travelCompanion: { timeZone: 'Asia/Tokyo', completedItineraryIds: ['shrine', 'lunch'], lockedItineraryIds: [], reservations: [
    { id: 'sky-booking', type: 'activity', title: '시부야 스카이', date: day, time: '18:30', reference: 'K82M7N', guests: '2', location: '도쿄 시부야구 시부야 2-24-12', ticketUrl: 'https://example.com/ticket', url: 'https://example.com/booking', linkedExpenseId: 'ticket-expense', quotedAmount: 2700, quotedCurrency: 'JPY', note: '입장 10분 전 도착' },
    { id: 'hotel', type: 'stay', title: '니시스가모 호텔', date: start, endDate: '2026-11-06', reference: 'HOTEL-12345', location: '도쿄 도시마구 니시스가모 3-20-1', url: 'https://example.com/hotel' },
    { id: 'train', type: 'transport', transportKind: 'train', title: '나리타 익스프레스', from: '나리타공항', to: '신주쿠역', date: start, time: '13:00', endTime: '14:20', reference: 'TRAIN-5678', seats: '12A, 12B' }
  ] },
  itineraryItems: [
    { id: 'airport', date: start, place: '나리타공항', location: '일본 나리타공항', theme: 'transport', time: '12:20', endTime: '13:00', createdAt: 1 },
    { id: 'shrine', date: day, place: '메이지신궁', location: '도쿄 시부야구 요요기', theme: 'sightseeing', time: '10:00', endTime: '12:00', createdAt: 2 },
    { id: 'lunch', date: day, place: '하라주쿠 점심', location: '도쿄 시부야구 진구마에', theme: 'food', time: '12:30', endTime: '13:30', trans: 'walk', duration: 15, createdAt: 3 },
    { id: 'sky', date: day, place: '시부야 스카이', location: '일본 도쿄 시부야구 시부야 2-24-12 시부야 스크램블 스퀘어 45F', theme: 'sightseeing', time: '18:30', endTime: '20:00', linkedReservationId: 'manual:sky-booking', transits: [{ trans: 'walk', duration: 5, cost: 0 }, { trans: 'train', duration: 12, cost: 0, lineName: '야마노테선' }, { trans: 'walk', duration: 3, cost: 0 }], createdAt: 4 },
    { id: 'dinner', date: day, place: '저녁 식사', location: '신주쿠 이자카야', theme: 'food', time: '20:20', endTime: '21:20', trans: 'train', duration: 20, createdAt: 5 },
    { id: 'shopping', date: '2026-11-04', place: '신주쿠 쇼핑', theme: 'shopping', time: '11:00', endTime: '13:00', createdAt: 6 },
    { id: 'cafe', date: '2026-11-04', place: '리저브 카페', theme: 'food', time: '14:00', endTime: '14:45', transits: [{ trans: 'walk', duration: 0 }, { trans: 'train', duration: 12 }], createdAt: 7 },
    { id: 'unknown', date: '2026-11-04', place: '키디랜드', theme: 'shopping', time: '', endTime: '', duration: 0, createdAt: 8 }
  ]
};
