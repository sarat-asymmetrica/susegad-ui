// The picture postcard: drawing it. The browser edge of postcard.core.js.
//
//   const pc = await preparePostcard({ name: 'Asha Naik', scene: 'ferry', event: CONCLAVE_2026 });
//   pc.paint(canvas);          // the finished card, still, on a canvas of CARD.width by CARD.height
//   pc.destroy();
//
// A postcard is paper, a framed picture, a name, a stamp and a postmark, all drawn on one canvas. The picture is the
// scene's own still, taken from its own `model()` and `createRenderer()` the way `recordSceneToGif` takes a frame.
// Everything except the picture is painted by `paintBase`, so a GIF paints it once and then only changes the picture.
// Same name and scene, same pixels, in one browser: the paper, the stamp's tilt, the postmark and the scene are all
// seeded, and nothing on the card reads the clock.

import { paper } from '../../engine/index.js';
import { CARD, PALETTE, fontOf, layout, coverRect, graphemes, normaliseName } from './postcard.core.js';
import { sceneNamed } from './scenes.js';

const TAU = Math.PI * 2;
/** Seconds of live frames drawn before a warmed GIF starts, which a scene spends fading its motion in. */
const LEAD = 1;
/** Let the page breathe: input and painting run before the work goes on. */
export const breathe = () => new Promise(resolve => { const { port1, port2 } = new MessageChannel(); port1.onmessage = () => { port1.close(); resolve(); }; port2.postMessage(0); });

/** `measure(text, size, face)` on a canvas. */
export function canvasMeasure() {
  const g = document.createElement('canvas').getContext('2d');
  return (text, size, face) => { g.font = fontOf(face, size); return g.measureText(text).width; };
}

/** The scene's own still moment, or 0 for a scene whose still is "long after" (1e6: nothing moves there). */
export const startOf = def => (def.meta.stillTime > 1e4 ? 0 : def.meta.stillTime ?? 0);

/** A scene's canvas, off screen, drawn on request: `frame(t, still)` returns the canvas as it is at scene time t. */
function openPicture(def, seed) {
  const { W, H } = def.meta, register = 'warm', motion = 'ambient';
  const host = document.createElement('div');
  // a card is paper and ink, the same on a dark page: the scene is drawn in daylight whatever the page's theme
  host.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;color-scheme:light';
  host.setAttribute('aria-hidden', 'true');
  document.body.append(host);
  const renderer = def.createRenderer(host, { W, H, register, motion, seed, governor: { level: 1 }, invalidate() {}, advance() {} });
  const src = host.querySelector('canvas');
  if (!src) { renderer.destroy(); host.remove(); throw new Error(`the scene ${def.name} drew no canvas`); }
  const pointer = { x: 0, y: 0, inside: false, down: false, keyboard: false };
  // tinto's baked caption cards are unreadable at card size; other scenes ignore `lines`
  const frame = (time, still) => {
    const data = def.model({ time, seed, register, params: { lines: false }, W, H });
    renderer.render(data, { time, dt: 1 / 10, calm: [], pointer, quality: 1, still, epoch: 0, register, motion });
    return src;
  };
  return { src, frame, ready: renderer.ready, destroy() { try { renderer.destroy(); } finally { host.remove(); } } };
}

// ── the parts ──────────────────────────────────────────────────────────────

