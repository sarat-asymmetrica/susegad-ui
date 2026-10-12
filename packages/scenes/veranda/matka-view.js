// The pot on the balcao and the paragraph that flows round it, in <sg-veranda-stage> (B5). Loaded only when the element has a
// paragraph marked data-flow, so a page without one pays nothing.
//
//   live tier   the pot is drawn by three.js in a small canvas, turning slowly. Each frame its silhouette is projected from
//               the mesh's own vertices into a room per line, and the type tier (Pretext) lays the paragraph round it, one
//               width per line. The layout is redone at sixteen steps a turn, not every frame: a line that shifts under the eye
//               is hard to read (Vad's lesson), and a line that has not changed is not touched.
//               One layout, two painters: the lines are DOM spans (the real words, in reading order) and, in the same scene and
//               camera as the pot, textured quads (stage3d/text.live.js) with depth beside it. While the quads are on screen
//               the spans' ink is transparent; the moment they are not (forced colours, a lost context, a failed load) it
//               comes back, so the paragraph is never blank.
//   2D tier     motion is on but there is no WebGL: the same layout and the spans, the pot a still.
//   still       quiet and reduced motion: nothing is measured and the type tier is not even requested. The pot is a still and the
//               paragraph is plain flow round a CSS shape-outside hug of its silhouette (occlusion.core.js hugFloat).
//
// The paragraph is real text in every tier: the still leaves the <p> as it was; the others write its lines as spans inside it.

import { MATKA, surfacePoints, toScreen, extentIn, flowShape, hugFloat, quantise, columnAt } from './matka.core.js';
import { potBreaks } from './pot-breaks.core.js';
import { lineBoxes, snapBoxes, spanStyle, quadPlan, frameCovering, frustumOf, CAM_D } from '../../stage3d/text.core.js';
import { projectM, zToDepth } from './world.js';

const TAU = Math.PI * 2, OMEGA = 0.55, STEPS = 16;
const SEAT = { x: 1.12, y: 0.46, z: 4.2, h: 0.4 }; // metres: the pot stands on the balcao's seat, 0.4 m tall
const CLAY = { day: '#b4643c', dusk: '#7c3f2c', monsoon: '#8f4f36' };
const INK_OFF = '.flow-card[data-paint=quads] span[data-line]{color:transparent}.flow-card[data-paint=quads] span[data-line]::selection{color:transparent;background:color-mix(in srgb,Highlight 30%,var(--sg-surface-raised,Canvas))}';

// One WebGL context is kept for a few seconds after a teardown, so a stage that stacks and unstacks in quick turns (a window dragged across
// the 560 px line) reuses it instead of making a new one each time (a page may hold sixteen, and engines free a dropped one late); after
// the pause it is given back (forceContextLoss), so a stage that stays stacked holds no context.
let spare = null;
const SPARE_MS = 8000;
function release(s) { clearTimeout(s.timer); try { s.renderer.dispose(); s.renderer.forceContextLoss(); } catch { /* already gone */ } }
function keep(renderer, canvas) { if (spare) release(spare); const s = spare = { renderer, canvas, timer: 0 }; s.timer = setTimeout(() => { release(s); if (spare === s) spare = null; }, SPARE_MS); }
/** For a check: is a context being kept for a quick re-attach? */
export const spareHeld = () => !!spare;
function takeSpare() { const s = spare; spare = null; if (!s) return null; clearTimeout(s.timer); if (s.renderer.getContext().isContextLost()) { release(s); return null; } return s; }

/** Where the pot's foot and top land on the stage (px), for the camera now: { x, y, h, d }. */
function stand(dp) {
  const b = projectM(SEAT.x, SEAT.y, SEAT.z), t = projectM(SEAT.x, SEAT.y + SEAT.h, SEAT.z), d = zToDepth(b[2]);
  const [x, y] = dp.place(b[0], b[1], d), [, y2] = dp.place(t[0], t[1], d);
  return { x, y, h: Math.abs(y - y2), d };
}

