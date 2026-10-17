const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const appleSizes = [120, 152, 167, 180];

function appleIcons(root) {
  return appleSizes.map(size => {
    const source = `icons/triplog-icon-${size}.png`;
    const bytes = fs.readFileSync(path.join(root, source));
    const digest = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    return { size, source, file: `icons/apple-touch-icon-${size}-${digest}.png` };
  });
}

function prepareAppleIcons(root) {
  const icons = appleIcons(root);
  for (const icon of icons) fs.copyFileSync(path.join(root, icon.source), path.join(root, icon.file));
  return icons;
}

function applyAppleIconLinks(html, icons) {
  return html.replace(/<link\b[^>]*\brel="apple-touch-icon"[^>]*>/g, tag => {
    const size = Number(tag.match(/\bsizes="(\d+)x\d+"/)?.[1] || 180);
    const icon = icons.find(icon => icon.size === size) || icons.find(icon => icon.size === 180);
    return tag.replace(/\bhref="[^"]*"/, `href="/${icon.file}"`);
  });
}

module.exports = { appleIcons, prepareAppleIcons, applyAppleIconLinks };
