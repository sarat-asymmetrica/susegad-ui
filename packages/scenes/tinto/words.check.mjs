// Browser gates for Tinto's words in the world (words="world"), from
// docs/requests/2026-09-28-words-in-the-world.md:
//
//   node packages/scenes/tinto/words.check.mjs
//
// Each gate has a broken control kept in this file: a patched build of Tinto,
// served in place of the real source by route interception, that the same
// probe must catch. A gate whose control passes is reported as failing.
//
// 1. real text: the board's words and the plaques are DOM text in the
//    accessibility tree, visible, on top; the plaques are buttons reached by
//    Tab with a focus ring you can see (control: the words painted on the
//    canvas with the DOM hidden);
// 2. reading order: the accessibility tree and Tab follow the declared order,
//    words then Mercado, Padaria, Taverna, then the people (control: the layer
//    in the picture's top-to-bottom order);
// 3. 200% text and 390 px: the words and shops go flat, with no clipping, no
//    overlap and no horizontal scroll (control: a build whose minimum is zero);
// 4. findability: keyboard stops to reach each piece in warm, no more than the
//    quiet flat list plus one (control: every person a tab stop first);
// 5. contrast: 4.5:1 against every canvas pixel under every line box and
//    plaque label, light and dark (control: the words on the bare square);
// 6. calm follows the lines: in playful, under the line boxes under 1% changes
//    while the chalk rain moves beside them (controls: rain that ignores the
//    lines; a whole-rectangle calm);
// plus Escape, lazy loading (no Pretext until words are placed), no request
// leaving the page, and axe in every register, light and dark, at 390 px and
// with a card open.

import { readFileSync } from 'node:fs';
import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check, browser, server } = h;
const src = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const WORLD = '/packages/scenes/tinto/world.html?only=world';
const DECLARED = ['Come for the rain', 'Our lowest rate', 'Mercado, Open 7 to 1', 'Padaria, Poi at 6 and 4', 'Taverna, Opens at 11', 'Two crows on the wire'];

/**
 * Open `path` in a fresh context. `patch` maps a file in this folder to
 * [from, to] pairs; the page gets the patched source instead of the real one
 * (each `from` must be found, or the control would silently be the real build).
 */
async function openAt(path, { width = 1280, height = 1000, reduced = false, patch = {}, root = null, requests = null } = {}) {
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  for (const [file, pairs] of Object.entries(patch)) {
    let body = src(file);
    for (const [from, to] of pairs) {
      if (!body.includes(from)) throw new Error(`patch for ${file} did not apply: ${from}`);
      body = body.replace(from, to);
    }
    const at = new URL(file, import.meta.url).pathname.replace(/^.*?\/packages\//, '/packages/'); // a file here, or ../../type/…
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
/** Wait until the words layer says where things are (the tier loads lazily), then two frames. */
async function settled(page, want) {
  const ok = await page.waitForFunction(w => {
    const st = document.querySelector('sg-scene[words=world]')?.shadowRoot?.querySelector('.stage');
    return st && (!w || (st.dataset.words === w.words && st.dataset.shops === w.shops));
  }, want, { timeout: 15000 }).then(() => true, () => false);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  return ok;
}
const where = page => page.evaluate(() => { const st = document.querySelector('sg-scene[words=world]').shadowRoot.querySelector('.stage'); return `${st.dataset.words}/${st.dataset.shops}`; });

// ── in-page probes ─────────────────────────────────────────────────────────

/** The words and plaques as the page shows them: text, box, size, and whether they are really visible. */
const probeText = page => page.evaluate(() => {
  const sr = document.querySelector('sg-scene[words=world]').shadowRoot, cv = sr.querySelector('.stage canvas');
  const c = cv.getBoundingClientRect();
  const seen = el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility !== 'visible' || +cs.opacity < 0.99 || cs.clipPath !== 'none') return false;
    const top = sr.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (top === el || el.contains(top));
  };
  const lines = [...sr.querySelectorAll('[data-line]')].map(s => ({ text: s.textContent, seen: seen(s), px: parseFloat(getComputedStyle(s).fontSize), tag: s.parentElement.tagName, inside: (() => { const r = s.getBoundingClientRect(); return r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1; })() }));
  const plaques = [...sr.querySelectorAll('.jn-plaque')].filter(b => b.offsetParent).map(b => ({ name: b.textContent, seen: seen(b), tag: b.tagName }));
  return { lines, plaques };
});
/** The deep focused element's label. */
const focusedName = page => page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a ? (a.textContent || a.getAttribute('aria-label') || a.tagName).trim() : ''; });

