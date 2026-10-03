// webm.js: a canvas to WebM, one frame at a time. `canvas.captureStream(0)`
// takes no automatic frames; the caller paints a frame and calls
// `track.requestFrame()` to hand it to the recorder. MediaRecorder times
// each frame by the wall clock at the moment it was requested, not by any
// number we pass it, so getting the right *duration* means actually pacing
// the requests one `1000 / fps` apart in real time (a plain `setTimeout`
// loop, not a spin). What stays reproducible, seed to seed and machine to
// machine, is the *content* of each frame: every frame is painted from the
// model at its own fixed virtual time `i / fps`, never the wall clock, so
// the pixels are the same on a fast machine and a loaded one — only how
// long each one waited to be handed to the recorder differs, and that
// doesn't touch what ends up in the pixels.

const CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

/** The best WebM codec this browser's MediaRecorder supports, or null if none. */
export function pickWebmMimeType() {
  for (const t of CANDIDATES) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) return t;
  return null;
}

/**
 * Record `frames` calls to `draw(time, i, frames)` (each paints `canvas` for
 * that frame) into a WebM Blob, at `fps`. `draw` may be async; the recorder
 * waits for it before requesting the frame, so slow paints never drop a beat.
 * @param {HTMLCanvasElement} canvas
 * @param {{ fps?: number, durationSec?: number, draw: (t: number, i: number, frames: number) => void | Promise<void>,
 *   mimeType?: string, videoBitsPerSecond?: number }} opts
 * @returns {Promise<Blob>}
 */
export async function recordCanvasToWebm(canvas, { fps = 30, durationSec = 3, draw, mimeType, videoBitsPerSecond } = {}) {
  if (typeof MediaRecorder === 'undefined') throw new Error('recordCanvasToWebm: this browser has no MediaRecorder');
  const type = mimeType || pickWebmMimeType();
  if (!type) throw new Error('recordCanvasToWebm: no supported WebM codec');
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: type, ...(videoBitsPerSecond ? { videoBitsPerSecond } : {}) });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve, reject) => {
    rec.onstop = () => resolve();
    rec.onerror = e => reject(e.error instanceof Error ? e.error : new Error('MediaRecorder error'));
  });
  rec.start();
  const frames = Math.max(1, Math.round(fps * durationSec));
  const frameMs = 1000 / fps;
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) {
    await draw(i / fps, i, frames);
    track.requestFrame();
    // Pace to real time so the recording's duration matches durationSec: a
    // MediaRecorder frame's timestamp is when it was requested, not the
    // virtual time draw() painted it at. Wait out whatever's left of this
    // frame's slot; a slow draw() just eats into the wait, never queues up.
    const wait = t0 + (i + 1) * frameMs - performance.now();
    await new Promise(r => setTimeout(r, Math.max(0, wait)));
  }
  rec.stop();
  await stopped;
  return new Blob(chunks, { type });
}

/**
 * Record a Susegad scene definition (as `defineScene` returns; `paus/index.js`'s
 * default export, for example) to WebM, by calling its pure `model()` and
 * `createRenderer()` directly at fixed, evenly-spaced times — never the
 * scene's own wall-clock loop — so the export is reproducible.
 * @param {import('../core/define-scene.js').SceneDef} def
 * @param {{ seed?: number|string, register?: 'quiet'|'warm'|'playful', params?: object,
 *   fps?: number, durationSec?: number, startSec?: number, mimeType?: string, videoBitsPerSecond?: number }} [opts]
 *   `startSec` is the scene time the first frame is drawn at (default 0).
 *   Recorded at the scene's own logical size (the canvas `stage()` draws);
 *   downscale after the fact if a smaller file is wanted.
 * @returns {Promise<Blob>}
 */
export async function recordSceneToWebm(def, opts = {}) {
  const { seed = def.meta.seed ?? 1, register = 'warm', params = {}, fps = 24, durationSec = 3, mimeType, videoBitsPerSecond, startSec = 0 } = opts;
  const { W, H } = def.meta;
  const motion = register === 'quiet' ? 'state' : register === 'playful' ? 'full' : 'ambient';
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:' + W + 'px;height:' + H + 'px';
  document.body.appendChild(host);
  const governor = { level: 1 };
  const renderer = def.createRenderer(host, { W, H, register, motion, seed, governor, invalidate() {}, advance() {} });
  const canvas = host.querySelector('canvas');
  if (!canvas) { renderer.destroy(); host.remove(); throw new Error(`recordSceneToWebm: ${def.name} drew no canvas (an SVG scene needs its own exporter)`); }
  try {
    return await recordCanvasToWebm(canvas, {
      fps, durationSec, mimeType, videoBitsPerSecond,
      draw(t0) {
        const t = t0 + startSec;
        const data = def.model({ time: t, seed, register, params, W, H });
        renderer.render(data, { time: t, dt: 1 / fps, calm: [], pointer: { x: 0, y: 0, inside: false, down: false, keyboard: false }, quality: 1, still: false, epoch: 0, register, motion });
      },
    });
  } finally {
    renderer.destroy();
    host.remove();
  }
}
