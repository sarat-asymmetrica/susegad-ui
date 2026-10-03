// stage3d.core.js: the pure maths of the stage3d tier. No DOM, no three; runs in Node.
//
// - chooseTier: live 3D, a 2D drawing, or the finished still, from what the
//   device can do and what the reader asked for.
// - depthToZ / reproject: a photo plus a depth map becomes a surface in front
//   of a camera, so that from the rest position it projects exactly back onto
//   the photo, and any move of the camera gives true parallax.
// - coverWindow: the camera's frustum window that covers a viewport with the
//   photo (like object-fit: cover), keeping a chosen point in view.
// - cameraAt: the camera along a dolly path, plus pointer or tilt parallax.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Which tier to draw with. Pure.
 * 'live': three.js, moving (the sea, parallax, the rack focus as it happens).
 * '2d': a canvas drawing redrawn only when a param changes: the rack focus
 * still shows, beat by beat, and nothing moves on its own. Quiet, reduced
 * motion, Save-Data, low-memory devices and software WebGL (no GPU) get this
 * without downloading three.
 * 'still': the native <img> only (forced, or when even a 2D canvas fails).
 * @param {{ webgl?: boolean, three?: boolean, motion?: 'still'|'state'|'ambient'|'full', lite?: boolean, software?: boolean, forced?: string|null }} s
 */
export function chooseTier({ webgl = true, three = true, motion = 'ambient', lite = false, software = false, forced = null } = {}) {
  if (forced === 'live' || forced === '2d' || forced === 'still') return forced;
  if (motion === 'still' || motion === 'state') return '2d';
  if (!webgl || !three || lite || software) return '2d';
  return 'live';
}

/**
 * True when a WebGL renderer string names a software rasteriser: the browser
 * has no usable GPU and emulates one on the CPU, where a live depth stage costs
 * ten times a 2D one. Pure.
 */
export const isSoftwareRenderer = s => /swiftshader|llvmpipe|softpipe|software|basic render driver|microsoft basic/i.test(String(s ?? ''));

/** Near and far distances the depth map spans, in scene units. */
export const Z_NEAR = 1;
export const Z_FAR = 10;

/**
 * Depth value (0 far, 1 near; the depth tool's encoding) to distance from the
 * rest camera. Linear in inverse distance, like the model's own output.
 */
export const depthToZ = (d, near = Z_NEAR, far = Z_FAR) => 1 / (clamp(d, 0, 1) * (1 / near - 1 / far) + 1 / far);

/**
 * The point on the surface for photo coordinates (u, v) in [0, 1] (v down) at
 * depth d, for a rest camera at the origin looking down -z whose frustum is
 * tanX x tanY at unit distance. From the rest camera it projects back to (u, v).
 */
export function reproject(u, v, d, tanX, tanY, near = Z_NEAR, far = Z_FAR) {
  const z = depthToZ(d, near, far);
  return [(u * 2 - 1) * tanX * z, (1 - v * 2) * tanY * z, -z];
}

/**
 * The frustum window (tangents at unit distance) that covers a viewport of
 * aspect `va` (w / h) with a photo of aspect `pa`, whose own frustum is
 * tanX x tanY, keeping `keep` (photo u, v) as near the centre as the crop
 * allows. `overscan` < 1 zooms in so a moving camera never shows the edge.
 * Returns { left, right, top, bottom } in tangent units (multiply by near).
 */
export function coverWindow(va, pa, tanY, { keep = [0.5, 0.5], overscan = 0.92 } = {}) {
  const tanX = tanY * pa;
  let w, h;
  if (va < pa) { h = tanY * overscan; w = h * va; }  // taller than the photo: crop the sides
  else { w = tanX * overscan; h = w / va; }           // wider: crop top and bottom
  const cx = clamp((keep[0] * 2 - 1) * tanX, -tanX + w, tanX - w);
  const cy = clamp((1 - keep[1] * 2) * tanY, -tanY + h, tanY - h);
  return { left: cx - w, right: cx + w, top: cy + h, bottom: cy - h };
}

/**
 * Where photo point (u, v, d) lands in the viewport, in [0, 1] (y down), for a
 * camera at `cam` = { x, y, z, pitch } (pitch in radians, nose down negative)
 * and a window from coverWindow. The same maths the vertex shader does; used
 * to place DOM overlays (the garnish) on the plate, and by the tests.
 */
export function projectPoint(u, v, d, win, cam, tanY, pa) {
  const tanX = tanY * pa;
  let [x, y, z] = reproject(u, v, d, tanX, tanY);
  x -= cam.x; y -= cam.y; z -= cam.z;
  const c = Math.cos(-cam.pitch), s = Math.sin(-cam.pitch);
  const y2 = y * c - z * s, z2 = y * s + z * c;
  const px = x / -z2, py = y2 / -z2;
  return [(px - win.left) / (win.right - win.left), (win.top - py) / (win.top - win.bottom)];
}

/**
 * The camera for dolly amount `t` in [0, 1] along `path` = [dx, dy, forward,
 * pitchDeg], plus parallax from a pointer or tilt `p` = [px, py] in [-1, 1]
 * scaled by `strength` (scene units at the near plane). Pure.
 */
export function cameraAt(t, path = [0, -0.06, 0.28, -3], p = [0, 0], strength = 0) {
  const k = clamp(t, 0, 1);
  return {
    x: lerp(0, path[0], k) + clamp(p[0], -1, 1) * strength,
    y: lerp(0, path[1], k) - clamp(p[1], -1, 1) * strength * 0.6,
    z: -lerp(0, path[2], k),
    pitch: lerp(0, path[3], k) * Math.PI / 180,
  };
}

/** Parse "a b c d" into numbers, falling back to `d` for any unreadable part. */
export function parseVec(s, d) {
  if (Array.isArray(s)) return d.map((x, i) => (Number.isFinite(+s[i]) ? +s[i] : x));
  const parts = String(s ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
  return d.map((x, i) => (Number.isFinite(parts[i]) ? parts[i] : x));
}

/** A spring-free exponential follow, frame-rate independent: move `a` toward `b` with time constant `tau` s over `dt` s. */
export const follow = (a, b, dt, tau) => b + (a - b) * Math.exp(-Math.max(0, dt) / Math.max(1e-3, tau));
