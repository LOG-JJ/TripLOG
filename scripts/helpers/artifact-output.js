const fs = require('node:fs');
const path = require('node:path');

const temporaryRoot = path.resolve(__dirname, '../../artifacts/tmp');

function artifactDirectory(suite) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const run = process.env.TRIPLOG_ARTIFACT_RUN || `${date.year}${date.month}${date.day}`;
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
