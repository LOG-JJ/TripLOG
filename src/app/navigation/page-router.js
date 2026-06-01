function setActivePage(page) {
  const allowedPages = ["overview", "itinerary", "budget", "settlement", "report", "settings"];
  const nextPage = allowedPages.includes(page) ? page : "overview";
  if (nextPage === activePage && !isPageTransitioning) return;

  if (window.scrollY > 0) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  const previousPage = activePage;
  const outgoing = getPageElement(previousPage);
  const incoming = getPageElement(nextPage);
  activePage = nextPage;

  if (nextPage === "itinerary") renderItineraryPage();
  render(); // Sync all states before transition finishes
  prepareIncomingPage(incoming);
  updatePageChrome({ animateBrand: true });
  startBrandIconFlip();
  renderModeControls();

  const outgoingHeight = measurePageHeight(outgoing);
  const incomingHeight = measurePageHeight(incoming);
  els.pageStage.style.height = `${outgoingHeight}px`;
  els.pageStage.classList.add("is-transitioning");
  outgoing.classList.remove("page-enter", "page-active");
  incoming.classList.remove("page-exit");

  requestAnimationFrame(() => {
    els.pageStage.style.height = `${incomingHeight}px`;
    outgoing.classList.add("page-exit");
    incoming.classList.add("page-enter", "page-active");
  });

  isPageTransitioning = true;
  window.clearTimeout(pageTransitionTimer);
  pageTransitionTimer = window.setTimeout(() => {
    outgoing.hidden = true;
    outgoing.classList.remove("page-exit", "page-enter", "page-active");
    incoming.hidden = false;
    incoming.classList.remove("page-exit", "page-enter");
    incoming.classList.add("page-active");
    els.pageStage.classList.remove("is-transitioning");
    els.pageStage.style.removeProperty("height");
    isPageTransitioning = false;
    syncPageVisibility();
  }, PAGE_TRANSITION_MS + 40);
}

function getPageElement(page) {
  switch (page) {
    case "overview": return els.overviewPage;
    case "itinerary": return els.itineraryPage;
    case "budget": return els.budgetPage;
    case "settlement": return els.settlementPage;
    case "report": return els.reportPage;
    case "settings": return els.settingsPage;
    default: return els.overviewPage;
  }
}

function measurePageHeight(pageElement) {
  return Math.max(pageElement.offsetHeight, pageElement.scrollHeight, window.innerHeight - 130);
}

function prepareIncomingPage(pageElement) {
  pageElement.hidden = false;
  pageElement.classList.remove("page-exit", "page-enter");
}

function syncPageVisibility() {
  if (isPageTransitioning) return;
  els.overviewPage.hidden = activePage !== "overview";
  els.itineraryPage.hidden = activePage !== "itinerary";
  els.budgetPage.hidden = activePage !== "budget";
  els.settlementPage.hidden = activePage !== "settlement";
  els.reportPage.hidden = activePage !== "report";
  els.settingsPage.hidden = activePage !== "settings";

  els.overviewPage.classList.toggle("page-active", activePage === "overview");
  els.itineraryPage.classList.toggle("page-active", activePage === "itinerary");
  els.budgetPage.classList.toggle("page-active", activePage === "budget");
  els.settlementPage.classList.toggle("page-active", activePage === "settlement");
  els.reportPage.classList.toggle("page-active", activePage === "report");
  els.settingsPage.classList.toggle("page-active", activePage === "settings");

  updatePageChrome();
}

function updatePageChrome({ animateBrand = false } = {}) {
  const isItinerary = activePage === "itinerary";
  els.itineraryPageButton.classList.toggle("active", isItinerary);
  els.itineraryPageButton.title = isItinerary ? "가계부로 돌아가기" : "여행 일정 보기";
  els.itineraryPageButton.setAttribute("aria-label", els.itineraryPageButton.title);
  els.budgetBrandIcon.classList.toggle("active", !isItinerary);
  els.itineraryBrandIcon.classList.toggle("active", isItinerary);
  [els.domesticModeButton, els.overseasModeButton].forEach((statusItem) => {
    if (statusItem) statusItem.tabIndex = -1;
  });

  // Highlight active navigation tab bar item
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.target === activePage);
  });

  updateBrandText({ animate: animateBrand });
}

function updateBrandText({ animate = false } = {}) {
  const isItinerary = activePage === "itinerary";
  const isOverseas = state.travelMode === "overseas";
  const nextTitle = isItinerary ? "여행 일정" : "여행 가계부";
  const nextSubtitle = isItinerary ? "여행 일정과 지도 정리" : isOverseas ? "해외 여행 경비 정리" : "국내 여행 경비 정리";
  const hasChanged = els.brandTitle.textContent !== nextTitle || els.brandSubtitle.textContent !== nextSubtitle;

  if (!hasChanged) return;

  if (animate) {
    els.brandCopy.classList.remove("text-swap");
  }

  els.brandTitle.textContent = nextTitle;
  els.brandSubtitle.textContent = nextSubtitle;

  if (!animate) return;

  void els.brandCopy.offsetWidth;
  els.brandCopy.classList.add("text-swap");
  window.clearTimeout(brandTextTimer);
  brandTextTimer = window.setTimeout(() => els.brandCopy.classList.remove("text-swap"), PAGE_TRANSITION_MS);
}

function startBrandIconFlip() {
  els.itineraryPageButton.classList.remove("icon-flip");
  void els.itineraryPageButton.offsetWidth;
  els.itineraryPageButton.classList.add("icon-flip");
  window.setTimeout(() => els.itineraryPageButton.classList.remove("icon-flip"), PAGE_TRANSITION_MS);
}

window.TripLog.register("navigation.pageRouter", {
  setActivePage,
  getPageElement,
  measurePageHeight,
  prepareIncomingPage,
  syncPageVisibility,
  updatePageChrome,
  updateBrandText,
  startBrandIconFlip,
});
