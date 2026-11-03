const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve-test');
const fixture = require('./fixtures/companion-experience');
const root = path.resolve(__dirname, '..');
function createExperiencePreview({ trip = fixture, now = '2026-11-03T09:05:00Z' } = {}) {
  const files = createServer({ pagesRedirects: true });
  const user = { id: '00000000-0000-4000-8000-000000000131', email: 'experience@example.test', user_metadata: { display_name: '목업 확인' } };
  const boot = `<script>(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[${JSON.stringify(now)}]));}static now(){return NativeDate.now();}};if(!localStorage.getItem('companion-experience-preview-v1')){localStorage.setItem('domesticTravelExpensePlanner.trips.v2',JSON.stringify([${JSON.stringify(trip)}]));localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2',${JSON.stringify(trip.id)});localStorage.setItem('companion-experience-preview-v1','1');}})();</script>`;
  const sdk = `window.supabase={createClient(){return {auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:{user:${JSON.stringify(user)}}},error:null};},async stopAutoRefresh(){}},functions:{async invoke(name,{body}){return body.action==='list'?{data:{protocolVersion:2,trips:[]},error:null}:{error:{context:{json:async()=>({code:'NETWORK_ERROR'})}}};}},channel(){return {on(){return this;},subscribe(){return this;},track(){},presenceState(){return {};}};},removeChannel(){}};}};`;
  return http.createServer((req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; worker-src 'none'");
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/sw.js') { res.writeHead(404).end(); return; }
    if (['/Travel', '/', '/Travel.html'].includes(url.pathname)) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(fs.readFileSync(path.join(root, 'Travel.html'), 'utf8').replace('<head>', '<head>' + boot)); return; }
    if (url.pathname.endsWith('/vendor/supabase-js-2.107.0.min.js')) { res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' }).end(sdk); return; }
    files.emit('request', req, res);
  });
}
if (require.main === module) createExperiencePreview().listen(Number(process.env.PORT) || 18131, '127.0.0.1', () => console.log('Synthetic preview: http://127.0.0.1:18131/Travel?page=itinerary&trip=companion-experience-fixture'));
module.exports = { createExperiencePreview };

