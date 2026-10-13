(() => {
  const scriptVersion = document.querySelector('meta[name="triplog-build"]')?.content || "development";
  const scriptFiles = [
    { path: "../../vendor/supabase-js-2.107.0.min.js", optional: true },
    { path: "../../vendor/yjs-13.6.32.min.js", optional: true },
    { path: "../../vendor/leaflet-1.9.4/leaflet.js", optional: true },
    "core/namespace.js",
    "data/expense-categories.js",
    "core/config.js",
    "core/runtime.js",
    "shared/itinerary-order.js",
    "shared/map-links.js",
    "sync/model.js",
    "sync/repository.js",
    "sync/engine.js",
    "sync/controller.js",
    "sync/presentation.js",
    "sync/status-ui.js",
    "sync/notes.js",
    "sync/comments.js",
    "sync/drafts.js",
    "sync/lifecycle.js",
    "sync/backup.js",
    "data/countries.js",
    "data/destination-scenes.js",
    "shared/destination-scenes.js",
    "bootstrap/init.js",
    "persistence/state-storage.js",
    "persistence/archive-db.js",
    "features/settings/theme-toggle.js",
    "features/history/history-store.js",
    "features/history/history-modal.js",
    "navigation/page-router.js",
    "navigation/trip-dates.js",
    "features/expenses/expense-form.js",
    "features/expenses/receipt-parser.js",
    "features/expenses/receipt-json.js",
    "features/expenses/receipt-ocr.js",
    "features/expenses/receipt-input.js",
    "features/expenses/currency-controls.js",
    "features/expenses/lodging.js",
    "features/expenses/pretrip-purchases.js",
    "ui/dialog.js",
    "ui/cost-summary.js",
    "ui/date-picker.js",
    "ui/time-wheel.js",
    "ui/time-picker.js",
    "ui/custom-select.js",
    "ui/form-controls.js",
    "features/render/main-render.js",
    "features/history/history-render.js",
    "features/itinerary/itinerary-render.js",
    "features/itinerary/drag-preview.js",
    "features/itinerary/pointer-drag.js",
    "features/itinerary/itinerary-summary.js",
    "features/itinerary/list-actions.js",
    "features/itinerary/transit-editor.js",
    "features/itinerary/place-search.js",
    "features/itinerary/itinerary-form.js",
    "features/itinerary/map-preview.js",
    "features/itinerary/itinerary-workspace.js",
    "features/history/history-actions.js",
    "ui/day-strip.js",
    "features/expenses/expense-table.js",
    "features/expenses/entry-actions.js",
    "features/dev/sample-data.js",
    "shared/travel-costs.js",
    "data/itinerary-art.js",
    "shared/itinerary-art.js",
    "features/print/report-model.js",
    "features/print/print-export.js",
    "features/print/itinerary-table.js",
    "features/print/export-studio.js",
    "shared/factories.js",
    "shared/currency.js",
    "shared/totals.js",
    "shared/date-time.js",
    "shared/formatters.js",
    "features/collaboration/trip-collaboration.js",
    "features/packing/packing-defaults.js",
    "features/packing/packing-list.js",
    "services/maps/query-utils.js",
    "shared/time-utils.js",
    "services/maps/leaflet-map.js",
    "services/maps/geocoding.js",
    "services/maps/domestic-route.js",
    "services/maps/domestic-map.js",
    "features/settings/map-geocoding-settings.js",
    "services/maps/routing.js",
    "features/overview/overview-card.js",
    "features/overview/reservation-pockets.js",
    "features/overview/trip-hero.js",
    "features/settlement/settlement-formatting.js",
    "features/settlement/settlement-sources.js",
    "features/settlement/settlement-model.js",
    "features/settlement/settlement-render.js",
    "features/settlement/companions.js",
    "features/redesign/design-model.js",
    "features/overview/travel-cost-card.js",
    "ui/markup.js",
    "ui/trip-context.js",
    "features/overview/overview-workspace.js",
    "features/settlement/settlement-workspace.js",
    "features/reports/report-workspace.js",
    "features/packing/packing-workspace.js",
    "features/redesign/design-workspace.js",
    "features/home/trip-library.js",
    "features/expenses/reservation-expense-editor.js",
    "features/expenses/expense-workspace.js",
    "features/travel-companion/model.js",
    "features/travel-companion/workspace.js",
    "bootstrap/navigation-events.js",
    "bootstrap/start.js",
  ];

  const currentScript = document.currentScript;
  const baseUrl = new URL("./src/app/", currentScript?.src || window.location.href);
  // Download together; classic scripts with async=false still execute in order.
  const loading = scriptFiles.map((entry) => {
    const file = typeof entry === "string" ? entry : entry.path;
    const optional = typeof entry === "object" && entry.optional;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = false;
      script.src = `${new URL(file, baseUrl).toString()}?v=${scriptVersion}`;
      script.onload = resolve;
      script.onerror = () => {
        if (optional) {
          resolve();
          return;
        }
        reject(new Error(`TripLOG script load failed: ${file}`));
      };
      document.head.appendChild(script);
    });
  });

  Promise.all(loading).then(() => {
    document.documentElement.dataset.appReady = "true";
  }).catch((error) => {
    document.documentElement.dataset.appReady = "error";
    const status = document.querySelector("#authGateStatus");
    if (status) status.textContent = "화면을 불러오지 못했어요. 새로고침해 주세요.";
    console.error(error);
  });
})();
