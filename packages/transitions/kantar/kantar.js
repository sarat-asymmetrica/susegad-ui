// The Kantar interlude: a curtain between two steps of a long flow. It
// drops, a line plays in the spotlight while the real work happens (however
// long that actually takes), and it rises on the next step. Always has a
// skip control; never outlasts the real work unless the author raised
// `minWaitMs` on purpose; falls back to a plain status line under reduced
// motion, in the quiet register (no theatre for an auditor), or where the
// browser has no way to run it smoothly. Makes no sound of its own —
// decision 0015: any sound is the Wave 4 vocabulary, played through the
// global switch, never on its own.
//
//   import { runKantar } from '…/transitions/kantar/kantar.js';
//
//   const result = await runKantar(mountEl, {
//     work: submitStep(),                  // a Promise: the real wait
//     lines: ['Checking your dates…'],      // placeholders; a Konkani ear reviews them (HOMAGE rule 7)
//     swap: () => showNextStep(),           // called once the work is done, curtain fully down
//     register: 'warm',
//   });
//   // result: { skipped, workDone, swapped } — `swapped` says whether `swap`
//   // ran. A skip pressed before the real work finishes moves the curtain on
//   // without calling `swap` (there is nothing finished to show yet); check
//   // `result.swapped` and decide what to do — most flows simply await
//   // `work` themselves afterward and call `swap()` when it resolves.

import {
  DEFAULT_TIMING, curtainAt, phaseProgress, waitIsOver, nextPhase, songLineIndex,
  hemWave, spotIntensity, singerSilhouette, singerHead, singerBun, singerMic,
} from './kantar.core.js';
import { sameDocumentTransition } from '../page.js';
import { drawCurtain as drawSharedCurtain } from '../../curtain/curtain.js';

const hasReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/**
 * Run one interlude as an overlay inside `host` (a `position: relative`
 * element with room for it; give the CSS `.sg-kantar { position: absolute;
 * inset: 0 }`). This appends its overlay to `host` and removes exactly that
 * overlay when done — it never touches `host`'s other children, so the step
 * content `swap` changes can live in `host` too, as a sibling.
 * @param {Element} host
 * @param {{
 *   work?: Promise<any>,
 *   lines?: string[],
 *   swap?: () => void,
 *   register?: 'quiet' | 'warm' | 'playful',
 *   reducedMotion?: boolean,
 *   minWaitMs?: number, curtainDown?: number, curtainUp?: number, msPerLine?: number,
 *   label?: string,
 * }} [opts]
 * @returns {Promise<{ skipped: boolean, workDone: boolean, swapped: boolean }>}
 */
export function runKantar(host, {
  work = Promise.resolve(),
  lines = [],
  swap = () => {},
  register = 'warm',
  reducedMotion = hasReducedMotion(),
  minWaitMs = DEFAULT_TIMING.minWaitMs,
  curtainDown = DEFAULT_TIMING.curtainDown,
  curtainUp = DEFAULT_TIMING.curtainUp,
  msPerLine = DEFAULT_TIMING.msPerLine,
  label = 'Please wait',
} = {}) {
  // No curtain theatre in quiet (the charter's register table: no ornament
  // for an auditor) or under reduced motion: a plain, honestly-held status
  // line instead, never a fixed prop of curtain animation.
  if (register === 'quiet' || reducedMotion) return runPlain(host, { work, swap, label });
  return runCurtain(host, { work, lines, swap, register, timing: { curtainDown, curtainUp, minWaitMs }, msPerLine, label });
}

async function runPlain(host, { work, swap, label }) {
  const status = host.ownerDocument.createElement('p');
  status.setAttribute('role', 'status');
  status.className = 'sg-kantar sg-kantar-plain';
  status.textContent = label;
  host.append(status);
  const workDone = await work.then(() => true, () => true);
  swap();
  status.remove();
  return { skipped: false, workDone, swapped: true };
}

// ── the curtain's own drawing: folds, a hem that ripples on landing, a
// pelmet, the spotlight pool, and (playful) a singer's silhouette standing
// in it. Canvas, drawn every tick alongside the phase state machine below;
// the geometry itself is kantar.core.js's (pure, tested), this function
// only turns numbers into paint. ────────────────────────────────────────

