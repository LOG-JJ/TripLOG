(() => {
  const scriptVersion = "time-picker-reuse-20260908-1";
  const scriptFiles = [
    { path: "../../vendor/supabase-js-2.107.0.min.js", optional: true },
    "core/namespace.js",
    "core/config.js",
    "core/runtime.js",
    "data/countries.js",
    "bootstrap/init.js",
    "persistence/state-storage.js",
    "persistence/archive-db.js",
    "features/settings/theme-toggle.js",
    "features/history/history-store.js",
    "features/history/history-modal.js",
    "navigation/page-router.js",
    "navigation/trip-dates.js",
    "features/expenses/expense-form.js",
    "features/settings/travel-mode.js",
    "features/expenses/currency-controls.js",
    "features/expenses/lodging.js",
    "features/expenses/pretrip-purchases.js",
    "ui/date-picker.js",
    "ui/time-picker.js",
    "ui/custom-select.js",
    "features/reports/donut-events.js",
    "features/render/main-render.js",
    "features/history/history-render.js",
    "features/itinerary/itinerary-render.js",
    "features/itinerary/list-actions.js",
    "features/itinerary/place-search.js",
    "features/itinerary/itinerary-form.js",
    "features/itinerary/map-preview.js",
    "features/history/history-actions.js",
    "ui/day-strip.js",
    "features/expenses/expense-table.js",
    "features/reports/category-summary.js",
    "features/expenses/entry-actions.js",
    "features/dev/sample-data.js",
    "features/print/print-export.js",
    "shared/factories.js",
    "shared/currency.js",
    "shared/svg-geometry.js",
    "shared/totals.js",
    "shared/date-time.js",
    "shared/formatters.js",
    "features/collaboration/trip-collaboration.js",
    "features/overview/budget-dashboard.js",
    "features/reports/daily-trend.js",
    "features/reports/stats-insights.js",
    "features/packing/packing-defaults.js",
    "features/itinerary/time-views.js",
    "features/packing/packing-list.js",
    "services/maps/query-utils.js",
    "shared/time-utils.js",
    "services/maps/leaflet-map.js",
    "services/maps/geocoding.js",
    "features/settings/map-geocoding-settings.js",
    "services/maps/routing.js",
    "features/overview/overview-page.js",
    "features/reports/report-page.js",
    "features/settlement/settlement-formatting.js",
    "features/settlement/settlement-sources.js",
    "features/settlement/settlement-model.js",
    "features/settlement/settlement-render.js",
    "features/settlement/companions.js",
    "bootstrap/navigation-events.js",
    "bootstrap/start.js",
  ];

  const currentScript = document.currentScript;
  const baseUrl = new URL("./src/app/", currentScript?.src || window.location.href);
  let chain = Promise.resolve();

  scriptFiles.forEach((entry) => {
    const file = typeof entry === "string" ? entry : entry.path;
    const optional = typeof entry === "object" && entry.optional;
    chain = chain.then(() => new Promise((resolve, reject) => {
      const script = document.createElement("script");
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
    }));
  });

  chain.catch((error) => {
    console.error(error);
  });
})();
