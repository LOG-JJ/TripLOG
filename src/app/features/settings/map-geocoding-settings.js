function setupMapGeocodingSettings() {
  if (!els.settingsGoogleGeocodingKeyInput) return;

  syncMapGeocodingSettings();

  els.settingsGoogleGeocodingKeySaveButton?.addEventListener("click", () => {
    const inputValue = els.settingsGoogleGeocodingKeyInput.value.trim();
    if (!inputValue && hasGoogleGeocodingApiKey()) {
      syncMapGeocodingSettings("이미 저장되어 있습니다. 새 키를 넣으면 교체합니다.", "success");
      return;
    }
    const saved = saveGoogleGeocodingApiKey(inputValue);
    syncMapGeocodingSettings(saved
      ? "저장됨: Google Places/Geocoding을 바로 사용합니다."
      : "저장 실패: API 키를 다시 입력해주세요.",
      saved ? "success" : "warning");
  });

  els.settingsGoogleGeocodingKeyClearButton?.addEventListener("click", async () => {
    const key = getGoogleGeocodingApiKey();
    if (!key || !await window.TripLog.ui.confirmation.ask({ kind: 'map-key' })) return;
    if (key !== getGoogleGeocodingApiKey()) { syncMapGeocodingSettings('키가 변경됐어요. 다시 확인해 주세요.', 'warning'); return; }
    clearGoogleGeocodingApiKey();
    syncMapGeocodingSettings("Google 좌표 검색을 껐습니다.", "neutral");
  });
}

function syncMapGeocodingSettings(message = "", tone = "neutral") {
  if (!els.settingsGoogleGeocodingKeyInput) return;

  const key = getGoogleGeocodingApiKey();
  if (els.settingsGoogleGeocodingKeyClearButton) els.settingsGoogleGeocodingKeyClearButton.disabled = !key;
  els.settingsGoogleGeocodingKeyInput.value = "";
  els.settingsGoogleGeocodingKeyInput.placeholder = key ? maskGoogleGeocodingApiKey(key) : "AIza...";

  const statusMessage = message || (key
    ? "설정됨: Google Places/Geocoding 결과를 먼저 사용합니다."
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
