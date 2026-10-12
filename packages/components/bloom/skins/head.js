// The head: one SVG, built from bloom.core's plan and kept as the count changes. The three skins call this with
// their own mode (dots or zendu) and whether they may grow. Florets are in painter's order, the rim first and the
// heart on top, so the DOM runs rim to centre; the growth runs the other way (see bloom.css).
//
// Nothing here is an inline style attribute: colours and shapes are SVG presentation attributes, and the few
// custom properties (--i, --ph, --sg-bloom-step) go in through the CSSOM, so a strict Content-Security-Policy
// (style-src 'self') is fine.

import { plan, gradientStops, growStep, GROW_TOTAL_MS, FULL, R } from '../bloom.core.js';

const NS = 'http://www.w3.org/2000/svg';
const SHIVER_MS = 420;
let uid = 0;
const make = (doc, name, attrs = {}) => {
  const e = doc.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
const r2 = v => String(Math.round(v * 100) / 100);

/**
 * @param {HTMLElement} host @param {{ register: string, motion: string }} ctx
 * @param {{ mode: 'dots' | 'zendu', grow: boolean, shiver?: boolean }} o
 */
export function mountHead(host, ctx, { mode, grow, shiver = false }) {
  const doc = host.ownerDocument, id = `sg-bloom-${++uid}`;
  const svg = make(doc, 'svg', { class: 'sg-bloom-svg', viewBox: `${-R} ${-R} ${2 * R} ${2 * R}`, focusable: 'false' });
  const defs = make(doc, 'defs');
  const shadow = make(doc, 'circle', { class: 'sg-bloom-shadow', fill: `url(#${id}-sh)` });
  const ground = make(doc, 'circle', { class: 'sg-bloom-ground', fill: `url(#${id}-gr)` });
  let groundStops = [];
  const group = make(doc, 'g', { class: 'sg-bloom-fl', id: `${id}-fl` });
  const light = make(doc, 'circle', { class: 'sg-bloom-light', fill: `url(#${id}-lt)` });
  if (mode === 'zendu') {
    const radial = (name, attrs, stops) => {
      const g = make(doc, 'radialGradient', { id: `${id}-${name}`, ...attrs });
      for (const [o, c, a] of stops) g.append(make(doc, 'stop', { offset: o, 'stop-color': c, 'stop-opacity': a }));
      defs.append(g);
    };
    // the light does not turn with the flower: warm from the upper left, rust at the lower right (toran's drawShade)
    radial('lt', { cx: 0.5, cy: 0.5, r: 0.5, fx: 0.32, fy: 0.28 }, [
      [0, '#ffeebe', 0.3], [0.45, '#ffdca0', 0.05], [0.72, '#5a1e05', 0.12], [0.93, '#461400', 0.26], [1, '#461400', 0]]);
    radial('gr', { cx: 0.5, cy: 0.5, r: 0.5 }, [[0, '#000', 1], [0.55, '#000', 1], [1, '#000', 1]]);
    groundStops = [...defs.lastChild.children];
    radial('sh', { cx: 0.5, cy: 0.5, r: 0.5 }, [[0.6, '#3c1e14', 0.11], [1, '#3c1e14', 0]]);
    // the light lands on petals only: an alpha mask made from the florets themselves, so nothing paints on bare paper
    const mask = make(doc, 'mask', { id: `${id}-m`, 'mask-type': 'alpha', maskUnits: 'userSpaceOnUse', x: -R, y: -R, width: 2 * R, height: 2 * R });
    mask.append(make(doc, 'use', { href: `#${id}-fl` }));
    defs.append(mask);
    light.setAttribute('mask', `url(#${id}-m)`);
    svg.append(defs, shadow, ground, group, light);
  } else { group.setAttribute('fill', 'currentColor'); svg.append(group); }

  const known = new Set(); // gradients already in defs
  let built = null, pending = 0, timer = 0, shiverTimer = 0;

  const growing = () => grow && ctx.register === 'playful' && ctx.motion === 'full';

  function gradient(g) {
    if (known.has(g.id)) return;
    known.add(g.id);
    const lg = make(doc, 'linearGradient', { id: `${id}-${g.id}`, x1: 0, y1: 1, x2: 0, y2: 0 });
    for (const [o, c] of gradientStops(g)) lg.append(make(doc, 'stop', { offset: o, 'stop-color': c }));
    defs.append(lg);
  }

  function floret(p, f, isNew, solo) {
    let node;
    if (mode === 'dots') node = make(doc, 'circle', { class: 'sg-bloom-d', cx: f.x, cy: f.y, r: f.len });
    else {
      gradient(f.grad);
      node = make(doc, 'g', { class: 'sg-bloom-f', transform: `translate(${f.x} ${f.y}) rotate(${f.rot}) scale(${f.len})` });
      node.append(
        make(doc, 'path', { class: 'sg-bloom-p sg-bloom-c', d: f.crevice, fill: p.rim, 'fill-opacity': 0.55, stroke: 'none' }),
        make(doc, 'path', { class: 'sg-bloom-p', d: f.d, fill: `url(#${id}-${f.grad.id})` }),
      );
      if (f.ring) node.setAttribute('data-ring', '');
      node.style.setProperty('--ph', String(f.ph));
      if (isNew) { node.setAttribute('data-new', ''); node.style.setProperty('--i', String(f.i)); if (solo) node.setAttribute('data-solo', ''); pending++; }
    }
    node.setAttribute('data-i', String(f.i));
    return node;
  }

  function frame(p) {
    const r = p.reach;
    ground.setAttribute('r', r2(r * 0.86));
    [p.heart, p.ground, p.ground].forEach((c, k) => groundStops[k].setAttribute('stop-color', c));
    light.setAttribute('r', r2(r * 1.0));
    shadow.setAttribute('r', r2(r * 1.04));
    shadow.setAttribute('cx', r2(r * 0.05));
    shadow.setAttribute('cy', r2(r * 0.06));
  }

  function settle() {
    clearTimeout(timer);
    for (const n of group.querySelectorAll('[data-new]')) { n.removeAttribute('data-new'); n.removeAttribute('data-solo'); }
    pending = 0;
    host.removeAttribute('data-intro');
    if (host.hasAttribute('data-state')) { host.removeAttribute('data-state'); ctx.emit('sg-bloom-grown', { count: group.childElementCount }); }
  }
  const armTimer = () => { clearTimeout(timer); timer = setTimeout(settle, GROW_TOTAL_MS + 1500); };

  svg.addEventListener('animationend', e => {
    if (e.animationName === 'sg-bloom-grow') {
      const n = e.target.parentNode;
      if (n?.hasAttribute?.('data-new')) { n.removeAttribute('data-new'); n.removeAttribute('data-solo'); if (--pending <= 0) settle(); }
    }
  });

  function press() {
    if (!shiver || !growing() || pending || host.hasAttribute('data-shiver')) return;
    host.setAttribute('data-shiver', '');
    shiverTimer = setTimeout(() => host.removeAttribute('data-shiver'), SHIVER_MS);
  }
  svg.addEventListener('pointerdown', press);
  host.prepend(svg);

  return {
    update(s) {
      svg.removeAttribute('aria-hidden'); svg.removeAttribute('role'); svg.removeAttribute('aria-label');
      if (s.role === 'img') { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', s.name); } else svg.setAttribute('aria-hidden', 'true');
      const p = plan({ kind: s.kind, count: s.count ?? FULL, seed: s.seed, mode });
      const key = `${p.kind}|${s.seed}|${mode}|${p.scale}`;
      const g = growing();
      if (built?.key === key) {
        // the same head with more or fewer florets: the ones already placed stay exactly where they are
        if (p.n > built.n) for (const f of p.florets.slice(built.n)) group.prepend(floret(p, f, g, true));
        else for (const n of [...group.children]) if (Number(n.dataset.i) >= p.n) { if (n.hasAttribute('data-new')) pending--; n.remove(); }
        if (p.n !== built.n && g && pending) host.setAttribute('data-state', 'growing');
      } else {
        group.replaceChildren(); pending = 0;
        for (let k = p.florets.length - 1; k >= 0; k--) group.append(floret(p, p.florets[k], g && !built, false));
        host.style.setProperty('--sg-bloom-step', `${r2(growStep(p.n))}ms`);
        if (g && pending) {
          host.setAttribute('data-state', 'growing');
          // the ground the florets grow on is part of the first growth, so the head never starts as a bare disc
          if (!built) { host.setAttribute('data-intro', ''); host.style.setProperty('--sg-bloom-total', `${Math.round(growStep(p.n) * Math.max(0, p.n - 1) + 340)}ms`); }
        } else host.removeAttribute('data-state');
        if (mode === 'zendu') { group.setAttribute('stroke', p.rim); group.setAttribute('stroke-opacity', '0.5'); group.setAttribute('stroke-width', '0.025'); }
      }
      if (mode === 'zendu') frame(p);
      built = { key, n: p.n };
      // a head that is still off screen waits, with its florets unseen, and grows when it is first seen
      if (pending) { host.toggleAttribute('data-waiting', !s.visible); if (s.visible) armTimer(); }
      else host.removeAttribute('data-waiting');
    },
    restyle() {}, // the marigold does not change with the theme, and the dots follow currentColor
    destroy() {
      clearTimeout(timer); clearTimeout(shiverTimer);
      svg.remove();
      for (const a of ['data-state', 'data-intro', 'data-waiting', 'data-shiver']) host.removeAttribute(a);
    },
  };
}
