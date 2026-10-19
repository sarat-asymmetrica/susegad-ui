// The postcard scene survey: every candidate scene drawn as a 3:2 picture in Chromium and WebKit,
// with a pixel-difference metric between the engines, a per-frame cost, and a contact sheet.
//
//   node tools/postcard-scenes.mjs                 (all candidates, both engines)
//   node tools/postcard-scenes.mjs ferry posta     (only these)
//
// Candidates: registry motif.tier everyday or regional, plus shet (tier scape). The picture area is
// 900 x 600 CSS px at scale 2 (1800 x 1200). A scene whose own ratio is not 3:2 is cover-cropped, the
// way a postcard picture box would show it. Frames are driven like packages/export/gif.js
// recordSceneToGif: model() and render() at fixed times, 10 fps, so a frame at 1.5 s is the 16th frame of a
// GIF. Stills render at meta.stillTime with still:true.
//
// Writes .shots/postcard-scenes/ (PNGs per scene and engine, contact sheets) and survey.json, which
// docs/runs/postcard/scene-survey.md is written from. Browsers come through tools/lib/engine.mjs and a
// machine-wide slot, one engine at a time.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { pickEngine, launchArgs, contextOptions } from './lib/engine.mjs';
import { acquireSlot } from './lib/slots.mjs';
import { pixelDistance } from './lib/pixeldiff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.shots', 'postcard-scenes');
const CW = 900, CH = 600, SCALE = 2, TIMES = [0, 1.5, 3], FPS = 10, COST_FRAMES = 30, SCENE_LIMIT = 150000;
const only = process.argv.slice(2);

function candidates() {
  const dir = path.join(ROOT, 'packages', 'scenes');
  const list = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const f = path.join(dir, name, 'registry.json');
    if (!fs.existsSync(f)) continue;
    const r = JSON.parse(fs.readFileSync(f, 'utf8'));
    const tier = r.motif?.tier ?? '-';
    if (r.tier === 'scape' && name !== 'shet') continue; // veranda: scape, not asked for
    if (!(tier === 'everyday' || tier === 'regional' || name === 'shet')) continue;
    if (only.length && !only.includes(name)) continue;
    const src = fs.readdirSync(path.join(dir, name)).filter(x => x.endsWith('.js') && !x.includes('.test.')).map(x => fs.readFileSync(path.join(dir, name, x), 'utf8')).join('\n');
    list.push({ name, tier: r.tier ? `${r.tier} (motif ${tier})` : tier, filter: /ctx\.filter|\.filter\s*=/.test(src) });
  }
  return list;
}

