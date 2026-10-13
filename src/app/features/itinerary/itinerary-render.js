const itineraryThemes = {
  sightseeing: { label: "명소", icon: "map-pin" }, lodging: { label: "숙소", icon: "bed" },
  food: { label: "맛집", icon: "fork-knife" }, shopping: { label: "쇼핑", icon: "shopping-bag" },
  transport: { label: "이동", icon: "train" }, etc: { label: "기타", icon: "map-pin" },
};
const itineraryTransitModes = {
  none: { label: "이동", icon: "path" }, walk: { label: "도보", icon: "person-simple-walk" },
  car: { label: "차량", icon: "car" }, train: { label: "기차", icon: "train" },
  bus: { label: "버스", icon: "bus" }, flight: { label: "비행", icon: "airplane" },
};

function itineraryIcon(name) { return `<i class="ph ph-${name}" aria-hidden="true"></i>`; }
function itineraryPlaceLabel(item) {
  const name = String(item.place || '').trim();
  return name && !/^[-–—]+$/.test(name) ? name : item.theme === 'food' ? '식사 장소 미정' : item.theme === 'lodging' ? '숙소 미정' : '장소 미정';
}
function getItineraryTransits(item) {
  return item.transits?.length ? item.transits : [{ trans: item.trans || "none", duration: item.duration || 0, cost: item.cost || 0, memo: "" }];
}

