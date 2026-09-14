function renderPackingBag() {
  if (!els.packingShelfItems || !els.packingBagItems) return;
  
  const list = state.packingList || getDefaultPackingList();

  els.packingShelfItems.replaceChildren();
  els.packingBagItems.replaceChildren();

  let shelfCount = 0;
  let bagCount = 0;

  list.forEach(item => {
    const tag = document.createElement("div");
    tag.className = `packing-tag ${item.checked ? "checked-in-bag" : "on-shelf"}`;
    tag.setAttribute("data-id", item.id);
    tag.setAttribute("draggable", "true");
    
    const checkIcon = item.checked ? "💼 " : "📦 ";
    tag.innerHTML = `
      <span class="tag-icon">${checkIcon}</span>
      <span class="tag-name">${escapeHtml(item.name)}</span>
      <button class="tag-delete-btn" title="삭제" aria-label="${escapeHtml(item.name)} 삭제">&times;</button>
    `;

    tag.addEventListener("click", (e) => {
      if (e.target.classList.contains("tag-delete-btn")) {
        e.stopPropagation();
        deletePackingItem(item.id);
        return;
      }
      togglePackingItem(item.id);
    });

    tag.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", item.id);
      tag.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    tag.addEventListener("dragend", () => {
      tag.classList.remove("dragging");
    });

    if (item.checked) {
      els.packingBagItems.appendChild(tag);
      bagCount++;
    } else {
      els.packingShelfItems.appendChild(tag);
      shelfCount++;
    }
  });

  const mouthSpan = document.querySelector(".suitcase-backpack-mouth span");
  if (mouthSpan) {
    mouthSpan.textContent = `내 여행 가방 속 (${bagCount}개 완료 / ${list.length}개 전체)`;
  }
}

function addPackingItem() {
  if (!els.packingInput) return;
  const name = els.packingInput.value.trim();
  if (!name) return;

  if (!state.packingList) {
    state.packingList = getDefaultPackingList();
  }

  if (state.packingList.some(item => item.name === name)) {
    alert("이미 목록에 있는 준비물입니다.");
    return;
  }

  const newItem = {
    id: "pack-" + Date.now(),
    name: name,
    checked: false
  };

  state.packingList.push(newItem);
  els.packingInput.value = "";
  saveAndRender();
}

function deletePackingItem(id) {
  if (!state.packingList) return;
  state.packingList = state.packingList.filter(item => item.id !== id);
  saveAndRender();
}

function togglePackingItem(id) {
  if (!state.packingList) return;
  
  const el = document.querySelector(`.packing-tag[data-id="${id}"]`);
  if (el) {
    el.classList.add("packing-transitioning");
  }

  setTimeout(() => {
    state.packingList = state.packingList.map(item => {
      if (item.id === id) {
        return { ...item, checked: !item.checked };
      }
      return item;
    });
    saveAndRender();
  }, 150);
}

function setPackingItemChecked(id, checked) {
  if (!state.packingList) return;
  
  const item = state.packingList.find(i => i.id === id);
  if (item && item.checked !== checked) {
    const el = document.querySelector(`.packing-tag[data-id="${id}"]`);
    if (el) {
      el.classList.add("packing-transitioning");
    }
    
    setTimeout(() => {
      item.checked = checked;
      saveAndRender();
    }, 150);
  }
}

async function openFullDayRoute() {
  const currentDayItems = getFilteredItineraryItems().filter((item) => buildMapQuery(item));
  if (currentDayItems.length === 0) {
    alert("오늘 등록된 일정이 없어 동선을 연결할 수 없습니다. 일정을 먼저 추가해 주세요.");
    return;
  }

  if (currentDayItems.length < 2) {
    updateMapPreview(currentDayItems[0], { useGoogleMap: true });
    alert("동선을 연결하려면 같은 날짜에 장소가 2개 이상 필요합니다.");
    return;
  }

  const routeUrls = buildGoogleMapsRouteUrls(currentDayItems);
  els.googleMapsLink.href = routeUrls.external;
  if (typeof syncNaverMapsLink === "function") {
    syncNaverMapsLink(buildNaverMapsRouteSearchQuery(currentDayItems));
  }
  els.mapCurrentLabel.textContent = "동선 그리는 중";
  els.mapCurrentPlace.textContent = `${currentDayItems.length}개 장소 경로 계산 중`;
  if (els.itineraryRouteButton) els.itineraryRouteButton.disabled = true;

  try {
    const result = await renderLeafletRoute(currentDayItems);
    if (result?.cancelled) return;

    if (!result || result.validStops < 2) {
      els.mapCurrentLabel.textContent = "동선 연결 실패";
      els.mapCurrentPlace.textContent = "좌표를 찾은 장소가 2개 미만입니다";
      alert("좌표를 찾은 장소가 2개 미만이라 동선을 그릴 수 없습니다. 장소명을 더 구체적으로 입력해 주세요.");
      return;
    }

    els.mapCurrentLabel.textContent = result.fallbackSegments > 0
      ? "일부 구간은 직선으로 보정됨"
      : "실제 도로 동선 연결됨";
    els.mapCurrentPlace.textContent = `${result.validStops}개 장소 순서대로 연결`;
  } finally {
    if (els.itineraryRouteButton) els.itineraryRouteButton.disabled = false;
  }
}

window.TripLog.register("features.packing.list", {
  renderPackingBag,
  addPackingItem,
  deletePackingItem,
  togglePackingItem,
  setPackingItemChecked,
  openFullDayRoute,
});
