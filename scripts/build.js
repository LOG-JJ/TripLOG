const fs = require('node:fs/promises');
const path = require('node:path');
const { root, deploymentFiles } = require('./app-assets');
const outDir = path.join(root, 'dist');

async function build() {
  if (path.resolve(outDir) !== path.join(root, 'dist')) throw new Error('Unsafe build output directory');
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  for (const file of deploymentFiles()) {
    const target = path.join(outDir, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(root, file), target);
  }
}
build().catch(error => { console.error(error); process.exitCode = 1; });
