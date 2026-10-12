import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapBoxes, lineBoxes, spanStyle, baselineOf, quadPlan, frameCovering, depthScale, worldAt, frustumOf, CAM_D } from './text.core.js';

const lines = [{ block: 0, text: 'The clay pot on', x: -300, y: -230, w: 210, h: 22, room: 300 }, { block: 0, text: 'the seat', x: -300, y: -208, w: 80, h: 22, room: 300 }];
const col = { x: -300, y: -230, w: 310, h: 330 };

test('lineBoxes: boxes relative to the column, a space kept after every line but the last', () => {
  const b = lineBoxes(lines, col);
  assert.deepEqual(b.map(q => [q.x, q.y, q.text, q.tail]), [[0, 0, 'The clay pot on', ' '], [0, 22, 'the seat', '']]);
});

test('lineBoxes: a line that already ends in a space (as the oracle leaves it) is not given a second', () => {
  const b = lineBoxes([{ ...lines[0], text: 'The clay pot on ' }, lines[1]], col);
  assert.equal(b[0].tail, ''); assert.equal(b[0].text + b[0].tail, 'The clay pot on ');
});

test('the two painters read the same boxes: a span\'s left, top and words are a quad\'s', () => {
  const boxes = lineBoxes(lines, col), font = '400 16px Kalam', plan = quadPlan(boxes, { font, ink: '#222', dpr: 2 });
  boxes.forEach((b, i) => {
    const s = spanStyle(b, { font, lineHeight: 22 });
    assert.equal(parseFloat(s.left), plan[i].x); assert.equal(parseFloat(s.top), plan[i].y);
    assert.equal((b.text + b.tail).trimEnd(), plan[i].text);
    assert.equal(s.font, font);
    assert.equal(plan[i].h, b.h); assert.equal(plan[i].w, b.w);
  });
});

test('quadPlan: textures sized in device px with room for overhang; a key that changes with text, font, ink and density only', () => {
  const b = lineBoxes(lines, col), a = quadPlan(b, { font: 'f', ink: 'i', dpr: 2 });
  assert.equal(a[0].texW, Math.ceil((210 + 4) * 2)); assert.equal(a[0].texH, 44);
  assert.equal(new Set(a.map(q => q.key)).size, 2);
  const moved = quadPlan(lineBoxes(lines.map(l => ({ ...l, x: l.x + 30 })), col), { font: 'f', ink: 'i', dpr: 2 });
  assert.deepEqual(moved.map(q => q.key), a.map(q => q.key), 'a line that only moves needs no new texture');
  for (const alt of [{ font: 'g', ink: 'i', dpr: 2 }, { font: 'f', ink: 'j', dpr: 2 }, { font: 'f', ink: 'i', dpr: 1 }]) assert.notEqual(quadPlan(b, alt)[0].key, a[0].key);
});

test('baselineOf: the half-leading is shared above and below, as CSS does', () => {
  assert.equal(baselineOf(22, 14, 6), 15);
  assert.equal(baselineOf(20, 14, 6), 14);
});

test('frameCovering: the canvas covers a rectangle round the anchor, with the anchor at (cx, cy)', () => {
  const f = frameCovering({ x: -300, y: -90, w: 380, h: 260 }, 80, 2, 6);
  assert.deepEqual([f.wc, f.hc, f.cx, f.cy], [392, 272, 306, 96]);
  assert.equal(f.h, 80); assert.equal(f.dpr, 2);
});

test('worldAt and frustumOf: a quad placed by worldAt lands on the canvas px it was placed at, at any depth', () => {
  const f = frameCovering({ x: -300, y: -90, w: 380, h: 260 }, 80, 2, 6), fr = frustumOf(f, 1, CAM_D);
  for (const z of [0, -0.6, 0.4]) for (const [sx, sy] of [[10, 10], [200, 150], [380, 260], [306, 96]]) {
    // the camera at (0, 0, D) looking down -z: a point's x on the near plane is x * near / (D - z)
    const w = worldAt(sx, sy, f, z), nx = w.x / (CAM_D - z), ny = w.y / (CAM_D - z);
    const px = (((2 * nx - (fr.right + fr.left)) / (fr.right - fr.left)) * 0.5 + 0.5) * f.wc;
    const py = (1 - (((2 * ny - (fr.top + fr.bottom)) / (fr.top - fr.bottom)) * 0.5 + 0.5)) * f.hc;
    assert.ok(Math.abs(px - sx) < 1e-6 && Math.abs(py - sy) < 1e-6, `z ${z}: (${sx}, ${sy}) came back as (${px}, ${py})`);
  }
  assert.ok(depthScale(-0.6) > 1 && depthScale(0.4) < 1 && depthScale(0) === 1);
});

test('snapBoxes: each baseline lands a hair below a whole CSS pixel in page px, within half a pixel of where it was', () => {
  const boxes = lineBoxes(lines.map((l, i) => ({ ...l, y: -230 + i * 25.2 })), col);
  const out = snapBoxes(boxes, { pageY: 582.61, base: 17 });
  out.forEach((b, i) => {
    const abs = 582.61 + b.y + 17;
    assert.ok(Math.abs(abs - Math.round(abs) - 0.02) < 1e-6, `line ${i}: ${abs}`);
    assert.ok(Math.abs(b.y - boxes[i].y) <= 0.52);
    assert.equal(b.x, boxes[i].x); assert.equal(b.text, boxes[i].text);
  });
});
