'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { run, npm, root } = require('../lib/process-runner');
const { fail } = require('../lib/errors');
const { hash } = require('../lib/files');
const defaults = require('../../src/app/data/service-config');
const scripts = { all: 'test', source: 'test:source', sync: 'test:sync', browser: 'test:browser', edge: 'test:edge', maps: 'test:maps', order: 'test:order', print: 'test:print', offline: 'test:offline', cli: 'test:cli', terminal: 'test:terminal' };
async function doctor() {
  const checks = [{ name: 'node', ok: Number(process.versions.node.split('.')[0]) >= 24, version: process.version }];
  for (const command of ['git', 'deno']) {
    try { const result = await run(command, ['--version'], { capture: true, allowFailure: true }); checks.push({ name: command, ok: result.code === 0, required: command === 'git', version: result.stdout.trim() }); }
    catch (_) { checks.push({ name: command, ok: false, required: command === 'git' }); }
  }
  try { const result = await npm(['--version'], { capture: true }); checks.push({ name: 'npm', ok: true, version: result.stdout.trim() }); } catch (_) { checks.push({ name: 'npm', ok: false }); }
  try { const { chromium } = require('playwright'); const candidates = process.platform === 'win32' ? [path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft/Edge/Application/msedge.exe'), path.join(process.env.PROGRAMFILES || '', 'Microsoft/Edge/Application/msedge.exe'), chromium.executablePath()] : [chromium.executablePath()]; const installed = []; for (const file of candidates) if (await fs.stat(file).catch(() => null)) installed.push(file); checks.push({ name: 'browser', ok: installed.length > 0, paths: installed }); } catch (_) { checks.push({ name: 'browser', ok: false }); }
  return { root, checks, artifactDirectory: 'artifacts/tmp/', optional: 'Deno는 Edge Function 테스트에 필요합니다.' };
}
async function git(args, runner = run) { return runner('git', args, { capture: true }); }
function statusPaths(text) {
  const tokens = text.split('\0').filter(Boolean), files = [];
  for (let index = 0; index < tokens.length; index++) { const row = tokens[index]; files.push(row.slice(3)); if (/[RC]/.test(row.slice(0, 2))) files.push(tokens[++index]); }
  return [...new Set(files.filter(Boolean))];
}
function validateFiles(files) {
  return [...new Set(files || [])].map(file => {
    const resolved = path.resolve(root, file), relative = path.relative(root, resolved).replaceAll('\\', '/');
    if (!relative || relative.startsWith('../') || path.isAbsolute(relative) || relative.startsWith('.git/') || relative.startsWith('artifacts/tmp/')) fail('USAGE', `배포 파일 경로를 확인해 주세요: ${file}`);
    return relative;
  });
}
async function deployPlan(options, runner = run) {
  const branch = (await git(['branch', '--show-current'], runner)).stdout.trim();
  const remote = (await git(['remote', 'get-url', 'origin'], runner)).stdout.trim();
  const head = (await git(['rev-parse', 'HEAD'], runner)).stdout.trim();
  const dirty = statusPaths((await git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], runner)).stdout);
  const selected = validateFiles(options.files), unselected = dirty.filter(file => !selected.includes(file));
  const staged = (await git(['diff', '--cached', '--name-only', '-z'], runner)).stdout.split('\0').filter(Boolean);
  const fileHashes = {};
  for (const file of selected) { try { fileHashes[file] = hash(await fs.readFile(path.join(root, file))); } catch (error) { if (error.code !== 'ENOENT') throw error; fileHashes[file] = null; } }
  const blockers = [];
  if (branch !== 'main') blockers.push('main 브랜치에서 실행해야 합니다.');
  if (!/^(?:https:\/\/github\.com\/|git@github\.com:)LOG-JJ\/TripLOG(?:\.git)?$/i.test(remote)) blockers.push('origin이 LOG-JJ/TripLOG가 아닙니다.');
  if (dirty.length && !selected.length) blockers.push('--files를 반복해서 커밋할 파일을 지정해 주세요.');
  if (unselected.length) blockers.push('선택하지 않은 변경이 있습니다. 현재 작업을 정리하거나 별도 체크아웃에서 배포해 주세요.');
  if (staged.some(file => !selected.includes(file))) blockers.push('선택하지 않은 staged 파일이 있습니다.');
  return { branch, remote, head, files: selected, fileHashes, dirty, unselected, blockers, steps: ['fetch origin main', 'fast-forward remote changes', 'npm test', 'npm run test:browser', ...(selected.some(file => file.startsWith('supabase/')) ? ['npm run test:edge'] : []), 'npm run build', 'inspect generated files', 'commit selected files', 'push origin HEAD:main', 'verify live build'], fingerprint: hash(JSON.stringify({ branch, remote, head, dirty, selected, fileHashes })) };
}
async function deployStatus({ fetcher = fetch, runner = run } = {}) {
  const html = (await git(['show', 'HEAD:Travel.html'], runner)).stdout;
  const expected = html.match(/name="triplog-build" content="([^"]+)"/)?.[1];
  let live, worker;
  try {
    const target = new URL(defaults.appUrl); target.searchParams.set('cli_check', Date.now());
    const [page, sw] = await Promise.all([fetcher(target, { cache: 'no-store', signal: AbortSignal.timeout(15000) }), fetcher(new URL(`/sw.js?cli_check=${Date.now()}`, defaults.appUrl), { cache: 'no-store', signal: AbortSignal.timeout(15000) })]);
    if (page.ok) live = (await page.text()).match(/name="triplog-build" content="([^"]+)"/)?.[1];
    if (sw.ok) worker = await sw.text();
  } catch (_) { /* An unavailable live service is not deployment confirmation. */ }
  const pageMatches = Boolean(expected && expected === live), workerMatches = Boolean(expected && worker?.includes(expected));
  return { expectedBuild: expected || null, liveBuild: live || null, pageMatches, workerMatches, automaticDeployment: pageMatches && workerMatches ? 'verified' : 'unverified', url: defaults.appUrl };
}
async function deployRun(options, { runner = run, npmRunner = npm, status = deployStatus } = {}) {
  if (options.dryRun) return deployPlan(options, runner);
  if (!options.message?.trim()) fail('USAGE', '--message로 커밋 메시지를 지정해 주세요.');
  const initial = await deployPlan(options, runner);
  if (initial.blockers.length) fail('CONFLICT', '배포 선행 조건을 해결해 주세요.', initial);
  await git(['fetch', 'origin', 'main'], runner);
  const counts = (await git(['rev-list', '--left-right', '--count', 'HEAD...origin/main'], runner)).stdout.trim().split(/\s+/).map(Number);
  if (counts[0] > 0) fail('CONFLICT', '이미 존재하는 미푸시 커밋이 있습니다. 커밋을 검토하고 별도로 푸시한 뒤 다시 실행해 주세요.');
  if (counts[1] > 0) await git(['merge', '--ff-only', 'origin/main'], runner);
  const scoped = await deployPlan(options, runner); if (scoped.blockers.length) fail('CONFLICT', '원격 반영 후 배포 범위가 달라졌습니다.', scoped);
  await npmRunner(['test']); await npmRunner(['run', 'test:browser']);
  if (scoped.files.some(file => file.startsWith('supabase/'))) await npmRunner(['run', 'test:edge']);
  await npmRunner(['run', 'build']);
  const after = await deployPlan({ ...options, files: scoped.files }, runner);
  const isGenerated = file => ['Travel.html', 'sw.js', 'index.html', 'src/entry/site.webmanifest'].includes(file) || file.startsWith('supabase/functions/_shared/') || file.startsWith('vendor/') || /^icons\/apple-touch-icon-/.test(file);
  if (after.head !== scoped.head || after.branch !== scoped.branch || after.remote !== scoped.remote || scoped.files.some(file => !isGenerated(file) && after.fileHashes[file] !== scoped.fileHashes[file])) fail('CONFLICT', '검증 도중 소스나 Git 상태가 변경됐습니다. 새 상태로 다시 검증해 주세요.');
  const generated = after.unselected.filter(isGenerated);
  if (after.unselected.some(file => !generated.includes(file))) fail('CONFLICT', '검증 중 새로운 변경이 발생했습니다. 파일 목록을 다시 확인해 주세요.', { files: after.unselected });
  const files = validateFiles([...scoped.files, ...generated]);
  if (!after.dirty.length) fail('USAGE', '커밋할 변경이 없습니다. deploy status로 운영 반영 상태를 확인할 수 있습니다.');
  await git(['add', '--', ...files], runner);
  const staged = (await git(['diff', '--cached', '--name-only', '-z'], runner)).stdout.split('\0').filter(Boolean);
  if (staged.some(file => !files.includes(file))) fail('CONFLICT', '스테이징 범위가 변경됐습니다. 커밋하지 않았습니다.');
  await git(['commit', '-m', options.message], runner);
  const commit = (await git(['rev-parse', 'HEAD'], runner)).stdout.trim();
  try { await git(['push', 'origin', 'HEAD:main'], runner); }
  catch (error) { error.details = { ...error.details, commit, gitPush: 'failed', automaticDeployment: 'unverified' }; throw error; }
  return { commit, gitPush: 'completed', ...await status() };
}
async function execute(action, subaction, options) {
  if (action === 'doctor') return doctor();
  if (action === 'deploy') {
    if (subaction === 'run') return deployRun(options);
    if (subaction === 'status') return deployStatus();
    if (!subaction || subaction === 'plan') return deployPlan(options);
    fail('USAGE', 'deploy plan/run/status 중 선택해 주세요.');
  }
  if (action === 'serve') {
    const port = Number(options.port || 18080); if (!Number.isInteger(port) || port < 1 || port > 65535) fail('USAGE', '포트 번호를 확인해 주세요.');
    const { createServer } = require('../../scripts/serve-test'); const server = createServer();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    process.stderr.write(`TripLOG preview: http://127.0.0.1:${port}/Travel\n`);
    await new Promise(resolve => { const stop = () => { server.closeAllConnections(); server.close(resolve); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); });
    return { stopped: true };
  }
  let script;
  if (action === 'test') { script = scripts[options.suite || 'all']; if (!script) fail('USAGE', `suite: ${Object.keys(scripts).join(', ')}`); }
  else if (action === 'build') script = 'build';
  else if (action === 'artifacts') script = 'artifacts:check';
  else fail('USAGE', 'dev serve/test/build/doctor/artifacts/deploy 중 선택해 주세요.');
  if (options.dryRun) return { dryRun: true, command: ['npm', 'run', script], cwd: root };
  await npm(['run', script]); return { script, status: 'passed' };
}
module.exports = { execute, doctor, deployPlan, deployRun, deployStatus, statusPaths, validateFiles };
