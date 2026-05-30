function addCompanion(name) {
  name = name.trim();
  if (!name) return;
  
  if (!state.companions) state.companions = [];
  
  // Prevent duplicate names
  if (state.companions.some(c => c.name === name) || name === "방장" || name === "나") {
    alert("이미 존재하는 멤버 이름입니다.");
    return;
  }

  state.companions.push({ name, individualSpent: 0 });
  saveAndRender();
}

function deleteCompanion(index) {
  if (!state.companions) return;
  const [removed] = state.companions.splice(index, 1);
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
