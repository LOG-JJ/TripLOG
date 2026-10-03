// Synthetic records for isolated UI checks. Never included in the production app.
const fixture = structuredClone(require('./wallet-passbook'));
fixture.id = 'reservation-pockets-fixture';
fixture.exchangeRateSource = '수동 입력';
// Match the reported three-record case with distinct airport labels.
fixture.entries[1].flightTo = '오사카(간사이)';
fixture.entries[2].flightTo = '오사카(간사이)';
Object.assign(fixture.entries[3], {
  hotelName: '02 그룹 스테이 클라세 뉴 호스텔 인 난바',
  description: '숙소 예약 · 02 그룹 스테이 클라세 뉴 호스텔 인 난바',
  hotelCheckIn: '2026-09-25', hotelCheckOut: '2026-09-26',
});
Object.assign(fixture.entries[4], {
  hotelName: '호텔 몬돈스 교토 고조', description: '숙소 예약 · 호텔 몬돈스 교토 고조',
  hotelCheckIn: '2026-09-26', hotelCheckOut: '2026-09-28',
});
module.exports = fixture;
