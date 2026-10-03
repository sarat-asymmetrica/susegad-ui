// A drawn surface that holds the page's own words (rule 1 of words in the
// world): the scene says where (a shape) and when (a key that changes when the
// shape does); this layer loads the tier, reads the slotted heading and
// paragraphs, lays them at the largest legible size, puts one span per line
// inside a heading and a paragraph like the ones they came from, and hides the
// element's panel while it holds them. When the words can't be held (no
// fitting size, the tier not loaded yet, nothing slotted) the panel stays and
// the scene draws no surface. It imports nothing: Pretext loads only when
// something is placed.

const CSS = `.surface{grid-area:1/1;position:relative;align-self:center;width:100%;pointer-events:none;z-index:1}
.surface [data-line]{pointer-events:auto;cursor:text}
.surface h1,.surface h2,.surface h3,.surface h4,.surface p{margin:0;font:inherit}
.surface-probe{position:absolute;visibility:hidden;width:1rem;height:0}`;

const rootSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/**
 * @param {{ host: Element, scene: Element, W: number, H: number, invalidate: () => void, family: string, color: string }} o
 *   `host` is the scene's stage (the layer goes beside it), `scene` the <sg-scene> whose slotted words are placed.
 */
export function createSurface({ host, scene, W, H, invalidate, family, color }) {
  const mk = (tag, cls = '') => Object.assign(document.createElement(tag), { className: cls });
  const layer = mk('div', 'surface'), probe = mk('span', 'surface-probe'), style = mk('style');
  style.textContent = CSS;
  layer.style.aspectRatio = `${W} / ${H}`;
  layer.style.color = color;
  layer.setAttribute('part', 'surface');
  layer.append(style, probe);
  host.after(layer);
  let type = null, loading = null, key = '', state = null;
  const again = () => { key = ''; invalidate(); };
  const ro = new ResizeObserver(again);
  ro.observe(probe); // 1rem wide: text zoom moves it
  const mo = new MutationObserver(again);
  if (scene) mo.observe(scene, { childList: true, subtree: true, characterData: true });

  return {
    /**
     * Called every frame. `on` says whether the words may live on the surface
     * now (the register, the param); `shapeKey` changes when the shape does;
     * `lay(type, blocks, scale, rootPx)` returns type.setBlocks(...) or null.
     * Returns { lines, calm } while the surface holds the words, else null.
     */
    update(on, shapeKey, lay) {
      if (on && !type) loading ??= import('./index.js').then(async t => { await t.fontReady(`400 20px ${family}`); type = t; again(); }, () => { loading = null; });
      const blocks = on && type && scene ? type.readBlocks(scene) : null;
      const scale = host.clientWidth / W, rootPx = rootSize();
      const k = `${on}|${!!type}|${scale.toFixed(4)}|${rootPx}|${shapeKey}|${blocks ? blocks.map(b => b.tag + b.text).join('|') : ''}`;
      if (k === key) return state;
      key = k;
      const laid = blocks && scale > 0 ? lay(type, blocks, scale, rootPx) : null;
      layer.querySelectorAll('h1,h2,h3,h4,h5,h6,p').forEach(e => e.remove());
      if (laid) {
        const els = laid.blocks.map(b => mk(b.tag));
        layer.append(...els);
        type.project(laid.lines, laid.blocks.map((b, i) => ({ el: els[i], font: `400 ${b.px}px ${family}`, lineHeight: b.lineHeight })), { W, H });
      }
      scene?.holdReading?.(!!laid);
      host.dataset.words = laid ? 'surface' : 'panel';
      return (state = laid ? { lines: laid.lines, calm: type.calmOf(laid.lines) } : null);
    },
    destroy() { ro.disconnect(); mo.disconnect(); scene?.holdReading?.(false); layer.remove(); },
  };
}
