// Maun: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): the luminous ground, the roller band with ragged ends, the
// drag marks along the roller, the feathered ends and the scrape that takes
// paint back off are the plate's own code. The port adds the registers, a
// still that is always the finished painting (laid down in slices so no frame
// stalls), a scrape under the hand in playful, the breath kept away from the
// page's words, the token paper for the margin, and a redraw only when
// something changed.

import { stage, rng, makeNoise, clamp, paper, roughen, hexToRgb } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, scrapeAt } from './model.js';

// ── Painting (the plate's own) ────────────────────────────────────────────

function ground(g, pal, seed) {
  g.fillStyle = pal.glow; g.fillRect(0, 0, W, H);
  const nz = makeNoise(seed), mw = 48, mh = 32, c = document.createElement('canvas');
  c.width = mw; c.height = mh;
  const cg = c.getContext('2d'), img = cg.createImageData(mw, mh), [R, G, B] = hexToRgb(pal.mid);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const v = 0.5 + 0.5 * nz.fbm(x * 0.07, y * 0.1, 0.4, 4), i = (y * mw + x) * 4;
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = Math.round(v * 150);
  }
  cg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, W, H);
  // the light is strongest a little above the middle
  const lg = g.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.45, W * 0.7);
  lg.addColorStop(0, 'rgba(255,252,236,0.55)'); lg.addColorStop(1, 'rgba(255,252,236,0)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
}

function band(p) {
  // a roller band with ragged, slightly uneven ends
  const pts = [[p.x, p.y - p.h / 2], [p.x + p.w, p.y - p.h / 2 + p.h * 0.03], [p.x + p.w, p.y + p.h / 2], [p.x, p.y + p.h / 2 - p.h * 0.02]];
  const c = Math.cos(p.angle), s = Math.sin(p.angle), cx = p.x + p.w / 2, cy = p.y;
  const rot = pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
  return roughen(rot, { amp: 5, freq: 0.03, seed: p.seed, step: 6, closed: true });
}

/** Apply one pass to the paint layer: paint it alone on a scratch canvas,
 *  feather its ends like a roller running dry, then lay it on (or take it off).
 *  `detail` (the governor's level) thins the drag marks on a slow machine. */
function apply(g, p, scratchOf, detail = 1) {
  const cw = g.canvas.width, ch = g.canvas.height, scratch = scratchOf(cw, ch);
  const sg = scratch.getContext('2d');
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, cw, ch);
  sg.setTransform(cw / W, 0, 0, ch / H, 0, 0);

  const shape = band(p), path = new Path2D();
  shape.forEach((q, i) => (i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
  path.closePath();
  const r = rng(p.seed), nz = makeNoise(Math.floor(p.seed));
  const [R, G, B] = hexToRgb(p.color), top = p.y - p.h / 2, bot = p.y + p.h / 2;
  sg.save();
  sg.clip(path);
  sg.translate(p.x + p.w / 2, p.y); sg.rotate(p.angle); sg.translate(-(p.x + p.w / 2), -p.y);
  // the body, thinner toward its top and bottom edges
  const gr = sg.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, `rgba(${R},${G},${B},${p.alpha * 0.25})`);
  gr.addColorStop(0.2, `rgba(${R},${G},${B},${p.alpha})`);
  gr.addColorStop(0.8, `rgba(${R},${G},${B},${p.alpha})`);
  gr.addColorStop(1, `rgba(${R},${G},${B},${p.alpha * 0.25})`);
  sg.fillStyle = gr; sg.fillRect(p.x - 20, top - 20, p.w + 40, p.h + 40);
  // a few drag marks along the roller, short and uneven
  sg.lineCap = 'round';
  for (let k = 0; k < p.h * 0.35 * p.streak; k++) {
    const y = r.range(top, bot), a = clamp(0.4 + nz(y * 0.05, p.seed) * 0.8) * p.alpha * 0.9;
    if (a < 0.01) continue;
    const len = r.range(0.15, 0.6) * p.w, x0 = p.x + r.range(0, p.w - len), lw = r.range(0.6, 2.4);
    const b1 = r.range(-1.5, 1.5), b2 = r.range(-1.5, 1.5), b3 = r.range(-1, 1);
    if (detail < 1 && (k % 4) >= Math.round(detail * 4)) continue; // fewer marks, the same random draws
    sg.strokeStyle = `rgba(${R},${G},${B},${a})`; sg.lineWidth = lw;
    sg.beginPath(); sg.moveTo(x0, y); sg.bezierCurveTo(x0 + len * 0.33, y + b1, x0 + len * 0.66, y + b2, x0 + len, y + b3); sg.stroke();
  }
  sg.restore();
  // feather both ends: the roller loads at the start and runs dry at the end
  sg.save();
  sg.globalCompositeOperation = 'destination-out';
  sg.translate(p.x + p.w / 2, p.y); sg.rotate(p.angle); sg.translate(-(p.x + p.w / 2), -p.y);
  const fL = p.w * r.range(0.12, 0.3), fR = p.w * r.range(0.2, 0.45);
  const fl = sg.createLinearGradient(p.x, 0, p.x + fL, 0);
  fl.addColorStop(0, 'rgba(0,0,0,1)'); fl.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = fl; sg.fillRect(p.x - 30, top - 30, fL + 30, p.h + 60);
  const fr = sg.createLinearGradient(p.x + p.w - fR, 0, p.x + p.w, 0);
  fr.addColorStop(0, 'rgba(0,0,0,0)'); fr.addColorStop(1, 'rgba(0,0,0,1)');
  sg.fillStyle = fr; sg.fillRect(p.x + p.w - fR, top - 30, fR + 30, p.h + 60);
  sg.restore();

  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = p.kind === 'scrape' ? 'destination-out' : 'source-over';
  g.drawImage(scratch, 0, 0);
  g.restore();
}

