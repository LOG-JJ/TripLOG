function initNavigationEvents() {
  // Settlement companion add form submit
  const memberForm = document.querySelector("#settlementMemberForm");
  const memberInput = document.querySelector("#settlementMemberInput");
  if (memberForm && memberInput) {
    memberForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = memberInput.value;
      if (name) {
        addCompanion(name);
        memberInput.value = "";
      }
    });
  }

  const settlementExpenseSourceSelect = document.querySelector("#settlementExpenseSourceSelect");
  settlementExpenseSourceSelect?.addEventListener("change", (event) => {
    syncCustomSelect(settlementExpenseSourceSelect);
    setSettlementSource(event.target.value);
  });
}

window.TripLog.register("bootstrap.navigationEvents", {
  initNavigationEvents,
});
