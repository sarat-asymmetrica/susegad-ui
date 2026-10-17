// Browser checks for the words in z-space (rung 5 of the text tier): the paragraph round the turning pot is painted twice from
// one layout, as DOM spans (the real words) and as textured quads in the pot's own scene and camera (stage3d/text.live.js).
//
//   node packages/scenes/veranda/quads.check.mjs            (or: npm run check)
//   node packages/scenes/veranda/quads.check.mjs --break    (against patched builds: the marked checks must FAIL)
//
// Runs on this machine's GPU (ANGLE on Direct3D 11) so three.js really draws. The live-pixel checks (1, 2, 5, and the lost-context part of 3)
// stand on reading the pot's WebGL canvas back and run in Chromium only; with SG_ENGINE=webkit or firefox the rest run (the fallbacks
// that do not need WebGL, and the network proof in 4) and the others are printed as skipped, never as passed.
//
//  1. one layout, two painters: in four poses of the pot, the quads' texts are the spans' texts, line by line, and each quad's box,
//     projected through the camera three drew with, is on its span's box (within a pixel); the pot shortens lines in every pose;
//  2. the quads show the words: while the quads are on screen the spans' ink is transparent, and every line's box holds the
//     quads' ink (read back from the canvas) and none of the pot's;
//  3. never a blank paragraph: forced colours, a lost WebGL context (and its restore), a quad painter that fails to load, no WebGL
//     at all: the spans' ink is back (opaque, inside the pane, the whole paragraph in order) and no quad is on screen;
//  4. no measuring where nothing moves: in quiet, under reduced motion and with JavaScript off the type tier (index, measure,
//     operators) and Pretext are never requested, and a warm full-motion page, as the control, does request them;
//  3b. selecting a line shows: the highlight is on the painted words, inside the line's box and nowhere else, and the quads' ink reads on it
//     at 4.5:1 or better in both themes;
//  5. a slow face: with the page's web fonts delayed 2.5 s the paragraph is laid in the real face, not the fallback: the same lines as the
//     undelayed control, in the same pose (a layout made before the face arrived would keep its fallback widths), and the paragraph is on
//     the page, as written and visible, at every moment until then;
//  5b. larger text: at 200% and 400% text every line is inside the viewport and inside every clipping ancestor (the pane that no longer
//     fits the frame gives way to the flat reading);
//  5c. stacked: at 150%, 200% and 300% text, once the stage stacks, the paragraph is plain text in normal flow (no absolutely placed line
//     spans left in it), has height, and no line of it touches the picture; it does not flip-flop; and it is a live pot again when the stage
//     is wide enough to unstack;
//  5d. no leak and no wasted pot: 30 stack and unstack cycles across the 560 px threshold leave the stage live with the quads painting and no
//     "Too many active WebGL contexts" warning; and a pane that does not fit at larger text is never built (no pot canvas is ever added);
//  6. no frame stalls: frame times over the same seconds with the quads and without them (a patched build that makes none), the
//     two alternated, with the machine's CPU busy share beside them.
//
// --break: quads left on when they are not painting (3), blank textures (2), a dropped line (1), measuring in quiet (4), a quad painter
// that draws every texture again every frame (6).

import os from 'node:os';
import { harness } from '../../../tools/lib/component-check.mjs';
import { skipLine } from '../../../tools/lib/gpu.mjs';

const BREAK = process.argv.includes('--break');
const GPU_FLAGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']; // Chromium's; the harness gives other engines none
const h = await harness({ args: GPU_FLAGS, axe: 'not axe-checked anywhere yet: this page is not in tools/smoke.mjs (docs/DEBT.md); this check asks about drawing and layout' });
const { server, browser, results } = h;
const check = (name, ok, detail = '') => { h.check(name, ok, detail); if (!ok) console.log('      what was measured is in the brackets; the numbered note at the top of this file says what the check protects'); };
const ENGINE = h.engine, CHROMIUM = ENGINE === 'chromium';
// The live clauses need Chromium's WebGL readback AND a renderer the library will draw live on: a software one (a CI runner, or
// SG_FORCE_SOFTWARE_GL=1) gets the 2D tier, so they skip with the no-GPU line (tools/lib/gpu.mjs). Another engine skips as it always did.
const gate = await h.gpu();
const LIVE = CHROMIUM && !gate.gpu.software;
const skip = name => {
  if (!CHROMIUM) return h.skip(name, 'needs the live WebGL readback: Chromium only');
  gate.skipped.push(name); console.log(skipLine(name, gate.gpu));
};
const TYPE_TIER = /\/type\/(index|measure|operators|layout\.[a-z]+)\.js|\/type\/vendor\/pretext\.js/;
const TEXT = 'The clay pot on the seat is where the water is kept cool. It has stood there since before the roof was retiled, and it turns, slowly, when nobody is looking, so that every side of it gets the same share of the evening light.';