/** Contrast of each line box and plaque label against the canvas pixels under it: the share of pixels at 4.5:1 or better. */
const probeContrast = page => page.evaluate(() => {
  const sr = document.querySelector('sg-scene[words=world]').shadowRoot, cv = sr.querySelector('.stage canvas');
  const c = cv.getBoundingClientRect(), k = cv.width / c.width, g = cv.getContext('2d');
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
  const boxes = [
    ...[...sr.querySelectorAll('[data-line]')].map(s => ({ name: s.textContent.trim(), r: s.getBoundingClientRect(), color: getComputedStyle(s).color, el: s })),
    ...[...sr.querySelectorAll('.jn-plaque')].filter(b => b.offsetParent).map(b => { const s = b.querySelector('.jn-label'); return { name: b.textContent, r: s.getBoundingClientRect(), color: getComputedStyle(s).color, el: s }; }),
  ];
  // the text as it is really painted: its colour's alpha times every opacity up the tree, blended over each pixel
  // any CSS colour (oklch from the tokens, too) as sRGB and alpha, read back through a canvas pixel
  const rgba = css => { const x = new OffscreenCanvas(1, 1).getContext('2d'); x.fillStyle = css; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const alphaOf = (e, a) => { for (let n = e; n; n = n.parentElement ?? n.getRootNode().host) a *= +getComputedStyle(n).opacity; return a; };
  return boxes.map(({ name, r, color, el }) => {
    const [tr, tg, tb, ta] = rgba(color), al = alphaOf(el, ta);
    const x = Math.round((r.left - c.left) * k), y = Math.round((r.top - c.top) * k), w = Math.round(r.width * k), hh = Math.round(r.height * k);
    const d = g.getImageData(x, y, Math.max(1, w), Math.max(1, hh)).data;
    let ok = 0, n = 0, worst = 99;
    for (let i = 0; i < d.length; i += 4) {
      const lb = L(d[i], d[i + 1], d[i + 2]), lt = L(tr * al + d[i] * (1 - al), tg * al + d[i + 1] * (1 - al), tb * al + d[i + 2] * (1 - al));
      const ratio = (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05);
      n++; if (ratio >= 4.5) ok++; worst = Math.min(worst, ratio);
    }
    return { name, share: ok / n, worst };
  });
});

// ── 1. real text ──────────────────────────────────────────────────────────
{
  const realText = async page => {
    const { lines, plaques } = await probeText(page);
    const tree = await page.locator('sg-scene[words=world]').ariaSnapshot();
    const words = 'Come for the rain Our lowest rate, June to September. The veranda stays dry and the paddy turns green.'.split(' ');
    const onBoard = lines.map(l => l.text).join('').replace(/\s+/g, ' ');
    const missing = words.filter(w => !onBoard.includes(w) || !tree.includes(w));
    const hidden = lines.filter(l => !l.seen || !l.inside).map(l => l.text.trim());
    const buttons = ['Mercado, Open 7 to 1', 'Padaria, Poi at 6 and 4', 'Taverna, Opens at 11'];
    const btnMissing = [];
    for (const name of buttons) if (!(await page.getByRole('button', { name, exact: true }).count())) btnMissing.push(name);
    const ok = lines.length > 0 && !missing.length && !hidden.length && !btnMissing.length && plaques.every(p => p.seen && p.tag === 'BUTTON');
    return { ok, detail: `${lines.length} lines on the board, ${plaques.length} plaques${missing.length ? `; not DOM text: ${missing.slice(0, 5).join(' ')}` : ''}${hidden.length ? `; not visible: ${hidden.join(' | ')}` : ''}${btnMissing.length ? `; no button: ${btnMissing.join(', ')}` : ''}${plaques.filter(p => !p.seen).map(p => `; plaque not seen: ${p.name}`).join('')}` };
  };
  const { ctx, page, errors } = await openAt(`${WORLD}&register=warm`);
  await settled(page, { words: 'board', shops: 'plaques' });
  const r = await realText(page);
  check('real text: the board’s words and the plaques are visible DOM text, in the accessibility tree', r.ok, r.detail);
  // Tab reaches the plaques, and focus shows
  await page.locator('#dark').focus();
  const names = [];
  for (let k = 0; k < 3; k++) { await page.keyboard.press('Tab'); names.push(await focusedName(page)); }
  check('real text: Tab reaches each plaque as a button', names.join(' | ') === 'Mercado, Open 7 to 1 | Padaria, Poi at 6 and 4 | Taverna, Opens at 11', names.join(' | '));
  const plaque = page.getByRole('button', { name: 'Mercado, Open 7 to 1' }), box = await plaque.boundingBox();
  const clip = { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 };
  await page.locator('#dark').focus();
  const before = await page.screenshot({ clip });
  await page.keyboard.press('Tab');
  const after = await page.screenshot({ clip });
  const changed = await page.evaluate(async ([a, b]) => {
    const img = async s => { const i = new Image(); i.src = `data:image/png;base64,${s}`; await i.decode(); const c = new OffscreenCanvas(i.width, i.height), g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const x = await img(a), y = await img(b);
    let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 60) n++;
    return n / (x.length / 4);
  }, [before.toString('base64'), after.toString('base64')]);
  check('real text: a keyboard focus ring shows round the plaque', changed > 0.05, `${(changed * 100).toFixed(1)}% of the pixels round it change on focus`);
  check('no console errors (world, warm)', errors.length === 0, errors.join(' | '));
  await ctx.close();

  const broken = await openAt(`${WORLD}&register=warm`, { patch: {
    'words.js': [['        board.append(...els);', "        board.append(...els); board.style.display = 'none';"]],
    'render.js': [['drawBoard(g); if (rain)', "drawBoard(g); g.save(); g.fillStyle = '#f4f1e7'; g.font = '20px Kalam'; for (const l of bd.lines) g.fillText(l.text, l.x, l.y + l.h * 0.8); g.restore(); if (rain)"]],
  } });
  await settled(broken.page, { words: 'board', shops: 'plaques' });
  const rb = await realText(broken.page);
  check('control: a build that paints the words on the canvas and hides the DOM text is caught', !rb.ok, rb.detail);
  await broken.ctx.close();
}

// ── 2. reading order ──────────────────────────────────────────────────────
{
  const order = async page => {
    // case-insensitive: the plaque says 'Open 7 to 1', the flat list 'Mercado, open 7 to 1'
    const tree = (await page.locator('sg-scene[words=world]').ariaSnapshot()).toLowerCase();
    const at = DECLARED.map(s => tree.indexOf(s.toLowerCase()));
    const inOrder = a => a.every((v, i) => v >= 0 && (i === 0 || v > a[i - 1]));
    return { ok: inOrder(at), wordsAndShops: inOrder(at.slice(0, 5)), detail: DECLARED.map((s, i) => `${s.slice(0, 14)}@${at[i]}`).join('; ') };
  };
  for (const register of ['warm', 'quiet']) {
    const { ctx, page } = await openAt(`${WORLD}&register=${register}`);
    await settled(page, register === 'warm' ? { words: 'board', shops: 'plaques' } : { words: 'panel', shops: 'list' });
    const r = await order(page);
    // quiet: Tinto's list of people already comes before its panel (unchanged here), so quiet is held to the words and shops
    check(`reading order (${register}): the accessibility tree follows the declared order${register === 'quiet' ? ' (words, then shops)' : ''}`, register === 'warm' ? r.ok : r.wordsAndShops, r.detail);
    await ctx.close();
  }
  const broken = await openAt(`${WORLD}&register=warm`, { patch: { 'words.js': [['    onChange: () => { key = \'\'; invalidate(); },\n  });', "    onChange: () => { key = ''; invalidate(); },\n  });\n  layer.append(board); // the picture's order: the plaques (higher up) before the board"]] } });
  await settled(broken.page, { words: 'board', shops: 'plaques' });
  const rb = await order(broken.page);
  check('control: the layer in the picture’s top-to-bottom order is caught', !rb.ok, rb.detail);
  await broken.ctx.close();
}

// ── 3. 200% text and a 390 px phone ─────────────────────────────────────────
{
  const MIN = { H2: 20, P: 14 };
  const flatCheck = async (page, root = 16) => {
    const r = await page.evaluate(() => {
      const el = document.querySelector('sg-scene[words=world]'), sr = el.shadowRoot, st = sr.querySelector('.stage');
      const box = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
      const panel = sr.querySelector('.panel'), list = sr.querySelector('.jn-flat');
      return {
        words: st.dataset.words, shops: st.dataset.shops, panel: panel.hidden ? null : box(panel), list: list.hidden ? null : box(list),
        lines: [...sr.querySelectorAll('[data-line]')].map(s => ({ tag: s.parentElement.tagName, px: parseFloat(getComputedStyle(s).fontSize) })),
        scroll: document.documentElement.scrollWidth, vw: innerWidth,
        clipped: [...el.children, ...sr.querySelectorAll('.jn-flat li')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.left < -1 || b.right > innerWidth + 1); }).length,
      };
    });
    const small = r.lines.filter(l => l.px < MIN[l.tag === 'P' ? 'P' : 'H2'] * (root / 16) - 0.01);
    const overlap = r.panel && r.list && r.panel.b > r.list.t + 1 && r.panel.t < r.list.b;
    return { r, small, overlap };
  };
  for (const [name, opts, root] of [['390 px', { width: 390, height: 844 }, 16], ['text at 200%', { width: 1280 }, 32]]) {
    const { ctx, page, errors } = await openAt(`${WORLD}&register=warm`, { ...opts, root: root === 32 ? '200%' : null });
    const ok = await settled(page, { words: 'panel', shops: 'list' });
    const { r, small, overlap } = await flatCheck(page, root);
    check(`${name}: the words go to the panel and the shops to the list`, ok && r.panel && r.list && !r.lines.length, `${r.words}/${r.shops}, panel ${r.panel ? `${Math.round(r.panel.w)}x${Math.round(r.panel.h)}` : 'hidden'}, list ${r.list ? 'shown' : 'hidden'}`);
    check(`${name}: no clipping, no overlap, no horizontal scroll`, r.scroll <= r.vw && !r.clipped && !overlap && !small.length, `scroll ${r.scroll} in ${r.vw}, ${r.clipped} clipped, overlap ${!!overlap}`);
    if (errors.length) check(`no console errors (${name})`, false, errors.join(' | '));
    await ctx.close();
  }
  // at desktop size every board line is at least its minimum
  {
    const { ctx, page } = await openAt(`${WORLD}&register=warm`);
    await settled(page, { words: 'board', shops: 'plaques' });
    const { r, small } = await flatCheck(page);
    check('1280 px: the board holds the words, every line at or over its minimum', r.words === 'board' && r.lines.length > 0 && !small.length, r.lines.map(l => `${l.tag} ${l.px}px`).join(', '));
    await ctx.close();
  }
  const broken = await openAt(`${WORLD}&register=warm`, { width: 390, height: 844, patch: { 'model.js': [
    ['({ body: 0.875 * rootPx, heading: 1.25 * rootPx, label: 0.75 * rootPx, target: 24 })', '({ body: 0.1 * rootPx, heading: 0.1 * rootPx, label: 0.1 * rootPx, target: 1 })'],
    ['export const PLAQUE_H = 36;', 'export const PLAQUE_H = 999;'],
  ] } });
  await settled(broken.page);
  await broken.page.waitForTimeout(800);
  const b = await flatCheck(broken.page);
  check('control: a build whose minimum is zero keeps tiny words on the board at 390 px, and is caught', b.r.words === 'board' && b.small.length > 0, `${b.r.words}/${b.r.shops}; ${b.small.length} lines under the minimum (${b.r.lines.map(l => `${l.px.toFixed(1)}px`).join(', ')})`);
  await broken.ctx.close();
}

