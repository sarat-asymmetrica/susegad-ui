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
