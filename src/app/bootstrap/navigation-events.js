function initNavigationEvents() {
  // Tabs click handler
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const target = item.dataset.target;
      setActivePage(target);
    });
  });

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
