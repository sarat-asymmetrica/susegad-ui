// stage3d.js: the three.js tier (decision 0017). Core, engine and components
// never import three; a stage3d element does, lazily, through loadThree(),
// only when it is about to be seen and the tier is 'live'. A page that shows
// no live 3D (quiet, reduced motion, Save-Data, no WebGL) downloads none of it.
//
//   import { loadThree, webglAvailable, liteDevice, watchVisible } from '…/stage3d/stage3d.js';
//   const THREE = await loadThree();   // null if it could not load; draw the 2D still then
//
// `import('three')` is a bare specifier: a bundler resolves it, or the page
// gives an import map ({ "imports": { "three": "/vendor/three.module.js" } }).
// setThreeLoader() swaps the loader, for a page that ships three elsewhere.

export * from './stage3d.core.js';
import { isSoftwareRenderer } from './stage3d.core.js';

let loader = () => import('three');
let pending = null;

/** Replace how three is loaded, e.g. () => import('./vendor/three.js'). Resets the cache. */
export function setThreeLoader(fn) { loader = fn; pending = null; }

/**
 * three's module namespace, loaded once. Resolves null (never rejects) when the
 * module is blocked, missing or throws, after one console warning.
 * @returns {Promise<any | null>}
 */
export function loadThree() {
  pending ??= Promise.resolve().then(loader).then(m => (m?.WebGLRenderer ? m : m?.default?.WebGLRenderer ? m.default : null), err => {
    console.warn('stage3d: three.js did not load, so this drawing shows its still.', err?.message ?? err);
    return null;
  });
  return pending;
}

let gl2 = null;
/**
 * What WebGL2 this browser has, tested once (the test context is released):
 * { available, software, renderer }. `software` is true when the renderer is a
 * CPU emulation (SwiftShader, llvmpipe), as on a machine whose GPU is missing
 * or blocklisted; the renderer string is only read where the browser offers it.
 */
export function webglInfo() {
  if (gl2) return gl2;
  gl2 = { available: false, software: false, renderer: '' };
  try {
    const g = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    if (g) {
      const ext = g.getExtension('WEBGL_debug_renderer_info');
      const renderer = String(g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER) || '');
      gl2 = { available: true, software: isSoftwareRenderer(renderer), renderer };
      g.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { /* no WebGL */ }
  return gl2;
}
/** True when this browser can make a WebGL2 context. */
export const webglAvailable = () => webglInfo().available;

/** Save-Data, or 1 GB of memory or less: draw in 2D and skip the download. */
export const liteDevice = () => typeof navigator !== 'undefined'
  && (!!navigator.connection?.saveData || (navigator.deviceMemory ?? 8) <= 1);

/** Call cb(visible) as the element enters and leaves the viewport (and when the tab hides). Returns an unwatch. */
export function watchVisible(el, cb) {
  let inView = true;
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(es => { inView = es.at(-1).isIntersecting; cb(inView && !document.hidden); }, { rootMargin: '10% 0px' })
    : null;
  io?.observe(el);
  const vis = () => cb(inView && !document.hidden);
  document.addEventListener('visibilitychange', vis);
  return () => { io?.disconnect(); document.removeEventListener('visibilitychange', vis); };
}

/**
 * Load an image and wait until it is decoded. Returns a fixed-size bitmap
 * (or the image where createImageBitmap is missing): an <img> with a srcset can
 * swap its source when the viewport changes, and a texture made from it would
 * then be uploaded at the wrong size.
 */
export async function decoded(src) {
  const img = src instanceof HTMLImageElement ? src : Object.assign(new Image(), { src, decoding: 'async' });
  if (img.loading === 'lazy') img.loading = 'eager';
  if (!img.complete) await new Promise((res, rej) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', () => rej(new Error(`could not load ${img.currentSrc || img.src}`)), { once: true }); });
  if (!img.naturalWidth) throw new Error(`could not load ${img.currentSrc || img.src}`);
  await img.decode?.().catch(() => {});
  if (typeof createImageBitmap !== 'function') return img;
  try { return await createImageBitmap(img); } catch { return img; }
}
