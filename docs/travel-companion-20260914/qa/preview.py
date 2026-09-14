"""Isolated, loopback-only QA fixture server. Never included in deployment."""
import base64
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[3]
ART = Path(__file__).resolve().parent
fixture = json.loads((ART / 'fixture.json').read_text(encoding='utf-8'))
stub = """(() => { const show=()=>{els.authGate.hidden=true;els.appShell.hidden=false;els.appShell.setAttribute('aria-hidden','false');document.body.classList.remove('auth-required')}; window.TripLog.register('features.collaboration.tripCollaboration',{setupTripCollaboration:show,renderTripCollaboration:show,getTripMembers:()=>[],manualSyncSupabaseTripState:()=>showToast('검증용 샘플 여행입니다.')}); })();"""

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def respond(self, data, mime):
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if path.endswith('/features/collaboration/trip-collaboration.js'):
            return self.respond(stub.encode(), 'text/javascript; charset=utf-8')
        if path.endswith('/bootstrap/start.js'):
            seed = 'if(!localStorage.getItem(TRIPS_KEY)){const demo={...getFallbackState("companion-demo"),...' + json.dumps(fixture, ensure_ascii=False) + '};localStorage.setItem(TRIPS_KEY,JSON.stringify([demo]));localStorage.setItem(ACTIVE_TRIP_ID_KEY,demo.id);}\n'
            source = (ROOT / 'src/app/bootstrap/start.js').read_text(encoding='utf-8')
            source = source.replace('init();', 'state.itineraryItems.forEach(item=>{if(item.coordinateSource==="coordinate-text")item.coordinateSignature=buildItemCoordinateSignature(item)});init();document.documentElement.dataset.qaReady="true";')
            return self.respond((seed + source).encode(), 'text/javascript; charset=utf-8')
        super().do_GET()

    def do_POST(self):
        name = Path(urlparse(self.path).path).name
        if urlparse(self.path).path.startswith('/__qa/') and name.endswith('.png'):
            data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            (ART / name).write_bytes(base64.b64decode(data))
            return self.respond(b'OK', 'text/plain')
        self.send_error(404)

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8014), Handler).serve_forever()
