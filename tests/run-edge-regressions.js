const { spawnSync } = require('node:child_process');
const path = require('node:path');

// The Edge handler imports its pinned npm dependencies directly. Do not install
// the unrelated browser package.json graph or modify the frontend node_modules.
const result = spawnSync(process.env.DENO_BINARY || 'deno', [
  'test', '--node-modules-dir=none', '--no-lock', '--allow-env',
  'supabase/functions/triplog-sync/handler_test.ts',
], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, DENO_NO_PACKAGE_JSON: '1' },
  stdio: 'inherit', windowsHide: true,
});
if (result.error) {
  console.error(result.error.code === 'ENOENT'
    ? 'Deno is required for Edge tests. Install the CI-pinned Deno runtime or set DENO_BINARY to its executable.'
    : result.error.message);
}
process.exitCode = result.status ?? 1;