// ── 4. findability ─────────────────────────────────────────────────────────
{
  const ITEMS = ['words', 'Mercado', 'Padaria', 'Taverna'];
  /** Keyboard stops from the control before the scene to each piece: Tab presses to its control (or past it), plus one press to open a detail. */
  const stops = async (page, register) => {
    await page.locator('#dark').focus();
    const got = {};
    for (let k = 1; k <= 40 && Object.keys(got).length < ITEMS.length; k++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
        const inScene = a && a.getRootNode() === document.querySelector('sg-scene[words=world]').shadowRoot;
        return { text: a?.textContent?.trim() ?? '', inScene };
      });
      if (!got.words && f.inScene) got.words = k; // the words come before every stop in the scene
      for (const s of ITEMS.slice(1)) if (!got[s] && f.inScene && f.text.startsWith(s)) {
        got[s] = k + 1; // and one press opens its detail
        await page.keyboard.press('Enter');
        const shown = await page.evaluate(name => {
          const sr = document.querySelector('sg-scene[words=world]').shadowRoot;
          const card = [...sr.querySelectorAll('.jn-card')].find(c => !c.hidden), det = [...sr.querySelectorAll('.jn-flat details')].find(d => d.open);
          return (card && card.getBoundingClientRect().height > 0) || (det && det.textContent.startsWith(name));
        }, s);
        if (!shown) got[s] = Infinity;
        await page.keyboard.press(register === 'quiet' ? 'Enter' : 'Escape'); // close it again
      }
    }
    return ITEMS.map(s => got[s] ?? Infinity);
  };
  const q = await openAt(`${WORLD}&register=quiet`);
  await settled(q.page, { words: 'panel', shops: 'list' });
  const control = await stops(q.page, 'quiet');
  await q.ctx.close();
  const w = await openAt(`${WORLD}&register=warm`);
  await settled(w.page, { words: 'board', shops: 'plaques' });
  const warm = await stops(w.page, 'warm');
  await w.ctx.close();
  const fmt = a => ITEMS.map((s, i) => `${s} ${a[i]}`).join(', ');
  check('findability: warm needs no more keyboard stops than the quiet list plus one, for every piece', warm.every((v, i) => v <= control[i] + 1), `warm: ${fmt(warm)}; quiet: ${fmt(control)}`);
  const broken = await openAt(`${WORLD}&register=warm`, { patch: { 'render.js': [
    ['  host.after(list, live);\n  // words in the world: the board and the plaques (placed before the list, so they are read first)\n  const words = createWords({ host, scene: sceneEl, W, H, invalidate });',
      '  const words = createWords({ host, scene: sceneEl, W, H, invalidate });\n  host.after(list, live);\n  for (const li of ul.children) li.tabIndex = 0; // every person a stop before the shops'],
  ] } });
  await settled(broken.page, { words: 'board', shops: 'plaques' });
  const bw = await stops(broken.page, 'warm');
  check('control: a build where each of the seventeen people is a tab stop first is caught', !bw.every((v, i) => v <= control[i] + 1), `broken warm: ${fmt(bw)}`);
  await broken.ctx.close();
}

