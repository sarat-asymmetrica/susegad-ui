// Tinto: words in the world (words="world"). The renderer asks this layer each
// frame what is on the surfaces now:
// - the slotted words, set by the type tier on the chalkboard outside the
//   Taverna, one span per line inside a heading and a paragraph like the ones
//   they came from (read, selected and translated as text);
// - the shops' hours on plaques under their signs, each a button that opens
//   the shop's detail (the tier's junctions);
// - the flat reading wherever a surface can't hold its words legibly (quiet, a
//   narrow screen, text at 200%, or before the tier loads): the panel as
//   usual, and the shops as a plain list under the picture.
// The layer sits beside the drawing (a role="img" hides its children). Pretext
// is imported only once something is to be placed.

import { SHOPS, PLAQUE_H, slateOf, minSizes, boardSizes, inWorld } from './model.js';
import { createJunctions } from '../../type/junctions.js';
import { stackOf } from '../../type/stacks.js';

export const CHALK = '#f4f1e7';
export const ENAMEL_INK = '#1d2742';
// the families are the token stacks (--sg-font-hand, --sg-font-body), not one name: a canvas inherits nothing, and Kalam has no Kannada
// plaques and cards use the body stack: they carry hours, and Kalam's 1 reads as a capital I
const CSS = `.words{grid-area:1/1;position:relative;align-self:center;width:100%;pointer-events:none;z-index:1}
.words [data-line]{pointer-events:auto;cursor:text;color:${CHALK}}
.words h1,.words h2,.words h3,.words h4,.words p{margin:0;font:inherit}
.probe{position:absolute;visibility:hidden;width:1rem;height:0}`;

const rootSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

// a page with no canvas to measure with (the oracle says so by name) keeps the flat reading: no board, no plaques, the panel and the list
const orFlat = f => { try { return f(); } catch (e) { if (e?.name === 'NoMeasuringCanvas') return null; throw e; } };

export function createWords({ host, scene, W, H, invalidate }) {
  const mk = (tag, cls = '') => Object.assign(document.createElement(tag), { className: cls });
  const HAND = stackOf(host, 'hand'), PLAIN = stackOf(host, 'body');
  const layer = mk('div', 'words'), board = mk('div'), probe = mk('span', 'probe'), style = mk('style');
  style.textContent = CSS;
  layer.setAttribute('part', 'words');
  layer.style.aspectRatio = `${W} / ${H}`;
  layer.append(style, board, probe);
  host.after(layer);
  let type = null, loading = null, key = '', fontsAsk = '', fontsOk = '', state = { board: null, plaques: null, open: null };
  const shops = createJunctions({
    layer, flatParent: host.parentNode, label: 'Shops in the square', family: PLAIN, ink: ENAMEL_INK, W, H,
    items: SHOPS.map(s => ({ id: s.id, name: s.sign, info: s.info, detail: s.detail })),
    onChange: () => { key = ''; invalidate(); },
  });

  const ro = new ResizeObserver(() => { key = ''; invalidate(); });
  ro.observe(probe); // the probe is 1rem wide: text zoom moves it
  const mo = new MutationObserver(() => { key = ''; invalidate(); });
  // a face that finishes loading after the board was laid (it failed once and came back, or was fetched for something else): lay out again in it
  const onFonts = () => { key = ''; invalidate(); };
  document.fonts?.addEventListener?.('loadingdone', onFonts);
  if (scene) mo.observe(scene, { childList: true, subtree: true, characterData: true });

  function load() {
    loading ??= import('../../type/index.js').then(async t => {
      await Promise.all([t.fontReady(`400 20px ${HAND}`), t.fontReady(`500 16px ${PLAIN}`), t.fontReady(`400 16px ${PLAIN}`)]);
      type = t; shops.use(t); key = ''; invalidate();
    }, () => { loading = null; });
  }

  /** The board: the largest legible size that holds every line in the slate's arch, or null. */
  function layBoard(blocks, scale, rootPx) {
    const sl = slateOf(), shape = type.arch(sl.x, sl.y, sl.w, sl.h, sl.rise, sl.pad);
    const specs = blocks.map(b => ({ ...b, ratio: b.tag === 'p' ? 1 : 1.45 }));
    return type.setBlocks(specs, shape, { sizes: boardSizes(scale, rootPx), family: HAND, top: sl.y + sl.pad * 0.6, bottom: sl.y + sl.h - sl.pad, scale, minWidth: 30 });
  }

  /** Called every frame; cheap unless something changed. Returns what the renderer should draw. */
  function update(register, words) {
    const world = inWorld(register, words), shopsOn = words === 'world';
    if (world && !type) load();
    const ready = world && type;
    let blocks = ready && scene ? type.readBlocks(scene) : null;
    // measure only once the faces for these very words are loaded (a Kannada board needs Noto Sans Kannada, which a canvas never fetches itself)
    if (blocks) {
      const need = blocks.map(b => b.text).join(' ');
      if (fontsOk !== need) { // pending: no layout until the faces have arrived, then one relayout (a layout in a fallback face would stick)
        if (fontsAsk !== need) { fontsAsk = need; type.fontReady(`400 20px ${HAND}`, need).then(() => { if (fontsAsk === need) { fontsOk = need; key = ''; invalidate(); } }); }
        blocks = null;
      }
    }
    const scale = host.clientWidth / W, rootPx = rootSize();
    const k = `${world}|${shopsOn}|${!!type}|${scale.toFixed(4)}|${rootPx}|${blocks ? blocks.map(b => b.tag + b.text).join('|') : ''}`;
    if (k !== key) {
      key = k;
      const min = minSizes(rootPx);
      const laid = ready && scale > 0 && blocks ? orFlat(() => layBoard(blocks, scale, rootPx)) : null;
      const boxes = ready && scale > 0 ? orFlat(() => shops.measure(SHOPS, Math.max(min.label, 17 * scale), scale, { target: min.target, maxH: PLAQUE_H })) : null;
      board.replaceChildren();
      if (laid) {
        const els = laid.blocks.map(b => mk(b.tag));
        board.append(...els);
        type.project(laid.lines, laid.blocks.map((b, i) => ({ el: els[i], font: `400 ${b.px}px ${HAND}`, lineHeight: b.lineHeight })), { W, H });
      }
      scene?.holdReading?.(!!laid);
      shops.place(boxes, shopsOn);
      state = { board: laid ? { lines: laid.lines, calm: type.calmOf(laid.lines) } : null, plaques: boxes, open: null };
      host.dataset.words = laid ? 'board' : 'panel';
      host.dataset.shops = boxes ? 'plaques' : shopsOn ? 'list' : 'none';
    }
    state.open = shops.open;
    return state;
  }

  return {
    update,
    destroy() { ro.disconnect(); mo.disconnect(); document.fonts?.removeEventListener?.('loadingdone', onFonts); scene?.holdReading?.(false); shops.destroy(); layer.remove(); },
  };
}
