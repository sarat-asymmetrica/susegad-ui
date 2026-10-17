// sw.js: made by susegad/recipes/offline/build.mjs. Change the settings in your build, not here.
// What it keeps, and what it never will: docs/decisions/0028-offline-cache.md in the Susegad UI repo.

// Offline: the pure core of a small service worker, and of the page that registers it. Runs in Node.
//
// What it decides: which requests the worker may touch and which it must leave alone, which responses
// may be kept, how a request is answered (network first for a page, the copy first for a file the page
// needs), which "you are offline" page a visitor sees, and which of the files a page loaded to keep
// after its first visit.
//
// What it will keep (docs/decisions/0028-offline-cache.md): the site's own pages and the static files they
// need (styles, scripts, fonts, pictures), fetched with GET from its own address, inside its own folder,
// and never a response that says no-store or private. Nothing from another address. Nothing a person
// typed: a ticket is drawn on the visitor's device from what the device keeps, so no response holds one.
//
// The worker file is made from this file's text (build.mjs strips the exports and adds the handlers in
// sw.template.js), so everything here is plain functions that depend on nothing.

const CACHE_PREFIX = 'sg-offline-';
/** The cache a worker of this version writes to and reads from. Older versions are deleted when a new one wakes. */
const cacheName = version => `${CACHE_PREFIX}${String(version ?? '1').replace(/[^\w.-]/g, '')}`;

// the kinds of file a page needs; nothing else is ever kept (no data files, no downloads, no video)
const FONT = ['woff2', 'woff'];
const PICTURE = ['avif', 'webp', 'jpg', 'jpeg', 'png', 'svg', 'ico'];
const CODE = ['css', 'js', 'mjs'];
const PAGE = ['html'];
const EXTENSIONS = new Set([...FONT, ...PICTURE, ...CODE, ...PAGE]);

const extOf = pathname => { const m = /\.([a-z0-9]+)$/i.exec(pathname); return m ? m[1].toLowerCase() : ''; };

/** 'page' for a folder or an .html file, 'font', 'asset' for the rest of what may be kept, '' for anything else. */
function kindOf(pathname) {
  const p = String(pathname ?? '');
  const ext = extOf(p);
  if (!ext) return p.endsWith('/') ? 'page' : '';
  if (!EXTENSIONS.has(ext)) return '';
  return PAGE.includes(ext) ? 'page' : FONT.includes(ext) ? 'font' : 'asset';
}

/**
 * May the worker touch this request at all? Only a GET, to this site's own address, inside `scope` (a path,
 * "/" for the whole site), for a kind of file kept above. Anything else (a POST, another address, a data file,
 * a path outside the folder) is left to the network exactly as if no worker were there.
 * @param {{ url: string, method?: string, origin: string, scope?: string }} r
 */
function isCacheable({ url, method = 'GET', origin, scope = '/' }) {
  if (String(method).toUpperCase() !== 'GET') return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.origin !== origin || !u.pathname.startsWith(scope)) return false;
  return kindOf(u.pathname) !== '';
}

/**
 * The key a file is kept under: its address with no query and no hash, so ?register=warm is the same page, and a
 * folder's index page and the folder are one page (/gom-deva/index.html is /gom-deva/), because a visitor reaches
 * the same page by either.
 */
function keyOf(url) {
  const u = new URL(url);
  return `${u.origin}${u.pathname.replace(/\/index\.html$/, '/')}`;
}

/**
 * Is this response one the worker may keep? It must have worked, come from the site's own address (type
 * "basic"), and not say, in Cache-Control, that it is for one person or must not be stored.
 * @param {{ ok: boolean, type?: string, cacheControl?: string|null }} r
 */
function cacheableResponse({ ok, type = 'basic', cacheControl = '' }) {
  if (!ok || type !== 'basic') return false;
  return !/\b(no-store|private)\b/i.test(String(cacheControl ?? ''));
}

/**
 * How to answer a request: 'page' (network first, then the kept copy, then the offline page), 'asset' (the kept
 * copy first, then the network, which fills the cache) or 'pass' (not ours).
 * @param {{ url: string, method?: string, mode?: string }} r
 * @param {{ origin: string, scope?: string }} cfg
 */
function strategy(r, cfg) {
  if (!isCacheable({ ...r, ...cfg })) return 'pass';
  const kind = kindOf(new URL(r.url).pathname);
  if (kind === 'page') return r.mode === 'navigate' || !r.mode ? 'page' : 'asset';
  return 'asset';
}

