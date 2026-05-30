function handleDonutClick(event) {
  const category = categoryFromDonutPointer(event);
  if (!category) return;
  setFilter(activeFilter === category ? "전체" : category);
}

function handleDonutMove(event) {
  const category = categoryFromDonutPointer(event);
  highlightCategory(category || (activeFilter === "전체" ? null : activeFilter));
}

window.TripLog.register("features.reports.donutEvents", {
  handleDonutClick,
  handleDonutMove,
});
