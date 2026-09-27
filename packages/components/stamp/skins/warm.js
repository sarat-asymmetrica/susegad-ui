// Warm: the carved block. A double frame, a slight tilt, an off-register
// ghost and seeded ink starvation, laid over the real text as a mask. The
// stamp lands with a short press when it is stamped, never by itself.
// Also exports `inked`, which the playful skin builds on.

import { stampPose, inkMask, landing } from '../stamp.core.js';

const deco = (host, cls) => {
  const el = host.ownerDocument.createElement('span');
  el.className = cls;
  el.setAttribute('aria-hidden', 'true');
  host.prepend(el);
  return el;
};

/**
 * @param {HTMLElement} host
 * @param {{ motion: string }} ctx
 * @param {{ register: 'warm'|'playful', amount: number, spread?: boolean, motif?: boolean }} opts
 */
export function inked(host, ctx, { register, amount, spread = false, motif = false }) {
  const frame = deco(host, 'sg-stamp-frame');
  if (motif) for (let i = 0; i < 2; i++) { const m = host.ownerDocument.createElement('span'); m.className = 'sg-stamp-motif'; frame.append(m); }
  const halo = spread ? deco(host, 'sg-stamp-spread') : null;
  let seed = null, url = null, key = '', seen = 0, anims = [], raf = 0, alive = true;

  const set = (k, v) => host.style.setProperty(k, v);

  function paint() {
    raf = 0;
    const box = host.native ?? host.querySelector('[role="status"]');
    if (!alive || !box) return;
    const w = host.offsetWidth, h = host.offsetHeight;
    const word = box.querySelector('strong');
    if (word) {
      set('--sg-stamp-word-x', `${-word.offsetLeft}px`);
      set('--sg-stamp-word-y', `${-word.offsetTop}px`);
    }
    const next = `${seed}|${w}|${h}`;
    if (!w || !h || next === key) return;
    key = next;
    const scale = Math.min(2, host.ownerDocument.defaultView.devicePixelRatio || 1);
    const mw = Math.round(w * scale), mh = Math.round(h * scale);
    const alpha = inkMask(seed, mw, mh, { scale, amount });
    const cv = host.ownerDocument.createElement('canvas');
    cv.width = mw; cv.height = mh;
    const g = cv.getContext('2d');
    const img = g.createImageData(mw, mh);
    for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i];
    g.putImageData(img, 0, 0);
    cv.toBlob(blob => {
      if (!alive || !blob || key !== next) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      set('--sg-stamp-mask', `url("${url}")`);
      set('--sg-stamp-mask-w', `${w}px`);
      set('--sg-stamp-mask-h', `${h}px`);
    });
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
  const ro = new ResizeObserver(schedule);
  ro.observe(host);

  function land(rotate) {
    anims.forEach(a => a.cancel());
    anims = [];
    const l = landing(ctx.motion, rotate);
    if (!l) return;
    anims.push(host.animate(l.frames, l.timing));
    if (halo && l.spread) anims.push(halo.animate(l.spread.frames, { ...l.spread.timing, fill: 'none' }));
    for (const a of anims) a.finished.then(x => x.cancel(), () => {});
  }

  return {
    update(s) {
      if (s.seed !== seed) {
        seed = s.seed;
        const pose = stampPose(seed, register);
        set('--sg-stamp-rotate', `${pose.rotate}deg`);
        set('--sg-stamp-ghost-x', `${pose.ghost.x}px`);
        set('--sg-stamp-ghost-y', `${pose.ghost.y}px`);
        key = '';
      }
      schedule();
      if (s.landings !== seen) {
        seen = s.landings;
        if (!s.pending) land(stampPose(seed, register).rotate);
      }
    },
    restyle: schedule,
    destroy() {
      alive = false;
      ro.disconnect();
      cancelAnimationFrame(raf);
      anims.forEach(a => a.cancel());
      frame.remove(); halo?.remove();
      if (url) URL.revokeObjectURL(url);
      for (const k of ['--sg-stamp-rotate', '--sg-stamp-ghost-x', '--sg-stamp-ghost-y', '--sg-stamp-mask', '--sg-stamp-mask-w', '--sg-stamp-mask-h', '--sg-stamp-word-x', '--sg-stamp-word-y']) host.style.removeProperty(k);
    },
  };
}

export const mount = (host, ctx) => inked(host, ctx, { register: 'warm', amount: 1 });
