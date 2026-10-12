// The image oracle (measure.js) in Node, with a fake fetch and a fake Image: the header is read from a stream that is
// then cancelled, the answer is cached and shared, the fallback runs when a fetch cannot read, an abort cancels the
// transfer, and nothing ever throws into the caller.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImageOracle } from './measure.js';
import { png, jpeg, gif } from './header.props.js';

const BASE = 'https://example.test/page/';
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

/** A fake fetch: routes map a URL to { bytes, chunk?, status?, fail?, endless? }. Counts calls, reads, cancels and aborts. */
function fakeFetch(routes) {
  const log = { calls: [], reads: 0, bytesRead: 0, cancelled: 0, aborted: 0, headers: [] };
  const fn = async (url, { signal, headers } = {}) => {
    log.calls.push(url); log.headers.push(headers);
    const r = routes[url];
    if (!r || r.fail) throw new TypeError('network error');
    if (r.hang) await new Promise((_, rej) => signal.addEventListener('abort', () => { log.aborted++; rej(new DOMException('aborted', 'AbortError')); }, { once: true }));
    let at = 0;
    const body = new ReadableStream({
      async pull(c) {
        if (signal?.aborted) { log.aborted++; return c.error(new DOMException('aborted', 'AbortError')); }
        await tick();
        if (r.slow) await tick(r.slow);
        const bytes = r.bytes, size = r.chunk ?? 16;
        if (!r.endless && at >= bytes.length) return c.close();
        const part = r.endless ? new Uint8Array(size) : bytes.subarray(at, at + size);
        if (r.endless && at < bytes.length) part.set(bytes.subarray(at, at + size));
        at += size; log.reads++; log.bytesRead += part.length;
        c.enqueue(part);
      },
      cancel() { log.cancelled++; },
    });
    return { ok: (r.status ?? 200) < 300, status: r.status ?? 200, body };
  };
  fn.log = log;
  return fn;
}

/** A fake Image: naturalWidth appears after `after` polls; records what happened to it. */
function fakeImage(table) {
  const made = [];
  class FakeImage {
    constructor() { this.naturalWidth = 0; this.naturalHeight = 0; this.complete = false; this.polls = 0; made.push(this); }
    set src(v) { this._src = v; if (!v) { this.released = true; return; } const t = table[v]; this.asked = v; this.plan = t; }
    get src() { return this._src; }
    removeAttribute() {}
  }
  // naturalWidth is read by the oracle's poll; reveal it on the nth read
  Object.defineProperty(FakeImage.prototype, 'naturalWidth', {
    get() { if (!this.plan || this.released) return 0; if (++this.polls > (this.plan.after ?? 1)) return this.plan.w ?? 0; return 0; },
    set() {},
  });
  Object.defineProperty(FakeImage.prototype, 'naturalHeight', { get() { return this.plan && !this.released && this.polls > (this.plan.after ?? 1) ? this.plan.h ?? 0 : 0; }, set() {} });
  Object.defineProperty(FakeImage.prototype, 'complete', { get() { return !!this.plan?.broken && this.polls > 1; }, set() {} });
  FakeImage.made = made;
  return FakeImage;
}

const big = (head, n = 100000) => { const b = new Uint8Array(n); b.set(head); return b; };

test('the header is read from the first chunks and the transfer is cancelled', async () => {
  const f = fakeFetch({ 'https://example.test/page/a.png': { bytes: big(png(1600, 900)), chunk: 10 } });
  const o = createImageOracle({ fetch: f, base: BASE, Image: undefined });
  const d = await o.dims('a.png');
  assert.deepEqual({ w: d.w, h: d.h, source: d.source, kind: d.kind }, { w: 1600, h: 900, source: 'bytes', kind: 'png' });
  assert.equal(f.log.cancelled, 1, 'the stream was cancelled');
  assert.ok(f.log.bytesRead <= 40, `only the header was read: ${f.log.bytesRead} of 100000 bytes`);
  assert.match(f.log.headers[0].Range, /^bytes=0-\d+$/, 'it asks for a range, in case the server honours it');
});

test('a JPEG whose EXIF turns it is answered in the displayed orientation', async () => {
  const f = fakeFetch({ 'https://example.test/page/p.jpg': { bytes: big(jpeg(4000, 3000, { orientation: 6 })), chunk: 7 } });
  const d = await createImageOracle({ fetch: f, base: BASE }).dims('p.jpg');
  assert.deepEqual([d.w, d.h], [3000, 4000]);
});

