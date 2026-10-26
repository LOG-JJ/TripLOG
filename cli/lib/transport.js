'use strict';
const { CliError } = require('./errors');
const { request } = require('./http');
function apiError(code, status, requestId, retryAfter) {
  const category = status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : [400, 413, 422].includes(status) ? 'INVALID_INPUT' : status === 426 ? 'UNSUPPORTED' : 'NETWORK_ERROR';
  return new CliError(category, `서버 요청을 처리하지 못했습니다: ${code}`, { serverCode: code, status, requestId, retryAfter });
}
function createTransport(config, identity, { fetcher = request } = {}) {
  return async body => {
    let response;
    try {
      response = await fetcher(`${config.url}/functions/v1/triplog-sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${identity.token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000), redirect: 'error' });
    } catch (_) { throw new CliError('NETWORK_ERROR', '응답을 받지 못했습니다. 저장 명령은 요청 기록에서 결과를 확인해 주세요.'); }
    let data;
    try { data = await response.json(); } catch (_) { throw apiError('INVALID_RESPONSE', response.status, undefined); }
    if (!response.ok) throw apiError(data.code || 'REQUEST_FAILED', response.status, data.requestId, data.retryAfter);
    if (!data || typeof data !== 'object') throw apiError('INVALID_RESPONSE', response.status);
    return data;
  };
}
module.exports = { createTransport };
