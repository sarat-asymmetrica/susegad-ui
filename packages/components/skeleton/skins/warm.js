// Warm: the placeholder drawn in pencil, with light shading where a picture
// will go. Nothing moves while waiting. When the content really arrives, the
// outlines ink in and the drawing gives way to it.

import { deco, pencil, inkIn, finish } from './draw.js';

export function mount(el, ctx) {
  const d = deco(el, 'svg');
  let last = null, drawn = null;
  const fills = () => 'color-mix(in oklab, var(--sg-surface-sunk) 70%, transparent)';
  const draw = s => { drawn = pencil(d.node, s, d.width, { fills }); };
  d.onresize(() => last?.busy && draw(last));
  return {
    update(s) {
      const was = last;
      last = s;
      if (s.busy) {
        if (!was?.busy || was.shape !== s.shape || was.lines !== s.lines || was.seed !== s.seed || d.node.hasAttribute('hidden')) { finish(el, d); d.node.removeAttribute('hidden'); draw(s); }
        return;
      }
      if (d.node.hasAttribute('hidden') || d.node.classList.contains('sg-leaving')) return;
      if (was?.busy && ctx.motion !== 'still' && drawn) inkIn(el, d, drawn);
      else finish(el, d);
    },
    // drawn with CSS custom properties (and the scene repaints itself), so a theme change needs nothing
    restyle() {},
    destroy() { d.destroy(); },
  };
}
