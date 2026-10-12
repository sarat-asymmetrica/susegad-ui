// The tala stagger is written twice: talaDelay() in tokens.js (the source of truth, and
// the fallback where sibling-index() is missing) and the CSS formula in each arriving
// list. arrivalDelay() in core/arrive.js is talaDelay() with the cap turned into "arrive
// with the first beat". These tests keep the CSS and the JS agreeing, say the cap, and
// keep the four lists on the one shared helper.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { talaDelay, talaBeats, tala } from '../../tokens/tokens.js';
import { arrivalDelay } from '../../core/arrive.js';

const here = new URL('..', import.meta.url);
const read = p => fs.readFileSync(fileURLToPath(new URL(p, here)), 'utf8');
const LISTS = ['menu', 'event-list', 'gallery', 'data-table'];
const BEAT = Number(read('../tokens/tokens.css').match(/--sg-tala-beat:\s*(\d+)ms/)[1]);

/** Evaluate a stylesheet's delay formula for the index-th sibling (1-based, as sibling-index() counts). `capless` forces the in-cap factor to 1. */
function cssDelay(css, siblingIndex, { capless = false } = {}) {
  const block = css.match(/@supports \(width: calc\(sibling-index\(\) \* 1px\)\) \{[^}]*--sg-arrive-n: ([^;]+);\s*--sg-arrive-k: ([^;]+);\s*--sg-arrive-m: ([^;]+);\s*animation-delay: var\(--sg-arrive-delay, (.+?)\);\s*\}/s);
  assert.ok(block, 'the sibling-index() block is in the stylesheet');
  const [, nDecl, kRaw, mDecl, delay] = block;
  const kDecl = capless ? kRaw.replace(', 4)', ', 1000000)') : kRaw;
  const toJs = s => s
    .replace(/sibling-index\(\)/g, String(siblingIndex))
    .replace(/var\(--sg-tala-beat\)/g, String(BEAT))
    .replace(/calc\(/g, '(')
    .replace(/(\d+)ms/g, '$1');
  const subK = s => s.replace(/var\(--sg-arrive-n\)/g, `(${toJs(nDecl)})`);
  const kExpr = subK(toJs(kDecl));
  const sub = s => s
    .replace(/var\(--sg-arrive-k\)/g, `(${kExpr})`)
    .replace(/var\(--sg-arrive-m\)/g, `(${toJs(mDecl).replace(/var\(--sg-arrive-k\)/g, `(${kExpr})`)})`);
  const expr = sub(toJs(delay)).replaceAll('round(down, ', 'rdown(').replaceAll('round(up, ', 'rup(');
  const fn = new Function('mod', 'rdown', 'rup', 'min', `return ${expr};`);
  return fn((a, b) => ((a % b) + b) % b, (x, step) => Math.floor(x / step) * step, (x, step) => Math.ceil(x / step) * step, Math.min);
}

test('the CSS stagger agrees with arrivalDelay() for 40 indices in every arriving list', () => {
  for (const dir of LISTS) {
    const css = read(`${dir}/${dir}.css`);
    for (let i = 0; i < 40; i++) assert.equal(cssDelay(css, i + 1), arrivalDelay(i), `${dir}: index ${i}`);
  }
});

test('the cap: only five items have a beat inside 600 ms; every later one takes the fifth\'s (520 ms), so no list waits past 520 ms', () => {
  const inside = Array.from({ length: 60 }, (_, i) => i).filter(i => talaDelay(i) < tala.maxDelayMs);
  assert.deepEqual(inside, [0, 1, 2, 3, 4], 'five items fit inside the cap');
  for (let i = 0; i < 200; i++) assert.equal(arrivalDelay(i), i < 5 ? talaDelay(i) : 520, `index ${i}`);
  assert.equal(Math.max(...Array.from({ length: 200 }, (_, i) => arrivalDelay(i))), 520);
  for (const dir of LISTS) {
    const css = read(`${dir}/${dir}.css`);
    assert.match(css, /--sg-arrive-k: min\(var\(--sg-arrive-n\), 4\);/, `${dir}: the index stops at the fifth item (4)`);
  }
});

test('the CSS constants are the tala the tokens declare: sixteen beats, khali 8 to 10, 130 ms beat', () => {
  assert.equal(tala.beats, 16);
  assert.deepEqual(tala.khali, [8, 9, 10]);
  assert.equal(tala.maxDelayMs, 600);
  assert.equal(BEAT, tala.beatMs);
  for (const dir of LISTS) {
    const css = read(`${dir}/${dir}.css`);
    assert.match(css, /16 \* round\(down, var\(--sg-arrive-k\) \/ 13, 1\)/, `${dir}: 13 active beats a round, 16 beats long`);
    assert.match(css, /3 \* round\(down, var\(--sg-arrive-m\) \/ 8, 1\)/, `${dir}: the three khali beats are skipped from beat 8`);
  }
});

test('without the cap the formula lands on the thirteen beats that are not khali, round after round', () => {
  const css = read('menu/menu.css'), active = talaBeats();
  assert.equal(active.length, 13);
  for (let i = 0; i < 40; i++) assert.equal(cssDelay(css, i + 1, { capless: true }), (Math.floor(i / 13) * tala.beats + active[i % 13]) * tala.beatMs, `index ${i}`);
  for (const k of tala.khali) assert.ok(!active.includes(k), `beat ${k} stays silent`);
});

test('the four lists share one helper: no copy of arrive.js in a component, one registry item, each list depends on it', () => {
  const reg = JSON.parse(read('../core/arrive.registry.json'));
  assert.equal(reg.name, 'core-arrive');
  assert.deepEqual(reg.files, ['arrive.js']);
  for (const dir of LISTS) {
    assert.ok(!fs.existsSync(fileURLToPath(new URL(`${dir}/arrive.js`, here))), `${dir} has no arrive.js of its own`);
    const manifest = JSON.parse(read(`${dir}/registry.json`));
    assert.ok(!manifest.files.includes('arrive.js'));
    assert.ok(manifest.dependencies.includes('core-arrive'), `${dir} depends on core-arrive`);
    assert.match(read(`${dir}/${dir}.js`), /from '\.\.\/\.\.\/core\/arrive\.js'/);
    assert.match(read(`${dir}/${dir}.css`), /@media \(prefers-reduced-motion: no-preference\) \{\s*[\w-]+\[data-arrive\]/, `${dir}: the arrival sits behind no-preference and data-arrive`);
  }
});
