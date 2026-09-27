// Field note, warm skin: a margin note in the hand face with a pencil arrow
// that hooks up into the field. The arrow is seeded from the note's id, so
// each note's arrow is drawn a little differently and always the same way.
// When the note appears the arrow is drawn in one stroke; under reduced
// motion it is simply there.

const SVG = 'http://www.w3.org/2000/svg';

// valueRuns lives in the core now (the element writes the runs); kept here for the tests that import it
export { valueRuns } from '../field-note.core.js';

/**
 * The pencil arrow from the note up to the field, as SVG path data in a
 * 40×28 box: a curve that leaves the note's left edge, rises, and hooks into
 * the field above, with a two-stroke head. A seed wobbles it so no two
 * notes are drawn quite alike. Pure.
 */
export function arrowPath(seed = 1) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  const r = () => ((s = (s * 48271) % 2147483647) / 2147483647 - 0.5);
  const j = k => +(r() * k).toFixed(2);
  const sx = 34 + j(2), sy = 24 + j(1.5);     // from the note
  const ex = 10 + j(2), ey = 3 + j(1);         // to just under the field
  const c1x = 22 + j(4), c1y = 27 + j(2);
  const c2x = 6 + j(3), c2y = 18 + j(3);
  const shaft = `M${sx} ${sy} C${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`;
  // the head follows the curve's last direction
  const ang = Math.atan2(ey - c2y, ex - c2x);
  const arm = (a, len) => `${(ex - Math.cos(a) * len).toFixed(2)} ${(ey - Math.sin(a) * len).toFixed(2)}`;
  const head = `M${arm(ang - 0.5, 6 + j(1))} L${ex} ${ey} L${arm(ang + 0.55, 5.5 + j(1))}`;
  return { shaft, head, end: [ex, ey] };
}

export function arrowSvg(seed) {
  const { shaft, head } = arrowPath(seed);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'sg-note-arrow');
  svg.setAttribute('viewBox', '0 0 40 28');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of [shaft, head]) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

/** Draw each path in turn with a dash as long as the path. */
export function drawIn(svg, { duration = 260, delay = 0 } = {}) {
  const paths = [...svg.querySelectorAll('path')];
  let t = delay;
  return Promise.all(paths.map((p, i) => {
    const len = p.getTotalLength?.() || 60;
    const d = i === 0 ? duration : duration * 0.4;
    const a = p.animate(
      [{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: '0' }],
      { duration: d, delay: t, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)', fill: 'backwards' },
    );
    t += d;
    return a.finished.then(() => a.cancel(), () => {});
  }));
}

export function mount(el, ctx) {
  const deco = el.querySelector(':scope > .sg-note-deco');
  let seed = null, arrow = null, was = false;
  return {
    update(s) {
      if (s.seed !== seed) { seed = s.seed; arrow = arrowSvg(seed); deco.replaceChildren(arrow); }
      if (s.shown && !was && ctx.motion !== 'still') {
        drawIn(arrow);
        el.querySelector('.sg-note-text')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, delay: 120, easing: 'ease-out', fill: 'backwards' });
      }
      was = s.shown;
    },
    destroy() { deco.replaceChildren(); },
  };
}