// Runs in the page. Returns PNG/JPEG data URLs and raw RGBA (base64) for the two diff frames, plus costs.
const PAGE = async ({ url, CW, CH, SCALE, TIMES, FPS, COST_FRAMES }) => {
  const { default: def } = await import(url);
  await document.fonts.ready;
  const { W, H } = def.meta;
  const seed = def.meta.seed ?? 1;
  const register = 'warm', motion = 'ambient';
  const params = {};
  const out = { W, H, stillTime: def.meta.stillTime ?? 0, errors: [] };
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:-99999px';
  document.body.appendChild(host);
  const target = document.createElement('canvas');
  target.width = CW * SCALE; target.height = CH * SCALE;
  const g = target.getContext('2d', { willReadFrequently: true });
  const fit = src => {
    // cover-crop to 3:2
    const sw = src.width, sh = src.height, want = CW / CH;
    let cw = sw, ch = sh;
    if (sw / sh > want) cw = sh * want; else ch = sw / want;
    g.fillStyle = '#fff'; g.fillRect(0, 0, target.width, target.height);
    g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, target.width, target.height);
  };
  const b64 = () => {
    const d = g.getImageData(0, 0, target.width, target.height).data;
    let s = ''; const step = 0x8000;
    for (let i = 0; i < d.length; i += step) s += String.fromCharCode.apply(null, d.subarray(i, i + step));
    return btoa(s);
  };
  const thumb = () => {
    const t = document.createElement('canvas'); t.width = 360; t.height = 240;
    t.getContext('2d').drawImage(target, 0, 0, 360, 240);
    return t.toDataURL('image/jpeg', 0.85);
  };
  // `src` is the scene's canvas, or its inline <svg> (vel and other DOM scenes), which is serialised and decoded
  // as an image so both kinds go through the same crop. The decode is part of the SVG scene's frame cost.
  const raster = async src => {
    if (src instanceof HTMLCanvasElement) return src;
    const box = src.getBoundingClientRect();
    const vb = src.viewBox?.baseVal;
    const w = Math.round(vb?.width || box.width), h = Math.round(vb?.height || box.height);
    const clone = src.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', w * SCALE); clone.setAttribute('height', h * SCALE);
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    try { await img.decode(); } finally { URL.revokeObjectURL(img.src); }
    return img;
  };
  const frame = async (renderer, src, t, still) => {
    const data = def.model({ time: t, seed, register, params, W, H });
    renderer.render(data, { time: t, dt: 1 / FPS, calm: [], pointer: { x: 0, y: 0, inside: false, down: false, keyboard: false }, quality: 1, still, epoch: 0, register, motion });
    const drawn = await raster(src);
    fit(drawn);
    g.getImageData(0, 0, 1, 1); // make the rasteriser finish inside the span
  };
  // A renderer that paints in time slices builds a little on each render() call and resolves `ready` when it
  // is done; the element keeps drawing (invalidate, then the loop) until sg-ready fires. So do the same: draw
  // the first frame at (t, still) over and over, yielding between draws, until ready resolves.
  const make = async (t, still) => {
    const governor = { level: 1 };
    // Sized the way the element's stage is: the picture box's width, the scene's own aspect ratio. A host with
    // no width makes a canvas that sizes itself from its box grow without end (Chromium hangs, WebKit overflows).
    const el = document.createElement('div');
    el.style.cssText = `position:relative;width:${CW}px;aspect-ratio:${W}/${H}`;
    host.appendChild(el);
    const renderer = def.createRenderer(el, { W, H, register, motion, seed, governor, invalidate() {}, advance() {} });
    const src = el.querySelector('canvas') ?? el.querySelector('svg');
    if (!src) throw new Error('drew no canvas or svg');
    let readyMs = 0;
    if (typeof renderer.ready?.then === 'function') {
      let state = 'pending';
      renderer.ready.then(() => { state = 'ok'; }, () => { state = 'rejected'; });
      const t0 = performance.now();
      while (state === 'pending' && performance.now() - t0 < 30000) {
        await frame(renderer, src, t, still);
        await new Promise(r => setTimeout(r, 0));
      }
      readyMs = performance.now() - t0;
      if (state !== 'ok') out.errors.push(`renderer.ready ${state === 'pending' ? 'did not resolve in 30 s of drawing' : 'rejected'}`);
      out.readyMs = Math.max(out.readyMs ?? 0, readyMs);
    }
    return { renderer, src, el };
  };
  const dataOf = () => ({ png: target.toDataURL('image/png'), thumb: thumb() });
  try {
    // the still
    console.log('phase still');
    {
      const { renderer, src, el } = await make(out.stillTime, true);
      await frame(renderer, src, out.stillTime, true);
      out.still = dataOf(); out.stillRaw = b64();
      renderer.destroy(); el.remove();
    }
    console.log('phase moving');
    // the moving version: frames at 10 fps in order, kept at the three time points, and timed
    {
      const { renderer, src, el } = await make(0, false);
      out.moving = [];
      const times = [];
      const lastFrame = Math.round(TIMES[TIMES.length - 1] * FPS);
      const keep = new Map(TIMES.map(t => [Math.round(t * FPS), t]));
      for (let i = 0; i <= Math.max(lastFrame, COST_FRAMES - 1); i++) {
        const t0 = performance.now();
        await frame(renderer, src, i / FPS, false);
        times.push(performance.now() - t0);
        if (i % 5 === 0) console.log('frame', i, times[i].toFixed(0), 'ms');
        if (keep.has(i)) { out.moving.push({ t: keep.get(i), ...dataOf() }); if (keep.get(i) === 1.5) out.midRaw = b64(); }
      }
      out.frameMs = times.slice(0, COST_FRAMES);
      renderer.destroy(); el.remove();
    }
  } catch (e) { out.errors.push(e instanceof Error ? String(e.stack || e.message || e) : `thrown ${typeof e}: ${JSON.stringify(e) ?? String(e)}`); }
  host.remove();
  return out;
};

