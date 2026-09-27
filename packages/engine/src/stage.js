// stage.js: canvas + DPR + resize. Canvas edge.
//
// Convention: every piece draws in fixed *logical* units (e.g. 1200×800).
// The stage scales that to the element's width and the screen's pixel
// density, so a piece never thinks about devicePixelRatio or resizing.

/** @typedef {(g: CanvasRenderingContext2D, st: Stage) => void} Paint */
/**
 * @typedef {{ el: HTMLElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W: number, H: number,
 *   px: number, memo: Map<string, HTMLCanvasElement>, onresize: ((st: Stage) => void) | null,
 *   begin: () => CanvasRenderingContext2D, layer: (draw?: Paint) => HTMLCanvasElement,
 *   cached: (key: string, draw: Paint) => HTMLCanvasElement, blit: (layer: CanvasImageSource, g?: CanvasRenderingContext2D) => void,
 *   toLogical: (clientX: number, clientY: number) => [number, number], destroy: () => void }} Stage
 *   px is device pixels per logical unit.
 */

/**
 * Create a canvas inside `el` that draws in logical units W×H.
 * Call `st.begin()` at the start of each frame to reset the transform.
 * `st.cached(key, draw)` paints an offscreen layer once (per size). Use it for
 * paper, backgrounds, anything that doesn't move. Then `st.blit(layer)` draws it.
 * @param {HTMLElement} el @returns {Stage}
 */
export function stage(el, { W = 1200, H = 800, maxDpr = 2 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:manipulation';
  if (!el.style.aspectRatio) el.style.aspectRatio = `${W} / ${H}`;
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const st = { el, canvas, ctx, W, H, px: 1, memo: new Map(), onresize: null };

  function fit() {
    const cssW = el.clientWidth || W;
    const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    const pw = Math.max(1, Math.round(cssW * dpr));
    const ph = Math.max(1, Math.round((cssW * H / W) * dpr));
    if (pw === canvas.width && ph === canvas.height) return;
    canvas.width = pw; canvas.height = ph;
    st.px = pw / W;
    st.memo.clear();
    st.onresize?.(st);
  }
  st.begin = () => { ctx.setTransform(st.px, 0, 0, st.px, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return ctx; };
  st.layer = draw => {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext('2d');
    g.setTransform(st.px, 0, 0, st.px, 0, 0);
    draw?.(g, st);
    return c;
  };
  st.cached = (key, draw) => { if (!st.memo.has(key)) st.memo.set(key, st.layer(draw)); return st.memo.get(key); };
  st.blit = (layer, g = ctx) => g.drawImage(layer, 0, 0, W, H);
  st.toLogical = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [((cx - r.left) / r.width) * W, ((cy - r.top) / r.height) * H]; };

  const ro = new ResizeObserver(fit);
  ro.observe(el);
  fit();
  st.destroy = () => { ro.disconnect(); canvas.remove(); st.memo.clear(); };
  return /** @type {Stage} */ (st);
}
