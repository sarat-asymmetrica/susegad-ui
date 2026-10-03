// Browser gates for Vad's words in the world (words="world"): the page's
// paragraph in the sky, each line ending where the canopy begins, re-laid four
// times as the tree grows. From docs/requests/2026-09-28-words-in-the-world.md:
//
//   node packages/scenes/vad/words.check.mjs
//
// Each gate has a broken control kept here: a patched build served in place
// of the real source, which the same probe must catch.
// 1. real text (control: the words painted on the canvas, the DOM hidden);
// 2. reading order: heading, then the paragraph's sentences in order
//    (control: the lines projected in reverse);
// 3. 390 px and text at 200% go flat, no clipping, overlap or sideways scroll
//    (control: a build whose minimum is zero);
// 4. findability against quiet's panel (control: every line a tab stop);
// 5. contrast: 4.5:1 against every canvas pixel under every line, mid-growth and grown, light
//    and dark (control: a shape that ignores the canopy, so lines run on leaves);
// 6. calm follows the lines: within a quarter of the growth, under the lines
//    nothing changes while the canopy grows into the gaps beside them
//    (controls: lines laid against the canopy as it is now, not at the
//    quarter's end; a whole-rectangle hold);
// plus lazy loading, no outside request, and axe in every register and theme.

import { readFileSync } from 'node:fs';
import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check, browser, server } = h;
const src = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const WORLD = '/packages/scenes/vad/world.html?only=world';
const PHRASES = ['Under the vad', 'Every village has one', 'Its roots come down', 'The stone platform'];

