// Warm: a menu card. A double frame ruled by hand in pencil round the whole
// card (the field component's own pencil rule, run along each side so the
// strokes cross a little at the corners), and the same hand ruling under each
// section's script head, all in one aria-hidden drawing laid over the card
// (never inside a heading). Drawn once per size; nothing moves.
import { pencilRule, inkPath } from '../../field/field.core.js';

const NS = 'http://www.w3.org/2000/svg';
const f = v => +v.toFixed(2);

/** A ruled rectangle's four sides as SVG paths: [{ d, transform, alpha }]. Pure apart from the seed. */
export function frameSides(w, h, inset, seed, { weight = 1.5, drift = 1.1 } = {}) {
  const sides = [
    { at: `translate(${inset} ${inset})`, len: w - 2 * inset },
    { at: `translate(${inset} ${f(h - inset)})`, len: w - 2 * inset },
    { at: `translate(${inset} ${inset}) rotate(90)`, len: h - 2 * inset },
    { at: `translate(${f(w - inset)} ${inset}) rotate(90)`, len: h - 2 * inset },
  ];
  return sides.flatMap((s, i) => pencilRule(s.len, { seed: `${seed}:${inset}:${i}`, weight, drift })
    .map(p => ({ d: p.d, transform: `${s.at} translate(${p.x} ${p.y})`, alpha: p.alpha })));
}

export function mount(host) {
  const doc = host.ownerDocument;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-menu-frame');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  host.prepend(svg);
  let seed = '', key = '', raf = 0;

  const add = (d, transform, alpha, cls) => {
    const p = doc.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('transform', transform);
    if (alpha < 1) p.setAttribute('fill-opacity', alpha);
    if (cls) p.setAttribute('class', cls);
    svg.append(p);
  };

  function draw() {
    raf = 0;
    const w = Math.round(host.offsetWidth), h = Math.round(host.offsetHeight);
    const box = host.getBoundingClientRect();
    const titles = [...host.querySelectorAll('.sg-menu-section-title')].map(t => { const r = t.getBoundingClientRect(); return { x: Math.round(r.left - box.left), y: Math.round(r.bottom - box.top), w: Math.round(r.width) }; });
    const k = `${seed}|${w}|${h}|${titles.map(t => `${t.x},${t.y},${t.w}`).join(';')}`;
    if (!w || !h || k === key) return;
    key = k;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.replaceChildren();
    for (const [inset, weight] of [[8, 1.7], [15, 1.1]]) for (const s of frameSides(w, h, inset, seed, { weight })) add(s.d, s.transform, s.alpha);
    // under each script head: one ruled line, as a hand would rule a ledger
    titles.forEach((t, i) => {
      if (t.w > 0) add(inkPath(t.w, { seed: `${seed}:u${i}`, weight: 1.3, drift: 0.9, land: 30, lift: 60 }), `translate(${t.x} ${t.y - 3})`, 1, 'sg-menu-underline');
    });
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const ro = new ResizeObserver(schedule);
  ro.observe(host);

  return {
    update(s) { if (s.seed !== seed) { seed = s.seed; key = ''; } schedule(); },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); svg.remove(); },
  };
}
