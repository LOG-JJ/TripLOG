const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assets = require('./app-assets');
const { appleIcons } = require('./helpers/app-icons');

const root = assets.root, icons = appleIcons(root), deployed = new Set(assets.deploymentFiles());
const links = file => [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/<link\b[^>]*rel="apple-touch-icon"[^>]*>/g)].map(([tag]) => ({
  size: Number(tag.match(/sizes="(\d+)x\d+"/)?.[1] || 180), href: tag.match(/href="([^"]+)"/)[1],
}));
const primary = links('Travel.html'), entry = links('index.html');
assert.equal(primary.length, 5, 'Default and four device sizes are declared before app startup');
assert.deepEqual(entry, primary, 'Root bookmarks and the app declare identical Home Screen icons');
for (const link of primary) {
  assert(!link.href.includes('?'), 'iOS artwork changes use a new pathname');
  const image = fs.readFileSync(path.join(root, link.href));
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), link.size);
  assert.equal(image.readUInt32BE(20), link.size);
  const source = fs.readFileSync(path.join(root, `icons/triplog-icon-${link.size}.png`));
  assert.deepEqual(image, source, 'The approved icon pixels are preserved exactly');
  const digest = crypto.createHash('sha256').update(image).digest('hex').slice(0, 12);
  assert(link.href.includes(digest), 'The icon pathname follows its actual bytes');
  assert(deployed.has(link.href.slice(1)), 'Every declared icon enters the deployment');
}
assert.equal(icons.length, 4);
assert(!assets.isCurrentAsset('icons/apple-touch-icon-180-000000000000.png'), 'Old generated revisions are excluded from future app caches');
assert(deployed.has('apple-touch-icon.png'), 'The conventional root fallback remains available');
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /apple-mobile-web-app-title" content="TripLOG/);
console.log('PASS app icons: exact PNG artwork/sizes, content-versioned iOS paths, root/app metadata parity, deployment inclusion and legacy fallback.');
