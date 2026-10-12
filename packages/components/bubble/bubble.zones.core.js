// Bubble text zones: the pure geometry that turns a drawn outline into the
// corridor the words may stand in. Runs in Node, no dependencies.
//
// A bubble draws an outline (a cloud, a burst, a balloon) and the words must
// stay clear of it: a line set against the pen reads as a mistake. So for a
// clearance eps we ask the outline two questions, both read from its signed
// distance field:
//
//   signedDistance(shape)          how far inside the outline a point is, in px
//   corridor(shape, y0, y1, eps)   the widest stretch of the band [y0, y1] every
//                                  point of which is eps or more inside
//
// clearanceZone(shape, eps) walks the corridor row by row into a polygon the
// bubble hands to layZones (packages/type/layout.zones.js). The guarantee is
// not merely sampled: a distance field is 1-Lipschitz, so two points a distance
// d apart differ by at most d. Sampling the corridor on a grid and keeping half
// the grid step in hand therefore proves the clearance between the samples too.
// Every point of the zone is eps or more from the outline, not only the points
// we happened to measure.
//
// The outline is an ellipse or a polygon (layout.core.js shapeOf). The polygon
// distance is exact: the nearest edge, signed by the even-odd rule. The ellipse
// distance is the true point-to-ellipse distance, found by bisecting the
// closest-point condition, so its error sits at the bisection floor (about
// 1e-12 px). A cheap provable lower bound is documented with it, for a caller
// that would rather trade tightness for speed: inside, the true distance is at
// least (1 - g) * min(rx, ry), where g = ||(x/rx, y/ry)||, and equality holds
// for a circle. The bubble insets polygons, so the ellipse path is exercised by
// the tests and by any caller that hands the zone an ellipse.

const r2 = v => Math.round(v * 100) / 100;

