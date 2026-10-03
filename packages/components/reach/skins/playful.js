// Playful: a rubber-stamped card. A double-ruled frame is inked round the
// words at a slight tilt, starved of ink here and there, with an off-register
// ghost: the stamp component's own pose and ink mask (stamp.core.js), laid
// over the frame only, so the words and links stay crisp. Drawn once per size.
import { stampPose, inkMask } from '../../stamp/stamp.core.js';

export function mount(host) {
  const doc = host.ownerDocument;
  const frame = doc.createElement('span');
  frame.className = 'sg-reach-frame';
  frame.setAttribute('aria-hidden', 'true');
  host.prepend(frame);
  let seed = null, key = '', url = null, raf = 0, alive = true;
  const set = (k, v) => frame.style.setProperty(k, v);

  function paint() {
    raf = 0;
    const w = frame.offsetWidth, h = frame.offsetHeight, k = `${seed}|${w}|${h}`;
    if (!alive || !w || !h || k === key) return;
    key = k;
    const scale = Math.min(2, doc.defaultView.devicePixelRatio || 1);
    const mw = Math.round(w * scale), mh = Math.round(h * scale);
    const alpha = inkMask(seed, mw, mh, { scale, amount: 1.1 });
    const cv = doc.createElement('canvas');
    cv.width = mw; cv.height = mh;
    const g = cv.getContext('2d'), img = g.createImageData(mw, mh);
    for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i];
    g.putImageData(img, 0, 0);
    cv.toBlob(blob => {
      if (!alive || !blob || key !== k) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      set('--sg-reach-mask', `url("${url}")`);
    });
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
  const ro = new ResizeObserver(schedule);
  ro.observe(host);

  return {
    update(s) {
      if (s.seed !== seed) {
        seed = s.seed;
        const pose = stampPose(seed, 'warm'); // the warm stamp's gentler tilt: a whole card at 3 to 7 degrees is hard to read
        set('--sg-reach-rotate', `${pose.rotate / 2}deg`);
        set('--sg-reach-ghost-x', `${pose.ghost.x}px`);
        set('--sg-reach-ghost-y', `${pose.ghost.y}px`);
        key = '';
      }
      schedule();
    },
    destroy() { alive = false; ro.disconnect(); cancelAnimationFrame(raf); frame.remove(); if (url) URL.revokeObjectURL(url); },
  };
}
