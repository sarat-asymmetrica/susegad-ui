// The pot on the balcao and the paragraph that flows round it, in <sg-veranda-stage> (B5). Loaded only when the element has a
// paragraph marked data-flow, so a page without one pays nothing.
//
//   live tier   the pot is drawn by three.js in its own small canvas, turning slowly. Each frame its silhouette is projected from
//               the mesh's own vertices into a room per line, and the type tier (Pretext) lays the paragraph round it, one
//               width per line. The layout is redone at sixteen steps a turn, not every frame: a line that shifts under the eye
//               is hard to read (Vad's lesson), and a line that has not changed is not touched.
//   2D tier, quiet, reduced motion   the same pot as a still (a stipple of its own surface points) and the paragraph laid once.
//
// The paragraph is real text: its lines are spans inside the <p>, in reading order, with the spaces kept.

import { MATKA, surfacePoints, toScreen, extentIn, flowShape, quantise } from './matka.core.js';
import { projectM, zToDepth } from './world.js';

const TAU = Math.PI * 2, OMEGA = 0.55, STEPS = 16;
const SEAT = { x: 1.12, y: 0.46, z: 4.2, h: 0.4 }; // metres: the pot stands on the balcao's seat, 0.4 m tall
const CLAY = { day: '#b4643c', dusk: '#7c3f2c', monsoon: '#8f4f36' };

/** Where the pot's foot and top land on the stage (px), for the camera now: { x, y, h, d }. */
function stand(dp) {
  const b = projectM(SEAT.x, SEAT.y, SEAT.z), t = projectM(SEAT.x, SEAT.y + SEAT.h, SEAT.z), d = zToDepth(b[2]);
  const [x, y] = dp.place(b[0], b[1], d), [, y2] = dp.place(t[0], t[1], d);
  return { x, y, h: Math.abs(y - y2), d };
}

