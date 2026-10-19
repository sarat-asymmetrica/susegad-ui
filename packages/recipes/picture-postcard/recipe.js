// Picture postcard: a typed name makes a postcard of Goa with a stamp and a postmark, in the browser, saved as a PNG
// or a three-second looping GIF, or handed to the share sheet. Nothing is sent anywhere: the card is drawn on a
// canvas on this device and the page makes no request of its own once it has loaded.
//
//   import { preparePostcard, exportPng, makeGif, deliver, mountPostcard } from './recipe.js';
//   const pc = await preparePostcard({ name: 'Asha Naik', scene: 'ferry', event: CONCLAVE_2026 });
//   const canvas = document.createElement('canvas'); await pc.paint(canvas);
//   const png = await exportPng(canvas, 'Asha Naik');                       // { blob, bytes, type, filename }
//   const gif = await makeGif(pc, { onProgress, signal });                   // chunked, cancellable, yields between frames
//   await deliver(png, { share: true });                                     // share sheet with the file, else a download

import { canvasToPng } from '../../export/png.js';
import { createHistogram, createIndexer, createGifEncoder } from '../../export/gif.stream.js';
import { preparePostcard, drawPostcard, breathe } from './postcard.draw.js';
import { CARD, MAKE_YOUR_OWN, NAME_MAX, coverRect, gifTimes, sniff, fileName, progressText, normaliseName, graphemes, fontOf, seedFor } from './postcard.core.js';
import { SCENES, DEFAULT_SCENE, sceneNamed, sceneForSeed } from './scenes.js';
import { WORDS, fill } from './words.js';
import { CONCLAVE_2026 } from './events/conclave-2026.js';
import { GOA_OCT_2026 } from './events/goa-oct-2026.js';

export { preparePostcard, drawPostcard, SCENES, DEFAULT_SCENE, sceneNamed, sceneForSeed, seedFor, normaliseName, WORDS, fill, CONCLAVE_2026, GOA_OCT_2026, CARD };

/** The GIF: 3 s at 10 fps, looping, half the card's size (900 by 600), under 4.8 MB so a messaging app takes it. */
export const GIF = Object.freeze({ fps: 10, seconds: 3, width: 900, budgetBytes: 4_800_000 });
// colours and dither to try in turn if a GIF comes out over budget; the first that fits is kept
const ATTEMPTS = [{ colors: 256, dither: 6 }, { colors: 128, dither: 4 }, { colors: 64, dither: 0 }, { colors: 32, dither: 0 }];

const aborted = () => new DOMException('Cancelled', 'AbortError');
const canvasOf = (w, h, read = false) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', read ? { willReadFrequently: true } : undefined)]; };

/** A card's PNG. The type is read from the bytes and the file is named after them. @param {HTMLCanvasElement} canvas */
export async function exportPng(canvas, name) {
  const blob = await canvasToPng(canvas), bytes = new Uint8Array(await blob.arrayBuffer());
  const type = sniff(bytes) ?? blob.type;
  return { blob, bytes, type, filename: fileName(name, type) };
}

/**
 * The card as a GIF: the picture moves for `seconds` seconds, the name, the stamp and the postmark stay still. The
 * first frame is the whole card, exactly the PNG's picture; every later frame is only the picture's rectangle, so the
 * still parts are neither redrawn nor encoded again. Work goes in steps with the page breathing between them,
 * `onProgress({ stage, done, total })` is called after each, and `signal` stops it at the next step (rejecting with
 * an AbortError). If the first pass comes out over `GIF.budgetBytes` it tries fewer colours until it fits.
 * @param {Awaited<ReturnType<typeof preparePostcard>>} pc
 * @param {{ fps?: number, seconds?: number, width?: number, onProgress?: (p: { stage: string, done: number, total: number }) => void, signal?: AbortSignal, name?: string }} [o]
 */
