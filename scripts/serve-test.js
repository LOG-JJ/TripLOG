const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.txt':'text/plain' };
function createServer({ pagesRedirects = false } = {}) {
  return http.createServer(async(req,res)=>{
    try {
      const requested = new URL(req.url,'http://localhost');
      let pathname=decodeURIComponent(requested.pathname);
      if(pagesRedirects && ['/Travel.html','/index.html'].includes(pathname)) {
        res.writeHead(308,{Location:(pathname==='/Travel.html'?'/Travel':'/')+requested.search}).end();return;
      }
      if(['/', '/Travel','/index.html'].includes(pathname))pathname='/Travel.html';
      if(pathname==='/repair')pathname='/repair.html';
      if(!/^\/(src\/|vendor\/|icons\/|Travel\.html$|repair\.html$|app\.js$|sw\.js$|styles\.css$|site\.webmanifest$|favicon-32\.png$|apple-touch-icon\.png$)/.test(pathname)){res.writeHead(404).end();return;}
      const file=path.resolve(root,'.'+pathname);
      if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const data=await fs.readFile(file);
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
    }catch(_){res.writeHead(404).end();}
  });
}
if(require.main===module)createServer().listen(Number(process.env.PORT)||18080,'127.0.0.1',()=>console.log(`TripLOG preview: http://127.0.0.1:${Number(process.env.PORT)||18080}/Travel.html`));
module.exports={createServer};
