'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { root, deploymentFiles, sourceFile } = require('./app-assets');

function inspectText(text) {
  const findings = [];
  const rules = [
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
    ['supabase-secret', /\bsb_secret_[a-zA-Z0-9_-]{20,}/g],
    ['github-token', /\bgh[pousr]_[a-zA-Z0-9]{30,}/g],
    ['github-fine-grained-token', /\bgithub_pat_[a-zA-Z0-9_]{50,}/g],
    ['openai-secret', /\bsk-(?:(?:proj-|svcacct-)[a-zA-Z0-9_-]{30,}|[a-zA-Z0-9]{48})\b/g],
  ];
  for (const [rule, pattern] of rules) for (const match of text.matchAll(pattern)) findings.push({ rule, line: text.slice(0, match.index).split('\n').length });
  for (const match of text.matchAll(/\beyJ[a-zA-Z0-9_-]+\.([a-zA-Z0-9_-]+)\.[a-zA-Z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[1], 'base64url').toString()).role === 'service_role') findings.push({ rule: 'supabase-service-role', line: text.slice(0, match.index).split('\n').length });
    } catch (_) { /* Not a JWT payload. */ }
  }
  return findings;
}

function inspectRepository() {
  const deployed = deploymentFiles();
  const files = [...new Set([...execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\0').filter(Boolean), ...deployed.map(sourceFile)])];
  const findings = [];
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink()) continue;
    if (/(?:^|\/)(?:\.env(?:\..+)?|[^/]+\.(?:pem|key|p12|pfx|dpapi))$/i.test(file) && !/\.env\.(?:example|sample)$/.test(file)) findings.push({ file, rule: 'credential-file', line: 1 });
    if (!/\.(?:[cm]?js|ts|json|webmanifest|html|md|txt|ya?ml|toml|sql|ps1|bat|cmd|py)$/.test(file)) continue;
    for (const finding of inspectText(fs.readFileSync(absolute, 'utf8'))) findings.push({ file, ...finding });
  }
  for (const file of deployed.filter(file => /^(?:artifacts|tests|scripts|cli|bin|docs|supabase)\//.test(file))) findings.push({ file, rule: 'non-runtime-deployment', line: 1 });
  for (const file of deployed.map(sourceFile).filter(file => /^(?:src\/|Travel\.html$|index\.html$)/.test(file) && /\.(?:js|html)$/.test(file))) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of text.matchAll(/<[a-z][^>\n]*\son[a-z]+\s*=/gi)) findings.push({ file, rule: 'inline-event-handler', line: text.slice(0, match.index).split('\n').length });
  }
  return { findings, inspected: files.length, deployed: deployed.length };
}

if (require.main === module) {
  const { findings, inspected, deployed } = inspectRepository();
  if (findings.length) {
    // Never print matched credentials or source lines.
    console.error(findings.map(item => `${item.file}:${item.line} ${item.rule}`).join('\n'));
    process.exitCode = 1;
  } else console.log(`PASS security checks: ${inspected} repository paths, ${deployed} allowed deployment files; no recognized private credentials.`);
}
module.exports = { inspectText, inspectRepository };
