const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');
const suites = require('./browser-suites');
const assets = require('./app-assets');
const { inspectArtifactLayout } = require('./artifacts-check');

const loader = fs.readFileSync(path.join(assets.root, 'app.js'), 'utf8');
const modules = [...loader.matchAll(/^\s+"([^"\n]+\.js)",/gm)].map(match => `src/app/${match[1]}`);
// The entry splash intentionally runs before the ordered app loader.
modules.push('src/app/bootstrap/entry-splash.js');
assert.equal(new Set(modules).size, modules.length, 'No duplicate app modules');
for (const file of modules) {
  const source = fs.readFileSync(path.join(assets.root, file), 'utf8');
  new vm.Script(source, { filename: file });
}
const sheets = ['styles.css', ...assets.walk('src/styles').filter(file => file.endsWith('.css'))];
for (const file of sheets) {
  const { warnings } = esbuild.transformSync(fs.readFileSync(path.join(assets.root, file), 'utf8'), { loader: 'css', sourcefile: file, logLevel: 'silent' });
  assert.deepEqual(warnings.map(warning => `${file}:${warning.location?.line} ${warning.text}`), [], 'CSS must parse without warnings');
}
const available = fs.readdirSync(__dirname).filter(file => file.endsWith('-browser-regression.js'));
for (const file of available) assert(suites.includes(file), `${file} is missing from the browser runner`);
for (const file of suites) assert(fs.existsSync(path.join(__dirname, file)), `Missing browser suite: ${file}`);
assert.equal(new Set(suites).size, suites.length, 'No duplicate browser suites');
const deployed = new Set(assets.deploymentFiles());
assert.deepEqual(inspectArtifactLayout(), [], 'Generated outputs belong under artifacts/');
assert([...deployed].every(file => !file.startsWith('artifacts/')), 'Development artifacts must never enter the deployed app');
const sceneData = require('../src/app/data/destination-scenes');
for (const scene of [...sceneData.catalog, ...Object.values(sceneData.themes)]) {
  assert(deployed.has(scene.src)); assert(deployed.has(scene.mobileSrc));
}
assert(assets.shellFiles().every(file => !file.startsWith('src/assets/trip-scenes/cities/')), 'City art is fetched on demand');
console.log(`PASS source integrity: ${modules.length} loadable modules, ${sheets.length} valid stylesheets, ${suites.length} registered browser suites and complete current artwork.`);
