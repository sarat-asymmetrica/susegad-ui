// The microinteraction check (docs/contributing/touch-contract.md): every interactive component
// has a press state in every register, a :focus-visible style and a reduced-motion still.
//
//   node tools/touch.check.mjs              fixtures first (they must go red), then the library
//   node tools/touch.check.mjs --fixtures   only the fixtures
//   node tools/touch.check.mjs --static     skip the browser probe (CSS and markup only)
//   node tools/touch.check.mjs --only tabs,toggle
//   node tools/touch.check.mjs --json
//
// Two layers, because a CSS scan alone can be fooled by an :active rule that changes nothing:
//   static   which components are interactive (from demo markup and scripts, tools/touch.core.js),
//            and what their CSS says: an :active rule that sets something visible, a
//            :focus-visible style, reduced-motion handling.
//   probe    in a browser, on the component's own demo, in each register: hover the control,
//            press the mouse, and require a computed-style change within one frame, with no CSS
//            transition running on the way in; under reduced motion the change stays but no
//            movement; Tab onto the control and require a focus style; hold an arrow key on a
//            radio or tab and require that nothing transitions.
// Exits 1 when any component misses something, naming it and what is missing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseCss, missing, interactiveReasons, diffSnapshots, WATCHED } from './touch.core.js';
import { REPO_ROOT } from './serve.mjs';

const args = process.argv.slice(2);
const flag = n => args.includes(`--${n}`);
const optVal = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const ONLY = optVal('only')?.split(',');
const STATIC_ONLY = flag('static');
const JSON_OUT = flag('json');
const REGISTERS = (optVal('registers') ?? 'quiet,warm,playful').split(',');
const FIXTURE = optVal('fixture');
const say = (...a) => { if (flag('verbose')) console.error(...a); };

/** Components that are not interactive for the contract, with the reason. Everything else is decided from data. */
export const NOT_INTERACTIVE = {};

/**
 * How to make a component's controls show on its demo, when the plain demo never shows them. `page` is the
 * element to look in (when the folder's name is not the tag), `page` is the demo file to open; `script` runs in the page before each probe. veranda's lens button stays display:none until
 * the stage says data-lens-ok, and only its words page holds a stage at all.
 */
export const PROBE_SETUP = {
  // a dialog and a drawer keep their buttons inside a closed <dialog>: open the first one so there is something to press
  dialog: { script: "const d = document.querySelector('sg-dialog'); if (d && !d.open) d.show();" },
  drawer: { script: "const d = document.querySelector('sg-drawer'); if (d && !d.open) d.show();" },
  veranda: { tag: 'sg-veranda-stage', page: 'words.html', script: "document.querySelectorAll('sg-veranda-stage').forEach(e => e.setAttribute('data-lens-ok', ''))" },
};

/** A pressable component whose press probes may all be skipped, with the reason. Empty: none is. */
export const UNPROVEN_OK = {};

/** Components with no pressable control: text entry only, where focus is the press. Everything else must answer a press. */
const FOCUS_IS_THE_PRESS = new Set();

const read = f => fs.readFileSync(f, 'utf8');
const walk = (d, ok) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'skins' ? walk(path.join(d, e.name), ok) : []) : ok(e.name) ? [path.join(d, e.name)] : []);

