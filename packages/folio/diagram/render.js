// renderDiagram(src, opts): the diagram as an HTML string. Pure and
// synchronous, no DOM, so Folio's Markdown can call it at build time and seal
// the result into a document, and <sg-diagram> can call it again in the page
// when the register changes.
//
//   renderDiagram(src, { id, title, direction, register, steps, seed, lang })
//     → { html, text, errors }
//
// The html is an <sg-diagram> holding a <figure>: a static SVG (role="img",
// named by the title and described by the text alternative), the caption, and
// the text alternative itself: the steps as an ordered list when `steps` is
// set, otherwise the parts and connections behind "Read the diagram as text".
// It reads and prints fully without JavaScript. Only classes and presentation
// attributes are used, never style="", so a strict Content-Security-Policy has
// nothing to allow.

import { hashSeed } from '../../engine/src/rng.js';
import { parse, layout, describe, STRINGS, METRICS } from './diagram.core.js';
import { inkPath, inkBox, inkHead, head } from './diagram.ink.js';

export const REGISTERS = ['quiet', 'warm', 'playful'];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const r1 = v => Math.round(v * 10) / 10;
const attrs = o => Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== false).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');
const el = (tag, a, inner = '') => `<${tag}${attrs(a)}>${inner}</${tag}>`;
const one = (tag, a) => `<${tag}${attrs(a)}/>`;

/** The words of a box, one <tspan> per line, centred. */
function words(n) {
  const cx = r1(n.x + n.w / 2), top = n.y + (n.h - n.lines.length * METRICS.line) / 2 + 13.5;
  return el('text', { class: 'sg-d-text', x: cx, y: r1(top), 'text-anchor': 'middle' },
    n.lines.map((l, i) => el('tspan', { x: cx, dy: i ? METRICS.line : null }, esc(l))).join(''));
}

/**
 * @param {string} src the diagram in the line grammar
 * @param {{ id?: string, title?: string, direction?: 'right'|'down', register?: string,
 *   steps?: boolean, seed?: string, lang?: string }} [opts]
 * @returns {{ html: string, text: string, errors: { line: number, message: string }[] }}
 */
