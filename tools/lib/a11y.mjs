// The browser half of the accessibility passes (decisions are in a11y.core.js). Each function takes a Playwright
// page that has settled, gathers facts, and returns what the core judges. Nothing here decides pass or fail,
// except what the baseline file holds, which is read and written here.

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../serve.mjs';
import {
  OPEN_ACTIONS, REGISTER_CELLS, baselineName, cellName, compareBaseline, exemptionsFor, judgeContrast, judgeForced,
  normaliseSnapshot, parseOpenMeta, treeInvariants,
} from './a11y.core.js';

// SG_A11Y_BASELINE_DIR points a run at another folder, which is how smoke.check.mjs records and breaks baselines without touching the real ones
export const BASELINE_DIR = process.env.SG_A11Y_BASELINE_DIR || path.join(REPO_ROOT, 'tools', 'a11y-baseline');
const EXEMPT_FILE = 'exempt.json';

export function loadExemptions(dir = BASELINE_DIR) {
  let text;
  try { text = fs.readFileSync(path.join(dir, EXEMPT_FILE), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  // a file that does not parse is an error, never an empty list: a silent fallback would drop every exemption and say nothing
  try { return JSON.parse(text).rules ?? []; } catch (e) { throw new Error(`${EXEMPT_FILE} in ${dir} is not valid JSON: ${e.message}`); }
}

// ── the tree ──

/**
 * Snapshot, normalise, judge the invariants, and hold it against (or record) the baseline. The baseline is Chromium's: WebKit
 * and Firefox build a different tree for the same page (WebKit adds group, list and status nodes), so there `baseline: false`
 * judges the invariants only and neither compares nor records.
 */
export async function treePass(page, pagePath, { baseline: useBaseline = true, record = false, dir = BASELINE_DIR, exemptRules = loadExemptions(dir) } = {}) {
  const raw = await page.locator('body').ariaSnapshot();
  const { text, masked } = normaliseSnapshot(raw, pagePath);
  const inv = treeInvariants(text, exemptionsFor(pagePath, exemptRules));
  const file = path.join(dir, baselineName(pagePath));
  let baseline = null;
  if (!useBaseline) { /* invariants only */ } else if (record) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, text);
  } else {
    let recorded = null;
    try { recorded = fs.readFileSync(file, 'utf8'); } catch { /* none recorded */ }
    baseline = compareBaseline(recorded, text);
  }
  return { problems: inv.problems, exempted: inv.exempted, counts: inv.counts, masked, baseline, recorded: record && useBaseline, compared: useBaseline };
}

// ── contrast over canvas ──

/** The most text boxes one page may have measured. A page past it is measured up to here and reported as "N of M", never silently cut. */
const MAX_BOXES = 2000;

/** Runs in the page: text boxes (page coordinates) that sit over a visible canvas, with their painted fill colour. */
const collectBoxes = max => {
  const canvases = [], texts = [];
  const walk = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) texts.push(n); } else {
        if (n.localName === 'canvas') canvases.push(n);
        if (n.shadowRoot) walk(n.shadowRoot);
      }
    }
  };
  walk(document.body);
  const sx = scrollX, sy = scrollY;
  const rects = canvases.filter(c => c.checkVisibility()).map(c => c.getBoundingClientRect()).filter(r => r.width > 8 && r.height > 8);
  if (!rects.length) return { boxes: [], canvases: 0 };
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  probe.canvas.width = probe.canvas.height = 1;
  const rgba = css => { probe.clearRect(0, 0, 1, 1); probe.fillStyle = '#000'; probe.fillStyle = css; probe.fillRect(0, 0, 1, 1); const d = probe.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const opacityOf = el => { let o = 1; for (let e = el; e; e = e.parentElement || e.getRootNode()?.host) o *= Number(getComputedStyle(e).opacity); return o; };
  // visually hidden text (the sr-only pattern: a 1px clipped box) is for readers, not eyes, so it is not measured
  const clipped = el => { for (let e = el; e; e = e.parentElement || e.getRootNode()?.host) { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); if (cs.overflow !== 'visible' && (r.width < 4 || r.height < 4)) return true; if (/^rect\(\s*0(px)?[ ,]+0(px)?[ ,]+0(px)?[ ,]+0(px)?\s*\)$/.test(cs.clip) || /^inset\(\s*(50|100)%/.test(cs.clipPath)) return true; } return false; };
  const boxes = [];
  for (const t of texts) {
    const el = t.parentElement;
    if (!el || el.closest('script,style,noscript,canvas') || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true } ) || clipped(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(t);
    const r = range.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const hit = rects.some(c => {
      const w = Math.min(r.right, c.right) - Math.max(r.left, c.left), h = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
      return w > 0 && h > 0 && (w * h) / (r.width * r.height) >= 0.25;
    });
    if (!hit) continue;
    const cs = getComputedStyle(el);
    const fill = rgba(cs.webkitTextFillColor || cs.color);
    fill[3] *= opacityOf(el);
    if (fill[3] < 0.05) continue;
    boxes.push({
      text: t.nodeValue.trim().replace(/\s+/g, ' ').slice(0, 40), color: fill, large: parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700),
      x: Math.floor(r.left + sx), y: Math.floor(r.top + sy), w: Math.ceil(r.width), h: Math.ceil(r.height),
    });
  }
  // every box is measured; the cap is a runaway guard, and a page that reaches it says so (found and measured are both printed)
  return { boxes: boxes.slice(0, max), found: boxes.length, canvases: rects.length };
};

