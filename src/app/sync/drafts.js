(function () {
  "use strict";
  const R = window.TripLogSyncRepository, controller = window.TripLog.sync.controller;
  const forms = new Set(["itineraryForm", "expenseForm"]);
  let ready = false;
  const memory = new Map();
  const account = () => controller.engine.status().active ? controller.engine.status().accountId : "";
  const key = (formId, tripId, editId) => JSON.stringify([account(), tripId, formId, editId || "new"]);
  function capture(event) {
    const form = event.target.closest("form");
    if (!forms.has(form?.id)) return;
    const tripId = state.id;
    const editId = form.id === "itineraryForm" ? editingItineraryId : editingId;
    const fields = Object.fromEntries([...form.querySelectorAll("input[id],select[id],textarea[id]")]
      .filter(el => !["file", "password"].includes(el.type)).map(el => [el.id, { value: el.value, checked: el.checked }]));
    const value = { tripId, accountId: account(), formId: form.id, editId, fields,
      ...(form.id === "itineraryForm" ? { voucherFile: currentVoucherFile, voucherFileName: currentVoucherFileName } : {}) };
    const id = key(form.id, tripId, editId), row = { id, value, savedAt: Date.now(), persisted: false };
    memory.set(id, row);
    controller.localWrite(tripId, 1);
    R.draft(id, value).then(() => { if (memory.get(id) === row) row.persisted = true; }).catch(error => controller.setLocalFailure(error, tripId))
      .finally(() => controller.localWrite(tripId, -1));
  }
  async function clear(formId, tripId, editId) {
    const id = key(formId, tripId, editId); memory.delete(id);
    try { await R.draft(id, null); }
    catch (_) { /* A saved item stays saved; an extra recovery draft is harmless. */ }
  }
  function inMemory(tripId) { return [...memory.values()].filter(row => row.value.accountId === account() && (!tripId || row.value.tripId === tripId)); }
  async function list(tripId) {
    const stored = (await R.drafts(tripId)).filter(row => row.value.accountId === account() && forms.has(row.value.formId));
    return [...new Map([...stored, ...inMemory(tripId)].map(row => [row.id,row])).values()];
  }
  function resume(row) {
    const draft = row.value;
    if (draft.tripId !== state.id || draft.accountId !== account()) throw new Error("원래 여행과 계정에서 초안을 열어 주세요.");
    if (draft.formId !== "itineraryForm") throw new Error("입력 미리보기에서 내용을 복사해 지출 입력창에 붙여 넣어 주세요.");
    document.querySelector("#triplogSyncStatus")?.close();
    setActivePage("itinerary");
    window.TripLog.features.itinerary.workspace.show({ previewMap: false });
    for (const [id, saved] of Object.entries(draft.fields)) {
      const control = document.getElementById(id); if (!control || !document.querySelector("#itineraryForm").contains(control)) continue;
      control.value = saved.value; control.checked = saved.checked;
    }
    setVoucherFile(draft.voucherFile || null, draft.voucherFileName || null);
    document.querySelector("#itineraryExtraDetails").open = true;
    for (const id of ["itineraryDaySelect", "itineraryThemeSelect"]) syncCustomSelect(document.getElementById(id));
    for (const id of ["itineraryTimeInput", "itineraryEndTimeInput"]) syncCustomTimePicker(document.getElementById(id));
    window.TripLog.features.itinerary.workspace.render();
    showToast("초안을 새 일정 입력창에 불러왔어요. 확인 후 추가해 주세요.");
  }
  function setup() {
    if (ready) return; ready = true;
    document.addEventListener("input", capture);
    document.addEventListener("change", capture);
  }
  async function discard(row) { memory.delete(row.id); await R.draft(row.id, null); }
  window.TripLog.register("sync.drafts", { setup, clear, list, resume, inMemory, discard });
})();
