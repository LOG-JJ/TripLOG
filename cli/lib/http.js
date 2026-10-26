'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const connectFailures = new Set(['UND_ERR_CONNECT_TIMEOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);
const codeError = code => Object.assign(new Error('HTTPS transport failed.'), { code });
function connectionCode(error) {
  const code = error?.cause?.code || error?.code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : error?.name === 'TimeoutError' ? 'REQUEST_TIMEOUT' : error?.name === 'AbortError' ? 'ABORTED' : 'FETCH_FAILED';
}
function windowsHttp3Fetch(url, options = {}, { spawnProcess = spawn } = {}) {
  if (new URL(url).protocol !== 'https:' || (options.body != null && typeof options.body !== 'string')) return Promise.reject(codeError('HTTP3_UNAVAILABLE'));
  if (options.signal?.aborted) return Promise.reject(options.signal.reason);
  return new Promise((resolve, reject) => {
    // No request data is present in argv. -File runs only our fixed helper;
    // profiles, shell expansion, redirects and cookie persistence are disabled.
    const child = spawnProcess('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'http3.ps1')], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let size = 0, settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; options.signal?.removeEventListener('abort', abort); if (error) reject(error); else resolve(value); };
    const abort = () => { child.kill(); finish(options.signal.reason || codeError('ABORTED')); };
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) { abort(); return; }
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 96 * 1024 * 1024) { child.kill(); finish(codeError('RESPONSE_TOO_LARGE')); } else chunks.push(chunk); });
    child.stderr.resume();
    child.once('error', () => finish(codeError('HTTP3_UNAVAILABLE')));
    child.once('close', exitCode => {
      if (settled) return;
      if (exitCode) { finish(codeError('HTTP3_HELPER_FAILED')); return; }
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, ''));
        if (!data.ok) { finish(codeError(['HTTP3_UNAVAILABLE', 'HTTP3_REQUEST_FAILED', 'REQUEST_TIMEOUT', 'CERTIFICATE_ERROR'].includes(data.code) ? data.code : 'HTTP3_REQUEST_FAILED')); return; }
        if (!Number.isInteger(data.status) || data.status < 200 || data.status > 599 || data.protocol !== '3.0' || typeof data.body !== 'string') throw new Error('Invalid response');
        if (data.status >= 300 && data.status < 400 && options.redirect !== 'manual') { finish(codeError('REDIRECT_BLOCKED')); return; }
        const headers = new Headers();
        for (const [name, values] of Object.entries(data.headers || {})) for (const value of (Array.isArray(values) ? values : [values])) headers.append(name, value);
        const body = ['HEAD'].includes(options.method) || [204, 205, 304].includes(data.status) ? null : Buffer.from(data.body, 'base64');
        finish(null, new Response(body, { status: data.status, headers }));
      } catch (_) { finish(codeError('INVALID_HTTP3_RESPONSE')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ url: String(url), method: options.method || 'GET', headers: Object.fromEntries(new Headers(options.headers).entries()), body: options.body ?? null, timeoutMs: 25000 }));
  });
}
function createFetch({ fetcher = (...args) => fetch(...args), nativeFetcher = windowsHttp3Fetch, platform = process.platform, wait = delay, timeoutMs = 25000 } = {}) {
  const nativeOrigins = new Set();
  return async (url, options = {}) => {
    const address = new URL(url), timeout = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const requestOptions = { ...options, redirect: 'error', signal };
    const canUseNative = platform === 'win32' && nativeFetcher && address.protocol === 'https:' && (options.body == null || typeof options.body === 'string');
    let attempts = 0, transport = 'node', originalError;
    const nodeRequest = async () => { transport = 'node'; attempts++; return fetcher(url, requestOptions); };
    const nativeRequest = async () => {
      transport = 'windows-http3'; attempts++;
      try { const response = await nativeFetcher(url, requestOptions); nativeOrigins.add(address.origin); return response; }
      catch (error) { nativeOrigins.delete(address.origin); if (connectionCode(error) === 'HTTP3_UNAVAILABLE') attempts--; throw error; }
    };
    try {
      signal.throwIfAborted();
      if (canUseNative && nativeOrigins.has(address.origin)) {
        try { return await nativeRequest(); }
        catch (error) { if (connectionCode(error) !== 'HTTP3_UNAVAILABLE') throw error; }
      }
      try { return await nodeRequest(); }
      catch (error) {
        originalError = error;
        if (signal.aborted || !connectFailures.has(connectionCode(error))) throw error;
      }
      // Only pre-connection failures can safely be replayed. A lost response,
      // refresh-token rotation or HTTP error must never trigger a second send.
      if (canUseNative) {
        try { return await nativeRequest(); }
        catch (error) { if (connectionCode(error) !== 'HTTP3_UNAVAILABLE') throw error; }
      }
      await wait(350, undefined, { signal });
      return await nodeRequest();
    } catch (error) {
      const code = connectionCode(signal.aborted ? signal.reason : error);
      const failure = codeError(code);
      failure.connection = { networkCode: code, attempts, host: address.hostname, transport, ...(originalError && transport !== 'node' ? { initialNetworkCode: connectionCode(originalError) } : {}) };
      throw failure;
    }
  };
}
const request = createFetch();
module.exports = { request, createFetch, windowsHttp3Fetch, connectionCode };
