// The clay pot on the balcao (a ghadaa: a water pot with a spout and a handle) and the words that flow round it. The pure half.
//
// The pot is a surface of revolution (its profile), with a handle on one side and a spout on the other, so its silhouette
// changes as it turns (a plain matka would look the same from every side). It is drawn by three.js on the live tier (the
// same numbers build its geometry) and from a still on the 2D tier. Each frame its silhouette is projected into a room per
// line, and the type tier lays a paragraph round it, one width per line. No DOM, no three: runs in Node.

const TAU = Math.PI * 2;

/** The pot, in units of its own height (1 tall). profile: [radius, height] from the foot to the lip. */
export const MATKA = {
  profile: [[0, 0], [0.2, 0.01], [0.3, 0.07], [0.42, 0.26], [0.47, 0.46], [0.42, 0.68], [0.25, 0.83], [0.2, 0.9], [0.27, 0.97], [0.27, 1.0]],
  handle: { x: 0.5, y: 0.6, major: 0.2, minor: 0.034 },   // a loop on the +x side, in the x-y plane
  spout: { x0: -0.42, y0: 0.36, x1: -0.58, y1: 0.5, r: 0.04 }, // a short tube out of the -x side
};

/** Points on the pot's surface after it has turned by \`theta\` radians about its axis: [{ x, y, z }] (x right, y up, z toward the viewer). */
export function surfacePoints(theta, m = MATKA, seg = 28) {
  const pts = [], c = Math.cos(theta), s = Math.sin(theta), put = (x, y, z) => pts.push({ x: x * c + z * s, y, z: -x * s + z * c });
  for (const [r, y] of m.profile) for (let i = 0; i < seg; i++) { const a = i / seg * TAU; put(Math.cos(a) * r, y, Math.sin(a) * r); }
  // rings between the profile's points, so a long wall has vertices along it
  for (let k = 0; k + 1 < m.profile.length; k++) {
    const [r0, y0] = m.profile[k], [r1, y1] = m.profile[k + 1];
    for (let i = 0; i < seg; i++) { const a = i / seg * TAU; put(Math.cos(a) * (r0 + r1) / 2, (y0 + y1) / 2, Math.sin(a) * (r0 + r1) / 2); }
  }
  const h = m.handle;
  for (let i = 0; i < 36; i++) for (let j = 0; j < 8; j++) {
    const a = i / 36 * TAU, b = j / 8 * TAU, R = h.major + h.minor * Math.cos(b);
    put(h.x + Math.cos(a) * R, h.y + Math.sin(a) * R, h.minor * Math.sin(b));
  }
  const p = m.spout;
  for (let i = 0; i <= 10; i++) for (let j = 0; j < 8; j++) {
    const t = i / 10, b = j / 8 * TAU, dx = p.x1 - p.x0, dy = p.y1 - p.y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    put(p.x0 + dx * t + nx * p.r * Math.cos(b), p.y0 + dy * t + ny * p.r * Math.cos(b), p.r * Math.sin(b));
  }
  return pts;
}

/** Points to the picture: the pot's foot centre at (cx, cy) px, \`px\` px per unit of its height, looking straight on. */
export const toScreen = (pts, cx, cy, px) => pts.map(p => [cx + p.x * px, cy - p.y * px]);

// The pot's silhouette in a band (extentIn) and the room a column has beside it (flowShape) are the stage3d tier's occlusion
// helper, for any 3D object; the pot only supplies its surface points. Re-exported so the scene keeps one import.
export { extentIn, flowShape, silhouetteOf, hugFloat } from '../../stage3d/occlusion.core.js';

/** Pot heights are laid out at `hq` px per pot height. The pane's column in px from the pot's foot: ends at the pot's middle (the pot straddles the pane's edge, about a third of it outside) and starts a little above its lip. `grow` makes it taller (larger text needs more lines than the pot's height allows for). */
export function columnAt(hq, grow = 1) {
  const w = Math.round(hq * 4.3);
  return { x: hq * 0.05 - w, y: -hq * 1.15, w, h: Math.round(hq * 3.3 * grow) };
}

/** The pose steps: the layout is done at a turn quantised to 1/\`steps\`, so a line moves at most once per step, not every frame. */
export const quantise = (theta, steps = 16) => Math.round((((theta % TAU) + TAU) % TAU) / TAU * steps) % steps / steps * TAU;
