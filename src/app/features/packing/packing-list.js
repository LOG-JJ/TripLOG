
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

function deletePackingItem(id) {
  if (!state.packingList) return;
  window.TripLog.persistence.stateStorage.markDeletedEntity("packing", id);
  state.packingList = state.packingList.filter(item => item.id !== id);
  saveAndRender();
}




window.TripLog.register("features.packing.list", {
  addPackingItem,
  deletePackingItem,
});
