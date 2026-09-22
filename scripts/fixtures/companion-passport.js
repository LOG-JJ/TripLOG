// Synthetic data only; shared by the companion browser regression and visual checks.
const day = '2026-09-22';
module.exports = {
  id: 'companion-passport-fixture', tripName: '서울, 가볍게 떠나는 3일', travelMode: 'domestic', city: '서울', country: '대한민국', countryCode: 'KR',
  startDate: day, endDate: '2026-09-24', totalBudget: 360000,
  companions: [{ id: 'friend-a', name: '지민' }, { id: 'friend-b', name: '수현' }],
  entries: [{ id: 'demo-expense', date: day, amount: 37500, category: '식비', description: '아침과 커피', paymentMethod: 'card' }],
  packingList: ['신분증', '충전기', '보조 배터리', '상비약', '세면도구', '카메라'].map((name, index) => ({ id: `p${index}`, name, checked: index < 4 })),
  travelCompanion: { completedItineraryIds: ['station', 'cafe'], lockedItineraryIds: ['river'], timeZone: 'Asia/Seoul', reservations: [{ id: 'museum', type: 'activity', title: '미술관 예약', date: day, reference: 'REF-PRIVATE-123' }] },
  itineraryItems: [
    { id: 'station', date: day, place: '서울역', location: '서울 용산구', theme: 'transport', time: '09:00', endTime: '09:30', createdAt: 1 },
    { id: 'cafe', date: day, place: '서촌의 아침', location: '서울 종로구 서촌', theme: 'food', time: '09:40', endTime: '10:10', duration: 10, trans: 'walk', createdAt: 2 },
    { id: 'palace', date: day, place: '경복궁', location: '서울 종로구 사직로 161', theme: 'sightseeing', time: '10:20', endTime: '11:30', duration: 25, trans: 'walk', createdAt: 3 },
    { id: 'village', date: day, place: '북촌 한옥마을', location: '서울 종로구 북촌', theme: 'sightseeing', time: '11:40', endTime: '12:30', duration: 20, trans: 'walk', createdAt: 4 },
    { id: 'lunch', date: day, place: '안국에서 점심', location: '서울 종로구 안국동', theme: 'food', time: '12:50', endTime: '13:40', duration: 10, trans: 'walk', createdAt: 5 },
    { id: 'river', date: day, place: '한강에서 노을', location: '서울 영등포구 여의도', theme: 'sightseeing', time: '17:30', endTime: '19:00', duration: 40, trans: 'train', createdAt: 6 },
  ],
};
