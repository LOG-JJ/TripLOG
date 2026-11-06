const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { root, deploymentFiles, sourceFile } = require('./app-assets');
const { securityHeaders } = require('./helpers/security-headers');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain', '.gz': 'application/gzip' };
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

function createServer({ pagesRedirects = false } = {}) {
  const publicFiles = new Set(deploymentFiles().filter(file => !file.startsWith('_')));
  const headers = securityHeaders();
  return http.createServer(async (req, res) => {
    for (const [name, value] of Object.entries(headers)) if (!res.hasHeader(name)) res.setHeader(name, value);
    res.setHeader('Cache-Control', 'no-store');
    try {
      const host = new URL(`http://${req.headers.host || ''}`);
      if (!loopbackHosts.has(host.hostname) || host.username || host.password) { res.writeHead(403).end(); return; }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
      const requested = new URL(req.url, host.origin);
      let pathname = decodeURIComponent(requested.pathname);
      if (pagesRedirects && ['/Travel.html', '/index.html'].includes(pathname)) {
        res.writeHead(308, { Location: (pathname === '/Travel.html' ? '/Travel' : '/') + requested.search }).end(); return;
      }
      if (['/', '/Travel', '/index.html'].includes(pathname)) pathname = '/Travel.html';
      if (pathname === '/repair') pathname = '/repair.html';
      const publicFile = pathname.slice(1);
      if (!publicFiles.has(publicFile)) { res.writeHead(404).end(); return; }
      const file = await fs.realpath(path.join(root, sourceFile(publicFile)));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(publicFile)] || 'application/octet-stream', 'Content-Length': data.length });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (_) { res.writeHead(404).end(); }
  });
}
if (require.main === module) createServer().listen(Number(process.env.PORT) || 18080, '127.0.0.1', () => console.log(`TripLOG preview: http://127.0.0.1:${Number(process.env.PORT) || 18080}/Travel.html`));
module.exports = { createServer };
