const fs = require('node:fs');
const path = require('node:path');

const temporaryRoot = path.resolve(__dirname, '../../artifacts/tmp');

function artifactDirectory(suite) {
  const run = process.env.TRIPLOG_ARTIFACT_RUN || new Date().toISOString().slice(0, 10).replaceAll('-', '');
  for (const [label, value] of [['run', run], ['suite', suite]]) {
    if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(value) || value === '.' || value === '..') {
      throw new Error(`Invalid artifact ${label}: use a single directory name`);
    }
  }
  const directory = path.join(temporaryRoot, run, suite);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

module.exports = { artifactDirectory };