/** The stamp on its own canvas, perforated, so the holes are really holes and the paper shows through. */
function stampImage(L, s) {
  const { w, h } = L.stamp, pad = 14, c = document.createElement('canvas');
  c.width = Math.ceil((w + pad * 2) * s); c.height = Math.ceil((h + pad * 2) * s);
  const g = c.getContext('2d');
  g.scale(s, s); g.translate(pad, pad);
  g.fillStyle = PALETTE.stampPaper; g.fillRect(0, 0, w, h);
  // the picture on the stamp: a low sun over a sea, a palm leaning in
  const ix = 16, iy = 16, iw = w - 32, ih = h - 108;
  g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
  const sky = g.createLinearGradient(0, iy, 0, iy + ih);
  sky.addColorStop(0, '#f2c987'); sky.addColorStop(0.62, '#f7e2b4'); sky.addColorStop(1, '#f9ecd0');
  g.fillStyle = sky; g.fillRect(ix, iy, iw, ih);
  g.fillStyle = PALETTE.marigold; g.beginPath(); g.arc(ix + iw * 0.62, iy + ih * 0.52, 30, 0, TAU); g.fill();
  g.fillStyle = PALETTE.sea; g.fillRect(ix, iy + ih * 0.56, iw, ih * 0.44);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const y = iy + ih * (0.64 + k * 0.08);
    g.beginPath(); for (let x = ix + 8; x < ix + iw - 8; x += 4) { const yy = y + Math.sin((x + k * 17) / 9) * 2.4; x === ix + 8 ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke();
  }
  g.strokeStyle = '#3a2a1c'; g.lineWidth = 4; g.beginPath(); g.moveTo(ix + 34, iy + ih * 0.62); g.quadraticCurveTo(ix + 40, iy + ih * 0.38, ix + 52, iy + ih * 0.2); g.stroke();
  g.lineWidth = 3; for (const [dx, dy] of [[-30, 10], [-20, -10], [4, -16], [26, -4], [30, 16]]) { g.beginPath(); g.moveTo(ix + 52, iy + ih * 0.2); g.quadraticCurveTo(ix + 52 + dx * 0.6, iy + ih * 0.2 + dy - 14, ix + 52 + dx, iy + ih * 0.2 + dy + 8); g.stroke(); }
  g.restore();
  g.strokeStyle = PALETTE.indigo; g.lineWidth = 2.5; g.strokeRect(ix, iy, iw, ih);
  // its words, at the foot
  const words = L.stamp.words;
  if (words) {
    g.fillStyle = PALETTE.indigo; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = fontOf('label', words.size);
    const lh = Math.round(words.size * 1.15), y0 = iy + ih + 14 + words.size * 0.8;
    words.lines.forEach((t, i) => g.fillText(t, w / 2, y0 + i * lh));
  }
  g.strokeStyle = PALETTE.laterite; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
  // perforations
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  const step = 22, rad = 7;
  for (let x = step / 2; x < w; x += step) { g.beginPath(); g.arc(x, 0, rad, 0, TAU); g.fill(); g.beginPath(); g.arc(x, h, rad, 0, TAU); g.fill(); }
  for (let y = step / 2; y < h; y += step) { g.beginPath(); g.arc(0, y, rad, 0, TAU); g.fill(); g.beginPath(); g.arc(w, y, rad, 0, TAU); g.fill(); }
  return { c, pad };
}

/** Text along a circle: top (reading clockwise, tops outward) or bottom (reading left to right, tops inward). */
function arcText(g, text, { r, size, bottom = false, spacing = 3 }) {
  g.font = fontOf('label', size); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const chars = graphemes(text), widths = chars.map(ch => g.measureText(ch).width + spacing), total = widths.reduce((a, b) => a + b, 0), span = total / r;
  let acc = 0;
  chars.forEach((ch, i) => {
    const mid = acc + widths[i] / 2; acc += widths[i];
    const a = bottom ? Math.PI / 2 + span / 2 - mid / r : -Math.PI / 2 - span / 2 + mid / r;
    g.save(); g.translate(Math.cos(a) * r, Math.sin(a) * r); g.rotate(bottom ? a - Math.PI / 2 : a + Math.PI / 2);
    g.fillText(ch, -(widths[i] - spacing) / 2, 0); g.restore();
  });
}

function postmarkInk(g, L) {
  const p = L.postmark;
  g.save();
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.86; g.fillStyle = g.strokeStyle = PALETTE.indigo;
  g.translate(p.cx, p.cy); g.rotate((p.rot * Math.PI) / 180);
  g.lineCap = 'round';
  g.lineWidth = 5; g.beginPath(); g.arc(0, 0, p.r, 0, TAU); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(0, 0, p.r - 10, 0, TAU); g.stroke();
  g.beginPath(); g.arc(0, 0, p.r - 46, 0, TAU); g.lineWidth = 1.5; g.stroke();
  if (p.ringTop) arcText(g, p.ringTop.text, { r: p.r - 32, size: p.ringTop.size });
  if (p.ringBottom) arcText(g, p.ringBottom.text, { r: p.r - 32 + p.ringBottom.size * 0.74, size: p.ringBottom.size, bottom: true });
  if (p.center) {
    g.font = fontOf('label', p.center.size); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const lh = Math.round(p.center.size * 1.2), y0 = -((p.center.lines.length - 1) * lh) / 2 + p.center.size * 0.32;
    p.center.lines.forEach((t, i) => g.fillText(t, 0, y0 + i * lh));
  }
  // cancellation waves, trailing off to the left
  g.lineWidth = 4;
  for (const w of p.waves) {
    g.beginPath();
    for (let x = w.x0; x <= w.x1; x += 4) { const y = w.y + w.amp * Math.sin(((x - w.x0) / w.period) * TAU + w.phase); x === w.x0 ? g.moveTo(x - p.cx, y - p.cy) : g.lineTo(x - p.cx, y - p.cy); }
    g.stroke();
  }
  g.restore();
}

