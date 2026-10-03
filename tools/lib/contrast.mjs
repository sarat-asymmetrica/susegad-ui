// Text contrast, measured from the pixels a browser actually painted the colours as, for the
// places axe-core gives up ("to review by hand": a background it cannot work out because a
// drawing is laid over the card, or a gradient sits behind the words).
//
//   import { contrastReport } from '../../tools/lib/contrast.mjs';
//   const r = await contrastReport(page, 'sg-menu');   // { checked, failures: [...], skipped: [...] }
//
// For every element under the root that owns visible text, it reads the computed text colour and
// walks up the tree for the background colour: solid layers are composited from the page up, and
// an element whose background has an image or gradient behind its words is reported as skipped,
// never as passing. Large text (24 px, or 18.66 px and bold) needs 3:1, the rest 4.5:1. Colours
// are resolved to sRGB by painting them on a canvas, so oklch(), color-mix() and light-dark() all
// come out as the pixel the user sees.
//
// The maths is pure and tested (contrast.test.mjs); only collect() runs in the page.

/** Relative luminance of an sRGB colour, 0 to 1 (WCAG 2.x). @param {number[]} rgb 0 to 255 */
export const luminance = ([r, g, b]) => {
  const f = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** Contrast ratio between two sRGB colours, 1 to 21. */
export const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Source-over: a colour with alpha 0 to 1 laid on an opaque one → the opaque result. */
export const over = (fg, alpha, bg) => fg.slice(0, 3).map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

/** The ratio a piece of text needs: 3 for large text, 4.5 for the rest. */
export const needed = (sizePx, weight) => (sizePx >= 24 || (sizePx >= 18.66 && Number(weight) >= 600) ? 3 : 4.5);

/**
 * Judge what collect() found. Each item: { path, text, fg: [r,g,b,a], layers: [[r,g,b,a], ...] bottom-up
 * from the nearest ancestor that is opaque, size, weight, unknown?: 'why' }.
 * @returns {{ checked: number, failures: object[], skipped: object[] }}
 */
export function judge(items, { floor = 0 } = {}) {
  const failures = [], skipped = [];
  let checked = 0;
  for (const it of items) {
    if (it.unknown) { skipped.push({ path: it.path, text: it.text, why: it.unknown }); continue; }
    let bg = it.layers[0].slice(0, 3);
    for (const l of it.layers.slice(1)) bg = over(l, l[3], bg);
    const fg = over(it.fg, it.fg[3], bg);
    const r = ratio(fg, bg), need = Math.max(needed(it.size, it.weight), floor);
    checked++;
    if (r < need) failures.push({ path: it.path, text: it.text, ratio: +r.toFixed(2), need, fg, bg });
  }
  return { checked, failures, skipped };
}

/** Runs in the page. Self-contained: it is serialised and sent. */
export function collect({ rootSel, skipSel, ruledSel }) {
  const root = document.querySelector(rootSel);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const px = css => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = css; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const path = el => { const out = []; for (let n = el; n && n !== root.parentElement; n = n.parentElement) out.unshift(n.localName + (n.dataset?.id ? `#${n.dataset.id}` : n.classList[0] ? `.${n.classList[0]}` : '')); return out.slice(-3).join(' > '); };
  const items = [];
  for (const el of root.querySelectorAll('*')) {
    // the words an element owns: its own text nodes, or what is typed in a field, or the option showing in a select
    const typed = el.matches('input:not([type=radio], [type=checkbox], [type=hidden], [type=button], [type=submit]), textarea') ? el.value : el.localName === 'select' ? el.selectedOptions[0]?.textContent ?? '' : '';
    const own = typed.trim() || [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    if (!own || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest(skipSel)) continue;
    if (el.closest('[hidden]')) continue;
    const item = { path: path(el), text: own.slice(0, 40), fg: px(cs.color), size: parseFloat(cs.fontSize), weight: cs.fontWeight, layers: [] };
    // walk up for the background: solid layers until an opaque one
    const layers = [];
    let unknown = '';
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none' && !(ruledSel && n.matches(ruledSel))) { unknown = `a background image or gradient on ${n.localName}`; break; }
      const c = px(s.backgroundColor);
      if (c[3] > 0) layers.unshift(c);
      if (c[3] >= 0.999) break;
    }
    if (!unknown && (!layers.length || layers[0][3] < 0.999)) {
      const page = px(getComputedStyle(document.documentElement).backgroundColor);
      layers.unshift(page[3] > 0 ? page.slice(0, 3).concat(1) : [255, 255, 255, 1]); // the canvas under a page with no background is white
    }
    if (unknown) item.unknown = unknown; else item.layers = layers;
    items.push(item);
  }
  return items;
}

/**
 * Contrast of every piece of text under `rootSel` on `page`, as painted now.
 * `skip` is a selector for text nobody sees (default: aria-hidden, and the usual screen-reader-only classes).
 * `ruled` is a selector for elements whose background image is only hairline ruling (a notebook-ruled textarea):
 * their solid background colour is used and the image ignored. Anything else with an image behind its words is skipped.
 */
export async function contrastReport(page, rootSel, { skip = '[aria-hidden="true"], .sg-sr, .sg-menu-sr', ruled = '', floor = 0 } = {}) {
  return judge(await page.evaluate(collect, { rootSel, skipSel: skip, ruledSel: ruled }), { floor });
}
