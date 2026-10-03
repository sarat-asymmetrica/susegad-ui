// Browser check for the orientation-aware words-in-world primitive (decision 0022): the applier
// turns a text layer inside a readability cone, settles without jitter, and keeps the words real.
//
//   node packages/core/orient.check.mjs           (a page that mounts the applier, one line a check)
//   node packages/core/orient.check.mjs --break   (a piece that writes an unclamped tilt every frame:
//                                                  checks 1, 3 and 4 must FAIL, and this run says so)
//
// The instrument is the browser's own numbers: the computed transform on the layer, the quaternion
// the applier reports, the rects the browser measures through the turn, and the requests the page
// makes. Nothing here reads the page's own idea of itself.
//
//  1. quiet: the layer carries no transform, no transition, and asks for nothing: not one request
//     for three.js.
//  2. warm with reduced motion: identity at load, and identity again after the settle window.
//  3. warm with the pointer to the left: the words turn, the tilt stays inside 6 degrees, the
//     transition is cleared, and the transform stops changing (no jitter).
//  4. playful: the tilt never passes 16 degrees, nor READABLE.limitDeg.
//  5. text integrity: the line spans are real DOM text, a selection over them yields the words,
//     the flat rects unproject() hands back are the rects the words had before the turn, and the
//     turn moved no layout.
//  6. --break: the same checks against a broken piece must fail the three that watch the cone and
//     the rest: 1, 3 and 4.

import { session, openTarget, waitReady } from '../../tools/lib/browser.mjs';
import { TURN, READABLE } from './orient.core.js';

const BREAK = process.argv.includes('--break');
const DEMO = '/packages/core/orient.demo.html';
const THREE = /\/node_modules\/three\/|three\.named\.js|\/three(\.module|\.core)?\.js/;
const SETTLE_MS = 3400;   // three and a third of warm's 0.9 s tau, plus the transition's own tail
const STILL = /^(none|matrix\(1, 0, 0, 1, 0, 0\)|matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\))$/;
const results = [];
const failed = new Set();
let many = 0;
/** One line a check, numbered, so the --break control can name the three that must fail. */
const check = (name, ok, detail = '') => {
  const id = ++many;
  results.push({ id, name, ok });
  if (!ok) failed.add(id);
  console.log(`${ok ? 'pass' : 'FAIL'}  ${id}. ${name}${detail ? `  (${detail})` : ''}`);
  return ok;
};

/**
 * Open the demo with every request recorded. openTarget navigates before it returns, so the
 * recording listener (and the control's init script) go on the context as it is made.
 * @returns {{ context, page, three: () => string[] }} three(): the requests that matched three's files
 */
async function open(s, t, view = {}, { init = null } = {}) {
  const requests = [], orig = s.browser.newContext.bind(s.browser);
  s.browser.newContext = async o => {
    const c = await orig(o);
    c.on('request', r => requests.push(r.url()));
    if (init) await c.addInitScript(init);
    return c;
  };
  try {
    const { context, page } = await openTarget(s, t, view);
    return { context, page, three: () => requests.filter(u => THREE.test(u)) };
  } finally { s.browser.newContext = orig; }
}

/**
 * What the browser says about the layer: its computed transform, the register it carries, and the
 * tilt of its own plane, read from the z basis of that matrix, so a broken piece is measured the
 * same way as a working one.
 */
const probe = page => page.evaluate(() => {
  const el = document.getElementById('words-layer');
  const cs = getComputedStyle(el);
  const m = (cs.transform.match(/matrix3d\(([^)]+)\)/) || [])[1];
  const n = m ? m.split(',').map(Number) : null;
  const st = window.__orient.state();
  return {
    transform: cs.transform, transition: el.style.transition, orient: el.dataset.orient,
    tiltDeg: n ? Math.acos(Math.min(1, Math.abs(n[10]))) * 180 / Math.PI : 0,
    overDeg: st.overDeg, transformed: st.transformed, q: st.q, centre: st.centre,
  };
});

/** The line spans' client rects, and how many lines the page drew. */
const lineRects = page => page.evaluate(() => {
  const spans = [...document.querySelectorAll('#words-layer .line')];
  return spans.map(el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; });
});

const widest = (a, b) => Math.max(...a.map((r, i) => Math.max(Math.abs(r.left - b[i].left), Math.abs(r.top - b[i].top), Math.abs(r.width - b[i].width), Math.abs(r.height - b[i].height))));

const s = await session();
const init = BREAK ? 'window.__orientBreak = true;' : null;

// 1: quiet. The finished still, and nothing heavy fetched to draw it.
{
  const t = { url: DEMO, register: 'quiet', theme: 'light' };
  const p = await open(s, t, {}, { init });
  await waitReady(p.page, t, { timeout: 30000 });
  await p.page.waitForTimeout(600);
  const a = await probe(p.page);
  await p.page.waitForTimeout(400);
  const b = await probe(p.page);
  const hits = p.three();
  check('quiet: the layer carries no transform and no transition, and asks for nothing',
    STILL.test(a.transform) && a.orient === 'off' && a.transition === '' && b.transform === a.transform && hits.length === 0,
    `transform ${a.transform}, data-orient ${a.orient}, transition ${a.transition || 'none'}, ${hits.length} three requests`);
  await p.context.close();
}

// 2: warm with reduced motion. A version that animates the still must fail here.
{
  const t = { url: DEMO, register: 'warm', theme: 'light' };
  const p = await open(s, t, { reduced: true }, { init });
  await waitReady(p.page, t, { timeout: 30000 });
  const a = await probe(p.page);
  await p.page.waitForTimeout(1500);
  const b = await probe(p.page);
  check('warm with reduced motion: the words face you, and still do after the settle window',
    STILL.test(a.transform) && STILL.test(b.transform) && b.transform === a.transform && b.orient === 'off' && !b.transformed,
    `${a.transform} at load, ${b.transform} after the settle window, data-orient ${b.orient}`);
  await p.context.close();
}

