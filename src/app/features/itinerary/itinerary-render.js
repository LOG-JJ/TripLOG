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
function getItineraryTransits(item) {
  return item.transits?.length ? item.transits : [{ trans: item.trans || "none", duration: item.duration || 0, cost: item.cost || 0, memo: "" }];
}

function renderItineraryPage() {
  const days = getTripDays();
  if (state.selectedItineraryDate !== "all" && !days.some(day => day.date === state.selectedItineraryDate)) state.selectedItineraryDate = days[0]?.date || state.startDate;
  els.itineraryTripName.textContent = state.tripName || getDefaultTripName();
  els.itineraryDateRange.textContent = `${formatReadableDate(state.startDate)} - ${formatReadableDate(state.endDate)}`;
  const day = days.find(entry => entry.date === state.selectedItineraryDate);
  document.querySelector("#itinerarySelectedDayTitle").textContent = day
    ? `${Number(day.date.slice(0, 4))}년 ${Number(day.date.slice(5, 7))}월 ${Number(day.date.slice(8, 10))}일 (${day.weekday})` : "전체 일정";
  els.itineraryModeToggle?.querySelectorAll("button").forEach(button => {
    const active = (state.selectedItineraryDate === "all") === (button.dataset.mode === "overview");
    button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  });
  renderItineraryDaySelect(days); renderItineraryDayStrip(days); renderItineraryList(days);
  syncNaverMapsLink();
  window.TripLog.features.itinerary.workspace?.render?.(days);
  if (document.querySelector("#itineraryToolsDialog")?.open) {
    renderTimeBlockGrid(getFilteredItineraryItems()); renderTravelTimeChart(getFilteredItineraryItems()); renderPackingBag();
  }
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
    });
    return button;
  }));
  els.itineraryDayStrip.scrollLeft = left;
}

function buildItineraryTransit(item, openIds) {
  const segments = getItineraryTransits(item);
  const details = document.createElement("details"); details.className = "timeline-transit";
  details.dataset.id = item.id; details.open = openIds.has(item.id);
  const meaningful = segments.filter(segment => segment.trans !== "none" || segment.duration || segment.memo || segment.cost);
  const firstMode = itineraryTransitModes[segments[0]?.trans] || itineraryTransitModes.none;
  const description = meaningful.map(segment => {
    const mode = itineraryTransitModes[segment.trans] || itineraryTransitModes.none;
    return `${mode.label}${Number(segment.duration) > 0 ? ` ${Number(segment.duration)}분` : ""}`;
  }).join(" · ") || "이동 정보 추가";
  details.innerHTML = `<summary aria-label="${escapeHtml(item.place)}까지 ${escapeHtml(description)}, 이동 정보 편집"><span class="timeline-transit-axis">${itineraryIcon(firstMode.icon)}</span><span class="timeline-transit-label">${escapeHtml(description)}</span></summary><div class="timeline-transit-fields">${segments.map((segment, index) => `
    <div class="timeline-transit-segment" data-index="${index}">
      <label><span>이동 수단</span><select data-transit-field="trans" aria-label="이동 수단">${Object.entries(itineraryTransitModes).map(([key, mode]) => `<option value="${key}"${key === (segment.trans === "etc" ? "flight" : segment.trans) ? " selected" : ""}>${mode.label}</option>`).join("")}</select></label>
      <label><span>이동 시간 (분)</span><input data-transit-field="duration" aria-label="이동 시간 (분)" type="number" min="0" max="1440" value="${Number(segment.duration) || 0}" /></label>
      <label class="wide"><span>이동 메모</span><input data-transit-field="memo" aria-label="이동 메모" maxlength="120" value="${escapeHtml(segment.memo || "")}" placeholder="버스 번호, 환승 정보 등" /></label>
      ${segment.cost ? `<p class="timeline-transit-cost">이동 경비 ${escapeHtml(formatWon(segment.cost))}</p>` : ""}
      ${segments.length > 1 ? `<button type="button" data-remove-transit="${index}">이동 구간 삭제</button>` : ""}
    </div>`).join("")}<button type="button" data-add-transit>${itineraryIcon("plus")}이동 수단 추가</button></div>`;
  details.addEventListener("change", event => {
    const field = event.target.dataset.transitField; if (!field) return;
    const index = Number(event.target.closest("[data-index]").dataset.index);
    const value = field === "duration" ? Math.min(1440, Math.max(0, Number(event.target.value) || 0)) : event.target.value;
    updateTravelSegmentField(item.id, index, field, value);
  });
  details.addEventListener("click", event => {
    if (event.target.closest("[data-add-transit]")) addTravelSegment(item.id);
    const remove = event.target.closest("[data-remove-transit]"); if (remove) deleteTravelSegment(item.id, Number(remove.dataset.removeTransit));
  });
  return details;
}

