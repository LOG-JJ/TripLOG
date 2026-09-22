const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'supabase/functions/_shared'), { recursive: true });
fs.copyFileSync(path.join(root, 'src/app/sync/model.js'), path.join(root, 'supabase/functions/_shared/sync-model.js'));
fs.copyFileSync(path.join(root, 'src/app/sync/settlement-model.js'), path.join(root, 'supabase/functions/_shared/settlement-model.js'));
esbuild.buildSync({ stdin: { contents: 'export * from "yjs";', resolveDir: root }, bundle: true, minify: true, format: 'iife', globalName: 'TripLogY', outfile: path.join(root, 'vendor/yjs-13.6.32.min.js'), legalComments: 'eof' });
fs.copyFileSync(path.join(root,'node_modules/yjs/LICENSE'),path.join(root,'vendor/yjs-LICENSE.txt'));
function walk(dir) { return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`):[`${dir}/${entry.name}`]); }
const files = ['Travel.html','index.html','app.js','styles.css','site.webmanifest','favicon-32.png','apple-touch-icon.png',...walk('src'),...walk('vendor'),...walk('icons')].sort();
// A content-derived build ID replaces hand-maintained release labels. Normalize
// our own generated values before hashing so repeated builds are byte-stable.
const versionedAsset = /((?:href|src)="(?:\.\/)?(?:app\.js|styles\.css|(?:src|vendor)\/[^"?]+\.(?:css|js))\?v=)[^"]*(")/g;
const htmlTemplate = fs.readFileSync(path.join(root,'Travel.html'),'utf8')
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
  .replace('__ASSETS__',JSON.stringify(files.map(file=>'/'+file)));
fs.writeFileSync(path.join(root,'sw.js'),source);
