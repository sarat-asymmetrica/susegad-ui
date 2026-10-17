// Browser check for the offline recipe, on a small site of its own: a real service worker, a first visit, and
// then the network cut for real (the server is stopped, so nothing can answer; Playwright's setOffline is
// also set, and the check says which of them it relied on).
//
//   node packages/recipes/offline/offline.check.mjs        (SG_ENGINE=webkit | firefox for the others)
//
// Checks: the worker registers and takes over; after one visit and the page's list, the page opens with the
// network cut, styled and scripted; a page never visited shows the offline page in the right language; a
// file with the network cut still loads from the copy; and nothing the rules forbid was kept: no POST
// answer, no data file, no other address, no no-store response. Where an engine cannot run a worker in this
// build, the check says so with what the browser said, and does not pass.

import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { harness } from '../../../tools/lib/component-check.mjs';
import { writeSw } from './build.mjs';
import { offlinePage } from './offline.page.js';

const here = dirname(fileURLToPath(import.meta.url));
// The harness owns the browser, the slot and the verdict. The site below is served by this file's own staticServer, not the harness's dev server.
const h = await harness({ axe: 'this check serves a small test site of its own (a page, a stylesheet and a worker), not the demo page: tools/smoke.mjs axes /packages/recipes/offline/demo.html once, at 1280 px in the default register and light theme, and the offline page the worker serves is in no axe check (docs/DEBT.md row 48)' });
const { check, engine } = h;

// ── the little site ──
const root = mkdtempSync(join(tmpdir(), 'sg-offline-'));
const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
const lib = 'susegad/recipes/offline';
for (const f of ['offline.js', 'offline.core.js', 'retry.js', 'recipe.css']) { mkdirSync(join(root, lib), { recursive: true }); copyFileSync(join(here, f), join(root, lib, f)); }
put('app.css', 'body { font-family: serif; } #hello { color: rgb(0, 128, 0); }');
put('data.json', '{"someone": "a persons details"}');
put('secret.txt', 'not for the cache');
put('app.js', "document.getElementById('hello').textContent = 'Hello from the script';");
const page = title => `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="app.css"><script type="module" src="app.js"></script></head><body><p id="hello">no script</p><script type="module">import { registerOffline } from './${lib}/offline.js'; window.__offline = registerOffline({ url: 'sw.js', scope: '/' });</script></body></html>`;
put('index.html', page('Home'));
put('gom-deva/index.html', page('Ghar').replace('./susegad', '../susegad').replace('href="app.css"', 'href="../app.css"').replace('src="app.js"', 'src="../app.js"').replace("url: 'sw.js'", "url: '../sw.js'"));
const PAGES = { '': 'offline.html', 'gom-deva': 'gom-deva/offline.html' };
put('offline.html', offlinePage({ lang: 'en-IN', base: '/', styles: [`${lib}/recipe.css`] }));
put('gom-deva/offline.html', offlinePage({ lang: 'gom-Deva', base: '/', styles: [`${lib}/recipe.css`] }));
writeSw(join(root, 'sw.js'), { version: 'check', scope: '/', offlinePages: PAGES, precache: [`${lib}/recipe.css`, `${lib}/retry.js`] });

// A static server that sends what a real host sends for static files: a type, a length and
// "public, max-age=0, must-revalidate". It is not tools/serve.mjs, which sends no-store on everything: a worker
// (rightly) keeps nothing marked no-store, and Chromium's install of a worker script served no-store stalls its
// own fetches (found 8 October 2026), so the dev server cannot stand in for a host here.
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript' };
async function staticServer(dir) {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dir, p);
    if (!f.startsWith(dir) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'public, max-age=0, must-revalidate' }); return r.end('404'); }
    const b = readFileSync(f);
    r.writeHead(200, { 'content-type': TYPES[f.slice(f.lastIndexOf('.'))] ?? 'application/octet-stream', 'content-length': b.length, 'cache-control': 'public, max-age=0, must-revalidate' });
    r.end(b);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise(r => { srv.closeAllConnections?.(); srv.close(r); }) };
}
let server = await staticServer(root);
const origin = server.url;
// another address, for a request the worker must not touch
const other = http.createServer((q, r) => { r.setHeader('access-control-allow-origin', '*'); r.setHeader('content-type', 'text/javascript'); r.end('window.__other = 1;'); });
await new Promise(r => other.listen(0, '127.0.0.1', r));
const otherUrl = `http://127.0.0.1:${other.address().port}/lib.js`;

const ctx = await h.context({ serviceWorkers: 'allow' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text()); });

