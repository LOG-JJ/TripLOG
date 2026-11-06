const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { inspectText } = require('../scripts/security-check');
const { isSafeDeploymentFile, root, sourceFile } = require('../scripts/app-assets');
const { inspectArtifactLayout } = require('../scripts/artifacts-check');
const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const { createServer } = require('../scripts/serve-test');

async function main() {
  const privateKey = '-----BEGIN ' + 'PRIVATE KEY-----';
  assert.equal(inspectText('header\n' + privateKey)[0].line, 2);
  assert.equal(inspectText('sb_' + 'secret_' + 'a'.repeat(32))[0].rule, 'supabase-secret');
  const jwt = role => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'signature'].join('.');
  assert.equal(inspectText(jwt('service_role'))[0].rule, 'supabase-service-role');
  assert.deepEqual(inspectText(jwt('anon')), []);
  for (const file of ['src/app/.env', 'src/app/config.json', 'src/app/config.js.bak', 'src/assets/report.pdf', 'vendor/token.key', 'src/assets/.hidden/test.png']) assert.equal(isSafeDeploymentFile(file), false, file);
  for (const file of ['src/app/sync/backup.js', 'vendor/receipt-ocr/lang/kor.traineddata.gz', 'src/assets/noto-emoji/LICENSE']) assert.equal(isSafeDeploymentFile(file), true, file);
  const fixture = path.join(artifactDirectory('security'), 'layout-fixture');
  fs.mkdirSync(path.join(fixture, 'artifacts/design/example/browser-captures'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'artifacts/qa/example'), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'artifacts/qa/example/run.log'), 'fixture');
  assert.deepEqual(inspectArtifactLayout(fixture), ['artifacts/design/example/browser-captures/', 'artifacts/qa/example/run.log']);
  for (const file of ['Travel.html', 'index.html', 'repair.html']) assert(!/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(fs.readFileSync(path.join(root, sourceFile(file)), 'utf8')), `${file} has no inline script`);
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const request = (url, options = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: url, ...options }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end();
  });
  try {
    const page = await request('/Travel?page=start');
    assert.equal(page.status, 200);
    assert.match(page.headers['content-security-policy'], /script-src 'self'/);
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    for (const file of ['app.js', 'styles.css', 'site.webmanifest', 'repair.html', 'favicon-32.png', 'apple-touch-icon.png']) {
      assert.equal((await request(`/${file}`, { method: 'HEAD' })).status, 200, `Public URL stays available: ${file}`);
      assert.equal((await request(`/${sourceFile(file)}`, { method: 'HEAD' })).status, 404, `Source is not exposed at a second URL: ${file}`);
    }
    assert.equal((await request('/app.js', { method: 'HEAD' })).body, '');
    assert.equal((await request('/app.js', { method: 'POST' })).status, 405);
    assert.equal((await request('/app.js', { headers: { Host: 'attacker.example' } })).status, 403);
    for (const url of ['/README.md', '/.git/config', '/artifacts/README.md', '/tests/security-regression.js', '/src/%2e%2e%2fREADME.md', '/src/app/data/service-config.js.bak', '/%00']) assert.equal((await request(url)).status, 404, url);
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS security regression: credential detection, deployment boundaries, artifact layout, HTTP methods/host/traversal and security headers.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
