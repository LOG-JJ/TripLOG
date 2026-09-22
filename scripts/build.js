const fs = require("node:fs/promises");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "dist");
const deployEntries = [
  "_headers",
  "_redirects",
  "apple-touch-icon.png",
  "app.js",
  "sw.js",
  "favicon-32.png",
  "icons",
  "index.html",
  "repair.html",
  "site.webmanifest",
  "styles.css",
  "Travel.html",
  "src",
  "vendor",
];

async function copyEntry(source, target) {
  const stat = await fs.stat(source);
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    const entries = await fs.readdir(source);
    await Promise.all(entries.map((entry) => (
      copyEntry(path.join(source, entry), path.join(target, entry))
    )));
    return;
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function build() {
  if (path.resolve(outDir) !== path.join(rootDir, "dist")) throw new Error("Unsafe build output directory");
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  for (const entry of deployEntries) {
    await copyEntry(path.join(rootDir, entry), path.join(outDir, entry));
  }
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