/** Gather one component folder: its tag, CSS, scripts and demo. */
function gather(dir, name) {
  const jsFiles = walk(dir, f => /\.js$/.test(f) && !/\.(test|core)\.js$/.test(f));
  const js = jsFiles.map(read).join('\n');
  // the folder's stylesheets, plus CSS a script keeps in a `const CSS = ...` template (veranda's stage)
  const css = walk(dir, f => /\.css$/.test(f)).map(read).join('\n') + '\n' + [...js.matchAll(/\bconst CSS\s*=\s*`([^`]*)`/g)].map(m => m[1]).join('\n');
  const demoFile = path.join(dir, 'demo.html');
  const demo = fs.existsSync(demoFile) ? read(demoFile) : '';
  const tag = PROBE_SETUP[name]?.tag ?? js.match(/defineComponent\(\s*['"]([a-z][\w-]*)['"]/)?.[1] ?? `sg-${name}`;
  return { name, dir, tag, css, js, demo, hasDemo: !!demo };
}

/** Static pass for one gathered component. */
function staticPass(c) {
  const { reasons, pressable } = interactiveReasons(c.tag, c.demo, c.js);
  const excluded = NOT_INTERACTIVE[c.name];
  const interactive = reasons.length > 0 && !excluded;
  const a = analyseCss(c.css, c.js);
  return { ...c, interactive, pressable, reasons, excluded, a, problems: interactive ? missing(a, { pressable }) : [] };
}

// ── the probe, which runs in the page ───────────────────────────────────────
const PRESSABLE = 'button:not(:disabled):not([aria-disabled=true]), a[href]:not([aria-disabled=true]), summary, select:not(:disabled), input[type=checkbox]:not(:disabled), input[type=radio]:not(:disabled), input[type=button]:not(:disabled), input[type=submit]:not(:disabled), input[type=file]:not(:disabled), [role=tab], [role=button]:not([aria-disabled=true]), [role=switch]';

/** In the page: tag up to three pressable controls of different kinds inside the component and describe them. */
function pickPressables({ tag, selector }) {
  const seen = new Set(), out = [];
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && (r.width > 1 || (el.labels?.[0]?.getBoundingClientRect().width ?? 0) > 1); };
  for (const host of document.querySelectorAll(tag)) {
    for (const el of host.querySelectorAll(selector)) {
      const kind = `${el.localName}|${el.type ?? ''}|${el.getAttribute('role') ?? ''}`;
      if (seen.has(kind) || !visible(el) || host.closest('[hidden]')) continue;
      seen.add(kind);
      const n = out.length;
      el.setAttribute('data-touch-probe', String(n));
      out.push({ n, kind });
      if (out.length >= 3) return out;
    }
  }
  return out;
}

/** In the page: computed style of the host and everything in it, keyed by position. */
function snapshot({ props }) {
  const out = {};
  const host = document.querySelector('[data-touch-host]');
  const nodes = [host, ...host.querySelectorAll('*')];
  nodes.forEach((el, i) => {
    const cs = getComputedStyle(el);
    // a change nobody can see is not an answer: only nodes with a box, shown and not transparent
    const r = el.getBoundingClientRect();
    if ((!r.width && !r.height) || cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return;
    out[`${el.localName}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : ''}#${i}`] = Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));
  });
  return out;
}

const frame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

/** Press one control and report what answered. */
async function pressOne(page, n, tag) {
  const target = page.locator(`[data-touch-probe="${n}"]`);
  await target.evaluate((el, tag) => {
    const host = el.closest(tag);
    document.querySelectorAll('[data-touch-host]').forEach(h => h.removeAttribute('data-touch-host'));
    host.setAttribute('data-touch-host', 'now');
    const label = (el.type === 'checkbox' || el.type === 'radio') ? el.labels?.[0] : null;
    (label ?? el).setAttribute('data-touch-hit', '1');
  }, tag);
  const hit = page.locator('[data-touch-hit="1"]');
  await hit.scrollIntoViewIfNeeded();
  const box = await hit.boundingBox();
  if (!box) return { ok: false, why: 'the control has no box to press' };
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const under = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e?.closest('[data-touch-host]'); }, [x, y]);
  if (!under) return { ok: false, why: 'something else covers the control at its centre, so it cannot be pressed' };
  await page.mouse.move(x, y);
  await target.evaluate(el => el.focus({ preventScroll: true })).catch(() => {});
  await page.waitForTimeout(120);
  // hover and focus transitions settle, however slow, so the press is all that changes
  await page.waitForFunction(() => !document.querySelector('[data-touch-host]').getAnimations({ subtree: true }).some(a => a instanceof CSSTransition && a.playState === 'running'), null, { timeout: 2500 }).catch(() => {});
  // WebKit can come back to a control still "pressed": after an earlier press released away from it, moving the mouse back over
  // the control finds the whole chain from <html> down matching :active (seen on the good fixture's radio label, the last cell
  // of a second context). A "before" taken in that state already shows the pressed look, so the press seems to change nothing.
  // Release the mouse where nothing is, then come back, so the press starts from rest.
  if (await page.evaluate(() => !!document.querySelector(':active'))) {
    await page.mouse.move(0, 0); await page.mouse.down(); await page.mouse.up();
    await page.mouse.move(x, y);
    await page.waitForTimeout(120);
    await page.waitForFunction(() => !document.querySelector('[data-touch-host]').getAnimations({ subtree: true }).some(a => a instanceof CSSTransition && a.playState === 'running'), null, { timeout: 2500 }).catch(() => {});
    say('released a stale :active before pressing', n);
  }
  const before = await page.evaluate(snapshot, { props: WATCHED });
  return { before, x, y };
}