// ── the card ───────────────────────────────────────────────────────────────

/** Where the ink of each line of text really is, so a check can say none of it leaves its place. */
function inkBox(g, text, x, baseline, within, what) {
  const m = g.measureText(text);
  return { what, x: x - m.actualBoundingBoxLeft, y: baseline - m.actualBoundingBoxAscent, w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, within };
}

/**
 * Prepare a card: fonts loaded, layout done, the scene's canvas open. `paint`, `paintBase` and `paintPicture` draw
 * it; `destroy` lets the scene go.
 * An empty `name` leaves the place for it holding `placeholder`, drawn lighter; the alt text then says there is room for a name.
 * @param {{ name: string, placeholder?: string, scene?: string, seed?: number | string, event?: object }} o
 */
export async function preparePostcard({ name, placeholder = '', scene = 'posta', seed, event = {} }) {
  const info = sceneNamed(scene), text = normaliseName(name);
  const { fontReady, FONT_WAIT_MS } = await import('../../type/index.js');
  const words = [event.stamp, event.place, event.dates, event.line, event.url].filter(Boolean).join(' ');
  // fontReady gives up on a face that fails, but a request that only stalls keeps it waiting for ever; a card is drawn
  // in the fallback face after a moment, and the page (mountPostcard) draws it again when the faces arrive
  let giveUp, timedOut = false; const t0 = performance.now(), late = new Promise(r => { giveUp = setTimeout(() => { timedOut = true; r(); }, FONT_WAIT_MS + 500); });
  await Promise.race([late, Promise.all([
    fontReady(fontOf('display', 100), text || placeholder || 'Name'),
    fontReady(fontOf('hand', 40), `Greetings from ${event.place ?? ''} ${event.line ?? ''}`),
    fontReady(fontOf('label', 30), words),
    fontReady(fontOf('body', 30), 'Make your own: susegad.asymmetrica.ai/postcard'),
  ])]);
  clearTimeout(giveUp);
  // the faces did not arrive in time (a stalled request, or fontReady's own wait ran out): the card is laid out in a fallback
  const fontsLate = timedOut || performance.now() - t0 >= FONT_WAIT_MS - 50;
  const L = layout({ name: text, placeholder, scene: info.name, blurb: info.blurb, seed, event, measure: canvasMeasure() });
  // a scene that cannot be loaded or opened is told apart from a card that cannot be drawn, so the page can say which
  let def, pic;
  try { def = (await info.load()).default; pic = openPicture(def, L.seed); } catch (e) { throw Object.assign(e instanceof Error ? e : new Error(String(e)), { phase: 'scene' }); }
  const start = startOf(def), motion = info.gif ?? null;
  const boxes = [];
  // A scene that has drawn its still (the card on the page) does not start moving cleanly afterwards: shet's picture
  // stays a bare mat for the rest of the run. So a card whose GIF is drawn live draws it in a second, fresh copy of
  // the scene, opened when the GIF first asks for a frame.
  let second = null;
  const motionPic = () => (motion ? (second ??= openPicture(def, L.seed)) : pic);

  /**
   * Everything but the picture, at `s` times the card's size, as steps: each `yield` is a place the drawing can stop
   * and let the page breathe. The inner picture area is left as the frame's mat.
   */
  function* baseSteps(g, s) {
    boxes.length = 0;
    g.save(); g.setTransform(s, 0, 0, s, 0, 0);
    paper(g, CARD.width, CARD.height, { base: PALETTE.paper, seed: 11, mottle: 0.035, grain: 0.015, fibers: 30, vignette: 0.06 });
    yield;
    const f = L.picture.frame, i = L.picture.inner;
    g.save(); g.shadowColor = 'rgba(43,33,24,.30)'; g.shadowBlur = 26; g.shadowOffsetY = 9; g.fillStyle = PALETTE.frame; g.fillRect(f.x, f.y, f.w, f.h); g.restore();
    g.fillStyle = '#d9cdb6'; g.fillRect(i.x, i.y, i.w, i.h);
    g.textBaseline = 'alphabetic';
    if (L.kicker) {
      g.font = fontOf('hand', L.kicker.size); g.fillStyle = PALETTE.laterite; g.textAlign = 'center'; g.direction = 'ltr';
      g.fillText(L.kicker.text, L.kicker.x, L.kicker.baseline);
      boxes.push(inkBox(g, L.kicker.text, L.kicker.x, L.kicker.baseline, { x: 0, y: 0, w: CARD.width, h: CARD.height }, 'kicker'));
    }
    g.font = fontOf('display', L.name.size); g.fillStyle = PALETTE.ink; g.textAlign = 'center'; g.direction = L.name.direction;
    // the placeholder is lighter than a name, so it reads as room waiting to be filled
    if (L.name.empty) g.globalAlpha = 0.3;
    for (const ln of L.name.lines) {
      g.fillText(ln.text, ln.x, ln.baseline);
      boxes.push(inkBox(g, ln.text, ln.x, ln.baseline, L.name.box, 'name'));
    }
    g.globalAlpha = 1; g.direction = 'ltr';
    yield;
    // the stamp, tilted a little, with the paper's shadow under it
    const { c, pad } = stampImage(L, s);
    g.save(); g.translate(L.stamp.x + L.stamp.w / 2, L.stamp.y + L.stamp.h / 2); g.rotate((L.stamp.rot * Math.PI) / 180);
    g.shadowColor = 'rgba(43,33,24,.28)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
    g.drawImage(c, -L.stamp.w / 2 - pad, -L.stamp.h / 2 - pad, c.width / s, c.height / s);
    g.restore();
    yield;
    postmarkInk(g, L);
    // the ruled lines, and the line written on them
    g.strokeStyle = PALETTE.rule; g.lineWidth = 2;
    g.beginPath(); g.moveTo(L.divider.x, L.divider.y0); g.lineTo(L.divider.x, L.divider.y1); g.stroke();
    for (const r of L.ruled) { g.beginPath(); g.moveTo(r.x0, r.y); g.lineTo(r.x1, r.y); g.stroke(); }
    if (L.eventLine) {
      g.font = fontOf('hand', L.eventLine.size); g.fillStyle = PALETTE.indigo; g.textAlign = 'left';
      for (const ln of L.eventLine.lines) { g.fillText(ln.text, ln.x, ln.baseline); boxes.push(inkBox(g, ln.text, ln.x, ln.baseline, { x: L.right.x, y: 600, w: L.right.w, h: 320 }, 'event')); }
    }
    g.font = fontOf('body', L.footer.size); g.fillStyle = PALETTE.soft; g.textAlign = L.footer.align;
    for (const ln of L.footer.lines) { g.fillText(ln.text, L.footer.x, ln.baseline); boxes.push(inkBox(g, ln.text, L.footer.x, ln.baseline, { x: L.right.x, y: 960, w: L.right.w, h: 168 }, 'footer')); }
    g.restore();
  }
  /** The base, all at once. */
  function paintBase(g, s = 1) { for (const _ of baseSteps(g, s)); }
  /** The base, with `await pause()` between its steps. */
  async function paintBaseSliced(g, s, pause) { for (const _ of baseSteps(g, s)) await pause(); }

  /** The picture into its mat on `g`, at scale `s`, cropped to fill the 3:2 mat. `src` is the scene's canvas. */
  function paintPicture(g, s, src) {
    const i = L.picture.inner, [sx, sy, sw, sh] = coverRect(src.width, src.height, i);
    g.save(); g.setTransform(s, 0, 0, s, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, sx, sy, sw, sh, i.x, i.y, i.w, i.h);
    g.restore();
  }

  /**
   * The scene's own still, settled. A renderer that paints in slices (shet, abri, tinto's board) does a slice per
   * render call and says when it has finished through its ready promise, so render until it does (at most 8 s), then once more.
   */
  async function still() {
    // a scene whose GIF starts live, at a moment of its own (posta: the clerk at the window), shows that moment on the
    // card too, so that the GIF's first frame is the picture on the PNG
    if (motion && !motion.warm && motion.from !== undefined) return motionPic().frame(motion.from, false);
    let done = !pic.ready?.then;
    pic.ready?.then(() => { done = true; });
    const t0 = performance.now();
    do { pic.frame(start, true); if (!done) await breathe(); } while (!done && performance.now() - t0 < 8000);
    return pic.frame(start, true);
  }

  /**
   * Live frames at the GIF's first moment, thrown away, for a scene that loads the code for its motion when it first
   * moves (shet fetches its turning year, then paints it in slices). Draws until the picture a second before `from` and at a third
   * of a second later differ, so the motion is really there, then until five frames in a row at `from` are the same,
   * so the slices are finished; `warm` is the most it will wait, in ms. A scene with no `gif.warm` is not warmed.
   */
  async function warm() {
    if (!motion?.warm) return;
    const t0 = performance.now(), end = motion.from ?? start, at = end - LEAD, probe = document.createElement('canvas'), pg = probe.getContext('2d', { willReadFrequently: true });
    probe.width = 48; probe.height = 32;
    const look = t => { pg.drawImage(motionPic().frame(t, false), 0, 0, 48, 32); return pg.getImageData(0, 0, 48, 32).data; };
    const differ = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return true; return false; };
    let moving = false, prev = null, same = 0;
    while (performance.now() - t0 < motion.warm) {
      await breathe();
      const now = look(at);
      if (!moving) { moving = differ(now, look(at + 0.3)); continue; }
      same = prev && !differ(now, prev) ? same + 1 : 0; prev = now;
      if (same >= 5) break;
    }
    // then run the clock up to the GIF's first moment, so a fade-in the scene does when its motion starts is over
    for (let t = at; t < end; t += 0.1) { motionPic().frame(t, false); await breathe(); }
    motionPic().frame(end, false);
    // and draw that first moment until the motion is live and settled. A scene fades its motion in over its first few
    // frames, and one that loads the code for its motion (shet) holds a bare, unchanging picture until it arrives: on a
    // slow or busy phone that takes many seconds. Quiet is not enough, since the bare picture is quiet too: the motion is
    // live when the picture a second on is not the picture now, and settled when the picture at `end` stops changing.
    const mean = (x, y) => { let t = 0; for (let i = 0; i < x.length; i += 4) t += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); return t / (x.length * 0.75); };
    const t1 = performance.now();
    let before = null, steady = 0;
    while (performance.now() - t1 < motion.warm && steady < 3) {
      await breathe();
      const now = look(end), later = look(end + 1);
      const live = mean(now, later) > 0.05;
      steady = live && before && mean(now, before) < 1.5 ? steady + 1 : 0; before = now;
    }
    motionPic().frame(end, false);
  }

  return {
    layout: L, def, info, start, motion, warm, boxes, alt: L.alt, seed: L.seed, fontsLate,
    paintBase, paintBaseSliced, paintPicture, frame: (t, still) => motionPic().frame(t, still), still, picture: pic,
    /** The finished still card on `canvas`, at `scale` times CARD. */
    async paint(canvas, scale = 1) {
      const src = await still(); // the picture first, so the canvas is never seen half done
      canvas.width = Math.round(CARD.width * scale); canvas.height = Math.round(CARD.height * scale);
      const g = canvas.getContext('2d');
      paintBase(g, scale);
      paintPicture(g, scale, src);
      return { boxes: boxes.slice(), layout: L };
    },
    destroy() { try { second?.destroy(); } finally { pic.destroy(); } },
  };
}

/** One card on one canvas, then let go of the scene. Resolves with its layout and the boxes of its ink. */
export async function drawPostcard(canvas, o) {
  const pc = await preparePostcard(o);
  try { return { ...(await pc.paint(canvas)), alt: pc.alt, seed: pc.seed }; } finally { pc.destroy(); }
}