/** Where a horizontal line at y crosses a polygon, sorted left to right. */
function crossings(points, y) {
  const xs = [];
  for (let i = 0, n = points.length; i < n; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % n];
    if ((y0 <= y) !== (y1 <= y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
  }
  return xs.sort((a, b) => a - b);
}

/** The exact signed distance to a simple polygon: the nearest edge, positive inside. */
export function polygonDistance(points, x, y) {
  return makePolygonSDF(points)(x, y);
}

/**
 * A signed distance field for a polygon, edges flattened into typed arrays so a
 * corridor's many probes stay cheap: one pass computes the nearest edge and the
 * even-odd crossing together, and the squared distance is only rooted once.
 */
function makePolygonSDF(points) {
  const n = points.length, xs = new Float64Array(n), ys = new Float64Array(n);
  for (let i = 0; i < n; i++) { xs[i] = points[i][0]; ys[i] = points[i][1]; }
  return (x, y) => {
    let best = Infinity, inside = false;
    for (let i = 0; i < n; i++) {
      const ax = xs[i], ay = ys[i], j = i + 1 === n ? 0 : i + 1, bx = xs[j], by = ys[j];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + t * dx - x, qy = ay + t * dy - y, d2 = qx * qx + qy * qy;
      if (d2 < best) best = d2;
      if ((ay > y) !== (by > y) && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) inside = !inside;
    }
    const d = Math.sqrt(best);
    return inside ? d : -d;
  };
}

/**
 * The signed distance to an ellipse with centre (cx, cy) and radii rx, ry,
 * positive inside. The closest point on the ellipse to (x, y) has the form
 * (rx^2 X / (t + rx^2), ry^2 Y / (t + ry^2)) for a single t > -min(rx, ry)^2,
 * where F(t) = 0. F runs from +infinity at the lower end to -1 at infinity, so
 * a bisection (24 halvings) finds t to about 1e-7 px of the closest point, far
 * under any clearance a bubble would declare. A point on an axis or at the
 * centre is handled directly, since F has no sign change there.
 */
export function ellipseDistance(cx, cy, rx, ry, x, y) {
  const a = Math.abs(rx), b = Math.abs(ry);
  const px = x - cx, py = y - cy;
  if (a < 1e-9 && b < 1e-9) return -Math.hypot(px, py);
  if (a < 1e-9 || b < 1e-9) { // a flat ellipse is a segment, with no inside
    const L = Math.max(a, b), along = a >= b ? px : py, across = a >= b ? py : px;
    return -Math.hypot(along - Math.max(-L, Math.min(L, along)), across);
  }
  const inside = (px / a) ** 2 + (py / b) ** 2 <= 1;
  // Work in a frame whose x axis is the major axis, so the closest-point
  // equation's lower bound is -B^2 and the poles sit on x.
  const swap = b > a;
  const A = swap ? b : a, B = swap ? a : b;
  const u = swap ? py : px, v = swap ? px : py;
  let qu, qv;
  if (Math.abs(u) <= 1e-9 * A && Math.abs(v) <= 1e-9 * B) { qu = 0; qv = B; } // the centre: the minor pole
  else if (Math.abs(v) <= 1e-9 * B) { qu = u < 0 ? -A : A; qv = 0; }           // on the major axis: the pole
  else if (Math.abs(u) <= 1e-9 * A) { qu = 0; qv = v < 0 ? -B : B; }           // on the minor axis: the pole
  else {
    const su = u < 0 ? -1 : 1, sv = v < 0 ? -1 : 1;
    const U = Math.abs(u), V = Math.abs(v);
    const F = t => (A * U / (t + A * A)) ** 2 + (B * V / (t + B * B)) ** 2 - 1;
    let lo, hi;
    if (F(0) > 0) { lo = 0; hi = A * U + B * V; while (F(hi) > 0) hi *= 2; }
    else { lo = -B * B + 1e-12; hi = 0; }
    const loSign = F(lo) > 0;
    for (let k = 0; k < 24; k++) {
      const m = (lo + hi) / 2;
      if ((F(m) > 0) === loSign) lo = m; else hi = m;
    }
    const t = (lo + hi) / 2;
    qu = su * (A * A * U) / (t + A * A); qv = sv * (B * B * V) / (t + B * B);
  }
  const qx = swap ? qv : qu, qy = swap ? qu : qv;
  const d = Math.hypot(px - qx, py - qy);
  return inside ? d : -d;
}

/** The signed distance field for a shape descriptor (ellipse or polygon). */
export function signedDistance(shape) {
  const d = shape;
  if (d?.kind === 'ellipse') return (x, y) => ellipseDistance(d.cx, d.cy, d.rx, d.ry, x, y);
  if (d?.kind === 'polygon') return makePolygonSDF(d.points);
  throw new TypeError(`bubble zones: no distance field for shape "${d?.kind}"`);
}

/** The box a shape descriptor stands in, { x, y, w, h }. */
function shapeBounds(d) {
  if (d.kind === 'ellipse') return { x: d.cx - d.rx, y: d.cy - d.ry, w: 2 * d.rx, h: 2 * d.ry };
  const xs = d.points.map(p => p[0]), ys = d.points.map(p => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/**
 * A point known to sit inside the shape: the ellipse centre, or the middle of
 * the widest interior stretch at the shape's mid height (the centroid can fall
 * in a notch on a concave polygon, this cannot).
 */
function shapeAnchor(d) {
  const b = shapeBounds(d);
  if (d.kind === 'ellipse') return { x: d.cx, y: d.cy };
  const y = b.y + b.h / 2, xs = crossings(d.points, y);
  let best = null;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const w = xs[i + 1] - xs[i];
    if (!best || w > best.w) best = { x: (xs[i] + xs[i + 1]) / 2, w };
  }
  return { x: best ? best.x : b.x + b.w / 2, y };
}

/**
 * Walk out from a point that is inside by eps, in one direction, until the
 * field drops below eps, then bisect the last gap. Returns the last x still at
 * or above eps, or the limit if the field never drops.
 */
function reach(sdf, y, x0, dir, eps, limit) {
  let step = 0.5, good = x0, bad = null;
  for (let i = 0; i < 64; i++) {
    const x = x0 + dir * step;
    if (dir < 0 ? x <= limit : x >= limit) { bad = limit; break; }
    if (!(sdf(x, y) >= eps)) { bad = x; break; }
    good = x; step *= 1.5;
  }
  if (bad === null) return good;
  for (let k = 0; k < 8; k++) {
    const m = (good + bad) / 2;
    if (sdf(m, y) >= eps) good = m; else bad = m;
  }
  return good;
}

/** The one stretch of the row at y that holds the anchor and stays eps inside, [x0, x1], or null. */
function corridorRow(sdf, anchorX, y, eps, bounds) {
  if (!(sdf(anchorX, y) >= eps)) return null;
  const left = reach(sdf, y, anchorX, -1, eps, bounds.x - 1);
  const right = reach(sdf, y, anchorX, +1, eps, bounds.x + bounds.w + 1);
  return right - left > 1e-9 ? [left, right] : null;
}

/**
 * The corridor of a band: the widest stretch of [y0, y1] every point of which
 * is eps or more inside the outline. The band is sampled every `step` px and
 * the rows intersected; because the field is 1-Lipschitz the sample at the
 * nearer edge of a gap is never more than step / 2 out, so callers that add
 * that margin get the true band clearance. Null when the band has no room.
 *
 * @returns {{ x: number, w: number } | null}
 */
export function corridor(shape, y0, y1, eps, { step = 1 } = {}) {
  const sdf = signedDistance(shape), b = shapeBounds(shape), a = shapeAnchor(shape);
  const n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / step));
  let x0 = -Infinity, x1 = Infinity;
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    const r = corridorRow(sdf, a.x, y, eps, b);
    if (!r) return null;
    if (r[0] > x0) x0 = r[0];
    if (r[1] < x1) x1 = r[1];
  }
  return x1 - x0 > 1e-9 ? { x: x0, w: x1 - x0 } : null;
}

