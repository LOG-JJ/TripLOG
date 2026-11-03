const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { artifactDirectory } = require("./helpers/artifact-output");
const { launchBrowser, startServer, stopServer, seedTrip, blockExternalRequests, waitForApp } = require("./helpers/browser-fixture");
const { createServer } = require("./serve-test");
const output = process.env.TRIPLOG_UI_SNAPSHOT_DIR || artifactDirectory("trip-navigation");
const seed = { ...require("./fixtures/trip-library").find((trip) => trip.id === "library-osaka"), id: "navigation-fixture", itineraryItems: Array.from({ length: 10 }, (_, i) => ({ id: `navigation-stop-${i}`, date: "2026-09-25", time: `${String(8 + i).padStart(2, "0")}:00`, place: `\uC624\uC0AC\uCE74 \uC5EC\uD589 \uC7A5\uC18C ${i + 1}`, theme: "sightseeing", createdAt: i })) };
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const { server, origin } = await startServer(() => createServer({ pagesRedirects: true }));
  const browser = await launchBrowser(), errors = [], consoleIssues = [], layouts = [];
  try {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 }, timezoneId: "Asia/Seoul", hasTouch: true });
    context.setDefaultTimeout(12e3);
    await blockExternalRequests(context, origin);
    await seedTrip(context, { origin, user: { id: "00000000-0000-4000-8000-000000000087", email: "navigation@example.test" }, expiry: Math.floor(Date.now() / 1e3) + 3600, seed, marker: "navigation-fixture" });
    await context.addInitScript(() => {
      const NativeDate = Date;
      window.Date = class extends NativeDate {
        constructor(...args) {
          super(...args.length ? args : ["2026-09-25T09:00:00+09:00"]);
        }
      };
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type()) && !/net::ERR_FAILED|Failed to fetch|Service Worker registration blocked by Playwright/.test(m.text())) consoleIssues.push(m.text());
    });
    const tab = (name) => page.locator(`.tl-bottom-nav:not(.tl-nav-dock):visible [data-trip-nav="${name}"]`).last();
    const waitPage = (name) => page.waitForFunction((name2) => activePage === name2 && document.body.dataset.page === name2, name);
    const go = async (name) => {
      await tab(name).click();
      await waitPage(name);
    };
    const data = () => page.evaluate(() => JSON.parse(JSON.stringify({ entries: state.entries, itineraryItems: state.itineraryItems, companions: state.companions, packingList: state.packingList })));
    const noMenu = async () => {
      assert.equal(await page.locator("#tripNavigationMenu").isVisible(), false);
      assert.equal(await page.evaluate(() => Boolean(history.state?.tripNavigation)), false);
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), "hidden");
      assert.equal(await page.locator(".tl-bottom-nav:visible .tl-nav-expand").count(), 0);
    };
    await page.goto(`${origin}/Travel?page=overview&trip=${seed.id}`);
    await waitForApp(page);
    assert.match(await page.locator("#rdOverview").innerText(), /오사카/);
    assert.equal(await page.evaluate(() => saveStateSilently()), true);
    await page.evaluate(() => window.TripLog.persistence.stateStorage.whenSaved());
    const baseline = await data();
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [width, height] of [[320, 568], [320, 740], [390, 844], [844, 390], [1280, 900]]) {
      await page.setViewportSize({ width, height });
      await go("travel");
      await noMenu();
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.locator(".tl-bottom-nav:visible [data-trip-nav]").evaluateAll((nodes) => nodes.map((node) => {
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        const before = getComputedStyle(node, "::before"), after = getComputedStyle(node, "::after");
        const icon = node.querySelector('.tl-nav-icon'), iconStyle = getComputedStyle(icon), label = node.querySelector('span'), labelStyle = getComputedStyle(label);
        return { page: node.dataset.tripNav, label: label.textContent, button: box(node), icon: box(icon), mask: iconStyle.maskImage, text: box(label), typography: { size: labelStyle.fontSize, weight: labelStyle.fontWeight, lineHeight: labelStyle.lineHeight }, highlight: { top: before.top, height: before.height }, underline: { display: after.display, opacity: after.opacity }, popup: node.getAttribute("aria-haspopup") };
      }));
      assert.deepEqual(geometry.map((n) => n.label), ["\uAC1C\uC694", "\uC77C\uC815", "\uC5EC\uD589", "\uC9C0\uCD9C", "\uB9AC\uD3EC\uD2B8"]);
      for (const row of geometry) {
        assert.equal(row.popup, null);
        assert(row.button.width >= 40 && row.button.height >= 40);
        assert(Math.abs(row.icon.y - geometry[0].icon.y) < 1);
        assert(Math.abs(row.text.y - geometry[0].text.y) < 1);
        assert(Math.abs(row.icon.x + row.icon.width / 2 - row.button.x - row.button.width / 2) < 1);
        assert.equal(row.icon.width, 28);
        assert.equal(row.icon.height, 24);
        assert.notEqual(row.mask, 'none');
        assert(Math.abs(row.text.y - row.icon.y - row.icon.height - 4) < 0.5, 'Every icon/label gap follows the common grid');
        assert.deepEqual(row.typography, { size: '12px', weight: '600', lineHeight: '16px' });
        assert.equal(row.highlight.top, geometry[0].highlight.top);
        assert.equal(row.highlight.height, geometry[0].highlight.height, "Travel uses the common selection height");
      }
      assert.notEqual(geometry[2].underline.display, "none");
      assert.equal(geometry[2].underline.opacity, "1");
      layouts.push({ width, height, geometry });
      await page.screenshot({ path: path.join(output, `travel-${width}x${height}.png`), animations: "disabled" });
      await go("report");
      await noMenu();
      assert.equal(await tab("report").getAttribute("aria-current"), "page");
      await page.screenshot({ path: path.join(output, `report-${width}x${height}.png`), animations: "disabled" });
    }
    console.log("PASS navigation: direct destinations, shared SVG icon size, typography, spacing and highlights at 320/390/844/1280px");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await go("overview");
    const length = await page.evaluate(() => history.length);
    await go("report");
    await noMenu();
    assert.equal(await page.evaluate(() => history.length), length + 1, "Only the report page is added to history");
    await page.goBack();
    await waitPage("overview");
    await page.goForward();
    await waitPage("report");
    await noMenu();
    await page.locator("#rdReportItineraryTab").click();
    assert(await page.locator("#rdReportItinerary").isVisible());
    await page.locator("#rdReportExpenseTab").click();
    assert(await page.locator("#rdReportExpenses").isVisible());
    await page.locator('#reportPage [data-rd-action="pdf-full"]').click();
    await page.waitForFunction(() => document.querySelector("#rdPdf")?.open && !document.querySelector("#exSave")?.disabled && document.querySelector("#exPreview .ex-paper"));
    await page.locator('#rdPdf [data-ex-action="close"]').click();
    await page.locator("#rdPdf").waitFor({ state: "hidden" });
    await go("itinerary");
    await page.locator('#itineraryList .timeline-edit[data-itinerary-action="edit"]').first().click();
    await page.locator("#itineraryEditor").waitFor();
    await page.locator("#itineraryExtraDetails > summary").click();
    await page.locator("#itineraryMemoInput").fill("\uC800\uC7A5\uD558\uC9C0 \uC54A\uC740 \uD3B8\uC9D1 \uB0B4\uC6A9");
    await page.locator('#itineraryEditor .tl-bottom-nav [data-trip-nav="report"]').click();
    await waitPage("report");
    await noMenu();
    await page.locator("#itineraryEditor").waitFor({ state: "hidden" });
    assert.deepEqual(await data(), baseline, "Direct navigation never submits an unfinished itinerary");
    for (const [key, title] of [["today", "\uC624\uB298\uC758 \uC5EC\uD589"], ["wallet", "\uC608\uC57D \uC9C0\uAC11"], ["tools", "\uC5EC\uD589 \uB3C4\uAD6C"]]) {
      await go("travel");
      await page.getByRole("tab", { name: title, exact: true }).click();
      assert.equal(await page.locator("#ttCompanionTitle").innerText(), title);
      assert.equal(await page.locator(".tl-bottom-nav:visible").count(), 1);
      assert.equal(new URL(page.url()).searchParams.get("travelTab"), key);
    }
    await page.reload();
    await waitForApp(page);
    assert.equal(await page.getByRole("tab", { name: "\uC5EC\uD589 \uB3C4\uAD6C", exact: true }).getAttribute("aria-selected"), "true");
    await page.getByRole("tab", { name: "\uC5EC\uD589 \uB3C4\uAD6C", exact: true }).focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.getByRole("tab", { name: "\uC608\uC57D \uC9C0\uAC11", exact: true }).getAttribute("aria-selected"), "true");
    await page.locator("#rdMenuButton").click();
    await waitPage("settings");
    await page.goBack();
    await waitPage("travel");
    assert.equal(await page.getByRole("tab", { name: "\uC608\uC57D \uC9C0\uAC11", exact: true }).getAttribute("aria-selected"), "true");
    await go("budget");
    await page.locator('#budgetPage [data-rd-action="nav-settlement"]').click();
    await waitPage("settlement");
    assert.equal(await tab("budget").getAttribute("aria-current"), "page");
    await go("budget");
    await page.locator('#budgetPage [data-rd-action="expense-new"]:visible').first().click();
    await page.locator("#rdExpenseEditor").waitFor();
    await page.locator('#rdExpenseEditor .rd-dialog-head [data-rd-action="close"]').click();
    await page.locator("#rdExpenseEditor").waitFor({ state: "hidden" });
    await page.locator('#budgetPage [data-rd-action="receipt-start"]').click();
    await page.locator("#receiptDialog").waitFor();
    await page.locator("#receiptCloseButton").click();
    if (await page.locator("#rdExpenseEditor").isVisible()) await page.locator('#rdExpenseEditor .rd-dialog-head [data-rd-action="close"]').click();
    await page.evaluate(() => {
      const click = (name) => document.querySelector(`.rd-nav [data-trip-nav="${name}"]`).click();
      click("report");
      click("budget");
      click("itinerary");
    });
    await waitPage("itinerary");
    await noMenu();
    await page.locator("#rdMenuButton").click();
    await waitPage("settings");
    await go("overview");
    await page.evaluate(() => history.replaceState({ ...history.state, tripNavigation: { group: "report", tripId: state.id } }, "", location.href));
    await page.reload();
    await waitForApp(page);
    await noMenu();
    assert.deepEqual(await data(), baseline);
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleIssues, []);
    fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify({ origin, browser: "isolated Edge/Playwright", layouts, errors, consoleIssues, checks: ["five direct destinations", "travel alignment", "no menus/history/scroll lock", "Back/Forward", "report tabs/PDF", "editor preservation", "travel reload/keyboard", "expense actions and settlement", "rapid navigation", "legacy menu-marker cleanup", "data preservation"] }, null, 2));
    console.log("PASS navigation: Back/Forward, report tabs/PDF, editor data, travel reload/keyboard, expense actions, fast taps, legacy history cleanup and clean runtime");
    await context.close();
  } finally {
    await browser.close();
    await stopServer(server);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
