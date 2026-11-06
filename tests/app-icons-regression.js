const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assets = require('../scripts/app-assets');
const { appleIcons, applyAppleIconLinks } = require('../scripts/helpers/app-icons');

const root = assets.root, icons = appleIcons(root), deployed = new Set(assets.deploymentFiles());
const links = file => [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/<link\b[^>]*rel="apple-touch-icon"[^>]*>/g)].map(([tag]) => ({
  size: Number(tag.match(/sizes="(\d+)x\d+"/)?.[1] || 180), href: tag.match(/href="([^"]+)"/)[1],
}));
const primary = links('Travel.html'), entry = links('index.html');
assert.deepEqual(primary.map(link => link.size), [180], 'One inline Apple icon prevents a smaller network alternative from being selected');
assert.deepEqual(entry, primary, 'Root bookmarks and the app declare identical Home Screen icons');
for (const link of primary) {
  const inline = link.href.startsWith('data:image/png;base64,');
  assert.equal(inline, link.size === 180, 'The iPhone icon must not require an installer network request');
  const image = inline ? Buffer.from(link.href.split(',')[1], 'base64') : fs.readFileSync(path.join(root, link.href));
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), link.size);
  assert.equal(image.readUInt32BE(20), link.size);
  const source = fs.readFileSync(path.join(root, `icons/triplog-icon-${link.size}.png`));
  assert.deepEqual(image, source, 'The approved icon pixels are preserved exactly');
  const digest = crypto.createHash('sha256').update(image).digest('hex').slice(0, 12);
  if (!inline) {
    assert(!link.href.includes('?'), 'File-based artwork revisions use a new pathname');
    assert(link.href.includes(digest), 'The icon pathname follows its actual bytes');
    assert(deployed.has(link.href.slice(1)), 'Every declared icon enters the deployment');
  }
}
for (const file of ['Travel.html', 'index.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.equal(applyAppleIconLinks(html, icons, root), html, 'Repeated builds must not duplicate or reorder icon declarations');
  assert.equal((html.match(/data:image\/png;base64,/g) || []).length, 1, 'Only one embedded PNG is needed per entry document');
}
assert.equal(icons.length, 4);
assert(!assets.isCurrentAsset('icons/apple-touch-icon-180-000000000000.png'), 'Old generated revisions are excluded from future app caches');
assert(deployed.has('apple-touch-icon.png'), 'The conventional root fallback remains available');
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /apple-mobile-web-app-title" content="TripLOG/);
console.log('PASS app icons: one inline 180px Apple PNG, exact approved bytes, root/app parity, repeat-build stability and legacy fallback.');
