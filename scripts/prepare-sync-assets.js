const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const crypto = require('node:crypto');
const assets = require('./app-assets');
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
// Icon URLs follow the actual artwork so manifest/favicon caches update without
// another hand-maintained release label when the app image changes.
const iconFiles = ['favicon-32.png', 'apple-touch-icon.png', ...fs.readdirSync(path.join(root, 'icons')).filter(file => file.endsWith('.png')).map(file => `icons/${file}`)].sort();
const iconDigest = crypto.createHash('sha256');
for (const file of iconFiles) { iconDigest.update(file); iconDigest.update(fs.readFileSync(path.join(root, file))); }
const iconVersion = iconDigest.digest('hex').slice(0, 12);
const manifestPath = path.join(root, 'site.webmanifest');
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
const htmlTemplate = fs.readFileSync(path.join(root,'Travel.html'),'utf8')
  .replace(/(href="\/(?:site\.webmanifest|favicon-32\.png|apple-touch-icon\.png|icons\/triplog-icon-\d+\.png))(?:\?[^"]*)?(")/g, (_, prefix, suffix) => `${prefix}?v=${iconVersion}${suffix}`)
  .replace(/(<meta name="triplog-build" content=")[^"]*("\s*\/>)/, '$1development$2')
  .replace(versionedAsset, '$1development$2');
const digest = crypto.createHash('sha256');
for(const file of files){digest.update(file);digest.update(file==='Travel.html'?htmlTemplate:fs.readFileSync(path.join(root,file)));}
const template = fs.readFileSync(path.join(__dirname,'service-worker-template.js'),'utf8');
// Worker-only repairs must not overwrite the active version's cache in place.
digest.update(template);
const buildId = digest.digest('hex').slice(0,20);
fs.writeFileSync(path.join(root,'Travel.html'),htmlTemplate
  .replace('name="triplog-build" content="development"',`name="triplog-build" content="${buildId}"`)
  .replace(versionedAsset, (_,prefix,suffix)=>prefix+buildId+suffix));
const source = template
  .replace('__CACHE_NAME__',JSON.stringify(`triplog-shell-${buildId}`))
  .replace('__BUILD_ID__',JSON.stringify(buildId))
  .replace('__ASSETS__',JSON.stringify(shellFiles.map(file=>'/'+file)));
fs.writeFileSync(path.join(root,'sw.js'),source);
