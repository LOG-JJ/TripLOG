'use strict';
const codes = { USAGE: 2, INVALID_INPUT: 2, NOT_FOUND: 3, AUTH_REQUIRED: 4, FORBIDDEN: 4, CONFLICT: 5, NETWORK_ERROR: 6, REQUEST_UNCERTAIN: 6, COMMAND_FAILED: 7, UNSUPPORTED: 8 };
class CliError extends Error {
  constructor(code, message, details, exitCode) {
    super(message); this.name = 'CliError'; this.code = code; this.details = details;
    this.exitCode = exitCode || codes[code] || 1;
  }
}
function fail(code, message, details) { throw new CliError(code, message, details); }
module.exports = { CliError, fail };
