// Synthetic design fixtures only. Never loaded by the production app.
module.exports = [
  { id: 'library-gangneung', tripName: '강릉 주말여행', city: '강릉', country: '대한민국', countryCode: 'KR', travelMode: 'domestic', startDate: '2026-10-17', endDate: '2026-10-18' },
  { id: 'library-osaka', tripName: '오사카&교토 추석 가족여행', city: '오사카', country: '일본', countryCode: 'JP', travelMode: 'overseas', startDate: '2026-09-25', endDate: '2026-09-28' },
  { id: 'library-jeju', tripName: '제주도 7박 8일', city: '제주', country: '대한민국', countryCode: 'KR', travelMode: 'domestic', startDate: '2026-06-09', endDate: '2026-06-16' },
].map(trip => ({ ...trip, totalBudget: 500000,
  currencyCode: trip.countryCode === 'JP' ? 'JPY' : 'KRW', currencySymbol: trip.countryCode === 'JP' ? '¥' : '₩', currencyUnit: trip.countryCode === 'JP' ? '엔' : '원',
  exchangeBase: trip.countryCode === 'JP' ? 100 : 1, exchangeRate: trip.countryCode === 'JP' ? 950 : 1, exchangeRateSource: '수동 입력', currencyAutoMatchedCountryCode: trip.countryCode,
  entries: [{ id: `${trip.id}-expense`, date: trip.startDate, amount: 12000, description: '보존할 지출', category: '식비', paymentMethod: 'card' }],
  itineraryItems: [{ id: `${trip.id}-plan`, date: trip.startDate, place: `${trip.city} 보존할 일정`, time: '10:00', endTime: '11:00' }],
  companions: [], packingList: [],
}));