async function openAt(path, { width = 1280, height = 1000, reduced = false, patch = {}, root = null, requests = null } = {}) {
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  for (const [file, pairs] of Object.entries(patch)) {
    let body = src(file);
    for (const [from, to] of pairs) {
      if (!body.includes(from)) throw new Error(`patch for ${file} did not apply: ${from}`);
      body = body.replace(from, to);
    }
    const at = new URL(file, import.meta.url).pathname.replace(/^.*?\/packages\//, '/packages/');
    await ctx.route(`**${at}*`, r => r.fulfill({ contentType: 'text/javascript; charset=utf-8', body }));
  }
  if (requests) ctx.on('request', r => requests.push(r.url()));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (root) await page.addInitScript(r => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = r; }); }, root);
  await page.goto(`${server.url}${path}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 }).catch(() => errors.push('never ready'));
  return { ctx, page, errors };
}
/** Wait until the stage says where the words are, then three frames. */
async function settled(page, words) {
  const ok = await page.waitForFunction(w => window.__piece?.shadowRoot?.querySelector('.stage')?.dataset.words === w, words, { timeout: 15000 }).then(() => true, () => false);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  return ok;
}

// ── probes ─────────────────────────────────────────────────────────────────
const probeText = page => page.evaluate(() => {
  const sr = window.__piece.shadowRoot, cv = sr.querySelector('.stage canvas'), c = cv.getBoundingClientRect();
  return [...sr.querySelectorAll('[data-line]')].map(s => {
    const r = s.getBoundingClientRect(), cs = getComputedStyle(s), top = sr.elementFromPoint(r.left + Math.min(8, r.width / 2), r.top + r.height / 2);
    let op = 1; for (let n = s; n; n = n.parentElement ?? n.getRootNode().host) op *= +getComputedStyle(n).opacity;
    return { text: s.textContent, px: parseFloat(cs.fontSize), tag: s.parentElement.tagName,
      seen: r.width > 0 && cs.visibility === 'visible' && op > 0.99 && !!top && (top === s || s.contains(top)),
      inside: r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1 };
  });
});
const probeContrast = page => page.evaluate(() => {
  const sr = window.__piece.shadowRoot, cv = sr.querySelector('.stage canvas'), c = cv.getBoundingClientRect(), k = cv.width / c.width, g = cv.getContext('2d');
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
  // any CSS colour (oklch from the tokens, too) as sRGB and alpha, read back through a canvas pixel
  const rgba = css => { const x = new OffscreenCanvas(1, 1).getContext('2d'); x.fillStyle = css; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  return [...sr.querySelectorAll('[data-line]')].map(s => {
    const r = s.getBoundingClientRect(), [tr, tg, tb, ta] = rgba(getComputedStyle(s).color);
    let al = ta; for (let n = s; n; n = n.parentElement ?? n.getRootNode().host) al *= +getComputedStyle(n).opacity;
    const d = g.getImageData(Math.round((r.left - c.left) * k), Math.round((r.top - c.top) * k), Math.max(1, Math.round(r.width * k)), Math.max(1, Math.round(r.height * k))).data;
    let ok = 0, n = 0, worst = 99;
    for (let i = 0; i < d.length; i += 4) {
      const lb = L(d[i], d[i + 1], d[i + 2]), lt = L(tr * al + d[i] * (1 - al), tg * al + d[i + 1] * (1 - al), tb * al + d[i + 2] * (1 - al));
      const ratio = (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05);
      n++; if (ratio >= 4.5) ok++; worst = Math.min(worst, ratio);
    }
    return { name: s.textContent.trim().slice(0, 16), share: ok / n, worst };
  });
});
const summary = rows => rows.map(r => `${r.name} ${(r.share * 100).toFixed(1)}% (worst ${r.worst.toFixed(1)})`).join('; ');

// ── 1. real text ──────────────────────────────────────────────────────────
{
  const real = async page => {
    const lines = await probeText(page), tree = await page.locator('sg-scene#world').ariaSnapshot();
    const words = 'Every village has one: a banyan by the square, older than anyone can remember.'.split(' ');
    const joined = lines.map(l => l.text).join('').replace(/\s+/g, ' ');
    const missing = words.filter(w => !joined.includes(w) || !tree.includes(w)), hidden = lines.filter(l => !l.seen || !l.inside);
    return { ok: lines.length > 3 && !missing.length && !hidden.length, detail: `${lines.length} lines${missing.length ? `; not DOM text: ${missing.slice(0, 4).join(' ')}` : ''}${hidden.length ? `; not visible: ${hidden.length}` : ''}` };
  };
  const { ctx, page, errors } = await openAt(`${WORLD}&register=warm`, { reduced: true });
  await settled(page, 'surface');
  const r = await real(page);
  check('real text: the words in the sky are visible DOM text, in the accessibility tree', r.ok, r.detail);
  check('no console errors (world, warm)', errors.length === 0, errors.join(' | '));
  await ctx.close();
  const broken = await openAt(`${WORLD}&register=warm`, { reduced: true, patch: {
    '../../type/surface.js': [['        layer.append(...els);', "        layer.append(...els); els.forEach(e => { e.style.display = 'none'; });"]],
    'render.js': [["    host.dataset.grown =", "    if (words) { g.save(); g.fillStyle = INK; g.font = '18px Kalam'; for (const l of words.lines) g.fillText(l.text, l.x, l.y + l.h * 0.8); g.restore(); }\n    host.dataset.grown ="]],
  } });
  await settled(broken.page, 'surface');
  const rb = await real(broken.page);
  check('control: the words painted on the canvas with the DOM hidden are caught', !rb.ok, rb.detail);
  await broken.ctx.close();
}

// ── 2. reading order ──────────────────────────────────────────────────────
{
  const order = async page => {
    const tree = (await page.locator('sg-scene#world').ariaSnapshot()).replace(/\s+/g, ' ');
    const at = PHRASES.map(p => tree.indexOf(p));
    return { ok: at.every((v, i) => v >= 0 && (i === 0 || v > at[i - 1])), detail: PHRASES.map((p, i) => `${p.slice(0, 12)}@${at[i]}`).join('; ') };
  };
  for (const register of ['warm', 'quiet']) {
    const { ctx, page } = await openAt(`${WORLD}&register=${register}`, { reduced: true });
    await settled(page, register === 'warm' ? 'surface' : 'panel');
    const r = await order(page);
    check(`reading order (${register}): the heading, then the paragraph's sentences in order`, r.ok, r.detail);
    await ctx.close();
  }
  const broken = await openAt(`${WORLD}&register=warm`, { reduced: true, patch: { '../../type/surface.js': [['type.project(laid.lines,', 'type.project(laid.lines.slice().reverse(),']] } });
  await settled(broken.page, 'surface');
  const rb = await order(broken.page);
  check('control: the lines projected in reverse order are caught', !rb.ok, rb.detail);
  await broken.ctx.close();
}

