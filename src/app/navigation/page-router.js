function pageUrl(page) {
  const url = new URL(location.href);
  url.searchParams.set('page', page);
  if (['overview', 'itinerary', 'budget', 'settlement', 'report'].includes(page) && typeof state !== 'undefined' && state.id) url.searchParams.set('trip', state.id);
  else url.searchParams.delete('trip');
  return url;
}

function setActivePage(page) {
  const allowedPages = ["start", "overview", "itinerary", "budget", "settlement", "report", "settings"];
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
  document.body.dataset.page = activePage;
  if (activePage !== "itinerary") window.TripLog.features.itinerary.workspace?.close?.();
  [els.domesticModeButton, els.overseasModeButton].forEach((statusItem) => {
    if (statusItem) statusItem.tabIndex = -1;
  });

  // Highlight active navigation tab bar item
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.target === activePage);
  });

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
    start: "내 여행",
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
  pageUrl,
  getPageElement,
  measurePageHeight,
  prepareIncomingPage,
  syncPageVisibility,
  updatePageChrome,
  syncBrandIconWithActiveNav,
  updateBrandText,
  startBrandIconFlip,
});
