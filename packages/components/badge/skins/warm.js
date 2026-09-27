// Warm: a hand-inked outline in the tone's ink, drawn twice like a nib going
// round, fitted to the badge's size. When busy, the tone's mark breathes
// slowly; it stops off screen and under reduced motion.

import { inkOutline, busyMotion } from '../badge.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-badge-ink');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'none');
  const paths = [doc.createElementNS(NS, 'path'), doc.createElementNS(NS, 'path')];
  svg.append(...paths);
  host.append(svg);

  let seed = '', key = '', anim = null, raf = 0;
  const wobble = () => parseFloat(getComputedStyle(host).getPropertyValue('--sg-wobble')) || 0.6;

  function draw() {
    raf = 0;
    // Fractional sizes: offsetWidth rounds, and a viewBox a fraction off the
    // box scales the whole outline down and in from the text's ends.
    const b = host.getBoundingClientRect();
    const w = +b.width.toFixed(2), h = +b.height.toFixed(2);
    const k = `${seed}|${w}|${h}`;
    if (!w || !h || k === key) return;
    key = k;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const { d } = inkOutline(w, h, seed, { radius: Math.min(6, h / 2.6), wobble: wobble() * 2.2 });
    paths.forEach((p, i) => p.setAttribute('d', d[i]));
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const ro = new ResizeObserver(schedule);
  ro.observe(host);

  return {
    update(s) {
      if (s.seed !== seed) { seed = s.seed; key = ''; }
      schedule();
      const m = s.busy && busyMotion(ctx.motion);
      if (m && !anim) anim = host.animate(m.frames, { ...m.timing, pseudoElement: '::before' });
      if (!m && anim) { anim.cancel(); anim = null; }
      if (anim) s.visible ? anim.play() : anim.pause();
    },
    restyle() { key = ''; schedule(); },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); anim?.cancel(); svg.remove(); },
  };
}