/**
 * The page to show when a page was never kept and the network is gone. `pages` maps a folder ("gom-deva") to its
 * offline page ("gom-deva/offline.html"); a path in no listed folder gets the default, the one with the empty key.
 * @param {string} pathname @param {Record<string,string>} pages @param {string} [scope]
 */
function offlinePageFor(pathname, pages, scope = '/') {
  const base = scope.endsWith('/') ? scope : `${scope}/`;
  const p = String(pathname ?? '');
  const first = (p.startsWith(base) ? p.slice(base.length) : p).split('/')[0];
  return `${base}${first && Object.hasOwn(pages, first) ? pages[first] : pages['']}`;
}

/**
 * Of the files a page loaded, the ones to keep after its first visit: its own address and the entries of
 * performance.getEntriesByType('resource'), filtered by isCacheable, with no query, no duplicates, and no more
 * than `max`. This is what lets the first visit be enough: a worker installed during that visit did not see the
 * page's own requests, so the page tells it what it used.
 * @param {string[]} names @param {{ origin: string, scope?: string, max?: number }} cfg
 */
function urlsToKeep(names, { origin, scope = '/', max = 120 }) {
  const seen = new Set(), out = [];
  for (const name of names) {
    if (!isCacheable({ url: name, origin, scope })) continue;
    const key = keyOf(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= max) break;
  }
  return out;
}

const CONFIG = {
  "version": "0c53f239d7ec",
  "scope": "/",
  "offlinePages": {
    "": "offline.html",
    "gom-deva": "gom-deva/offline.html",
    "gom-latn": "gom-latn/offline.html"
  },
  "precache": [
    "look.js",
    "susegad/tokens/fonts.css",
    "susegad/tokens/tokens.css",
    "susegad/recipes/offline/recipe.css",
    "susegad/recipes/offline/retry.js",
    "susegad/components/ticket/ticket.png.js",
    "susegad/export/png.js"
  ],
  "max": 120
};

// The handlers of the worker. build.mjs puts offline.core.js's functions above this and the site's
// settings (CONFIG) below the first line; the result is one classic script, sw.js, because module
// workers are not in every browser yet.
//
//   install   keep the offline pages, so there is always something kind to show
//   activate  throw away the caches of older versions, and take over the page that is open
//   message   the page says which files it used; keep the ones the rules allow
//   fetch     a page: network first, then the kept copy, then the offline page.
//             a file the page needs: the kept copy first, and the network fills the cache.
//             anything else is not answered at all, so it goes to the network as it would without us.

const NAME = cacheName(CONFIG.version);
const ORIGIN = self.location.origin;
const RULES = { origin: ORIGIN, scope: CONFIG.scope };
const SCOPE_URL = ORIGIN + CONFIG.scope;

const keep = async (cache, url) => {
  if (!isCacheable({ url, origin: ORIGIN, scope: CONFIG.scope })) return;
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (cacheableResponse({ ok: res.ok, type: res.type, cacheControl: res.headers.get('cache-control') })) await cache.put(keyOf(url), res);
  } catch { /* a file that cannot be fetched now is simply not kept */ }
};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(NAME);
    await Promise.all([...Object.values(CONFIG.offlinePages).map(p => SCOPE_URL + p), ...CONFIG.precache.map(p => SCOPE_URL + p)].map(url => keep(cache, url)));
    self.skipWaiting(); // not awaited: in some browsers its promise waits for activation, which waits for this install
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(CACHE_PREFIX) && key !== NAME) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'keep' || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(NAME);
    const urls = urlsToKeep(data.urls.map(String), { ...RULES, max: CONFIG.max });
    await Promise.all(urls.map(url => keep(cache, url)));
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const plan = strategy({ url: req.url, method: req.method, mode: req.mode }, RULES);
  if (plan === 'pass') return;
  event.respondWith(plan === 'page' ? answerPage(req) : answerFile(req));
});

async function answerPage(req) {
  const cache = await caches.open(NAME);
  const key = keyOf(req.url);
  try {
    const res = await fetch(req);
    if (cacheableResponse({ ok: res.ok, type: res.type, cacheControl: res.headers.get('cache-control') })) cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key))
      || (await cache.match(ORIGIN + offlinePageFor(new URL(req.url).pathname, CONFIG.offlinePages, CONFIG.scope)))
      || Response.error();
  }
}

async function answerFile(req) {
  const cache = await caches.open(NAME);
  const key = keyOf(req.url);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheableResponse({ ok: res.ok, type: res.type, cacheControl: res.headers.get('cache-control') })) cache.put(key, res.clone());
  return res;
}
