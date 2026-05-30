function loadSampleData() {
  state.tripName = "제주도 국내여행";
  state.travelMode = "domestic";
  state.startDate = "2026-06-09";
  state.endDate = "2026-06-12";
  state.selectedDate = "2026-06-09";
  state.selectedItineraryDate = "2026-06-09";
  state.totalBudget = 1000000;
  const sampleLodgingEntries = createLodgingEntries({
    checkIn: "2026-06-10",
    checkOut: "2026-06-12",
    nights: 2,
    description: "숙소 2박",
    amount: 240000,
    note: "사전 결제",
    isOverseas: false,
    currency: getCurrencyMeta("JPY"),
    foreignAmount: 0,
    exchangeRate: 0,
  });
  state.entries = [
    createEntry("2026-06-09", "교통", "렌터카 예약", 120000, "공항 픽업"),
    createEntry("2026-06-09", "식비", "흑돼지 저녁", 68000, ""),
    createEntry("2026-06-10", "관광", "성산일출봉 입장료", 10000, "2인"),
    ...sampleLodgingEntries,
    createEntry("2026-06-11", "쇼핑", "기념품", 35000, ""),
    createEntry("2026-06-12", "기타", "여행자보험", 12000, ""),
  ];
  state.itineraryItems = [
    createItineraryItem("2026-06-09", "10:30", "제주국제공항", "제주특별자치도 제주시 공항로 2", "렌터카 픽업"),
    createItineraryItem("2026-06-10", "09:40", "성산일출봉", "제주특별자치도 서귀포시 성산읍 성산리 1", "오전 산책"),
    createItineraryItem("2026-06-11", "15:00", "협재해수욕장", "제주특별자치도 제주시 한림읍 협재리 2497-1", "카페 들르기"),
  ];
  state.packingList = getDefaultPackingList();
  state.selectedItineraryId = state.itineraryItems[0]?.id || "";
  clearEditMode();
  clearItineraryEditMode(false);
  saveAndRender();
}

function resetAll() {
  const ok = window.confirm("모든 여행 경비 기록을 초기화할까요?");
  if (!ok) return;

  state.tripName = "";
  state.travelMode = "domestic";
  state.startDate = "2026-06-09";
  state.endDate = "2026-06-12";
  state.selectedDate = "2026-06-09";
  state.selectedItineraryDate = "2026-06-09";
  state.selectedItineraryId = "";
  state.totalBudget = 0;
  state.entries = [];
  state.itineraryItems = [];
  state.packingList = getDefaultPackingList();
  clearEditMode();
  clearItineraryEditMode(false);
  saveAndRender();
}

window.TripLog.register("features.dev.sampleData", {
  loadSampleData,
  resetAll,
});
