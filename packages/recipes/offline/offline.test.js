import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { cacheName, kindOf, isCacheable, keyOf, cacheableResponse, strategy, offlinePageFor, urlsToKeep, CACHE_PREFIX } from './offline.core.js';
import { swSource } from './build.mjs';

const O = 'https://conclave.example.in';
const R = { origin: O, scope: '/' };
const PAGES = { '': 'offline.html', 'gom-deva': 'gom-deva/offline.html', 'gom-latn': 'gom-latn/offline.html' };

test('only the kinds of file a page needs are kept: pages, styles, scripts, fonts, pictures', () => {
  const kinds = { '/': 'page', '/gom-deva/': 'page', '/index.html': 'page', '/site.css': 'asset', '/page.js': 'asset', '/susegad/x.mjs': 'asset', '/f.woff2': 'font', '/f.woff': 'font', '/p.avif': 'asset', '/p.webp': 'asset', '/p.JPG': 'asset', '/i.svg': 'asset' };
  for (const [p, k] of Object.entries(kinds)) assert.equal(kindOf(p), k, p);
  for (const p of ['/api/register', '/data.json', '/ticket.pdf', '/video.mp4', '/archive.zip', '/register', '/x.php', '/map.geojson', '/audio.mp3']) assert.equal(kindOf(p), '', p);
});

test('only a GET, to the site’s own address, inside its folder, for a kept kind', () => {
  const ok = url => isCacheable({ url, ...R });
  assert.ok(ok(`${O}/`) && ok(`${O}/site.css`) && ok(`${O}/gom-deva/`) && ok(`${O}/site.css?v=3`));
  assert.ok(!isCacheable({ url: `${O}/`, method: 'POST', ...R }), 'a POST is never ours');
  assert.ok(!isCacheable({ url: `${O}/`, method: 'PUT', ...R }));
  assert.ok(!ok('https://fonts.googleapis.com/css2?family=Mukta'), 'another address');
  assert.ok(!ok('https://cdn.example.com/lib.js'), 'a script from another address');
  assert.ok(!ok('http://conclave.example.in/'), 'another scheme is another origin');
  assert.ok(!ok(`${O}/api/register`) && !ok(`${O}/data.json`));
  assert.ok(!ok('not a url'));
  assert.ok(isCacheable({ url: `${O}/event/site.css`, origin: O, scope: '/event/' }));
  assert.ok(!isCacheable({ url: `${O}/other/site.css`, origin: O, scope: '/event/' }), 'outside the folder');
});

test('the key has no query and no hash, and a folder and its index page are one page', () => {
  assert.equal(keyOf(`${O}/gom-deva/?register=warm&theme=dark#agenda`), `${O}/gom-deva/`);
  assert.equal(keyOf(`${O}/index.html`), `${O}/`);
  assert.equal(keyOf(`${O}/gom-deva/index.html?x=1`), `${O}/gom-deva/`);
  assert.equal(keyOf(`${O}/offline.html`), `${O}/offline.html`, 'only an index page folds into its folder');
  assert.equal(keyOf(`${O}/notindex.html`), `${O}/notindex.html`);
});

test('a response is kept only when it worked, is our own, and does not say it is private', () => {
  assert.ok(cacheableResponse({ ok: true, type: 'basic', cacheControl: 'public, max-age=60' }));
  assert.ok(cacheableResponse({ ok: true }));
  assert.ok(!cacheableResponse({ ok: false }));
  assert.ok(!cacheableResponse({ ok: true, type: 'cors' }));
  assert.ok(!cacheableResponse({ ok: true, type: 'opaque' }));
  assert.ok(!cacheableResponse({ ok: true, cacheControl: 'no-store' }));
  assert.ok(!cacheableResponse({ ok: true, cacheControl: 'private, max-age=0' }));
  assert.ok(!cacheableResponse({ ok: true, cacheControl: 'max-age=0, No-Store' }));
});

test('a page is answered network first, a file the page needs copy first, anything else not at all', () => {
  const s = (url, mode, method) => strategy({ url: `${O}${url}`, mode, method }, R);
  assert.equal(s('/', 'navigate'), 'page');
  assert.equal(s('/gom-latn/', 'navigate', 'GET'), 'page');
  assert.equal(s('/site.css', 'no-cors'), 'asset');
  assert.equal(s('/f.woff2', 'cors'), 'asset');
  assert.equal(s('/', 'navigate', 'POST'), 'pass');
  assert.equal(s('/api/x', 'cors'), 'pass');
  assert.equal(strategy({ url: 'https://elsewhere.example/x.css' }, R), 'pass');
});

