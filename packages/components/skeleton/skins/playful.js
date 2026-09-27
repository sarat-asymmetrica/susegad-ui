// Playful: pencil outlines over soft colour washes, a doodled picture, and a
// wobble on twos while waiting (three drawings, swapped twelve times a second,
// like hand-drawn animation). The wobble only runs while something is loading
// and the region is on screen; the ink-in marks the real arrival.

import { deco, pencil, inkIn, finish } from './draw.js';

const WASH = ['--sg-mango', '--sg-sea', '--sg-paddy', '--sg-kokum'];
const TWOS = 1000 / 12;

export function mount(el, ctx) {
  const d = deco(el, 'svg');
  let last = null, drawn = null, wobble = [];
  const fills = (b, i) => { const w = `var(${WASH[i % WASH.length]})`; return `light-dark(color-mix(in oklab, ${w} 22%, var(--sg-surface-sunk)), color-mix(in oklab, ${w} 40%, var(--sg-surface-sunk)))`; };
  const stop = () => { wobble.forEach(a => a.cancel()); wobble = []; };
  const draw = s => {
    stop();
    const still = ctx.motion === 'still';
    drawn = pencil(d.node, s, d.width, { fills, ink: 'var(--sg-accent)', frames: still ? 1 : 3, doodle: true });
    if (still) return;
    // each drawing shows for one frame in three: step easing keeps the swap crisp
    drawn.frames.forEach((g, i) => {
      const on = i / 3, off = (i + 1) / 3, k = [];
      if (on > 0) k.push({ opacity: 0, offset: 0 });
      k.push({ opacity: 1, offset: on }, { opacity: 0, offset: off });
      if (off < 1) k.push({ opacity: 0, offset: 1 });
      wobble.push(g.animate(k, { duration: TWOS * 3, iterations: Infinity, easing: 'step-end' }));
    });
    if (!ctx.visible) wobble.forEach(a => a.pause());
  };
  d.onresize(() => last?.busy && draw(last));
  return {
    update(s) {
      const was = last;
      last = s;
      if (s.busy) {
        if (!was?.busy || was.shape !== s.shape || was.lines !== s.lines || was.seed !== s.seed || d.node.hasAttribute('hidden')) { finish(el, d); d.node.removeAttribute('hidden'); draw(s); }
        wobble.forEach(a => (s.visible ? a.play() : a.pause()));
        return;
      }
      stop();
      if (d.node.hasAttribute('hidden') || d.node.classList.contains('sg-leaving')) return;
      if (was?.busy && ctx.motion !== 'still' && drawn) inkIn(el, d, drawn, { dur: 260, stagger: 24, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', settle: 1.02 });
      else finish(el, d);
    },
    // drawn with CSS custom properties (and the scene repaints itself), so a theme change needs nothing
    restyle() {},
    destroy() { stop(); d.destroy(); },
  };
}