// ── 3. 390 px and text at 200% ─────────────────────────────────────────────
{
  const flat = page => page.evaluate(() => {
    const el = window.__piece, sr = el.shadowRoot, panel = sr.querySelector('.panel');
    return { words: sr.querySelector('.stage').dataset.words, panel: !panel.hidden, lines: [...sr.querySelectorAll('[data-line]')].map(s => parseFloat(getComputedStyle(s).fontSize)),
      scroll: document.documentElement.scrollWidth, vw: innerWidth, clipped: [...el.children].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.left < -1 || b.right > innerWidth + 1); }).length };
  });
  for (const [name, opts] of [['390 px', { width: 390, height: 844 }], ['text at 200%', { root: '200%' }]]) {
    const { ctx, page } = await openAt(`${WORLD}&register=warm`, { reduced: true, ...opts });
    const ok = await settled(page, 'panel');
    const r = await flat(page);
    check(`${name}: the words go back to the panel, with no clipping and no sideways scroll`, ok && r.panel && !r.lines.length && r.scroll <= r.vw && !r.clipped, `${r.words}, panel ${r.panel}, scroll ${r.scroll} in ${r.vw}, ${r.clipped} clipped`);
    await ctx.close();
  }
  const { ctx, page } = await openAt(`${WORLD}&register=warm`, { reduced: true });
  await settled(page, 'surface');
  const r = await flat(page);
  check('1280 px: the sky holds the words, every line at or over its minimum', r.words === 'surface' && r.lines.length > 0 && r.lines.every(px => px >= 14), r.lines.map(px => `${px}px`).join(', '));
  await ctx.close();
  const broken = await openAt(`${WORLD}&register=warm`, { reduced: true, width: 390, height: 844, patch: { 'model.js': [['({ body: 0.875 * rootPx, heading: 1.25 * rootPx })', '({ body: 0.1 * rootPx, heading: 0.1 * rootPx })']] } });
  await settled(broken.page);
  await broken.page.waitForTimeout(800);
  const b = await flat(broken.page);
  check('control: a build whose minimum is zero keeps tiny words in the sky at 390 px, and is caught', b.words === 'surface' && b.lines.some(px => px < 14), `${b.words}; ${b.lines.map(px => `${px.toFixed(1)}px`).join(', ')}`);
  await broken.ctx.close();
}

// ── 4. findability ─────────────────────────────────────────────────────────
{
  /** Tab stops from the control before the scene until focus has passed the words. */
  const stops = async page => {
    await page.locator('#replay').focus();
    for (let k = 1; k <= 30; k++) {
      await page.keyboard.press('Tab');
      const past = await page.evaluate(() => {
        let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
        const el = window.__piece;
        return !!a && a !== document.body && !(a.getRootNode() === el.shadowRoot && a.dataset?.line !== undefined) && !el.contains(a);
      });
      if (past) return k;
    }
    return Infinity;
  };
  const q = await openAt(`${WORLD}&register=quiet`); await settled(q.page, 'panel'); const control = await stops(q.page); await q.ctx.close();
  const w = await openAt(`${WORLD}&register=warm`, { reduced: true }); await settled(w.page, 'surface'); const warm = await stops(w.page); await w.ctx.close();
  check('findability: warm needs no more tab stops to get past the words than the quiet panel plus one', warm <= control + 1, `warm ${warm}, quiet ${control}`);
  const broken = await openAt(`${WORLD}&register=warm`, { reduced: true, patch: { '../../type/surface.js': [['      scene?.holdReading?.(!!laid);', "      layer.querySelectorAll('[data-line]').forEach(s => { s.tabIndex = 0; });\n      scene?.holdReading?.(!!laid);"]] } });
  await settled(broken.page, 'surface');
  const bw = await stops(broken.page);
  check('control: a build where every line is a tab stop is caught', !(bw <= control + 1), `broken warm ${bw}`);
  await broken.ctx.close();
}