export async function attachMatka(host, { stage, layer, para, dp, mood = 'day', live = false }) {
  const [type, { loadThree }] = await Promise.all([import('../../type/index.js'), import('../../stage3d/stage3d.js')]);
  const cs = getComputedStyle(para), font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, size = parseFloat(cs.fontSize), leading = 1.4;
  const text = para.textContent.replace(/\s+/g, ' ').trim();
  para.textContent = '';
  await type.fontReady(font);

  const card = Object.assign(document.createElement('div'), { className: 'flow-card' });
  const canvas = Object.assign(document.createElement('canvas'), { className: 'matka-cv' }); canvas.setAttribute('aria-hidden', 'true');
  card.append(para); layer.prepend(canvas); layer.prepend(card);
  Object.assign(card.style, { position: 'absolute', left: '0', top: '0' });
  Object.assign(para.style, { position: 'relative', margin: '0' });

  // three.js, only on the live tier
  let THREE = null, gl = null;
  if (live) THREE = await loadThree();
  if (THREE) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene(), group = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(CLAY[mood] ?? CLAY.day) });
    const prof = MATKA.profile.map(([r, y]) => new THREE.Vector2(r, y));
    group.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mat));
    const h = MATKA.handle, handle = new THREE.Mesh(new THREE.TorusGeometry(h.major, h.minor, 10, 40), mat); handle.position.set(h.x, h.y, 0); group.add(handle);
    const p = MATKA.spout, L = Math.hypot(p.x1 - p.x0, p.y1 - p.y0), spout = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 1.25, L, 10), mat);
    spout.position.set((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, 0); spout.rotation.z = Math.atan2(p.y1 - p.y0, p.x1 - p.x0) - Math.PI / 2; group.add(spout);
    scene.add(group, new THREE.AmbientLight(0xffffff, 0.62)); const sun = new THREE.DirectionalLight(0xfff0d8, 1.0); sun.position.set(-1.4, 2.2, 2.4); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(10, 1, 1, 100);
    gl = { renderer, group, camera, meshes: [group.children[0], handle, spout], mat, THREE };
  }

  let drawnAt = 0, sizeChanged = false, theta = 0.6, laidStep = -1, laidKey = '', last = 0, raf = 0, alive = true, pose = null;
  const col = { x: 0, y: 0, w: 0, h: 0 };
  let cardW = 0, cardH = 0, laid = [];

  function frameFor(s) {
    // the canvas: 1.8 heights wide and 1.25 tall, the pot's foot at its lower middle. Its size follows the pot's size rounded to an eighth,
    // not the pot: a walk changes the size every frame, and resizing a WebGL canvas every frame cost more than drawing on it
    const hq = layScale(s) * 78, wc = Math.round(hq * 1.8), hc = Math.round(hq * 1.25), dpr = Math.min(2, devicePixelRatio || 1);
    return { wc, hc, dpr, cx: wc / 2, cy: hc * 0.5 + hq * 0.5 };
  }
  let sizeKey = '';
  function place(s) {
    const f = frameFor(s), key = `${f.wc}|${f.hc}|${f.dpr}`;
    // the size is set only when it changes; every frame only the transform moves (the camera walking must not cost a relayout)
    sizeChanged = key !== sizeKey;
    if (key !== sizeKey) { sizeKey = key; canvas.style.cssText = `position:absolute;left:0;top:0;width:${f.wc}px;height:${f.hc}px;pointer-events:none`; canvas.width = Math.round(f.wc * f.dpr); canvas.height = Math.round(f.hc * f.dpr); }
    canvas.style.transform = `translate(${(s.x - f.cx).toFixed(1)}px,${(s.y - f.cy).toFixed(1)}px)`;
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
    const { renderer, group, camera, meshes } = gl;
    if (gl.sized !== sizeKey) { gl.sized = sizeKey; renderer.setPixelRatio(f.dpr); renderer.setSize(f.wc, f.hc, false); }
    if (gl.h !== s.h.toFixed(1)) {
      gl.h = s.h.toFixed(1);
      const D = 30, fov = 2 * Math.atan((f.hc / s.h / 2) / D) * 180 / Math.PI;
      camera.fov = fov; camera.aspect = f.wc / f.hc;
      // the foot centre sits at canvas (cx, cy): the camera looks at the point that lands in the canvas middle
      const midY = (f.cy - f.hc / 2) / s.h; camera.position.set(0, midY, D); camera.lookAt(0, midY, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    }
    group.rotation.y = th; group.updateMatrixWorld(true);
    renderer.render(gl.group.parent, camera);
  }
  /** The silhouette, from the mesh's own vertices projected through the camera: what three drew. Read on demand (a check, or a layout), not every frame. */
  function project3(f) {
    const { camera, meshes } = gl, V = new gl.THREE.Vector3(), pts = [];
    for (const mesh of meshes) { const pos = mesh.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { V.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(camera); pts.push([(V.x * 0.5 + 0.5) * f.wc, (1 - (V.y * 0.5 + 0.5)) * f.hc]); } }
    return pts;
  }

  /** Lay the paragraph round the pot, at this pose (a turn already quantised). Only spans that changed are written. */
  const layScale = s => Math.max(0.7, Math.round(s.h / 78 * 8) / 8);
  function lay(s, f, th) {
    // the layout is done at the pot's size rounded to an eighth (a walk changes it every frame, and every new size is a new font to measure), with the pad to cover the rounding
    const scale = layScale(s), hq = scale * 78, px = size * scale, width = Math.round(hq * 4.3), height = Math.round(hq * 3.3);
    // the column and the pot, measured from the pot's foot: where the camera puts the foot is only a transform, so walking never re-lays
    // the pane stands beside the pot with the pot cutting into its top right corner: the column ends at the pot's middle (the pot straddles the pane's edge, about a third of it outside), and starts a little above its lip
    col.x = hq * 0.05 - width; col.y = -hq * 1.15; col.w = width; col.h = height;
    const pot = toScreen(surfacePoints(th), 0, 0, hq);
    const shape = flowShape(col, (top, bottom) => extentIn(pot, top, bottom), Math.max(8, hq * 0.2));
    const prepared = type.prepare(text, `${cs.fontWeight} ${px.toFixed(2)}px ${cs.fontFamily}`), lh = px * leading;
    const { lines } = type.layIntoShape([{ prepared, lineHeight: lh, gap: 0 }], shape, { top: col.y, bottom: col.y + col.h, scale: 1, minWidth: px * 4 });
    const spans = [...para.children];
    while (spans.length > lines.length) spans.pop().remove();
    lines.forEach((l, k) => {
      let sp = spans[k]; if (!sp) { sp = document.createElement('span'); sp.dataset.line = ''; para.append(sp); }
      const t = l.text + (k < lines.length - 1 ? ' ' : '');
      if (sp.textContent !== t) sp.textContent = t;
      Object.assign(sp.style, { position: 'absolute', whiteSpace: 'pre', left: `${(l.x - col.x).toFixed(1)}px`, top: `${(l.y - col.y).toFixed(1)}px`, font: `${cs.fontWeight} ${px.toFixed(2)}px ${cs.fontFamily}`, lineHeight: `${lh.toFixed(1)}px` });
    });
    const bottom = lines.length ? lines.at(-1).y + lines.at(-1).h : col.y + lh;
    Object.assign(para.style, { display: 'block', width: `${width}px`, height: `${(bottom - col.y).toFixed(1)}px` });
    Object.assign(card.style, { padding: '10px', width: `${width}px` });
    card.dataset.lines = String(lines.length);
    cardW = width + 20; cardH = bottom - col.y + 20; laid = lines.map(l => ({ x: l.x, y: l.y, w: l.w, h: l.h, room: shape(l.y, l.y + l.h)?.w ?? 0 }));
    return lines;
  }

  function tick(now) {
    if (!alive) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    const s = stand(dp), f = place(s);
    card.style.transform = `translate(${(s.x + col.x - 10).toFixed(1)}px,${(s.y + col.y - 10).toFixed(1)}px)`;
    if (gl) theta = (theta + OMEGA * dt) % TAU;
    const th = gl ? theta : 0.6;
    // the turn is slow (a full turn in 11 s), so the pot is drawn at 20 Hz: a second WebGL context redrawn every frame beside the picture's own cost 14 ms a frame on an integrated GPU
    if (gl) { if (now - drawnAt >= 48 || sizeChanged) { drawnAt = now; draw3D(s, f, th); } } else draw2D(s, f, th);
    const step = Math.round(quantise(th, STEPS) / TAU * STEPS), key = String(layScale(s));
    if (step !== laidStep || key !== laidKey) {
      laidStep = step; laidKey = key;
      lay(s, f, quantise(th, STEPS));
      host.dispatchEvent(new CustomEvent('sg-flow', { bubbles: true, composed: true, detail: { step, lines: +card.dataset.lines } }));
    }
    pose = { s, f, th };
    if (gl) raf = requestAnimationFrame(tick);
  }
  // the still is drawn and laid once, then only when the camera moves it (a walk, a resize)
  const watch = () => { if (!alive) return; const s = stand(dp), key = `${Math.round(s.x)}|${Math.round(s.y)}|${Math.round(s.h)}`; if (!gl && key !== seen) { seen = key; tick(performance.now()); } requestAnimationFrame(watch); };
  let seen = '';
  raf = requestAnimationFrame(tick);
  if (!gl) requestAnimationFrame(watch);

  return {
    live: !!gl,
    /** The pot's silhouette as three drew it, in canvas px, and the pose it is in (for a check to read). */
    get pose() { return pose ? { ...pose, screen: gl ? project3(pose.f) : null, step: laidStep } : null; },
    get card() { return card; },
    /** The pane's box in stage px, for the camera now: what every other set of words keeps clear of. */
    rect() { if (!alive || !laid.length) return null; const s = stand(dp); return { x: s.x + col.x - 10, y: s.y + col.y - 10, w: cardW, h: cardH }; },
    /** The paragraph's line boxes in stage px, the room each was given and the column's full width (a room narrower than the column was cut by the pot). */
    lines() { if (!alive) return []; const s = stand(dp); return laid.map(l => ({ x: s.x + l.x, y: s.y + l.y, w: l.w, h: l.h, room: l.room, full: col.w })); },
    /** What three drew, as alpha at the canvas's pixels (rendered again and read at once, before the browser clears it). */
    pixels() {
      if (!alive) return null;
      const s = stand(dp), f = place(s);
      if (gl) draw3D(s, f, theta); else draw2D(s, f, 0.6);
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, alpha = new Uint8Array(c.width * c.height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
      return { w: c.width, h: c.height, alpha, rect: canvas.getBoundingClientRect().toJSON() };
    },
    get canvas() { return canvas; },
    destroy() { alive = false; cancelAnimationFrame(raf); gl?.renderer.dispose(); card.remove(); canvas.remove(); },
  };
}