test('answers are cached by resolved URL, peeked synchronously, and asked for once', async () => {
  const f = fakeFetch({ 'https://example.test/page/a.png': { bytes: big(png(10, 20)) } });
  const o = createImageOracle({ fetch: f, base: BASE });
  assert.equal(o.peek('a.png'), null, 'nothing known yet');
  const [x, y] = await Promise.all([o.dims('a.png'), o.dims('https://example.test/page/a.png#frag')]);
  assert.equal(x, y, 'concurrent asks, even by another spelling, share one answer');
  assert.equal(f.log.calls.length, 1, 'and one request');
  assert.equal(o.peek('./a.png').w, 10, 'peek reads the cache by the resolved URL');
  await o.dims('a.png');
  assert.equal(f.log.calls.length, 1, 'a later ask does not go to the network');
  o.forget('a.png');
  assert.equal(o.peek('a.png'), null);
});

test('a size the page already has is recorded, answers first, and bad numbers are refused', async () => {
  const f = fakeFetch({});
  const o = createImageOracle({ fetch: f, base: BASE });
  assert.equal(o.record('a.png', { w: 0, h: 5 }), null);
  assert.equal(o.record('a.png', { w: NaN, h: 5 }), null);
  assert.equal(o.record('', { w: 5, h: 5 }), null);
  o.record('a.png', { w: 640, h: 480 });
  const d = await o.dims('a.png');
  assert.deepEqual({ w: d.w, h: d.h, source: d.source }, { w: 640, h: 480, source: 'known' });
  assert.equal(f.log.calls.length, 0);
});

test('when the bytes cannot be read it falls back to a warmed <img>, polled for naturalWidth, then lets it go', async () => {
  const URL_ = 'https://cdn.test/x.jpg';
  const I = fakeImage({ [URL_]: { w: 800, h: 600, after: 3 } });
  const f = fakeFetch({ [URL_]: { fail: true } }); // a cross-origin fetch with no CORS
  const o = createImageOracle({ fetch: f, Image: I, base: BASE, pollMs: 1 });
  const d = await o.dims(URL_);
  assert.deepEqual({ w: d.w, h: d.h, source: d.source }, { w: 800, h: 600, source: 'img' });
  assert.equal(I.made.length, 1);
  assert.equal(I.made[0].released, true, 'the img is released once the size is read');
});

