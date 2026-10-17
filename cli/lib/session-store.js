'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { home, profileName } = require('./config');
const { atomicWrite, parseJson } = require('./files');
const { fail } = require('./errors');
function protectedData(value, decrypt = false) {
  if (process.platform !== 'win32') fail('UNSUPPORTED', '세션 저장은 Windows DPAPI를 사용합니다. 다른 OS의 자동화는 TRIPLOG_ACCESS_TOKEN을 사용해 주세요.');
  const operation = decrypt ? 'Unprotect' : 'Protect';
  const script = `Add-Type -AssemblyName System.Security; $cliInput = [Console]::In.ReadToEnd(); $cliBytes = [Convert]::FromBase64String($cliInput); $cliProtected = [System.Security.Cryptography.ProtectedData]::${operation}($cliBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($cliProtected))`;
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; child.stdout.on('data', chunk => chunks.push(chunk)); child.stderr.resume();
    child.once('error', () => reject(new Error('Windows 세션 보호 기능을 실행하지 못했습니다.')));
    child.once('close', code => code ? reject(new Error('Windows 세션 보호에 실패했습니다.')) : resolve(Buffer.from(Buffer.concat(chunks).toString().trim(), 'base64')));
    child.stdin.on('error', () => {}); child.stdin.end(Buffer.from(value).toString('base64'));
  });
}
const sessionFile = profile => path.join(home(), 'sessions', `${profileName(profile)}.dpapi`);
async function saveSession(profile, data) {
  const encrypted = await protectedData(Buffer.from(JSON.stringify(data)));
  await atomicWrite(sessionFile(profile), encrypted, { overwrite: true });
}
async function readSession(profile) {
  let bytes;
  try { bytes = await fs.readFile(sessionFile(profile)); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  return parseJson((await protectedData(bytes, true)).toString('utf8'));
}
async function clearSession(profile) { await fs.rm(sessionFile(profile), { force: true }); }
module.exports = { saveSession, readSession, clearSession, protectedData };
