// Synthetic summary fixture. Never read or mutate an operating trip.
const trip = { id: 'summary-icons-fixture', tripName: '도쿄 여행', city: '도쿄', country: '일본', travelMode: 'overseas', startDate: '2026-10-20', endDate: '2026-10-24', entries: [], companions: [], packingList: [], itineraryItems: [] };
const add = (day, names, subtypes, times, durations = []) => names.forEach((place, index) => {
  const subtype = subtypes[index], catalog = require('../../src/app/data/itinerary-art').catalog[subtype];
  trip.itineraryItems.push({ id: `day${day}-${index}`, date: `2026-10-${19 + day}`, time: times[index] || '', endTime: '', place, theme: catalog.group, themeSubtype: subtype, trans: 'train', duration: durations[index] || 0, createdAt: trip.itineraryItems.length + 1 });
});
add(1, ['나리타공항', '니시스가모 호텔', '멘야무사시', '도쿄도청', '신주쿠 쇼핑', '저녁 카페', '신주쿠 산책', '니시스가모 호텔'],
  ['airport', 'hotel', 'restaurant', 'tower', 'shopping', 'cafe', 'urban', 'hotel'],
  ['13:00', '15:00', '16:40', '18:00', '19:00', '20:00', '20:30', '21:20'], [0, 0, 0, 70, 42, 0, 0, 0]);
trip.itineraryItems.find(item => item.id === 'day1-3').transits = [
  { trans: 'walk', duration: 5 },
  { trans: 'train', duration: 55, lineName: '도에이 오에도선', fromPlace: '신주쿠역' },
  { trans: 'walk', duration: 10, fromPlace: '도초마에역' },
];
add(2, ['니시스가모 호텔', '메이지신궁', '타케시타도리', '시부야 스카이', '하라주쿠 점심', '키디랜드', '해리포터 샵', '시부야 저녁', '돈키호테', '리저브 카페', '시부야 산책', '니시스가모 호텔'],
  ['hotel', 'shrine', 'shopping', 'tower', 'restaurant', 'shopping', 'shopping', 'restaurant', 'shopping', 'cafe', 'urban', 'hotel'],
  ['09:15', '10:00', '11:20', '14:50', '15:30', '16:00', '16:30', '18:30', '19:00', '20:00', '21:00', '22:00']);
add(3, ['에노시마', '고토쿠인', '요코하마', '해변 산책', '가마쿠라 점심', '고마치도리', '박물관', '아카렌가 창고', '해머헤드', '항구 카페', '구지라노세나카', '차이나타운', '니시스가모 호텔'],
  ['island', 'temple', 'urban', 'beach', 'restaurant', 'shopping', 'museum', 'shopping', 'urban', 'cafe', 'urban', 'restaurant', 'hotel'],
  ['06:53', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '20:00', '22:20']);
add(4, ['시간을 정하지 않은 장소'], ['sightseeing'], ['']);
module.exports = trip;
