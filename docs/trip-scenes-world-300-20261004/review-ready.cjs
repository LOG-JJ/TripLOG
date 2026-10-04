// Incremental checks during generation. The final review still runs every city.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const data = require(path.join(root, 'src/app/data/destination-scenes'));
const output = path.join(__dirname, 'browser-cities');
const ids = data.catalog.filter(city => city.dedicated && city.src.includes('/v4/') &&
  fs.existsSync(path.join(root, city.src)) && fs.existsSync(path.join(root, city.mobileSrc)) &&
  ![320, 390, 599, 1440].every(width => fs.existsSync(path.join(output, city.id + '-' + width + '.png')))
).map(city => city.id);
if (!ids.length) {
  console.log('No newly completed city pairs await incremental review.');
  process.exit(0);
}
console.log('Checking ' + ids.length + ' newly completed pairs: ' + ids.join(', '));
const result = spawnSync(process.execPath, [path.join(root, 'scripts/trip-scene-art-browser-regression.js')], {
  cwd: root, stdio: 'inherit', env: { ...process.env, TRIPLOG_SCENE_REVIEW_IDS: ids.join(','), TRIPLOG_UI_SNAPSHOT_DIR: output },
});
process.exit(result.status ?? 1);