// 3: warm, the pointer to the left. It turns, it stays inside the cone, and it comes to rest.
{
  const t = { url: DEMO, register: 'warm', theme: 'light' };
  const p = await open(s, t, {}, { init });
  await waitReady(p.page, t, { timeout: 30000 });
  await p.page.waitForTimeout(400);
  const before = await probe(p.page);
  await p.page.evaluate(() => window.__orient.orient.pointer([-1, 0]));
  await p.page.waitForTimeout(SETTLE_MS);
  const a = await probe(p.page);
  await p.page.waitForTimeout(300);
  const b = await probe(p.page);
  await p.page.waitForTimeout(300);
  const c = await probe(p.page);
  const turned = a.transformed && a.orient === 'on' && a.tiltDeg > 0.5;
  const inside = a.tiltDeg <= TURN.warm + 0.05;
  const rest = a.transition === '' && a.transform === b.transform && b.transform === c.transform;
  check('warm, pointer to the left: the words turn, stay inside 6 degrees, and come to rest',
    turned && inside && rest,
    `tilt ${a.tiltDeg.toFixed(2)} deg from ${before.tiltDeg.toFixed(2)}, transition ${a.transition || 'none'}, ${a.transform === c.transform ? 'still' : 'still moving after the settle window'}`);
  await p.context.close();
}

// 4: playful, the pointer at every corner. The cone holds under a sweep, not at one pose.
{
  const t = { url: DEMO, register: 'playful', theme: 'light' };
  const p = await open(s, t, {}, { init });
  await waitReady(p.page, t, { timeout: 30000 });
  let most = 0, asked = 0;
  for (const [x, y] of [[-1, -1], [1, 1], [0, -1], [-1, 0], [1, 0]]) {
    await p.page.evaluate(xy => window.__orient.orient.pointer(xy), [x, y]);
    for (let i = 0; i < 12; i++) {
      await p.page.waitForTimeout(110);
      const r = await probe(p.page);
      most = Math.max(most, r.tiltDeg);
      asked = Math.max(asked, r.overDeg);
    }
  }
  check('playful: the tilt never passes 16 degrees, nor the readable limit',
    most <= TURN.playful + 0.2 && most <= READABLE.limitDeg && asked > 0,
    `most ${most.toFixed(2)} deg of ${TURN.playful}, over the cone by ${asked.toFixed(2)} deg, readable limit ${READABLE.limitDeg}`);
  await p.context.close();
}

// 5: text integrity. The words are real, they select, and a turn moves them on the plane only.
{
  const t = { url: DEMO, register: 'warm', theme: 'light' };
  const p = await open(s, t, {}, { init });
  await waitReady(p.page, t, { timeout: 30000 });
  await p.page.waitForTimeout(300);
  const at = await p.page.evaluate(() => {
    const spans = [...document.querySelectorAll('#words-layer .line')];
    const range = document.createRange();
    range.selectNodeContents(spans[0]);
    const sel = getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    const picked = sel.toString();
    sel.removeAllRanges();
    return {
      lines: spans.length,
      real: spans.length >= 4 && spans.every(el => el.childElementCount === 0 && el.textContent.trim().length > 0),
      first: spans[0].textContent.trim(), picked: picked.trim(),
    };
  });
  const flat = await lineRects(p.page);
  await p.page.evaluate(() => window.__orient.orient.pointer([1, 0]));
  await p.page.waitForTimeout(SETTLE_MS);
  const through = await p.page.evaluate(() => {
    const spans = [...document.querySelectorAll('#words-layer .line')];
    return spans.map(el => {
      const r = el.getBoundingClientRect();
      const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      return { raw: rect, back: window.__orient.orient.unproject(rect) };
    });
  });
  await p.page.evaluate(() => window.__orient.orient.setReduced(true));
  await p.page.waitForTimeout(300);
  const back = await lineRects(p.page);
  const turned = widest(through.map(r => r.raw), flat);   // the turn was really on the layer
  const off = widest(through.map(r => r.back), flat);     // and unproject() hands the flat rects back
  const moved = widest(back, flat);
  check('text integrity: real text, a selection that yields the words, rects the turn can be undone from, and no layout moved',
    at.real && at.picked === at.first && at.picked.length > 10 && turned > 1 && off <= 1 && moved <= 0.5,
    `${at.lines} lines, selection "${at.picked.slice(0, 28)}...", the turn moved the rects by ${turned.toFixed(2)} px, unprojected within ${off.toFixed(3)} px, layout unmoved within ${moved.toFixed(3)} px`);
  await p.context.close();
}

// 6: the control. A broken piece must fail the three checks that watch the cone and the rest.
let control = true;
if (BREAK) {
  let ok = true;
  control = check('--break: a piece that writes an unclamped tilt every frame fails checks 1, 3 and 4',
    (ok = [1, 3, 4].every(id => failed.has(id))),
    `failed: ${[...failed].sort((a, b) => a - b).join(', ') || 'nothing'}`);
}

await s.done();
const bad = results.filter(r => !r.ok).length;
console.log(`\n${results.length - bad} of ${results.length} pass${BREAK ? ' (--break: checks 1, 3 and 4 should FAIL)' : ''}`);
// In --break mode a clean run is the small one (the three checks failing as they should): exit on the
// control's own line, so a control that stopped breaking is a failure and not a pass.
process.exit(BREAK ? (control ? 0 : 1) : bad ? 1 : 0);