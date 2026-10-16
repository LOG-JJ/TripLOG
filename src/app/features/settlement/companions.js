function addCompanion(name) {
  name = name.trim();
  if (!name) return;
  
  if (!state.companions) state.companions = [];
  
  // Prevent duplicate names
  if (state.companions.some(c => c.name === name) || name === "방장" || name === "나") {
    alert("이미 존재하는 멤버 이름입니다.");
    return;
  }

  state.companions.push({ id: createId(), name, individualSpent: 0 });
  saveAndRender();
}

async function deleteCompanion(index) {
  if (!state.companions) return false;
  const tripId = state.id;
  const member = state.companions[index];
  if (!member) return false;
  const hasPayments = () => state.entries.some(entry => entry.payerKey === getCompanionSettlementKey(member));
  if (hasPayments()) {
    showToast("이 동행이 결제한 지출이 있어요. 결제자를 먼저 바꿔 주세요."); return false;
  }
  if (!await window.TripLog.ui.confirmation.ask({ kind: 'companion', subject: member.name }) || state.id !== tripId) return false;
  const current = state.companions.find(item => item.id === member.id);
  if (!current) return false;
  if (hasPayments()) { showToast('결제 내역이 바뀌었어요. 결제자를 먼저 확인해 주세요.'); return false; }
  const previous = { companions: state.companions, settlement: state.settlement };
  state.companions = state.companions.filter(item => item.id !== current.id);
  state.settlement = JSON.parse(JSON.stringify(state.settlement || {}));
  window.TripLog.persistence.stateStorage.markDeletedEntity("participant", current.id);
  if (state.settlement.customShares) {
    delete state.settlement.customShares[getCompanionSettlementKey(current)];
  }
  if (state.settlement.itemSplits) {
    const removedKey = getCompanionSettlementKey(current);
    Object.values(state.settlement.itemSplits).forEach((split) => {
      if (split?.shares) delete split.shares[removedKey];
    });
  }
  if (!await saveAndRender()) {
    if (state.id === tripId) { Object.assign(state, previous); render(); }
    showToast('정산 멤버를 삭제하지 못했어요. 다시 시도해 주세요.'); return false;
  }
  if (window.TripLogSyncRepository?.cached(tripId)?.snapshot.companions.some(item => item.id === current.id)) {
    showToast('다른 변경과 겹쳐 삭제하지 않았어요. 저장 상태를 확인해 주세요.'); return false;
  }
  if (state.id === tripId) showToast('정산 멤버를 삭제했어요.');
  return true;
}

function updateCompanionSpent(index, amount) {
  if (!state.companions || !state.companions[index]) return;
  state.companions[index].individualSpent = Math.max(0, amount);
  saveAndRender();
}

window.TripLog.register("features.settlement.companions", {
  addCompanion,
  deleteCompanion,
  updateCompanionSpent,
});