let itineraryDragSession = null;
let itineraryDragDropReady = false;
let cancelItineraryDragSession = () => {};
function setupItineraryDragDrop() {
  if (itineraryDragDropReady) return;
  itineraryDragDropReady = true;
  const list = els.itineraryList;
  const clearIndicator = () => list.querySelectorAll('.is-drop-before, .is-drop-after').forEach(row => row.classList.remove('is-drop-before', 'is-drop-after'));
  const finish = ({ animate = false } = {}) => {
    const previousRects = animate ? itineraryDragSession?.preview?.capture() : null;
    itineraryDragSession?.preview?.finish();
    clearIndicator();
    list.querySelectorAll('.is-dragging').forEach(row => row.classList.remove('is-dragging'));
    itineraryDragSession = null;
    if (previousRects) animateItineraryDrop(list, previousRects);
  };
  const pointerDrag = setupItineraryPointerDrag(list, finish);
  cancelItineraryDragSession = options => { pointerDrag.cancel(options); finish(options); };
  const targetAt = event => {
    const drag = itineraryDragSession;
    if (!drag || itineraryReorderPending || drag.tripId !== state.id || drag.date !== state.selectedItineraryDate
      || findItineraryItem(drag.id)?.date !== drag.date) return null;
    const target = drag.preview?.targetAt(event.clientY);
    return target && findItineraryItem(target.row.dataset.id)?.date === drag.date ? target : null;
  };
  list.addEventListener('dragstart', event => {
    const row = event.target.closest('.timeline-stop');
    const item = row && findItineraryItem(row.dataset.id);
    if (!row || !item || pointerDrag.active || itineraryReorderPending || state.selectedItineraryDate === 'all' || event.target.closest('button, input, a')) {
      event.preventDefault(); return;
    }
    finish();
    itineraryDragSession = { id: item.id, tripId: state.id, date: item.date };
    event.dataTransfer.setData('application/x-triplog-itinerary', item.id);
    event.dataTransfer.setData('text/plain', item.id);
    event.dataTransfer.effectAllowed = 'move';
    itineraryDragSession.preview = createItineraryDragPreview(list, row, event);
    row.classList.add('is-dragging');
  });
  list.addEventListener('dragover', event => {
    const target = targetAt(event); clearIndicator();
    if (!target) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    target.row.classList.add(`is-drop-${target.placement}`);
    itineraryDragSession.preview?.update(target);
  });
  list.addEventListener('dragleave', event => {
    const rect = list.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) return;
    clearIndicator(); itineraryDragSession?.preview?.reset();
  });
  list.addEventListener('dragend', () => finish({ animate: true }));
  list.addEventListener('drop', event => {
    const target = targetAt(event), draggedId = itineraryDragSession?.id;
    const previousRects = itineraryDragSession?.preview?.capture();
    event.preventDefault(); finish();
    if (target && event.dataTransfer.getData('application/x-triplog-itinerary') === draggedId) {
      void moveItineraryItem(draggedId, target.row.dataset.id, target.placement);
      animateItineraryDrop(list, previousRects, draggedId);
    }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') finish({ animate: true }); }, true);
  window.addEventListener('resize', () => finish());
  window.addEventListener('pagehide', () => finish());
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  list.addEventListener('keydown', event => {
    const row = event.target.closest('.timeline-stop');
    if (!row || (event.target !== row && !event.target.closest('.timeline-drag-handle')) || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const items = getFilteredItineraryItems(), index = items.findIndex(item => item.id === row.dataset.id);
    const target = items[index + (event.key === 'ArrowUp' ? -1 : 1)];
    if (!target || target.date !== items[index]?.date) return;
    const id = row.dataset.id;
    void moveItineraryItem(id, target.id, event.key === 'ArrowUp' ? 'before' : 'after').then(() => {
      [...list.querySelectorAll('.timeline-stop')].find(item => item.dataset.id === id)?.focus({ preventScroll: true });
    });
  });
}

function renderItineraryPage() {
  const days = getTripDays();
  if (state.selectedItineraryDate !== "all" && !days.some(day => day.date === state.selectedItineraryDate)) state.selectedItineraryDate = days[0]?.date || state.startDate;
  els.itineraryTripName.textContent = state.tripName || getDefaultTripName();
  els.itineraryDateRange.textContent = days.length
    ? `${days[0].shortDate} ${days[0].weekday} – ${days.at(-1).shortDate} ${days.at(-1).weekday} · ${days.length > 1 ? `${days.length - 1}박 ${days.length}일` : "당일치기"}` : "여행 기간을 설정해 주세요";
  const day = days.find(entry => entry.date === state.selectedItineraryDate);
  document.querySelector("#itinerarySelectedDayTitle").textContent = day
    ? `${Number(day.date.slice(5, 7))}월 ${Number(day.date.slice(8, 10))}일 (${day.weekday})` : "전체 일정";
  const all = state.selectedItineraryDate === "all";
  els.itineraryViewAllButton.setAttribute("aria-pressed", String(all));
  els.itineraryViewAllButton.querySelector("span").textContent = all ? "일차별" : "전체";
  els.itineraryViewAllButton.setAttribute('aria-label', all ? '일차별 보기' : '전체 일정 보기');
  els.itineraryViewAllButton.title = all ? '일차별 보기' : '전체 일정 보기';
  const items = getFilteredItineraryItems();
  // Only count the incoming travel segments actually shown between same-day stops.
  const travelMinutes = items.reduce((sum, item, index) => {
    if (!index || items[index - 1].date !== item.date) return sum;
    return sum + getItineraryTransits(item).reduce((minutes, segment) => minutes + Math.max(0, Number(segment.duration) || 0), 0);
  }, 0);
  const travelLabel = travelMinutes >= 60 ? `${Math.floor(travelMinutes / 60)}시간${travelMinutes % 60 ? ` ${travelMinutes % 60}분` : ""}` : `${travelMinutes}분`;
  els.itineraryDaySummary.textContent = `일정 ${items.length}개${travelMinutes ? ` · 이동 ${travelLabel}` : ""}`;
  els.itineraryModeToggle?.querySelectorAll("button").forEach(button => {
    const active = (state.selectedItineraryDate === "all") === (button.dataset.mode === "overview");
    button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  });
  renderItineraryDaySelect(days);
  const summary = window.TripLog.features.itinerary.summary;
  if (!summary?.isActive()) { renderItineraryDayStrip(days); renderItineraryList(days); }
  summary?.render();
  syncNaverMapsLink();
  window.TripLog.features.itinerary.workspace?.render?.(days);
}

function renderItineraryDaySelect(days) {
  const selected = els.itineraryDaySelect.value;
  els.itineraryDaySelect.replaceChildren(...days.map(day => {
    const option = document.createElement("option"); option.value = day.date;
    option.textContent = `Day ${day.label.replace(/[^0-9]/g, "")} · ${day.shortDate} (${day.weekday})`;
    return option;
  }));
  const draftDate = document.querySelector("#itineraryEditor")?.open ? selected : state.selectedItineraryDate;
  els.itineraryDaySelect.value = days.some(day => day.date === draftDate) ? draftDate : days[0]?.date || "";
  els.itineraryDaySelect.disabled = !days.length;
  syncCustomSelect(els.itineraryDaySelect, { rebuild: true });
}

function createItineraryDayButton(day, selectedDate) {
  const button = document.createElement("button"); button.type = "button"; button.className = "itinerary-day-chip";
  button.classList.toggle("active", day.date === selectedDate);
  const number = day.label.replace(/[^0-9]/g, "");
  const shortDate = `${Number(day.date.slice(5, 7))}.${Number(day.date.slice(8, 10))}`;
  button.innerHTML = `<span>Day ${number}</span><strong>${shortDate} ${day.weekday}</strong>`;
  button.setAttribute("aria-pressed", String(day.date === selectedDate));
  button.setAttribute("aria-label", `Day ${number}, ${shortDate} ${day.weekday}요일`); button.dataset.date = day.date;
  return button;
}

function renderItineraryDayStrip(days) {
  const left = els.itineraryDayStrip.scrollLeft;
  els.itineraryDayStrip.replaceChildren(...days.map(day => {
    const button = createItineraryDayButton(day, state.selectedItineraryDate);
    button.addEventListener("click", () => {
      const intent = captureDayStripScrollIntent(els.itineraryDayStrip, button);
      state.selectedItineraryDate = day.date; state.lastActiveItineraryDate = day.date;
      clearItineraryEditMode(false); saveAndRender(); applyDayStripScrollIntent(els.itineraryDayStrip, intent);
      [...els.itineraryDayStrip.children].find(chip => chip.dataset.date === day.date)?.focus({ preventScroll: true });
    });
    return button;
  }));
  els.itineraryDayStrip.scrollLeft = left;
}

function buildItineraryTransit(item, previous) {
  const segments = getItineraryTransits(item);
  const meaningful = segments.filter(segment => (segment.trans && segment.trans !== "none") || Number(segment.duration) || segment.memo || Number(segment.cost));
  const modeFor = segment => itineraryTransitModes[segment?.trans === 'etc' ? 'flight' : segment?.trans] || itineraryTransitModes.none;
  const modes = [...new Set(meaningful.map(segment => modeFor(segment).label))];
  const total = segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.duration) || 0), 0);
  const time = total >= 60 ? `${Math.floor(total / 60)}시간${total % 60 ? ` ${total % 60}분` : ''}` : `${total}분`;
  const description = meaningful.length ? `${modes.join(' + ')} · ${total ? time : '시간 미정'}` : '길찾기 · 이동 기록';
  const group = document.createElement('div'); group.className = 'timeline-transit'; group.dataset.id = item.id;
  const button = document.createElement('button'); button.type = 'button'; button.className = `timeline-transit-button${meaningful.length ? ' has-transit' : ''}`;
  button.dataset.transitOpen = ''; button.dataset.id = item.id;
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', 'itineraryTransitDialog'); button.setAttribute('aria-expanded', 'false');
  const routeLabel = isDomesticMapTrip() ? '지도 · 길찾기' : 'Google 경로';
  button.setAttribute('aria-label', `${itineraryPlaceLabel(previous)}에서 ${itineraryPlaceLabel(item)}까지, ${description}, ${routeLabel} 확인 및 이동 정보 편집`);
  button.innerHTML = `<span aria-hidden="true"></span><span class="timeline-transit-axis" aria-hidden="true"></span><span class="timeline-transit-summary">${itineraryIcon(meaningful.length ? modeFor(meaningful[0]).icon : 'path')}<span class="timeline-transit-copy"><strong>${escapeHtml(description)}</strong><small>${escapeHtml(itineraryPlaceLabel(item))}까지 · ${routeLabel}${meaningful.length > 1 ? ` · ${meaningful.length}개 구간` : ''}</small></span>${itineraryIcon('caret-right')}</span>`;
  button.addEventListener('click', () => window.TripLog.features.itinerary.transitEditor.open(item.id, previous.id));
  group.appendChild(button); return group;
}

