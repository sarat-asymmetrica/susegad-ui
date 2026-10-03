// Junctions (rule 4 of words in the world): each item is one piece of
// information anchored where a choice happens in a scene, a label on a drawn
// plaque that is a real <button>, and pressing it opens the item's detail on
// a card beside it (Escape closes it and gives focus back). Where the plaques
// can't be read (quiet, a narrow screen, text at 200%), the same items are a
// plain list, each detail behind a native <details>. The scene draws the
// plaques; this file only places the words and the presses. It imports
// nothing, so the list costs no Pretext: the scene hands it the loaded tier
// with use(type) before it measures a plaque or balances a card.

const CSS = `
.jn-plaque{position:absolute;pointer-events:auto;display:grid;place-items:center;padding:0;border:0;border-radius:3px;background:transparent;cursor:pointer;white-space:nowrap;opacity:1;transition:none}
.jn-label{display:block;line-height:1.2}
.jn-plaque:focus-visible{outline:3px solid var(--sg-focus,Highlight);outline-offset:3px}
.jn-card{position:absolute;pointer-events:auto;box-sizing:border-box;padding:10px 14px;border-radius:6px;
 background:var(--sg-surface-raised,Canvas);color:var(--sg-text,CanvasText);border:1.5px solid currentColor;box-shadow:0 3px 10px rgb(0 0 0/.18)}
.jn-card[hidden],.jn-flat[hidden],.jn-plaques[hidden]{display:none}.jn-card p{margin:0}
.jn-flat{grid-row:3;grid-column:1;margin:12px 0 0;padding:0;list-style:none;font:inherit;color:var(--sg-text,CanvasText)}
.jn-flat li+li{margin-top:4px}.jn-flat summary{cursor:pointer}.jn-flat p{margin:4px 0 0}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

/**
 * @param {{ layer: Element, flatParent: Element, items: Array<{ id, name, info, detail }>, label?: string,
 *   family: string, ink: string, W: number, H: number, onChange: () => void }} o
 *   `layer` is laid over the drawing (percent positions); `flatParent` takes the list; `label` names it.
 */
export function createJunctions({ layer, flatParent, items, label = '', family, ink, W, H, onChange }) {
  const wrap = el('div', { className: 'jn-plaques', hidden: true });
  const flat = el('ul', { className: 'jn-flat', hidden: true });
  if (label) flat.setAttribute('aria-label', label);
  flat.setAttribute('part', 'junctions');
  for (const it of items) flat.append(el('li', {}, el('details', {}, el('summary', {}, el('b', { textContent: it.name }), `, ${it.info.toLowerCase()}`), el('p', { textContent: it.detail }))));
  layer.append(el('style', { textContent: CSS }), wrap);
  flatParent.append(flat);

  let open = null, boxes = null, openBox = null, t = null;
  const parts = items.map(it => {
    const button = el('button', { type: 'button', className: 'jn-plaque' }, el('span', { className: 'vh', textContent: `${it.name}, ` }), el('span', { className: 'jn-label', textContent: it.info }));
    const card = el('div', { className: 'jn-card', id: `jn-${it.id}`, hidden: true }, el('p', { textContent: it.detail }));
    Object.assign(button.style, { color: ink, fontFamily: `${family}, sans-serif`, fontWeight: 500 });
    card.style.fontFamily = `${family}, sans-serif`;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', card.id);
    button.addEventListener('click', () => toggle(open === it.id ? null : it.id));
    for (const x of [button, card]) x.addEventListener('keydown', e => { if (e.key === 'Escape' && open === it.id) { e.stopPropagation(); toggle(null); button.focus(); } });
    wrap.append(button, card);
    return { it, button, card };
  });

  function toggle(id) {
    open = id;
    for (const p of parts) { p.button.setAttribute('aria-expanded', String(open === p.it.id)); p.card.hidden = open !== p.it.id; }
    placeCard();
    onChange();
  }

  /** The open detail: a balanced card under its plaque, kept inside the picture. */
  function placeCard() {
    openBox = null;
    const i = parts.findIndex(p => p.it.id === open), b = boxes?.[i], cw = layer.clientWidth;
    if (!b || !cw || !t) return;
    const scale = cw / W, px = Math.max(15, b.px), p = parts[i];
    const width = t.balance(t.prepare(p.it.detail, `400 ${px}px ${family}`), Math.min(300, cw - 24) - 28).width + 32;
    const x = Math.min(Math.max(8, (b.x + b.w / 2) * scale - width / 2), cw - width - 8), y = (b.y + b.h) * scale + 8;
    Object.assign(p.card.style, { left: `${(x / cw) * 100}%`, top: `${(y / (H * scale)) * 100}%`, width: `${width}px`, fontSize: `${px}px`, lineHeight: 1.3 });
    openBox = { x: x / scale, y: y / scale, w: width / scale, h: (p.card.offsetHeight || px * 4) / scale };
  }

  return {
    /** Hand over the loaded tier (index.js), which measures the plaques and balances the cards. */
    use(type) { t = type; },
    /**
     * Size each plaque to its words at `px` (CSS), anchored at `at` (logical top centre) within `room` and
     * `maxH`; null if any doesn't fit (the caller then shows the list). Pure but for the measuring.
     */
    measure(anchors, px, scale, { target = 24, maxH = Infinity } = {}) {
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const { w, h } = t.labelBox(items[i].info, `500 ${px}px ${family}`, px, { target });
        const a = anchors[i], box = { x: a.at[0] - w / scale / 2, y: a.at[1], w: w / scale, h: h / scale, px };
        if (box.w > a.room || box.h > maxH) return null;
        out.push(box);
      }
      return out;
    },
    /** Show the plaques at `next` (logical boxes), or the list when null; `list` false hides both. */
    place(next, list = true) {
      boxes = next;
      wrap.hidden = !boxes;
      flat.hidden = !list || !!boxes;
      parts.forEach((p, i) => {
        const b = boxes?.[i];
        if (b) Object.assign(p.button.style, { left: `${(b.x / W) * 100}%`, top: `${(b.y / H) * 100}%`, width: `${(b.w / W) * 100}%`, height: `${(b.h / H) * 100}%`, fontSize: `${b.px}px` });
      });
      if (!boxes && open) toggle(null); else placeCard();
    },
    /** The open card's box (logical), for the scene to keep its own drawing off it. */
    get open() { return openBox; },
    destroy() { wrap.remove(); flat.remove(); },
  };
}
