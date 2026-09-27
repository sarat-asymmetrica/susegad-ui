// Warm: a warm ink line drawn under the scrubber, exactly as far as the
// playhead, over a faint pencil guide for the rest of the run. Redrawn only
// when the fraction actually changes, so it never animates on its own.

import { ink } from '../../engine/index.js';

export function mount(host) {
  const track = host.querySelector('.sg-player__seek');
  if (!track) return { update() {}, destroy() {} };
  const canvas = document.createElement('canvas');
  canvas.className = 'sg-player__scrub-art';
  canvas.setAttribute('aria-hidden', 'true');
  const bar = track.closest('.sg-player__bar') ?? track.parentElement;
  bar.append(canvas);
  const g = canvas.getContext('2d');
  const H = 14;
  // The range stays a normal flex item (so the bar's layout is the plain
  // flex algorithm, nothing more); this canvas is positioned over its own
  // box, computed from its rect each time it moves or resizes. The first
  // rect read can be zero- or wrong-sized before the bar has laid out;
  // ResizeObserver corrects it, and must also redraw — the earlier version
  // resized without redrawing, so the line silently never appeared. Keep
  // the last fraction drawn so a resize alone can still repaint it.
  let last = 0, ro;

  function draw(fraction) {
    const w = canvas.width / (Math.min(2, window.devicePixelRatio || 1)), h = H, y = h / 2;
    g.clearRect(0, 0, w, h);
    ink(g, [[2, y], [w - 2, y]], { width: 1.2, color: '#93897a', alpha: 0.5, seed: 1, jitter: 0.3, taper: 0 });
    if (fraction > 0.002) ink(g, [[2, y], [2 + (w - 4) * fraction, y]], { width: 2.4, color: '#1d2742', alpha: 0.92, seed: 2, jitter: 0.5, taper: 4 });
  }

  function size() {
    const r = track.getBoundingClientRect(), b = bar.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    canvas.style.width = `${r.width}px`;
    canvas.style.left = `${r.left - b.left}px`;
    canvas.style.top = `${r.top - b.top + r.height / 2 - H / 2}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(last);
  }
  ro = new ResizeObserver(size);
  ro.observe(track);
  ro.observe(bar);
  size();

  return {
    update(s) {
      const changed = Math.abs(s.fraction - last) >= 0.0015;
      last = s.fraction;
      if (changed) draw(s.fraction);
    },
    destroy() { ro.disconnect(); canvas.remove(); },
  };
}