/** Runs in the page: decode a PNG band and return, for each box, a flat RGB list of its pixels (every second pixel each way). */
const samplePixels = async ({ b64, bandY, boxes }) => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const cv = Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0);
  return boxes.map(b => {
    const x = Math.max(0, b.x), y = Math.max(0, b.y - bandY), w = Math.min(b.w, bmp.width - x), h = Math.min(b.h, bmp.height - y);
    if (w < 1 || h < 1) return [];
    const d = cx.getImageData(x, y, w, h).data;
    const out = [];
    for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) { const k = (j * w + i) * 4; out.push(d[k], d[k + 1], d[k + 2]); }
    return out;
  });
};

const HIDE_TEXT = '*,*::before,*::after,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;caret-color:transparent!important;transition:none!important}';
const BAND = 4000;

/**
 * Text over a canvas: find the boxes, take the page with every glyph made transparent (so the pixels are what is behind
 * the words: the canvas and any scrim or panel the page puts between), sample them, and judge.
 * Reads one frame of a moving scene; the worst box is scored at its lowest quarter of pixels (WORST_SHARE in a11y.core.js).
 */
export async function contrastPass(page) {
  const { boxes, found = boxes.length, canvases } = await page.evaluate(collectBoxes, MAX_BOXES);
  if (!boxes.length) return { canvases, found, boxes: 0, worst: null, failing: [] };
  const style = await page.addStyleTag({ content: HIDE_TEXT });
  try {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); // the hide-text style has painted
    boxes.sort((a, b) => a.y - b.y);
    const measured = [];
    for (let i = 0; i < boxes.length;) {
      let j = i;
      while (j < boxes.length && boxes[j].y + boxes[j].h - boxes[i].y <= BAND) j++;
      if (j === i) j = i + 1;
      const band = boxes.slice(i, j);
      const y0 = Math.max(0, Math.min(...band.map(b => b.y)));
      const y1 = Math.max(...band.map(b => b.y + b.h));
      const x0 = Math.max(0, Math.min(...band.map(b => b.x)));
      const x1 = Math.max(...band.map(b => b.x + b.w));
      const png = await page.screenshot({ clip: { x: 0, y: y0, width: x1, height: Math.max(1, y1 - y0) }, fullPage: true, scale: 'css', animations: 'allow' });
      const px = await page.evaluate(samplePixels, { b64: png.toString('base64'), bandY: y0, boxes: band.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h })) });
      band.forEach((b, k) => measured.push({ text: b.text, color: b.color, large: b.large, samples: px[k] }));
      i = j;
    }
    return { canvases, found, ...judgeContrast(measured) };
  } finally {
    await style.evaluate(el => el.remove()).catch(() => {});
  }
}

// ── forced colours ──

