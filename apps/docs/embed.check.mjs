// The cross-origin embed check: proof that the use-this-scene box works as
// written. A page served from one local port imports a scene module from the
// built docs site on another port, the way another site would load a scene
// from https://susegad.asymmetrica.ai, and reaches sg-ready with no console
// errors.
//
// The docs origin is served by a tiny server here rather than tools/serve.mjs
// on purpose: it reads the generated out/docs/_headers and applies its rules,
// which is what Cloudflare Workers does in production. If the CORS rule for
// /packages/* goes missing from _headers, this check fails, because the
// module import cannot cross the port boundary without it.
//
//   node apps/docs/build.mjs --no-verify && node apps/docs/embed.check.mjs
//
// Wired into the site gate (apps/docs/site.check.mjs), which spawns this
// after its own checks; tools/checks.mjs scans packages/ and recipes/ only,
// and tools/checks.mjs itself is not in this rung's write boundary.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { REPO_ROOT } from '../../tools/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.SG_DOCS_OUT ? path.resolve(process.env.SG_DOCS_OUT) : path.join(REPO_ROOT, 'out', 'docs');
const FIXTURE = path.join(REPO_ROOT, 'tools', 'fixtures', 'embed', 'embed.html');

let failed = 0, passed = 0;
const check = (name, ok, detail = '') => {
  ok ? passed++ : failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

if (!fs.existsSync(path.join(OUT, 'registry', 'registry.json'))) {
  console.error('no built site at out/docs. Run: node apps/docs/build.mjs --no-verify');
  process.exit(1);
}

// ── the header-aware docs server ────────────────────────────────────
// _headers' shape is all this needs: a path line, then indented Name: value
// lines, the first path matching applying its headers. Rules merge, which
// does not matter for the one header this check reads.
const ruleBlocks = [];
{
  const lines = fs.readFileSync(path.join(OUT, '_headers'), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim() || lines[i].startsWith('#') || /^\s/.test(lines[i])) continue;
    const rule = lines[i].trim();
    const headers = {};
    while (++i < lines.length && /^\s/.test(lines[i])) {
      const m = /^(\s*)([\w-]+): (.*)$/.exec(lines[i]);
      if (m) headers[m[2]] = m[3];
    }
    i--;
    ruleBlocks.push([rule, headers]);
  }
}
const headersFor = pathname => {
  const out = {};
  for (const [rule, headers] of ruleBlocks) {
    const ok = rule === '/*' || pathname.startsWith(rule.replace(/\*$/, ''));
    if (ok) Object.assign(out, headers);
  }
  return out;
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const docsServer = http.createServer((req, res) => {
  const p = path.join(OUT, path.posix.normalize('/' + decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(OUT + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('404');
  }
  const h = headersFor(new URL(req.url, 'http://x').pathname);
  if (req.headers['x-susegad-strip-cors']) delete h['Access-Control-Allow-Origin']; // the negative proof, below
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream', 'content-length': fs.statSync(p).size, ...h });
  fs.createReadStream(p).pipe(res);
});
const embedServer = http.createServer((req, res) => {
  // the fixture page, with this run's docs origin written in
  const html = fs.readFileSync(FIXTURE, 'utf8').replaceAll('__DOCS_ORIGIN__', DOCS_ORIGIN);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
});

await new Promise(resolve => docsServer.listen(0, '127.0.0.1', resolve));
await new Promise(resolve => embedServer.listen(0, '127.0.0.1', resolve));
const DOCS_ORIGIN = `http://127.0.0.1:${docsServer.address().port}`;
const EMBED_ORIGIN = `http://127.0.0.1:${embedServer.address().port}`;

try {
  check('the generated _headers really gives /packages/* a CORS header', headersFor('/packages/scenes/paus/index.js')['Access-Control-Allow-Origin'] === '*'
    && headersFor('/registry/registry.json')['Access-Control-Allow-Origin'] === '*'
    && headersFor('/start')['Access-Control-Allow-Origin'] === undefined, Object.entries(headersFor('/packages/scenes/paus/index.js')).join(', '));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => errors.push(`request failed ${r.url()}`));
  await page.goto(`${EMBED_ORIGIN}/embed.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 }).catch(() => {});
  const got = await page.evaluate(() => {
    const s = document.querySelector('sg-scene');
    return { ready: window.__ready === true, drawn: !!s?.shadowRoot?.querySelector('.stage canvas, .stage svg'), text: s?.textContent.trim() };
  });
  check('another origin imports the scene module and reaches sg-ready', got.ready, got.ready ? '' : 'no sg-ready within 20s');
  check('the drawing is really on the embedder\'s page', got.drawn, String(got.drawn));
  check('the embedder\'s words sit inside the scene', (got.text || '').includes('Monsoon at the window'), (got.text || '').slice(0, 60));
  check('no console or page errors on the foreign page', errors.length === 0, errors.slice(0, 3).join(' | '));

  // the negative proof: the same page against the same files, with the CORS
  // header stripped, must NOT reach sg-ready. If it did, this check could not
  // fail, and it would prove nothing.
  const page2 = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors2 = [];
  page2.on('pageerror', e => errors2.push(String(e)));
  page2.on('console', m => { if (m.type() === 'error') errors2.push(m.text()); });
  // the marker goes on every request through CDP, and the docs server above
  // strips its CORS header when it sees it
  const cdp = await page2.context().newCDPSession(page2);
  await cdp.send('Network.enable');
  await cdp.send('Network.setExtraHTTPHeaders', { headers: { 'x-susegad-strip-cors': '1' } });
  await page2.goto(`${EMBED_ORIGIN}/embed.html`, { waitUntil: 'load' });
  await page2.waitForTimeout(3000);
  const ready2 = await page2.evaluate(() => window.__ready === true).catch(() => false);
  check('without the CORS header the same embed fails (the check can fail)', !ready2 && errors2.some(e => /CORS|Access-Control|Failed to fetch/i.test(e)), errors2[0]?.slice(0, 90) ?? '');
  await page2.close();
  await browser.close();
} finally {
  await new Promise(r => { docsServer.closeAllConnections?.(); docsServer.close(r); });
  await new Promise(r => { embedServer.closeAllConnections?.(); embedServer.close(r); });
}

console.log(failed ? `${failed} of ${passed + failed} embed checks failed` : `all ${passed} embed checks pass`);
process.exit(failed ? 1 : 0);
