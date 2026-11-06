/* Generated app shell. Never cache account/API responses. */
const CACHE = "triplog-shell-78a1dd4b4f35f47b7693";
const BUILD = "78a1dd4b4f35f47b7693";
const ASSETS = ["/Travel.html","/app.js","/apple-touch-icon.png","/favicon-32.png","/icons/apple-touch-icon-120-ffe3822b855d.png","/icons/apple-touch-icon-152-f638d0b8522d.png","/icons/apple-touch-icon-167-b9945ddee33d.png","/icons/apple-touch-icon-180-76ffa94052a4.png","/icons/cost-summary-wallet.png","/icons/triplog-icon-120.png","/icons/triplog-icon-152.png","/icons/triplog-icon-167.png","/icons/triplog-icon-180.png","/icons/triplog-icon-192.png","/icons/triplog-icon-512.png","/index.html","/site.webmanifest","/src/app/bootstrap/entry-splash.js","/src/app/bootstrap/init.js","/src/app/bootstrap/navigation-events.js","/src/app/bootstrap/start.js","/src/app/core/config.js","/src/app/core/namespace.js","/src/app/core/runtime.js","/src/app/data/countries.js","/src/app/data/destination-scenes.js","/src/app/data/expense-categories.js","/src/app/data/itinerary-art.js","/src/app/data/service-config.js","/src/app/domain/commands.js","/src/app/features/collaboration/trip-collaboration.js","/src/app/features/dev/sample-data.js","/src/app/features/expenses/currency-controls.js","/src/app/features/expenses/entry-actions.js","/src/app/features/expenses/expense-allocation.js","/src/app/features/expenses/expense-form.js","/src/app/features/expenses/expense-table.js","/src/app/features/expenses/expense-workspace.js","/src/app/features/expenses/lodging.js","/src/app/features/expenses/pretrip-purchases.js","/src/app/features/expenses/receipt-input.js","/src/app/features/expenses/receipt-json.js","/src/app/features/expenses/receipt-ocr.js","/src/app/features/expenses/receipt-parser.js","/src/app/features/expenses/reservation-expense-editor.js","/src/app/features/history/history-actions.js","/src/app/features/history/history-modal.js","/src/app/features/history/history-render.js","/src/app/features/history/history-store.js","/src/app/features/home/trip-library.js","/src/app/features/itinerary/dnd-drag.js","/src/app/features/itinerary/drag-motion.js","/src/app/features/itinerary/editor-tools.js","/src/app/features/itinerary/itinerary-form.js","/src/app/features/itinerary/itinerary-render.js","/src/app/features/itinerary/itinerary-summary.js","/src/app/features/itinerary/itinerary-workspace.js","/src/app/features/itinerary/list-actions.js","/src/app/features/itinerary/map-preview.js","/src/app/features/itinerary/place-search.js","/src/app/features/itinerary/transit-editor.js","/src/app/features/overview/overview-card.js","/src/app/features/overview/overview-workspace.js","/src/app/features/overview/reservation-pockets.js","/src/app/features/overview/travel-cost-card.js","/src/app/features/overview/trip-hero.js","/src/app/features/packing/packing-defaults.js","/src/app/features/packing/packing-list.js","/src/app/features/packing/packing-workspace.js","/src/app/features/print/export-studio.js","/src/app/features/print/itinerary-table.js","/src/app/features/print/print-export.js","/src/app/features/print/report-model.js","/src/app/features/redesign/design-model.js","/src/app/features/redesign/design-workspace.js","/src/app/features/render/main-render.js","/src/app/features/reports/report-workspace.js","/src/app/features/settings/map-geocoding-settings.js","/src/app/features/settings/theme-toggle.js","/src/app/features/settlement/companions.js","/src/app/features/settlement/settlement-formatting.js","/src/app/features/settlement/settlement-model.js","/src/app/features/settlement/settlement-render.js","/src/app/features/settlement/settlement-sources.js","/src/app/features/settlement/settlement-workspace.js","/src/app/features/travel-companion/experience-view.js","/src/app/features/travel-companion/model.js","/src/app/features/travel-companion/reservation-payment.js","/src/app/features/travel-companion/tools-model.js","/src/app/features/travel-companion/tools-view.js","/src/app/features/travel-companion/tools-workspace.js","/src/app/features/travel-companion/workspace.js","/src/app/navigation/page-router.js","/src/app/navigation/trip-dates.js","/src/app/navigation/trip-navigation.js","/src/app/persistence/archive-db.js","/src/app/persistence/state-storage.js","/src/app/services/maps/domestic-map.js","/src/app/services/maps/domestic-route.js","/src/app/services/maps/geocoding.js","/src/app/services/maps/query-utils.js","/src/app/shared/currency.js","/src/app/shared/date-time.js","/src/app/shared/destination-scenes.js","/src/app/shared/expense-allocation.js","/src/app/shared/expense-order.js","/src/app/shared/factories.js","/src/app/shared/formatters.js","/src/app/shared/itinerary-art.js","/src/app/shared/itinerary-order.js","/src/app/shared/map-links.js","/src/app/shared/time-utils.js","/src/app/shared/totals.js","/src/app/shared/travel-costs.js","/src/app/sync/backup.js","/src/app/sync/comments.js","/src/app/sync/controller.js","/src/app/sync/drafts.js","/src/app/sync/engine.js","/src/app/sync/lifecycle.js","/src/app/sync/model.js","/src/app/sync/notes.js","/src/app/sync/presentation.js","/src/app/sync/repository.js","/src/app/sync/settlement-model.js","/src/app/sync/status-ui.js","/src/app/ui/confirmation.js","/src/app/ui/cost-summary.js","/src/app/ui/custom-select.js","/src/app/ui/date-picker.js","/src/app/ui/day-strip.js","/src/app/ui/dialog.js","/src/app/ui/expense-allocation-editor.js","/src/app/ui/expense-ledger.js","/src/app/ui/form-controls.js","/src/app/ui/markup.js","/src/app/ui/sortable-list.js","/src/app/ui/time-picker.js","/src/app/ui/time-wheel.js","/src/app/ui/trip-context.js","/src/assets/archive-box.png","/src/assets/companion-passport-cover.png","/src/assets/companion-passport-sketch.png","/src/assets/companion-ticket-edge.png","/src/assets/google-maps-icon.png","/src/assets/home-passport-blue.webp","/src/assets/home-passport-generic.webp","/src/assets/home-passport-mint.webp","/src/assets/home-passport-new.webp","/src/assets/home-passport-pink.webp","/src/assets/itinerary-art/v1/airport.webp","/src/assets/itinerary-art/v1/aquarium.webp","/src/assets/itinerary-art/v1/bakery.webp","/src/assets/itinerary-art/v1/bar.webp","/src/assets/itinerary-art/v1/beach.webp","/src/assets/itinerary-art/v1/bicycle.webp","/src/assets/itinerary-art/v1/bus.webp","/src/assets/itinerary-art/v1/cafe.webp","/src/assets/itinerary-art/v1/camping.webp","/src/assets/itinerary-art/v1/car.webp","/src/assets/itinerary-art/v1/castle.webp","/src/assets/itinerary-art/v1/cave.webp","/src/assets/itinerary-art/v1/church.webp","/src/assets/itinerary-art/v1/desert.webp","/src/assets/itinerary-art/v1/ferry.webp","/src/assets/itinerary-art/v1/forest.webp","/src/assets/itinerary-art/v1/gallery.webp","/src/assets/itinerary-art/v1/garden.webp","/src/assets/itinerary-art/v1/hiking.webp","/src/assets/itinerary-art/v1/hostel.webp","/src/assets/itinerary-art/v1/hotel.webp","/src/assets/itinerary-art/v1/island.webp","/src/assets/itinerary-art/v1/lake.webp","/src/assets/itinerary-art/v1/mall.webp","/src/assets/itinerary-art/v1/market.webp","/src/assets/itinerary-art/v1/monument.webp","/src/assets/itinerary-art/v1/mosque.webp","/src/assets/itinerary-art/v1/mountain.webp","/src/assets/itinerary-art/v1/museum.webp","/src/assets/itinerary-art/v1/oldtown.webp","/src/assets/itinerary-art/v1/resort.webp","/src/assets/itinerary-art/v1/restaurant.webp","/src/assets/itinerary-art/v1/shopping.webp","/src/assets/itinerary-art/v1/shrine.webp","/src/assets/itinerary-art/v1/sightseeing.webp","/src/assets/itinerary-art/v1/snow.webp","/src/assets/itinerary-art/v1/stadium.webp","/src/assets/itinerary-art/v1/temple.webp","/src/assets/itinerary-art/v1/theater.webp","/src/assets/itinerary-art/v1/theme-park.webp","/src/assets/itinerary-art/v1/tower.webp","/src/assets/itinerary-art/v1/train.webp","/src/assets/itinerary-art/v1/transport.webp","/src/assets/itinerary-art/v1/travel.webp","/src/assets/itinerary-art/v1/urban.webp","/src/assets/itinerary-art/v1/walk.webp","/src/assets/itinerary-art/v1/waterfall.webp","/src/assets/itinerary-art/v1/wellness.webp","/src/assets/itinerary-art/v1/wetland.webp","/src/assets/itinerary-art/v1/zoo.webp","/src/assets/login-travel.png","/src/assets/navigation/calendar-blank.svg","/src/assets/navigation/chart-bar.svg","/src/assets/navigation/house.svg","/src/assets/navigation/suitcase-rolling.svg","/src/assets/navigation/wallet.svg","/src/assets/noto-emoji/LICENSE","/src/assets/noto-emoji/NOTICE","/src/assets/noto-emoji/emoji_u1f30a.svg","/src/assets/noto-emoji/emoji_u1f332.svg","/src/assets/noto-emoji/emoji_u1f337.svg","/src/assets/noto-emoji/emoji_u1f33e.svg","/src/assets/noto-emoji/emoji_u1f377.svg","/src/assets/noto-emoji/emoji_u1f37d.svg","/src/assets/noto-emoji/emoji_u1f3a1.svg","/src/assets/noto-emoji/emoji_u1f3a8.svg","/src/assets/noto-emoji/emoji_u1f3ad.svg","/src/assets/noto-emoji/emoji_u1f3bf.svg","/src/assets/noto-emoji/emoji_u1f3d6.svg","/src/assets/noto-emoji/emoji_u1f3d8.svg","/src/assets/noto-emoji/emoji_u1f3d9.svg","/src/assets/noto-emoji/emoji_u1f3db.svg","/src/assets/noto-emoji/emoji_u1f3dc.svg","/src/assets/noto-emoji/emoji_u1f3dd.svg","/src/assets/noto-emoji/emoji_u1f3df.svg","/src/assets/noto-emoji/emoji_u1f3e0.svg","/src/assets/noto-emoji/emoji_u1f3e8.svg","/src/assets/noto-emoji/emoji_u1f3ea.svg","/src/assets/noto-emoji/emoji_u1f3ec.svg","/src/assets/noto-emoji/emoji_u1f3f0.svg","/src/assets/noto-emoji/emoji_u1f420.svg","/src/assets/noto-emoji/emoji_u1f4a6.svg","/src/assets/noto-emoji/emoji_u1f4cd.svg","/src/assets/noto-emoji/emoji_u1f54c.svg","/src/assets/noto-emoji/emoji_u1f5fc.svg","/src/assets/noto-emoji/emoji_u1f5fd.svg","/src/assets/noto-emoji/emoji_u1f686.svg","/src/assets/noto-emoji/emoji_u1f68c.svg","/src/assets/noto-emoji/emoji_u1f697.svg","/src/assets/noto-emoji/emoji_u1f6b2.svg","/src/assets/noto-emoji/emoji_u1f6b6.svg","/src/assets/noto-emoji/emoji_u1f6cd.svg","/src/assets/noto-emoji/emoji_u1f6d5.svg","/src/assets/noto-emoji/emoji_u1f950.svg","/src/assets/noto-emoji/emoji_u1f97e.svg","/src/assets/noto-emoji/emoji_u1f981.svg","/src/assets/noto-emoji/emoji_u1f9f3.svg","/src/assets/noto-emoji/emoji_u1faa8.svg","/src/assets/noto-emoji/emoji_u2615.svg","/src/assets/noto-emoji/emoji_u2668.svg","/src/assets/noto-emoji/emoji_u26e9.svg","/src/assets/noto-emoji/emoji_u26ea.svg","/src/assets/noto-emoji/emoji_u26f0.svg","/src/assets/noto-emoji/emoji_u26f4.svg","/src/assets/noto-emoji/emoji_u26fa.svg","/src/assets/noto-emoji/emoji_u2708.svg","/src/assets/noto-emoji/emoji_u2728.svg","/src/assets/reservation-summary-hotel.webp","/src/assets/reservation-summary-plane.webp","/src/assets/seoul-tower.png","/src/assets/travel-tickets.png","/src/assets/trip-context-landscape.png","/src/assets/trip-scenes/themes/v2/coast-mobile.webp","/src/assets/trip-scenes/themes/v2/coast.webp","/src/assets/trip-scenes/themes/v2/desert-mobile.webp","/src/assets/trip-scenes/themes/v2/desert.webp","/src/assets/trip-scenes/themes/v2/forest-mobile.webp","/src/assets/trip-scenes/themes/v2/forest.webp","/src/assets/trip-scenes/themes/v2/island-mobile.webp","/src/assets/trip-scenes/themes/v2/island.webp","/src/assets/trip-scenes/themes/v2/lake-mobile.webp","/src/assets/trip-scenes/themes/v2/lake.webp","/src/assets/trip-scenes/themes/v2/mountain-mobile.webp","/src/assets/trip-scenes/themes/v2/mountain.webp","/src/assets/trip-scenes/themes/v2/traditional-mobile.webp","/src/assets/trip-scenes/themes/v2/traditional.webp","/src/assets/trip-scenes/themes/v2/travel-mobile.webp","/src/assets/trip-scenes/themes/v2/travel.webp","/src/assets/trip-scenes/themes/v2/urban-mobile.webp","/src/assets/trip-scenes/themes/v2/urban.webp","/src/assets/trip-scenes/themes/v2/wetland-mobile.webp","/src/assets/trip-scenes/themes/v2/wetland.webp","/src/assets/triplog-wordmark.png","/src/assets/wallet-passbook-flight-stamp.png","/src/assets/wallet-passbook-greeting.png","/src/assets/wallet-passbook-notch.png","/src/entry/redirect.js","/src/entry/repair.js","/src/styles/companion-experience.css","/src/styles/companion-passport.css","/src/styles/controls.css","/src/styles/entry-splash.css","/src/styles/expense-polish.css","/src/styles/expenses.css","/src/styles/interactions.css","/src/styles/itinerary-drag.css","/src/styles/itinerary-place-sheet.css","/src/styles/itinerary-summary.css","/src/styles/itinerary.css","/src/styles/overview-cards.css","/src/styles/page-heading.css","/src/styles/planning.css","/src/styles/prepurchase.css","/src/styles/print-export.css","/src/styles/receipt.css","/src/styles/redesign.css","/src/styles/reports.css","/src/styles/reservation-pockets.css","/src/styles/reservation-wallet.css","/src/styles/settlement.css","/src/styles/sync.css","/src/styles/transit-editor.css","/src/styles/travel-companion.css","/src/styles/travel-costs.css","/src/styles/travel-tools.css","/src/styles/trip-context.css","/src/styles/trip-hero.css","/src/styles/trip-library.css","/src/styles/trip-navigation.css","/src/styles/typography.css","/src/styles/wallet-passbook.css","/styles.css","/vendor/dnd-kit-LICENSES.txt","/vendor/dnd-kit-NOTICE.txt","/vendor/dnd-kit-dom-0.5.1.min.js","/vendor/heroicons-cloud/LICENSE","/vendor/heroicons-cloud/NOTICE.txt","/vendor/heroicons-cloud/cloud.svg","/vendor/leaflet-1.9.4/LICENSE","/vendor/leaflet-1.9.4/SHA256SUMS.txt","/vendor/leaflet-1.9.4/images/layers-2x.png","/vendor/leaflet-1.9.4/images/layers.png","/vendor/leaflet-1.9.4/images/marker-icon-2x.png","/vendor/leaflet-1.9.4/images/marker-icon.png","/vendor/leaflet-1.9.4/images/marker-shadow.png","/vendor/leaflet-1.9.4/leaflet.css","/vendor/leaflet-1.9.4/leaflet.js","/vendor/motion-14.3.0.min.js","/vendor/motion-LICENSES.txt","/vendor/phosphor-2.1.1/LICENSE","/vendor/phosphor-2.1.1/NOTICE.md","/vendor/phosphor-2.1.1/Phosphor.woff2","/vendor/phosphor-2.1.1/map-pin.svg","/vendor/phosphor-2.1.1/regular.css","/vendor/pretendard-1.3.9/LICENSE","/vendor/pretendard-1.3.9/NOTICE.md","/vendor/pretendard-1.3.9/PretendardVariable.woff2","/vendor/receipt-ocr/HEIC2ANY-LICENSE.md","/vendor/receipt-ocr/NOTICE.md","/vendor/receipt-ocr/SHA256SUMS.txt","/vendor/receipt-ocr/TESSERACT-LICENSE.md","/vendor/receipt-ocr/core-6.1.2/LICENSE","/vendor/receipt-ocr/core-6.1.2/tesseract-core-lstm.wasm.js","/vendor/receipt-ocr/core-6.1.2/tesseract-core-simd-lstm.wasm.js","/vendor/receipt-ocr/heic2any-0.0.4.min.js","/vendor/receipt-ocr/lang/LICENSE","/vendor/receipt-ocr/lang/eng.traineddata.gz","/vendor/receipt-ocr/lang/jpn.traineddata.gz","/vendor/receipt-ocr/lang/kor.traineddata.gz","/vendor/receipt-ocr/tesseract-6.0.1.min.js","/vendor/receipt-ocr/tesseract.min.js.LICENSE.txt","/vendor/receipt-ocr/worker-6.0.1.min.js","/vendor/receipt-ocr/worker.min.js.LICENSE.txt","/vendor/supabase-js-2.107.0.min.js","/vendor/travel-tools-LICENSES.txt","/vendor/travel-tools.min.js","/vendor/yjs-13.6.32.min.js","/vendor/yjs-LICENSE.txt"];
// Versioned public illustrations use an independent, bounded, on-demand cache.
// App code and account/API responses continue to follow the existing rules.
const SCENE_CACHE = 'triplog-destination-scenes-v1';
const SCENE_LIMIT = 48;
const CITY_SCENE_PATH = /^\/src\/assets\/trip-scenes\/cities\/v\d+\/[a-z0-9-]+\.webp$/;
let sceneWrites = Promise.resolve();
async function citySceneResponse(request) {
  const key = new URL(request.url).pathname;
  let cache;
  try {
    cache = await caches.open(SCENE_CACHE);
    const cached = await cache.match(key);
    if (cached) return cached;
  } catch (_) { /* Optional cache storage never prevents a network image. */ }
  let response;
  try { response = await fetch(request); } catch (_) { return Response.error(); }
  // Static hosting may return a 200 HTML fallback for an absent file. Never put
  // that response in the image cache; let the component choose its bundled theme.
  if (!response.ok || !/^image\//i.test(response.headers.get('content-type') || '')) return Response.error();
  if (cache) {
    const copy = response.clone();
    sceneWrites = sceneWrites.catch(() => {}).then(async () => {
      try {
        await cache.put(key, copy);
        const keys = await cache.keys();
        for (const stale of keys.slice(0, Math.max(0, keys.length - SCENE_LIMIT))) await cache.delete(stale);
      } catch (_) { /* Quota/private-mode failures do not hide the loaded image. */ }
    });
    await sceneWrites;
  }
  return response;
}
const clientBuilds = new Map();
async function cleanUnusedBuilds() {
  if (self.registration.installing || self.registration.waiting) return;
  const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  // An older tab may still be loading or editing. Keep its complete app until it
  // identifies its build or closes; never mix its modules with a newer shell.
  if (pages.some(page => !clientBuilds.has(page.id))) return;
  const used = new Set([CACHE, ...pages.map(page => `triplog-shell-${clientBuilds.get(page.id)}`)]);
  const installed = await (await caches.open(CACHE)).match('/__triplog_installed__');
  const ownTime = installed ? Number(await installed.text()) : 0;
  for (const name of await caches.keys()) {
    if (!name.startsWith('triplog-shell-') || used.has(name)) continue;
    const candidate = await (await caches.open(name)).match('/__triplog_installed__');
    // A still-finishing event from an old worker must never collect a newer
    // worker's cache, including one being installed concurrently.
    if (candidate && Number(await candidate.text()) < ownTime) await caches.delete(name);
  }
  for (const id of clientBuilds.keys()) if (!pages.some(page => page.id === id)) clientBuilds.delete(id);
}
// Pages canonicalizes .html URLs. Rebuild a followed redirect before returning
// it to a navigation request whose redirect mode is "manual" (Chrome ERR_FAILED).
function navigationResponse(response) {
  if (!response.redirected) return response;
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(path => new Request(path, { cache: 'reload' })));
    for (const path of ['/Travel.html', '/index.html']) {
      const response = await cache.match(path);
      if (response?.redirected) await cache.put(path, navigationResponse(response));
    }
    await cache.put('/__triplog_installed__', new Response(String(Date.now())));
    // Activate only after the complete shell is cached. Existing documents keep
    // their inputs and running code; the next navigation uses the safe new build.
    // Waiting for every phone/desktop tab to close left unsafe writers alive.
    await self.skipWaiting();
  })());
});
self.addEventListener('message', event => {
  if (['TRIPLOG_REPAIR_NAVIGATION', 'TRIPLOG_ACTIVATE_UPDATE'].includes(event.data?.type)) event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'TRIPLOG_GET_BUILD') {
    if (event.source?.id && /^[a-f0-9]{20}$/.test(event.data.build || '')) clientBuilds.set(event.source.id, event.data.build);
    event.ports[0]?.postMessage({ type: 'TRIPLOG_BUILD', build: BUILD });
    event.waitUntil(cleanUnusedBuilds());
  }
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Remove the known broken navigation cache without evicting healthy builds
    // still used by open editors in another tab.
    for (const name of await caches.keys()) {
      if (!name.startsWith('triplog-shell-') || name === CACHE) continue;
      const previous = await (await caches.open(name)).match('/Travel.html');
      if (previous?.redirected) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (CITY_SCENE_PATH.test(url.pathname)) {
    event.respondWith(citySceneResponse(request));
    return;
  }
  const route = ['/', '/Travel', '/Travel.html', '/index.html'].includes(url.pathname) && request.mode === 'navigate';
  if (!route && !ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    if (route && event.resultingClientId) clientBuilds.set(event.resultingClientId, BUILD);
    const requested = url.searchParams.get('v');
    if (!route && event.clientId && /^[a-f0-9]{20}$/.test(requested || '')) clientBuilds.set(event.clientId, requested);
    const version = route ? BUILD : clientBuilds.get(event.clientId) || BUILD;
    const name = `triplog-shell-${version}`;
    const cache = await caches.open((await caches.keys()).includes(name) ? name : CACHE);
    const cached = await cache.match(route ? '/Travel.html' : url.pathname, { ignoreSearch: true });
    if (cached) return route ? navigationResponse(cached) : cached;
    const response = await fetch(request);
    return route ? navigationResponse(response) : response;
  })());
});