function drawCurtain(ctx, w, h, { curtain, tSec, landedSec, spotAmt, playful }) {
  ctx.clearRect(0, 0, w, h);
  if (curtain <= 0.002 || w <= 0 || h <= 0) return;

  const steps = 20;
  // The velvet, the folds, the shadow and the gold fringe are the shared
  // tiatr curtain (packages/curtain); this file adds the spot, the singer and
  // the valance. The playful register keeps the same curtain: the figure is
  // what sets it apart.
  const hemPath = drawSharedCurtain(ctx, { x0: 0, y0: 0, x1: w, y1: h }, {
    drop: curtain,
    t: tSec,
    scale: Math.max(0.4, w / 900),
    hem: (x, bottom) => bottom + hemWave(x / w, curtain, landedSec) * (h / 240),
    within: () => {
      // The spotlight pool, warm and soft, only while the song is on. Kept in
      // the stage's upper half so the caption band below the singer's feet
      // (kantar.css's .sg-kantar-spot, anchored to the bottom) never falls
      // across the glow or the figure (Rasika's Wave 5 review, S3).
      if (spotAmt > 0.01) {
        const cx = w / 2, cy = h * 0.36, r = Math.min(w, h) * 0.4;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        glow.addColorStop(0, `rgba(255,230,170,${0.55 * spotAmt})`);
        glow.addColorStop(1, 'rgba(255,230,170,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // The singer, standing in the spot: playful only, so the quieter warm
        // register keeps the pool but not the figure. Feet well above the
        // caption band, so the two boxes never touch. The plate's singer() adds
        // a head and a bun to the same path as the body, a mic and stand, a
        // blurred shadow thrown up and to the left, and a warm rim where the
        // spot catches the edge (Rasika's Wave 5 review, S3 round 2: a first
        // fix restored the body's own 21 points but not singer()'s own
        // additions, so the figure had shoulders and no head).
        if (playful) {
          const figH = h * 0.28, feetY = h * 0.66, cxFig = w / 2;
          const sway = Math.sin(tSec * 1.4) * 0.5;
          const toXY = ([px, py]) => [cxFig + px * figH, feetY + py * figH];
          const body = singerSilhouette(sway).map(toXY);
          const head = singerHead(sway), bun = singerBun(sway);
          const mic = singerMic().map(toXY);

          const figPath = new Path2D();
          body.forEach(([x, y], i) => (i ? figPath.lineTo(x, y) : figPath.moveTo(x, y)));
          figPath.closePath();
          const [headX, headY] = toXY([head.cx, head.cy]);
          figPath.ellipse(headX, headY, head.rx * figH, head.ry * figH, head.rotation, 0, Math.PI * 2);
          const [bunX, bunY] = toXY([bun.cx, bun.cy]);
          figPath.ellipse(bunX, bunY, bun.rx * figH, bun.ry * figH, 0, 0, Math.PI * 2);

          // the shadow thrown on the curtain: larger, softer, up and to the left
          ctx.save();
          ctx.globalAlpha = 0.28 * spotAmt;
          ctx.filter = 'blur(6px)';
          ctx.translate(cxFig, feetY);
          ctx.scale(1.25, 1.2);
          ctx.translate(-cxFig - figH * 0.125, -feetY + figH * 0.108);
          ctx.fillStyle = '#2a0508';
          ctx.fill(figPath);
          ctx.restore();

          // the mic and stand
          ctx.save();
          ctx.globalAlpha = spotAmt;
          ctx.strokeStyle = '#1a1216';
          ctx.lineWidth = Math.max(1, figH * 0.01);
          ctx.lineCap = 'round';
          ctx.beginPath();
          mic.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
          ctx.restore();

          // the figure, with a warm rim where the spot catches its edge
          ctx.save();
          ctx.globalAlpha = spotAmt;
          ctx.fillStyle = '#1c1420';
          ctx.fill(figPath);
          ctx.clip(figPath);
          ctx.globalCompositeOperation = 'lighter';
          const rim = ctx.createRadialGradient(cxFig + figH * 0.08, feetY - figH * 0.7, figH * 0.04, cxFig + figH * 0.08, feetY - figH * 0.7, figH * 0.9);
          rim.addColorStop(0, 'rgba(255,200,140,0.25)');
          rim.addColorStop(1, 'rgba(255,200,140,0)');
          ctx.fillStyle = rim;
          ctx.fillRect(cxFig - figH, feetY - figH * 1.2, figH * 2, figH * 1.3);
          ctx.restore();

          // a glint on the mic
          ctx.fillStyle = `rgba(255,230,170,${0.8 * spotAmt})`;
          ctx.beginPath();
          ctx.arc(cxFig + figH * 0.125, feetY - figH * 0.8, Math.max(1, figH * 0.0125), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  });
  if (!hemPath) return;

  // A gold pelmet trim along the very top, scalloped, the way a tiatr
  // proscenium's valance overhangs the curtain's own top edge.
  ctx.save();
  ctx.clip(hemPath);
  const trimH = Math.max(6, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i <= steps; i++) {
    const xf = i / steps;
    ctx.lineTo(xf * w, trimH * (0.6 + 0.4 * Math.sin(xf * Math.PI * 5)));
  }
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fillStyle = '#c9a24a';
  ctx.fill();
  ctx.restore();
}

function runCurtain(host, { work, lines, swap, register, timing, msPerLine, label }) {
  const doc = host.ownerDocument;
  const playful = register === 'playful';
  const root = doc.createElement('div');
  root.className = 'sg-kantar';
  root.dataset.register = register;
  const curtain = doc.createElement('div');
  curtain.className = 'sg-kantar-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  const canvas = doc.createElement('canvas');
  canvas.className = 'sg-kantar-canvas';
  curtain.append(canvas);
  const spot = doc.createElement('div');
  spot.className = 'sg-kantar-spot';
  const line = doc.createElement('p');
  line.className = 'sg-kantar-line';
  line.setAttribute('role', 'status');
  spot.append(line);
  const skipBtn = doc.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'sg-kantar-skip';
  skipBtn.textContent = 'Skip';
  root.append(curtain, spot, skipBtn);
  host.append(root);
  line.textContent = label;

  const ctx = canvas.getContext('2d');
  // A canvas sized by a ResizeObserver must be redrawn after every resize:
  // resizing clears it (Wave 4 lesson). `lastPaint` replays the most recent
  // frame once the new size lands.
  let lastPaint = null;
  const ro = new ResizeObserver(() => {
    const box = curtain.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (lastPaint) drawCurtain(ctx, box.width, box.height, lastPaint);
  });
  ro.observe(curtain);

  let workDone = false;
  work.then(() => { workDone = true; }, () => { workDone = true; });
  let skipped = false;
  skipBtn.addEventListener('click', () => { skipped = true; });

  const t0 = performance.now();
  let landedAt = null;

  const paint = (phase, p, msInPhase) => {
    const curtainOpen = curtainAt(phase, p);
    root.style.setProperty('--sg-kantar-curtain', String(curtainOpen));
    const spotAmt = spotIntensity(phase, msInPhase);
    root.style.setProperty('--sg-kantar-spot', spotAmt > 0.01 ? '1' : '0');
    if (curtainOpen >= 0.999 && landedAt == null) landedAt = performance.now();
    if (curtainOpen < 0.999) landedAt = null;
    const box = curtain.getBoundingClientRect();
    const frame = {
      curtain: curtainOpen,
      tSec: (performance.now() - t0) / 1000,
      landedSec: landedAt == null ? null : (performance.now() - landedAt) / 1000,
      spotAmt,
      playful,
    };
    lastPaint = frame;
    if (box.width > 0 && box.height > 0) drawCurtain(ctx, box.width, box.height, frame);
  };

  return new Promise(resolve => {
    let phase = 'down', phaseStart = performance.now(), swapped = false, shownLine = -1, raf = 0;

    const finish = () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      root.remove();
      resolve({ skipped, workDone, swapped });
    };

    const tick = () => {
      const t = performance.now(), msInPhase = t - phaseStart;

      if (phase === 'down') {
        if (skipped || msInPhase >= timing.curtainDown) { phase = 'wait'; phaseStart = t; }
      } else if (phase === 'wait') {
        if (lines.length) {
          const i = songLineIndex(msInPhase, lines, msPerLine);
          if (i !== shownLine) { shownLine = i; line.textContent = lines[i]; }
        }
        const over = waitIsOver({ workDone, msInPhase, minWaitMs: timing.minWaitMs });
        if (over || (skipped && workDone)) {
          if (!swapped) { swapped = true; sameDocumentTransition(swap, { reducedMotion: false }); }
          phase = 'up'; phaseStart = t;
        } else if (skipped && !workDone) {
          // Nothing finished to show yet: move the curtain on without
          // swapping, so the caller can decide (see the module doc).
          phase = 'up'; phaseStart = t;
        }
      } else if (phase === 'up') {
        if (skipped) { phase = nextPhase('up'); phaseStart = t; } // finish the rise at once
        else if (msInPhase >= timing.curtainUp) { phase = nextPhase('up'); phaseStart = t; }
      }

      if (phase === 'done') { paint('done', 1, 0); finish(); return; }
      const p = phaseProgress(t - phaseStart, phase === 'down' ? timing.curtainDown : phase === 'up' ? timing.curtainUp : 0);
      paint(phase, p, phase === 'wait' ? t - phaseStart : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
