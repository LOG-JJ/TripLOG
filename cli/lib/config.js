'use strict';
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const defaults = require('../../src/app/data/service-config');
const { parseJson, writeJson } = require('./files');
const { fail } = require('./errors');
const home = () => path.resolve(process.env.TRIPLOG_CLI_HOME || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'TripLOG', 'cli') : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'triplog')));
function profileName(name = 'default') { if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name)) fail('USAGE', '프로필 이름은 영문·숫자·점·밑줄·하이픈으로 지정해 주세요.'); return name; }
function validateConfig(config) {
  let url;
  try { url = new URL(config.url); } catch (_) { fail('USAGE', '유효한 Supabase URL이 필요합니다.'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))) fail('USAGE', 'HTTPS 프로젝트 URL 또는 로컬 테스트 URL을 사용해 주세요.');
  const key = config.publishableKey;
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch (_) { /* publishable keys are not JWTs */ }
  if (typeof key !== 'string' || (!key.startsWith('sb_publishable_') && role !== 'anon')) fail('USAGE', '클라이언트용 publishable/anon 키가 필요합니다.');
  return { ...config, url: url.origin };
}
async function loadConfig(name = 'default') {
  name = profileName(name);
  const file = path.join(home(), 'profiles', `${name}.json`);
  let saved = {};
  try { saved = parseJson(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { ...validateConfig({ ...defaults, ...saved, ...(process.env.TRIPLOG_URL ? { url: process.env.TRIPLOG_URL } : {}), ...(process.env.TRIPLOG_PUBLISHABLE_KEY ? { publishableKey: process.env.TRIPLOG_PUBLISHABLE_KEY } : {}) }), profile: name };
}
async function saveConfig(name, values) {
  name = profileName(name);
  const config = validateConfig({ ...await loadConfig(name), ...values });
  delete config.profile;
  await writeJson(path.join(home(), 'profiles', `${name}.json`), config, { overwrite: true });
  return { profile: name, url: config.url, appUrl: config.appUrl };
}
module.exports = { home, profileName, loadConfig, saveConfig, validateConfig };
