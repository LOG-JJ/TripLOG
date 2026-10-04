// Isolated UI preview: synthetic records, fixed mockup date, external services blocked.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve-test');
const fixtures = require('./fixtures/trip-header');
const root = path.resolve(__dirname, '..');
function createTripHeaderPreview({ serviceWorkers = false } = {}) {
  const staticFiles = createServer({ pagesRedirects: true });
  const user = { id: '00000000-0000-4000-8000-000000000096', email: 'header@example.test', user_metadata: { display_name: '여행 헤더' } };
  const boot = `<script>(() => {
    const NativeDate = Date, offset = Date.parse('2026-10-04T09:00:00+09:00') - Date.now();
    window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [NativeDate.now()+offset])); } static now() { return NativeDate.now()+offset; } };
    if (!localStorage.getItem('trip-header-preview')) {
      localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify(${JSON.stringify(fixtures)}));
      localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', 'trip-header-suncheon');
      localStorage.setItem('trip-header-preview', '1');
    }
  })();</script>`;
  const sdk = `window.supabase={createClient(){return {
    auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:{user:${JSON.stringify(user)}}},error:null};},async stopAutoRefresh(){}},
    functions:{async invoke(name,{body}){return body.action==='list'?{data:{protocolVersion:2,trips:[]},error:null}:{error:{context:{json:async()=>({code:'NETWORK_ERROR'})}}};}},
    channel(){return {on(){return this;},subscribe(){return this;},track(){},presenceState(){return {};}};},removeChannel(){}
  };}};`;
  return http.createServer((req, res) => {
    res.setHeader('Content-Security-Policy', `default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; worker-src ${serviceWorkers ? "'self'" : "'none'"}`);
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/sw.js' && !serviceWorkers) { res.writeHead(404).end(); return; }
    if (['/Travel', '/', '/Travel.html'].includes(url.pathname)) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(fs.readFileSync(path.join(root, 'Travel.html'), 'utf8').replace('<head>', '<head>' + boot)); return;
    }
    if (url.pathname.endsWith('/vendor/supabase-js-2.107.0.min.js')) {
      res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' }).end(sdk); return;
    }
    staticFiles.emit('request', req, res);
  });
}
if (require.main === module) {
  const server = createTripHeaderPreview();
  server.listen(Number(process.env.PORT) || 18089, '127.0.0.1', () => console.log(`Isolated trip-header preview: http://127.0.0.1:${server.address().port}/Travel?page=overview&trip=trip-header-suncheon`));
}
module.exports = { createTripHeaderPreview };
