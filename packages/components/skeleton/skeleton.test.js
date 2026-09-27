import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, outline, shading, nextPhase, rrect, STRINGS, SHAPES } from './skeleton.core.js';

test('runs in Node with no DOM', () => {
  assert.equal(typeof document, 'undefined');
  for (const s of SHAPES) assert.ok(layout(s).blocks.length > 0);
});

test('layout is deterministic per seed and fits the width', () => {
  for (const shape of SHAPES) {
    const a = layout(shape, { lines: 4, width: 300, seed: 3 }), b = layout(shape, { lines: 4, width: 300, seed: 3 });
    assert.deepEqual(a, b);
    for (const k of a.blocks) {
      assert.ok(k.x >= 0 && k.x + k.w <= 300 + 0.5, `${shape} block overflows: ${JSON.stringify(k)}`);
      assert.ok(k.y >= 0 && k.y + k.h <= a.height + 0.5);
    }
  }
  assert.notDeepEqual(layout('text', { seed: 1 }), layout('text', { seed: 2 }));
});

test('lines and shapes shape the layout', () => {
  assert.equal(layout('text', { lines: 5 }).blocks.length, 5);
  assert.equal(layout('list', { lines: 3 }).blocks.filter(b => b.kind === 'circle').length, 3);
  const card = layout('card', { lines: 2, width: 320 });
  assert.equal(card.blocks[0].kind, 'media');
  assert.equal(card.blocks[1].kind, 'title');
  assert.ok(layout('text', { lines: 1 }).blocks[0].w > 0.8 * 320, 'a single line is not cut short');
  assert.deepEqual(layout('nonsense'), layout('text'), 'unknown shapes fall back to text');
  assert.equal(layout('text', { lines: 99 }).blocks.length, 12, 'lines are capped');
});

test('the last line of a paragraph is shorter, like real text', () => {
  const { blocks } = layout('text', { lines: 4, width: 400, seed: 9 });
  assert.ok(blocks[3].w < Math.min(...blocks.slice(0, 3).map(b => b.w)));
});

test('outlines are closed paths with a measured length', () => {
  const b = { x: 0, y: 0, w: 200, h: 12, r: 6, kind: 'line' };
  const o = outline(b, { seed: 1 });
  assert.match(o.d, /^M[\d.,L-]+Z$/);
  const perimeter = 2 * (200 + 12) - (4 - Math.PI) * 6 * 2 / 2;
  assert.ok(Math.abs(o.length - perimeter) / perimeter < 0.12, `${o.length} vs ${perimeter}`);
  assert.notEqual(outline(b, { seed: 1, pass: 1 }).d, o.d, 'a second pencil pass wanders differently');
  assert.equal(outline(b, { seed: 1 }).d, o.d);
  const flat = outline(b, { wobble: 0 }).d;
  assert.ok(!flat.includes('NaN'));
});

test('rounded rectangles stay inside their box', () => {
  for (const [x, y] of rrect(10, 20, 100, 40, 8)) assert.ok(x >= 10 - 1e-9 && x <= 110 + 1e-9 && y >= 20 - 1e-9 && y <= 60 + 1e-9);
});

test('shading is deterministic path data', () => {
  const b = { x: 0, y: 0, w: 240, h: 120 };
  assert.equal(shading(b, { seed: 2 }), shading(b, { seed: 2 }));
  assert.ok(shading(b).split('M').length > 20);
});

test('phases: the ink-in plays only on a real arrival with motion', () => {
  assert.equal(nextPhase(null, true), 'busy');
  assert.equal(nextPhase('busy', false, 'ambient'), 'arriving');
  assert.equal(nextPhase('busy', false, 'full'), 'arriving');
  assert.equal(nextPhase('busy', false, 'state'), 'arriving');
  assert.equal(nextPhase('busy', false, 'still'), 'done', 'reduced motion: straight to the content');
  assert.equal(nextPhase(null, false), 'done', 'content that never waited draws nothing');
  assert.equal(nextPhase('done', false), 'done');
  assert.equal(nextPhase('arriving', true), 'busy');
});

test('strings say what is loading and when it has arrived', () => {
  assert.equal(STRINGS.loading('your bookings'), 'Loading your bookings');
  assert.equal(STRINGS.loaded('your bookings'), 'Your bookings loaded');
  assert.equal(STRINGS.loading(''), 'Loading');
  assert.equal(STRINGS.loaded(''), 'Loaded');
  for (const s of [STRINGS.loading('x'), STRINGS.loaded('x')]) assert.ok(!s.includes('—'));
});

test('text seeds work as well as numbers', () => {
  const b = { x: 0, y: 0, w: 120, h: 12, r: 6, kind: 'line' };
  const o = outline(b, { seed: 'garden' });
  assert.ok(!o.d.includes('NaN') && Number.isFinite(o.length));
  assert.equal(outline(b, { seed: 'garden' }).d, o.d);
  assert.notEqual(outline(b, { seed: 'balcao' }).d, o.d);
  assert.equal(outline(b, { seed: '3' }).d, outline(b, { seed: 3 }).d, 'numeric text reads as the number');
  const L = layout('card', { seed: 'garden' });
  assert.ok(L.blocks.every(k => Number.isFinite(k.w)));
});
