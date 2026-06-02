function setActivePage(page) {
  const allowedPages = ["start", "overview", "itinerary", "budget", "settlement", "report", "settings"];
  const nextPage = allowedPages.includes(page) ? page : "start";
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
    case "start": return els.startPage;
    case "overview": return els.overviewPage;
    case "itinerary": return els.itineraryPage;
    case "budget": return els.budgetPage;
    case "settlement": return els.settlementPage;
    case "report": return els.reportPage;
    case "settings": return els.settingsPage;
    default: return els.startPage;
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
  els.startPage.hidden = activePage !== "start";
  els.overviewPage.hidden = activePage !== "overview";
  els.itineraryPage.hidden = activePage !== "itinerary";
  els.budgetPage.hidden = activePage !== "budget";
  els.settlementPage.hidden = activePage !== "settlement";
  els.reportPage.hidden = activePage !== "report";
  els.settingsPage.hidden = activePage !== "settings";

  els.startPage.classList.toggle("page-active", activePage === "start");
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
  [els.domesticModeButton, els.overseasModeButton].forEach((statusItem) => {
    if (statusItem) statusItem.tabIndex = -1;
  });

  // Highlight active navigation tab bar item
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.target === activePage);
  });

  syncBrandIconWithActiveNav();
  updateBrandText({ animate: animateBrand });
}

function syncBrandIconWithActiveNav() {
  if (!els.brandIcon) return;
  const activeNavIcon = document.querySelector(`.nav-item[data-target="${activePage}"] .nav-icon`);
  if (!activeNavIcon) return;

  const viewBox = activeNavIcon.getAttribute("viewBox") || "0 0 24 24";
  const iconMarkup = activeNavIcon.innerHTML;
  const specialClasses = Array.from(activeNavIcon.classList)
    .filter((className) => className !== "nav-icon")
    .join(" ");
  const nextClassName = `brand-icon active${specialClasses ? ` ${specialClasses}` : ""}`;

  if (els.brandIcon.getAttribute("viewBox") !== viewBox) {
    els.brandIcon.setAttribute("viewBox", viewBox);
  }
  if (els.brandIcon.innerHTML !== iconMarkup) {
    els.brandIcon.innerHTML = iconMarkup;
  }
  if (els.brandIcon.getAttribute("class") !== nextClassName) {
    els.brandIcon.setAttribute("class", nextClassName);
  }
}

function updateBrandText({ animate = false } = {}) {
  const titleByPage = {
    start: "여행 시작",
    overview: "여행",
    itinerary: "일정",
    budget: "가계부",
    settlement: "가계부",
    report: "가계부",
    settings: "설정",
  };
  const accessibleTitle = titleByPage[activePage] || "여행 시작";
  const hasChanged = els.brandTitle.textContent || els.brandTitle.getAttribute("aria-label") !== accessibleTitle || (els.brandSubtitle && els.brandSubtitle.textContent);

  if (!hasChanged) return;

  if (animate) {
    els.brandCopy.classList.remove("text-swap");
  }

  els.brandTitle.textContent = "";
  els.brandTitle.setAttribute("aria-label", accessibleTitle);
  els.brandTitle.setAttribute("title", accessibleTitle);
  if (els.brandSubtitle) {
    els.brandSubtitle.textContent = "";
    els.brandSubtitle.hidden = true;
  }

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
  syncBrandIconWithActiveNav,
  updateBrandText,
  startBrandIconFlip,
});
