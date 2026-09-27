// Toast, playful skin: the inland letter unfolds, then a postmark lands on its
// stamp with a small press. The postmark is decoration (aria-hidden); the tone
// is already spoken and drawn by the stamp's glyph.

import { decorate, unfold, refold } from './warm.js';

/** Words around the postmark's ring, by tone. Visible, so Kathakar may edit them. */
export const RING = { info: 'POSTED', success: 'DELIVERED', warning: 'PLEASE NOTE', error: 'RETURNED' };

let uid = 0;

/**
 * The postmark as SVG markup, in a 60×60 box centred on (30, 30): two rings,
 * the ring words on a circle, the date across the middle, and wavy
 * cancellation lines running off to the left over the stamp. Pure.
 */
export function postmarkSvg({ ring = 'POSTED', date = '', id = 'pm' } = {}) {
  const waves = [0, 1, 2].map(i => {
    const y = 22 + i * 8;
    let d = `M-26 ${y} q3 -2.4 6 0`;
    for (let x = -20; x < 8; x += 6) d += ' t6 0';
    return `<path d="${d}" />`;
  }).join('');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<svg class="sg-toast-postmark" viewBox="0 0 60 60" aria-hidden="true" focusable="false">
  <defs>
    <path id="${id}-arc" d="M30 30 m-19.5 0 a19.5 19.5 0 1 1 39 0 a19.5 19.5 0 1 1 -39 0" />
    <filter id="${id}-ink" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${(id.length * 7) % 97}" />
      <feDisplacementMap in="SourceGraphic" scale="1.4" />
    </filter>
  </defs>
  <g filter="url(#${id}-ink)" fill="none" stroke="currentColor">
    <g stroke-width="1.1" opacity="0.7">${waves}</g>
    <circle cx="30" cy="30" r="24" stroke-width="1.6" />
    <circle cx="30" cy="30" r="15" stroke-width="1" />
    <text><textPath href="#${id}-arc" startOffset="2%" textLength="118">${esc(ring)}</textPath></text>
    <text class="date" x="30" y="32.2" text-anchor="middle" stroke="none">${esc(date)}</text>
  </g>
</svg>`;
}

export function mount(el, ctx) {
  const parts = decorate(el);
  const id = `pm${++uid}`;
  const holder = document.createElement('div');
  holder.innerHTML = postmarkSvg({ ring: RING[el.tone] ?? RING.info, date: el.state().postmark, id });
  const mark = /** @type {SVGSVGElement} */ (holder.firstElementChild);
  // centred on the stamp's top-right corner, clear of the message
  const place = () => {
    const icon = el.querySelector(':scope > .sg-toast-icon');
    if (!icon) return;
    const size = mark.getBoundingClientRect().width || 44;
    mark.style.left = `${icon.offsetLeft + icon.offsetWidth - size / 2}px`;
    mark.style.top = `${Math.max(2, icon.offsetTop - size * 0.28)}px`;
    mark.style.transform = 'rotate(-14deg)';
  };
  parts.deco.append(mark);
  let entered = false;
  return {
    update(s) {
      place();
      if (entered) return;
      entered = true;
      if (s.phase !== 'enter') { parts.flap.hidden = true; return; }
      const still = ctx.motion === 'still';
      unfold(el, parts, { still, speed: 0.9 }).then(() => el.entered());
      if (still) return;
      // the press: in large and light, down past its size, then settles
      mark.animate(
        [
          { opacity: 0, transform: 'rotate(-4deg) scale(1.7)' },
          { opacity: 1, transform: 'rotate(-15deg) scale(0.9)', offset: 0.62 },
          { opacity: 1, transform: 'rotate(-14deg) scale(1)' },
        ],
        { duration: 420, delay: 360, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'backwards' },
      );
    },
    leave: () => refold(el, ctx.motion === 'still'),
    restyle: place,
    destroy() { parts.deco.replaceChildren(); },
  };
}