export function renderDiagram(src, opts = {}) {
  const model = parse(src);
  if (opts.title) model.title = String(opts.title);
  if (opts.direction === 'right' || opts.direction === 'down') model.direction = opts.direction;
  const register = REGISTERS.includes(opts.register) ? opts.register : 'warm';
  const L = layout(model), D = describe(model);
  const id = opts.id || `sg-d-${hashSeed(`${src}|${model.title}|${model.direction}`).toString(36)}`;
  const seed = hashSeed(opts.seed || id) % 1000;
  const steps = !!opts.steps && model.edges.length > 0;
  const hand = register !== 'quiet';
  const hue = new Map(model.groups.map((g, k) => [g.name, k % 5]));

  const groups = L.groups.map((g, k) => el('g', { class: 'sg-d-group', 'data-group': g.name, 'data-hue': register === 'playful' ? k % 5 : null },
    (hand
      ? one('rect', { class: 'sg-d-group-fill', x: r1(g.x), y: r1(g.y), width: r1(g.w), height: r1(g.h), rx: 10 }) + one('path', { class: 'sg-d-group-ink', d: inkBox(g.x, g.y, g.w, g.h, { seed: seed + 50 + k, width: 1.1 }) })
      : one('rect', { class: 'sg-d-group-frame', x: r1(g.x), y: r1(g.y), width: r1(g.w), height: r1(g.h), rx: 8 }))
    + el('text', { class: 'sg-d-group-name', x: r1(g.x + 10), y: r1(g.nameAt === 'end' ? g.y + g.h - 8 : g.y + 16) }, esc(g.name)))).join('');

  const edges = L.edges.map(e => {
    const tip = e.P[3], tail = e.P[0], back = Math.atan2(e.P[0][1] - e.P[1][1], e.P[0][0] - e.P[1][0]);
    const heads = e.kind === 'line' ? [] : e.kind === 'both' ? [[tip, e.angle], [tail, back]] : [[tip, e.angle]];
    const line = hand
      ? one('path', { class: 'sg-d-path', d: e.d }) + one('path', { class: 'sg-d-ink', d: inkPath(e.samples, { width: 1.7, seed: seed + e.index, taper: 8 }) })
      : one('path', { class: 'sg-d-path', d: e.d });
    const hd = heads.map(([p, a]) => one('path', { class: 'sg-d-head', d: hand ? inkHead(p, a, { seed: seed + e.index * 3 }) : head(p, a) })).join('');
    // a flow shows three still dots along it, so it reads as a flow in print and without JavaScript
    const dots = e.kind === 'flow' ? el('g', { class: 'sg-d-dots' }, [8, 16, 24].map(i => one('circle', { cx: r1(e.samples[i][0]), cy: r1(e.samples[i][1]), r: 2.6 })).join('')) : '';
    return el('g', { class: `sg-d-edge sg-d-${e.kind}`, 'data-edge': e.index, 'data-from': e.from, 'data-to': e.to }, line + hd + dots);
  }).join('');

  const nodes = L.nodes.map((n, k) => el('g', { class: 'sg-d-node', 'data-node': n.id, 'data-hue': register === 'playful' ? (n.group ? hue.get(n.group) : (n.rank + 2) % 5) : null },
    (hand
      ? one('rect', { class: 'sg-d-fill', x: r1(n.x), y: r1(n.y), width: n.w, height: n.h, rx: 6 }) + one('path', { class: 'sg-d-ink', d: inkBox(n.x, n.y, n.w, n.h, { seed: seed + k * 7 }) })
      : one('rect', { class: 'sg-d-box', x: r1(n.x), y: r1(n.y), width: n.w, height: n.h, rx: 5 }))
    + words(n))).join('');

  const labels = L.edges.filter(e => e.labelBox).map(e => {
    const b = e.labelBox;
    // a halo in the paper colour behind the letters keeps them clear of the lines they cross
    return el('g', { class: 'sg-d-label', 'data-edge': e.index }, el('text', { class: 'sg-d-label-text', x: r1(b.x + 6), y: r1(b.y + 13) }, esc(e.label)));
  }).join('') + L.edges.filter(e => e.badge).map(e => {
    // where the words would not sit clear of the other lines, each connection carries its number;
    // the numbered text beneath says what each one is
    const g = e.badge;
    return el('g', { class: 'sg-d-label sg-d-badge', 'data-edge': e.index }, one('circle', { cx: r1(g.x), cy: r1(g.y), r: g.r }) + el('text', { x: r1(g.x), y: r1(g.y + 4.5), 'text-anchor': 'middle' }, String(g.n)));
  }).join('');

  const titleId = `${id}-title`, textId = `${id}-text`;
  const svg = el('svg', {
    class: 'sg-diagram-svg', xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${L.width} ${L.height}`, width: L.width, height: L.height,
    role: 'img', 'aria-labelledby': titleId, 'aria-describedby': textId, 'data-register': register,
  }, el('title', { id: titleId }, esc(D.title)) + el('g', { class: 'sg-d-groups' }, groups) + el('g', { class: 'sg-d-edges' }, edges)
    + el('g', { class: 'sg-d-nodes' }, nodes) + el('g', { class: 'sg-d-labels' }, labels));

  const text = steps
    ? el('ol', { class: 'sg-diagram-steps', id: textId, 'aria-label': `${D.title}: ${STRINGS.steps}` }, D.steps.map((s, k) => el('li', { 'data-step': k + 1 }, esc(s))).join(''))
    : el('details', { class: 'sg-diagram-text' }, el('summary', {}, esc(STRINGS.readAsText))
      + el('div', { id: textId }, el('p', {}, esc(D.summary)) + (D.parts ? el('p', {}, esc(`${D.parts}.`)) : '') + el('ol', {}, D.connections.map(c => el('li', {}, esc(c))).join(''))));

  const caption = model.title ? el('figcaption', {}, esc(model.title)) : '';
  const html = el('sg-diagram', {
    id, lang: opts.lang || null, 'data-register-drawn': register, 'data-steps': steps || null,
    // the direction drawn, and whether the author chose it (then a narrow screen never turns it)
    'data-direction': model.direction, 'data-direction-set': !!(opts.direction || model.directionSet) || null,
    'data-src': src, 'data-opts': JSON.stringify({ title: opts.title || undefined, direction: opts.direction || undefined, seed: opts.seed || undefined }),
  }, el('figure', { class: 'sg-diagram' }, caption + el('div', { class: 'sg-diagram-scroll' }, svg) + text));
  return { html, text: D.text, errors: model.errors };
}