test('a body that is not a picture also falls back, and an <img> with no size (an SVG without one) is null, not zero', async () => {
  const URL_ = 'https://example.test/page/v.svg';
  const f = fakeFetch({ [URL_]: { bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>') } });
  const I = fakeImage({ [URL_]: { w: 0, h: 0, broken: true } });
  const o = createImageOracle({ fetch: f, Image: I, base: BASE, pollMs: 1 });
  assert.equal(await o.dims('v.svg'), null);
  assert.equal(o.peek('v.svg'), null, 'a failure is not cached: the next ask tries again');
});

test('it never throws into a caller: a missing fetch, a throwing Image, a 404, a junk URL', async () => {
  assert.equal(await createImageOracle({ fetch: undefined, Image: undefined, base: BASE }).dims('a.png'), null);
  class Boom { constructor() { throw new Error('no images here'); } }
  assert.equal(await createImageOracle({ fetch: fakeFetch({}), Image: Boom, base: BASE }).dims('a.png'), null);
  const f = fakeFetch({ 'https://example.test/page/gone.png': { bytes: new Uint8Array(0), status: 404 } });
  assert.equal(await createImageOracle({ fetch: f, Image: undefined, base: BASE }).dims('gone.png'), null);
  const o = createImageOracle({ fetch: fakeFetch({}), Image: undefined, base: BASE });
  for (const bad of [undefined, null, '', 'http://[bad', 42, {}]) assert.equal(await o.dims(bad), null, String(bad));
  assert.equal(o.dimsOfBytes(null), null);
  assert.equal(o.dimsOfBytes(new Uint8Array([1, 2, 3])), null);
  assert.equal(await o.dimsOfBlob({ slice() { throw new Error('x'); } }), null);
});

test('bytes and blobs already in hand are read without any request', async () => {
  const f = fakeFetch({});
  const o = createImageOracle({ fetch: f, base: BASE });
  assert.deepEqual(o.dimsOfBytes(gif(300, 200)), { w: 300, h: 200, source: 'bytes', kind: 'gif' });
  assert.deepEqual(o.dimsOfBytes(png(5, 6).buffer.slice(0)), { w: 5, h: 6, source: 'bytes', kind: 'png' }, 'an ArrayBuffer too');
  assert.equal(o.dimsOfBytes(png(5, 6).subarray(0, 20)), null, 'half a header is not an answer');
  const blob = new Blob([jpeg(1200, 800)]);
  const d = await o.dimsOfBlob(blob);
  assert.deepEqual([d.w, d.h], [1200, 800]);
  assert.equal(f.log.calls.length, 0);
});

test('the byte cap ends a probe that never finds a header', async () => {
  const f = fakeFetch({ 'https://example.test/page/long.jpg': { bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff]), endless: true, chunk: 512 } });
  const o = createImageOracle({ fetch: f, Image: undefined, base: BASE, maxBytes: 4096 });
  assert.equal(await o.dims('long.jpg'), null);
  assert.ok(f.log.bytesRead <= 4096 + 512, `stopped near the cap: ${f.log.bytesRead}`);
  assert.equal(f.log.cancelled, 1);
});

test('a caller\'s signal ends its own wait; the transfer stops only when nobody is left waiting', async () => {
  const f = fakeFetch({ 'https://example.test/page/s.png': { bytes: big(png(9, 9)), chunk: 4, slow: 15 } });
  const o = createImageOracle({ fetch: f, Image: undefined, base: BASE });
  const a = new AbortController(), b = new AbortController();
  const pa = o.dims('s.png', { signal: a.signal }), pb = o.dims('s.png', { signal: b.signal });
  await tick(5);
  a.abort();
  assert.equal(await pa, null, 'the first caller gave up');
  assert.deepEqual((await pb)?.w, 9, 'the second still gets its answer from the same transfer');
  assert.equal(f.log.calls.length, 1);

  const g = fakeFetch({ 'https://example.test/page/t.png': { bytes: big(png(9, 9)), chunk: 4, slow: 30 } });
  const o2 = createImageOracle({ fetch: g, Image: undefined, base: BASE });
  const c = new AbortController();
  const pc = o2.dims('t.png', { signal: c.signal });
  await tick(5);
  c.abort();
  assert.equal(await pc, null);
  await tick(60);
  assert.equal(o2.inflight, 0, 'nothing left in flight');
  assert.ok(g.log.aborted >= 1 || g.log.cancelled >= 1, 'and the transfer itself was stopped');
  assert.equal(o2.peek('t.png'), null, 'an abandoned probe caches nothing');
  const pre = new AbortController(); pre.abort();
  assert.equal(await o2.dims('t.png', { signal: pre.signal }), null, 'an already-aborted signal asks nothing');
  assert.equal(g.log.calls.length, 1);
});

test('dispose() cancels everything in flight, empties the cache, and leaves the oracle usable', async () => {
  const f = fakeFetch({
    'https://example.test/page/slow.png': { bytes: big(png(3, 4)), chunk: 4, slow: 40 },
    'https://example.test/page/fast.png': { bytes: big(png(7, 8)) },
  });
  const o = createImageOracle({ fetch: f, Image: undefined, base: BASE });
  await o.dims('fast.png');
  const pending = o.dims('slow.png');
  await tick(5);
  assert.equal(o.inflight, 1);
  o.dispose();
  assert.equal(await pending, null);
  assert.equal(o.inflight, 0);
  assert.equal(o.peek('fast.png'), null, 'the cache is empty');
  assert.equal((await o.dims('fast.png')).w, 7, 'and it still works');
});

test('a probe that outlasts timeoutMs is null and is cancelled', async () => {
  const f = fakeFetch({ 'https://example.test/page/h.png': { hang: true } });
  const o = createImageOracle({ fetch: f, Image: undefined, base: BASE, timeoutMs: 20 });
  assert.equal(await o.dims('h.png'), null);
  assert.equal(f.log.aborted, 1);
  assert.equal(o.inflight, 0);
});

test('measure.js is the only image file that touches the network or the decoder', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const dir = new URL('.', import.meta.url);
  const offenders = [];
  for (const name of readdirSync(dir)) {
    if (!/\.js$/.test(name) || /\.test\.js$|\.props\.js$|\.fake\.js$|^measure\.js$/.test(name)) continue;
    const src = strip(readFileSync(new URL(name, dir), 'utf8'));
    for (const m of src.matchAll(/\b(fetch|XMLHttpRequest|createImageBitmap|new Image|naturalWidth|decode\(\))\b/g)) offenders.push(`${name}: ${m[1]}`);
  }
  assert.deepEqual(offenders, [], 'only measure.js goes to the network or the decoder for a size');
});
