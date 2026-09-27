import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LATCH, LAMP, boltEnd, flicker, flameAnimation } from './toggle.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'toggle.css'), 'utf8');
const nums = d => d.match(/-?[\d.]+/g).map(Number);

test('the latch: off, the bolt stops short of the keeper; on, it is inside it', () => {
  const keeperX = Math.min(...nums(LATCH.keeper).filter((_, i) => i % 2 === 0));
  const keeperInner = 37.6;
  assert.ok(boltEnd(false) < keeperX, `off: ${boltEnd(false)} < ${keeperX}`);
  assert.ok(boltEnd(true) > keeperX && boltEnd(true) <= keeperInner, `on: ${boltEnd(true)} inside the keeper`);
  // the CSS slides it the same distance the core says
  assert.match(css, new RegExp(`translateX\\(${LATCH.slide}px\\)`));
});

test('the latch fits its 44 × 24 grid; the handle points up when off and down when on', () => {
  for (const d of [LATCH.keeper, LATCH.handle.off, LATCH.handle.on]) for (const [i, n] of nums(d).entries()) assert.ok(n >= 0 && n <= (i % 2 ? 24 : 44));
  assert.ok(LATCH.knob.off.cy < LATCH.shaft.y && LATCH.knob.on.cy > LATCH.shaft.y + LATCH.shaft.h);
});

test('the lamp fits its 32 × 32 grid, and the flame stands on the wick', () => {
  for (const d of [LAMP.bowl, LAMP.rim, LAMP.flame, LAMP.flameCore]) for (const n of nums(d)) assert.ok(n >= 0 && n <= 32, `${n}`);
  const flameBase = nums(LAMP.flame).slice(0, 2);
  assert.ok(Math.hypot(flameBase[0] - LAMP.wick.x2, flameBase[1] - LAMP.wick.y2) < 0.5, 'the flame starts at the top of the wick');
  const flameTop = Math.min(...nums(LAMP.flame).filter((_, i) => i % 2));
  assert.ok(LAMP.wick.y2 - flameTop > 10, 'a flame tall enough to read at a glance');
});

test('the flicker is small, deterministic, and differs between two lamps', () => {
  assert.deepEqual(flicker(1.3, 'a'), flicker(1.3, 'a'));
  assert.notDeepEqual(flicker(1.3, 'a'), flicker(1.3, 'b'));
  for (let t = 0; t < 10; t += 0.37) {
    const { sx, sy, lean } = flicker(t, 'a');
    assert.ok(Math.abs(sy - 1) <= 0.12 && Math.abs(sx - 1) <= 0.06 && Math.abs(lean) <= 6);
  }
});

test('the flame moves only when lit, in warm or playful motion, and loops without a jump', () => {
  assert.equal(flameAnimation('full', false, 'a'), null, 'no flame, no flicker');
  assert.equal(flameAnimation('still', true, 'a'), null, 'reduced motion: a steady flame');
  assert.equal(flameAnimation('state', true, 'a'), null, 'quiet: still');
  const a = flameAnimation('full', true, 'a');
  assert.equal(a.timing.iterations, Infinity);
  assert.deepEqual(a.frames[0], a.frames.at(-1));
});

test('the CSS keeps the no-JS switch whole and gives forced colours the native control', () => {
  assert.match(css, /sg-toggle\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /input\[type="checkbox"\]:checked::before/);
  assert.match(css, /:focus-visible/);
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /appearance:\s*auto/);
  assert.match(forced, /\.sg-toggle-art[^{]*\{\s*display:\s*none/);
  // every state-carrying shape is outlined in the text colour (WCAG 1.4.11)
  for (const cls of ['shaft', 'keeper', 'flame', 'bowl']) assert.match(css, new RegExp(`\\.sg-toggle-${cls}\\s*\\{[^}]*stroke:\\s*var\\(--sg-text`), cls);
  // token colours fall back to system colours; the component's own --sg-toggle-* are always set in this file
  for (const m of css.matchAll(/var\(--sg-(?!toggle-)[a-z-]+\)/g)) assert.fail(`no fallback: ${m[0]}`);
});

// ── WCAG 1.4.11: the switch's parts against each other and the page, every palette and theme ──
for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`1.4.11: ${name} ${theme}: track, thumb and drawn outlines are 3:1 or more`, () => {
    const r = resolveRoles(name, theme), c = (a, b) => contrast(toRgb(r[a].hex), toRgb(r[b].hex));
    for (const ground of ['surface', 'surface-raised']) {
      assert.ok(c('rule-strong', ground) >= 3, `off track edge on ${ground}`);
      assert.ok(c('accent', ground) >= 3, `on track on ${ground}: ${c('accent', ground).toFixed(2)}`);
      assert.ok(c('text', ground) >= 3, `latch and lamp outlines on ${ground}`);
    }
    assert.ok(c('text-soft', 'surface-sunk') >= 3, 'off thumb on its track');
    assert.ok(c('on-accent', 'accent') >= 3, 'on thumb on its track');
  });
}
