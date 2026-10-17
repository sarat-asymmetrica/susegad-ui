# Offline (recipe)

A small service worker for a static site, and the page that registers it. After a visitor has opened the site once, its pages open again with no connection, in their own language, and a page that was never opened shows a kind "no connection" page instead of the browser's own. It keeps the site's own pages and the files they need (styles, scripts, fonts, pictures) and **nothing else**. What it may keep, and what it never will, is decided in `docs/decisions/0028-offline-cache.md`: no response to a form or an API, nothing from another address, and no personal data. A visitor's ticket is not in the cache; it is made on their device and drawn by script from the device's own storage.

## Make the worker

The worker is one classic script, made from `offline.core.js` and your settings, so it is tested in Node and still runs in every browser:

```js
// in your build script, in the folder the site is served from
import { writeSw } from './susegad/recipes/offline/build.mjs';

writeSw('sw.js', {
  version: '1',                        // change it when the files kept change; old copies are thrown away
  scope: '/',                          // the folder the worker covers: starts and ends with a slash
  offlinePages: {                      // folder name -> its offline page; "" is the default
    '': 'offline.html',
    'gom-deva': 'gom-deva/offline.html',
    'gom-latn': 'gom-latn/offline.html',
  },
  precache: ['site.css', 'look.js'],   // kept at install, besides the offline pages: what an offline page needs to draw
});
```

The event template does this in `pages.mjs`; run `node pages.mjs` and `sw.js` is written beside the pages.

## Register it

```html
<script type="module">
  import { registerOffline } from './susegad/recipes/offline/offline.js';
  registerOffline({ url: 'sw.js', scope: '/' });
</script>
```

`registerOffline()` waits until the page has loaded and the browser is idle, registers the worker, and tells it which files the page used so that the first visit is enough (a worker installed during that visit did not see the page's own requests). It never breaks a page: no service worker in the browser, a refusal, a failed install each leave the page as it was. It returns `{ registered, kept, why }` for a page that wants to say something.

An offline page is an ordinary page of your own. The event template's three (`offline.html`, `gom-deva/offline.html`, `gom-latn/offline.html`) use words that say the fault is not the visitor's, what still works, what has to wait, and offers Try again and Back.

## What it does

| A request | Answer |
|---|---|
| a page, online | the network's, and a copy kept |
| a page, offline | the copy kept on the last visit; else the offline page in the language of the page asked for |
| a file the page needs | the kept copy first; the network fills the cache the first time |
| a POST, another address, a data file, a response marked `no-store` or `private` | not answered and not kept: it goes to the network as if no worker were there |

The offline page promises only what the worker keeps. If you change what is kept, change the words on that page to match.

## Test it

`node --test packages/recipes/offline/offline.test.js` runs the generated worker in a fake scope (a cache that remembers and a network that can be cut): install, activate, a page kept and answered with the network cut, the offline page in each language, a file answered from the cache, and every request that must not be answered or kept. `node packages/recipes/offline/offline.check.mjs` does the same in a real browser with the network cut (Chromium and WebKit).

## Serving it

Serve `sw.js` and the files it keeps with ordinary static-file headers (`Cache-Control: public, max-age=0, must-revalidate` or a short max-age). A response marked `no-store` or `private` is never kept, by design, so a host that sends `no-store` on every file (the repo's own dev server does) leaves the worker with nothing to keep; and in Chromium a worker script served `no-store` stalled its own fetches during install (found 8 October 2026). The recipe's browser check therefore uses a small static server that sends what a real host sends.

## Known issues

- **A new version starts with an empty cache.** When the worker's version changes it deletes the old copies, and the new version keeps only what it is told to at install and what the page then loads. A file the page loads only when something is pressed (the event template's Save as picture loads `ticket.png.js` and `export/png.js` then) is not in the new cache until it has been used online once, so offline it would fail after an update. List such files in `precache`; the template does.
- **The version is a hash that only `pages.mjs` computes.** The event template's worker version is a content hash of every file the worker keeps, written by `node pages.mjs`. Edit a kept file (a style, a script, a page) without running it again and the worker's version does not change, so returning visitors keep the old file. `node pages.mjs --check` catches the forgotten run: it fails when `sw.js` is not what the files make.
- **A stall of 20 to 30 seconds in Chromium after a version bump is real, and its cause is not found.** Reproduced by a reviewer on the real event template on 8 October 2026: 2 of 2 bump-and-reload sequences in the second review and 4 of 5 across both. The third reload sat for 30 s with `load` never firing; the requests still in flight were the lazy `skins/quiet.js` of `qr`, `person-card` and `site-footer`, and once `GET /`. WebKit had no stall in 4 reloads, and the ticket was intact. It is not ruled out that the single-threaded test server and a loaded machine caused it. It did not appear in a small script of this recipe's own (12 rounds, 60 navigations on a mini-site, slowest 1.1 s; and 3 rounds with every response `no-store`, slowest 0.7 s), so it needs the real page's load of many lazily imported files at the moment the new worker installs. **Before the first live site, run `tools/until-fail.mjs` on the bump-and-reload sequence (first visit, change a kept file, rebuild, reload three times) against a real host**, and record what it shows. Something to note if it stalls: whether the host sends `no-store` on `sw.js`, and what `navigator.serviceWorker.getRegistration()` says (installing, waiting or active) while it lasts. A worker script served `Cache-Control: no-store` stalls its own install-time fetches for good (see "Serving it"), which would show as a worker that never takes over rather than a slow page.

## Where the ticket comes in

The ticket is the `sg-ticket` component. It is made on the visitor's device, kept in `localStorage`, and drawn into the event page by script. Offline, the cached page loads, finds the ticket in `localStorage` and draws it, so the ticket opens with no connection although no copy of it was ever cached.

## Not here

Background sync, push, periodic updates and keeping a ticket across devices (decision 0028). A service worker anywhere outside this recipe needs a decision of its own.