async function probeComponent(h, c, problems, notes) {
  const serverUrl = h.server.url;
  const setup = PROBE_SETUP[c.name];
  const demoUrl = `${serverUrl}/${path.relative(REPO_ROOT, c.dir).replaceAll('\\', '/')}/${setup?.page ?? 'demo.html'}`;
  const results = { press: {}, focus: {}, keys: null };
  for (const register of REGISTERS) {
    const ctx = await h.context({ viewport: { width: 1100, height: 900 }, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    try {
      await page.goto(`${demoUrl}?register=${register}`);
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 });
      await page.waitForFunction(t => [...document.querySelectorAll(t)].every(e => e.dataset.skin || !Object.keys(e.constructor.skins ?? {}).length), c.tag, { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(150);
      for (const reduced of [false, true]) {
        await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
        await page.waitForTimeout(50);
        if (setup?.script) await page.evaluate(setup.script);
        const picks = await page.evaluate(pickPressables, { tag: c.tag, selector: PRESSABLE });
        const key = `${register}${reduced ? '/reduced' : ''}`;
        say('probe', c.name, key, picks.length, 'controls');
        if (!picks.length) { results.press[key] = { skipped: 'no pressable control on the demo (only text fields, or nothing visible)' }; continue; }
        for (const pick of picks) {
          const label = `${key} ${pick.kind.replace(/\|+$/, '')}`;
          const r = await pressOne(page, pick.n, c.tag);
          if (!r.before) { results.press[label] = { fail: r.why }; continue; }
          await page.mouse.down();
          await frame(page);
          const after = await page.evaluate(snapshot, { props: WATCHED });
          const running = await page.evaluate(watched => document.querySelector('[data-touch-host]').getAnimations({ subtree: true })
            .filter(a => a instanceof CSSTransition && a.playState === 'running' && watched.includes(a.transitionProperty))
            .map(a => `${a.transitionProperty} on ${a.effect.target.localName}${a.effect.target.className && typeof a.effect.target.className === 'string' ? '.' + a.effect.target.className.split(' ')[0] : ''}`), WATCHED);
          await page.mouse.move(0, 0);
          await page.mouse.up();
          const d = diffSnapshots(r.before, after);
          const res = { changed: d.changed.slice(0, 4), moved: d.moved.length, transitionsOnPress: running };
          results.press[label] = res;
          if (!d.changed.length) problems.push(`${label}: pressing it changes nothing in ${c.tag} within a frame (no computed style moves)`);
          else if (running.length) problems.push(`${label}: a CSS transition (${[...new Set(running)].join(', ')}) runs on press-in; set transition: none on :active`);
          if (reduced && d.moved.length) problems.push(`${label}: still moves under reduced motion (${d.moved[0]})`);
          await page.evaluate(() => document.querySelectorAll('[data-touch-hit]').forEach(e => e.removeAttribute('data-touch-hit')));
        }
        if (!reduced && register === 'quiet') await probeFocus(page, c, problems, results);
        if (!reduced && register !== 'quiet' && results.keys === null) await probeKeys(page, c, problems, results);
      }
      if (errors.length) notes.push(`${register}: page error ${errors[0]}`);
    } catch (e) {
      problems.push(`${register}: the probe could not run (${String(e.message).split('\n')[0]})`);
    }
    await ctx.close();
  }
  if (c.pressable && !UNPROVEN_OK[c.name] && !Object.values(results.press).some(r => !r.skipped)) {
    problems.push('press unproven: every press probe was skipped, so the green is static only (no pressable control showed on the demo); add a PROBE_SETUP entry that shows it, or an UNPROVEN_OK reason');
  }
  return results;
}

/** Tab onto the first focusable control inside the component and require a focus style. */
async function probeFocus(page, c, problems, results) {
  await page.evaluate(() => document.activeElement?.blur());
  let landed = null;
  for (let i = 0; i < 40 && !landed; i++) {
    await page.keyboard.press('Tab');
    landed = await page.evaluate(tag => {
      const a = document.activeElement;
      if (!a || !a.closest(tag)) return null;
      document.querySelectorAll('[data-touch-host]').forEach(h => h.removeAttribute('data-touch-host'));
      a.closest(tag).setAttribute('data-touch-host', 'now');
      return { focusVisible: a.matches(':focus-visible'), tag: a.localName };
    }, c.tag);
  }
  if (!landed) { results.focus = { skipped: 'Tab never reached a control inside it' }; return; }
  await page.waitForTimeout(300);
  const withFocus = await page.evaluate(snapshot, { props: WATCHED });
  const ring = await page.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return { outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== 'none' }; });
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(300);
  const without = await page.evaluate(snapshot, { props: WATCHED });
  const d = diffSnapshots(without, withFocus);
  results.focus = { focusVisible: landed.focusVisible, ring, changed: d.changed.slice(0, 3) };
  if (!landed.focusVisible) problems.push(`Tab reached <${landed.tag}> but it does not match :focus-visible`);
  else if (!ring.outline && !ring.shadow && !d.changed.length) problems.push(`keyboard focus on <${landed.tag}> shows nothing (no outline, ring or style change)`);
}

