(() => {
  'use strict';
  const query = selector => document.querySelector(selector);
  const workspace = () => window.TripLog.features.itinerary.workspace;
  let ready = false, nameDialog, addressDialog, copyDialog, addressDraft = null;
  const fields = () => ({ place: els.itineraryPlaceInput.value, location: els.itineraryLocationInput.value,
    manual: els.manualAddressInput.value, candidate: selectedPlaceCandidate });

  function createDialog(id, title, content) {
    const dialog = window.TripLog.ui.dialog.create({ id, className: 'itinerary-detail-dialog', dismissOutside: true,
      markup: `<header><h2 id="${id}Title" tabindex="-1">${title}</h2><button type="button" data-close aria-label="닫기"><i class="ph ph-x" aria-hidden="true"></i></button></header>${content}` });
    query('#itineraryPage').appendChild(dialog);
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    return dialog;
  }

  function draftItem() {
    const { place, location, candidate } = fields();
    return candidate?.place === place ? candidate : { place, location };
  }

  function candidateSnapshot() {
    if (!selectedPlaceCandidate) return null;
    const keys = ['id', 'place', 'location', 'mapQuery', 'lat', 'lon', 'source', 'precision', 'placeId', 'coordinateSource', 'coordinateSignature', 'coordinatePrecision', 'coordinateAddress', 'googlePlaceId'];
    return Object.fromEntries(keys.filter(key => Object.hasOwn(selectedPlaceCandidate, key)).map(key => [key, selectedPlaceCandidate[key]]));
  }

  function mapPoint(item) {
    const coords = getItemLatLng(item, { requireSignature: !item.source });
    if (coords) return formatLatLngForQuery(coords);
    return buildGoogleMapPreviewQuery(item, item.location || item.place);
  }

  function syncMapActions() {
    const item = draftItem(), point = mapPoint(item);
    const available = Boolean(els.itineraryPlaceInput.value.trim() && point);
    const placeUrl = new URL('https://www.google.com/maps/search/');
    placeUrl.searchParams.set('api', '1'); placeUrl.searchParams.set('query', point);
    const placeId = !isGoogleSearchOnlyItem(item) && (item.googlePlaceId || item.placeId);
    if (placeId) placeUrl.searchParams.set('query_place_id', placeId);
    const link = els.googleMapsLink;
    link.href = placeUrl.toString(); link.dataset.mapQuery = point; link.dataset.mapRoute = 'false';
    link.querySelector('span').textContent = '구글지도 열기';
    link.setAttribute('aria-disabled', String(!available));
    const directions = new URL('https://www.google.com/maps/dir/');
    directions.searchParams.set('api', '1'); directions.searchParams.set('destination', point);
    if (placeId) directions.searchParams.set('destination_place_id', placeId);
    const items = sortItineraryItems(state.itineraryItems.filter(row => row.date === els.itineraryDaySelect.value));
    const index = editingItineraryId ? items.findIndex(row => row.id === editingItineraryId)
      : items.findIndex(row => row.time && els.itineraryTimeInput.value && row.time >= els.itineraryTimeInput.value);
    const previous = index < 0 ? items.at(-1) : items[index - 1];
    if (previous) {
      directions.searchParams.set('origin', mapPoint(previous));
      if (previous.googlePlaceId && !isGoogleSearchOnlyItem(previous)) directions.searchParams.set('origin_place_id', previous.googlePlaceId);
    }
    const route = query('#itineraryDirectionsLink'); route.href = directions.toString();
    route.setAttribute('aria-disabled', String(!available));
    route.title = previous ? `${previous.place}에서 길찾기` : '구글지도에서 출발지 선택';
  }

  function rename() {
    const input = query('#itineraryNameEdit'); input.value = els.itineraryPlaceInput.value;
    input.setCustomValidity('');
    fitSheet(nameDialog);
    window.TripLog.ui.dialog.open(nameDialog, { focusTitle: false }); input.focus(); input.select();
  }

  function applyName(event) {
    event.preventDefault();
    const input = query('#itineraryNameEdit'), name = input.value.trim();
    input.setCustomValidity(name ? '' : '장소 이름을 입력해 주세요.');
    if (!input.reportValidity()) return;
    const old = draftItem();
    selectedPlaceCandidate = { ...old, place: name,
      mapQuery: old.mapQuery || old.location || old.place, source: old.source || old.coordinateSource || 'manual-address' };
    els.itineraryPlaceInput.value = name;
    nameDialog.close(); workspace().syncPlace({ selected: true });
    els.itineraryMemoInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function openAddress() {
    const map = query('#itineraryEditor .map-frame-wrap');
    addressDraft = { ...fields(), panelHidden: query('#itineraryPlaceSearchPanel').hidden, map, mapParent: map.parentElement, mapNext: map.nextSibling };
    const panel = query('#itineraryPlaceSearchPanel');
    query('#itineraryAddressSearch').appendChild(panel); panel.hidden = false;
    panel.querySelector('label').textContent = '새 주소·장소 검색';
    const searchIcon = document.createElement('i'); searchIcon.className = 'ph ph-magnifying-glass place-sheet-search-icon'; searchIcon.setAttribute('aria-hidden', 'true');
    panel.querySelector('.place-search-row').prepend(searchIcon);
    query('#manualAddressToggleButton').innerHTML = '<i class="ph ph-map-pin" aria-hidden="true"></i><span>주소 직접 입력</span><i class="ph ph-caret-right" aria-hidden="true"></i>';
    query('#itineraryAddressName').textContent = addressDraft.place;
    query('#itineraryAddressMap').appendChild(map);
    updateAddressPreview(draftItem()); fitSheet(addressDialog);
    window.TripLog.ui.dialog.open(addressDialog, { focusTitle: true });
    requestAnimationFrame(() => { if (addressDialog.open) workspace().previewRoute(); });
  }

  function finishAddress(apply = false) {
    if (!addressDraft) return;
    const baseline = addressDraft, selected = fields();
    cancelPlaceLookup(); clearPlaceSearchTimer(); closePlaceSearchResults(); closeManualAddressPanel();
    addressDraft = null;
    const panel = query('#itineraryPlaceSearchPanel');
    baseline.mapParent.insertBefore(baseline.map, baseline.mapNext?.parentNode === baseline.mapParent ? baseline.mapNext : null);
    query('#itineraryForm').insertBefore(panel, query('.itinerary-theme-fields'));
    panel.querySelector('.place-sheet-search-icon')?.remove();
    query('#manualAddressToggleButton').textContent = '주소 직접 입력';
    panel.querySelector('label').textContent = '장소';
    panel.hidden = baseline.panelHidden;
    if (apply) {
      const candidate = selected.candidate?.place === selected.place ? selected.candidate : {
        place: selected.place, location: selected.location || selected.place, source: 'manual-address' };
      const location = candidate.location || selected.location || selected.place;
      selectedPlaceCandidate = { ...candidate, place: baseline.place, location,
        mapQuery: candidate.mapQuery || location || candidate.place };
      els.itineraryPlaceInput.value = baseline.place; els.itineraryLocationInput.value = location;
      els.manualAddressInput.value = location;
      els.itineraryMemoInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      els.itineraryPlaceInput.value = baseline.place; els.itineraryLocationInput.value = baseline.location;
      els.manualAddressInput.value = baseline.manual; selectedPlaceCandidate = baseline.candidate;
    }
    workspace().syncPlace({ selected: true }); workspace().previewRoute();
  }

  function updateAddressPreview(item = draftItem()) {
    if (!addressDraft) return;
    query('#itineraryAddressPreview').textContent = item.location || item.place || '장소를 선택하면 지도에서 확인할 수 있어요.';
  }

  function fitSheet(sheet) {
    const viewport = window.visualViewport;
    const height = viewport?.height || innerHeight;
    sheet.style.setProperty('--place-view-height', `${height}px`);
    sheet.style.setProperty('--place-keyboard-offset', `${Math.max(0, innerHeight - height - (viewport?.offsetTop || 0))}px`);
  }

  function renderMemo() {
    const memo = els.itineraryMemoInput;
    if (memo.offsetParent) { memo.style.height = 'auto'; memo.style.height = `${Math.max(78, Math.min(220, memo.scrollHeight))}px`; }
    query('#itineraryExtraDetails summary span').textContent = memo.value.trim() ? '메모' : '메모 추가';
    const links = query('#itineraryMemoLinks'); links.replaceChildren();
    for (const text of [...new Set(memo.value.match(/https?:\/\/[^\s<>"']+/gi) || [])].slice(0, 10)) {
      try {
        const url = new URL(text.replace(/[.,!?;，。！？)\]}]+$/u, ''));
        if (!['https:', 'http:'].includes(url.protocol)) continue;
        const link = document.createElement('a'); link.href = url.href; link.textContent = url.href;
        link.target = '_blank'; link.rel = 'noopener noreferrer'; links.appendChild(link);
      } catch (_) { /* Only complete web links are clickable. */ }
    }
    links.hidden = !links.childElementCount;
  }

  function render() {
    if (!ready) return;
    const day = getTripDays().find(row => row.date === els.itineraryDaySelect.value);
    const header = query('#itineraryEditorDate');
    header.querySelector('strong').textContent = day ? `Day ${getTripDays().findIndex(row => row.date === day.date) + 1}` : '';
    const date = day && new Date(`${day.date}T12:00:00`);
    header.querySelector('span').textContent = date ? `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})` : '';
    query('#itineraryPlaceAddress').disabled = !els.itineraryLocationInput.value.trim();
    const hasLegacy = Boolean(els.itineraryVoucherName.value || els.itineraryVoucherCode.value || currentVoucherFile);
    query('#itineraryLegacyVoucher').hidden = !hasLegacy;
    query('#itineraryLegacyFileOpen').hidden = !currentVoucherFile;
    query('#ticketFileNameDisplay').hidden = !currentVoucherFile;
    renderMemo(); syncMapActions();
  }

  async function copy(kind) {
    const value = (kind === 'name' ? els.itineraryPlaceInput.value : els.itineraryLocationInput.value).trim();
    if (!value) return;
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); copied = true; } } catch (_) { /* Use a selectable fallback. */ }
    if (!copied) {
      const input = query('#itineraryCopyText'); input.value = value;
      window.TripLog.ui.dialog.open(copyDialog, { focusTitle: false }); input.focus(); input.select();
      try { copied = document.execCommand('copy'); } catch (_) { /* Leave the selected text visible. */ }
      if (copied) copyDialog.close();
    }
    if (copied) showToast(kind === 'name' ? '장소 이름을 복사했어요.' : '주소를 복사했어요.');
  }

  function setup(onNavigate) {
    if (ready) return; ready = true;
    nameDialog = createDialog('itineraryNameDialog', '이름 변경', '<form id="itineraryNameForm"><div class="place-sheet-body"><label for="itineraryNameEdit">일정에 표시할 이름</label><div class="place-sheet-name-field"><input id="itineraryNameEdit" maxlength="80" required autocomplete="off" aria-describedby="itineraryNameHint"><button type="button" id="itineraryNameClear" aria-label="이름 지우기"><i class="ph ph-x-circle" aria-hidden="true"></i></button></div><p id="itineraryNameHint">주소와 지도 위치는 그대로 유지돼요.</p></div><footer><button type="submit" class="is-primary">이름 적용</button></footer></form>');
    query('#itineraryNameClear').addEventListener('click', () => { const input = query('#itineraryNameEdit'); input.value = ''; input.setCustomValidity(''); input.focus(); });
    query('#itineraryNameForm').addEventListener('submit', applyName);
    query('#itineraryNameEdit').addEventListener('input', event => event.target.setCustomValidity(''));
    addressDialog = createDialog('itineraryAddressDialog', '주소 변경', '<div class="place-sheet-body"><p id="itineraryAddressName"></p><div id="itineraryAddressSearch" class="itinerary-form"></div><section class="place-sheet-map-section" aria-label="선택한 위치 확인"><div class="place-sheet-map-label"><i class="ph ph-map-pin" aria-hidden="true"></i><span>지도에서 위치 확인</span></div><div id="itineraryAddressMap"></div><p id="itineraryAddressPreview" role="status"></p></section></div><footer><button type="button" id="itineraryAddressApply" class="is-primary">이 위치로 변경</button></footer>');
    for (const sheet of [nameDialog, addressDialog]) {
      sheet.classList.add('itinerary-place-sheet');
      const grip = document.createElement('div'); grip.className = 'place-sheet-grip'; grip.setAttribute('aria-hidden', 'true'); sheet.prepend(grip);
    }
    const refit = () => { for (const sheet of [nameDialog, addressDialog]) if (sheet.open) fitSheet(sheet); };
    window.addEventListener('resize', refit);
    window.visualViewport?.addEventListener('resize', refit);
    window.visualViewport?.addEventListener('scroll', refit);
    addressDialog.addEventListener('close', () => { if (!addressDialog.open) finishAddress(false); });
    query('#itineraryAddressApply').addEventListener('click', () => {
      if (!els.itineraryPlaceInput.value.trim()) { els.itineraryPlaceInput.focus(); return; }
      finishAddress(true); addressDialog.close();
    });
    copyDialog = createDialog('itineraryCopyDialog', '텍스트 복사', '<p>자동 복사가 제한되어 있어요. 아래 내용을 길게 눌러 복사해 주세요.</p><textarea id="itineraryCopyText" rows="3" readonly></textarea>');
    query('#itineraryChangeName').addEventListener('click', rename);
    query('#itineraryChangePlace').addEventListener('click', openAddress);
    query('#itineraryPlaceName').addEventListener('click', () => copy('name'));
    query('#itineraryPlaceAddress').addEventListener('click', () => copy('address'));
    query('#itineraryDirectionsLink').addEventListener('click', onNavigate);
    query('#itineraryLegacyFileOpen').addEventListener('click', () => workspace().downloadTicket({ voucherFile: currentVoucherFile, voucherFileName: currentVoucherFileName }));
    els.itineraryMemoInput.addEventListener('input', renderMemo);
    query('#itineraryExtraDetails').addEventListener('toggle', renderMemo);
    [els.itineraryDaySelect, els.itineraryTimeInput, els.itineraryPlaceInput].forEach(input => input.addEventListener('change', syncMapActions));
  }

  function cleanup() {
    finishAddress(false);
    for (const dialog of [nameDialog, addressDialog, copyDialog]) if (dialog?.open) dialog.close();
  }
  window.TripLog.register('features.itinerary.editorTools', { setup, render, cleanup, syncMapActions, candidateSnapshot, updateAddressPreview, isAddressEditing: () => Boolean(addressDraft) });
})();
