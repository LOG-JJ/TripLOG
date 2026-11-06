const fs = require('node:fs');
const path = require('node:path');
const scenes = require('../src/app/data/destination-scenes');
const { appleIcons } = require('./helpers/app-icons');

const root = path.resolve(__dirname, '..');
const currentAppleIcons = new Set(appleIcons(root).map(icon => icon.file));
const sceneFiles = new Set([
  ...scenes.catalog.flatMap(scene => [scene.src, scene.mobileSrc]),
  ...Object.values(scenes.themes).flatMap(scene => [scene.src, scene.mobileSrc]),
]);
const entryFiles = ['_headers', '_redirects', 'apple-touch-icon.png', 'app.js', 'sw.js',
  'favicon-32.png', 'index.html', 'repair.html', 'site.webmanifest', 'styles.css', 'Travel.html'];
// Source folders can change independently of the URLs used by the app and its caches.
const entrySources = new Map([
  ['app.js', 'src/entry/app.js'],
  ['styles.css', 'src/styles/base.css'],
  ['repair.html', 'src/entry/repair.html'],
  ['site.webmanifest', 'src/entry/site.webmanifest'],
  ['apple-touch-icon.png', 'icons/apple-touch-icon.png'],
  ['favicon-32.png', 'icons/favicon-32.png'],
]);
const relocatedSources = new Set(entrySources.values());
const sourceFile = publicFile => entrySources.get(publicFile) || publicFile;

function walk(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not a deployable asset: ${file}`);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function isSafeDeploymentFile(file) {
  if (entryFiles.includes(file)) return true;
  if (file.split('/').some(part => part.startsWith('.') || /(?:^|[._-])(?:secret|credentials)(?:[._-]|$)/i.test(part))) return false;
  if (/^src\/(?:app|entry)\/.+\.js$/.test(file)) return true;
  if (/^src\/styles\/.+\.css$/.test(file)) return true;
  if (/^(?:src\/assets|icons)\/.+\.(?:png|webp|svg|jpe?g|ico)$/.test(file)) return true;
  if (/^src\/assets\/.+\/(?:LICENSE|NOTICE)$/.test(file)) return true;
  return /^vendor\//.test(file) && /(?:\.(?:js|css|woff2?|png|svg|gz|txt|md)|\/(?:LICENSE|NOTICE))$/i.test(file);
}

function isCurrentAsset(file) {
  if (/^icons\/apple-touch-icon-\d+-[a-f0-9]{12}\.png$/.test(file)) return currentAppleIcons.has(file);
  return !file.startsWith('src/assets/trip-scenes/') || sceneFiles.has(file);
}

function deploymentFiles() {
  const runtimeFiles = [...walk('src'), ...walk('vendor'), ...walk('icons')];
  const runtime = new Set(runtimeFiles);
  for (const [file, source] of entrySources) {
    if (!runtime.has(source)) throw new Error(`Missing source for ${file}: ${source}`);
    if (fs.existsSync(path.join(root, file))) throw new Error(`Use the relocated source for ${file}: ${source}`);
  }
  const files = [...entryFiles, ...runtimeFiles.filter(file => !relocatedSources.has(file))];
  const unsafe = files.filter(file => !isSafeDeploymentFile(file));
  if (unsafe.length) throw new Error(`Unexpected files in runtime directories; move development material outside src/vendor/icons:\n${unsafe.join('\n')}`);
  return files.filter(isCurrentAsset).sort();
}

// Worker source and host configuration must not hash themselves into the build.
function versionedFiles() {
  return deploymentFiles().filter(file => !['sw.js', '_headers', '_redirects', 'repair.html'].includes(file));
}

function shellFiles(files = versionedFiles()) {
  return files.filter(file => !file.startsWith('src/assets/trip-scenes/cities/'));
}

module.exports = { root, walk, deploymentFiles, versionedFiles, shellFiles, isCurrentAsset, isSafeDeploymentFile, sourceFile };