export async function attachMatka(host, { stage, layer, para, dp, mood = 'day', live = false }) {
  // motion is on when the page is neither quiet nor reduced: only then does anything here measure
  const motion = host.dataset.register !== 'quiet' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cs = getComputedStyle(para), font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, size = parseFloat(cs.fontSize), leading = 1.4;
  const text = para.textContent.replace(/\s+/g, ' ').trim();
  let type = null, THREE = null, live3 = null;
  if (motion) {
    type = await import('../../type/index.js');
    if (live) {
      try {
        const [stage3d, q, o] = await Promise.all([import('../../stage3d/stage3d.js'), import('../../stage3d/text.live.js'), import('../../stage3d/occlusion.live.js')]);
        THREE = await stage3d.loadThree(); live3 = { ...q, ...o };
      } catch (err) { console.warn('veranda: the 3D pot could not load, so its paragraph shows as spans.', err?.message ?? err); }
    }
    // the faces for these very words (a stack's Kannada face is split by unicode-range), before anything is measured: a canvas never fetches a face itself
    await type.fontReady(font, text);
    // the paragraph stays as written, plainly visible, until the layout is ready: paintSpans swaps the spans in for it in one step
  }

  // The layout's arithmetic needs no DOM, so the stage can be asked whether the pane fits its frame before a card, a canvas or a WebGL context
  // exists: a pane that does not fit (larger text) is never attached only to be torn down; attachMatka answers null and the stage stacks.
  let colGrow = 1, col = columnAt(78), cardW = 0, cardH = 0;
  const layScale = s => Math.max(0.7, Math.round(s.h / 78 * 8) / 8);
  /** The paragraph laid round the pot at this pose, with the column grown (x1.6 up to x8) until the words fit: lines, the shape they were laid in, the font. Sets col, colGrow and the card's size. */
  function plan(s, th) {
    // the layout is done at the pot's size rounded to an eighth (a walk changes it every frame, and every new size is a new font to measure), with the pad to cover the rounding
    const scale = layScale(s), hq = scale * 78, px = size * scale, pot = toScreen(surfacePoints(th), 0, 0, hq);
    const pfont = `${cs.fontWeight} ${px.toFixed(2)}px ${cs.fontFamily}`, prepared = type.prepare(text, pfont), lh = px * leading;
    for (;;) {
      // the column and the pot, measured from the pot's foot: where the camera puts the foot is only a transform, so walking never re-lays
      col = columnAt(hq, colGrow);
      const shape = flowShape(col, (top, bottom) => extentIn(pot, top, bottom), Math.max(8, hq * 0.2));
      const { lines, fits } = type.layIntoShape([{ prepared, lineHeight: lh, gap: 0 }], shape, { top: col.y, bottom: col.y + col.h, scale: 1, minWidth: px * 4 });
      // larger text (a browser's text size at 200%) needs more lines than the column's height: a taller column, and the canvas with it, rather than lost words
      if (!fits && colGrow < 8) { colGrow *= 1.6; continue; }
      const bottom = lines.length ? lines.at(-1).y + lines.at(-1).h : col.y + lh;
      cardW = col.w + 20; cardH = bottom - col.y + 20;
      return { hq, px, pfont, lh, shape, lines, bottom, width: col.w };
    }
  }
  /** Does the pane, as planned, leave the picture frame? (2 px of slack) */
  const clippedBy = s => { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return false; /* not laid out yet: the report after the first layout says */ const x = s.x + col.x - 10, y = s.y + col.y - 10; return x < -2 || y < -2 || x + cardW > w + 2 || y + cardH > h + 2; };
  // The pot's break-stable steps (rung M1): the layout only has to be redone
  // where a line-break decision flips. Built once the words are measured (the
  // widths come from the oracle at this size); rebuilt if the size key changes,
  // which re-measures. Motion only: the still never re-lays anyway.
  let breaks = null, breaksKey = '';
  function rebuildBreaks(s) {
    // Built before the render loop (and before the scene's settle) so the first
    // settled layout already snaps to a break-stable step, and again each frame
    // but only when the key changes.
    //
    // The key is scale-invariant: the corridor widths and the word widths both
    // scale with the pot's on-screen size, so the ratio a break decision compares
    // does not, and one map serves every size the walk passes through. The
    // kernel's own test (pot-breaks.test.js, "the break pattern is scale
    // invariant") holds that claim.
    const key = `${size}|${colGrow}|${cs.fontFamily}|${cs.fontWeight}`;
    if (key === breaksKey) return;
    breaksKey = key;
    try {
      const hq = layScale(s) * 78, pxs = size * layScale(s), pfont = `${cs.fontWeight} ${pxs.toFixed(2)}px ${cs.fontFamily}`;
      const words = text.split(' ');
      // the view's true corridor relation at this angle: the wider side of the
      // column beside the pot's silhouette in each line's band (see rung M1's
      // report: the kernel is built against the relation the view really uses,
      // never a simplification of it)
      const probe = (a) => {
        const pot = toScreen(surfacePoints(a), 0, 0, hq);
        const shape = flowShape(col, (t, b) => extentIn(pot, t, b), Math.max(8, hq * 0.2));
        const bands = [];
        for (let k = 0; k < 24; k++) { const room = shape(col.y + k * (pxs * leading), col.y + (k + 1) * (pxs * leading)); bands.push(room ? room.w : col.w); }
        return bands;
      };
      // word widths: the layout's own measure of one word at this font (the
      // oracle is behind type.prepare; the widths are read back from a
      // one-word prepare each — cheap, done once per size key)
      const widths = words.map(w => type.measure(w, pfont));
      // the space: measured as the difference between a two-word and its words
      const w0 = type.measure(words[0], pfont), w1 = words[1] ? type.measure(words[1], pfont) : 0;
      const sp = words[1] ? Math.max(0, type.measure(`${words[0]} ${words[1]}`, pfont) - w0 - w1) : 0;
      breaks = potBreaks({ widths, space: sp }, probe, { samples: 360 });
    } catch (err) { console.warn('veranda: the break-stable steps could not be built, so the turn keeps its fixed steps.', err?.message ?? err); breaks = null; }
  }
  if (motion) { const s0 = stand(dp); plan(s0, quantise(0.6, STEPS)); rebuildBreaks(s0); if (clippedBy(s0)) return null; }

  const card = Object.assign(document.createElement('div'), { className: 'flow-card' });
  const sp = THREE ? takeSpare() : null;
  const canvas = sp?.canvas ?? Object.assign(document.createElement('canvas'), { className: 'matka-cv' }); canvas.setAttribute('aria-hidden', 'true');
  const hug = Object.assign(document.createElement('i'), { className: 'flow-hug' }); hug.setAttribute('aria-hidden', 'true');
  const ink = Object.assign(document.createElement('style'), { textContent: INK_OFF });
  if (!motion) card.append(hug);
  card.append(para); layer.prepend(canvas); layer.prepend(card); layer.prepend(ink);
  Object.assign(card.style, { position: 'absolute', left: '0', top: '0' });
  Object.assign(para.style, { position: 'relative', margin: '0' });
  card.dataset.paint = motion ? 'spans' : 'still';

  // three.js, only on the live tier; a renderer that cannot be made leaves the 2D tier, the spans showing
  let gl = null, quads = null, lost = false, drawn = false, dirty = false;
  const forced = matchMedia('(forced-colors: active)');
  if (THREE) {
    try {
      const renderer = sp?.renderer ?? new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene(), group = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(CLAY[mood] ?? CLAY.day) });
      const prof = MATKA.profile.map(([r, y]) => new THREE.Vector2(r, y));
      group.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mat));
      const h = MATKA.handle, handle = new THREE.Mesh(new THREE.TorusGeometry(h.major, h.minor, 10, 40), mat); handle.position.set(h.x, h.y, 0); group.add(handle);
      const p = MATKA.spout, L = Math.hypot(p.x1 - p.x0, p.y1 - p.y0), spout = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 1.25, L, 10), mat);
      spout.position.set((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, 0); spout.rotation.z = Math.atan2(p.y1 - p.y0, p.x1 - p.x0) - Math.PI / 2; group.add(spout);
      scene.add(group, new THREE.AmbientLight(0xffffff, 0.62)); const sun = new THREE.DirectionalLight(0xfff0d8, 1.0); sun.position.set(-1.4, 2.2, 2.4); scene.add(sun);
      const camera = new THREE.PerspectiveCamera(10, 1, 1, 100);
      gl = { renderer, scene, group, camera, meshes: [group.children[0], handle, spout], mat, THREE };
      quads = live3.createTextQuads(THREE, { scene, camera, invalidate: () => { dirty = true; } });
    } catch (err) {
      console.warn('veranda: the pot could not be drawn in 3D, so its paragraph shows as spans.', err?.message ?? err);
      const r = gl?.renderer ?? sp?.renderer; if (r) release({ renderer: r, timer: 0 }); gl = null; quads = null;
    }
  }
  let held = false, drawnAt = 0, sizeChanged = false, theta = 0.6, laidStep = -1, laidKey = '', last = 0, raf = 0, alive = true, pose = null;
  let laid = [], ready = false, stillKey = '';
  const stats = { lays: 0, layMs: [], tickMs: [] };

  /** The quads show only while they are really painting: WebGL up, a frame drawn with them, forced colours off. */
  function paintMode() {
    if (!motion) return 'still';
    return quads && drawn && !lost && !forced.matches ? 'quads' : 'spans';
  }
  const setPaint = () => { const p = paintMode(); if (card.dataset.paint !== p) card.dataset.paint = p; if (quads) quads.visible = p === 'quads'; };
  forced.addEventListener?.('change', () => { setPaint(); dirty = true; });
  const onLost = e => { e.preventDefault(); lost = true; setPaint(); }, onRestored = () => { lost = false; drawn = false; dirty = true; };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  function frameFor(s) {
    // the canvas: on the 2D tier 1.8 heights wide and 1.25 tall, the pot's foot at its lower middle; on the live tier it covers the
    // pane's column as well, so the quads and the pot share one scene and one camera. Its size follows the pot's size rounded to an
    // eighth, not the pot: a walk changes the size every frame, and resizing a WebGL canvas every frame cost more than drawing on it
    const hq = layScale(s) * 78, dpr = Math.min(2, devicePixelRatio || 1);
    if (gl) { const c = columnAt(hq, colGrow); return frameCovering({ x: c.x - 10, y: c.y - 10, w: c.w + 10 + hq * 0.95, h: c.h + 20 }, s.h, dpr, 6); }
    const wc = Math.round(hq * 1.8), hc = Math.round(hq * 1.25);
    return { wc, hc, dpr, cx: wc / 2, cy: hc * 0.5 + hq * 0.5, h: s.h };
  }
  let sizeKey = '';
  function place(s) {
    const f = frameFor(s), key = `${f.wc}|${f.hc}|${f.dpr}`;
    // the size is set only when it changes; every frame only the transform moves (the camera walking must not cost a relayout)
    const changed = key !== sizeKey; sizeChanged ||= changed;
    if (changed) { sizeKey = key; canvas.style.cssText = `position:absolute;left:0;top:0;width:${f.wc}px;height:${f.hc}px;pointer-events:none`; canvas.width = Math.round(f.wc * f.dpr); canvas.height = Math.round(f.hc * f.dpr); }
    // on the device's pixel grid: the words are textures, and a texture off the grid is soft
    f.snap = v => Math.round(v * f.dpr) / f.dpr;
    f.tx = f.snap(s.x - f.cx); f.ty = f.snap(s.y - f.cy);
    canvas.style.transform = `translate(${f.tx.toFixed(2)}px,${f.ty.toFixed(2)}px)`;
    return f;
  }
  function draw2D(s, f, th) {
    const g = canvas.getContext('2d'); g.setTransform(f.dpr, 0, 0, f.dpr, 0, 0); g.clearRect(0, 0, f.wc, f.hc);
    const pts = surfacePoints(th).sort((a, b) => a.z - b.z), clay = CLAY[mood] ?? CLAY.day;
    for (const p of pts) {
      const shade = 0.72 + 0.28 * Math.max(0, (-p.x * 0.5 + p.y * 0.6 + p.z * 0.6) / 1.2);
      g.fillStyle = clay; g.globalAlpha = 1; g.beginPath(); g.arc(f.cx + p.x * s.h, f.cy - p.y * s.h, Math.max(1.4, s.h * 0.022), 0, TAU); g.fill();
      g.fillStyle = `rgba(30,18,12,${(1 - shade).toFixed(2)})`; g.fill();
    }
  }
  function draw3D(s, f, th) {
    const { renderer, group, camera } = gl;
    if (gl.sized !== sizeKey) { gl.sized = sizeKey; renderer.setPixelRatio(f.dpr); renderer.setSize(f.wc, f.hc, false); }
    const pk = `${sizeKey}|${s.h.toFixed(1)}`;
    if (gl.proj !== pk) {
      gl.proj = pk; // the words are placed in world units by the pot's scale on screen: a new scale moves them
      // the foot centre sits at canvas (cx, cy) and the camera looks straight down the pot's axis: an off-centre frustum window
      // (not a turned camera), so the pot's perspective is the same wherever the column puts the canvas's edges
      const fr = frustumOf(f, 1, CAM_D);
      camera.position.set(0, 0, CAM_D); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      camera.projectionMatrix.makePerspective(fr.left, fr.right, fr.top, fr.bottom, 1, 100); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    group.rotation.y = th; group.updateMatrixWorld(true);
    try { renderer.render(gl.scene, camera); drawn = !lost; } catch (err) { drawn = false; console.warn('veranda: the 3D pot could not be drawn.', err?.message ?? err); }
    setPaint();
  }
  /** The silhouette, from the mesh's own vertices projected through the camera: what three drew. Read on demand (a check, or a layout), not every frame. */
  const project3 = f => live3.projectMeshes(gl.THREE, gl.camera, gl.meshes, f);

  /** Write the lines as spans. Only spans that changed are written. */
  let swapped = false;
  function paintSpans(boxes, st) {
    if (!swapped) { swapped = true; para.textContent = ''; }
    const spans = [...para.children].filter(c => c.dataset.line !== undefined);
    while (spans.length > boxes.length) spans.pop().remove();
    boxes.forEach((b, k) => {
      let sp = spans[k]; if (!sp) { sp = document.createElement('span'); sp.dataset.line = ''; para.append(sp); }
      const t = b.text + b.tail;
      if (sp.textContent !== t) sp.textContent = t;
      Object.assign(sp.style, spanStyle(b, st));
    });
  }

  /** Lay the paragraph round the pot, at this pose (a turn already quantised), and hand the one layout to both painters. */
  function lay(s, f, th) {
    const t0 = performance.now(), cg0 = colGrow;
    const { pfont, lh, shape, lines, bottom, width } = plan(s, th);
    if (colGrow !== cg0) f = place(s); // the column grew: the canvas did too
    let boxes = lineBoxes(lines, col);
    const st = { font: pfont, lineHeight: lh };
    paintSpans(boxes, st);
    Object.assign(para.style, { display: 'block', width: `${width}px`, height: `${(bottom - col.y).toFixed(1)}px` });
    Object.assign(card.style, { padding: '10px', width: `${width}px` });
    if (quads && !forced.matches) {
      // where the DOM's paragraph really is, against the canvas (the layers sit at fractions of a pixel the engine rounds its own way): read once per layout
      const pr = para.getBoundingClientRect();
      boxes = snapBoxes(boxes, { pageY: pr.top, base: quads.baseline(pfont, lh) }); // each baseline on the device's grid, so span and quad agree
      paintSpans(boxes, st);
      const cr = canvas.getBoundingClientRect(), cl = f.snap(cr.left), ct = f.snap(cr.top); // the compositor puts the canvas on whole device pixels
      try { quads.set(quadPlan(boxes, { font: pfont, ink: cs.color, dpr: f.dpr }), { f, origin: { x: pr.left - cl, y: pr.top - ct }, page: { x: pr.left, y: pr.top }, font: pfont, ink: cs.color }); dirty = true; }
      catch (err) { console.warn('veranda: the word quads could not be made, so the paragraph shows as spans.', err?.message ?? err); quads.dispose(); quads = null; setPaint(); }
    }
    card.dataset.lines = String(lines.length);
    laid = lines.map(l => ({ x: l.x, y: l.y, w: l.w, h: l.h, room: shape(l.y, l.y + l.h)?.w ?? 0 }));
    ready = true; stats.lays++; stats.layMs.push(+(performance.now() - t0).toFixed(2));
    return lines;
  }

  /** The still: the paragraph as plain text in a pane of the same size, flowing round a CSS shape-outside hug of the pot's silhouette. Nothing is measured. */
  function layStill(s) {
    const scale = layScale(s), hq = scale * 78, px = size * scale, key = `${scale}`;
    if (key === stillKey) return;
    stillKey = key; col = columnAt(hq);
    const edge = hugFloat(toScreen(surfacePoints(0.6), 0, 0, hq), col, { pad: Math.max(8, hq * 0.2) });
    Object.assign(para.style, { display: 'block', width: `${col.w}px`, font: `${cs.fontWeight} ${px.toFixed(2)}px ${cs.fontFamily}`, lineHeight: `${(px * leading).toFixed(1)}px` });
    Object.assign(card.style, { padding: '10px', width: `${col.w}px` });
    Object.assign(hug.style, edge ? { display: 'block', float: 'right', width: `${edge.w.toFixed(1)}px`, height: `${edge.h.toFixed(1)}px`, shapeOutside: edge.polygon, clipPath: 'none' } : { display: 'none' });
    cardW = card.offsetWidth; cardH = card.offsetHeight; ready = true;
  }

  /** Tell the stage when the pane no longer fits the picture frame (larger text), so it can stack and show the flat reading instead of clipping lines. */
  let clipped = false;
  function reportFit(s) {
    const now = clippedBy(s);
    if (now !== clipped) { clipped = now; host.dispatchEvent(new CustomEvent('sg-flow-clip', { bubbles: true, composed: true, detail: { clipped: now } })); }
  }

  function tick(now) {
    if (!alive) return;
    const t0 = performance.now();
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    const s = stand(dp); let f = place(s);
    card.style.transform = `translate(${f.snap(s.x + col.x - 10).toFixed(2)}px,${f.snap(s.y + col.y - 10).toFixed(2)}px)`;
    if (gl && !held) theta = (theta + OMEGA * dt) % TAU;
    const th = gl ? theta : 0.6;
    let laidNow = false;
    if (!motion) { const before = stillKey; layStill(s); if (stillKey !== before) reportFit(s); }
    else {
      const cg = colGrow;
      rebuildBreaks(s);
      // the layout snaps to a break-stable step when the flip map is built
      // (rung M1), else to the fixed sixteenth it always used
      const step = breaks ? breaks.quantize(th) : quantise(th, STEPS);
      const key = `${layScale(s)}|${f.dpr}`;
      if (step !== laidStep || key !== laidKey) {
        laidStep = step; laidKey = key; laidNow = true;
        lay(s, f, breaks ? step : quantise(th, STEPS));
        reportFit(s);
        if (colGrow !== cg) f = place(s); // the column grew: the canvas did too
        host.dispatchEvent(new CustomEvent('sg-flow', { bubbles: true, composed: true, detail: { step, lines: +card.dataset.lines } }));
      }
    }
    quads?.refit(f); // positions only: the pot's scale on screen moves the words in world units
    // the turn is slow (a full turn in 11 s), so the pot is drawn at 20 Hz: a second WebGL context redrawn every frame beside the picture's own cost 14 ms a frame on an integrated GPU
    if (gl) { if (now - drawnAt >= 48 || sizeChanged || laidNow || dirty) { drawnAt = now; dirty = false; if (!lost) draw3D(s, f, th); } } else draw2D(s, f, th);
    sizeChanged = false;
    pose = { s, f, th };
    if (stats.tickMs.length < 2000) stats.tickMs.push(performance.now() - t0);
    if (gl) raf = requestAnimationFrame(tick);
  }
  // the still is drawn and laid once, then only when the camera moves it (a walk, a resize)
  const watch = () => { if (!alive) return; const s = stand(dp), key = `${Math.round(s.x)}|${Math.round(s.y)}|${Math.round(s.h)}`; if (!gl && key !== seen) { seen = key; tick(performance.now()); } requestAnimationFrame(watch); };
  let seen = '';
  tick(performance.now()); // laid at once, in the same step the spans replace the words: no frame without them
  if (!gl) requestAnimationFrame(watch);
  // text zoom and a late face move the still's flow without moving the pot: read the pane's size again
  const ro = !motion && typeof ResizeObserver === 'function' ? new ResizeObserver(() => { cardW = card.offsetWidth; cardH = card.offsetHeight; }) : null;
  ro?.observe(card);

  return {
    live: !!gl,
    /** 'live' (three.js: spans and quads), 'spans' (motion on, no WebGL) or 'still' (quiet, reduced motion: nothing measured). */
    mode: gl ? 'live' : motion ? 'spans' : 'still',
    /** Who is painting the words now: 'quads' (the spans' ink is transparent), 'spans' or 'still'. */
    get paint() { return card.dataset.paint; },
    /** The quads' texts and their boxes as the camera projects them (canvas px), for a check. Null when there are none. */
    get quads() { return quads ? { texts: () => quads.texts(), screen: () => quads.screen(), canvasRect: () => canvas.getBoundingClientRect().toJSON(), visible: quads.visible } : null; },
    get stats() { return stats; },
    /** Rung M1, for a gate: the flip map's own count of distinct line-break states over one full turn (null before it is built). */
    get breakStatesPerTurn() { return breaks ? breaks.breakStatesPerTurn() : null; },
    /** Rung M1, for a gate: the break-stable steps' critical angles (radians), or null before the flip map is built. */
    get criticalAngles() { return breaks ? breaks.criticalAngles() : null; },
    /** Hold the pot at its turn (or let it go on), optionally turned to `th` radians first, so a check can read one pose twice or visit several quickly. */
    hold(on = true, th) { held = !!on; if (th !== undefined) theta = ((th % TAU) + TAU) % TAU; },
    /** The pot's silhouette as three drew it, in canvas px, and the pose it is in (for a check to read). */
    get pose() { return pose ? { ...pose, screen: gl ? project3(pose.f) : null, step: laidStep } : null; },
    get card() { return card; },
    /** The pane's box in stage px, for the camera now: what every other set of words keeps clear of. */
    rect() { if (!alive || !ready) return null; const s = stand(dp); return { x: s.x + col.x - 10, y: s.y + col.y - 10, w: cardW, h: cardH }; },
    /** The paragraph's line boxes in stage px, the room each was given and the column's full width (a room narrower than the column was cut by the pot). The still has none: its lines are the browser's. */
    lines() { if (!alive) return []; const s = stand(dp); return laid.map(l => ({ x: s.x + l.x, y: s.y + l.y, w: l.w, h: l.h, room: l.room, full: col.w })); },
    /**
     * What three drew, as alpha at the canvas's pixels (rendered again and read at once, before the browser clears it).
     * `what` is 'pot' (the default: the quads hidden), 'quads' (the pot hidden) or 'both'.
     */
    pixels(what = 'pot') {
      if (!alive) return null;
      const s = stand(dp), f = place(s);
      if (gl) { gl.group.visible = what !== 'quads'; if (quads) quads.visible = what !== 'pot'; draw3D(s, f, theta); } else draw2D(s, f, 0.6);
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, alpha = new Uint8Array(c.width * c.height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
      if (gl) { gl.group.visible = true; setPaint(); draw3D(s, f, theta); }
      return { w: c.width, h: c.height, alpha, rect: canvas.getBoundingClientRect().toJSON() };
    },
    get canvas() { return canvas; },
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro?.disconnect(); quads?.dispose();
      // what was made in the WebGL context is freed; the context is kept for a moment for a quick re-attach, then given back (see keep)
      canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      if (gl) { for (const m of gl.meshes) m.geometry.dispose(); gl.mat.dispose(); keep(gl.renderer, canvas); }
      card.remove(); canvas.remove(); ink.remove();
      // the paragraph goes back to the page as the plain text it was: no line spans, no inline style (the stage stacks, or re-attaches it)
      if (swapped) para.textContent = text;
      para.removeAttribute('style');
    },
  };
}