/**
 * The zone: the corridor region as a polygon descriptor, inset eps from the
 * outline. Rows are taken top to bottom down the left wall and back up the
 * right, so the polygon is simple and star-shaped about the anchor. The margin
 * is not fixed: the zone is built at level eps + m and m is raised until the
 * polygon's own boundary, sampled every px, sits at eps + 0.52 or better.
 * A distance field is 1-Lipschitz, so a boundary that clears eps + 0.52 at
 * px samples clears eps everywhere; and the least distance over a region
 * is on its boundary, so the whole zone clears eps. A convex corridor passes at
 * the first, smallest margin, since its chords bend inward; a concave one grows
 * the margin until its chords stop cutting the corner. Null when the shape is
 * too thin to hold a corridor at all.
 *
 * @returns {{ kind: 'polygon', points: number[][] } | null}
 */
export function clearanceZone(shape, eps, { step = 1 } = {}) {
  const sdf = signedDistance(shape), b = shapeBounds(shape), a = shapeAnchor(shape);
  const n = Math.max(4, Math.min(16, Math.ceil(b.h / step)));
  for (let m = step / 2 + 0.03; m <= step / 2 + 96; m *= 1.5) {
    const rows = [];
    for (let i = 0; i <= n; i++) {
      const y = b.y + (b.h * i) / n;
      const r = corridorRow(sdf, a.x, y, eps + m, b);
      rows.push(r ? { y, x0: r[0], x1: r[1] } : null);
    }
    // the longest unbroken run of rows: a shape with a waist keeps its widest part
    let best = null;
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i]) continue;
      let j = i;
      while (j + 1 < rows.length && rows[j + 1]) j++;
      if (!best || j - i > best[1] - best[0]) best = [i, j];
      i = j;
    }
    if (!best || best[1] - best[0] < 2) return null;
    const run = rows.slice(best[0], best[1] + 1);
    const zone = {
      kind: 'polygon',
      points: [
        ...run.map(p => [r2(p.x0), r2(p.y)]),
        ...[...run].reverse().map(p => [r2(p.x1), r2(p.y)]),
      ],
    };
    if (boundaryClear(zone, sdf, eps + 0.52, 1)) return zone;
  }
  return null;
}

/** True when every `step`-px sample of a polygon's boundary stands at `level` or better (a 1-Lipschitz field, so a sample every `step` px bounds the error between samples by `step / 2`). */
function boundaryClear(zone, sdf, level, step = 0.5) {
  const pts = zone.points;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j <= k; j++) {
      const t = j / k;
      if (sdf(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) < level) return false;
    }
  }
  return true;
}




