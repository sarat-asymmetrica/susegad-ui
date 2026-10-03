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

/** The pot's extent in a band of the picture, from screen points: [left, right] of the points within [top, bottom], or null. */
export function extentIn(screen, top, bottom, slack = 1.5) {
  let l = Infinity, r = -Infinity;
  for (const [x, y] of screen) if (y >= top - slack && y <= bottom + slack) { if (x < l) l = x; if (x > r) r = x; }
  return r >= l ? [l, r] : null;
}

/**
 * The room a paragraph has on each line of a column round the pot, as a shape for the type tier: for the band top..bottom,
 * the wider side of the column left or right of the pot (with \`pad\` px between), or the whole column where the pot is not.
 * \`col\` is { x, y, w, h } in px; \`extent(top, bottom)\` is the pot's [left, right] there (extentIn over the current pose).
 */
export function flowShape(col, extent, pad = 8) {
  return (top, bottom) => {
    if (top < col.y - 1e-6 || bottom > col.y + col.h + 1e-6) return null;
    const e = extent(top, bottom);
    if (!e) return { x: col.x, w: col.w };
    const left = { x: col.x, w: e[0] - pad - col.x }, right = { x: e[1] + pad, w: col.x + col.w - (e[1] + pad) };
    const best = right.w >= left.w ? right : left;
    return best.w > 0 ? best : null;
  };
}

/** The pose steps: the layout is done at a turn quantised to 1/\`steps\`, so a line moves at most once per step, not every frame. */
export const quantise = (theta, steps = 16) => Math.round((((theta % TAU) + TAU) % TAU) / TAU * steps) % steps / steps * TAU;