const BREAKS = {
  inkStays: [/matka-view\.js$/, s => s.replace("return quads && drawn && !lost && !forced.matches ? 'quads' : 'spans';", "return quads ? 'quads' : 'spans';").replace("if (quads && !forced.matches) {", 'if (quads) {')],
  blankQuads: [/text\.live\.js$/, s => s.replace('g.fillText(q.text, q.pad,', 'void (q.text, q.pad,')],
  droppedLine: [/matka-view\.js$/, s => s.replace('quads.set(quadPlan(boxes,', 'quads.set(quadPlan(boxes.slice(1),')],
  noFontWait: [/matka-view\.js$/, s => s.replace('await type.fontReady(font, text);', '')],
  harshSelection: [/matka-view\.js$/, s => s.replace(/background:color-mix\([^}]*\)\}/, 'background:Highlight}')],
  leaky: [/matka-view\.js$/, s => s.replace('keep(gl.renderer, canvas);', 'gl.renderer.dispose();')], // the round-3 teardown: dispose, no release
  heldForever: [/matka-view\.js$/, s => s.replace('const SPARE_MS = 8000;', 'const SPARE_MS = 1e9;')],
  noTeardown: [/matka-view\.js$/, s => s.replace("if (swapped) para.textContent = text;", "")],
  noSelectionBg: [/matka-view\.js$/, s => s.replace(';background:Highlight}', '}')],
  clearEarly: [/matka-view\.js$/, s => s.replace('await type.fontReady(font, text);', "para.textContent = ''; await type.fontReady(font, text);")],
  noClipReport: [/matka-view\.js$/, s => s.replace("host.dispatchEvent(new CustomEvent('sg-flow-clip'", "void (new CustomEvent('sg-flow-clip'")],
  measures: [/matka-view\.js$/, s => s.replace("host.dataset.register !== 'quiet' && !matchMedia('(prefers-reduced-motion: reduce)').matches", 'true')],
  redrawAll: [/text\.live\.js$/, s => s.replace('if (it.key !== q.key) {', 'if (true) {').replace('if (it.cw !== cw || it.ch !== ch) {', 'if (true) {')], // a painter that makes and draws every texture again every frame
  buildThenStack: [/matka-view\.js$/, s => s.replace('if (clippedBy(s0)) return null;', '')],
  noQuads: [/matka-view\.js$/, s => s.replace(/quads = live3\.createTextQuads\([^\n]*\);/, 'quads = null;')], // the perf baseline: the same page with no quads (not a break)
};
async function open({ browser: b = browser, query = 'register=warm', reduced = false, forced = false, noGL = false, js = true, block = null, scheme = 'light', width = 1280, height = 900, dpr = 1, patches = [], baseline = [], delayFonts = 0, fontPct = 0, init = null } = {}) {
  const context = await h.context({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', forcedColors: forced ? 'active' : 'none', colorScheme: scheme, deviceScaleFactor: dpr, javaScriptEnabled: js }, b);
  const requests = [], errors = [];
  context.on('request', r => requests.push(r.url()));
  if (noGL) await context.addInitScript("const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); };");
  if (delayFonts) await context.route(u => /\.woff2$/.test(u.pathname), async r => { await new Promise(res => setTimeout(res, delayFonts)); r.continue(); });
  if (block) await context.route(u => block.test(u.pathname), r => r.abort());
  for (const key of [...(BREAK ? patches : []), ...baseline]) {
    const [re, fn] = BREAKS[key];
    await context.route(u => re.test(u.pathname), async r => { const res = await r.fetch(); r.fulfill({ response: res, body: fn(await res.text()) }); });
  }
  if (init) await context.addInitScript(init);
  if (fontPct) await context.addInitScript(p => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = p + '%'; }); }, fontPct);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${server.url}/packages/scenes/veranda/words.html?${query}`);
  if (js) {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    if (!fontPct) await page.waitForFunction(() => window.__stage.matka?.pose, null, { timeout: 30000 });
    await page.waitForTimeout(600);
  } else await page.waitForTimeout(1500);
  return { context, page, requests, errors };
}
/** What a person would see of the words, per line: the span's own ink colour, whether it is inside the pane, and its text. Runs in the page. */
const READ = () => {
  const m = window.__stage.matka, card = m.card.getBoundingClientRect(), spans = [...m.card.querySelectorAll('span[data-line]')];
  const alpha = c => { const q = /^rgba?\(([^)]*)\)$/.exec(c); if (q) { const p = q[1].split(/[ ,\/]+/).filter(Boolean); return p.length > 3 ? +p[3] : 1; } return c === 'transparent' ? 0 : 1; };
  return {
    paint: m.paint, mode: m.mode, quads: m.quads ? { visible: m.quads.visible, texts: m.quads.texts() } : null,
    spans: spans.map(s => { const r = s.getBoundingClientRect(); return { text: s.textContent, alpha: alpha(getComputedStyle(s).color), inside: r.left >= card.left - 1 && r.right <= card.right + 1 && r.top >= card.top - 1 && r.bottom <= card.bottom + 1, w: r.width }; }),
    whole: spans.map(s => s.textContent).join('').replace(/\s+/g, ' ').trim(),
  };
};
const visibleWords = r => r.spans.length >= 4 && r.spans.every(s => s.alpha > 0.5 && s.inside) && r.whole === TEXT;

// 1. one layout, two painters
if (!LIVE) skip('one layout, two painters'); else {
  const p = await open({ patches: ['droppedLine'] }), rows = [];
  for (const th of [0.3, 1.6, 2.9, 4.4]) {
    rows.push(await p.page.evaluate(async th => {
      const m = window.__stage.matka; m.hold(true, th);
      const want = Math.round((((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * 16) % 16, t0 = performance.now();
      // wait for the state (this pose laid, the quads showing it), not for a time
      while (performance.now() - t0 < 15000) { const sp = m.card.querySelectorAll('span[data-line]'); if (m.pose?.step === want && m.paint === 'quads' && m.quads && m.quads.texts().length === sp.length && sp.length) break; await new Promise(r => requestAnimationFrame(r)); }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const spans = [...m.card.querySelectorAll('span[data-line]')], q = m.quads.screen(), cv = m.quads.canvasRect();
      const texts = spans.map(s => s.textContent.trimEnd()), qt = m.quads.texts().map(t => t.trimEnd());
      let off = 0; const widths = [];
      spans.forEach((s, i) => { const r = s.getBoundingClientRect(), b = q[i]; widths.push(Math.round(r.width)); if (b) off = Math.max(off, Math.abs(cv.left + b.left - r.left), Math.abs(cv.top + b.top - r.top)); else off = 99; });
      return { th, same: texts.length === qt.length && texts.every((t, i) => t === qt[i]), n: texts.length, nq: qt.length, off: +off.toFixed(2), widths, step: m.pose.step };
    }, th));
  }
  await p.page.evaluate(() => window.__stage.matka.hold(false));
  const narrowed = rows.map(r => Math.max(...r.widths) - Math.min(...r.widths));
  check('one layout, two painters: in four poses of the pot the quads\' texts are the spans\' texts, line by line, and each quad\'s projected box is on its span\'s box',
    rows.every(r => r.same && r.n >= 5 && r.off <= 1.01) && narrowed.every(n => n > 30),
    rows.map(r => `turn ${r.th} (step ${r.step}): ${r.n} spans, ${r.nq} quads, texts ${r.same ? 'equal' : 'DIFFER'}, worst box offset ${r.off} px, line widths ${r.widths.join('/')}`).join('; '));
  await p.context.close();
}

// 2. the words are really painted, by the quads, and the pot's own pixels stay out of the words
if (!LIVE) skip('the quads show the words'); else {
  const p = await open({ patches: ['blankQuads'] });
  const r = await p.page.evaluate(() => {
    const m = window.__stage.matka, spans = [...m.card.querySelectorAll('span[data-line]')];
    const read = (what) => { const px = m.pixels(what), k = px.w / px.rect.width; return spans.map(sp => { const b = sp.getBoundingClientRect(); let n = 0; for (let y = Math.max(0, Math.floor((b.top - px.rect.top) * k)); y < Math.min(px.h, Math.ceil((b.bottom - px.rect.top) * k)); y++) for (let x = Math.max(0, Math.floor((b.left - px.rect.left) * k)); x < Math.min(px.w, Math.ceil((b.right - px.rect.left) * k)); x++) if (px.alpha[y * px.w + x] > 40) n++; return n; }); };
    const alpha = c => { const q = /^rgba?\(([^)]*)\)$/.exec(c); return q ? (q[1].split(/[ ,\/]+/).filter(Boolean)[3] ?? 1) : 1; };
    return { paint: m.paint, inkAlpha: spans.map(s => +alpha(getComputedStyle(s).color)), quadInk: read('quads'), potInk: read('pot'), after: m.paint };
  });
  check('the quads show the words: the spans\' ink is transparent while the quads are on, and every line\'s box holds the quads\' ink and none of the pot\'s',
    r.paint === 'quads' && r.inkAlpha.every(a => a === 0) && r.quadInk.every(n => n > 150) && r.potInk.every(n => n === 0),
    `paint ${r.paint}; span ink alpha ${r.inkAlpha.join('/')}; quad pixels per line ${r.quadInk.join('/')}; pot pixels inside the lines ${r.potInk.join('/')}`);
  await p.context.close();
}

// 3. never a blank paragraph
{
  const rows = [];
  // forced colours
  { const p = await open({ forced: true, patches: ['inkStays'] }); const r = await p.page.evaluate(READ); rows.push({ what: 'forced colours', ok: r.paint === 'spans' && visibleWords(r) && !(r.quads?.visible), r, errors: p.errors.length }); await p.context.close(); }
  // a lost context, and its restore
  if (LIVE) {
    const p = await open({ patches: ['inkStays'] });
    const before = await p.page.evaluate(READ);
    await p.page.evaluate(() => { const gl = window.__stage.matka.canvas.getContext('webgl2'); window.__lose = gl.getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
    await p.page.waitForFunction(() => window.__stage.matka.paint === 'spans', null, { timeout: 5000 }).catch(() => {});
    await p.page.waitForTimeout(300);
    const lost = await p.page.evaluate(READ);
    rows.push({ what: 'a lost WebGL context', ok: before.paint === 'quads' && lost.paint === 'spans' && visibleWords(lost) && !lost.quads?.visible, r: lost });
    await p.page.evaluate(() => window.__lose.restoreContext());
    await p.page.waitForFunction(() => window.__stage.matka.paint === 'quads', null, { timeout: 8000 }).catch(() => {});
    const back = await p.page.evaluate(READ);
    const same = back.quads && back.quads.texts.map(t => t.trimEnd()).join('|') === back.spans.map(s => s.text.trimEnd()).join('|');
    rows.push({ what: 'its restore', ok: back.paint === 'quads' && back.spans.every(s => s.alpha === 0) && same, r: back });
    await p.context.close();
  }
  // the quad painter fails to load
  if (LIVE) { const p = await open({ block: /text\.live\.js$/ }); const r = await p.page.evaluate(READ); rows.push({ what: 'the quad painter fails to load', ok: r.paint === 'spans' && r.mode === 'spans' && visibleWords(r) && r.quads === null, r }); await p.context.close(); }
  // no WebGL
  { const p = await open({ noGL: true }); const r = await p.page.evaluate(READ); rows.push({ what: 'no WebGL', ok: r.paint === 'spans' && visibleWords(r) && r.quads === null, r }); await p.context.close(); }
  if (!LIVE) { skip('never a blank paragraph: a lost context and its restore'); skip('never a blank paragraph: a quad painter that fails to load'); }
  check(`never a blank paragraph: forced colours, ${LIVE ? 'a lost context, a quad painter that fails to load ' : ''}and no WebGL all leave the spans\' ink opaque and the paragraph whole${LIVE ? ' (and a restore brings the quads back)' : ''}`,
    rows.every(x => x.ok), rows.map(x => `${x.what}: ${x.ok ? 'ok' : 'BLANK'} (paint ${x.r.paint}, ${x.r.spans.length} spans, ink alpha ${[...new Set(x.r.spans.map(s => s.alpha))].join('/')}, quads ${x.r.quads ? (x.r.quads.visible ? 'on' : 'hidden') : 'none'})`).join('; '));
}

