/* Generated app shell. Never cache account/API responses. */
const CACHE = __CACHE_NAME__;
const BUILD = __BUILD_ID__;
const ASSETS = __ASSETS__;
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