try {
  // ── the first visit ──
  await p.goto(`${origin}/`);
  const reg = await p.evaluate(() => window.__offline);
  const supported = reg?.registered === true;
  check(`the worker registers on a first visit (${engine})`, supported, reg ? JSON.stringify(reg) : 'no answer');
  if (!supported) throw new Error(`this ${engine} build did not register a worker: ${reg?.why ?? 'unknown'}`);
  await p.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 8000 }).catch(() => {});
  check('it takes over the open page', await p.evaluate(() => navigator.serviceWorker.controller !== null));
  check('the page told it what it used, and it was more than the page itself', reg.kept >= 3, `${reg.kept} files`);
  const keys = async () => p.evaluate(async () => { const out = []; for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) out.push(r.url); return out; });
  await p.waitForFunction(async () => { const c = await caches.open('sg-offline-check'); return (await c.keys()).length >= 5; }, null, { timeout: 8000 }).catch(() => {});
  const first = await keys();
  const has = path => first.includes(`${origin}${path}`);
  check('after one visit it holds the page, its style, its script and the two offline pages', ['/', '/app.css', '/app.js', '/offline.html', '/gom-deva/offline.html'].every(has), first.map(u => u.replace(origin, '')).join(' '));

  // the other pages of the site and a language folder, visited once
  await p.goto(`${origin}/gom-deva/`);
  await p.evaluate(() => window.__offline);
  await p.waitForTimeout(400);

  // things the rules must refuse, asked of the real worker
  await p.evaluate(async other => {
    await fetch('/api/register', { method: 'POST', body: 'name=x' }).catch(() => {});
    await fetch('/data.json').catch(() => {});
    await fetch('/secret.txt').catch(() => {});
    await fetch(other, { mode: 'no-cors' }).catch(() => {});
  }, otherUrl);
  await p.waitForTimeout(300);

  // ── the network cut, for real ──
  await Promise.race([Promise.resolve(server.close()), new Promise(r => setTimeout(r, 3000))]);
  server = null;
  if (engine !== 'webkit') await ctx.setOffline(true); // the server is stopped, which is the real cut; WebKit's emulation breaks a page a worker should answer
  const gone = await p.evaluate(origin => fetch(`${origin}/not-kept-anywhere.txt`).then(() => 'answered', () => 'failed'), origin);
  check('the network is cut: a file nothing kept cannot be fetched', gone === 'failed', gone);

  // the kept page, with no connection
  const q = await ctx.newPage();
  q.on('pageerror', e => errors.push(String(e)));
  await q.goto(`${origin}/`).catch(e => errors.push(`navigation: ${e.message}`));
  const home = await q.evaluate(() => ({ title: document.title, hello: document.getElementById('hello')?.textContent, colour: getComputedStyle(document.getElementById('hello')).color })).catch(() => null);
  check('with the network cut, the page visited once opens', home?.title === 'Home', JSON.stringify(home));
  check('and it is styled and scripted from the copy (script ran, style applied)', home?.hello === 'Hello from the script' && home?.colour === 'rgb(0, 128, 0)', JSON.stringify(home));
  await q.goto(`${origin}/gom-deva/`).catch(() => {});
  check('the second language page, visited once, opens too', (await q.title().catch(() => '')) === 'Ghar');

  // a page never visited
  await q.goto(`${origin}/never/visited/`).catch(() => {});
  const off = await q.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, lang: document.documentElement.lang, buttons: [...document.querySelectorAll('button')].map(b => `${b.dataset.offline}:${b.hidden}`), colour: getComputedStyle(document.querySelector('h1')).fontFamily !== '' })).catch(() => null);
  check('a page never visited shows the offline page, in English', off?.h1 === 'No connection right now' && off?.lang === 'en-IN', JSON.stringify(off));
  check('the offline page’s two buttons are shown once its script has run (this tab has somewhere to go back to)', off?.buttons.includes('retry:false') && off?.buttons.includes('back:false'), JSON.stringify(off?.buttons));
  await q.goto(`${origin}/gom-deva/never/`).catch(() => {});
  check('a page never visited under the Konkani folder shows the Konkani offline page', (await q.evaluate(() => document.querySelector('h1')?.textContent).catch(() => '')) === 'सध्या जोडणी ना');
  const style = await q.evaluate(() => getComputedStyle(document.querySelector('.sg-offline')).maxWidth).catch(() => '');
  check('the offline page is styled from the copy of its own stylesheet', style !== 'none' && style !== '', style);

  // a file, with no connection
  const file = await q.evaluate(origin => fetch(`${origin}/app.css`).then(r => r.text(), () => 'failed'), origin);
  check('a file the page needs loads from the copy', file.includes('rgb(0, 128, 0)'), file.slice(0, 40));

  // ── what must never be kept ──
  const kept = first.concat(await keys().catch(() => []));
  const bad = kept.filter(u => !u.startsWith(origin) || /\/api\/|\.json/.test(u));
  check('nothing it must not keep was kept: no POST answer, no data file, no other address', bad.length === 0, bad.join(' ') || `${new Set(kept).size} files, all of the site's own`);
  check('no console or page errors on the way', !errors.length, errors.join(' | '));
} catch (e) {
  check(`the check ran to its end (${engine})`, false, String(e.message ?? e));
} finally {
  const closers = [() => new Promise(r => other.close(r)), () => Promise.resolve(server?.close?.())];
  await Promise.race([Promise.allSettled(closers.map(f => f())), new Promise(r => setTimeout(r, 15000))]);
  try { rmSync(root, { recursive: true, force: true }); } catch { /* the temp folder is the system's to clean */ }
}
await h.done();
