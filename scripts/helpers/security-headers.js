const fs = require('node:fs');
const path = require('node:path');

// Preview the same global security policy that is shipped to the static host.
function securityHeaders(root = path.resolve(__dirname, '../..')) {
  const headers = {};
  let global = false;
  for (const line of fs.readFileSync(path.join(root, '_headers'), 'utf8').split(/\r?\n/)) {
    if (/^\S/.test(line)) { global = line.trim() === '/*'; continue; }
    const match = global && line.match(/^\s+([^:]+):\s*(.+)$/);
    if (match) headers[match[1]] = match[2];
  }
  return headers;
}

module.exports = { securityHeaders };
