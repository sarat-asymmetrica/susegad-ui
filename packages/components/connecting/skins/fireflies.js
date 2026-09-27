// The firefly picture shared by the warm and playful skins: a small slice of
// night in a pill, with fireflies from connecting.core.js. Painted on a canvas;
// the night and its grass are painted once and cached, the glows each frame.

import { createSwarm, advance, lights, still, order } from '../connecting.core.js';

const TAU = Math.PI * 2;

/** One soft glow, drawn once per size and pixel ratio, stamped for every firefly. */
function glowSprite(r, dpr, core) {
  const c = document.createElement('canvas'), s = Math.ceil(r * 2 * dpr);
  c.width = c.height = s;
  const g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, core);
  gr.addColorStop(0.16, 'rgba(236,252,160,0.95)');
  gr.addColorStop(0.4, 'rgba(190,232,92,0.45)');
  gr.addColorStop(0.72, 'rgba(140,200,70,0.1)');
  gr.addColorStop(1, 'rgba(120,180,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return c;
}

function pill(g, W, H) {
  const r = H / 2;
  g.beginPath();
  g.moveTo(r, 0); g.lineTo(W - r, 0); g.arc(W - r, r, r, -TAU / 4, TAU / 4);
  g.lineTo(r, H); g.arc(r, r, r, TAU / 4, (3 * TAU) / 4);
  g.closePath();
}

/**
 * @param {{ n: number, W: number, H: number, glowR: number, bright: number, blades: number, seed?: number }} o
 */
export function fireflySkin(o) {
  return function mount(host, ctx) {
    const { W, H } = o;
    const c = document.createElement('canvas');
    c.className = 'sg-connecting__art';
    c.setAttribute('aria-hidden', 'true');
    c.style.width = `${W}px`; c.style.height = `${H}px`;
    host.insertBefore(c, ctx.native);
    const g = c.getContext('2d');
    // a seed attribute gives each instance its own swarm; without one they match
    const sw = createSwarm(host.getAttribute('seed') ?? o.seed, o.n, { W, H, pad: H * 0.24 });
    let dpr = 0, sprite = null, night = null, state = 'connecting', raf = 0, prev = 0;

    function fit() {
      const d = Math.min(2, window.devicePixelRatio || 1);
      if (d === dpr) return;
      dpr = d; c.width = Math.round(W * d); c.height = Math.round(H * d);
      sprite = night = null;
    }

    // The night, a line of grass and a hairline edge, painted once per theme and pixel ratio.
    function paintNight() {
      const n = document.createElement('canvas');
      n.width = c.width; n.height = c.height;
      const ng = n.getContext('2d'), cs = getComputedStyle(host);
      ng.setTransform(dpr, 0, 0, dpr, 0, 0);
      const deep = cs.getPropertyValue('--sg-night').trim() || '#14161c';
      const sky = ng.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1f2745'); sky.addColorStop(1, deep);
      pill(ng, W, H); ng.fillStyle = sky; ng.fill();
      ng.save(); pill(ng, W, H); ng.clip();
      // grass: thin curved blades along the bottom, seeded so it never changes
      let s = 7;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      ng.strokeStyle = 'rgba(128,168,112,0.42)'; ng.lineWidth = 0.9; ng.lineCap = 'round';
      for (let i = 0; i < o.blades; i++) {
        const x = (i + 0.5 + (rnd() - 0.5) * 0.8) * (W / o.blades), h = H * (0.2 + rnd() * 0.22), lean = (rnd() - 0.5) * 5;
        ng.beginPath(); ng.moveTo(x, H + 1); ng.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h); ng.stroke();
      }
      ng.restore();
      // a hairline so the pill keeps its edge on a night page
      pill(ng, W, H); ng.strokeStyle = 'rgba(232,226,214,0.22)'; ng.lineWidth = 1; ng.stroke();
      return n;
    }

    function draw(ls, bloom) {
      fit();
      night ??= paintNight();
      sprite ??= glowSprite(o.glowR, dpr, 'rgba(255,255,230,1)');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(night, 0, 0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.save(); pill(g, W, H); g.clip();
      g.globalCompositeOperation = 'lighter';
      // in step, the whole pill brightens a little with each shared flash
      if (bloom > 0.02) { g.fillStyle = `rgba(190,232,92,${(0.13 * bloom).toFixed(3)})`; g.fillRect(0, 0, W, H); }
      for (const l of ls) {
        g.globalAlpha = Math.min(1, l.glow * o.bright);
        g.drawImage(sprite, l.x - o.glowR, l.y - o.glowR, o.glowR * 2, o.glowR * 2);
      }
      g.restore();
    }

    const bloomOf = ls => (state === 'connected' ? order(sw.phase) ** 4 * (ls.reduce((a, l) => a + l.glow, 0) / ls.length) : 0);

    function frame(now) {
      raf = 0;
      advance(sw, prev ? (now - prev) / 1000 : 0, state);
      prev = now;
      const ls = lights(sw, state);
      draw(ls, bloomOf(ls));
      schedule();
    }
    function schedule() {
      if (!raf && ctx.visible && ctx.motion !== 'still') raf = requestAnimationFrame(frame);
    }
    function stop() { cancelAnimationFrame(raf); raf = 0; prev = 0; }

    return {
      update(s) {
        state = s.state;
        if (ctx.motion === 'still') {
          // reduced motion: the finished picture for this state, drawn once
          stop();
          draw(still(sw, state), state === 'connected' ? 0.8 : 0);
        } else if (!ctx.visible) stop();
        else { if (!prev) draw(lights(sw, state), 0); schedule(); }
      },
      restyle() { night = null; draw(ctx.motion === 'still' ? still(sw, state) : lights(sw, state), 0); },
      destroy() { stop(); c.remove(); },
    };
  };
}
