function pageUrl(page) {
  const url = new URL(location.href);
  url.searchParams.set('page', page);
  if (page !== 'travel') url.searchParams.delete('travelTab');
  if (['overview', 'itinerary', 'travel', 'budget', 'settlement', 'report', 'settings'].includes(page) && typeof state !== 'undefined' && state.id) url.searchParams.set('trip', state.id);
  else url.searchParams.delete('trip');
  return url;
}

function setActivePage(page) {
  const allowedPages = ["start", "overview", "itinerary", "travel", "budget", "settlement", "report", "settings"];
  const nextPage = allowedPages.includes(page) ? page : "start";
  if (nextPage === activePage && !isPageTransitioning) return;

  closeAllCustomDatePickers();
  closeAllCustomTimePickers();
  closeAllCustomSelects();
  cancelItineraryDragSession();
  if (activePage === "start" && nextPage !== "start") {
    window.TripLog.features.redesign?.workspace?.cancelTripEdit?.();
  }

  if (window.scrollY > 0) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  const nextUrl = pageUrl(nextPage);
  if (nextUrl.href !== location.href) history.replaceState({page:nextPage},'',nextUrl);

  activePage = nextPage;
  window.clearTimeout(pageTransitionTimer);
  isPageTransitioning = false;
  els.pageStage.classList.remove("is-transitioning");
  els.pageStage.style.removeProperty("height");
  // Visibility and navigation feedback are immediate. Only render the destination.
  render({ pageOnly: true });
}

function syncPageVisibility() {
  if (isPageTransitioning) return;
  els.startPage.hidden = activePage !== "start";
  els.overviewPage.hidden = activePage !== "overview";
  els.itineraryPage.hidden = activePage !== "itinerary";
  els.travelPage.hidden = activePage !== "travel";
  els.budgetPage.hidden = activePage !== "budget";
  els.settlementPage.hidden = activePage !== "settlement";
  els.reportPage.hidden = activePage !== "report";
  els.settingsPage.hidden = activePage !== "settings";

  els.startPage.classList.toggle("page-active", activePage === "start");
  els.overviewPage.classList.toggle("page-active", activePage === "overview");
  els.itineraryPage.classList.toggle("page-active", activePage === "itinerary");
  els.travelPage.classList.toggle("page-active", activePage === "travel");
  els.budgetPage.classList.toggle("page-active", activePage === "budget");
  els.settlementPage.classList.toggle("page-active", activePage === "settlement");
  els.reportPage.classList.toggle("page-active", activePage === "report");
  els.settingsPage.classList.toggle("page-active", activePage === "settings");

  updatePageChrome();
}

function updatePageChrome() {
  document.body.dataset.page = activePage;
  if (activePage !== "itinerary") window.TripLog.features.itinerary.workspace?.close?.();

}

window.TripLog.register("navigation.pageRouter", {
  setActivePage,
  pageUrl,
  syncPageVisibility,
  updatePageChrome,
});
