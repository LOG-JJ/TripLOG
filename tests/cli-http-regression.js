'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createFetch, windowsHttp3Fetch } = require('../cli/lib/http');
const { createTransport } = require('../cli/lib/transport');
const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const out = artifactDirectory('cli-http');
const url = 'https://http-fixture.invalid/auth/v1/token?grant_type=password';
const password = ' exact-e\u0301-비밀번호-🔐\n$($secret) ` & " ';
const body = JSON.stringify({ email: 'fixture@example.invalid', password });
const failure = code => Object.assign(new Error('Private diagnostic must not be printed'), { code });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const cases = [];
function fakeProcess(result, inspect = () => {}, { keepOpen = false, error } = {}) {
  let child, killed = false;
  const spawnProcess = (command, args, options) => {
    child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    const input = [];
    child.stdin = new Writable({ write(chunk, _encoding, done) { input.push(chunk); done(); }, final(done) {
      inspect({ command, args, options, input: Buffer.concat(input).toString('utf8') }); done();
      if (!keepOpen) setImmediate(() => {
        if (error) { child.emit('error', error); child.emit('close', -1); return; }
        child.stderr.write('private subprocess diagnostic'); child.stderr.end();
        child.stdout.end(JSON.stringify(result)); child.emit('close', 0);
      });
    } });
    child.kill = () => { killed = true; setImmediate(() => child.emit('close', 1)); return true; };
    return child;
  };
  return { spawnProcess, get killed() { return killed; } };
}
async function main() {
  let nodeCalls = 0, nativeCalls = 0;
  const recovered = createFetch({ platform: 'win32', fetcher: async () => { nodeCalls++; throw failure('UND_ERR_CONNECT_TIMEOUT'); }, nativeFetcher: async (target, options) => {
    nativeCalls++; assert.equal(options.redirect, 'error'); assert.equal(options.body, body); assert.equal(new URL(target).hostname, new URL(url).hostname); return json({ ok: true });
  } });
  assert.equal((await recovered(url, { method: 'POST', body })).status, 200);
  assert.equal((await recovered(url.replace('/auth/v1/token?grant_type=password', '/functions/v1/triplog-sync'), { method: 'POST', body })).status, 200);
  assert.equal(nodeCalls, 1); assert.equal(nativeCalls, 2);
  cases.push('pre-connection failure recovers over HTTP/3 and subsequent same-origin requests reuse the working transport');

  const sync = createTransport({ url: new URL(url).origin, publishableKey: 'sb_publishable_fixture' }, { token: 'fixture-token' }, { fetcher: createFetch({ platform: 'win32', fetcher: async () => { throw failure('UND_ERR_CONNECT_TIMEOUT'); }, nativeFetcher: async (_url, options) => { assert.equal(options.headers.Authorization, 'Bearer fixture-token'); assert.equal(JSON.parse(options.body).action, 'list'); return json({ trips: [] }); } }) });
  assert.deepEqual(await sync({ action: 'list' }), { trips: [] });
  cases.push('cloud synchronization uses the same recovery path after login');

  for (const code of ['UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT', 'CERT_HAS_EXPIRED', 'ECONNRESET']) {
    nodeCalls = 0; nativeCalls = 0;
    const request = createFetch({ platform: 'win32', fetcher: async () => { nodeCalls++; throw failure(code); }, nativeFetcher: async () => { nativeCalls++; return json({}); } });
    await assert.rejects(request(url, { method: 'POST', body }), error => error.connection.networkCode === code && error.connection.attempts === 1);
    assert.equal(nodeCalls, 1); assert.equal(nativeCalls, 0);
  }
  for (const status of [400, 401, 429, 503]) {
    nativeCalls = 0;
    const request = createFetch({ platform: 'win32', fetcher: async () => json({}, status), nativeFetcher: async () => { nativeCalls++; return json({}); } });
    assert.equal((await request(url, { method: 'POST', body })).status, status); assert.equal(nativeCalls, 0);
  }
  cases.push('lost responses, certificate errors and HTTP failures never replay a credential or write request');

  nodeCalls = 0; nativeCalls = 0;
  const nativeFailure = createFetch({ platform: 'win32', fetcher: async () => { nodeCalls++; throw failure('UND_ERR_CONNECT_TIMEOUT'); }, nativeFetcher: async () => { nativeCalls++; throw failure('HTTP3_REQUEST_FAILED'); } });
  await assert.rejects(nativeFailure(url, { method: 'POST', body }), error => error.connection.attempts === 2 && error.connection.initialNetworkCode === 'UND_ERR_CONNECT_TIMEOUT' && error.connection.transport === 'windows-http3');
  assert.equal(nodeCalls, 1); assert.equal(nativeCalls, 1);
  cases.push('an uncertain HTTP/3 response is not followed by another request');

  nodeCalls = 0; nativeCalls = 0;
  const noRuntime = createFetch({ platform: 'win32', wait: async () => {}, fetcher: async () => { if (++nodeCalls === 1) throw failure('ECONNREFUSED'); return json({}); }, nativeFetcher: async () => { nativeCalls++; throw failure('HTTP3_UNAVAILABLE'); } });
  assert.equal((await noRuntime(url)).status, 200); assert.equal(nodeCalls, 2); assert.equal(nativeCalls, 1);
  nativeCalls = 0; nodeCalls = 0;
  const nonWindows = createFetch({ platform: 'linux', wait: async () => {}, fetcher: async () => { if (++nodeCalls === 1) throw failure('EAI_AGAIN'); return json({}); }, nativeFetcher: async () => { nativeCalls++; return json({}); } });
  assert.equal((await nonWindows(url)).status, 200); assert.equal(nativeCalls, 0);
  cases.push('missing optional Windows runtime and other platforms retain bounded Node connection retry');

  const payload = { ok: true, protocol: '3.0', status: 200, headers: { 'Content-Type': ['application/json'], 'X-Test': ['one', 'two'] }, body: Buffer.from(JSON.stringify({ text: '여행 e\u0301 🔐' })).toString('base64') };
  let inspected = false;
  const child = fakeProcess(payload, data => {
    inspected = true; assert.equal(data.command, 'pwsh.exe'); assert.equal(data.options.windowsHide, true); assert.equal(data.options.shell, false);
    assert(data.args.includes('-NoProfile')); assert(data.args.includes('-NonInteractive'));
    assert(!data.args.join(' ').includes(password)); assert(!data.args.join(' ').includes('fixture-token')); assert(!data.args.join(' ').includes(url));
    const request = JSON.parse(data.input); assert.equal(request.body, body); assert.equal(JSON.parse(request.body).password, password); assert.equal(request.headers.authorization, 'Bearer fixture-token');
  });
  const response = await windowsHttp3Fetch(url, { method: 'POST', body, headers: { Authorization: 'Bearer fixture-token' } }, child);
  assert(inspected); assert.equal(response.status, 200); assert.equal(response.headers.get('x-test'), 'one, two'); assert.deepEqual(await response.json(), { text: '여행 e\u0301 🔐' });
  cases.push('helper preserves Unicode credentials in stdin only, ignores stderr and reconstructs response headers/body');

  await assert.rejects(windowsHttp3Fetch(url, {}, fakeProcess({ ...payload, status: 302, headers: { Location: ['https://other-fixture.invalid'] } })), error => error.code === 'REDIRECT_BLOCKED');
  await assert.rejects(windowsHttp3Fetch(url, {}, fakeProcess({ ok: false, code: 'CERTIFICATE_ERROR' })), error => error.code === 'CERTIFICATE_ERROR');
  await assert.rejects(windowsHttp3Fetch(url, {}, fakeProcess(null, () => {}, { error: failure('ENOENT') })), error => error.code === 'HTTP3_UNAVAILABLE');
  assert.equal((await windowsHttp3Fetch(url, {}, fakeProcess({ ...payload, status: 204, body: '' }))).status, 204);
  cases.push('helper blocks redirects, retains TLS failures, handles missing runtime and accepts empty 204 responses');

  const abort = new AbortController(), hanging = fakeProcess(null, () => {}, { keepOpen: true });
  const pending = windowsHttp3Fetch(url, { signal: abort.signal }, hanging); abort.abort();
  await assert.rejects(pending, error => error.name === 'AbortError'); assert(hanging.killed);
  const deadlineChild = fakeProcess(null, () => {}, { keepOpen: true });
  const deadline = createFetch({ timeoutMs: 30, platform: 'win32', fetcher: async () => { throw failure('UND_ERR_CONNECT_TIMEOUT'); }, nativeFetcher: (target, options) => windowsHttp3Fetch(target, options, deadlineChild) });
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(deadline(url), error => error.connection.networkCode === 'REQUEST_TIMEOUT'); assert(deadlineChild.killed); } finally { clearTimeout(keepAlive); }
  cases.push('user cancellation and the shared deadline terminate the owned helper process');
  await fs.writeFile(path.join(out, 'result.json'), JSON.stringify({ passed: true, cases, at: new Date().toISOString() }, null, 2));
  console.log('PASS CLI HTTP: Windows HTTP/3 recovery, safe replay boundaries, secure stdin, Unicode, TLS/redirect handling and process cancellation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
