// <sg-scene>'s loop under a fake DOM, a fake rAF and a hand-stepped clock, so the order of events is exact.
// Each test file runs in its own process, so these globals do not leak.
import test from 'node:test';
import assert from 'node:assert/strict';

// ── the smallest DOM the element touches
const stub = () => {
  const attrs = new Map();
  const o = {
    style: {}, hidden: false, textContent: '', innerHTML: '', tabIndex: 0, nodeType: 1, parentNode: null,
    firstChild: { innerHTML: '' }, classList: { contains: () => false, toggle() {} }, offsetHeight: 0,
    addEventListener() {}, removeEventListener() {}, observe() {}, disconnect() {},
    setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: k => attrs.get(k) ?? null,
    removeAttribute: k => attrs.delete(k), hasAttribute: k => attrs.has(k),
    assignedElements: () => [], assignedNodes: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  };
  return o;
};
class FakeHTMLElement extends EventTarget {
  #attrs = new Map();
  isConnected = true; parentNode = null; parentElement = null; nodeType = 1;
  attachShadow() {
    const els = { '.stage': stub(), '.panel': stub(), slot: stub(), button: stub(), '[role=status]': stub(), '#help': stub() };
    els['.stage'].parentNode = stub();
    return Object.assign(stub(), { querySelector: s => els[s], adoptedStyleSheets: [] });
  }
  setAttribute(k, v) { this.#attrs.set(k, String(v)); }
  getAttribute(k) { return this.#attrs.get(k) ?? null; }
  hasAttribute(k) { return this.#attrs.has(k); }
  getRootNode() { return { nodeType: 9, documentElement: doc.documentElement, host: undefined }; }
}
const doc = {
  documentElement: stub(), head: stub(), visibilityState: 'visible',
  addEventListener(type, fn) { (doc.listeners ??= []).push([type, fn]); }, removeEventListener() {}, createElement: stub,
};
const observers = [];
class FakeObserver { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() {} }
class FakeIntersectionObserver extends FakeObserver {}
class FakeSheet { replaceSync() {} }

// ── the fake frame clock: callbacks queue, a test steps them
let queue = [], nextId = 1, now = 0;
const raf = cb => { const id = nextId++; queue.push([id, cb]); return id; };
const caf = id => { queue = queue.filter(([i]) => i !== id); };
function frame(ms = 16) { // one rendering step: every callback queued before it runs once
  now += ms;
  const run = queue; queue = [];
  for (const [, cb] of run) cb(now);
}
const frames = n => { for (let i = 0; i < n; i++) frame(); };

Object.assign(globalThis, {
  HTMLElement: FakeHTMLElement, document: doc, window: globalThis,
  requestAnimationFrame: raf, cancelAnimationFrame: caf,
  IntersectionObserver: FakeIntersectionObserver, ResizeObserver: FakeObserver, MutationObserver: FakeObserver,
  CSSStyleSheet: FakeSheet,
});
Object.defineProperty(globalThis, 'navigator', { value: { deviceMemory: 8 }, configurable: true });

const { SgScene } = await import('./scene-element.js');
const { defineScene } = await import('./define-scene.js');

let n = 0;
/** A scene whose renderer paints its layers over several draws and asks for the next one through invalidate(). */
function layered({ layers, settledAt }) {
  queue = []; // an earlier test's scene must not keep ticking into this one
  const name = `race-${++n}`, seen = { draws: 0, painted: 0, ready: false };
  defineScene({
    name, meta: { W: 100, H: 100 }, params: {},
    model: ({ time }) => ({ settled: time >= settledAt }),
    createRenderer: (_stage, ctx) => {
      let release; const ready = new Promise(r => (release = r));
      return {
        ready,
        render() {
          seen.draws++;
          if (seen.painted < layers) { seen.painted++; if (seen.painted < layers) ctx.invalidate(); else release(); }
        },
        destroy() {},
      };
    },
  });
  const el = new SgScene();
  el.setAttribute('name', name);
  el.addEventListener('sg-ready', () => (seen.ready = true));
  el.connectedCallback();
  return { el, seen };
}

test('a scene that settles in the very tick that asked for another frame still gets that frame', async () => {
  // The model is settled from the first draw, the renderer has three layers to paint: draw 1 asks for a
  // frame with invalidate() while the loop is playing, and the same draw puts the scene to sleep.
  const { el, seen } = layered({ layers: 3, settledAt: 0 });
  assert.equal(el.playing, true, 'playing after mount');
  frames(30);
  await Promise.resolve();
  assert.equal(seen.painted, 3, `all layers painted (drew ${seen.draws} times)`);
  assert.equal(seen.draws, 3, 'one draw per layer, none spare');
  assert.equal(seen.ready, true, 'sg-ready fired');
  assert.equal(el.playing, false, 'and it is asleep: settled work does not burn frames');
  assert.equal(queue.length, 0, 'nothing is left queued');
});

test('pausing between an invalidate and the next tick does not lose the frame', async () => {
  const { el, seen } = layered({ layers: 2, settledAt: 1e9 });
  // Mount drew nothing yet (playing, waiting for its first tick). Run one tick: layer 1 paints, asks for more.
  frame();
  assert.equal(seen.painted, 1);
  el.pause(); // the viewer pauses before the next tick draws layer 2
  frames(5);
  await Promise.resolve();
  assert.equal(seen.painted, 2, 'the pending layer is still painted while paused');
  assert.equal(seen.ready, true);
});

test('an invalidate while paused still schedules a frame (the case that always worked)', async () => {
  const { el, seen } = layered({ layers: 2, settledAt: 1e9 });
  el.pause();
  frames(5);
  el.set({});
  frames(5);
  assert.ok(seen.draws >= 1);
});

// ── what the viewer and the browser can do to the loop
const hide = () => { doc.visibilityState = 'hidden'; for (const [t, f] of doc.listeners ?? []) if (t === 'visibilitychange') f(); };
const show = () => { doc.visibilityState = 'visible'; for (const [t, f] of doc.listeners ?? []) if (t === 'visibilitychange') f(); };
const scroll = onScreen => observers.filter(o => o instanceof FakeIntersectionObserver).at(-1).cb([{ isIntersecting: onScreen }]);

test('an ask the next tick answered leaves nothing pending when the scene later settles', () => {
  // Draw 1 asks (dirty), tick 2 answers it. The scene settles a few ticks later: a flag left set would
  // hand a frame nobody asked for to the paused path.
  const { el, seen } = layered({ layers: 2, settledAt: 0.1 });
  let ticks = 0;
  while (el.playing && ticks < 60) { frame(); ticks++; }
  assert.equal(el.playing, false, 'settled and asleep');
  assert.equal(queue.length, 0, 'no frame queued at settle');
  frames(5);
  assert.equal(seen.draws, ticks, `one draw per tick, no spare (${seen.draws} draws, ${ticks} ticks)`);
});

test('nothing asked: pausing, hiding and scrolling away queue no frame', () => {
  const { el, seen } = layered({ layers: 1, settledAt: 1e9 });
  frames(3);
  el.pause();
  const drawn = seen.draws;
  hide(); show(); scroll(false); scroll(true);
  assert.equal(queue.length, 0, 'a stop with no ask hands nothing back');
  frames(3);
  assert.equal(seen.draws, drawn, 'and draws nothing');
});