// ── 5. contrast against the pixels under the words ───────────────────────────
{
  const summary = rows => rows.map(r => `${r.name.slice(0, 18)} ${(r.share * 100).toFixed(1)}% (worst ${r.worst.toFixed(1)})`).join('; ');
  for (const theme of ['light', 'dark']) for (const register of ['warm', 'playful']) {
    const { ctx, page } = await openAt(`${WORLD}&register=${register}&theme=${theme}`);
    await settled(page, { words: 'board', shops: 'plaques' });
    const rows = await probeContrast(page);
    check(`contrast (${register}, ${theme}): 4.5:1 against every pixel under every line and plaque label`, rows.length >= 7 && rows.every(r => r.worst >= 4.5), summary(rows));
    await ctx.close();
  }
  const broken = await openAt(`${WORLD}&register=warm`, { patch: { 'render.js': [['drawBoard(g); if (rain)', 'if (rain)']] } });
  await settled(broken.page, { words: 'board', shops: 'plaques' });
  const rows = (await probeContrast(broken.page)).filter(r => !/Open|Poi/.test(r.name));
  check('control: the words set on the bare square (no board) are caught', rows.some(r => r.worst < 4.5), summary(rows));
  await broken.ctx.close();
  // the bug this gate found in its first run: core's pause-button style dimmed every plaque to 0.72
  const dim = await openAt(`${WORLD}&register=warm&theme=dark`, { patch: { '../../type/junctions.js': [['white-space:nowrap;opacity:1;transition:none}', 'white-space:nowrap}']] } });
  await settled(dim.page, { words: 'board', shops: 'plaques' });
  const dimRows = (await probeContrast(dim.page)).filter(r => /Open|Poi/.test(r.name));
  check('control: plaques dimmed by the pause button’s opacity are caught (dark)', dimRows.some(r => r.worst < 4.5), summary(dimRows));
  await dim.ctx.close();
}

