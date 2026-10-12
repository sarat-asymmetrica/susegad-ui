// The image oracle (decisions 0029 and 0030): the one file that goes to the network or the decoder for a
// picture's size. It answers "how big is this picture?" early, before the picture has loaded, so the page can
// reserve the box and lay text beside it while the bytes are still on their way.
//
// Three ways to know, tried in this order:
//   known    a size the page already has (width and height attributes, a CMS field): record(src, { w, h })
//   bytes    a streamed fetch that stops as soon as the header is read (header.core.js parses it, usually the first
//            kilobyte or two); also dimsOfBytes(Uint8Array) and dimsOfBlob(blob) for bytes already in hand
//   img      a warmed <img>, polled for naturalWidth, for what a fetch cannot read (a cross-origin picture with no
//            CORS, an SVG, a format the parser does not know)
//
// It never throws into a caller: a size it cannot learn is null. Sizes are cached by URL, and an answer shared by
// several callers is one request. A caller's AbortSignal cancels its own wait, and the request itself when nobody
// is left waiting; dispose() cancels everything and empties the cache (the oracle stays usable afterwards).
//
// The fetch and the Image constructor are injectable, so Node can drive the whole path with fakes (measure.test.js).
// Cores, the engine and components import layout.core.js, never this file (boundary.test.js in packages/type).

import { readHeader } from './header.core.js';

const FRESH = (w, h, source, kind) => Object.freeze({ w, h, source, ...(kind ? { kind } : {}) });
const valid = d => d && Number.isFinite(d.w) && Number.isFinite(d.h) && d.w > 0 && d.h > 0;

/**
 * @param {{ fetch?: typeof fetch, Image?: typeof Image, base?: string, maxBytes?: number, timeoutMs?: number, pollMs?: number, cacheSize?: number }} [o]
 *   `maxBytes` is how much of a file the probe will read looking for the header (and the Range it asks for);
 *   `timeoutMs` bounds one whole probe; `pollMs` is how often the <img> fallback looks at naturalWidth.
 */
