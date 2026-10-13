const { spawn } = require('node:child_process');
const path = require('node:path');
const { createServer } = require('./serve-test');
const { startServer, stopServer } = require('./helpers/browser-fixture');
const suites = require('./browser-suites');

async function main() {
  const { server, origin } = await startServer(() => createServer({ pagesRedirects: true }));
  try {
    for (const file of suites) {
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, file)], {
          stdio: 'inherit', env: { ...process.env, TRIPLOG_TEST_URL: origin },
        });
        child.on('error', reject);
        child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${file} failed (${code})`)));
      });
    }
  } finally { await stopServer(server); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