// ── 6. calm follows the lines ───────────────────────────────────────────────
{
  const scene = q => `/tools/harness/scene.html?name=tinto&words=world&content=1&register=playful&${q}`;
  /** The canvas at a frozen moment, and the line boxes and slate in canvas pixels. */
  const frozenAt = async (t, patch) => {
    const { ctx, page } = await openAt(scene(`freeze=${t}`), { patch });
    await page.waitForFunction(() => window.__frozen === true, null, { timeout: 30000 });
    await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.words === 'board', null, { timeout: 15000 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const shot = await page.evaluate(() => {
      const sr = window.__piece.shadowRoot, cv = sr.querySelector('.stage canvas'), c = cv.getBoundingClientRect(), k = cv.width / c.width;
      const lines = [...sr.querySelectorAll('[data-line]')].map(s => { const r = s.getBoundingClientRect(); return { x: (r.left - c.left) * k, y: (r.top - c.top) * k, w: r.width * k, h: r.height * k }; });
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      return { w: cv.width, h: cv.height, k: cv.width / 1200, lines, px: Array.from(d) };
    });
    await ctx.close();
    return shot;
  };
  const inBox = (x, y, b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  /** Share of pixels that changed, in the region `keep(x, y)` picks. */
  const changed = (a, b, keep) => {
    let n = 0, c = 0;
    for (let y = 0; y < a.h; y += 1) for (let x = 0; x < a.w; x += 1) {
      if (!keep(x, y)) continue;
      const i = (y * a.w + x) * 4; n++;
      if (Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2]) > 40) c++;
    }
    return n ? c / n : 0;
  };
  const measure = async patch => {
    const a = await frozenAt(4, patch), b = await frozenAt(7, patch);
    const L = a.lines, bb = { x: Math.min(...L.map(l => l.x)), y: Math.min(...L.map(l => l.y)), w: 0, h: 0 };
    bb.w = Math.max(...L.map(l => l.x + l.w)) - bb.x; bb.h = Math.max(...L.map(l => l.y + l.h)) - bb.y;
    const under = changed(a, b, (x, y) => L.some(l => inBox(x, y, l)));
    // beside the words: inside the lines' own rectangle, but in no line box (the gaps a whole-rectangle calm would freeze)
    const beside = changed(a, b, (x, y) => inBox(x, y, bb) && !L.some(l => inBox(x, y, l)));
    const elsewhere = changed(a, b, (x, y) => y > 600 * a.k);
    return { under, beside, elsewhere, fmt: `under the words ${(under * 100).toFixed(2)}%, beside them ${(beside * 100).toFixed(2)}%, the square ${(elsewhere * 100).toFixed(1)}%` };
  };
  const good = await measure();
  check('calm: under the line boxes under 1% changes between 4 s and 7 s, while the square moves', good.under < 0.01 && good.elsewhere > 0.01, good.fmt);
  check('calm follows the lines: the chalk rain still moves beside the words, inside their rectangle', good.beside > 0.002, good.fmt);
  const noCalm = await measure({ 'render.js': [['chalkRain(g, data.time, bd.calm)', 'chalkRain(g, data.time, [])']] });
  check('control: rain that ignores the line boxes is caught', !(noCalm.under < 0.01), noCalm.fmt);
  const rect = await measure({ 'render.js': [['chalkRain(g, data.time, bd.calm)', 'chalkRain(g, data.time, [bd.calm.reduce((u, c) => ({ x: Math.min(u.x, c.x), y: Math.min(u.y, c.y), w: Math.max(u.x + u.w, c.x + c.w) - Math.min(u.x, c.x), h: Math.max(u.y + u.h, c.y + c.h) - Math.min(u.y, c.y) }))])']] });
  check('control: a whole-rectangle calm is caught (nothing moves beside the words)', !(rect.beside > 0.002), rect.fmt);
}