/** Hold an arrow key on a radio or tab and require that nothing transitions. */
async function probeKeys(page, c, problems, results) {
  await page.evaluate(() => document.activeElement?.blur());
  let arrow = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(tag => { const a = document.activeElement; if (!a?.closest(tag)) return 'out'; return (a.type === 'radio' || a.getAttribute('role') === 'tab') ? 'arrow' : 'in'; }, c.tag);
    if (at === 'arrow') { arrow = true; break; }
    if (at === 'out' && i > 12) break;
  }
  if (!arrow) { results.keys = { skipped: 'no radio or tab to arrow through' }; return; }
  await page.keyboard.down('ArrowRight');
  await frame(page);
  const running = await page.evaluate(tag => (document.activeElement.closest(tag) ?? document.querySelector(tag)).getAnimations({ subtree: true })
    .filter(a => a instanceof CSSTransition && a.playState === 'running').map(a => a.transitionProperty), c.tag);
  await page.keyboard.up('ArrowRight');
  results.keys = { running };
  if (running.length) problems.push(`holding an arrow key still runs a CSS transition (${[...new Set(running)].join(', ')}); drop it under :root[data-sg-input="key"]`);
}

// ── the runner ──────────────────────────────────────────────────────────────

// The browser probe's one harness (server, engine, slot), made on first use so --static never loads it, and closed once, by done(), at the end.
let H = null;
const probeHarness = async () => H ??= await (await import('./lib/component-check.mjs')).harness({
  axe: "this check measures press, focus and held-key motion on each component's own demo and on deliberately broken fixtures, not accessibility; tools/smoke.mjs axes the registry demo pages once, at 1280 px in the default register and light theme, and the fixtures are in no axe check",
});

/** @param {string[]} dirs component folders @returns the verdict for each */
async function run(dirs, { probe }) {
  const comps = dirs.map(d => staticPass(gather(d, path.basename(d))));
  const h = probe ? await probeHarness() : null;
  const out = new Array(comps.length);
  const one = async i => {
    const c = comps[i];
    const problems = [...c.problems], notes = [];
    let probed = null;
    if (c.interactive && probe && c.hasDemo) probed = await probeComponent(h, c, problems, notes);
    else if (c.interactive && probe) problems.push('no demo.html to probe');
    out[i] = { name: c.name, tag: c.tag, staticProblems: c.problems, interactive: c.interactive, reasons: c.reasons, excluded: c.excluded, static: c.a, probed, problems, notes };
  };
  let next = 0;
  const worker = async () => { while (next < comps.length) await one(next++); };
  await Promise.all(Array.from({ length: probe ? 4 : 1 }, worker));
  return out;
}

/** Which of the contract's items a problem is about, from the words after the control's label. */
export const kindOf = msg => {
  const text = msg.replace(/^[^:]*: /, '');
  if (/still moves under reduced motion|no reduced-motion/.test(text)) return 'reduced';
  if (/arrow key/.test(text)) return 'keys';
  if (/focus/.test(text)) return 'focus';
  return 'press';
};

