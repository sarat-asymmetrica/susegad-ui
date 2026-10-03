// The browser side of tools/strip.mjs and tools/onion.mjs, kept thin: take frames, then hand the
// pixels to the pure maths in strip.mjs (which runs inside the tools' own workspace page, as
// diff.mjs does with pixeldiff.mjs). Everything that decides anything lives in strip.mjs.
//
// Two ways to take frames:
//
//  - stepped (a scene on the harness): the page loads with ?freeze=<well past the last frame> and
//    every rAF loop is held when the scene fires sg-ready. The tool plays the clock by hand, one
//    1/60 s tick per __tools.step, so a frame at 40 s costs the time to draw 2400 frames, not 40 s of waiting,
//    and the same seed gives the same frames. Times are the harness clock's own (seconds since
//    the scene mounted); the first cell can be no earlier than the scene's own sg-ready.
//  - real (a page by --url, or a scene with --real): one page load, cells taken at wall-clock
//    times. Pages have no harness clock; --real on a scene is also the control that shows what
//    the frozen clock buys, because two real strips are never the same twice.

import { openTarget, waitReady, shoot } from './browser.mjs';
import { frameOf, timeOf } from './strip.mjs';

const CHUNK = 240; // frames per evaluate, so no single call holds the page for long

const playingOf = page => page.evaluate(() => {
  const p = window.__piece;
  return p && 'playing' in p ? !!p.playing : null;
});

/**
 * @param {Awaited<ReturnType<typeof import('./browser.mjs').session>>} s
 * @param {object} t the target (target.mjs)
 * @param {{ width: number, height: number, dpr?: number, touch?: boolean, reduced?: boolean }} view
 * @param {number[]} times seconds
 * @param {{ selector?: string|null, real?: boolean }} o
 * @returns {Promise<{ ok: boolean, reason?: string, clock: 'frozen'|'real', cells: { at: number, t: number, frame: number|null, playing: boolean|null, png: Buffer }[], log: any, url: string, notes: string[] }>}
 */
export async function captureFrames(s, t, view, times, { selector = t.scene ? '#box' : null, real = false } = {}) {
  const stepped = !!t.scene && !real;
  const notes = [];
  const cells = [];
  const target = stepped ? { ...t, freeze: Math.ceil(times[times.length - 1]) + 2 } : { ...t, freeze: undefined };
  const { context, page, log, url } = await openTarget(s, target, { ...view, holdAtReady: stepped });
  const finish = async (ok, reason) => {
    const anim = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length).catch(() => 0);
    if (anim) notes.push(`${anim} Web Animation(s) were running; they follow the real clock, not the stepped one, so frames that show them will not repeat`);
    await context.close();
    return { ok, reason, clock: stepped ? 'frozen' : 'real', cells, log, url, notes };
  };
  try {
    if (!stepped) {
      const ready = await waitReady(page, t);
      if (!ready.ok) return await finish(false, ready.reason);
      const start = Date.now();
      for (const at of times) {
        const wait = at * 1000 - (Date.now() - start);
        if (wait > 0) await page.waitForTimeout(wait);
        const measured = (Date.now() - start) / 1000;
        const png = await shoot(page, selector, null);
        cells.push({ at, t: measured, frame: null, playing: await playingOf(page), png });
      }
      return await finish(true);
    }

    // The page loads as it normally would and is held at the scene's own sg-ready (see openTarget's
    // holdAtReady), so what happens before the first frame is the harness's, unchanged. Wait in real
    // time, with interval polling because rAF polling would be held too.
    await page.waitForFunction(() => window.__error || window.__tools.held, null, { timeout: 60000, polling: 50 }).catch(() => {});
    const failed = await page.evaluate(() => window.__error || null);
    if (failed) return await finish(false, failed);
    if (!(await page.evaluate(() => window.__tools.held))) return await finish(false, 'the scene never fired sg-ready');
    // Let everything the scene loads in real time (lazily imported add-ons such as the movable
    // glass, fonts) finish while the clock stands still. Otherwise how many frames pass before a
    // late module attaches depends on the network's timing, and two runs differ.
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 10000, polling: 50 }).catch(() => {});
    const bad = await page.evaluate(() => window.__error || null);
    if (bad) return await finish(false, bad);

    for (const at of times) {
      const want = frameOf(at);
      let have = await page.evaluate(() => window.__clock.frames);
      while (have < want) {
        const n = Math.min(CHUNK, want - have);
        await page.evaluate(k => window.__tools.step(k), n);
        have += n;
      }
      const png = await shoot(page, selector, null);
      const now = await page.evaluate(() => window.__clock.frames);
      cells.push({ at, t: timeOf(now), frame: now, playing: await playingOf(page), png });
      if (now > want) notes.push(`${at.toFixed(2)} s had already passed when the scene became ready; that cell shows ${timeOf(now).toFixed(2)} s`);
    }
    return await finish(true);
  } catch (e) {
    await context.close().catch(() => {});
    throw e;
  }
}

