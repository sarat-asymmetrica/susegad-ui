// Playful: the box is a little rubber-stamp block, a heavy inked edge with a
// fine inner rule, and checking it stamps a bold tick down with a small press
// and a tilt. The tick is cut bigger than the box, so it overprints the edge, and
// its ink is starved in places with the same texture as the Wave 1 stamp, so
// it reads as printed, not drawn. A few spots of ink fly from the press.
// "Some" is a stamped bar.

import { pencilBox, handLine, STAMP_TICK, STAMP_DASH, stampPose, arrival } from '../check.core.js';
import { inkMask } from '../../stamp/stamp.core.js';
import { art } from './warm.js';

const NS = 'http://www.w3.org/2000/svg';
let masks = 0;
const textures = new Map();

/** The share of the middle of the mask (where the tick sits) that printed, 0..1. */
function printed(alpha, n) {
  let t = 0, c = 0;
  for (let y = n * 0.2 | 0; y < n * 0.8; y++) for (let x = n * 0.2 | 0; x < n * 0.8; x++) { t += alpha[y * n + x]; c++; }
  return t / c / 255;
}

/** The stamp's ink texture for a seed, as a PNG data URL (painted once per seed). */
function texture(doc, seed) {
  if (textures.has(seed)) return textures.get(seed);
  // a mark this small can lose too much to one soft patch: take the first of a few
  // variants of the seed that still prints most of the tick, so the texture never eats it
  const n = 56;
  let alpha = null;
  for (let k = 0; k < 6 && !(alpha && printed(alpha, n) >= 0.85); k++) alpha = inkMask(`check:${seed}:${k}`, n, n, { scale: 2, amount: 1.25 });
  const cv = doc.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d'), img = g.createImageData(n, n);
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i];
  g.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  if (textures.size > 64) textures.clear();
  textures.set(seed, url);
  return url;
}

export function mount(host, ctx) {
  const svg = art(host, 'sg-check-art--stamp');
  const doc = host.ownerDocument;
  const el = (name, attrs = {}) => { const e = doc.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const box = el('path', { class: 'sg-check-box' });
  const inner = el('path', { class: 'sg-check-inner' });
  const id = `sg-check-ink-${++masks}`;
  const mask = el('mask', { id, maskUnits: 'userSpaceOnUse', x: -4, y: -4, width: 28, height: 28, style: 'mask-type: alpha' });
  const tex = el('image', { x: -4, y: -4, width: 28, height: 28, preserveAspectRatio: 'none' });
  mask.append(tex);
  const stamp = el('g', { class: 'sg-check-stamp' });
  const inked = el('g', { mask: `url(#${id})` });
  const mark = el('path');
  inked.append(mark);
  stamp.append(inked);
  svg.append(mask, box, inner, stamp);
  let seed = null, was = null, anim = null;

  return {
    update(s) {
      if (s.seed !== seed) {
        seed = s.seed;
        box.setAttribute('d', pencilBox(seed, 0.3).d);
        inner.setAttribute('d', `M${handLine([[4.6, 4.5], [15.5, 4.7], [15.4, 15.5], [4.5, 15.4], [4.6, 4.5]], `${seed}:inner`, 0.2).map(p => p.map(v => v.toFixed(2)).join(' ')).join('L')}`);
        tex.setAttribute('href', texture(doc, seed));
        const pose = stampPose(seed);
        stamp.querySelectorAll('circle').forEach(c => c.remove());
        for (const sp of pose.spots) stamp.append(el('circle', { cx: sp.cx, cy: sp.cy, r: sp.r }));
        // the block is cut a size up from the box, so the tick overprints its edge
        mark.setAttribute('transform', `rotate(${pose.rotate} 10 10) translate(11 9) scale(1.4) translate(-10 -10)`);
      }
      mark.setAttribute('d', s.indeterminate ? STAMP_DASH : STAMP_TICK);
      const on = s.checked || s.indeterminate;
      stamp.style.display = on ? '' : 'none';
      inner.style.display = on ? 'none' : ''; // the stamp prints over the block's inner rule
      stamp.querySelectorAll('circle').forEach(c => { c.style.display = s.indeterminate ? 'none' : ''; });
      const a = was === false && s.checked && !s.indeterminate && arrival(ctx.motion, 'press');
      if (a) {
        anim?.cancel();
        anim = stamp.animate(a.frames, a.timing);
        anim.finished.then(x => x.cancel(), () => {});
      }
      was = s.checked;
    },
    destroy() { anim?.cancel(); svg.remove(); },
  };
}