function renderItineraryList(days) {
  setupItineraryDragDrop();
  cancelItineraryDragSession();
  const dayMap = new Map(days.map(day => [day.date, day])); const items = getFilteredItineraryItems();
  els.itineraryList.replaceChildren(); els.itineraryEmpty.hidden = items.length > 0;
  document.querySelector(".itinerary-inline-add").hidden = !items.length;
  const selectedId = items.some(item => item.id === state.selectedItineraryId) ? state.selectedItineraryId : items[0]?.id;
  let previous = null;
  for (const item of items) {
    if (state.selectedItineraryDate === "all" && previous?.date !== item.date) {
      const day = dayMap.get(item.date); const heading = document.createElement("h3"); heading.className = "timeline-day-heading";
      heading.textContent = day ? `${day.label} · ${day.shortDate} (${day.weekday})` : item.date; els.itineraryList.append(heading);
    }
    if (previous?.date === item.date) els.itineraryList.append(buildItineraryTransit(item, previous));
    const theme = itineraryThemes[item.theme] || itineraryThemes.sightseeing;
    const article = document.createElement("article"); article.className = `timeline-stop${selectedId === item.id ? " is-selected" : ""}`;
    article.dataset.theme = item.theme || "sightseeing";
    const canReorder = state.selectedItineraryDate !== 'all';
    article.dataset.id = item.id; article.draggable = canReorder && !matchMedia('(pointer: coarse)').matches;
    if (canReorder) {
      article.tabIndex = 0;
      article.setAttribute('aria-label', `${itineraryPlaceLabel(item)}, 드래그하여 순서 이동. 키보드는 Alt와 위아래 방향키`);
    }
    article.innerHTML = `
      <button class="timeline-times" type="button" data-itinerary-action="edit" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(itineraryPlaceLabel(item))} 시간 수정"><time>${escapeHtml(item.time || "미정")}</time>${item.theme !== 'lodging' && item.endTime ? `<time>${escapeHtml(item.endTime)}</time>` : ""}</button>
      <span class="timeline-axis" aria-hidden="true">${itineraryIcon("circle")}</span>
      <div class="timeline-stop-body">
        <div class="timeline-stop-heading"><span class="timeline-place-icon">${itineraryIcon(theme.icon)}</span><button class="timeline-place" type="button" data-itinerary-action="select" data-id="${escapeHtml(item.id)}" aria-pressed="${selectedId === item.id}">${escapeHtml(itineraryPlaceLabel(item))}</button><span class="timeline-stop-actions"><button class="timeline-edit timeline-copy" type="button" data-itinerary-action="copy" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(itineraryPlaceLabel(item))} 복사" title="일정 복사">${itineraryIcon("copy")}</button><button class="timeline-edit" type="button" data-itinerary-action="edit" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(itineraryPlaceLabel(item))} 수정">${itineraryIcon("pencil-simple")}</button>${canReorder && items.length > 1 ? `<button class="timeline-drag-handle" type="button" aria-describedby="itineraryDragInstructions" aria-label="${escapeHtml(itineraryPlaceLabel(item))} 순서 이동" aria-pressed="false" title="바로 잡아서 이동 · 키보드는 Alt + ↑↓">${itineraryIcon('dots-six-vertical')}</button>` : ''}</span></div>
        <div class="timeline-stop-detail"><span class="timeline-theme">${theme.label}</span>${item.memo ? `<p class="timeline-memo">${escapeHtml(item.memo)}</p>` : ""}</div>
        ${item.voucherName || item.voucherCode || item.voucherFileName ? `<button class="timeline-ticket" type="button" data-itinerary-action="${item.voucherFile ? "ticket" : "edit"}" data-id="${escapeHtml(item.id)}">${itineraryIcon("ticket")}<span>${escapeHtml(item.voucherName || item.voucherFileName || "예약 정보")}${item.voucherCode ? ` · ${escapeHtml(item.voucherCode)}` : ""}</span>${itineraryIcon("arrow-up-right")}</button>` : ""}
      </div>`;
    els.itineraryList.append(article); previous = item;
  }
}

function showToast(message) {
  let toast = document.querySelector(".toss-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toss-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
  }
  const dialogs = document.querySelectorAll("dialog[open]");
  const host = dialogs[dialogs.length - 1] || document.body;
  host.appendChild(toast);
  toast.textContent = message;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  if (toast.timeoutId) clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => toast.classList.remove("show"), 2000);
}

window.TripLog.register("features.itinerary.render", { renderItineraryPage, renderItineraryDaySelect, renderItineraryDayStrip, renderItineraryList, showToast });
