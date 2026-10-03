// The tiatr's velvet curtain, drawn once. The Kantar scene (a stage seen from
// the house) and the Kantar interlude (a curtain across a whole page) both
// import this, so they cannot drift into two different curtains.
//
// `curtainEdge` is pure (numbers in, points out) and tested in Node;
// `drawCurtain` is the canvas side. The velvet is a tiled strip of five colour
// stops with a slow sideways drift, a soft shadow under the pelmet and a gold
// fringe along the hem; the caller supplies the hem's shape, because the scene
// ripples it from a landing clock and the interlude from its own phases.

import { N, ink, boil, lerp } from '../engine/index.js';

/**
 * The curtain's lower edge as points: top-left, the hem across, top-right.
 * @param {{x0:number,y0:number,x1:number,y1:number}} box the opening
 * @param {number} drop 0 (up, nothing drawn) to 1 (down, a little past the opening's foot)
 * @param {(x:number, bottom:number) => number} hem y of the hem at x, given the straight bottom
 * @param {number} [step] spacing of the hem's points
 * @param {number} [overhang] how far past the foot a fully dropped curtain reaches
 */
export function curtainEdge(box, drop, hem, step = 10, overhang = 30) {
  const { x0, x1, y0, y1 } = box;
  const bottom = lerp(y0, y1 + overhang, drop);
  const pts = [[x0, y0]];
  const n = Math.max(1, Math.ceil((x1 - x0) / step));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push([x, hem(x, bottom)]);
  }
  pts.push([x1, y0]);
  return pts;
}

let FOLD = null;
function foldStrip() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, '#5e0f18');
  gr.addColorStop(0.3, '#a3202c');
  gr.addColorStop(0.55, '#c93a40');
  gr.addColorStop(0.8, '#8a1a24');
  gr.addColorStop(1, '#5e0f18');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 4);
  return c;
}

/**
 * Draw the curtain into `box`. Does nothing while it is up (drop <= 0.001).
 * @param {CanvasRenderingContext2D} g
 * @param {{x0:number,y0:number,x1:number,y1:number}} box
 * @param {object} o
 * @param {number} o.drop 0..1
 * @param {(x:number, bottom:number) => number} o.hem
 * @param {number} [o.t] seconds, for the drift of the folds and the boil of the fringe
 * @param {number} [o.scale] canvas units per design unit (the scene is 1; a page-wide curtain is wider)
 * @param {(g:CanvasRenderingContext2D, path:Path2D) => void} [o.within] called while clipped to the curtain, for a spotlight
 * @returns {Path2D|null} the curtain's outline, or null if nothing was drawn
 */
export function drawCurtain(g, box, { drop, hem, t = 0, scale = 1, within } = {}) {
  const { x0, x1, y0, y1 } = box;
  if (drop <= 0.001) return null;
  const pts = curtainEdge(box, drop, hem, 10 * scale);
  const path = new Path2D();
  pts.forEach((q, i) => (i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
  path.closePath();

  g.save();
  g.clip(path);
  FOLD ||= foldStrip();
  if (FOLD) {
    const pat = g.createPattern(FOLD, 'repeat');
    pat.setTransform(new DOMMatrix([1.1 * scale, 0, 0, 1, x0 + 6 * scale * Math.sin(t * 0.4), 0]));
    g.fillStyle = pat;
  } else {
    g.fillStyle = '#8a1a24';
  }
  g.fillRect(x0, y0, x1 - x0, y1 - y0 + 40 * scale);
  const sh = g.createLinearGradient(0, y0, 0, y0 + 120 * scale);
  sh.addColorStop(0, 'rgba(20,4,8,0.55)');
  sh.addColorStop(1, 'rgba(20,4,8,0)');
  g.fillStyle = sh;
  g.fillRect(x0, y0, x1 - x0, 120 * scale);
  within?.(g, path);
  g.restore();

  const fr = pts.slice(1, -1);
  ink(g, fr, { width: 5 * scale, color: '#d8a93e', jitter: 0.4, seed: boil(t, 6), taper: 0 });
  for (let k = 0; k < fr.length; k += 1) {
    ink(g, [fr[k], [fr[k][0] + scale, fr[k][1] + 10 * scale]], { width: 1.2 * scale, color: '#c8952e', jitter: 0.2, seed: k, taper: 2 });
  }
  return path;
}

/** A small organic wobble for a hem, shared so both callers breathe the same way. */
export const hemBreath = (x, t) => 1.5 * N(x * 0.02, t * 0.3);