export async function makeGif(pc, { fps = GIF.fps, seconds = GIF.seconds, width = GIF.width, onProgress = () => {}, signal, name, trace } = {}) {
  const t0 = performance.now(), tick = (() => { let last = t0; return label => { const n = performance.now(); trace?.(label, Math.round(n - last)); last = n; }; })(), s = width / CARD.width, W = Math.round(CARD.width * s), H = Math.round(CARD.height * s);
  const I = pc.layout.picture.inner, ix = Math.round(I.x * s), iy = Math.round(I.y * s), iw = Math.round(I.w * s), ih = Math.round(I.h * s);
  const stop = () => { if (signal?.aborted) throw aborted(); };
  const live = !!pc.motion, times = gifTimes({ fps, seconds, start: pc.motion?.from ?? pc.start }), n = times.length, total = n * 2;
  stop();

  const [base, bg] = canvasOf(W, H); await pc.paintBaseSliced(bg, s, breathe); tick('paintBase');
  await breathe();
  const [full, fg] = canvasOf(W, H, true), [patch, pg] = canvasOf(iw, ih, true);
  fg.drawImage(base, 0, 0); tick('canvases');
  await pc.warm(); tick('warm');
  const hist = createHistogram(); // fed a frame at a time, so no one step has all the pixels to count
  let first = null; const patches = [];
  for (let i = 0; i < n; i++) {
    stop();
    const src = i === 0 && !live ? await pc.still() : pc.frame(times[i], false); tick(`frame${i}`);
    const [sx, sy, sw, sh] = coverRect(src.width, src.height, { w: iw, h: ih });
    pg.drawImage(src, sx, sy, sw, sh, 0, 0, iw, ih);
    if (i === 0) { fg.drawImage(patch, ix, iy); first = fg.getImageData(0, 0, W, H).data; hist.add(first); patches.push(null); }
    else { const px = pg.getImageData(0, 0, iw, ih).data; hist.add(px); patches.push(px); }
    tick(`read${i}`); onProgress({ stage: 'drawing', done: i + 1, total });
    await breathe();
  }

  let result = null;
  for (const a of ATTEMPTS) {
    stop();
    const palette = hist.palette(a.colors); tick('palette');
    await breathe();
    const enc = createGifEncoder({ width: W, height: H, palette }), indexer = createIndexer(palette, { dither: a.dither }), firstIdx = await indexer.indexSliced(first, W, breathe);
    tick('index0');
    await enc.addFrameSliced(firstIdx, 1000 / fps, undefined, breathe, 120_000); tick('add0');
    onProgress({ stage: 'encoding', done: n + 1, total });
    await breathe();
    for (let i = 1; i < n; i++) {
      stop();
      enc.addFrame(indexer.index(patches[i], iw), 1000 / fps, { x: ix, y: iy, w: iw, h: ih }); tick(`enc${i}`);
      onProgress({ stage: 'encoding', done: n + i + 1, total });
      await breathe();
    }
    const bytes = enc.finish();
    result = { bytes, colors: a.colors, dither: a.dither };
    if (bytes.length <= GIF.budgetBytes) break;
  }
  const { bytes } = result, type = sniff(bytes) ?? 'image/gif';
  return { blob: new Blob([bytes], { type }), bytes, type, filename: fileName(name ?? pc.layout.name.text, type), frames: n, width: W, height: H, colors: result.colors, ms: Math.round(performance.now() - t0), withinBudget: bytes.length <= GIF.budgetBytes };
}

/**
 * Hand a made file to the person: the share sheet with the file where this browser can share files, else a download.
 * Resolves 'shared', 'downloaded' (a save), 'fell-back' (a share that became a download, because the browser cannot
 * share files or refused) or 'cancelled' (the person closed the share sheet).
 * @param {{ blob: Blob, type: string, filename: string }} out @param {{ share?: boolean, title?: string, text?: string }} [o]
 */
export async function deliver(out, { share = false, title = '', text = '' } = {}) {
  if (share) {
    const file = new File([out.blob], out.filename, { type: out.type });
    if (typeof navigator.canShare === 'function' && typeof navigator.share === 'function' && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title, ...(text ? { text } : {}) }); return 'shared'; }
      catch (e) { if (e?.name === 'AbortError') return 'cancelled'; /* any other failure: fall through to the download */ }
    }
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(out.blob), download: out.filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return share ? 'fell-back' : 'downloaded';
}

/** A card's bytes as a hex SHA-256, to tell two cards apart or show they are the same. */
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

