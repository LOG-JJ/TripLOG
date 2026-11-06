// Local UI preview with synthetic records and no external services.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve-test');
const fixture = require('../tests/fixtures/reservation-pockets');
const emptyFixture = { ...fixture, id: 'reservation-empty-fixture', tripName: '예약을 준비하는 여행', entries: [], travelCompanion: { reservations: [] } };
const root = path.resolve(__dirname, '..');
function createReservationPocketPreview() {
  const staticFiles = createServer({ pagesRedirects: true });
  const user = { id: '00000000-0000-4000-8000-000000000097', email: 'pockets@example.test', user_metadata: { display_name: '예약 목업' } };
  const boot = `<script>(() => {
    if (!localStorage.getItem('reservation-pockets-preview')) {
      localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify([${JSON.stringify(fixture)}, ${JSON.stringify(emptyFixture)}]));
      localStorage.setItem('domesticTravelExpensePlanner.activeTripId.v2', ${JSON.stringify(fixture.id)});
      localStorage.setItem('reservation-pockets-preview', '1');
    }
    const previewTrips = JSON.parse(localStorage.getItem('domesticTravelExpensePlanner.trips.v2') || '[]');
    if (!previewTrips.some(trip => trip.id === 'reservation-empty-fixture')) {
      previewTrips.push(${JSON.stringify(emptyFixture)});
      localStorage.setItem('domesticTravelExpensePlanner.trips.v2', JSON.stringify(previewTrips));
    }
  })();</script>`;
  const sdk = `window.supabase={createClient(){return {
    auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:{user:${JSON.stringify(user)}}},error:null};},async stopAutoRefresh(){}},
    functions:{async invoke(name,{body}){return body.action==='list'?{data:{protocolVersion:2,trips:[]},error:null}:{error:{context:{json:async()=>({code:'NETWORK_ERROR'})}}};}},
    channel(){return {on(){return this;},subscribe(){return this;},track(){},presenceState(){return {};}};},removeChannel(){}
  };}};`;
  return http.createServer((req, res) => {
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
}
if (require.main === module) {
  const server = createReservationPocketPreview();
  server.listen(Number(process.env.PORT) || 18087, '127.0.0.1', () => console.log(`Isolated reservation preview: http://127.0.0.1:${server.address().port}/Travel?page=overview&trip=${fixture.id}`));
}
module.exports = { createReservationPocketPreview };
