'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const Auth = require('../cli/lib/auth');
const { readSession, saveSession } = require('../cli/lib/session-store');
const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const out = artifactDirectory('cli-auth');
const config = { url: 'https://auth-fixture.invalid', publishableKey: 'sb_publishable_fixture', profile: 'login-recovery' };
const user = { id: '00000000-0000-4000-8000-000000000099', email: 'login-fixture@example.invalid', role: 'authenticated' };
const password = ' exact-e\u0301-비밀번호-🔐 ';
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.fixture`;
const session = () => ({ access_token: token, refresh_token: 'fixture-refresh-only', token_type: 'bearer', expires_in: 3600, user });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const failure = (code = 'UND_ERR_CONNECT_TIMEOUT') => new TypeError('fetch failed with private diagnostic', { cause: Object.assign(new Error('never print a raw network exception'), { code }) });
const cases = [];
async function main() {
  const previous = { home: process.env.TRIPLOG_CLI_HOME, token: process.env.TRIPLOG_ACCESS_TOKEN, consoleError: console.error };
  process.env.TRIPLOG_CLI_HOME = path.join(out, 'home'); delete process.env.TRIPLOG_ACCESS_TOKEN;
  const logs = []; console.error = (...args) => logs.push(args);
  try {
    let calls = [], waits = 0;
    const recovered = Auth.clientFor(config, { wait: async () => { waits++; }, fetcher: async (url, options) => { calls.push({ url, options }); if (calls.length === 1) throw failure(); return json(session()); } });
    const signedIn = await recovered.auth.signInWithPassword({ email: user.email, password });
    assert.equal(signedIn.error, null); assert.equal(signedIn.data.user.id, user.id); assert.equal(calls.length, 2); assert.equal(waits, 1);
    assert(calls.every(call => call.url.endsWith('/auth/v1/token?grant_type=password')));
    assert(calls.every(call => JSON.parse(call.options.body).password === password), 'retry preserves exact password bytes');
    cases.push('connect timeout retries once and sign-in succeeds with exact credentials');

    calls = [];
    const offline = Auth.clientFor(config, { wait: async () => {}, fetcher: async (...args) => { calls.push(args); throw failure(); } });
    const unavailable = await offline.auth.signInWithPassword({ email: user.email, password });
    assert(unavailable.error); assert.equal(unavailable.data.session, null); assert.equal(calls.length, 2);
    cases.push('persistent connection failure stops after two attempts without SDK console output');

    for (const code of ['UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT', 'CERT_HAS_EXPIRED']) {
      let count = 0;
      const client = Auth.clientFor(config, { fetcher: async () => { count++; throw failure(code); } });
      assert((await client.auth.signInWithPassword({ email: user.email, password })).error); assert.equal(count, 1);
    }
    cases.push('response loss and certificate failures are not replayed or bypassed');

    for (const status of [400, 401, 429, 503]) {
      let count = 0;
      const client = Auth.clientFor(config, { fetcher: async () => { count++; return json({ error_code: 'invalid_credentials', msg: 'fixture failure' }, status); } });
      assert((await client.auth.signInWithPassword({ email: user.email, password })).error); assert.equal(count, 1);
    }
    cases.push('credential, rate-limit, and server HTTP errors are not blindly retried');

    let count = 0;
    const cancelled = Auth.clientFor(config, { timeoutMs: 15, fetcher: async () => { count++; throw failure(); } });
    assert((await cancelled.auth.signInWithPassword({ email: user.email, password })).error); assert.equal(count, 1);
    cases.push('total deadline cancels a pending connection retry');

    process.env.TRIPLOG_ACCESS_TOKEN = token;
    count = 0;
    await assert.rejects(Auth.authenticate(config, { wait: async () => {}, fetcher: async () => { count++; throw failure(); } }), error => error.code === 'NETWORK_ERROR' && error.details.networkCode === 'UND_ERR_CONNECT_TIMEOUT' && error.details.attempts === 2 && error.details.host === 'auth-fixture.invalid' && !JSON.stringify(error.details).includes('private diagnostic'));
    assert.equal(count, 2);
    count = 0;
    await assert.rejects(Auth.authenticate(config, { wait: async () => {}, fetcher: async () => { if (++count === 1) throw failure(); return json({ error_code: 'bad_jwt', msg: 'fixture invalid token' }, 401); } }), error => error.code === 'AUTH_REQUIRED');
    assert.equal(count, 2);
    delete process.env.TRIPLOG_ACCESS_TOKEN;
    cases.push('CLI preserves transport cause while clearing it after an actual HTTP response');

    if (process.platform === 'win32') {
      count = 0;
      const loggedIn = await Auth.login(config, { email: ' '+user.email+' ', password }, { wait: async () => {}, fetcher: async (url, options) => { count++; if (count === 1) throw failure(); assert.equal(JSON.parse(options.body).email, user.email); assert.equal(JSON.parse(options.body).password, password); return json(session()); } });
      assert.equal(loggedIn.profile, config.profile); assert.equal(loggedIn.userId, user.id); assert.equal(count, 2);
      const saved = await readSession(config.profile); assert.equal(saved.session.access_token, token);
      saved.session.expires_at = 1; await saveSession(config.profile, saved);
      const file = path.join(process.env.TRIPLOG_CLI_HOME, 'sessions', config.profile+'.dpapi'); const before = await fs.readFile(file);
      await assert.rejects(Auth.authenticate(config, { wait: async () => {}, fetcher: async () => { throw failure(); } }), error => error.code === 'NETWORK_ERROR');
      assert((await fs.readFile(file)).equals(before), 'network failure must not erase the encrypted session');
      cases.push('Windows login stores DPAPI session and refresh network failure preserves it');
    }
    assert.deepEqual(logs, [], 'network errors must not leak SDK stack traces into the terminal');
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify({ passed: true, cases, platform: process.platform, consoleErrors: logs.length, at: new Date().toISOString() }, null, 2));
  } finally {
    console.error = previous.consoleError;
    for (const [name, value] of [['TRIPLOG_CLI_HOME', previous.home], ['TRIPLOG_ACCESS_TOKEN', previous.token]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
  console.log('PASS CLI auth: bounded connection retry, quiet errors, exact password bytes, no unsafe replay, cancellation and encrypted-session preservation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
