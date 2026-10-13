const fs = require('node:fs');
const path = require('node:path');
const scenes = require('../src/app/data/destination-scenes');

const root = path.resolve(__dirname, '..');
const sceneFiles = new Set([
  ...scenes.catalog.flatMap(scene => [scene.src, scene.mobileSrc]),
  ...Object.values(scenes.themes).flatMap(scene => [scene.src, scene.mobileSrc]),
]);
const entryFiles = ['_headers', '_redirects', 'apple-touch-icon.png', 'app.js', 'sw.js',
  'favicon-32.png', 'index.html', 'repair.html', 'site.webmanifest', 'styles.css', 'Travel.html'];

function walk(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function isCurrentAsset(file) {
  return !file.startsWith('src/assets/trip-scenes/') || sceneFiles.has(file);
}

function deploymentFiles() {
  return [...entryFiles, ...walk('src'), ...walk('vendor'), ...walk('icons')].filter(isCurrentAsset).sort();
}

// Worker source and host configuration must not hash themselves into the build.
function versionedFiles() {
  return deploymentFiles().filter(file => !['sw.js', '_headers', '_redirects', 'repair.html'].includes(file));
}

function shellFiles(files = versionedFiles()) {
  return files.filter(file => !file.startsWith('src/assets/trip-scenes/cities/'));
}

module.exports = { root, walk, deploymentFiles, versionedFiles, shellFiles, isCurrentAsset };
