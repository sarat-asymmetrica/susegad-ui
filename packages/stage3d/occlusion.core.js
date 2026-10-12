// What a 3D object takes from a paragraph: its silhouette on the screen, as the room the type tier lays words into. The pure half.
//
// Pure geometry, no three, no DOM, no layout of its own (decision 0029: stage3d paints, the type tier lays). A projected
// silhouette goes in as screen points [[x, y], …]; what comes out is a *shape* for the type tier:
//   flowShape(col, extent, pad)   a function (top, bottom) -> { x, w } | null, for layIntoShape / layZones: the room a column
//                                 has beside the object on each line
//   silhouetteOf(screen, …)       the same silhouette as a polygon descriptor { kind: 'polygon', points }, for shapeOf and the
//                                 text gate (which reads shapes as data)
//   hugFloat(screen, col, …)      the still: the silhouette's left edge as a CSS float and its polygon(), for shape-outside
// Projecting a mesh to screen points needs three, so it lives in occlusion.live.js.

/** The object's extent in a band of the picture, from screen points: [left, right] of the points within [top, bottom], or null. */
export function extentIn(screen, top, bottom, slack = 1.5) {
  let l = Infinity, r = -Infinity;
  for (const [x, y] of screen) if (y >= top - slack && y <= bottom + slack) { if (x < l) l = x; if (x > r) r = x; }
  return r >= l ? [l, r] : null;
}

/**
 * The room a paragraph has on each line of a column round an object, as a shape for the type tier: for the band top..bottom,
 * the wider side of the column left or right of the object (with `pad` px between), or the whole column where the object is
 * not. `col` is { x, y, w, h } in px; `extent(top, bottom)` is the object's [left, right] there (extentIn over the current pose).
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

/** The silhouette row by row, from `top` to `bottom`: [{ y0, y1, l, r }], each grown by `pad` all round (the object's keep-out), skipping rows with no object. */
export function rowsOf(screen, { top, bottom, rows = 48, pad = 0 } = {}) {
  const out = [], step = (bottom - top) / rows;
  for (let i = 0; i < rows; i++) {
    const y0 = top + i * step, y1 = y0 + step, e = extentIn(screen, y0 - pad, y1 + pad, 0);
    if (e) out.push({ y0, y1, l: e[0] - pad, r: e[1] + pad });
  }
  return out;
}

/**
 * The silhouette as a polygon descriptor for the geometry core ({ kind: 'polygon', points }, stepped by row, left edge down
 * then right edge up), or null where there is no object. With `pad` it is the keep-out, not the object.
 */
export function silhouetteOf(screen, opts) {
  const rows = rowsOf(screen, opts);
  if (rows.length < 2) return null;
  const f = v => +v.toFixed(2), left = [], right = [];
  for (const q of rows) { left.push([f(q.l), f(q.y0)], [f(q.l), f(q.y1)]); right.push([f(q.r), f(q.y1)], [f(q.r), f(q.y0)]); }
  return { kind: 'polygon', points: [...left, ...right.reverse()] };
}

/** `polygon(x y, …)` for CSS from [x, y] points, in px, moved by (dx, dy). */
export const cssPolygon = (points, dx = 0, dy = 0) => `polygon(${points.map(([x, y]) => `${(x + dx).toFixed(1)}px ${(y + dy).toFixed(1)}px`).join(', ')})`;

/**
 * The still's version of the flow: a float on the column's right edge whose shape-outside is the object's left edge, so the
 * browser's own line breaking runs round it with nothing measured. `col` is { x, y, w, h } as for flowShape; the keep-out is
 * grown by `pad` (the same gap the live layout leaves).
 * @returns {{ w: number, h: number, polygon: string, edge: number[][] } | null}  box size in px, shape-outside value, and the
 *   left edge [[x, y]] in the column's own px (x from the column's left), or null where the object is clear of the column
 */
export function hugFloat(screen, col, { pad = 8, rows = 48 } = {}) {
  const right = col.x + col.w, top = col.y;
  let bottom = top;
  for (const [, y] of screen) if (y > bottom && y <= col.y + col.h) bottom = y;
  const rs = rowsOf(screen, { top, bottom: bottom + pad, rows, pad });
  if (!rs.length) return null;
  const left = Math.max(col.x, Math.min(...rs.map(q => q.l)));
  if (left >= right) return null;
  const w = right - left, h = bottom + pad - top, edge = [];
  for (const q of rs) { const x = Math.min(right, Math.max(left, q.l)) - left; edge.push([x, q.y0 - top], [x, q.y1 - top]); }
  const first = rs[0].y0 - top, last = rs.at(-1).y1 - top;
  const pts = [[w, 0], [w, first], ...edge, [w, last], [w, h]];
  return { w, h, polygon: cssPolygon(pts), edge: edge.map(([x, y]) => [x + (left - col.x), y]) };
}
