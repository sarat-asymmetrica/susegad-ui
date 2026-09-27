// EmptyState: the pure half. Which scene to show, the params passed through to
// it, and the quiet skin's hairline drawing as SVG path data. Runs in Node.

/**
 * Every word a person can hear or read. The words of an empty state are the
 * builder's; the scene brings its own name and keyboard help. Kathakar owns these.
 */
export const STRINGS = {};

export const DEFAULT_SCENE = 'paus';

/** A scene name is a folder name: lowercase kebab-case, or the default. */
export const sceneName = v => (typeof v === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(v.trim()) ? v.trim() : DEFAULT_SCENE);

/**
 * Attributes named scene-<param> pass through to the scene as <param>.
 * @param {Iterable<[string, string]>} attrs name/value pairs
 */
export function sceneParams(attrs) {
  const out = {};
  for (const [k, v] of attrs) if (k.startsWith('scene-') && k.length > 6 && /^[a-z][a-z0-9-]*$/.test(k.slice(6))) out[k.slice(6)] = v;
  return out;
}

const r1 = n => Math.round(n * 10) / 10;
const rect = (x, y, w, h) => `M${r1(x)},${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`;
const line = (x0, y0, x1, y1) => `M${r1(x0)},${r1(y0)}L${r1(x1)},${r1(y1)}`;
/** A drop: a small teardrop, point up. */
const drop = (x, y, r) => `M${r1(x)},${r1(y - r * 1.9)}C${r1(x + r * 0.3)},${r1(y - r)} ${r1(x + r)},${r1(y - r * 0.4)} ${r1(x + r)},${r1(y + r * 0.1)}A${r1(r)},${r1(r)} 0 0 1 ${r1(x - r)},${r1(y + r * 0.1)}C${r1(x - r)},${r1(y - r * 0.4)} ${r1(x - r * 0.3)},${r1(y - r)} ${r1(x)},${r1(y - r * 1.9)}Z`;

/**
 * The quiet skin's still: a hairline drawing for the scene, in a 160 × 112 box.
 * Paus gets its window (oyster-shell strip, two panes, a sill, a few drops and one
 * run); anything else gets an empty tray. Returns { viewBox, lines, marks }:
 * `lines` are stroked hairlines, `marks` are small filled shapes.
 */
export function illustration(name = DEFAULT_SCENE) {
  if (name !== 'paus') {
    return {
      viewBox: '0 0 160 112',
      lines: [
        'M24,58L40,34H120L136,58', rect(24, 58, 112, 30),
        line(58, 58, 64, 70) + line(64, 70, 96, 70) + line(96, 70, 102, 58),
      ].join(''),
      marks: '',
    };
  }
  const x0 = 30, y0 = 8, w = 100, h = 84, t = 6, cap = 12, cols = 6;
  const ix = x0 + t, iy = y0 + t, iw = w - 2 * t, gy = iy + cap + 4, mid = x0 + w / 2;
  let lines = rect(x0, y0, w, h) + rect(ix, iy, iw, h - 2 * t);
  for (let i = 1; i < cols; i++) lines += line(ix + (iw * i) / cols, iy, ix + (iw * i) / cols, iy + cap);
  lines += line(ix, iy + cap, ix + iw, iy + cap) + line(ix, gy, ix + iw, gy);
  lines += line(mid - 1.5, gy, mid - 1.5, y0 + h - t) + line(mid + 1.5, gy, mid + 1.5, y0 + h - t);
  lines += `M${x0 - 8},${y0 + h}H${x0 + w + 8}l4,5H${x0 - 12}Z`;
  // one runner's trail, wandering down the right pane
  lines += `M104,${gy + 14}c1.5,8 -2,14 0,22s-1.5,12 0.5,18`;
  const marks = [[58, gy + 18, 1.6], [70, gy + 34, 1.1], [52, gy + 44, 1.3], [74, gy + 52, 0.9], [92, gy + 26, 1.2], [118, gy + 40, 1], [104.5, gy + 12, 2.1]]
    .map(([x, y, r]) => drop(x, y, r)).join('');
  return { viewBox: '0 0 160 112', lines, marks };
}