function renderItineraryList(days) {
  const dayMap = new Map(days.map(day => [day.date, day])); const items = getFilteredItineraryItems();
  const openIds = new Set([...els.itineraryList.querySelectorAll("details[open]")].map(el => el.dataset.id));
  els.itineraryList.replaceChildren(); els.itineraryEmpty.hidden = items.length > 0;
  document.querySelector(".itinerary-inline-add").hidden = !items.length;
  const selectedId = items.some(item => item.id === state.selectedItineraryId) ? state.selectedItineraryId : items[0]?.id;
  let previous = null;
  for (const item of items) {
    if (state.selectedItineraryDate === "all" && previous?.date !== item.date) {
      const day = dayMap.get(item.date); const heading = document.createElement("h3"); heading.className = "timeline-day-heading";
      heading.textContent = day ? `${day.label} · ${day.shortDate} (${day.weekday})` : item.date; els.itineraryList.append(heading);
    }
    if (previous?.date === item.date) els.itineraryList.append(buildItineraryTransit(item, openIds));
    const theme = itineraryThemes[item.theme] || itineraryThemes.sightseeing;
    const article = document.createElement("article"); article.className = `timeline-stop${selectedId === item.id ? " is-selected" : ""}`;
    article.dataset.id = item.id; article.draggable = state.selectedItineraryDate !== "all";
    article.innerHTML = `
      <button class="timeline-times" type="button" data-itinerary-action="edit" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.place)} 시간 수정"><time>${escapeHtml(item.time || "미정")}</time>${item.endTime ? `<time>${escapeHtml(item.endTime)}</time>` : ""}</button>
      <span class="timeline-axis" aria-hidden="true">${itineraryIcon("circle")}</span>
      <div class="timeline-stop-body">
        <div class="timeline-stop-heading"><button class="timeline-place" type="button" data-itinerary-action="select" data-id="${escapeHtml(item.id)}" aria-pressed="${selectedId === item.id}">${escapeHtml(item.place || "장소 미정")}</button><button class="timeline-edit" type="button" data-itinerary-action="edit" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.place)} 수정">${itineraryIcon("pencil-simple")}</button></div>
        <p class="timeline-theme">${itineraryIcon("map-pin")}<span>${theme.label}</span></p>
        ${item.memo ? `<p class="timeline-memo">${itineraryIcon("note")}<span>${escapeHtml(item.memo)}</span></p>` : ""}
        ${item.voucherName || item.voucherCode || item.voucherFileName ? `<button class="timeline-ticket" type="button" data-itinerary-action="${item.voucherFile ? "ticket" : "edit"}" data-id="${escapeHtml(item.id)}">${itineraryIcon("ticket")}<span>${escapeHtml(item.voucherName || item.voucherFileName || "예약 정보")}${item.voucherCode ? ` · ${escapeHtml(item.voucherCode)}` : ""}</span>${itineraryIcon("arrow-up-right")}</button>` : ""}
      </div>`;
    article.addEventListener("dragstart", event => {
      if (event.target.closest("button") || state.selectedItineraryDate === "all") { event.preventDefault(); return; }
      event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; article.classList.add("is-dragging");
    });
    article.addEventListener("dragend", () => article.classList.remove("is-dragging"));
    article.addEventListener("dragover", event => { event.preventDefault(); article.classList.add("is-drag-over"); });
    article.addEventListener("dragleave", () => article.classList.remove("is-drag-over"));
    article.addEventListener("drop", event => {
      event.preventDefault(); article.classList.remove("is-drag-over"); const id = event.dataTransfer.getData("text/plain");
      if (id !== item.id && state.itineraryItems.some(entry => entry.id === id && entry.date === item.date)) swapItineraryItems(id, item.id);
    });
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
