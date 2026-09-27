#!/usr/bin/env node
// Bake the facade drawing for the enquiry page: the Casa elevation's strokes
// (facade.scene.mjs) as one still SVG line drawing, facade.svg. The page shows
// it as a CSS mask filled with the register's ink, so it needs no JavaScript and
// follows the palette and theme. Deterministic: the same strokes every time.
//
//   node packages/recipes/enquiry/facade.bake.mjs

import { writeFileSync } from 'node:fs';
import { buildScene } from './facade.scene.mjs';
import { makeNoise } from '../../engine/src/noise.js';

// the view: the whole house, gable to ground, without the path in the lawn
const [X0, Y0, X1, Y1] = [-10, 150, 1090, 1150];
// stroke widths in screen pixels (non-scaling), and how strong each kind of line is
const STYLE = {
  construct: { w: 0.55, o: 0.35 }, line: { w: 1.5, o: 1 }, detail: { w: 1.05, o: 0.9 },
  fine: { w: 0.7, o: 0.6 }, soft: { w: 0.9, o: 0.7 }, leaf: { w: 0.5, o: 0.4 },
};

const noise = makeNoise('facade');
const f = Math.round;
/** Integer points as a path of relative moves, dropping repeats: small enough to ship. */
export function rel(pts) {
  const q = pts.map(([x, y]) => [f(x), f(y)]);
  let out = `M${q[0][0]} ${q[0][1]}`, [px, py] = q[0];
  for (const [x, y] of q.slice(1)) {
    if (x === px && y === py) continue;
    out += `l${x - px} ${y - py}`;
    px = x; py = y;
  }
  return out.replace(/ -/g, '-');
}

/** The SVG text for the drawing. Pure. */
export function facadeSvg(seed = 1) {
  const byKind = {};
  let i = 0;
  for (const s of buildScene(seed).strokes) {
    if (s.kind === 'slab') continue;
    const pts = s.pts.filter(([, y]) => y > Y0 - 40 && y < Y1 + 40);
    if (pts.length < 2) continue;
    i++;
    // a little hand: each point nudged along smooth noise, as the pen would
    (byKind[s.kind] ??= []).push(rel(pts.map(([x, y], k) => [x + noise(k * 0.2, i, 1) * 2.2, y + noise(k * 0.2, i, 7) * 2.2])));
    // every other leaflet of the palms: enough to read as fronds at this size
    s.leaflets?.forEach((l, k) => { if (k % 2 === 0) (byKind.leaf ??= []).push(rel(l)); });
  }
  const paths = Object.entries(byKind).map(([k, ds]) => `<path vector-effect="non-scaling-stroke" d="${ds.join('')}" stroke-width="${STYLE[k].w}" stroke-opacity="${STYLE[k].o}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${X0} ${Y0} ${X1 - X0} ${Y1 - Y0}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>\n`;
}

if (import.meta.url === new URL(process.argv[1], 'file:').href || process.argv[1]?.endsWith('facade.bake.mjs')) {
  const svg = facadeSvg();
  writeFileSync(new URL('./facade.svg', import.meta.url), svg);
  console.log(`facade.svg: ${svg.length} bytes`);
}
