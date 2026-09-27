import test from 'node:test';
import assert from 'node:assert/strict';
import { selectState } from './select.js';
import { readFileSync } from 'node:fs';

test('state: plain data with safe defaults', () => {
  assert.deepEqual(selectState(), { value: '', text: '', disabled: false, invalid: false, open: false, changed: 0 });
  assert.equal(selectState({ value: 'balcao', changed: 2 }).changed, 2);
});

const css = readFileSync(new URL('./select.css', import.meta.url), 'utf8');

test('warm: the caret is two separate pencil strokes of different weights, not a chevron glyph', () => {
  const warm = css.match(/sg-select\[data-skin='warm'\] \{\s*--sg-select-caret: url\("([^"]+)"\)/);
  assert.ok(warm, 'warm sets its own caret');
  const svg = decodeURIComponent(warm[1]);
  const paths = [...svg.matchAll(/<path d='([^']+)' stroke-width='([\d.]+)'/g)];
  assert.equal(paths.length, 2);
  assert.notEqual(paths[0][2], paths[1][2]);
});

test('warm: the box steps aside for the pencil rule, keeping its width; forced colours bring it back', () => {
  assert.match(css, /sg-select\[data-skin='warm'\] select \{\s*border-color: transparent;/);
  assert.match(css, /@media \(forced-colors: active\) \{[^}]*\.sg-rule \{ display: none; \}/);
});
