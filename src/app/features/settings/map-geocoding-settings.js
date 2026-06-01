function setupMapGeocodingSettings() {
  if (!els.settingsGoogleGeocodingKeyInput) return;

  syncMapGeocodingSettings();

  els.settingsGoogleGeocodingKeySaveButton?.addEventListener("click", () => {
    const inputValue = els.settingsGoogleGeocodingKeyInput.value.trim();
    if (!inputValue && hasGoogleGeocodingApiKey()) {
      syncMapGeocodingSettings("새 키를 입력하면 기존 키를 교체합니다.", "neutral");
      return;
    }
    const saved = saveGoogleGeocodingApiKey(inputValue);
    syncMapGeocodingSettings(saved ? "Google 좌표 검색을 우선 사용합니다." : "API 키를 입력해주세요.", saved ? "success" : "warning");
  });

  els.settingsGoogleGeocodingKeyClearButton?.addEventListener("click", () => {
    clearGoogleGeocodingApiKey();
    syncMapGeocodingSettings("Google 좌표 검색을 껐습니다.", "neutral");
  });
}

function syncMapGeocodingSettings(message = "", tone = "neutral") {
  if (!els.settingsGoogleGeocodingKeyInput) return;

  const key = getGoogleGeocodingApiKey();
  els.settingsGoogleGeocodingKeyInput.value = "";
  els.settingsGoogleGeocodingKeyInput.placeholder = key ? maskGoogleGeocodingApiKey(key) : "AIza...";

  const statusMessage = message || (key
    ? "설정됨: Google Places/Text Search와 Geocoding 결과를 먼저 사용합니다."
    : "미설정: Google 지도 URL 좌표 파싱 후 공개 지오코더를 사용합니다.");
  setMapGeocodingSettingsStatus(statusMessage, tone);
}

function setMapGeocodingSettingsStatus(message, tone = "neutral") {
  if (!els.settingsGoogleGeocodingStatus) return;
  els.settingsGoogleGeocodingStatus.textContent = message;
  els.settingsGoogleGeocodingStatus.dataset.tone = tone;
}

function maskGoogleGeocodingApiKey(key) {
  const value = String(key || "");
  if (value.length <= 10) return value ? "설정됨" : "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

window.TripLog.register("features.settings.mapGeocodingSettings", {
  setupMapGeocodingSettings,
  syncMapGeocodingSettings,
  setMapGeocodingSettingsStatus,
  maskGoogleGeocodingApiKey,
});
