'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, deploymentFiles } = require('./app-assets');
function walk(directory) { return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]); }
const files = [...walk('cli'), ...walk('bin')].filter(file => file.endsWith('.js'));
for (const file of files) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
assert(!deploymentFiles().some(file => /^(cli|bin)\//.test(file)), 'Node CLI must not enter the app cache');
const packageJson = require('../package.json');
assert.equal(packageJson.bin.triplog, 'bin/triplog.js');
assert(packageJson.scripts['test:cli']);
assert.equal(packageJson.scripts.terminal, 'node bin/triplog.js ui');
assert(packageJson.scripts.test.includes('test:terminal'));
console.log(`PASS CLI source: ${files.length} modules parse; CLI excluded from app distribution.`);