test('the offline page is the one for the language of the page that was asked for', () => {
  assert.equal(offlinePageFor('/gom-deva/', PAGES), '/gom-deva/offline.html');
  assert.equal(offlinePageFor('/gom-latn/index.html', PAGES), '/gom-latn/offline.html');
  assert.equal(offlinePageFor('/', PAGES), '/offline.html');
  assert.equal(offlinePageFor('/agenda/', PAGES), '/offline.html', 'a folder with no page of its own gets the default');
  assert.equal(offlinePageFor('/constructor/', PAGES), '/offline.html', 'a name from Object.prototype is not a folder');
  assert.equal(offlinePageFor('/event/gom-deva/', PAGES, '/event/'), '/event/gom-deva/offline.html');
});

test('after the first visit, the page tells the worker what it used: only what the rules allow, once each', () => {
  const names = [`${O}/`, `${O}/site.css?x=1`, `${O}/site.css`, `${O}/page.js`, 'https://fonts.gstatic.com/s/mukta.woff2', `${O}/api/me`, `${O}/susegad/tokens/fonts/Mukta.woff2`, `${O}/posters/hero.avif`, `${O}/data.json`];
  assert.deepEqual(urlsToKeep(names, R), [`${O}/`, `${O}/site.css`, `${O}/page.js`, `${O}/susegad/tokens/fonts/Mukta.woff2`, `${O}/posters/hero.avif`]);
  assert.equal(urlsToKeep(Array.from({ length: 500 }, (_, i) => `${O}/f${i}.js`), { ...R, max: 50 }).length, 50, 'a ceiling');
});

test('cache names carry the version and a prefix, and nothing odd', () => {
  assert.equal(cacheName('3'), `${CACHE_PREFIX}3`);
  assert.equal(cacheName('v 1/../x'), `${CACHE_PREFIX}v1..x`);
  assert.equal(cacheName(), `${CACHE_PREFIX}1`);
});

// ── the generated worker, run in a fake worker scope ────────────────────

/** A scope with a cache that remembers, a network we can cut, and the events a worker listens to. */
function world({ files = {}, headers = {} } = {}) {
  const listeners = {}, stores = new Map(), log = { fetches: [], skipWaiting: 0, claimed: 0 };
  let online = true;
  class Res {
    constructor(body, init = {}) { this.body = body; this.ok = (init.status ?? 200) < 400; this.status = init.status ?? 200; this.type = init.type ?? 'basic'; this.headers = { get: k => (init.headers ?? {})[k.toLowerCase()] ?? null }; }
    clone() { return Object.assign(Object.create(Res.prototype), this); }
    static error() { const r = new Res('', { status: 0 }); r.ok = false; r.type = 'error'; return r; }
  }
  const mkCache = () => { const m = new Map(); return { m, match: async k => m.get(typeof k === 'string' ? k : k.url), put: async (k, v) => { m.set(typeof k === 'string' ? k : k.url, v); }, add: async () => {} }; };
  const caches = {
    open: async n => { if (!stores.has(n)) stores.set(n, mkCache()); return stores.get(n); },
    keys: async () => [...stores.keys()],
    delete: async n => stores.delete(n),
  };
  const fetch = async req => {
    const url = typeof req === 'string' ? req : req.url;
    log.fetches.push(url);
    if (!online) throw new TypeError('network gone');
    const path = new URL(url).pathname;
    if (!(path in files)) return new Res('', { status: 404 });
    return new Res(files[path], { headers: headers[path] ?? {} });
  };
  const self = { location: new URL(`${O}/sw.js`), addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting: async () => { log.skipWaiting++; }, clients: { claim: async () => { log.claimed++; } } };
  const ctx = vm.createContext({ self, caches, fetch, Response: Res, URL, console, Promise });
  const sw = swSource({ version: '2', scope: '/', offlinePages: PAGES, precache: ['site.css'] });
  vm.runInContext(sw, ctx);
  const done = [];
  const fire = (type, event) => { event.waitUntil = p => done.push(p); listeners[type]?.(event); return Promise.all(done.splice(0)); };
  const request = (path, { mode = 'navigate', method = 'GET', origin = O } = {}) => ({ url: `${origin}${path}`, mode, method });
  const ask = async (path, opts) => {
    let answer = null, handled = false;
    const ev = { request: request(path, opts), respondWith: p => { handled = true; answer = p; } };
    listeners.fetch(ev);
    return handled ? await answer : undefined;
  };
  return { fire, ask, caches, stores, log, Res, cut: () => { online = false; }, restore: () => { online = true; }, listeners };
}
const FILES = { '/': 'home', '/gom-deva/': 'ghar', '/offline.html': 'offline en', '/gom-deva/offline.html': 'offline deva', '/gom-latn/offline.html': 'offline latn', '/site.css': 'css', '/page.js': 'js', '/f.woff2': 'font' };

