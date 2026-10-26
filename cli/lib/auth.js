'use strict';
const path = require('node:path');
const readline = require('node:readline');
const { Writable } = require('node:stream');
const { createClient } = require('@supabase/supabase-js');
const { request, createFetch, connectionCode } = require('./http');
const { home } = require('./config');
const { saveSession, readSession, clearSession } = require('./session-store');
const { withLock } = require('./files');
const { fail, CliError } = require('./errors');
const connectionStates = new WeakMap();
function clientFor(config, dependencies = {}) {
  const connection = { failure: null };
  const fetchRequest = dependencies.fetcher ? createFetch({ ...dependencies, nativeFetcher: dependencies.nativeFetcher ?? null }) : request;
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options = {}) => {
      connection.failure = null;
      try { const response = await fetchRequest(url, options); connection.failure = null; return response; }
      catch (error) {
        connection.failure = error.connection || { networkCode: connectionCode(error), attempts: 1, host: new URL(config.url).hostname };
        // auth-js logs rejected fetch promises directly to console.error,
        // corrupting an active TUI. Keep the failure in the SDK error result.
        return Response.error();
      }
    } },
  });
  connectionStates.set(client, connection);
  return client;
}
function authError(error, client) {
  if (!error) return;
  const failure = connectionStates.get(client)?.failure;
  if (failure) {
    const message = failure.networkCode === 'UND_ERR_CONNECT_TIMEOUT'
      ? '인증 서버 연결 시간이 초과됐습니다. 비밀번호 확인 단계까지 도달하지 못했습니다.'
      : failure.networkCode === 'REQUEST_TIMEOUT' ? '인증 서버 응답을 기다리다 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.'
      : '인증 서버와 통신하지 못했습니다. 네트워크 연결을 확인해 주세요.';
    throw new CliError('NETWORK_ERROR', message, {
      ...failure,
      hint: '잠시 후 다시 로그인해 주세요. 계속되면 VPN·프록시·방화벽의 Node.js 연결 설정을 확인해 주세요.',
    });
  }
  const network = !error.status || error.status >= 500 || error.status === 429;
  throw new CliError(network ? 'NETWORK_ERROR' : 'AUTH_REQUIRED', network ? '인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' : '로그인 정보 또는 세션을 확인해 주세요. triplog auth login으로 다시 로그인할 수 있습니다.');
}
function prompt(label, hidden = false) {
  if (!process.stdin.isTTY) fail('USAGE', '대화형 입력이 필요합니다. 자동화에서는 TRIPLOG_ACCESS_TOKEN을 사용해 주세요.');
  process.stderr.write(label);
  const sink = hidden ? new Writable({ write(_chunk, _encoding, done) { done(); } }) : process.stderr;
  const rl = readline.createInterface({ input: process.stdin, output: sink, terminal: true });
  return new Promise((resolve, reject) => {
    rl.once('SIGINT', () => { rl.close(); reject(new CliError('USAGE', '입력을 취소했습니다.')); });
    rl.question('', answer => { rl.close(); if (hidden) process.stderr.write('\n'); resolve(answer); });
  });
}
async function login(config, options, dependencies) {
  if (process.env.TRIPLOG_ACCESS_TOKEN) fail('USAGE', '현재 TRIPLOG_ACCESS_TOKEN으로 인증 중입니다. 환경변수 토큰을 해제한 뒤 저장형 로그인을 사용해 주세요.');
  if (process.platform !== 'win32') fail('UNSUPPORTED', '이 OS에서는 TRIPLOG_ACCESS_TOKEN으로 인증해 주세요. 저장형 로그인은 Windows DPAPI를 사용합니다.');
  const email = (options.email || await prompt('이메일: ')).trim();
  const password = options.password ?? await prompt('비밀번호: ', true);
  return withLock(path.join(home(), 'sessions', `${config.profile}.lock`), async () => {
    const client = clientFor(config, dependencies), { data, error } = await client.auth.signInWithPassword({ email, password });
    authError(error, client);
    if (!data.session || !data.user) fail('AUTH_REQUIRED', '로그인 세션을 발급받지 못했습니다.');
    await saveSession(config.profile, { url: config.url, session: data.session });
    return { profile: config.profile, userId: data.user.id, email: data.user.email, expiresAt: data.session.expires_at };
  });
}
async function authenticate(config, dependencies) {
  const client = clientFor(config, dependencies);
  const external = process.env.TRIPLOG_ACCESS_TOKEN;
  if (external) {
    const { data, error } = await client.auth.getUser(external); authError(error, client);
    if (!data.user) fail('AUTH_REQUIRED', '유효한 사용자 토큰이 필요합니다.');
    return { token: external, user: data.user, external: true };
  }
  return withLock(path.join(home(), 'sessions', `${config.profile}.lock`), async () => {
    const saved = await readSession(config.profile);
    if (!saved || saved.url !== config.url) fail('AUTH_REQUIRED', '이 프로젝트에 로그인해 주세요: triplog auth login');
    let session = saved.session;
    if (!session?.access_token) fail('AUTH_REQUIRED', '저장된 세션이 없습니다. 다시 로그인해 주세요.');
    if (!session.expires_at || session.expires_at * 1000 < Date.now() + 60000) {
      const { data, error } = await client.auth.refreshSession({ refresh_token: session.refresh_token }); authError(error, client);
      if (!data.session) fail('AUTH_REQUIRED', '세션이 만료됐습니다. 다시 로그인해 주세요.');
      session = data.session; await saveSession(config.profile, { url: config.url, session });
    }
    const { data, error } = await client.auth.getUser(session.access_token); authError(error, client);
    if (!data.user) fail('AUTH_REQUIRED', '세션이 만료됐습니다.');
    return { token: session.access_token, user: data.user, expiresAt: session.expires_at, external: false };
  });
}
async function logout(config) {
  if (process.env.TRIPLOG_ACCESS_TOKEN) fail('USAGE', '환경변수 토큰은 이 프로세스가 삭제하거나 폐기하지 않습니다. 호출 환경에서 TRIPLOG_ACCESS_TOKEN을 해제해 주세요.');
  return withLock(path.join(home(), 'sessions', `${config.profile}.lock`), async () => {
    const saved = await readSession(config.profile);
    if (!saved || saved.url !== config.url) { await clearSession(config.profile); return { loggedOut: true, scope: 'local-cli' }; }
    const response = await request(`${config.url}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: config.publishableKey, Authorization: `Bearer ${saved.session.access_token}` }, signal: AbortSignal.timeout(25000) }).catch(() => null);
    await clearSession(config.profile);
    return { loggedOut: true, scope: 'local-cli', remoteSessionRevoked: Boolean(response && (response.ok || response.status === 401 || response.status === 403)) };
  });
}
module.exports = { login, logout, authenticate, clientFor, prompt };
