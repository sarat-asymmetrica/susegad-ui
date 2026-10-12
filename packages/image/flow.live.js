// The live surface of the image tier: a paragraph (or several) laid by the type tier round floated pictures whose
// sizes are known before their bytes arrive (decisions 0029 and 0030).
//
//   <div class="flow">
//     <figure data-side="right" data-share="0.4"><img src="a.jpg" alt="…" width="1200" height="800"></figure>
//     <figure data-side="left" data-share="0.3" data-y="160"><img src="b.png" alt="…"></figure>
//     <p>…</p><p>…</p>
//   </div>
//
//   const flow = mountFlow(document.querySelector('.flow'));   // flow.ready, flow.relayout(), flow.destroy()
//
// Without this file the markup is plain: float the figures in CSS, give each <img> its width and height attributes,
// and the browser reserves the box with `aspect-ratio` and wraps the text itself. That is the still, and it is what
// quiet, reduced motion and no JavaScript get (the page decides, with `registerState(el)` from core/register.js:
// live when `register !== 'quiet' && !reducedMotion`, and only then does it import this file). This file is for the case CSS
// cannot do: a script lays the words, so it must know the boxes first.
//
// What happens: each picture's size comes from its width and height attributes, else from the image oracle (the
// header, read early). The first layout waits for those sizes (at most `wait` ms), then the type tier lays the words
// beside boxes reserved from them. The words stay in their own <p>, one span per line, in reading order. The
// picture's bytes arrive later into a box that already has the right shape, so nothing moves. A picture whose size
// is still unknown when `wait` runs out gets a guessed box, and the layout is redone once, when the size lands.
//
// Loaded by dynamic import() only on the live tier, so it is never a static import of a core (boundary.test.js).

import { imageOracle } from './measure.js';
import { flowAround } from './layout.core.js';
import * as typeTier from '../type/index.js';

const px = v => parseFloat(v) || 0;
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

/**
 * @param {Element} root the container: figures (data-side, data-share, data-y) and paragraphs, as direct children
 * @param {{ oracle?: object, type?: object, gap?: number, minWidth?: number, wait?: number }} [o]
 *   `gap` is the margin kept round each picture (px), `minWidth` the narrowest room worth laying a line in,
 *   `wait` how long the first layout waits for sizes. `oracle` and `type` are injectable (the demo's check swaps them).
 */