// ── 5. contrast ─────────────────────────────────────────────────────────────
{
  for (const theme of ['light', 'dark']) for (const [when, extra, reduced] of [['grown', '', true], ['half grown', '&progress=0.45', false]]) {
    const { ctx, page } = await openAt(`${WORLD}&register=warm&theme=${theme}${extra}`, { reduced });
    await settled(page, 'surface');
    const rows = await probeContrast(page);
    check(`contrast (${when}, ${theme}): 4.5:1 against every pixel under every line`, rows.length > 3 && rows.every(r => r.worst >= 4.5), summary(rows));
    await ctx.close();
  }
  const broken = await openAt(`${WORLD}&register=warm`, { reduced: true, patch: { 'model.js': [['const right = Math.min(SKY.x + measure, edge(top, bottom) - SKY.gap), w = right - SKY.x;', 'const right = SKY.x + measure, w = right - SKY.x; void edge;']], 'render.js': [['top: SKY.top, bottom: 420,', 'top: 300, bottom: 560,']] } });
  await settled(broken.page, 'surface');
  const rows = await probeContrast(broken.page);
  check('control: lines set down in the canopy (a shape that ignores it) are caught', rows.some(r => r.worst < 4.5), summary(rows));
  await broken.ctx.close();
  // control just under the line: the first build's dark (dark ink on a flat lavender dusk, worst pixel about 4.4)
  const flat = await openAt(`${WORLD}&register=warm&theme=dark`, { reduced: true, patch: { 'render.js': [
    ['g.fillStyle = dusk(g);', "g.fillStyle = 'rgba(96,104,150,0.55)';"],
    ["color: `var(--sg-text, ${INK})` });", 'color: INK });'],
  ] } });
  await settled(flat.page, 'surface');
  const flatRows = await probeContrast(flat.page), worst = Math.min(...flatRows.map(r => r.worst));
  check('control: the flat lavender dusk (worst just under 4.5:1) is caught', worst < 4.5 && worst > 4, `worst ${worst.toFixed(2)}: ${summary(flatRows)}`);
  await flat.ctx.close();
}

