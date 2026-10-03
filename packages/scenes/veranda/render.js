// Veranda: the renderer. Owns every side effect.
//
// quiet    a hairline drawing of the same geometry: paper and ink, no wash, nothing moving
// warm     ink and wash. One living thing: the brass lamp swings on its chain, and a little
//          dust drifts in the light. At dusk (dark theme) the lamp is lit.
// playful  your hand moves the sun across the garden, and the pillars' shadows sweep the floor
//
// The painting (the G-buffer, the wash, the ink) is built a slice at a time over the first
// frames, so no single task is long. A frame is then one blit of the composed still, the lamp
// and the dust; the still is composed again only when the sun moves or the theme changes.

import { stage, clamp, TAU } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H } from './world.js';
import { SUN_REST, sunAt } from './model.js';
import { gStep, createPainter, drawLamp } from './paint.js';

export function createRenderer(host, { register, invalidate }) {
  const st = stage(host, { W, H });
  let reg = register, colors = null, painter = null, job = null, still = null, stillKey = '', lastKey = '', building = '';
  let sunNow = SUN_REST, sunAt0 = 0, hand = false, handX = 0.5, travel = 0, quality = 1;
  let readyResolve = null;
  const ready = new Promise(r => { readyResolve = r; });
  st.onresize = () => { painter?.dispose(); painter = null; job = null; still = null; stillKey = ''; lastKey = ''; invalidate(); };

  const palette = () => (colors ??= readColors(host, {
    paper: 'var(--sg-paper, light-dark(#f1ede4, #151a2b))',
    ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
    dark: 'light-dark(#000000, #ffffff)',
  }));
  const isDark = () => palette().dark !== '#000000';

  /** Start (or restart) the painter for this mode, mood and size, as a job that runs a slice each frame. */
  function start(mode, mood, gb, Ls) {
    painter?.dispose();
    painter = createPainter({ mode, mood, px: st.px, paper: palette().paper, paperInk: mode === 'hair' ? palette().ink : null });
    job = painter.build(gb, Ls);
    building = `${mode}|${mood}|${st.canvas.width}`;
    still = null; stillKey = '';
  }
  function step(budget = 8) {
    const t0 = performance.now();
    let done = false;
    while (!done && performance.now() - t0 < budget) { done = job.next().done; painter.flush(); }
    if (done) { job = null; readyResolve?.(); readyResolve = null; }
    return done;
  }

  /** The composed still for this sun, on its own canvas so a frame is one blit. */
  function composed(Ls, key, q) {
    if (still && stillKey === key) return still;
    still ??= Object.assign(document.createElement('canvas'), { width: st.canvas.width, height: st.canvas.height });
    const g = still.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, still.width, still.height);
    painter.compose(g, Ls, q);
    stillKey = key;
    return still;
  }

  return {
    ready,
    render(d, frame) {
      const mode = reg === 'quiet' ? 'hair' : 'ink', isStill = frame.still || reg === 'quiet', t = d.time;
      const mood = d.mood === 'auto' || !d.mood ? (isDark() ? 'dusk' : 'day') : d.mood;
      quality = frame.quality ?? 1;
      const moving = () => Math.abs(sunNow - (hand ? handX : d.sun)) > 0.002; // while the sun is on the move its shadows are traced coarser, then once more when it stops
      const gb = gStep(8);
      const want = `${mode}|${mood}|${st.canvas.width}`;
      if (!gb) { if (!lastKey) { const g = st.begin(); g.fillStyle = palette().paper; g.fillRect(0, 0, W, H); } invalidate(); return; }
      if (want !== building || (!painter && !job)) start(mode, mood, gb, sunAt(reg === 'playful' && hand ? handX : d.sun));
      if (job && !step()) {
        if (!lastKey) { const g = st.begin(); g.fillStyle = palette().paper; g.fillRect(0, 0, W, H); }
        invalidate(); lastKey = ''; return;
      }
      // the hand moves the sun in playful, and eases; otherwise the sun is where the params put it
      const p = frame.pointer;
      // the hand takes the sun only once it moves, and lets go when Enter puts the sun back
      if (d.look.hand && !isStill && p.inside && p.travel !== travel) { travel = p.travel; hand = true; }
      if (hand && p.inside) handX = clamp(p.x / W);
      if (hand && !d.look.hand) hand = false;
      const target = hand ? handX : d.sun;
      const now = performance.now(), dt = Math.min(0.1, (now - sunAt0) / 1000 || 0.016); sunAt0 = now;
      sunNow = isStill || reg !== 'playful' ? target : sunNow + (target - sunNow) * Math.min(1, dt * 5);
      if (Math.abs(sunNow - target) < 0.002) sunNow = target;
      const sunKey = sunNow.toFixed(3);
      const swing = isStill ? 0 : d.swing, tick = isStill ? 0 : Math.round(t * 30);
      const calmKey = frame.calm.length;
      const q = moving() ? Math.min(quality, 0.4) : quality;
      const key = `${want}|${sunKey}|${swing.toFixed(4)}|${d.motes.length ? tick : 0}|${calmKey}|${q > 0.5}`;
      if (key === lastKey) return;
      lastKey = key;
      const g = st.begin();
      g.drawImage(composed(sunAt(sunNow), `${want}|${sunKey}|${q > 0.5}`, q), 0, 0, W, H);
      drawLamp(g, swing, { mood, ink: mode === 'hair' ? palette().ink : mood === 'dusk' ? '#0e0b14' : '#2a1c12', hair: mode === 'hair' });
      if (!isStill && mood === 'day' && mode !== 'hair') {
        g.save(); g.fillStyle = '#fff6df';
        for (const m of d.motes) {
          if (frame.calm.some(r => m.x > r.x - 8 && m.x < r.x + r.w + 8 && m.y > r.y - 8 && m.y < r.y + r.h + 8)) continue;
          g.globalAlpha = m.a * 0.8; g.beginPath(); g.arc(m.x, m.y, m.size, 0, TAU); g.fill();
        }
        g.restore();
      }
      if (p.keyboard && p.inside && reg === 'playful') {
        g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,24,40,0.55)'; g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.stroke();
        g.lineWidth = 1.6; g.strokeStyle = '#fbf8ef'; g.stroke(); g.restore();
      }
    },
    setRegister(r) { reg = r; lastKey = ''; invalidate(); },
    restyle() { colors = null; painter?.dispose(); painter = null; job = null; still = null; stillKey = ''; building = ''; lastKey = ''; invalidate(); },
    /** Enter, Space or a click in playful: the sun goes back where it was. */
    activate(p) { if (hand || reg === 'playful') { hand = false; travel = p?.travel ?? travel; sunNow = SUN_REST; lastKey = ''; invalidate(); } },
    destroy() { painter?.dispose(); painter = null; job = null; still = null; st.destroy(); },
  };
}
