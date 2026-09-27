// A tiny static server for the repo root.
//
//   node tools/serve.mjs [port]        (default 5173; 0 picks a free port)
//
// Other tools import startServer({ root, port }) and get back { url, port, close }.
// No caching, correct MIME types for everything the library ships, 404s logged.
// GET /__exists?path=/packages/x.css answers {"exists":true|false} with a 200,
// so the harness can probe optional files without a 404 in the console.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.vtt': 'text/vtt; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
};

export function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

/** Resolve a URL pathname inside root, or null if it escapes root. */
export function resolveInside(root, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const p = path.resolve(root, '.' + path.posix.normalize('/' + decoded));
  const rel = path.relative(root, p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return p;
}

function fileFor(root, pathname) {
  const p = resolveInside(root, pathname);
  if (!p || !fs.existsSync(p)) return null;
  const st = fs.statSync(p);
  if (st.isFile()) return p;
  if (st.isDirectory()) {
    const index = path.join(p, 'index.html');
    if (fs.existsSync(index)) return index;
  }
  return null;
}

/**
 * @param {{ root?: string, port?: number, host?: string, quiet?: boolean, notFoundHtml?: string }} [opts]
 * @param opts.notFoundHtml A file (inside root) to serve, with a 404 status, for
 *   any path that doesn't resolve — Cloudflare Workers' `not_found_handling:
 *   "404-page"`, which serves that page's body AT the missing URL itself, so
 *   its relative references must resolve from the site root, not from the
 *   URL's own depth. Pass this to test that shape locally.
 * @returns {Promise<{ server: http.Server, port: number, url: string, close: () => Promise<void> }>}
 */
export async function startServer({ root = REPO_ROOT, port = 0, host = '127.0.0.1', quiet = false, notFoundHtml } = {}) {
  root = path.resolve(root);
  const notFoundFile = notFoundHtml ? path.resolve(root, notFoundHtml) : null;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__exists') {
      const f = fileFor(root, url.searchParams.get('path') || '');
      res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ exists: !!f }));
    }
    // A directory without a trailing slash: redirect so relative URLs resolve.
    const p = resolveInside(root, url.pathname);
    if (p && !url.pathname.endsWith('/') && fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      res.writeHead(301, { location: url.pathname + '/' + url.search });
      return res.end();
    }
    const file = fileFor(root, url.pathname);
    if (!file) {
      if (!quiet) console.error(`404 ${req.method} ${url.pathname}`);
      if (notFoundFile && fs.existsSync(notFoundFile)) {
        res.writeHead(404, {
          'content-type': mimeFor(notFoundFile),
          'content-length': fs.statSync(notFoundFile).size,
          'cache-control': 'no-store',
        });
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(notFoundFile).pipe(res);
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(`404 ${url.pathname}`);
    }
    res.writeHead(200, {
      'content-type': mimeFor(file),
      'content-length': fs.statSync(file).size,
      'cache-control': 'no-store',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const actual = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  return {
    server,
    port: actual,
    url: `http://${host}:${actual}`,
    close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 5173);
  const s = await startServer({ port });
  console.log(`serving ${REPO_ROOT} at ${s.url}/`);
  console.log(`harness: ${s.url}/tools/harness/scene.html?name=kolam`);
}
