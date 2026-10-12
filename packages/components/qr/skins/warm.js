// Warm: a soft paper plate with a hand-ruled frame, a thick rule and a thin one
// inside it, wobbling a little as a hand does. The frame lies in the plate's
// padding, outside the quiet zone, so no module is ever touched. Also exports
// `framed`, which the playful skin builds on.

import { framePaths, reveal } from '../qr.helpers.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (doc, name, attrs) => {
  const e = doc.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
const STUDS = [[1.6, 1.6, 2.2], [98.4, 1.6, 2.2], [98.4, 98.4, 2.2], [1.6, 98.4, 2.2], [50, 1.6, 1.3], [50, 98.4, 1.3], [1.6, 50, 1.3], [98.4, 50, 1.3]];

/**
 * @param {HTMLElement} host
 * @param {{ motion: string }} ctx
 * @param {{ ornament?: boolean, draw?: boolean }} [opts]
 */
export function framed(host, ctx, { ornament = false, draw = false } = {}) {
  const doc = host.ownerDocument, plate = host.querySelector('.sg-qr-plate');
  const svg = el(doc, 'svg', { class: 'sg-qr-frame', viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' });
  const outer = el(doc, 'path', { class: 'sg-qr-rule', pathLength: '1' });
  const inner = el(doc, 'path', { class: 'sg-qr-rule sg-qr-rule-fine', pathLength: '1' });
  svg.append(outer, inner);
  if (ornament) {
    // block-print studs: a diamond on each corner and a small one in the middle of each side
    for (const [x, y, r] of STUDS) svg.append(el(doc, 'path', { class: r > 2 ? 'sg-qr-stud sg-qr-stud-corner' : 'sg-qr-stud', d: `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}z` }));
  }
  plate.append(svg);

  let seed = null, played = false;
  const anims = [];
  const play = () => {
    const r = reveal(ctx.motion);
    if (!draw || played || !r) return;
    played = true;
    for (const path of [outer, inner]) anims.push(path.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], r));
    for (const s of svg.querySelectorAll('.sg-qr-stud')) anims.push(s.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: r.duration, easing: 'ease-out' }));
    for (const a of anims) a.finished.then(x => x.cancel(), () => {});
  };

  return {
    update(s) {
      if (s.seed !== seed) {
        seed = s.seed;
        const f = framePaths(seed, { wobble: ornament ? 0.9 : 0.7 });
        outer.setAttribute('d', f.outer);
        inner.setAttribute('d', f.inner);
      }
      if (s.visible && s.modules) play();
    },
    destroy() { anims.forEach(a => a.cancel()); svg.remove(); },
  };
}

export const mount = (host, ctx) => framed(host, ctx);
