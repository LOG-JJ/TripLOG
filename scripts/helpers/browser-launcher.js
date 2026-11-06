const { chromium } = require('playwright');

function launchBrowser(options = {}) {
  return chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    ...options,
  });
}

module.exports = { launchBrowser };
