// Field note, playful skin: the warm margin note, inked on as it appears. The
// arrow is drawn, then the words are written left to right as if by a pen,
// then a wavy line underlines them. Under reduced motion it is all there at once.

import { arrowSvg, drawIn } from './warm.js';

const SVG = 'http://www.w3.org/2000/svg';

/** A hand-drawn wavy underline as path data, `w` units wide, seeded. Pure. */
export function squiggle(w, seed = 1) {
  let s = (Math.abs(seed | 0) % 2147483646) + 1;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
  const step = 9;
  let d = `M0 ${(3 + r()).toFixed(2)}`;
  for (let x = step, up = true; x <= w; x += step, up = !up) {
    d += ` Q${(x - step / 2).toFixed(1)} ${(up ? 0.4 : 5.6) + r() * 0.8} ${x.toFixed(1)} ${(3 + r() * 0.6).toFixed(2)}`;
  }
  return d;
}

export function mount(el, ctx) {
  const deco = el.querySelector(':scope > .sg-note-deco');
  const text = /** @type {HTMLElement} */ (el.querySelector('.sg-note-text'));
  let seed = null, arrow = null, line = null, was = false;
  // made once, with the arrow; each showing only changes its attributes, so the note's live
  // region never gains or loses a node after its words are written
  const underline = () => {
    const w = Math.max(20, Math.round(text.getBoundingClientRect().width));
    line.setAttribute('viewBox', `0 0 ${w} 6`);
    line.style.inlineSize = `${w}px`;
    line.firstChild.setAttribute('d', squiggle(w, seed));
    return line;
  };
  const makeLine = () => {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'sg-note-underline');
    svg.setAttribute('aria-hidden', 'true');
    svg.append(document.createElementNS(SVG, 'path'));
    return svg;
  };
  return {
    update(s) {
      if (s.seed !== seed) { seed = s.seed; arrow = arrowSvg(seed); line = makeLine(); deco.replaceChildren(arrow, line); }
      if (s.shown) underline();
      if (s.shown && !was && ctx.motion !== 'still') {
        drawIn(arrow, { duration: 220 });
        text.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
          { duration: Math.min(900, 180 + s.message.length * 14), delay: 260, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)', fill: 'backwards' });
        drawIn(line, { duration: 320, delay: 300 + Math.min(900, 180 + s.message.length * 14) });
      }
      was = s.shown;
    },
    restyle() { if (was) underline(); },
    destroy() { deco.replaceChildren(); },
  };
}
