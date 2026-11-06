const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artifactExtension = /\.(?:png|jpe?g|webp|gif|svg|zip|pdf|mp4|webm|log)$/i;

function inspectArtifactLayout(base = root) {
  const misplaced = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (entry.isFile() && (artifactExtension.test(entry.name) || /^(?:triplog-|trip-chooser-)/.test(entry.name))) misplaced.push(entry.name);
    if (entry.isDirectory() && ['.test-output', '.playwright-cli', 'test-results', 'playwright-report', 'coverage', 'tmp', 'temp', 'screenshots'].includes(entry.name)
      && fs.readdirSync(path.join(base, entry.name)).length) misplaced.push(`${entry.name}/`);
  }
  function inspectDocs(directory) {
    if (!fs.existsSync(path.join(base, directory))) return;
    for (const entry of fs.readdirSync(path.join(base, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) inspectDocs(file);
      else if (artifactExtension.test(entry.name)) misplaced.push(file);
    }
  }
  inspectDocs('docs');
  function inspectRetained(directory) {
    if (!fs.existsSync(path.join(base, directory))) return;
    for (const entry of fs.readdirSync(path.join(base, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) { misplaced.push(file); continue; }
      if (entry.isDirectory()) {
        if (/^(?:qa|browser(?:-.+)?|exports|__pycache__|node_modules|test-results|playwright-report|coverage)$/.test(entry.name)) misplaced.push(file + '/');
        else inspectRetained(file);
      } else if (/\.(?:log|pdf|zip|tmp|bak|trace)$/i.test(entry.name)
        || (directory.startsWith('artifacts/qa') && /\.(?:py|ps1|cjs|js|html)$/i.test(entry.name))) misplaced.push(file);
    }
  }
  inspectRetained('artifacts/design');
  inspectRetained('artifacts/qa');
  return misplaced.sort();
}

if (require.main === module) {
  const misplaced = inspectArtifactLayout();
  if (misplaced.length) {
    console.error(`Move generated outputs under artifacts/:\n${misplaced.join('\n')}`);
    process.exitCode = 1;
  } else console.log('PASS artifact layout: retained material under artifacts/design or artifacts/qa; temporary outputs under artifacts/tmp.');
}

module.exports = { inspectArtifactLayout };