export function createImageOracle({
  fetch: fetcher = globalThis.fetch?.bind(globalThis), Image: ImageCtor = globalThis.Image, base = globalThis.document?.baseURI ?? globalThis.location?.href,
  maxBytes = 262144, timeoutMs = 10000, pollMs = 16, cacheSize = 500,
} = {}) {
  const cache = new Map();   // key -> frozen { w, h, source }
  const pending = new Map(); // key -> { promise, ctl, waiters }

  const keyOf = src => {
    try { const u = new URL(String(src), base); u.hash = ''; return u.href; } catch { return String(src); }
  };
  const remember = (key, d) => {
    if (cache.size >= cacheSize) cache.delete(cache.keys().next().value);
    cache.set(key, d);
    return d;
  };

  /** The streamed header read: stop at the first answer, a dead end or the byte cap. */
  async function viaBytes(key, signal) {
    if (!fetcher) return null;
    try {
      const res = await fetcher(key, { signal, headers: { Range: `bytes=0-${maxBytes - 1}` } });
      if (!res.ok || !res.body?.getReader) { res.body?.cancel?.().catch?.(() => {}); return null; }
      const reader = res.body.getReader();
      let buf = new Uint8Array(4096), n = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return null;
          if (n + value.length > buf.length) { const bigger = new Uint8Array(Math.max(buf.length * 2, n + value.length)); bigger.set(buf.subarray(0, n)); buf = bigger; }
          buf.set(value, n); n += value.length;
          const r = readHeader(buf.subarray(0, n));
          if (!r) return null;
          if (!r.more) return FRESH(r.w, r.h, 'bytes', r.kind);
          if (n >= maxBytes) return null;
        }
      } finally { reader.cancel().catch(() => {}); } // stop the transfer: the header was all we wanted
    } catch { return null; }
  }

  /** The warmed <img>: naturalWidth is set as soon as the browser has read the header, long before the picture is done. */
  function viaImg(key, signal) {
    if (!ImageCtor) return Promise.resolve(null);
    return new Promise(resolve => {
      let img, timer, done = false;
      const finish = d => {
        if (done) return;
        done = true; clearTimeout(timer); signal.removeEventListener('abort', onAbort);
        if (img) { img.onload = img.onerror = null; try { img.removeAttribute?.('src'); img.src = ''; } catch { /* nothing to release */ } }
        resolve(d);
      };
      const onAbort = () => finish(null);
      const look = () => {
        if (done) return;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) return finish(FRESH(img.naturalWidth, img.naturalHeight, 'img'));
        if (img.complete) return finish(null); // fully loaded and still no size: an SVG with none, or a broken picture
        timer = setTimeout(look, pollMs);
      };
      if (signal.aborted) return resolve(null);
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        img = new ImageCtor();
        img.decoding = 'async';
        img.onerror = () => finish(null);
        img.src = key;
        look();
      } catch { finish(null); }
    });
  }

  async function probe(key, signal) {
    const a = await viaBytes(key, signal);
    if (a || signal.aborted) return a;
    return viaImg(key, signal);
  }

  /**
   * The intrinsic size of the picture at `src`, as { w, h, source } (source: 'known', 'bytes' or 'img'), or null.
   * Cached; concurrent asks share one request. `signal` ends this caller's wait early (null).
   */
  function dims(src, { signal } = {}) {
    if (!src) return Promise.resolve(null);
    const key = keyOf(src);
    const hit = cache.get(key);
    if (hit) return Promise.resolve(hit);
    if (signal?.aborted) return Promise.resolve(null);
    let p = pending.get(key);
    if (!p) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
      p = { ctl, waiters: 0 };
      p.promise = probe(key, ctl.signal).then(d => (valid(d) ? (cache.has(key) ? cache.get(key) : remember(key, d)) : null), () => null)
        .finally(() => { p.settled = true; clearTimeout(timer); if (pending.get(key) === p) pending.delete(key); });
      pending.set(key, p);
    }
    p.waiters++;
    return new Promise(resolve => {
      let left = false;
      const leave = () => {
        if (left) return;
        left = true;
        if (--p.waiters <= 0 && !p.settled) { p.ctl.abort(); if (pending.get(key) === p) pending.delete(key); } // nobody is waiting: stop the transfer
      };
      const onAbort = () => { resolve(null); leave(); };
      signal?.addEventListener('abort', onAbort, { once: true });
      p.promise.then(d => { signal?.removeEventListener('abort', onAbort); resolve(d); leave(); });
    });
  }

  return {
    dims,
    /** The size if it is already known (cached or recorded), else null. Synchronous: the reflow half asks this. */
    peek: src => cache.get(keyOf(src)) ?? null,
    /** A size the page already has (attributes, a CMS field, a manifest). Ignored unless both numbers are positive. */
    record(src, d) {
      if (!src || !valid(d)) return null;
      return remember(keyOf(src), FRESH(d.w, d.h, 'known'));
    },
    /** The size of a picture whose first bytes are in hand (a Uint8Array or ArrayBuffer), or null. */
    dimsOfBytes(bytes) {
      try { const r = readHeader(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes); return r && !r.more ? FRESH(r.w, r.h, 'bytes', r.kind) : null; } catch { return null; }
    },
    /** The size of a Blob or File, from its first `maxBytes` bytes. */
    async dimsOfBlob(blob) {
      try { return this.dimsOfBytes(new Uint8Array(await blob.slice(0, maxBytes).arrayBuffer())); } catch { return null; }
    },
    forget(src) { if (src === undefined) cache.clear(); else cache.delete(keyOf(src)); },
    /** Cancel every request in flight and empty the cache. The oracle can be used again. */
    dispose() {
      for (const p of pending.values()) p.ctl.abort();
      pending.clear(); cache.clear();
    },
    /** How many requests are in flight (for tests and the demo's readout). */
    get inflight() { return pending.size; },
  };
}

/** The shared oracle: one cache for every surface on the page. Cancel your own waits with a signal; dispose() empties it for everyone. */
export const imageOracle = createImageOracle();
