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

function deleteCompanion(index) {
  if (!state.companions) return;
  const member = state.companions[index];
  if (member && state.entries.some(entry => entry.payerKey === getCompanionSettlementKey(member))) {
    showToast("이 동행이 결제한 지출이 있어요. 지출의 결제자를 먼저 변경해 주세요."); return;
  }
  const [removed] = state.companions.splice(index, 1);
  if (removed) window.TripLog.persistence.stateStorage.markDeletedEntity("participant", removed.id);
  if (removed && state.settlement?.customShares) {
    delete state.settlement.customShares[getCompanionSettlementKey(removed)];
  }
  if (removed && state.settlement?.itemSplits) {
    const removedKey = getCompanionSettlementKey(removed);
    Object.values(state.settlement.itemSplits).forEach((split) => {
      if (split?.shares) delete split.shares[removedKey];
    });
  }
  saveAndRender();
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