const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const cpuTimes = () => os.cpus().reduce((a, c) => { for (const k in c.times) a[k === 'idle' ? 'idle' : 'busy'] += c.times[k]; return a; }, { idle: 0, busy: 0 });
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

async function runEngine(engine, list, server) {
  const release = await acquireSlot({ label: `postcard-scenes ${engine}` });
  const browser = await pickEngine(engine).launch({ args: launchArgs(engine, []) });
  const res = {};
  try {
    const context = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 }));
    for (const s of list) {
      const page = await context.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e)));
      if (process.env.SG_DEBUG) page.on('console', m => console.log('   page:', m.text()));
      await page.goto(`${server.url}/tools/harness/blank.html`);
      console.log(`  ${engine} ${s.name} ...`);
      const c0 = cpuTimes();
      let r;
      try {
        // A watchdog: a scene stuck in a synchronous loop would otherwise hold the run (and the slot) for ever.
        let dog;
        const stuck = new Promise((_, no) => { dog = setTimeout(() => no(new Error(`no answer in ${SCENE_LIMIT / 1000} s (page stuck)`)), SCENE_LIMIT); });
        try { r = await Promise.race([page.evaluate(PAGE, { url: `${server.url}/packages/scenes/${s.name}/index.js`, CW, CH, SCALE, TIMES, FPS, COST_FRAMES }), stuck]); }
        finally { clearTimeout(dog); }
      } catch (e) { r = { errors: [String(e.message || e)] }; }
      const c1 = cpuTimes();
      r.cpuBusy = (c1.busy - c0.busy) / ((c1.busy - c0.busy) + (c1.idle - c0.idle));
      if (errs.length) (r.errors ??= []).push(...errs);
      const dir = path.join(OUT, engine);
      fs.mkdirSync(dir, { recursive: true });
      if (r.still) {
        save(path.join(dir, `${s.name}-still.png`), r.still.png);
        for (const m of r.moving ?? []) save(path.join(dir, `${s.name}-t${m.t}.png`), m.png);
      }
      res[s.name] = r;
      console.log(`${engine.padEnd(8)} ${s.name.padEnd(9)} ${r.errors?.length ? 'ERR ' + r.errors[0].split('\n')[0] : `median ${median(r.frameMs)?.toFixed(1)} ms, ready ${(r.readyMs ?? 0).toFixed(0)} ms, cpu ${(r.cpuBusy * 100).toFixed(0)}%`}`);
      await page.close({ runBeforeUnload: false }).catch(() => {});
    }
    await context.close();
  } finally { await browser.close(); release(); }
  return res;
}

// Per-pixel: share of pixels further apart than 0.02 (pixeldiff's default) and the mean distance.
// Low-frequency: the same on 16 x 16 block averages, which ignores grain and sees a missing blur or a moved shape.
function diffMetric(a, b, width = CW * SCALE, height = CH * SCALE) {
  if (!a || !b) return null;
  const A = Buffer.from(a, 'base64'), B = Buffer.from(b, 'base64');
  if (A.length !== B.length) return null;
  let changed = 0, sum = 0;
  const n = A.length / 4;
  for (let i = 0; i < A.length; i += 4) {
    const d = pixelDistance(A[i], A[i + 1], A[i + 2], A[i + 3], B[i], B[i + 1], B[i + 2], B[i + 3]);
    sum += d; if (d > 0.02) changed++;
  }
  const K = 16, bw = Math.floor(width / K), bh = Math.floor(height / K);
  let lfSum = 0, lfMax = 0, lfChanged = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const m = [0, 0, 0, 0, 0, 0];
    for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) {
      const i = ((by * K + y) * width + bx * K + x) * 4;
      for (let c = 0; c < 3; c++) { m[c] += A[i + c]; m[3 + c] += B[i + c]; }
    }
    const q = K * K;
    const d = pixelDistance(m[0] / q, m[1] / q, m[2] / q, 255, m[3] / q, m[4] / q, m[5] / q, 255);
    lfSum += d; if (d > lfMax) lfMax = d; if (d > 0.02) lfChanged++;
  }
  return { ratio: changed / n, mean: sum / n, lfMean: lfSum / (bw * bh), lfMax, lfRatio: lfChanged / (bw * bh) };
}