const kb = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Wire the maker. Elements by id: `#name`, `#scene` (a select, or any element with a `value` that fires `change`, such
 * as a hidden input behind a picker of the page's own), `#card` (a canvas), `#save-png`, `#save-gif`, `#share-png`,
 * `#share-gif`, `#cancel`, `#progress`, `#status` (a live region), `#gif-preview` (an img) and `#maker`; and, if the
 * page has them, `#gif-note` (said when the scene is a still) and `#motion-note` (said under reduced motion).
 * Redraws as the person types after a short pause. An empty name draws the lighter "Your name" and the alt text says
 * there is room for one; Save and Share then nudge the person to the field and make nothing. Returns the first draw's promise.
 * @param {{ event?: object, words?: Partial<typeof WORDS> }} [o]
 */
export function mountPostcard(root = document, { event = CONCLAVE_2026, words = {} } = {}) {
  const say_ = { ...WORDS, ...words };
  const $ = id => root.querySelector(`#${id}`);
  const canvas = $('card'), nameEl = $('name'), sceneEl = $('scene'), status = $('status'), progress = $('progress'), cancel = $('cancel'), gifImg = $('gif-preview');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const buttons = ['save-png', 'save-gif', 'share-png', 'share-gif'].map($);
  let timer = 0, dirty = true, token = 0, current = null, controller = null, gifUrl = null, fontsWaiting = false, lateTried = false;
  const say = text => { status.textContent = text; };
  const t = (key, vars) => fill(say_[key], vars);
  const labelOf = name => sceneNamed(name).label ?? sceneNamed(name).blurb;

  if (sceneEl instanceof HTMLSelectElement) sceneEl.replaceChildren(...SCENES.map(s => Object.assign(document.createElement('option'), { value: s.name, textContent: s.label ?? s.blurb })));

  // redraws run one after another, so two scenes are never open at once and the last one asked for wins
  let drawing = Promise.resolve();
  const redraw = () => (drawing = drawing.then(run, run));
  // the faces the card is lettered in, ready or not: false when the name, the kicker or the footer would be laid out in a fallback
  const lettered = pc => { try { return document.fonts.check(fontOf('display', 100), pc.layout.name.text || say_.emptyCard) && document.fonts.check(fontOf('hand', 40), pc.layout.kicker?.text ?? '') && document.fonts.check(fontOf('body', 30), MAKE_YOUR_OWN.url); } catch { return true; } };
  async function run() {
    dirty = false; const mine = ++token, typed = nameEl.value, name = normaliseName(typed), scene = sceneEl.value;
    syncGif();
    const tooLong = graphemes(typed.replace(/\s+/g, ' ').trim()).length > NAME_MAX;
    if (tooLong) say(t('nameCut', { max: NAME_MAX })); else if (status.textContent === t('nameCut', { max: NAME_MAX })) say('');
    const pc = await preparePostcard({ name, placeholder: say_.emptyCard, scene, event });
    if (mine !== token) { pc.destroy(); return; }
    const done = await pc.paint(canvas);
    if (mine !== token) { pc.destroy(); return; }
    current?.pc.destroy();
    current = { pc, name, scene, boxes: done.boxes };
    canvas.setAttribute('aria-label', pc.alt);
    // fonts that arrive after the card was laid out: say so, and draw once more when they have
    // (once: a face that never comes would otherwise be waited for, and drawn again, for ever)
    if ((pc.fontsLate || !lettered(pc)) && !fontsWaiting && !lateTried) {
      fontsWaiting = lateTried = true; say(t('errFonts'));
      document.fonts.ready.then(() => { fontsWaiting = false; if (status.textContent === t('errFonts')) say(''); redraw().catch(drawFailed); });
    } else if (!pc.fontsLate && lettered(pc) && status.textContent === t('errFonts') && !fontsWaiting) say('');
  }
  const drawFailed = e => say(e?.phase === 'scene' ? t('errScene') : t('errDraw'));
  // a scene that does not move has no GIF to offer, and under reduced motion the GIF is saved but not played
  function syncGif() {
    const still = !!sceneNamed(sceneEl.value).still, note = $('gif-note');
    for (const id of ['save-gif', 'share-gif']) $(id).disabled = still;
    if (note) { note.textContent = still ? t('gifStill') : ''; note.hidden = !still; }
    const m = $('motion-note'); if (m) { m.textContent = reduced.matches ? t('reducedMotion') : ''; m.hidden = !reduced.matches; }
  }
  sceneEl.addEventListener('change', () => { syncGif(); say(t('sceneChanged', { scene: labelOf(sceneEl.value) })); });
  reduced.addEventListener?.('change', syncGif);
  const queue = () => { dirty = true; clearTimeout(timer); timer = setTimeout(() => redraw().catch(drawFailed), 300); };
  nameEl.addEventListener('input', queue); sceneEl.addEventListener('change', queue);
  $('maker').addEventListener('submit', e => e.preventDefault()); // Enter in the name field makes no request

  const settle = async () => { clearTimeout(timer); if (dirty || !current) redraw().catch(drawFailed); await drawing; return current; };
  // Save and Share need a name: with none, move to the field and say so. A nudge, not an error.
  const named = async () => {
    if (!normaliseName(nameEl.value)) { say(t('emptyTry')); nameEl.focus(); return null; }
    return settle();
  };
  const shareWords = c => ({ title: t('shareTitle', { name: c.name }), text: t('shareText', { name: c.name, stamp: event.stamp ?? '', url: MAKE_YOUR_OWN.url }) });
  const said = (how, out, kind) => {
    const gif = kind === 'gif', vars = { filename: out.filename, size: kb(out.blob.size) };
    if (how === 'cancelled') return t('shareCancelled');
    if (how === 'shared') return t(gif ? 'sharedGif' : 'shared', vars);
    if (how === 'fell-back') return `${t('shareFallback')} ${t(gif ? 'savedGif' : 'saved', vars)}`;
    return `${t(gif ? 'savedGif' : 'saved', vars)} ${t('savedWhere')}`;
  };

  async function png(share) {
    const c = await named(); if (!c) return null;
    try {
      const out = await exportPng(canvas, c.name);
      const how = await deliver(out, { share, ...shareWords(c) });
      say(said(how, out, 'png'));
      // tells the page what was made, so it can show the picture (press and hold)
      $('maker').dispatchEvent(new CustomEvent('postcard-made', { bubbles: true, detail: { out, how, share } }));
      return out;
    } catch { say(t('pngFailed')); return null; }
  }

  async function gif(share) {
    const c = await named(); if (!c) return null;
    controller = new AbortController();
    const busy = on => {
      for (const b of buttons) b.disabled = on;
      nameEl.disabled = on; if ('disabled' in sceneEl) sceneEl.disabled = on;
      root.querySelectorAll('[data-scene-picker] button, [data-scene-picker] input').forEach(b => { b.disabled = on; });
      progress.hidden = cancel.hidden = !on; if (!on) syncGif();
    };
    busy(true); cancel.focus(); progress.value = 0; let announced = -1; say(t('gifStart'));
    try {
      const out = await makeGif(c.pc, {
        name: c.name, signal: controller.signal,
        onProgress: ({ stage, done, total }) => {
          progress.value = done / total;
          const step = Math.floor((100 * done) / total / 25);
          if (step !== announced) { announced = step; say(progressText(stage, done, total, { drawing: say_.gifDrawing, encoding: say_.gifEncoding })); }
        },
      });
      if (gifUrl) URL.revokeObjectURL(gifUrl);
      busy(false);
      if (!reduced.matches) { gifUrl = URL.createObjectURL(out.blob); gifImg.src = gifUrl; gifImg.alt = `${c.pc.alt} Moving.`; gifImg.hidden = false; }
      const how = await deliver(out, { share, ...shareWords(c) });
      say(`${said(how, out, 'gif')}${out.withinBudget ? '' : ` ${t('gifLarge', { size: kb(out.blob.size) })}`}`);
      buttons[share ? 3 : 1].focus();
      return out;
    } catch (e) {
      busy(false); buttons[share ? 3 : 1].focus();
      say(e?.name === 'AbortError' ? t('gifCancelled') : t('gifFailed'));
      if (e?.name !== 'AbortError') throw e;
      return null;
    } finally { controller = null; }
  }

  $('save-png').addEventListener('click', () => png(false));
  $('share-png').addEventListener('click', () => png(true));
  $('save-gif').addEventListener('click', () => gif(false).catch(() => {}));
  $('share-gif').addEventListener('click', () => gif(true).catch(() => {}));
  cancel.addEventListener('click', () => controller?.abort());
  progress.hidden = cancel.hidden = true; gifImg.hidden = true; syncGif();
  return redraw();
}

