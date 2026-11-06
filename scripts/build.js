const fs = require('node:fs/promises');
const path = require('node:path');
const { root, deploymentFiles, sourceFile } = require('./app-assets');
const outDir = path.join(root, 'dist');

async function build() {
  if (path.resolve(outDir) !== path.join(root, 'dist')) throw new Error('Unsafe build output directory');
  const files = deploymentFiles();
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  for (const file of files) {
    const target = path.join(outDir, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(root, sourceFile(file)), target);
  }
}
build().catch(error => { console.error(error); process.exitCode = 1; });
