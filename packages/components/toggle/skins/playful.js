// Playful: a clay diya. Off, the wick is dark; on, a flame stands on it with
// a glow behind. While it is lit and on screen the flame flickers, from seeded
// noise so two lamps never flicker in step; in quiet, under reduced motion and
// off screen it holds still.

import { LAMP, flameAnimation } from '../toggle.core.js';
import { art, svgEl } from './warm.js';

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const svg = art(host, '0 0 32 32');
  const light = svgEl(doc, 'g', { class: 'sg-toggle-light' });
  const fire = svgEl(doc, 'g', { class: 'sg-toggle-fire' });
  fire.append(svgEl(doc, 'path', { class: 'sg-toggle-flame', d: LAMP.flame }), svgEl(doc, 'path', { class: 'sg-toggle-flame-core', d: LAMP.flameCore }));
  light.append(svgEl(doc, 'circle', { class: 'sg-toggle-glow', cx: LAMP.glow.cx, cy: LAMP.glow.cy, r: LAMP.glow.r }), fire);
  const w = LAMP.wick;
  svg.append(
    light,
    svgEl(doc, 'path', { class: 'sg-toggle-bowl', d: LAMP.bowl }),
    svgEl(doc, 'path', { class: 'sg-toggle-rim', d: LAMP.rim }),
    svgEl(doc, 'line', { class: 'sg-toggle-wick', x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }),
  );
  let anim = null, key = '';

  return {
    update(s) {
      svg.toggleAttribute('data-on', s.on);
      const want = flameAnimation(ctx.motion, s.on, s.seed);
      const k = want ? `${s.seed}|${ctx.motion}` : '';
      if (k !== key) { anim?.cancel(); anim = want ? fire.animate(want.frames, want.timing) : null; key = k; }
      if (anim) s.visible ? anim.play() : anim.pause();
    },
    destroy() { anim?.cancel(); svg.remove(); },
  };
}