// ── The renderer ──────────────────────────────────────────────────────────

/** How many passes a still lays down per frame, so the finished painting never stalls a frame. */
const STILL_SLICE = 6;

export function createRenderer(host, { invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  let colors = null, scratch = null, groundC = null, paintC = null, key = '', applied = 0, lastKey = '', touches = [], epoch = -1;
  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });
  st.onresize = () => { key = ''; lastKey = ''; invalidate(); };
  const scratchOf = (w, h) => { if (!scratch || scratch.width !== w || scratch.height !== h) { scratch = document.createElement('canvas'); scratch.width = w; scratch.height = h; } return scratch; };
  const blank = () => { const c = document.createElement('canvas'); c.width = st.canvas.width; c.height = st.canvas.height; const g = c.getContext('2d'); g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0); return c; };

  function palette() {
    return (colors ??= readColors(host, { paper: 'var(--sg-paper, light-dark(#efe8da, #151a2b))', dark: 'light-dark(#000000, #ffffff)' }));
  }

  function render(data, frame) {
    const c = palette(), dark = c.dark !== '#000000', calm = frame.calm || [], plan = data.plan, n = plan.passes.length;
    // a new painting (seed, palette, size, replay) starts again from the bare ground
    const k = `${data.seed}|${plan.pal.name}|${st.canvas.width}x${st.canvas.height}`;
    if (frame.epoch !== epoch) { epoch = frame.epoch; touches = []; key = ''; }
    const want = frame.still ? n : data.done;
    if (k !== key || want < applied) {
      key = k; groundC = blank(); paintC = blank(); applied = 0; lastKey = '';
      for (const tch of touches) tch.down = false;
      ground(groundC.getContext('2d'), plan.pal, data.seed);
    }
    // one pass a frame while it makes itself; a still lays them in slices of six
    const pg = paintC.getContext('2d'), detail = frame.quality ?? 1;
    const upTo = frame.still ? Math.min(n, applied + STILL_SLICE) : Math.min(want, applied + 1);
    while (applied < upTo) apply(pg, plan.passes[applied++], scratchOf, detail);
    for (const tch of touches) if (!tch.down) { apply(pg, tch.pass, scratchOf, detail); tch.down = true; }
    const complete = applied >= n;
    if (frame.still && !complete) invalidate(); // the next slice
    // the breath moves a pixel by a level or two over seconds: four redraws a second are plenty; none in a still
    const quietNow = frame.still || data.register === 'quiet';
    const tick = quietNow ? 's' : Math.floor(data.time * 4);
    const calmKey = calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';');
    const fk = `${key}|${applied}|${touches.length}|${tick}|${calmKey}|${c.paper}|${dark}`;
    if (fk === lastKey) return;
    lastKey = fk;

    const g = st.begin();
    g.drawImage(groundC, 0, 0, W, H);
    g.drawImage(paintC, 0, 0, W, H);
    // the breath: a very slow, soft light drifting across the finished surface, never under the words
    if (!quietNow) {
      const { x: bx, y: by } = data.breath, strength = 0.1 * (complete ? 1 : 0.4);
      const br = g.createRadialGradient(bx, by, 20, bx, by, W * 0.6);
      br.addColorStop(0, `rgba(255,250,232,${strength})`); br.addColorStop(1, 'rgba(255,250,232,0)');
      g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = br; g.fillRect(0, 0, W, H); g.restore();
      if (calm.length) {
        // under the page's words (and 24 units round them) the painting is shown as it is, unbreathed
        const pad = 24, clip = new Path2D();
        for (const r of calm) clip.rect(r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad);
        g.save(); g.clip(clip); g.drawImage(groundC, 0, 0, W, H); g.drawImage(paintC, 0, 0, W, H); g.restore();
      }
    }
    // the canvas sits in paper, like the other plates: a thin margin of the page around the painting
    st.blit(st.cached(`margin|${c.paper}`, mg => {
      paper(mg, W, H, { base: c.paper, seed: 44, vignette: dark ? 0 : 0.04, speck: dark ? '#000000' : '#3a2f22' });
      mg.globalCompositeOperation = 'destination-out'; mg.fillStyle = '#000'; mg.fillRect(34, 34, W - 68, H - 68);
    }));
    host.dataset.passes = `${applied}/${n}`;
    if (resolveReady && (complete || !frame.still)) { resolveReady(); resolveReady = null; }
  }

  return {
    render,
    ready,
    setRegister() { lastKey = ''; },
    restyle() { colors = null; lastKey = ''; },
    /** Enter, Space or a tap in playful: scrape the paint back where the hand is, so the ground glows through. */
    activate(p) {
      if (!p) return;
      touches.push({ pass: scrapeAt(p.x, p.y, touches.length), down: false });
      invalidate();
    },
    destroy() { st.destroy(); },
  };
}
