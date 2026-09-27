// Playful: the same ink line as warm, with a kolam bead riding the
// playhead: a small ringed dot, the way a bead sits on a kolam's line.

import { ink } from '../../engine/index.js';

const TAU = Math.PI * 2;

function bead(g, x, y, r) {
  g.save();
  g.fillStyle = '#c2410c';
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = '#fff4e6'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(x, y, r * 0.5, 0, TAU); g.stroke();
  g.restore();
}

export function mount(host) {
  const track = host.querySelector('.sg-player__seek');
  if (!track) return { update() {}, destroy() {} };
  const canvas = document.createElement('canvas');
  canvas.className = 'sg-player__scrub-art';
  canvas.setAttribute('aria-hidden', 'true');
  const bar = track.closest('.sg-player__bar') ?? track.parentElement;
  bar.append(canvas);
  const g = canvas.getContext('2d');
  const H = 16;
  // See skins/warm.js: the range stays a normal flex item; this canvas
  // overlays its own box, computed from its rect (not the whole bar), and
  // redraws on any resize, not only when the fraction changes — a resize
  // alone clears the canvas and would otherwise leave it blank.
  let last = 0, ro;

  function draw(fraction) {
    const w = canvas.width / (Math.min(2, window.devicePixelRatio || 1)), h = H, y = h / 2;
    g.clearRect(0, 0, w, h);
    ink(g, [[3, y], [w - 3, y]], { width: 1.4, color: '#93897a', alpha: 0.5, seed: 4, jitter: 0.4, taper: 0 });
    const x = 3 + (w - 6) * fraction;
    if (fraction > 0.002) ink(g, [[3, y], [x, y]], { width: 2.6, color: '#c2410c', alpha: 0.95, seed: 5, jitter: 0.6, taper: 4 });
    bead(g, x, y, 5.5);
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
