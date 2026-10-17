'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { CliError, fail } = require('./errors');
const root = path.resolve(__dirname, '../..');
function npmEntry() {
  const candidates = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
  if (process.platform === 'win32') {
    try { for (const file of execFileSync('where.exe', ['npm.cmd'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)) candidates.push(path.join(path.dirname(file), 'node_modules/npm/bin/npm-cli.js')); } catch (_) { /* report below */ }
  }
  const match = candidates.find(file => /npm-cli\.js$/.test(file) && fs.existsSync(file));
  if (!match) fail('NOT_FOUND', 'npm-cli.js를 찾을 수 없습니다. npm run cli로 실행하거나 Node/npm 설치를 확인해 주세요.');
  return match;
}
function run(command, args, { cwd = root, capture = false, env = process.env, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [], stderr = [];
    child.stdout.on('data', chunk => { stdout.push(chunk); if (!capture) process.stderr.write(chunk); });
    child.stderr.on('data', chunk => { stderr.push(chunk); if (!capture) process.stderr.write(chunk); });
    child.once('error', () => reject(new CliError('COMMAND_FAILED', `명령을 시작하지 못했습니다: ${path.basename(command)}`)));
    const interrupt = () => child.kill('SIGTERM'); process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    child.once('close', (code, signal) => {
      process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
      const result = { code: code ?? 130, signal, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() };
      if (result.code && !allowFailure) reject(new CliError('COMMAND_FAILED', `${path.basename(command)} 작업이 실패했습니다.`, { exitCode: result.code, ...(capture ? { stderr: result.stderr.slice(-4000) } : {}) }, result.code));
      else resolve(result);
    });
  });
}
const npm = (args, options) => run(process.execPath, [npmEntry(), ...args], options);
module.exports = { root, run, npm, npmEntry };
