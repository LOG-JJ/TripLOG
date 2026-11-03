
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
    id: createId(),
    name: name,
    checked: false
  };

  state.packingList.push(newItem);
  els.packingInput.value = "";
  saveAndRender();
}

async function savePackingRemoval(next, message) {
  const tripId = state.id, previous = state.packingList;
  const removed = previous.filter(item => !next.some(kept => kept.id === item.id));
  removed.forEach(item => window.TripLog.persistence.stateStorage.markDeletedEntity('packing', item.id));
  state.packingList = next;
  if (!await saveAndRender()) {
    if (state.id === tripId) { state.packingList = previous; render(); }
    showToast('준비물을 변경하지 못했어요. 다시 시도해 주세요.'); return false;
  }
  const stored = window.TripLogSyncRepository?.cached(tripId)?.snapshot.packingList;
  if (stored && removed.some(item => stored.some(saved => saved.id === item.id))) {
    showToast('다른 변경과 겹쳐 삭제하지 않았어요. 저장 상태를 확인해 주세요.'); return false;
  }
  if (state.id === tripId) showToast(message);
  return true;
}

async function deletePackingItem(id) {
  const tripId = state.id, item = state.packingList?.find(item => item.id === id);
  if (!item || !await window.TripLog.ui.confirmation.ask({ kind: 'packing', subject: item.name })) return false;
  if (state.id !== tripId || !state.packingList?.some(item => item.id === id)) return false;
  return savePackingRemoval(state.packingList.filter(item => item.id !== id), '준비물을 삭제했어요.');
}

async function resetPackingList() {
  const tripId = state.id;
  if (!await window.TripLog.ui.confirmation.ask({ kind: 'packing-reset' }) || state.id !== tripId) return false;
  return savePackingRemoval(getDefaultPackingList(), '기본 준비물로 바꿨어요.');
}
window.TripLog.register("features.packing.list", {
  addPackingItem,
  deletePackingItem,
  resetPackingList,
  async setChecked(id, checked) {
    const tripId = state.id, previous = state.packingList;
    const next = window.TripLog.domain.commands.mutate(state, 'packing', 'check', { id, checked });
    state.packingList = next.packingList;
    if (!await saveAndRender()) {
      if (state.id === tripId) { state.packingList = window.TripLogSyncRepository.cached(tripId)?.snapshot.packingList || previous; render(); }
      throw new Error('준비물을 저장하지 못했어요. 다시 시도해 주세요.');
    }
  },
});
