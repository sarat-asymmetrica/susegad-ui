// Text zones: the convention that lets a pure model say where words go, and the
// text tier turn that into line boxes (decision 0029, rung 3).
//
// A pure core (a scene's model, a component's core) may export
//
//   textZones(state) -> [{ id, shape, slot | text, registers?, minPx, maxPx, leading?, align?, valign?, minWidth? }]
//
// where `shape` is a descriptor (layout.core.js shapeOf: rect, arch, slant,
// ellipse, polygon), plain numbers that a Node gate can read as well as a
// renderer. `slot` names a text in `texts`; `text` is the words themselves.
// `registers`, when given, lists the registers the zone is laid in (a quiet
// scene lays nothing). `minPx` and `maxPx` are CSS px, the legible floor and
// the size the words want; the logical units of the shape are `scale` CSS px
// each. layZones lays each zone with `fit` (the largest whole-px size that
// fills the shape with no broken word) and centres the block down the room
// that is left (valign 'middle', the default, or 'top'). A band narrower than
// `minWidth` is skipped, not squeezed (default four times `minPx`, so a line never
// starts at a spike's tip or an ellipse's pole with a word wider than the room).
//
// Pure: it imports the geometry and the operators, and takes the layout (an
// oracle bound by createLayout) as an argument, so it runs in Node against the
// fake oracle and in the browser against Pretext.

import { shapeOf, boundsOf } from './layout.core.js';
import { fit } from './layout.operators.js';

/**
 * @param {object} layout createLayout(oracle)
 * @param {Array<object>} zones the zone list a model returned
 * @param {Record<string, string>} texts the words by slot name
 * @param {{ family: string, weight?: number, scale?: number, register?: string }} opts
 * @returns {Record<string, { px: number|null, lines: object[], fits: boolean, lineHeight?: number, font?: string }>}
 *   by zone id. `fits` is false (and `px` null) when even `minPx` does not fit: the words belong in the flat reading.
 *   A zone not laid in `register` is left out.
 */
export function layZones(layout, zones, texts = {}, { family, weight = 400, scale = 1, register } = {}) {
  const out = {};
  for (const z of zones) {
    if (register && z.registers && !z.registers.includes(register)) continue;
    const text = z.text ?? texts[z.slot];
    if (typeof text !== 'string') throw new TypeError(`layZones: zone "${z.id}" has no text (slot "${z.slot}" is not in texts)`);
    const shape = shapeOf(z.shape), b = boundsOf(z.shape), { y: top, h } = b, bottom = top + h;
    const base = { family: z.family ?? family, weight: z.weight ?? weight, leading: z.leading ?? 1.22, scale, align: z.align, minWidth: z.minWidth ?? (4 * z.minPx) / scale };
    // every line must stand inside the true room, checked here line by line (the layout's own fit is the first word, this is the proof)
    const held = r => r.lines.every(l => { const room = shape(l.y, l.y + l.h); return room && l.x >= room.x - 1e-6 && l.x + l.w <= room.x + room.w + 1e-6; });
    // where the last line ends (the layout's own `bottom` also counts rows it stepped through looking for room after the words ran out)
    const foot = r => r.lines[r.lines.length - 1].y + r.lines[r.lines.length - 1].h;
    const run = (px, y0, opts = {}) => { const r = fit(layout, text, shape, { ...base, minPx: px, maxPx: px, top: y0, bottom, ...opts }); return r && held(r) ? r : null; };
    const at = (px, dy) => run(px, top + dy);
    // the size the words can have when laid from the top: the search over sizes, through the same open shape
    const top0 = (() => { for (let px = Math.floor(z.maxPx); px >= Math.ceil(z.minPx); px--) { const r = run(px, top); if (r) return r; } return null; })();
    if (!top0) { out[z.id] = { px: null, lines: [], fits: false }; continue; }

    // Centre down the room that is left: equal gaps above the first line and below the last, measured from the shape's top and bottom.
    // The first line may start well below the top (a narrow band is skipped), so the gap above is the real one. Moving down a shape
    // that widens re-wraps the text, so settle in a few steps and keep the last that fits.
    const centre = px => {
      let best = at(px, 0);
      if (!best) return null;
      for (let k = 0; (z.valign ?? 'middle') === 'middle' && k < 6; k++) {
        const now = best.lines[0].y, diff = bottom - foot(best) - (now - top);
        if (Math.abs(diff) / 2 < 0.5 / scale) break;
        // aim the first line at its centred row (a band too narrow to start in is skipped a quarter line at a time, so ask for the row itself)
        let want = Math.max(top, now + diff / 2), moved = at(px, want - top);
        for (let h = 0; !moved && h < 4; h++) moved = at(px, (want = now + (want - now) / 2) - top); // too far down: try half the way
        if (!moved) break;
        best = moved;
      }
      return best;
    };
    // The top-anchored fit is a floor: a block centred where a shape is widest often takes a px more, and a few more. Take the largest
    // size that is also centred (equal gaps within 0.6 of a line); if none is, the largest that fits, centred as well as it can be.
    const even = r => Math.abs((bottom - foot(r)) - (r.lines[0].y - top)) <= 0.6 * r.lineHeight;
    const tried = [];
    for (let px = top0.px; px <= Math.floor(z.maxPx); px++) {
      const next = centre(px);
      if (!next) break;
      tried.push(next);
    }
    for (let px = top0.px - 1; tried.length && !tried.some(even) && px >= Math.ceil(z.minPx); px--) {
      const next = centre(px);
      if (next) tried.push(next);
    }
    tried.sort((p, q) => q.px - p.px);
    const best = tried.find(even) ?? tried[0] ?? top0;
    out[z.id] = { px: best.px, lines: best.lines, fits: true, lineHeight: best.lineHeight, font: best.font };
  }
  return out;
}
