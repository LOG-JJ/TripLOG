// Local design preview only. Synthetic trips and an in-memory auth stub;
// CSP prevents external connections. Not included by the production build.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve-test');
const fixtures = require('./fixtures/trip-library');
const root = path.resolve(__dirname, '..');
const staticFiles = createServer({ pagesRedirects: true });
const user = { id: '00000000-0000-4000-8000-000000000098', email: 'preview@example.test', user_metadata: { display_name: 'JJ' } };
const boot = `<script>
(() => {
 const NativeDate=Date, offset=Date.parse('2026-10-03T09:00:00+09:00')-Date.now();
 window.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[NativeDate.now()+offset]));}static now(){return NativeDate.now()+offset;}};
 if(!localStorage.getItem('library-preview-seeded')){
  localStorage.setItem('domesticTravelExpensePlanner.trips.v2',JSON.stringify(${JSON.stringify(fixtures)}));
  localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2','library-osaka');
  localStorage.setItem('library-preview-seeded','1');
 }
})();
</script>`;
const sdk = `window.supabase={createClient(){return {
 auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:{user:${JSON.stringify(user)}}},error:null};},async stopAutoRefresh(){}},
 functions:{async invoke(name,{body}){return body.action==='list'?{data:{protocolVersion:2,trips:[]},error:null}:{error:{context:{json:async()=>({code:'NETWORK_ERROR'})}}};}},
 channel(){return {on(){return this;},subscribe(){return this;},track(){},presenceState(){return {};}};},removeChannel(){}
};}};`;
const server = http.createServer((req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; worker-src 'none'");
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/sw.js') { res.writeHead(404).end(); return; }
  if (['/Travel', '/', '/Travel.html'].includes(url.pathname)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(fs.readFileSync(path.join(root, 'Travel.html'), 'utf8').replace('<head>', '<head>' + boot)); return;
  }
  if (url.pathname.endsWith('/vendor/supabase-js-2.107.0.min.js')) {
    res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' }).end(sdk); return;
  }
  staticFiles.emit('request', req, res);
});
server.listen(Number(process.env.PORT) || 18086, '127.0.0.1', () => console.log(`Isolated TripLOG home preview: http://127.0.0.1:${server.address().port}/Travel?page=start`));