const b64 = buf => buf.toString('base64');

/**
 * A page in the tools' workspace that holds the decoded frames and does the pixel work.
 * @param {Awaited<ReturnType<typeof import('./browser.mjs').session>>} s
 */
export async function openWork(s) {
  const context = await s.browser.newContext();
  const page = await context.newPage();
  await page.goto(`${s.base}/tools/harness/blank.html`);
  return {
    /** Decode the PNGs, keep them, and return each cell's luminance and change against the cell before. */
    load(pngs, threshold) {
      return page.evaluate(async ({ list, threshold }) => {
        const S = await import('/tools/lib/strip.mjs');
        const frames = [];
        for (const b of list) {
          const blob = await (await fetch(`data:image/png;base64,${b}`)).blob();
          const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
          const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(bmp, 0, 0);
          const d = g.getImageData(0, 0, bmp.width, bmp.height);
          frames.push({ bitmap: bmp, data: d.data, width: bmp.width, height: bmp.height });
        }
        const { width, height } = frames[0];
        if (frames.some(f => f.width !== width || f.height !== height)) {
          return { error: `frames differ in size: ${frames.map(f => `${f.width}x${f.height}`).join(', ')}` };
        }
        window.__frames = frames;
        return { width, height, cells: S.analyseFrames(frames, width, height, { threshold }) };
      }, { list: pngs.map(b64), threshold });
    },
    /** The contact sheet: layout and text come from strip.mjs, drawing is all this does. */
    strip(spec) {
      return page.evaluate(async spec => {
        const { layout, header, labels, marks } = spec;
        const c = new OffscreenCanvas(layout.width, layout.height), g = c.getContext('2d');
        g.fillStyle = '#f4efe4'; g.fillRect(0, 0, layout.width, layout.height);
        g.textBaseline = 'top';
        g.font = '600 13px ui-monospace, Consolas, monospace';
        g.fillStyle = '#1d2742';
        header.forEach((line, i) => { g.font = `${i ? 400 : 600} 13px ui-monospace, Consolas, monospace`; g.fillStyle = i ? '#5d6378' : '#1d2742'; g.fillText(line, layout.header.x, layout.header.y + i * layout.header.lineH); });
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        layout.cells.forEach((cell, i) => {
          const r = cell.image;
          g.font = '400 12px ui-monospace, Consolas, monospace';
          g.fillStyle = marks[i] ? '#b8412a' : '#1d2742';
          g.fillText(labels[i], cell.label.x, cell.label.y + 4);
          g.drawImage(window.__frames[i].bitmap, r.x, r.y, r.w, r.h);
          g.lineWidth = marks[i] ? 3 : 1;
          g.strokeStyle = marks[i] ? '#b8412a' : '#d9d1c0';
          g.strokeRect(r.x - (marks[i] ? 1.5 : 0.5), r.y - (marks[i] ? 1.5 : 0.5), r.w + (marks[i] ? 3 : 1), r.h + (marks[i] ? 3 : 1));
          if (marks[i]) {
            g.font = '600 12px ui-monospace, Consolas, monospace';
            g.textAlign = 'right';
            g.fillText(marks[i], cell.label.x + cell.label.w, cell.label.y + 4);
            g.textAlign = 'left';
          }
        });
        return toPng(c);
        async function toPng(cv) {
          const buf = new Uint8Array(await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer());
          let bin = '';
          for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          return btoa(bin);
        }
      }, spec).then(b => Buffer.from(b, 'base64'));
    },
    /** The onion (or, with diff, only what changes) under its header. */
    onion(spec) {
      return page.evaluate(async spec => {
        const S = await import('/tools/lib/strip.mjs');
        const { layout, header, diff, threshold } = spec;
        const frames = window.__frames, { width, height } = frames[0];
        const alphas = S.onionAlphas(frames.length);
        const pixels = diff
          ? S.onionDiff(frames, width, height, alphas, threshold)
          : S.onionBlend(frames, S.medianFrame(frames, width, height), width, height, alphas, threshold);
        const c = new OffscreenCanvas(layout.width, layout.height), g = c.getContext('2d');
        g.fillStyle = '#f4efe4'; g.fillRect(0, 0, layout.width, layout.height);
        g.textBaseline = 'top';
        header.forEach((line, i) => { g.font = `${i ? 400 : 600} 13px ui-monospace, Consolas, monospace`; g.fillStyle = i ? '#5d6378' : '#1d2742'; g.fillText(line, layout.header.x, layout.header.y + i * layout.header.lineH); });
        g.putImageData(new ImageData(pixels, width, height), layout.image.x, layout.image.y);
        const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return btoa(bin);
      }, spec).then(b => Buffer.from(b, 'base64'));
    },
    close: () => context.close(),
  };
}