export function mountFlow(root, { oracle = imageOracle, type = typeTier, gap = 16, minWidth = 128, wait = 600 } = {}) {
  const figs = [...root.querySelectorAll(':scope > figure')], paras = [...root.querySelectorAll(':scope > p')];
  const words = paras.map(p => p.textContent.replace(/\s+/g, ' ').trim());
  const ctl = new AbortController();
  let alive = true, key = '', pending = false, released = false, resolveReady;
  const ready = new Promise(r => { resolveReady = r; });

  const srcOf = fig => fig.querySelector('img')?.getAttribute('src') ?? '';
  // sizes the page already has: width and height attributes
  for (const f of figs) {
    const img = f.querySelector('img'), w = +img?.getAttribute('width'), h = +img?.getAttribute('height');
    if (w > 0 && h > 0 && !oracle.peek(srcOf(f))) oracle.record(srcOf(f), { w, h });
  }
  const asked = figs.map(f => oracle.dims(srcOf(f), { signal: ctl.signal }).then(d => { if (d && alive) relayout(); return d; }));

  function floatsNow() {
    return figs.map((f, i) => ({
      id: i, side: f.dataset.side === 'left' ? 'left' : 'right', share: +f.dataset.share || 0.4, y: +f.dataset.y || 0,
      dims: oracle.peek(srcOf(f)), ratio: +f.dataset.ratio || 4 / 3,
    }));
  }

  async function lay() {
    if (!alive || !root.isConnected) return;
    const width = Math.floor(root.clientWidth);
    if (!width) return;
    const floats = floatsNow(), probe = paras[0] ?? root, cs = getComputedStyle(probe);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, size = px(cs.fontSize), lineHeight = px(cs.lineHeight) || size * 1.5;
    const next = `${width}|${font}|${lineHeight}|${floats.map(f => (f.dims ? `${f.dims.w}x${f.dims.h}` : '?')).join(',')}`;
    if (next === key) return;
    key = next;
    await type.fontReady(font, words.join(' '));
    if (!alive || key !== next) return;
    // the paragraphs' own margins set the space between them; paint() zeroes them, so give them back to be read
    paras.forEach(p => p.style.removeProperty('margin'));
    const margins = paras.map(p => px(getComputedStyle(p).marginTop)), marginsB = paras.map(p => px(getComputedStyle(p).marginBottom));
    const blocks = words.map((text, i) => ({ prepared: type.prepare(text, font), lineHeight, gap: i ? Math.max(margins[i], marginsB[i - 1]) : 0 }));
    const laid = flowAround(type, blocks, { x: 0, y: 0, w: width }, floats, { gap, minWidth, scale: 1 });
    paint(laid, width, lineHeight);
  }

  function paint(laid, width, lineHeight) {
    root.dataset.flow = 'live';
    Object.assign(root.style, { position: 'relative', height: `${Math.ceil(laid.bottom)}px` });
    const byBlock = paras.map(() => []);
    for (const l of laid.lines) byBlock[l.block].push(l);
    paras.forEach((p, i) => {
      const mine = byBlock[i], top = mine.length ? mine[0].y : 0, bottom = mine.length ? mine.at(-1).y + lineHeight : 0;
      Object.assign(p.style, { position: 'absolute', left: '0', top: `${top}px`, width: `${width}px`, height: `${bottom - top}px`, margin: '0' });
      p.replaceChildren();
      mine.forEach((l, k) => {
        const s = document.createElement('span');
        s.dataset.line = '';
        s.textContent = l.text.trimEnd(); // the space between lines is a text node of the paragraph, so a line's box is its ink
        Object.assign(s.style, { position: 'absolute', whiteSpace: 'pre', left: `${l.x}px`, top: `${l.y - top}px`, lineHeight: `${lineHeight}px` });
        p.append(s);
        if (k < mine.length - 1) p.append(' '); // the words still read as one sentence to a screen reader and to copy
      });
    });
    laid.boxes.forEach(b => {
      const f = figs[b.id];
      Object.assign(f.style, { position: 'absolute', margin: '0', left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
      if (b.guessed) f.dataset.guessed = ''; else delete f.dataset.guessed;
      const img = f.querySelector('img');
      if (img) Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' });
    });
    resolveReady(laid);
    root.dispatchEvent(new CustomEvent('sg-flow', { detail: { lines: laid.lines.length, boxes: laid.boxes, bottom: laid.bottom } }));
  }

  function relayout() {
    if (pending || !alive || !released) return; // until the first layout has had its sizes, nothing lays
    pending = true;
    frame().then(() => { pending = false; return lay(); });
  }

  // the first layout waits for the sizes, but not for long
  const first = Promise.race([Promise.all(asked), new Promise(r => setTimeout(r, wait))]).then(() => { released = true; return lay(); }).catch(e => { console.error(e); resolveReady(null); });
  // the root's width moves the lines; a 1rem probe moves with text zoom (the font changes, the root's width does not)
  const probe = Object.assign(document.createElement('span'), { ariaHidden: 'true' });
  Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', width: '1rem', height: '0', pointerEvents: 'none' });
  root.append(probe);
  const ro = new ResizeObserver(() => relayout()); // lay() does nothing when the key (width, font, sizes) is unchanged, so our own height change is free
  ro.observe(root); ro.observe(probe);
  const onFonts = () => { key = ''; relayout(); };
  document.fonts?.addEventListener?.('loadingdone', onFonts);

  return {
    ready,
    relayout: () => { key = ''; relayout(); },
    /** Give the plain reading back: the words as written, the pictures where CSS puts them. */
    destroy() {
      alive = false; ctl.abort(); ro.disconnect(); probe.remove(); document.fonts?.removeEventListener?.('loadingdone', onFonts);
      paras.forEach((p, i) => { p.replaceChildren(words[i]); p.removeAttribute('style'); });
      figs.forEach(f => { f.removeAttribute('style'); f.querySelector('img')?.removeAttribute('style'); delete f.dataset.guessed; });
      root.removeAttribute('style'); delete root.dataset.flow;
    },
  };
}