function report(rows, title) {
  const interactive = rows.filter(r => r.interactive);
  const keeps = kind => interactive.filter(r => !r.problems.some(p => kindOf(p) === kind));
  const pressOk = keeps('press').length, focusOk = keeps('focus').length, reducedOk = keeps('reduced').length, keysOk = keeps('keys').length;
  if (!JSON_OUT) {
    console.log(`\n${title}: ${interactive.length} interactive of ${rows.length} components`);
    console.log(`  press state ${pressOk} of ${interactive.length}   :focus-visible ${focusOk} of ${interactive.length}   reduced-motion still ${reducedOk} of ${interactive.length}   no motion on held keys ${keysOk} of ${interactive.length}`);
    for (const r of interactive) {
      if (r.problems.length) { console.log(`FAIL  ${r.name}`); const show = ONLY || flag('all') ? r.problems : r.problems.slice(0, 4); for (const p of show) console.log(`        ${p}`); if (show.length < r.problems.length) console.log(`        (and ${r.problems.length - show.length} more; --all or --only shows them)`); }
      else console.log(`pass  ${r.name}`);
      for (const n of r.notes) console.log(`        note: ${n}`);
    }
    const skipped = rows.filter(r => !r.interactive);
    const unproven = interactive.filter(r => r.problems.some(p => /^press unproven/.test(p)));
    if (unproven.length) console.log(`press unproven (every probe skipped): ${unproven.map(r => r.name).join(', ')}`);
    console.log(`not interactive (${skipped.length}): ${skipped.map(r => r.excluded ? `${r.name} [${r.excluded}]` : r.name).join(', ')}`);
  }
  return { interactive: interactive.length, pressOk, focusOk, reducedOk, keysOk, unproven: interactive.filter(r => r.problems.some(p => /^press unproven/.test(p))).map(r => r.name), failing: interactive.filter(r => r.problems.length).map(r => r.name) };
}

const here = path.dirname(fileURLToPath(import.meta.url));
let exit = 0;

// 1. Fixtures: broken components that MUST go red for the reason named in their folder's expect.json.
if (!ONLY) {
  const fx = path.join(here, 'fixtures', 'touch');
  const dirs = fs.readdirSync(fx, { withFileTypes: true }).filter(e => e.isDirectory() && (!FIXTURE || e.name === FIXTURE)).map(e => path.join(fx, e.name));
  const rows = await run(dirs, { probe: !STATIC_ONLY });
  console.log('Fixtures (each must fail for the reason it was broken for, and the good one must pass):');
  for (const r of rows) {
    const expect = JSON.parse(read(path.join(fx, r.name, 'expect.json')));
    const text = r.problems.join(' | ');
    const want = [...(expect.fails ?? []), ...(STATIC_ONLY ? [] : expect.probeFails ?? [])];
    const matches = want.every(re => new RegExp(re, 'i').test(text));
    // a fixture meant to slip past the static scan must pass it: only the probe may catch it
    const scanNote = expect.probeFails && !expect.fails?.length && r.staticProblems.length ? ' (it was meant to pass the static scan, so that only the probe catches it)' : '';
    const wantsRed = !!(expect.fails?.length || (!STATIC_ONLY && expect.probeFails?.length));
    if (!wantsRed && (expect.fails || expect.probeFails) && STATIC_ONLY) { console.log(`skip  ${r.name}  (needs the browser probe)`); continue; }
    const ok = !scanNote && matches && (wantsRed ? r.problems.length > 0 : r.problems.length === 0);
    console.log(`${ok ? 'pass' : 'FAIL'}  fixture ${r.name}: ${wantsRed ? `red as expected (${r.problems.length})` : 'green as expected'}${ok ? '' : `${scanNote}
        got: ${text || 'no problems'}
        wanted: ${want.join(' & ') || 'none'}`}`);
    if (!ok) exit = 1;
  }
}

// 2. The library.
if (!flag('fixtures')) {
  const reg = JSON.parse(read(path.join(REPO_ROOT, 'registry', 'registry.json')));
  let dirs = reg.items.filter(i => i.type === 'component').map(i => path.join(REPO_ROOT, path.dirname(i.manifest)));
  if (ONLY) dirs = dirs.filter(d => ONLY.includes(path.basename(d)));
  const rows = await run(dirs, { probe: !STATIC_ONLY });
  const sum = report(rows, `Library${STATIC_ONLY ? ' (static only)' : ''}`);
  if (JSON_OUT) console.log(JSON.stringify({ summary: sum, rows }, null, 2));
  if (sum.failing.length) { exit = 1; console.log(`\n${sum.failing.length} of ${sum.interactive} interactive components miss the touch contract: ${sum.failing.join(', ')}`); }
  else console.log('\nEvery interactive component keeps the touch contract.');
}
if (H) await H.done({ summary: exit ? 'touch check: red (the FAIL lines above)' : 'touch check: green', exit });
process.exit(exit);
