// Read-only comparison of the active artwork and runtime against the public site.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const data = require(path.join(root, 'src/app/data/destination-scenes'));
const origin = new URL(process.argv[2] || 'https://triplog-5qs.pages.dev').origin;
const checkedAt = new Date().toISOString();
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const textLF = value => value.toString('utf8').replaceAll('\r\n', '\n');
const htmlBuild = value => value.match(/<meta name="triplog-build" content="([a-f0-9]{20})"/i)?.[1];
const swBuild = value => value.match(/const BUILD = "([a-f0-9]{20})"/)?.[1];
const imagePaths = [...new Set([...data.catalog.filter(city => city.dedicated), ...Object.values(data.themes)].flatMap(item => [item.src, item.mobileSrc]))];
const textPaths = ['src/app/data/destination-scenes.js', 'src/app/shared/destination-scenes.js', 'src/styles/trip-hero.css', 'Travel.html', 'sw.js'];
const paths = [...imagePaths, ...textPaths];
assert.equal(imagePaths.length, 650, 'Exactly 650 active image paths');
assert(imagePaths.every(file => typeof file === 'string' && file.startsWith('src/assets/trip-scenes/') && file.endsWith('.webp')));
assert(paths.every(file => fs.existsSync(path.join(root, file))), 'All local outputs must exist before public verification');

async function request(file) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = new URL('/' + file, origin);
      url.searchParams.set('triplog-scene-check', checkedAt);
      const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return { bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || '', status: response.status };
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

async function main() {
  const publicTravel = await request('Travel.html');
  const localBuild = htmlBuild(textLF(fs.readFileSync(path.join(root, 'Travel.html'))));
  const publicBuild = htmlBuild(textLF(publicTravel.bytes));
  assert(localBuild && publicBuild, 'Both local and public HTML must identify their build');
  let publicSwBuild;
  const results = new Array(paths.length);
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const index = next++, file = paths[index];
      try {
        const local = fs.readFileSync(path.join(root, file));
        const remote = file === 'Travel.html' ? publicTravel : await request(file);
        const isImage = file.endsWith('.webp');
        const mimeMatches = isImage ? /^image\/webp\b/i.test(remote.contentType) : file.endsWith('.css') ? /^text\/css\b/i.test(remote.contentType) : file.endsWith('.html') ? /^text\/html\b/i.test(remote.contentType) : /javascript/i.test(remote.contentType);
        let localComparable = local, remoteComparable = remote.bytes;
        let comparison = 'exact bytes';
        if (!isImage) {
          localComparable = textLF(local); remoteComparable = textLF(remote.bytes);
          comparison = 'UTF-8 text with CRLF normalized to LF';
          if (file === 'Travel.html' || file === 'sw.js') {
            if (file === 'sw.js') {
              assert.equal(swBuild(localComparable), localBuild, 'Local service worker and HTML build match');
              publicSwBuild = swBuild(remoteComparable);
            }
            localComparable = localComparable.replaceAll(localBuild, '__KNOWN_BUILD__');
            remoteComparable = remoteComparable.replaceAll(publicBuild, '__KNOWN_BUILD__');
            comparison += '; only the identified local/public build fingerprints replaced';
          }
        }
        const contentMatches = sha(localComparable) === sha(remoteComparable);
        results[index] = { file, status: remote.status, contentType: remote.contentType, mimeMatches, contentMatches, comparison, localSha256: sha(local), publicSha256: sha(remote.bytes), localBytes: local.length, publicBytes: remote.bytes.length, passed: mimeMatches && contentMatches };
      } catch (error) { results[index] = { file, passed: false, error: error.message }; }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  const buildsAgree = publicSwBuild === publicBuild;
  const failed = results.filter(result => !result.passed);
  const report = { status: failed.length === 0 && buildsAgree ? 'matched' : 'mismatch', checkedAt, origin, localBuild, publicBuild, publicSwBuild, buildsAgree, images: imagePaths.length, checked: results.length, failed: failed.length, results };
  fs.writeFileSync(path.join(__dirname, 'production-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checked: report.checked, images: report.images, failed: report.failed, buildsAgree, localBuild, publicBuild, failedFiles: failed.map(result => result.file) }));
  if (report.status !== 'matched') process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
