import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./app/', import.meta.url)).replace(/[\\/]$/, '');
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.geojson': 'application/geo+json', '.png': 'image/png', '.webp':'image/webp', '.svg': 'image/svg+xml',
};
const port = Number(process.env.PORT || 4173);
const host = process.env.KONTUR_HOST || '127.0.0.1';
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, host, () => {
  const url = 'http://127.0.0.1:' + port + '/';
  console.log('КОНТУР · ' + url);
  if (process.platform === 'win32' && process.argv.includes('--open')) {
    const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url],
      { detached: true, stdio: 'ignore', windowsHide: true });
    browser.on('error', () => console.log('Откройте этот адрес в браузере: ' + url));
    browser.unref();
  }
});
