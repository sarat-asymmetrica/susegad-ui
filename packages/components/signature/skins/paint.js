// The pad's painter, shared by the three skins. It paints only when something
// changed or ink is still drying, and stops when the pad is off screen.
//
// Dry strokes are baked once into a cached layer; fresh ones are painted each
// frame while they dry: glossy and dark at first, then settling into the
// paper's grain. The typed name is set in the hand face on the signing line.
//
// look: { grain: 0..1, dry: bool, line: 'plain' | 'pencil', flourish: bool }

import { grainPattern } from '../../../engine/src/paper.js';
import { pencil } from '../../../engine/src/ink.js';
import { PAD, ribbon } from '../signature.core.js';
import { dryness, flourish, inkBounds, fitSize } from './marks.js';

/** Any CSS colour to #rrggbb, through a 1 × 1 canvas (the engine's grain wants hex). */
function hex(css, doc) {
  const g = Object.assign(doc.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  g.fillStyle = css; g.fillRect(0, 0, 1, 1);
  const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
  return `#${((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1)}`;
}

const trace = (g, poly) => { g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };

export function painter(host, ctx, look) {
  const doc = host.ownerDocument, box = host.pad.el;
  let s = null, raf = 0, alive = true, baked = [], sizeKey = '', col = null;
  let dry = null, scratch = null, flo = null, floTimer = 0, loaded = false;

  const layer = () => { const c = doc.createElement('canvas'); c.width = host.pad.canvas.width; c.height = host.pad.canvas.height; return c; };

  function colours() {
    const cs = getComputedStyle(box);
    col = { ink: cs.color, rule: hex(cs.caretColor, doc), hand: getComputedStyle(host).getPropertyValue('--sg-font-hand').trim() || 'cursive' };
  }

  /** One shape of ink into g: textured by `grain`, glossy by `wet`. */
  function ink(g, polys, { grain = 0, wet = 0, text = null } = {}) {
    const st = host.pad, sg = scratch.getContext('2d');
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, scratch.width, scratch.height);
    sg.setTransform(st.px, 0, 0, st.px, 0, 0);
    sg.fillStyle = col.ink;
    if (text) { sg.font = text.font; sg.fillText(text.value, text.x, text.y); }
    for (const p of polys) { trace(sg, p); sg.fill(); }
    if (grain > 0) {
      sg.globalCompositeOperation = 'destination-out';
      sg.globalAlpha = grain;
      sg.fillStyle = grainPattern(sg, '#000000', { lo: 0, hi: 0.55 });
      sg.fillRect(0, 0, PAD.W, PAD.H);
    }
    if (wet > 0) {
      // fresh ink catches the light: a pale line along each stroke, only on the ink
      sg.globalCompositeOperation = 'source-atop';
      sg.globalAlpha = wet * 0.4;
      sg.strokeStyle = '#fff'; sg.lineWidth = 0.9; sg.lineCap = 'round';
      for (const p of polys) {
        const n = p.length >> 1;
        sg.beginPath();
        for (let i = 0; i < n; i += 2) (i ? sg.lineTo(p[i][0] - 0.4, p[i][1] - 0.6) : sg.moveTo(p[i][0] - 0.4, p[i][1] - 0.6));
        sg.stroke();
      }
    }
    sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1;
    g.drawImage(scratch, 0, 0, PAD.W, PAD.H);
  }

  const lineLayer = () => host.pad.cached(`line:${look.line}:${col.rule}`, g => {
    if (look.line === 'pencil') {
      pencil(g, [[28, PAD.line], [200, PAD.line + 0.8], [400, PAD.line - 0.6], [572, PAD.line + 0.4]], { width: 1.1, color: col.rule, seed: 3, alpha: 0.9 });
      pencil(g, [[34, PAD.line - 22], [46, PAD.line - 10]], { width: 1.3, color: col.rule, seed: 5 });
      pencil(g, [[46, PAD.line - 22], [34, PAD.line - 10]], { width: 1.3, color: col.rule, seed: 6 });
    } else {
      g.strokeStyle = col.rule; g.lineWidth = 1;
      g.beginPath(); g.moveTo(28, PAD.line + 0.5); g.lineTo(572, PAD.line + 0.5); g.stroke();
    }
  });

  function typed(name) {
    const g = scratch.getContext('2d');
    const size = fitSize(sz => { g.font = `300 ${sz}px ${col.hand}`; return g.measureText(name).width; });
    const font = `300 ${size}px ${col.hand}`;
    if (!loaded && doc.fonts) { loaded = true; doc.fonts.load(font, name).then(() => { host.pad.memo.clear(); schedule(); }, () => {}); }
    g.font = font;
    return { value: name, font, x: 62, y: PAD.line - 7, w: g.measureText(name).width, size };
  }

  function paint() {
    raf = 0;
    if (!alive || !s) return;
    const st = host.pad, key = `${st.canvas.width}x${st.canvas.height}`;
    if (key !== sizeKey || !col) { sizeKey = key; colours(); dry = layer(); scratch = layer(); baked = []; }
    const dg = dry.getContext('2d'), now = performance.now();
    dg.setTransform(st.px, 0, 0, st.px, 0, 0); // the layer draws in logical units, like the pad
    // undo, clear or new strokes set from outside: bake again from the start
    if (baked.some((b, i) => b !== s.strokes[i])) { dg.clearRect(0, 0, PAD.W, PAD.H); baked = []; }
    while (baked.length < s.strokes.length && dryness(now - s.strokes[baked.length].done, ctx.motion) >= 1) {
      const k = s.strokes[baked.length];
      ink(dg, [k.poly], { grain: look.grain });
      baked.push(k);
    }

    const g = st.begin();
    g.clearRect(0, 0, PAD.W, PAD.H);
    st.blit(lineLayer());
    let busy = false, text = null;
    if (!s.strokes.length && !s.live && s.name) { text = typed(s.name); ink(g, [], { grain: look.grain, text }); }
    st.blit(dry);
    for (let i = baked.length; i < s.strokes.length; i++) {
      const d = dryness(now - s.strokes[i].done, ctx.motion);
      ink(g, [s.strokes[i].poly], { grain: look.grain * d, wet: look.dry ? 1 - d : 0 });
      busy = true;
    }
    if (s.live) ink(g, [s.live.poly], { wet: look.dry ? 1 : 0 });
    if (flo) {
      const k = ctx.motion === 'still' ? 1 : Math.min(1, (now - flo.t0) / 650);
      const pts = flo.pts.slice(0, Math.max(2, Math.round(flo.pts.length * k)));
      g.globalAlpha = 0.85;
      ink(g, [ribbon(pts, { base: 2.6, nib: 0.62 })], { grain: look.grain });
      g.globalAlpha = 1;
      if (k < 1) busy = true;
    }
    if (busy && ctx.visible) schedule();
  }
  function schedule() { if (!raf && alive) raf = requestAnimationFrame(paint); }

  /** Playful: once the pen has rested a moment, underline the signature with a swash. */
  function arm() {
    clearTimeout(floTimer); flo = null;
    if (!look.flourish || !s || s.live) return;
    let b = inkBounds(s.strokes.map(x => x.poly));
    if (!b && s.name && col) { const t = typed(s.name); b = { x: t.x, y: t.y - t.size * 0.7, w: t.w, h: t.size * 0.75 }; }
    if (!b) return;
    floTimer = setTimeout(() => { flo = { pts: flourish(b, `${s.seed}:${s.strokes.length}:${s.name}`), t0: performance.now() }; schedule(); }, s.strokes.length ? 700 : 900);
  }

  return {
    update(next) {
      const changed = !s || next.version !== s.version || next.name !== s.name;
      s = next;
      if (changed || next.live) arm();
      schedule();
    },
    restyle() { col = null; sizeKey = ''; schedule(); },
    destroy() {
      alive = false; cancelAnimationFrame(raf); clearTimeout(floTimer);
      const g = host.pad?.begin();
      g?.clearRect(0, 0, PAD.W, PAD.H);
    },
  };
}
