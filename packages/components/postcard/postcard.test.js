import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { postmark, tilt, canFlip } from './postcard.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const css = readFileSync(fileURLToPath(new URL('./postcard.css', import.meta.url)), 'utf8');

test('the postmark is deterministic, two rings and four lines in its box, below the ring centre', () => {
  const a = postmark('aldona');
  assert.deepEqual(a, postmark('aldona'));
  assert.notDeepEqual(a.waves, postmark('tides').waves);
  assert.equal(a.waves.length, 4);
  for (const d of a.waves) {
    const v = d.match(/-?[\d.]+/g).map(Number);
    const xs = v.filter((_, i) => !(i % 2)), ys = v.filter((_, i) => i % 2);
    assert.ok(Math.min(...xs) >= a.cx + a.r - 8 && Math.max(...xs) <= 150, 'the lines start at the ring and stay in the box');
    assert.ok(Math.min(...ys) > a.cy && Math.max(...ys) <= 64, 'the lines run below the centre, under the stamp, never across its word');
  }
  assert.ok(Math.abs(a.rotate) <= 6);
});

test('the tilt is never flat and never more than 2.2 degrees', () => {
  for (let i = 0; i < 300; i++) { const t = Math.abs(tilt(i)); assert.ok(t >= 0.8 && t <= 2.2, `${t}`); }
  assert.equal(tilt('x'), tilt('x'));
});

test('the card flips only at full motion with a hovering pointer', () => {
  assert.equal(canFlip({ motion: 'full', hover: true }), true);
  for (const motion of ['still', 'state', 'ambient']) assert.equal(canFlip({ motion, hover: true }), false, motion);
  assert.equal(canFlip({ motion: 'full', hover: false }), false, 'touch screens lie flat');
});

test('the flip is gated by the skin\'s confirmation and moves with transform only', () => {
  const rules = css.match(/[^{}]*\{[^}]*rotateY[^}]*\}/g);
  assert.ok(rules.length >= 3);
  for (const r of rules) assert.match(r, /sg-postcard\[data-flip\]/, r.slice(0, 80));
  const tr = css.match(/sg-postcard\[data-flip\][^{]*\{[^}]*transition:([^;]*);/)[1];
  assert.match(tr.trim(), /^transform /);
});

test('one link per card: the stretched link sits above everything else on the card', () => {
  assert.match(css, /:is\(h2, h3, h4\) a::after \{ content: ""; position: absolute; inset: 0; z-index: 2;/);
});

for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`AA: ${name} ${theme}: the playful face and back read at 4.5:1`, () => {
    const r = resolveRoles(name, theme), hex = k => toRgb(r[k].hex);
    assert.ok(contrast(hex('on-accent'), hex('accent')) >= 4.5);
    assert.ok(contrast(hex('text'), hex('selection')) >= 4.5);
  });
}

test('the status is a badge unless the card asks for a stamp', async () => {
  const { statusStyle } = await import('./postcard.core.js');
  assert.equal(statusStyle(null), 'badge');
  assert.equal(statusStyle('badge'), 'badge');
  assert.equal(statusStyle('rubber'), 'badge');
  assert.equal(statusStyle('stamp'), 'stamp');
});

test('the postage square and the postmark are both decoration, and the square gives way to a stamp', () => {
  assert.match(css, /sg-postcard\[status-style="stamp"\] \.sg-postcard-postage \{ display: none; \}/);
});