/** Runs in the page under forced colours: the focusable controls and the texts, as plain facts. */
const forcedFacts = () => {
  const els = [], texts = [];
  const walk = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) texts.push(n); } else {
        els.push(n);
        if (n.shadowRoot) walk(n.shadowRoot);
      }
    }
  };
  walk(document.body);
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  probe.canvas.width = probe.canvas.height = 1;
  const rgba = css => { probe.clearRect(0, 0, 1, 1); probe.fillStyle = '#000'; probe.fillStyle = css; probe.fillRect(0, 0, 1, 1); const d = probe.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const shown = el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const opacityOf = el => { let o = 1; for (let e = el; e; e = e.parentElement || e.getRootNode()?.host) o *= Number(getComputedStyle(e).opacity); return o; };
  const tmp = document.createElement('div');
  tmp.style.cssText = 'background-color:Canvas;position:absolute;width:1px;height:1px';
  document.body.append(tmp);
  const canvasColour = getComputedStyle(tmp).backgroundColor;
  tmp.remove();
  const ground = el => {
    // the first painted background up the tree; null where a picture or video is the ground (not judged)
    for (let e = el; e; e = e.parentElement || e.getRootNode()?.host) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return null;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0.99) return c.slice(0, 3);
    }
    return rgba(canvasColour).slice(0, 3);
  };
  const FOCUSABLE = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]:not([tabindex="-1"]),[role=button],[role=menuitem],[role=tab]';
  const controls = els.filter(e => e.matches(FOCUSABLE) && shown(e) && !e.disabled).map(e => {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const side = s => cs[`border${s}Style`] !== 'none' && parseFloat(cs[`border${s}Width`]) > 0 && rgba(cs[`border${s}Color`])[3] > 0;
    const type = e.localName === 'input' ? e.type : '';
    return {
      label: `${e.localName}${e.id ? `#${e.id}` : e.className && typeof e.className === 'string' ? `.${e.className.trim().split(/\s+/)[0]}` : ''}`,
      hasText: !!(e.innerText || '').trim() || !!(e.value && type !== 'file' && type !== 'range' && type !== 'color' && type !== 'checkbox' && type !== 'radio'),
      border: ['Top', 'Right', 'Bottom', 'Left'].some(side),
      outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
      graphic: !!e.querySelector('svg,img,canvas,video,picture') || type === 'image' || /^(video|audio|canvas|img|svg)$/.test(e.localName),
      // a glyph or a painted box drawn by ::before or ::after (a play triangle, "CC"), or a range's track or thumb: what the page draws without a text node
      pseudo: ['::before', '::after'].some(q => { const ps = getComputedStyle(e, q); return (ps.content && !['none', 'normal', '""', "''"].includes(ps.content)) || (ps.display !== 'none' && rgba(ps.backgroundColor)[3] > 0 && parseFloat(ps.width) > 0 && parseFloat(ps.height) > 0); }),
      // a range slider styled through ::-webkit-slider-* is taken as drawn: the browser paints a track in forced colours, but this does not measure it
      native: cs.appearance !== 'none' && /^(checkbox|radio|color|file|date|time|number)$/.test(type) || type === 'range',
    };
  }).filter(Boolean);
  // visually hidden text (the sr-only pattern: a 1px clipped box) is for readers, not eyes, so it is not measured
  const clipped = el => { for (let e = el; e; e = e.parentElement || e.getRootNode()?.host) { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); if (cs.overflow !== 'visible' && (r.width < 4 || r.height < 4)) return true; if (/^rect\(\s*0(px)?[ ,]+0(px)?[ ,]+0(px)?[ ,]+0(px)?\s*\)$/.test(cs.clip) || /^inset\(\s*(50|100)%/.test(cs.clipPath)) return true; } return false; };
  const out = [];
  for (const t of texts) {
    const el = t.parentElement;
    if (!el || el.closest('script,style,noscript') || !shown(el) || clipped(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    // under forced colours the browser paints `color`, whatever -webkit-text-fill-color still reads
    const fill = rgba(cs.color);
    fill[3] *= opacityOf(el);
    out.push({ text: t.nodeValue.trim().replace(/\s+/g, ' ').slice(0, 40), color: fill, ground: ground(el) });
    if (out.length >= 400) break;
  }
  return { controls, texts: out };
};

export async function forcedPass(page, pagePath, { exemptRules = loadExemptions() } = {}) {
  return judgeForced(await page.evaluate(forcedFacts), exemptionsFor(pagePath, exemptRules).controls ?? []);
}

// ── registers and themes ──

/** Switch the page's register and theme the way waitReady does, and wait for colour transitions to finish. */
async function setCell(page, cell) {
  await page.evaluate(({ register, theme }) => { const d = document.documentElement.dataset; d.register = register; d.theme = theme; }, cell);
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))),
    new Promise(r => setTimeout(r, 1500)),
  ]));
  await page.waitForTimeout(250);
}

/** axe on the page as it stands: violation lines. `runAxe` is the caller's (it has already put axe in the page). */
export async function axeCells(page, runAxe) {
  const prior = await page.evaluate(() => ({ register: document.documentElement.dataset.register, theme: document.documentElement.dataset.theme }));
  const cells = {};
  for (const cell of REGISTER_CELLS) {
    await setCell(page, cell);
    const lines = await runAxe(page);
    if (lines.length) cells[cellName(cell)] = lines;
  }
  await page.evaluate(({ register, theme }) => { const d = document.documentElement.dataset; if (register === undefined) delete d.register; else d.register = register; if (theme === undefined) delete d.theme; else d.theme = theme; }, prior);
  return cells;
}

// ── open states ──

/** The open actions of a page: its entry in the table, and any it declares with <meta name="smoke-open">. */
export async function openActionsFor(page, pagePath) {
  const declared = parseOpenMeta(await page.evaluate(() => [...document.querySelectorAll('meta[name="smoke-open"]')].map(m => m.content)));
  return [...(OPEN_ACTIONS[pagePath] ?? []), ...declared];
}

/**
 * For each action: click, wait for the open state, axe, close. Returns { opens: {name: [violations]}, errors: [], reached: [names axe ran in] }.
 * An action whose trigger is missing or whose state never appears is an error, not a pass: a list that rots must be red.
 */
export async function openPass(page, actions, runAxe) {
  const opens = {}, errors = [], reached = [];
  for (const a of actions) {
    try {
      await page.locator(a.open).first().click({ timeout: 4000 });
      await page.waitForSelector(a.expect, { state: 'visible', timeout: 4000 });
      reached.push(a.name);
      await page.waitForTimeout(350);
      const lines = await runAxe(page);
      if (lines.length) opens[a.name] = lines;
    } catch (e) {
      errors.push(`${a.name}: could not reach the open state (${String(e.message || e).split('\n')[0]})`);
    }
    if (!a.keep) await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(250);
  }
  return { opens, errors, reached };
}
