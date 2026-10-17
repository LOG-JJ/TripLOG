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

function applyAppleIconLinks(html, icons, root) {
  const iphone = icons.find(icon => icon.size === 180);
  const inlineIcon = `data:image/png;base64,${fs.readFileSync(path.join(root, iphone.source)).toString('base64')}`;
  const newline = html.includes('\r\n') ? '\r\n' : '\n';
  // Some iOS 27.2 Home Screen installers fail to fetch URL-based icons even
  // though Safari can display them. Embed the existing iPhone PNG at build time.
  // Declare a single 180px source: a smaller network alternative could be
  // selected first. This also covers the 152/167px iPad targets. Conventional
  // PNG files remain available for existing clients and root-icon discovery.
  const declarations = [`<link rel="apple-touch-icon" sizes="180x180" href="${inlineIcon}" />`];
  let replaced = false;
  return html.replace(/^[ \t]*<link\b[^>\r\n]*\brel="apple-touch-icon"[^>\r\n]*>[ \t]*(?:\r?\n|$)/gm, tag => {
    if (replaced) return '';
    replaced = true;
    const indent = tag.match(/^[ \t]*/)[0];
    return declarations.map(declaration => indent + declaration + newline).join('');
  });
}

module.exports = { appleIcons, prepareAppleIcons, applyAppleIconLinks };
