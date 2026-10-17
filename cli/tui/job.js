'use strict';
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { root } = require('../lib/process-runner');
class Job extends EventEmitter {
  constructor({ args, command = process.execPath, cwd = root, env = process.env, direct = false }) {
    super(); this.command = command; this.args = direct ? args : [path.join(root, 'bin/triplog.js'), ...args, '--json']; this.cwd = cwd; this.env = env; this.cancelled = false; this.finished = false;
  }
  start() {
    if (this.child || this.finished) return;
    const child = this.child = spawn(this.command, this.args, { cwd: this.cwd, env: this.env, windowsHide: true, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8'); let partial = '';
      stream.on('data', data => { partial += data.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, ''); const lines = partial.split(/\r?\n|\r/); partial = lines.pop(); for (const line of lines) this.emit('line', line); if (partial.length > 8192) { this.emit('line', partial.slice(0, 8192)); partial = ''; } });
      stream.on('end', () => { if (partial) this.emit('line', partial); });
    }
    child.once('error', error => { this.emit('line', error.message); this.done(1); });
    child.once('close', code => this.done(code ?? 130));
  }
  done(code) { if (this.finished) return; this.finished = true; this.emit('done', { code, cancelled: this.cancelled }); }
  async cancel() {
    if (!this.child?.pid || this.finished || this.cancelled) return;
    this.cancelled = true;
    if (process.platform === 'win32') await new Promise(resolve => { const killer = spawn('taskkill.exe', ['/PID', String(this.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.once('error', resolve); killer.once('close', resolve); });
    else { try { process.kill(-this.child.pid, 'SIGTERM'); } catch (_) { /* already stopped */ } }
  }
}
module.exports = { Job };
