const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const crypto = require('node:crypto');
const assets = require('./app-assets');
const { prepareAppleIcons, applyAppleIconLinks } = require('./helpers/app-icons');
const root = assets.root;
fs.mkdirSync(path.join(root, 'supabase/functions/_shared'), { recursive: true });
fs.copyFileSync(path.join(root, 'src/app/sync/model.js'), path.join(root, 'supabase/functions/_shared/sync-model.js'));
fs.copyFileSync(path.join(root, 'src/app/sync/settlement-model.js'), path.join(root, 'supabase/functions/_shared/settlement-model.js'));
esbuild.buildSync({ stdin: { contents: 'export * from "yjs";', resolveDir: root }, bundle: true, minify: true, format: 'iife', globalName: 'TripLogY', outfile: path.join(root, 'vendor/yjs-13.6.32.min.js'), legalComments: 'eof' });
fs.copyFileSync(path.join(root,'node_modules/yjs/LICENSE'),path.join(root,'vendor/yjs-LICENSE.txt'));
// Pin and ship the drag engine with the offline app shell, without a runtime CDN.
esbuild.buildSync({ stdin: { contents: 'export {DragDropManager, PointerSensor, PointerActivationConstraints, Feedback, AutoScroller, Accessibility} from "@dnd-kit/dom"; export {Sortable} from "@dnd-kit/dom/sortable"; export {pointerIntersection} from "@dnd-kit/collision";', resolveDir: root }, bundle: true, minify: true, format: 'iife', globalName: 'TripLogDnd', outfile: path.join(root, 'vendor/dnd-kit-dom-0.5.1.min.js'), legalComments: 'eof' });
const dragLicenses = ['@dnd-kit/dom', '@dnd-kit/abstract', '@dnd-kit/state', '@dnd-kit/geometry', '@dnd-kit/collision', '@preact/signals-core', 'tslib'].map(name => {
  const directory = path.join(root, 'node_modules', name);
  const license = fs.readdirSync(directory).find(file => /^licen[sc]e(?:[._-]|$)/i.test(file));
  return `${name}\n${fs.readFileSync(path.join(directory, license), 'utf8')}`;
});
fs.writeFileSync(path.join(root, 'vendor/dnd-kit-LICENSES.txt'), dragLicenses.join('\n\n---\n\n'));
// Keep splash and screen choreography available in the installed offline app.
esbuild.buildSync({ stdin: { contents: 'export {animate, stagger} from "motion";', resolveDir: root }, bundle: true, minify: true, format: 'iife', globalName: 'TripLogMotion', outfile: path.join(root, 'vendor/motion-14.3.0.min.js'), legalComments: 'eof' });
const motionLicenses = ['motion', 'framer-motion', 'motion-dom', 'motion-utils', 'tslib'].map(name => {
  const directory = path.join(root, 'node_modules', name);
  const license = fs.readdirSync(directory).find(file => /^licen[sc]e(?:[._-]|$)/i.test(file));
  return `${name}\n${fs.readFileSync(path.join(directory, license), 'utf8')}`;
});
fs.writeFileSync(path.join(root, 'vendor/motion-LICENSES.txt'), motionLicenses.join('\n\n---\n\n'));
// Tiny offline tools are loaded only when sun/QR is opened. Never use a QR web service.
esbuild.buildSync({ stdin: { contents: 'import sunCalc from "suncalc"; import qrcode from "qrcode-generator"; qrcode.stringToBytes = value => Array.from(new TextEncoder().encode(value)); export {sunCalc,qrcode};', resolveDir: root }, bundle: true, minify: true, format: 'iife', globalName: 'TripLogToolsVendor', outfile: path.join(root, 'vendor/travel-tools.min.js'), legalComments: 'eof' });
fs.writeFileSync(path.join(root,'vendor/travel-tools-LICENSES.txt'), 'suncalc\n'+fs.readFileSync(path.join(root,'node_modules/suncalc/LICENSE'),'utf8')+'\n\nqrcode-generator\n'+fs.readFileSync(path.join(root,'node_modules/qrcode-generator/dist/qrcode.js'),'utf8').split('var qrcode')[0]);
// Icon URLs follow the actual artwork so manifest/favicon caches update without
// another hand-maintained release label when the app image changes.
const iconFiles = ['favicon-32.png', 'apple-touch-icon.png', ...assets.deploymentFiles().filter(file => /^icons\/[^/]+\.png$/.test(file) && !file.startsWith('icons/apple-touch-icon-'))].sort();
const iconDigest = crypto.createHash('sha256');
for (const file of iconFiles) { iconDigest.update(file); iconDigest.update(fs.readFileSync(path.join(root, assets.sourceFile(file)))); }
const iconVersion = iconDigest.digest('hex').slice(0, 12);
// File-based fallbacks follow artwork revisions; the iPhone declaration embeds
// the same PNG so the Home Screen installer needs no separate icon request.
const appleIcons = prepareAppleIcons(root);
const updateIconLinks = html => applyAppleIconLinks(html, appleIcons, root)
  .replace(/(href="\/(?:site\.webmanifest|favicon-32\.png|apple-touch-icon\.png|icons\/triplog-icon-\d+\.png))(?:\?[^"]*)?(")/g, (_, prefix, suffix) => `${prefix}?v=${iconVersion}${suffix}`);
const indexPath = path.join(root, 'index.html');
fs.writeFileSync(indexPath, updateIconLinks(fs.readFileSync(indexPath, 'utf8')));
const manifestPath = path.join(root, assets.sourceFile('site.webmanifest'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const icon of manifest.icons || []) {
  if (/^\/icons\/triplog-icon-\d+\.png(?:\?.*)?$/.test(icon.src)) icon.src = `${icon.src.split('?')[0]}?v=${iconVersion}`;
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const files = assets.versionedFiles();
// City illustrations are optional content. Installing a new app shell must not
// download the whole destination catalog or depend on every city image loading.
const shellFiles = assets.shellFiles(files);
// A content-derived build ID replaces hand-maintained release labels. Normalize
// our own generated values before hashing so repeated builds are byte-stable.
const versionedAsset = /((?:href|src)="(?:\.\/)?(?:app\.js|styles\.css|(?:src|vendor)\/[^"?]+\.(?:css|js))\?v=)[^"]*(")/g;
const htmlTemplate = updateIconLinks(fs.readFileSync(path.join(root,'Travel.html'),'utf8'))
  .replace(/(<meta name="triplog-build" content=")[^"]*("\s*\/>)/, '$1development$2')
  .replace(versionedAsset, '$1development$2');
// Git can check out the same text with different line endings on Windows and on
// the build host. Keep the release ID stable without changing the deployed bytes.
const textAsset = /(?:\.(?:html|js|css|svg|json|webmanifest|txt|md)|\/(?:LICENSE|NOTICE))$/;
const normalizeLineEndings = content => content.toString('utf8').replaceAll('\r\n', '\n');
const digest = crypto.createHash('sha256');
for (const file of files) {
  const content = file === 'Travel.html' ? htmlTemplate : fs.readFileSync(path.join(root, assets.sourceFile(file)));
  // Vendored OCR files are checksum-pinned byte for byte.
  const normalize = textAsset.test(file) && !file.startsWith('vendor/receipt-ocr/');
  digest.update(file);
  digest.update(normalize ? normalizeLineEndings(content) : content);
}
const template = fs.readFileSync(path.join(__dirname,'service-worker-template.js'),'utf8');
// Worker-only repairs must not overwrite the active version's cache in place.
digest.update(normalizeLineEndings(template));
const buildId = digest.digest('hex').slice(0,20);
fs.writeFileSync(path.join(root,'Travel.html'),htmlTemplate
  .replace('name="triplog-build" content="development"',`name="triplog-build" content="${buildId}"`)
  .replace(versionedAsset, (_,prefix,suffix)=>prefix+buildId+suffix));
const source = template
  .replace('__CACHE_NAME__',JSON.stringify(`triplog-shell-${buildId}`))
  .replace('__BUILD_ID__',JSON.stringify(buildId))
  .replace('__ASSETS__',JSON.stringify(shellFiles.map(file=>'/'+file)));
fs.writeFileSync(path.join(root,'sw.js'),source);
