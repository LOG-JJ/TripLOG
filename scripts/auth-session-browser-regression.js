const { launchBrowser, startServer, stopServer } = require('./helpers/browser-fixture');
// Browser plugin not available: isolated Playwright/Edge fixtures use the shipped
// Supabase SDK. Every external request is mocked; no real credentials are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const authKey = 'sb-iehdziiplzgvxcrbizgv-auth-token';
const user = { id: '00000000-0000-4000-8000-000000000088', email: 'auth@example.test', user_metadata: { display_name: '로그인 검증' } };
function session(expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: expiresAt, role: 'authenticated' })).toString('base64url'), 'fixture'].join('.');
  return { access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: expiresAt, expires_in: 3600, user };
}
async function main() {
  const { server, origin } = await startServer();
  const browser = await launchBrowser();
  const sdk = fs.readFileSync(path.join(__dirname, '../vendor/supabase-js-2.107.0.min.js'), 'utf8');
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    context.setDefaultTimeout(12000);
    let refreshes = 0, mode = 'rate-limit-once';
    const refreshTimes = [], logoutScopes = [];
    await context.addInitScript(({ origin, authKey, stored }) => {
      if (location.origin !== origin || localStorage.getItem('auth-fixture')) return;
      localStorage.setItem('auth-fixture', '1');
      localStorage.setItem(authKey, JSON.stringify(stored));
    }, { origin, authKey, stored: session(Math.floor(Date.now() / 1000) - 60) });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/vendor/supabase-js-2.107.0.min.js')) {
        return route.fulfill({ contentType: 'application/javascript', body: sdk + `\nwindow.__authEvents=[];window.__clientCount=0;const originalCreateClient=supabase.createClient;supabase.createClient=(...args)=>{window.__clientCount++;const client=originalCreateClient(...args);window.__authClient=client;client.auth.onAuthStateChange((event)=>window.__authEvents.push(event));const subscribe=client.auth.onAuthStateChange.bind(client.auth);client.auth.onAuthStateChange=callback=>{window.__appAuthCallback=callback;return subscribe(callback);};return client;};` });
      }
      if (url.origin === origin) return route.continue();
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
        refreshes++;
        refreshTimes.push(Date.now());
        const headers = { 'Retry-After': '1', 'access-control-expose-headers': 'Retry-After, x-supabase-api-version', 'x-supabase-api-version': '2024-01-01' };
        if (mode === 'invalid') return route.fulfill({ status: 400, headers, json: { code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' } });
        if (mode === 'rate-limit-once' || mode === 'server-once') {
          const status = mode === 'rate-limit-once' ? 429 : 500;
          mode = 'success';
          return route.fulfill({ status, headers, json: { code: status === 429 ? 'over_request_rate_limit' : 'unexpected_failure', msg: 'Temporarily unavailable' } });
        }
        if (mode === 'network-once') { mode = 'success'; return route.abort(); }
        return route.fulfill({ json: session() });
      }
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') return route.fulfill({ json: session() });
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.pathname === '/auth/v1/logout') { logoutScopes.push(url.searchParams.get('scope')); return route.fulfill({ status: 204 }); }
      if (url.pathname === '/functions/v1/triplog-sync') return route.fulfill({ json: { protocolVersion: 2, trips: [] } });
      return route.abort();
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/Travel?page=itinerary');
    await page.waitForFunction(() => document.documentElement.dataset.auth === 'signed-in').catch(async error => {
      console.error({ refreshes, errors, state: await page.evaluate(() => ({ auth: document.documentElement.dataset.auth, status: document.querySelector('#authGateStatus')?.textContent, events: window.__authEvents, clients: window.__clientCount })) });
      throw error;
    });
    assert.equal(refreshes, 2, '429 must retry successfully rather than erase the session');
    assert(refreshTimes[1] - refreshTimes[0] >= 950, 'Retry-After prevents a request storm');
    assert.equal(await page.evaluate(() => window.__authEvents.includes('SIGNED_OUT')), false);
    assert.equal(await page.evaluate(key => Boolean(localStorage.getItem(key)), authKey), true);
    assert.deepEqual(errors, []);
    console.log('PASS auth: real SDK retains the refresh credential on HTTP 429 and signs in automatically');

    const signedIn = target => target.waitForFunction(() => document.documentElement.dataset.auth === 'signed-in');
    await page.waitForFunction(() => window.TripLog.sync.controller.getAccount()?.id);
    await page.evaluate(async () => {
      state.tripName = '로그인 보존 검증';
      state.itineraryItems.push({ id: 'auth-kept-place', date: state.startDate, place: '보존할 일정' });
      await saveAndRender();
      startItineraryEdit(state.itineraryItems.find(item => item.id === 'auth-kept-place'));
      document.querySelector('#itineraryExtraDetails').open = true;
    });
    await page.locator('#itineraryMemoInput').fill('갱신 중에도 유지할 초안');
    await page.waitForFunction(async () => (await window.TripLog.sync.drafts.list(state.id)).some(draft => draft.value.fields.itineraryMemoInput?.value === '갱신 중에도 유지할 초안'));
    for (const failure of ['server-once', 'network-once']) {
      mode = failure;
      const result = await page.evaluate(async () => {
        const { data, error } = await window.__authClient.auth.refreshSession();
        return { signedIn: Boolean(data.session), error: error?.code };
      });
      assert.equal(result.signedIn, true, `${failure} should recover through the SDK`);
      await signedIn(page);
      assert.equal(await page.locator('#itineraryMemoInput').inputValue(), '갱신 중에도 유지할 초안');
    }
    assert.equal(await page.evaluate(() => window.__authEvents.includes('SIGNED_OUT')), false);
    console.log('PASS auth: HTTP 500 and network recovery keep the open place editor and saved draft');

    // Exercise the app-level error path separately from the SDK retry loop.
    await page.evaluate(async () => {
      const auth = window.__authClient.auth, original = auth.getSession;
      auth.getSession = async () => ({ data: { session: null }, error: new supabase.AuthRetryableFetchError('fixture offline', 0) });
      await window.TripLog.features.collaboration.tripCollaboration.syncSupabaseSession();
      auth.getSession = original;
    });
    await signedIn(page);
    assert.equal(await page.locator('#itineraryMemoInput').inputValue(), '갱신 중에도 유지할 초안');
    assert.equal(await page.evaluate(() => Boolean(window.TripLog.sync.controller.getAccount()?.id)), true);
    await page.evaluate(async () => {
      const sync = window.TripLog.features.collaboration.tripCollaboration.syncSupabaseSession;
      const checks = Array.from({ length: 20 }, () => sync());
      window.__singleFlight = checks.every(check => check === checks[0]);
      await Promise.all(checks);
    });
    assert.equal(await page.evaluate(() => window.__singleFlight && window.__clientCount === 1), true);
    console.log('PASS auth: temporary session-check errors preserve the account; 20 concurrent checks share one request');

    // A late invalid result must not destroy a newer login and its storage.
    await page.evaluate(() => {
      const auth = window.__authClient.auth, original = auth.getSession;
      auth.getSession = () => { auth.getSession = original; return new Promise(resolve => { window.__finishOldCheck = resolve; }); };
      window.__oldCheck = window.TripLog.features.collaboration.tripCollaboration.syncSupabaseSession();
    });
    await page.waitForFunction(() => Boolean(window.__finishOldCheck));
    await page.evaluate(async () => {
      await window.__authClient.auth.signInWithPassword({ email: 'auth@example.test', password: 'fixture-password' });
      window.__finishOldCheck({ data: { session: null }, error: { code: 'refresh_token_not_found', message: 'Invalid refresh token' } });
      await window.__oldCheck;
    });
    await signedIn(page);
    assert.equal(await page.evaluate(key => Boolean(localStorage.getItem(key)), authKey), true);
    assert.equal(await page.evaluate(() => window.__authEvents.includes('SIGNED_OUT')), false);
    console.log('PASS auth: a stale failed check cannot overwrite a fresh login or remove its token');

    // True revocation still locks the app; test drafts and trips after re-login.
    const preservedTripId = await page.evaluate(() => state.id);
    mode = 'invalid';
    await page.evaluate(() => window.__authClient.auth.refreshSession());
    await page.waitForFunction(() => document.documentElement.dataset.auth === 'locked');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), authKey), null);
    assert.match(await page.locator('#authGateStatus').innerText(), /다시 로그인/);
    mode = 'success';
    await page.locator('#authGateEmailInput').fill(user.email);
    await page.locator('#authGatePasswordInput').fill('fixture-password');
    await page.locator('#authGateSubmitButton').click();
    await signedIn(page);
    await page.waitForFunction(id => state.id === id && state.itineraryItems.some(item => item.id === 'auth-kept-place'), preservedTripId);
    assert.equal(await page.evaluate(async () => (await window.TripLog.sync.drafts.list(state.id)).some(draft => draft.value.fields.itineraryMemoInput?.value === '갱신 중에도 유지할 초안')), true);
    console.log('PASS auth: revoked sessions require login; successful login restores the same trip and draft');

    await page.goto(origin + '/Travel?page=itinerary&error=access_denied&error_description=fixture-expired-link');
    await signedIn(page);
    assert.equal(await page.evaluate(key => Boolean(localStorage.getItem(key)), authKey), true);
    assert.equal(new URL(page.url()).searchParams.has('error'), false);
    await page.evaluate(() => window.TripLog.features.collaboration.tripCollaboration.syncSupabaseSession());
    await page.evaluate(async () => {
      const auth = window.__authClient.auth, original = auth.getSession;
      window.__heldSessionResult = await auth.getSession();
      auth.getSession = () => { auth.getSession = original; return new Promise(resolve => { window.__releaseSessionCheck = resolve; }); };
      window.__pendingSessionCheck = window.TripLog.features.collaboration.tripCollaboration.syncSupabaseSession();
    });
    await page.waitForFunction(() => Boolean(window.__releaseSessionCheck));
    const recovery = session();
    const recoveryParams = new URLSearchParams({ access_token: recovery.access_token, refresh_token: recovery.refresh_token, type: 'recovery' });
    await page.goto(origin + '/Travel?page=itinerary#' + recoveryParams);
    await page.evaluate(async () => { window.__releaseSessionCheck(window.__heldSessionResult); await window.__pendingSessionCheck; });
    await page.waitForFunction(() => document.querySelector('#authGateTitle')?.textContent === '새 비밀번호 설정').catch(async error => {
      console.error(await page.evaluate(() => ({ title: document.querySelector('#authGateTitle')?.textContent, status: document.querySelector('#authGateStatus')?.textContent, events: window.__authEvents, hasFragment: Boolean(location.hash) })));
      throw error;
    });
    await page.locator('#authGatePasswordInput').fill('fixture-new-password');
    await page.locator('#authGatePasswordConfirmInput').fill('fixture-new-password');
    await page.locator('#authGateSubmitButton').click();
    await signedIn(page);
    assert.equal(await page.locator('#authGatePasswordInput').inputValue(), '');
    console.log('PASS auth: expired email links preserve a valid login; password recovery still completes');

    // Retiring a client must detach its listener and invalidate pending checks.
    await page.evaluate(() => { window.__retiredCallback = window.__appAuthCallback; window.__oldClient = window.__authClient; });
    // Use the real configuration-reset action, without changing project or account.
    await page.evaluate(() => document.querySelector('#authGateResetSupabaseButton').click());
    await page.waitForFunction(() => window.__clientCount === 2);
    await signedIn(page);
    await page.evaluate(() => window.__retiredCallback('SIGNED_OUT', null));
    await page.evaluate(() => window.TripLog.features.collaboration.tripCollaboration.syncSupabaseSession());
    await signedIn(page);
    assert.equal(await page.evaluate(key => Boolean(localStorage.getItem(key)), authKey), true);
    console.log('PASS auth: retired clients cannot log out the active connection');

    const secondTab = await context.newPage();
    await secondTab.goto(origin + '/Travel?page=itinerary');
    await signedIn(secondTab);
    await page.evaluate(() => document.querySelector('#settingsLogoutButton').click());
    await page.waitForFunction(() => document.documentElement.dataset.auth === 'locked');
    await secondTab.waitForFunction(() => document.documentElement.dataset.auth === 'locked');
    assert.deepEqual(logoutScopes, ['local'], 'Logout must not revoke other devices');
    assert.doesNotMatch(await page.locator('#authGateStatus').innerText(), /오래된|만료/);
    assert.equal(await page.evaluate(() => document.querySelector('#authGatePasswordInput').value), '');
    console.log('PASS auth: local logout reaches other tabs, clears password input and never claims an intentional logout expired');
    await page.locator('#authGateEmailInput').fill('another@example.test');
    await page.locator('#authGatePasswordInput').fill('fixture-password');
    await page.evaluate(() => window.TripLog.features.collaboration.tripCollaboration.syncSupabaseSession());
    assert.equal(await page.locator('#authGateEmailInput').inputValue(), 'another@example.test', 'Background checks must not replace typed credentials with the previous account');
    await page.locator('#authGatePasswordInput').fill('');
    const output = path.join(require('node:os').tmpdir(), 'TripLOG-auth-session-fixed-20260927.png');
    await page.screenshot({ path: output });
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
    await stopServer(server);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