// 4. no measuring where nothing moves
{
  const seen = [];
  for (const [label, opts] of [['quiet', { query: 'register=quiet', patches: ['measures'] }], ['reduced motion', { reduced: true, patches: ['measures'] }], ['JavaScript off', { js: false }], ['warm, full motion (the control)', {}]]) {
    const p = await open(opts), asked = [...new Set(p.requests.filter(u => TYPE_TIER.test(u)).map(u => u.replace(/^.*\/packages\//, '')))];
    let words = true;
    if (opts.js === false) words = (await p.page.locator('p[data-flow]').innerText().catch(() => '')).replace(/\s+/g, ' ').trim() === TEXT;
    seen.push({ label, asked, words });
    await p.context.close();
  }
  const control = seen.at(-1), quiet = seen.slice(0, 3);
  check('no measuring where nothing moves: quiet, reduced motion and no JavaScript never request the type tier or Pretext; the warm, full-motion control does',
    quiet.every(s => s.asked.length === 0 && s.words) && ['type/index.js', 'type/measure.js', 'type/vendor/pretext.js'].every(f => control.asked.includes(f)),
    seen.map(s => `${s.label}: ${s.asked.length ? s.asked.join(', ') : 'nothing from the type tier'}`).join('; '));
}

// 3b. selecting a line shows
if (!LIVE) skip('selecting a line shows'); else {
  const rows = [];
  for (const theme of ['light', 'dark']) {
  const p = await open({ query: `register=warm&theme=${theme}`, scheme: theme, patches: ['noSelectionBg', 'harshSelection'] });
  const info = await p.page.evaluate(async () => {
    const m = window.__stage.matka; m.hold(true, 1.6);
    for (const t0 = performance.now(); performance.now() - t0 < 15000 && !(m.pose?.step === 4 && m.paint === 'quads');) await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 300));
    const sp = m.card.querySelectorAll('span[data-line]')[1].getBoundingClientRect(), c = m.card.getBoundingClientRect();
    const ink = getComputedStyle(m.card.querySelector('p')).color;
    return { ink, box: { x: sp.left, y: sp.top, w: sp.width, h: sp.height }, clip: { x: Math.floor(c.left), y: Math.floor(c.top), width: Math.ceil(c.width), height: Math.ceil(c.height) } };
  });
  const a = await p.page.screenshot({ clip: info.clip });
  await p.page.evaluate(() => { const s = window.__stage.matka.card.querySelectorAll('span[data-line]')[1]; getSelection().selectAllChildren(s); });
  await p.page.waitForTimeout(250);
  const b = await p.page.screenshot({ clip: info.clip });
  const probe = await p.context.newPage();
  const r = await probe.evaluate(async ([a, b, info]) => {
    const load = async x => { const i = new Image(); i.src = 'data:image/png;base64,' + x; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
    const A = await load(a), B = await load(b), bx = info.box.x - info.clip.x, by = info.box.y - info.clip.y;
    let inside = 0, outside = 0, area = 0; const rowsOut = new Set();
    for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
      const k = (y * A.width + x) * 4, d = Math.abs(A.data[k] - B.data[k]) + Math.abs(A.data[k + 1] - B.data[k + 1]) + Math.abs(A.data[k + 2] - B.data[k + 2]);
      const within = x >= bx - 1 && x <= bx + info.box.w + 1 && y >= by - 1 && y <= by + info.box.h + 1;
      if (within) area++;
      const band = y >= by - 5 && y <= by + info.box.h + 5; // the highlight is the font content area (taller than the line box) and may run on along its own row, never onto another row
      if (d > 60) { if (within) inside++; else if (!band) { outside++; rowsOut.add(y); } }
    }
    // the highlight is drawn over the quads, so the selected words read only if the spans' own ink shows inside it
    const counts = new Map();
    for (let y = Math.ceil(by); y < by + info.box.h; y++) for (let x = Math.ceil(bx); x < bx + info.box.w; x++) {
      const k = (y * B.width + x) * 4, key = `${B.data[k] >> 4},${B.data[k + 1] >> 4},${B.data[k + 2] >> 4}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const mode = [...counts.entries()].sort((p, q) => q[1] - p[1])[0][0].split(',').map(v => +v * 16 + 8);
    let ink = 0, n = 0;
    for (let y = Math.ceil(by); y < by + info.box.h; y++) for (let x = Math.ceil(bx); x < bx + info.box.w; x++) {
      const k = (y * B.width + x) * 4; n++;
      if (Math.abs(B.data[k] - mode[0]) + Math.abs(B.data[k + 1] - mode[1]) + Math.abs(B.data[k + 2] - mode[2]) > 150) ink++;
    }
    const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); g.fillStyle = info.ink; g.fillRect(0, 0, 1, 1);
    const iv = g.getImageData(0, 0, 1, 1).data, lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const hi = [...counts.keys()].length ? mode : [0, 0, 0], l1 = lum(iv), l2 = lum(hi), contrast = +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
    return { contrast, ink: +(ink / n).toFixed(3), inside, area, outside, share: +(inside / area).toFixed(2), rows: [...rowsOut].slice(0, 12).join(','), by: Math.round(by), h: Math.round(info.box.h) };
  }, [a.toString('base64'), b.toString('base64'), info]);
  rows.push({ theme, ...r });
  await p.context.close();
  }
  check('selecting a line shows: the highlight is on the painted words, filling most of the line box, touching no other row, with the ink reading on it at 4.5:1 or better in both themes',
    rows.every(r => r.share > 0.3 && r.outside < 40 && r.ink > 0.04 && r.contrast >= 4.5), rows.map(r => `${r.theme}: contrast of the ink on the highlight ${r.contrast}:1, ink inside the highlight ${Math.round(r.ink * 100)}% of the box; ${r.inside} of ${r.area} pixels in the selected line's box changed (${Math.round(r.share * 100)}%), ${r.outside} changed on any other row; `).join('; '));
}

// 5. a slow face
{
  const seen = [];
  for (const [label, opts] of [['control', {}], ['faces delayed 2.5 s', { delayFonts: 2500, patches: ['noFontWait'] }]]) {
    const p = await open(opts);
    seen.push({ label, ...(await p.page.evaluate(async () => { const m = window.__stage.matka; m.hold(true, 1.6); for (const t0 = performance.now(); performance.now() - t0 < 15000 && m.pose?.step !== 4;) await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const sp = [...m.card.querySelectorAll('span[data-line]')]; return { n: sp.length, texts: sp.map(s => s.textContent.trimEnd()), widths: sp.map(s => Math.round(s.getBoundingClientRect().width)), px: getComputedStyle(sp[0]).fontSize }; })) });
    await p.context.close();
  }
  // the words are on the page, as written and visible, at every moment while the delayed faces load
  {
    const context = await h.context({ viewport: { width: 1280, height: 900 } });
    await context.route(u => /\.woff2$/.test(u.pathname), async r => { await new Promise(res => setTimeout(res, 2500)); r.continue(); });
    for (const key of BREAK ? ['clearEarly'] : []) { const [re, fn] = BREAKS[key]; await context.route(u => re.test(u.pathname), async r => { const res = await r.fetch(); r.fulfill({ response: res, body: fn(await res.text()) }); }); }
    const page = await context.newPage(), samples = [];
    await page.goto(`${server.url}/packages/scenes/veranda/words.html?register=warm`, { waitUntil: 'commit' });
    for (let k = 0; k < 80; k++) {
      const r = await page.evaluate(() => { const p = document.querySelector('p[data-flow]'); const m = window.__stage?.matka; return { has: !!p, text: p ? p.textContent.replace(/\s+/g, ' ').trim().length : 0, shown: !!p && p.getClientRects().length > 0 && getComputedStyle(p).visibility !== 'hidden', laid: !!m?.pose }; }).catch(() => null);
      if (r) samples.push(r);
      if (r?.laid) break;
      await page.waitForTimeout(100);
    }
    const before = samples.filter(x => x.has && !x.laid);
    await context.close();
    seen.push({ label: 'presence', before: before.length, bad: before.filter(x => x.text < 200 || !x.shown).length });
  }
  const pres = seen.pop();
  const [c, d] = seen;
  check('a slow face: with the web fonts delayed 2.5 s the paragraph is laid in the real face: the same lines, widths and size as the undelayed control',
    c.n >= 5 && c.texts.join('|') === d.texts.join('|') && c.widths.join() === d.widths.join() && c.px === d.px && pres.before >= 5 && pres.bad === 0,
    seen.map(x => `${x.label}: ${x.n} lines at ${x.px}, widths ${x.widths.join('/')}`).join('; ') + `; the paragraph, sampled every 100 ms while the faces were held back: ${pres.before} samples with it in the page, ${pres.bad} with its words missing or hidden`);
}

// 5b. larger text
{
  const rows = [];
  for (const pct of [200, 400]) for (const query of ['register=warm', 'register=quiet']) {
    const p = await open({ query, fontPct: pct, patches: ['noClipReport'] });
    await p.page.waitForTimeout(1500);
    const r = await p.page.evaluate(() => {
      const para = document.querySelector('p[data-flow]'), st = document.querySelector('sg-veranda-stage'), rects = [];
      const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode());) { const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 1) rects.push(q); }
      const clippers = [];
      for (let e = para.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e); if (e !== document.documentElement && e !== document.body && /(hidden|clip|auto|scroll)/.test(o.overflowX + o.overflowY)) clippers.push(e.getBoundingClientRect()); }
      let clipped = 0;
      for (const q of rects) if (q.left < -1 || q.right > innerWidth + 1 || clippers.some(b => q.left < b.left - 1 || q.right > b.right + 1 || q.top < b.top - 1 || q.bottom > b.bottom + 1)) clipped++;
      return { flow: st.dataset.flow, lines: rects.length, clipped, words: para.textContent.replace(/\s+/g, ' ').trim().length, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    rows.push({ pct, query, ...r }); await p.context.close();
  }
  check('larger text: at 200% and 400% every line is inside the viewport and inside every clipping ancestor, with all the words and no sideways scroll',
    rows.every(r => r.lines >= 3 && r.clipped === 0 && r.words >= 224 && r.sideways <= 0),
    rows.map(r => `${r.pct}% ${r.query.replace('register=', '')}: ${r.flow}, ${r.lines} lines, ${r.clipped} clipped, ${r.words} characters`).join('; '));
}

// 5c. stacked (the pot comes back when the stage is wide again: that is the live tier)
if (!LIVE) skip('stacked: at 150%, 200% and 300% text the paragraph is plain text in normal flow, and the pot comes back when the stage is wide again'); else {
  const rows = [];
  for (const pct of [150, 200, 300]) {
    const p = await open({ fontPct: pct, patches: ['noTeardown'] });
    await p.page.waitForTimeout(2500);
    const r = await p.page.evaluate(() => {
      const para = document.querySelector('p[data-flow]'), st = document.querySelector('sg-veranda-stage'), pic = st.querySelector('.stage').getBoundingClientRect(), box = para.getBoundingClientRect(), rects = [];
      const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode());) { const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 1) rects.push(q); }
      const over = rects.filter(q => q.left < pic.right && q.right > pic.left && q.top < pic.bottom && q.bottom > pic.top).length;
      return { flow: st.dataset.flow, abs: para.querySelectorAll('span[data-line]').length, height: Math.round(box.height), top: Math.round(box.top), picBottom: Math.round(pic.bottom), lines: rects.length, over, calm: getComputedStyle(para).position };
    });
    // no flip-flop: the stage keeps its state for three more seconds
    const flows = new Set();
    for (let k = 0; k < 10; k++) { flows.add(await p.page.evaluate(() => document.querySelector('sg-veranda-stage').dataset.flow)); await p.page.waitForTimeout(300); }
    rows.push({ pct, ...r, steady: flows.size === 1 }); await p.context.close();
  }
  // a pot that is live and then stacked is torn down to plain text, and comes back when the stage is wide again
  const p = await open({ patches: ['noTeardown'] });
  await p.page.setViewportSize({ width: 500, height: 900 });
  await p.page.waitForFunction(() => document.querySelector('sg-veranda-stage').dataset.flow === 'flat', null, { timeout: 15000 }).catch(() => {});
  const narrow = await p.page.evaluate(() => ({ flow: document.querySelector('sg-veranda-stage').dataset.flow, abs: document.querySelectorAll('p[data-flow] span[data-line]').length }));
  await p.page.setViewportSize({ width: 1280, height: 900 });
  await p.page.waitForFunction(() => window.__stage.matka?.pose && window.__stage.dataset.flow === 'live', null, { timeout: 15000 }).catch(() => {});
  const wide = await p.page.evaluate(() => ({ flow: document.querySelector('sg-veranda-stage').dataset.flow, quads: window.__stage.matka?.paint, lines: window.__stage.matka?.card.querySelectorAll('span[data-line]').length ?? 0 }));
  await p.context.close();
  check('stacked: at 150%, 200% and 300% text the paragraph is plain text in normal flow with height and clear of the picture, steady; and the pot comes back when the stage is wide again',
    rows.every(r => r.flow === 'flat' && r.abs === 0 && r.height > 20 && r.lines >= 2 && r.over === 0 && r.steady) && narrow.flow === 'flat' && narrow.abs === 0 && wide.flow === 'live' && wide.quads === 'quads' && wide.lines >= 4,
    rows.map(r => `${r.pct}%: ${r.flow}, ${r.abs} line spans left in the paragraph, its box ${r.height} px tall at y ${r.top} (picture ends ${r.picBottom}), ${r.over} of ${r.lines} lines over the picture, ${r.steady ? 'steady' : 'FLIPPING'}`).join('; ') + `; 500 px wide: ${narrow.flow} with ${narrow.abs} spans; back at 1280: ${wide.flow}, paint ${wide.quads}, ${wide.lines} lines`);
}

// 5d. no leak, no wasted pot
if (!LIVE) skip('no leak, no wasted pot: after 30 stack and unstack cycles the stage is live with the quads painting'); else {
  const p = await open({ patches: ['leaky'] }), warnings = [];
  p.page.on('console', m => { if (/Too many active WebGL contexts/i.test(m.text())) warnings.push(m.text().slice(0, 80)); });
  for (let k = 0; k < 30; k++) {
    await p.page.setViewportSize({ width: 500, height: 900 });
    await p.page.waitForFunction(() => document.querySelector('sg-veranda-stage').dataset.flow === 'flat', null, { timeout: 15000 }).catch(() => {});
    await p.page.setViewportSize({ width: 1280, height: 900 });
    await p.page.waitForFunction(() => window.__stage.matka?.pose && window.__stage.dataset.flow === 'live', null, { timeout: 15000 }).catch(() => {});
  }
  await p.page.waitForTimeout(800);
  const end = await p.page.evaluate(() => ({ flow: document.querySelector('sg-veranda-stage').dataset.flow, paint: window.__stage.matka?.paint, lines: window.__stage.matka?.card.querySelectorAll('span[data-line]').length ?? 0 }));
  await p.context.close();
  // the context kept for a quick re-attach is kept for a moment only: a stage that stays stacked holds none
  const q0 = await open({ patches: ['heldForever'] });
  await q0.page.setViewportSize({ width: 500, height: 900 });
  await q0.page.waitForFunction(() => document.querySelector('sg-veranda-stage').dataset.flow === 'flat', null, { timeout: 15000 }).catch(() => {});
  const spare = () => q0.page.evaluate(async () => (await import('/packages/scenes/veranda/matka-view.js')).spareHeld());
  const heldAtOnce = await spare();
  await q0.page.waitForTimeout(9500);
  const heldLater = await spare();
  await q0.context.close();
  // and a pane that does not fit is never built
  const built = [];
  for (const pct of [200, 300]) {
    const q = await open({ fontPct: pct, patches: ['buildThenStack'], init: "window.__built = 0; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.('canvas.matka-cv') || n.querySelector?.('canvas.matka-cv'))) window.__built++; }).observe(document, { subtree: true, childList: true });" });
    await q.page.waitForTimeout(1500);
    built.push({ pct, n: await q.page.evaluate(() => window.__built) }); await q.context.close();
  }
  check('no leak, no wasted pot: after 30 stack and unstack cycles the stage is live with the quads painting and no WebGL-contexts warning; a stacked stage gives its context back, and a pane that does not fit is never built',
    end.flow === 'live' && end.paint === 'quads' && end.lines >= 4 && warnings.length === 0 && heldAtOnce && !heldLater && built.every(b => b.n === 0),
    `after 30 cycles: ${end.flow}, paint ${end.paint}, ${end.lines} lines, ${warnings.length} "Too many active WebGL contexts" warnings; the context kept for a quick re-attach: held at once ${heldAtOnce}, held 9.5 s later ${heldLater}; pot canvases built at larger text: ${built.map(b => `${b.pct}% ${b.n}`).join(', ')}`);
}

// 6. no frame stalls
if (!LIVE) skip('no frame stalls'); else {
  const cpu = () => os.cpus().reduce((a, c) => { for (const k in c.times) a[k === 'idle' ? 'idle' : 'busy'] += c.times[k]; return a; }, { idle: 0, busy: 0 });
  // uncapped, so a frame's time is its cost and not the 16.7 ms any frame that fits in one reads
  const fast = await h.launch({ args: [...GPU_FLAGS, '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const frames = async (opts, ms) => {
    const p = await open({ ...opts, browser: fast }), c0 = cpu();
    const r = await p.page.evaluate(async ms => {
      const d = []; let last = performance.now(); const t0 = last;
      await new Promise(res => { const f = t => { d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      d.shift(); d.sort((a, b) => a - b); const q = x => d[Math.min(d.length - 1, Math.floor(d.length * x))];
      const lays = [...window.__stage.matka.stats.layMs].sort((a, b) => a - b);
      const ticks = [...window.__stage.matka.stats.tickMs].sort((a, b) => a - b), tq = x => ticks[Math.min(ticks.length - 1, Math.floor(ticks.length * x))] ?? 0;
      return { tick50: tq(0.5), tick95: tq(0.95), n: d.length, p50: q(0.5), p95: q(0.95), max: d.at(-1), long: d.filter(x => x > 33.4).length, lays: lays.length, layMed: lays[lays.length >> 1] ?? 0, layMax: lays.at(-1) ?? 0 };
    }, ms);
    const c1 = cpu(); r.busy = Math.round(100 * (c1.busy - c0.busy) / ((c1.busy - c0.busy) + (c1.idle - c0.idle)));
    await p.context.close(); return r;
  };
  const withQ = [], without = [];
  for (let k = 0; k < 2; k++) { without.push(await frames({ baseline: ['noQuads'] }, 5000)); withQ.push(await frames({ patches: ['redrawAll'] }, 5000)); }
  await fast.close();
  const best = a => ({ p50: Math.min(...a.map(x => x.p50)), p95: Math.min(...a.map(x => x.p95)), long: Math.min(...a.map(x => x.long)), layMed: Math.min(...a.map(x => x.layMed)), tick50: Math.min(...a.map(x => x.tick50)), tick95: Math.min(...a.map(x => x.tick95)) });
  const A = best(without), B = best(withQ), f = v => v.toFixed(1);
  check('no frame stalls: with the quads on, frame times over 5 s match the same page without them (alternated, best of two), a layout and the JS of each frame cost about the same',
    B.p50 <= A.p50 * 1.15 + 1 && B.p95 <= A.p95 * 1.3 + 2 && B.long <= A.long + 4 && B.layMed <= A.layMed + 3 && B.tick50 <= A.tick50 + 0.15 && B.tick95 <= A.tick95 + 1.2,
    `without: p50 ${f(A.p50)} p95 ${f(A.p95)} ms, ${A.long} frames over 33 ms, layout median ${f(A.layMed)} ms, a frame's own JS median ${f(A.tick50)} p95 ${f(A.tick95)} ms; with: p50 ${f(B.p50)} p95 ${f(B.p95)} ms, ${B.long} over, layout median ${f(B.layMed)} ms, frame JS median ${f(B.tick50)} p95 ${f(B.tick95)} ms; CPU busy ${without.map(x => x.busy).join('/')}% without, ${withQ.map(x => x.busy).join('/')}% with (all runs, on this machine's GPU)`);
}

const failed = results.filter(r => !r.ok).length;
await h.done({ summary: `${gate.finalLine(results.length - failed, results.length)}${BREAK ? ' (--break: the patched builds should FAIL their checks)' : ''}`, expectRed: BREAK });
