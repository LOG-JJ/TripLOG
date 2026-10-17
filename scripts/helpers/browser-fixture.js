const { chromium } = require('playwright');
const { createServer } = require('../serve-test');

function launchBrowser(options = {}) {
  return chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    ...options,
  });
}

function fixtureToken(user, expiry) {
  return [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: user.id, exp: expiry, role: 'authenticated' })).toString('base64url'),
    'fixture',
  ].join('.');
}

function blockExternalRequests(context, origin) {
  return context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
}

async function startServer(factory) {
  if (!factory && process.env.TRIPLOG_TEST_URL) return { server: null, origin: process.env.TRIPLOG_TEST_URL };
  const server = factory ? factory() : createServer({ pagesRedirects: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function stopServer(server) {
  return server?.listening ? new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) : Promise.resolve();
}

function seedTrip(context, { origin, user, expiry, token = fixtureToken(user, expiry), seed, marker = 'controls-seed' }) {
  return context.addInitScript(({ origin, user, expiry, token, seed, marker }) => {
    if (location.origin !== origin || localStorage.getItem(marker)) return;
    localStorage.setItem(marker, '1');
    localStorage.setItem('sb-iehdziiplzgvxcrbizgv-auth-token', JSON.stringify({
      access_token: token, refresh_token: 'fixture', token_type: 'bearer',
      expires_at: expiry, expires_in: 3600, user,
    }));
    localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([seed]));
    localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', seed.id);
  }, { origin, user, expiry, token, seed, marker });
}

function waitForApp(page) {
  return page.waitForFunction(() => document.documentElement.dataset.triplogInitialized === 'true'
    && document.documentElement.dataset.auth === 'signed-in' && document.documentElement.dataset.appReady === 'true'
    && document.querySelector('#entrySplash')?.hidden !== false);
}

module.exports = { launchBrowser, fixtureToken, blockExternalRequests, startServer, stopServer, seedTrip, waitForApp };