// ── Escape, lazy loading, requests, axe ─────────────────────────────────────
{
  const { ctx, page } = await openAt(`${WORLD}&register=warm`);
  await settled(page, { words: 'board', shops: 'plaques' });
  const b = page.getByRole('button', { name: 'Taverna, Opens at 11' });
  await b.focus(); await page.keyboard.press('Enter');
  const expanded = await b.getAttribute('aria-expanded');
  const v = await h.axe(page);
  check('axe with the Taverna’s card open', v.length === 0, v.join('; ') || '0 violations');
  await page.keyboard.press('Escape');
  const after = [await b.getAttribute('aria-expanded'), await focusedName(page)];
  check('a plaque opens its card, and Escape closes it and gives focus back', expanded === 'true' && after[0] === 'false' && after[1] === 'Taverna, Opens at 11', `open ${expanded}, then ${after.join(', ')}`);
  await ctx.close();
}
{
  const load = async (path, want) => {
    const requests = [];
    const { ctx, page } = await openAt(path, { requests });
    if (want) await settled(page, want); else await page.waitForTimeout(2500);
    await ctx.close();
    return { pretext: requests.some(u => u.includes('/type/vendor/pretext.js')), outside: requests.filter(u => !u.startsWith(server.url) && /^https?:/.test(u)) };
  };
  const plain = await load('/packages/scenes/tinto/demo.html?register=warm');
  const quiet = await load(`${WORLD}&register=quiet`, { words: 'panel', shops: 'list' });
  const warm = await load(`${WORLD}&register=warm`, { words: 'board', shops: 'plaques' });
  check('lazy: the ordinary Tinto and the quiet reading never load Pretext', !plain.pretext && !quiet.pretext, `ordinary ${plain.pretext}, quiet ${quiet.pretext}`);
  check('control: the world reading in warm does load it (the probe can see it)', warm.pretext, `warm ${warm.pretext}`);
  check('no request leaves the page (world)', !warm.outside.length && !quiet.outside.length, [...warm.outside, ...quiet.outside].join(', ') || 'none');
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await openAt(`/packages/scenes/tinto/world.html?register=${register}&theme=${theme}`);
  await settled(page, register === 'quiet' ? { words: 'panel', shops: 'list' } : { words: 'board', shops: 'plaques' });
  const v = await h.axe(page);
  check(`axe (world.html): ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await openAt(`/packages/scenes/tinto/world.html?register=warm`, { width: 390, height: 844 });
  await settled(page, { words: 'panel', shops: 'list' });
  const v = await h.axe(page);
  check('axe (world.html): warm at 390 px', v.length === 0, v.join('; ') || '0 violations');
  await ctx.close();
}

await h.done();