test('the worker file is one classic script: no import, no export, the settings and the handlers in it', () => {
  const sw = swSource({ version: '2', scope: '/', offlinePages: PAGES });
  assert.ok(!/^(import|export) /m.test(sw));
  assert.match(sw, /const CONFIG = \{/);
  assert.match(sw, /addEventListener\('fetch'/);
  assert.throws(() => swSource({ offlinePages: {} }), /default page/);
  assert.throws(() => swSource({ offlinePages: PAGES, scope: 'x' }), /slash/);
});

test('install keeps the offline pages and the files it was told to, and takes over at once', async () => {
  const w = world({ files: FILES });
  await w.fire('install', {});
  const kept = [...(await w.caches.open('sg-offline-2')).m.keys()].sort();
  assert.deepEqual(kept, [`${O}/gom-deva/offline.html`, `${O}/gom-latn/offline.html`, `${O}/offline.html`, `${O}/site.css`]);
  assert.equal(w.log.skipWaiting, 1);
});

test('activate throws away the caches of older versions, and only ours', async () => {
  const w = world({ files: FILES });
  await w.caches.open('sg-offline-1'); await w.caches.open('sg-offline-2'); await w.caches.open('somebody-elses');
  await w.fire('activate', {});
  assert.deepEqual([...w.stores.keys()].sort(), ['sg-offline-2', 'somebody-elses']);
  assert.equal(w.log.claimed, 1);
});

test('a page is fetched from the network and kept; with the network cut, the kept copy answers', async () => {
  const w = world({ files: FILES });
  assert.equal((await w.ask('/gom-deva/')).body, 'ghar');
  w.cut();
  assert.equal((await w.ask('/gom-deva/')).body, 'ghar', 'offline: the copy kept on the first visit');
  assert.equal((await w.ask('/gom-deva/?register=warm')).body, 'ghar', 'a query is the same page');
});

test('a page never visited, with the network cut, gets the offline page in its language', async () => {
  const w = world({ files: FILES });
  await w.fire('install', {});
  w.cut();
  assert.equal((await w.ask('/gom-deva/unvisited/')).body, 'offline deva');
  assert.equal((await w.ask('/gom-latn/')).body, 'offline latn');
  assert.equal((await w.ask('/news/')).body, 'offline en');
});

test('with nothing kept and the network cut, a page is an honest failure, not a wrong page', async () => {
  const w = world({ files: FILES });
  w.cut();
  const r = await w.ask('/');
  assert.equal(r.ok, false);
});

test('a file the page needs comes from the kept copy first, and the network fills the cache', async () => {
  const w = world({ files: FILES });
  assert.equal((await w.ask('/page.js', { mode: 'no-cors' })).body, 'js');
  const before = w.log.fetches.length;
  assert.equal((await w.ask('/page.js', { mode: 'no-cors' })).body, 'js');
  assert.equal(w.log.fetches.length, before, 'the second time the network is not asked');
  w.cut();
  assert.equal((await w.ask('/page.js', { mode: 'no-cors' })).body, 'js');
});

test('what is not ours is not answered: a POST, another address, a data file', async () => {
  const w = world({ files: { ...FILES, '/data.json': '{}' } });
  assert.equal(await w.ask('/', { method: 'POST' }), undefined);
  assert.equal(await w.ask('/x.css', { origin: 'https://cdn.example.com' }), undefined);
  assert.equal(await w.ask('/data.json', { mode: 'cors' }), undefined);
  assert.equal(await w.ask('/api/register', { mode: 'cors', method: 'POST' }), undefined);
  assert.equal([...(w.stores.get('sg-offline-2')?.m.keys() ?? [])].length, 0, 'nothing was kept for them');
});

test('a response that says no-store or private is shown but never kept', async () => {
  const w = world({ files: FILES, headers: { '/': { 'cache-control': 'private' }, '/page.js': { 'cache-control': 'no-store' } } });
  assert.equal((await w.ask('/')).body, 'home');
  await w.ask('/page.js', { mode: 'no-cors' });
  assert.ok(![...w.stores.get('sg-offline-2').m.keys()].some(k => k.endsWith('/') && !k.includes('offline') || k.endsWith('page.js')), 'neither was kept');
  await w.fire('install', {});
  w.cut();
  assert.equal((await w.ask('/')).body, 'offline en', 'so offline there is only the offline page');
});

test('the page’s list is checked again by the worker: only what the rules allow is kept', async () => {
  const w = world({ files: { ...FILES, '/data.json': '{}', '/api/me': 'me' } });
  await w.fire('message', { data: { type: 'keep', urls: [`${O}/`, `${O}/page.js`, `${O}/data.json`, `${O}/api/me`, 'https://evil.example/x.js', 'x'] } });
  assert.deepEqual([...w.stores.get('sg-offline-2').m.keys()].sort(), [`${O}/`, `${O}/page.js`]);
  await w.fire('message', { data: { type: 'something else' } });
  await w.fire('message', { data: null });
  assert.equal([...w.stores.get('sg-offline-2').m.keys()].length, 2);
});

test('after one visit and a list from the page, the pages open with the network cut', async () => {
  const w = world({ files: FILES });
  await w.fire('install', {});
  assert.equal((await w.ask('/')).body, 'home');
  await w.fire('message', { data: { type: 'keep', urls: [`${O}/`, `${O}/site.css`, `${O}/page.js`, `${O}/f.woff2`] } });
  w.cut();
  assert.equal((await w.ask('/')).body, 'home');
  assert.equal((await w.ask('/f.woff2', { mode: 'cors' })).body, 'font');
});

// ── the offline page ────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { offlinePage } from './offline.page.js';
import { BY_LANG } from './recipe.strings.js';

const page = (lang, o = {}) => offlinePage({ lang, styles: ['susegad/tokens/tokens.css', 'susegad/recipes/offline/recipe.css', 'site.css'], look: 'look.js', ...o });

test('the offline page says it is not the visitor’s fault, what still works and what must wait', () => {
  const html = page('en-IN');
  assert.match(html, /<h1>No connection right now<\/h1>/);
  assert.match(html, /Nothing you did caused this, and it often passes on its own\./);
  assert.match(html, /<h2 id="off-works">Still here for you<\/h2>/);
  assert.match(html, /<li>The event page, if you have opened it before\.<\/li>\s*<li>Your ticket, if you have opened it before\.<\/li>/);
  assert.match(html, /<h2 id="off-not">Waiting for a connection<\/h2>/);
  for (const w of ['Pages you have not opened yet.', 'Registering, and anything that needs us to answer.', 'Maps, and live updates.']) assert.ok(html.includes(w), w);
  assert.ok(!/(sorry|oops|error|failed|!)/i.test(html.replace(/<[^>]+>/g, ' ')), 'no blame, no alarm');
});

test('the two buttons start hidden, so no one sees a button that does nothing', () => {
  const html = page('en-IN');
  assert.match(html, /<button type="button" class="sg-offline-button" data-offline="retry" hidden>Try again<\/button>/);
  assert.match(html, /<button type="button" class="sg-offline-button sg-offline-plain" data-offline="back" hidden>Back<\/button>/);
});

test('every file the page needs is addressed from the site’s folder, because the worker shows it at any address', () => {
  const html = page('gom-Deva', { base: '/event' });
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(refs, ['/event/look.js', '/event/susegad/tokens/tokens.css', '/event/susegad/recipes/offline/recipe.css', '/event/site.css', '/event/susegad/recipes/offline/retry.js']);
  assert.ok(refs.every(r => r.startsWith('/')), 'none is relative');
  assert.match(page('en-IN'), /<html lang="en-IN" data-register="quiet">/);
});

test('Konkani, in both scripts, from the deck; Romi never borrows Devanagari', () => {
  const keys = Object.keys(BY_LANG.en);
  for (const tag of ['gom-Deva', 'gom-Latn']) assert.deepEqual(Object.keys(BY_LANG[tag]), keys, tag);
  assert.match(page('gom-Deva'), /<h1>सध्या जोडणी ना<\/h1>/);
  assert.match(page('gom-Deva'), /<html lang="gom-Deva"/);
  const latn = page('gom-Latn').replace(/<[^>]+>/g, ' ');
  assert.ok(latn.includes('Sodhya jodonni na') && latn.includes('Porot yatn korat') && !/[ऀ-ॿ]/.test(latn));
});

test('words from a site are escaped', () => {
  assert.ok(!page('en-IN', { siteName: '<b>x</b> & "y"' }).includes('<b>x</b>'));
});

test('the demo page is what the page function writes, so the two cannot drift', () => {
  const want = offlinePage({ lang: 'en-IN', base: '/', look: 'tools/harness/demo.js', styles: ['packages/recipes/offline/recipe.css'], script: 'packages/recipes/offline/retry.js', siteName: 'Offline page demo' });
  assert.equal(readFileSync(new URL('./demo.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n'), want);
});
