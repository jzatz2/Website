import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.mp4':'video/mp4', '.pdf':'application/pdf' };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end(); return; }
    const headers = { 'Content-Type':types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-cache', 'Accept-Ranges':'bytes' };
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : stat.size - 1, stat.size - 1);
      if (start > end) { res.writeHead(416).end(); return; }
      res.writeHead(206, { ...headers, 'Content-Range':`bytes ${start}-${end}/${stat.size}`, 'Content-Length':end-start+1 });
      fs.createReadStream(file, {start,end}).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length':stat.size });
      fs.createReadStream(file).pipe(res);
    }
  });
});
server.listen(4174, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4174'));
