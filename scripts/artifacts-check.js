const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artifactExtension = /\.(?:png|jpe?g|webp|gif|svg|zip|pdf|mp4|webm|log)$/i;
const rootRuntimeImages = new Set(['apple-touch-icon.png', 'favicon-32.png']);

function inspectArtifactLayout() {
  const misplaced = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && !rootRuntimeImages.has(entry.name)
      && (artifactExtension.test(entry.name) || /^(?:triplog-|trip-chooser-)/.test(entry.name))) misplaced.push(entry.name);
    if (entry.isDirectory() && ['.test-output', '.playwright-cli'].includes(entry.name)
      && fs.readdirSync(path.join(root, entry.name)).length) misplaced.push(`${entry.name}/`);
  }
  function inspectDocs(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) inspectDocs(file);
      else if (artifactExtension.test(entry.name)) misplaced.push(file);
    }
  }
  inspectDocs('docs');
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