async function sheets(list, results) {
  // Contact sheets (drawn in Chromium): a row per scene, Chromium still, WebKit still, then Chromium at t = 0, 1.5, 3 s.
  const rows = list.map(s => {
    const c = results.chromium[s.name], w = results.webkit[s.name];
    const img = u => u ? `<img src="${u}">` : '<div class="miss">no frame</div>';
    return `<tr><th>${s.name}<br><small>${s.filter ? 'ctx.filter' : ''}</small></th><td>${img(c?.still?.thumb)}</td><td>${img(w?.still?.thumb)}</td>${[0, 1, 2].map(i => `<td>${img(c?.moving?.[i]?.thumb)}</td>`).join('')}</tr>`;
  });
  const per = 8;
  const browser = await pickEngine('chromium').launch();
  const files = [];
  try {
    for (let i = 0; i * per < rows.length; i++) {
      const page = await browser.newPage({ viewport: { width: 1900, height: 400 } });
      await page.setContent(`<style>body{margin:8px;background:#f4efe4;font:12px system-ui}table{border-collapse:collapse}td,th{padding:3px;vertical-align:top}th{text-align:right;width:70px}img{display:block;width:360px;height:240px}.miss{width:360px;height:240px;background:#ddd}</style>
        <table><tr><th></th><td>Chromium still</td><td>WebKit still</td><td>t = 0</td><td>t = 1.5 s</td><td>t = 3 s</td></tr>${rows.slice(i * per, (i + 1) * per).join('')}</table>`);
      const f = path.join(OUT, `contact-${i + 1}.png`);
      await page.screenshot({ path: f, fullPage: true });
      files.push(f);
      await page.close({ runBeforeUnload: false }).catch(() => {});
    }
  } finally { await browser.close(); }
  return files;
}

fs.mkdirSync(OUT, { recursive: true });
const list = candidates();
const server = await startServer({ quiet: true });
const results = {};
const base0 = cpuTimes();
await new Promise(r => setTimeout(r, 2000));
const base1 = cpuTimes();
const idleBusy = (base1.busy - base0.busy) / ((base1.busy - base0.busy) + (base1.idle - base0.idle));
console.log(`machine busy before the run: ${(idleBusy * 100).toFixed(0)}% over 2 s`);
try {
  results.chromium = await runEngine('chromium', list, server);
  results.webkit = await runEngine('webkit', list, server);
} finally { await server.close(); }

const survey = list.map(s => {
  const c = results.chromium[s.name], w = results.webkit[s.name];
  return {
    ...s, W: c?.W, H: c?.H, ratio: c?.W ? +(c.W / c.H).toFixed(3) : null,
    chromiumMs: median(c?.frameMs ?? []), webkitMs: median(w?.frameMs ?? []), cpuBusy: c?.cpuBusy,
    stillDiff: diffMetric(c?.stillRaw, w?.stillRaw), midDiff: diffMetric(c?.midRaw, w?.midRaw),
    errors: { chromium: c?.errors, webkit: w?.errors },
  };
});
fs.writeFileSync(path.join(OUT, 'survey.json'), JSON.stringify({ at: new Date().toISOString(), cpus: os.cpus().length, busyBefore: idleBusy, survey }, null, 2));
const files = await sheets(list, results);
console.log('sheets:', files.join('\n        '));
for (const s of survey) console.log(s.name.padEnd(9), `filter=${s.filter ? 'Y' : 'n'}`, `ratio=${s.ratio}`, `cms=${s.chromiumMs?.toFixed(1)}`, `wms=${s.webkitMs?.toFixed(1)}`, `still px=${s.stillDiff ? (s.stillDiff.ratio * 100).toFixed(1) + '% mean ' + s.stillDiff.mean.toFixed(4) + ' lfMax ' + s.stillDiff.lfMax.toFixed(3) + ' lf>' + (s.stillDiff.lfRatio * 100).toFixed(1) + '%' : '-'}`);