// ── 6. calm follows the lines ───────────────────────────────────────────────
{
  // two held moments of the growth in one quarter (the lines are laid against its end): deterministic frames.
  // (The harness's frozen clock can't be used: its sample paragraph ends above where the canopy grows.)
  const scene = p => `${WORLD}&register=playful&progress=${p}`;
  const shot = async (t, patch) => {
    const { ctx, page } = await openAt(scene(t), { patch });
    await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.words === 'surface', null, { timeout: 15000 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const s = await page.evaluate(() => {
      const sr = window.__piece.shadowRoot, cv = sr.querySelector('.stage canvas'), c = cv.getBoundingClientRect(), k = cv.width / c.width;
      const lines = [...sr.querySelectorAll('[data-line]')].map(e => { const r = e.getBoundingClientRect(); return { x: (r.left - c.left) * k, y: (r.top - c.top) * k, w: r.width * k, h: r.height * k }; });
      return { w: cv.width, h: cv.height, lines, px: Array.from(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data) };
    });
    await ctx.close();
    return s;
  };
  const inBox = (x, y, b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  const changed = (a, b, keep) => {
    let n = 0, c = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      if (!keep(x, y)) continue;
      const i = (y * a.w + x) * 4; n++;
      if (Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2]) > 40) c++;
    }
    return n ? c / n : 0;
  };
  // growth 0.34 and 0.45 (local 12.3 and 16.3 of 36.2): the canopy's shoulder comes up beside the words
  const measure = async patch => {
    const a = await shot(0.34, patch), b = await shot(0.45, patch), L = a.lines;
    const bb = { x: Math.min(...L.map(l => l.x)), y: Math.min(...L.map(l => l.y)) };
    bb.w = Math.max(...L.map(l => l.x + l.w)) - bb.x; bb.h = Math.max(...L.map(l => l.y + l.h)) - bb.y;
    const under = changed(a, b, (x, y) => L.some(l => inBox(x, y, l))), beside = changed(a, b, (x, y) => inBox(x, y, bb) && !L.some(l => inBox(x, y, l)));
    const tree = changed(a, b, (x, y) => y > bb.y + bb.h + 20);
    return { under, beside, tree, fmt: `under the words ${(under * 100).toFixed(2)}%, beside them ${(beside * 100).toFixed(2)}%, the tree ${(tree * 100).toFixed(1)}%` };
  };
  const good = await measure();
  check('calm: under the line boxes under 1% changes between two moments of a quarter, while the tree grows', good.under < 0.01 && good.tree > 0.01, good.fmt);
  check('calm follows the lines: the canopy grows into the gaps beside the words', good.beside > 0.002, good.fmt);
  const now = await measure({ 'model.js': [['export const layMoment = (local, endTime) => (local >= endTime ? endTime :', 'export const layMoment = (local, endTime) => (local >= endTime ? endTime : local ||']] });
  check('control: lines laid against the canopy as it is now (no look ahead) are caught', !(now.under < 0.01), now.fmt);
  const rect = await measure({ 'render.js': [['    host.dataset.grown =', "    if (words) { const L = words.lines, x0 = Math.min(...L.map(l => l.x)), y0 = Math.min(...L.map(l => l.y)); const x1 = Math.max(...L.map(l => l.x + l.w)), y1 = Math.max(...L.map(l => l.y + l.h)); g.save(); g.beginPath(); g.rect(x0 - 12, y0 - 12, x1 - x0 + 24, y1 - y0 + 24); g.clip(); st.blit(baseOf(data.tree)); g.restore(); }\n    host.dataset.grown ="]] });
  check('control: a whole-rectangle hold is caught (nothing grows beside the words)', !(rect.beside > 0.002), rect.fmt);
}

// ── lazy, requests, axe ────────────────────────────────────────────────────
{
  const load = async (path, words) => {
    const requests = [];
    const { ctx, page } = await openAt(path, { requests, reduced: true });
    if (words) await settled(page, words); else await page.waitForTimeout(2500);
    await ctx.close();
    return { pretext: requests.some(u => u.includes('/type/vendor/pretext.js')), outside: requests.filter(u => !u.startsWith(server.url) && /^https?:/.test(u)) };
  };
  const plain = await load('/packages/scenes/vad/demo.html?register=warm'), quiet = await load(`${WORLD}&register=quiet`, 'panel'), warm = await load(`${WORLD}&register=warm`, 'surface');
  check('lazy: the ordinary Vad and the quiet reading never load Pretext', !plain.pretext && !quiet.pretext, `ordinary ${plain.pretext}, quiet ${quiet.pretext}`);
  check('control: the world reading in warm does load it', warm.pretext, `warm ${warm.pretext}`);
  check('no request leaves the page (world)', !warm.outside.length && !quiet.outside.length, [...warm.outside, ...quiet.outside].join(', ') || 'none');
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await openAt(`/packages/scenes/vad/world.html?register=${register}&theme=${theme}`);
  await settled(page, register === 'quiet' ? 'panel' : 'surface');
  const v = await h.axe(page);
  check(`axe (world.html): ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await openAt('/packages/scenes/vad/world.html?register=warm', { width: 390, height: 844 });
  await settled(page, 'panel');
  const v = await h.axe(page);
  check('axe (world.html): warm at 390 px', v.length === 0, v.join('; ') || '0 violations');
  await ctx.close();
}

await h.done();
