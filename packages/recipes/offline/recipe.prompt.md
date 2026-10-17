# Offline

*After one visit, the site's pages open with no connection, and a page never opened shows a kind "no connection" page.*

A small service worker that keeps the site's own pages and the files they need, and nothing else.

```js
import { writeSw } from './susegad/recipes/offline/build.mjs';
writeSw('sw.js', { version: '1', scope: '/', offlinePages: { '': 'offline.html', 'gom-deva': 'gom-deva/offline.html' }, precache: ['site.css'] });
```

```html
<script type="module">
  import { registerOffline } from './susegad/recipes/offline/offline.js';
  registerOffline({ url: 'sw.js', scope: '/' });
</script>
```

## The prompt

Write a small service worker for a static event site and the page script that registers it. The worker is one classic script (module workers are not in every browser) made by a Node build function from a pure, tested file of rules plus the site's settings (a version, a scope that starts and ends with a slash, an offline page per language folder with a default, and a few files to keep at install). It keeps only the site's own pages and the files they need: pages (a folder or `.html`), styles and scripts, fonts, pictures. It keeps a file only when the request is a GET, to its own address, inside its scope, of one of those kinds, and when the response worked, came from its own address and does not say `no-store` or `private`. Everything else (a POST, another address, a data file, an API path) it does not answer at all, so it goes to the network as if there were no worker. Answer a page with the network first, then the copy kept, then the offline page in the language of the page that was asked for; answer a file the page needs from the copy first, and let the network fill the cache. Key every copy by address with no query or hash. On install keep the offline pages; on activate delete every cache that starts with the recipe's prefix and is not the current version, and take over open pages. A worker installed during a first visit did not see that visit's requests, so after load and idle the page registers the worker and posts it the list of files it used (from the resource timing entries, filtered by the same rules, deduplicated and capped); the worker checks the list again before keeping anything. The page script never throws: no service worker, a refusal or a failed install leave the page as it was. No personal data is ever kept: a visitor's ticket lives in `localStorage` and is drawn by script, never cached. Test the rules in Node, test the generated worker in a fake scope with a cache and a network that can be cut, and test in a real browser, after a first visit, with the network cut.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| keep nothing but the site's own static files | allow list | `kindOf()` allows only page, style, script, font and picture extensions; `isCacheable()` adds GET, same origin and inside the scope. Unit-tested against POSTs, other addresses, `.json` and `/api/`. |
| never keep a private response | response rule | `cacheableResponse()` refuses a failed, cross-origin or opaque response and any `Cache-Control` with `no-store` or `private`. |
| not ours is not answered | pass | `strategy()` gives `'pass'`, and the handler returns without `respondWith`, so the request goes to the network untouched. |
| network first for a page | strategy | `answerPage()` fetches, keeps a clone, and on failure answers from the cache, then the offline page. |
| the offline page in the visitor's language | folder map | `offlinePageFor()` takes the first path segment after the scope and looks it up with `Object.hasOwn`, falling back to the default. |
| one classic script | build | `swSource()` joins `offline.core.js` (exports removed), the settings as `CONFIG`, and `sw.template.js`. |
| the first visit is enough | message | `registerOffline()` posts `{ type: 'keep', urls }` from resource timing after load and idle; the worker re-checks each URL. |
| old copies thrown away | version | `cacheName(version)` and the activate handler delete other caches with the prefix. |
