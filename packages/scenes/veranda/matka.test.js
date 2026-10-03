import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATKA, surfacePoints, toScreen, extentIn, flowShape, quantise } from './matka.core.js';

const screen = (theta, px = 100) => toScreen(surfacePoints(theta), 200, 300, px);

test('the pot is a pot: 1 tall, widest a little below the middle, with a handle out one side and a spout out the other', () => {
  const pts = surfacePoints(0), ys = pts.map(p => p.y);
  assert.ok(Math.abs(Math.min(...ys)) < 1e-9 && Math.abs(Math.max(...ys) - 1) < 1e-9, 'foot at 0, lip at 1');
  const body = MATKA.profile.reduce((a, b) => (b[0] > a[0] ? b : a));
  assert.ok(body[1] > 0.3 && body[1] < 0.6, 'belly at ' + body[1]);
  assert.ok(Math.max(...pts.map(p => p.x)) > body[0] + 0.05, 'the handle stands out on the right');
  assert.ok(Math.min(...pts.map(p => p.x)) < -body[0] - 0.1, 'the spout stands out on the left');
});

test('turning the pot changes its silhouette; turning it a whole turn does not', () => {
  const band = th => extentIn(screen(th), 300 - 60, 300 - 40);
  const a = band(0), b = band(Math.PI / 2), c = band(Math.PI), d = band(2 * Math.PI);
  assert.ok(Math.abs(a[0] - d[0]) < 1e-6 && Math.abs(a[1] - d[1]) < 1e-6, 'a full turn is the same');
  assert.ok(Math.abs(a[0] - c[0]) > 5 || Math.abs(a[1] - c[1]) > 5, 'half a turn swaps handle and spout: ' + a + ' against ' + c);
  const widths = [0, 0.5, 1, 1.5, 2, 2.5, 3].map(t => extentIn(screen(t), 300 - 60, 300 - 40)).map(e => e[1] - e[0]);
  assert.ok(Math.max(...widths) - Math.min(...widths) > 4, 'the silhouette breathes as it turns: ' + widths.map(w => w.toFixed(0)));
  assert.ok(b);
});

test('extentIn: nothing above the lip, and the band just above the foot is the foot', () => {
  const s = screen(0);
  assert.equal(extentIn(s, 0, 100), null, 'no pot at the top of the picture');
  const foot = extentIn(s, 296, 300);
  assert.ok(foot[1] - foot[0] < 60, 'the foot is narrow: ' + (foot[1] - foot[0]));
});

test('flowShape: the whole column where the pot is not, the wider side where it is, and never across it', () => {
  const col = { x: 100, y: 100, w: 300, h: 200 };
  const pose = th => { const s = screen(th, 150); return (top, bottom) => extentIn(s, top, bottom); };
  for (const th of [0, 1, 2, 3, 4, 5]) {
    const ext = pose(th), shape = flowShape(col, ext, 8);
    assert.deepEqual(shape(100, 110), ext(100, 110) ? shape(100, 110) : { x: 100, w: 300 });
    for (let top = 100; top + 20 <= 300; top += 10) {
      const room = shape(top, top + 20), e = ext(top, top + 20);
      if (!room) continue;
      assert.ok(room.x >= col.x - 1e-9 && room.x + room.w <= col.x + col.w + 1e-9, 'inside the column');
      if (e) assert.ok(room.x + room.w <= e[0] - 8 + 1e-6 || room.x >= e[1] + 8 - 1e-6, 'a line at ' + top + ' (turn ' + th + ') clears the pot');
    }
  }
  assert.equal(flowShape(col, () => null)(50, 70), null, 'outside the column there is no room');
});

test('quantise: 16 steps a turn, so a line moves at most sixteen times a turn', () => {
  const seen = new Set();
  for (let t = 0; t < 2 * Math.PI; t += 0.01) seen.add(quantise(t).toFixed(6));
  assert.equal(seen.size, 16);
  assert.equal(quantise(0), 0); assert.ok(Math.abs(quantise(2 * Math.PI)) < 1e-9);
  assert.ok(Math.abs(quantise(-0.01)) < 1e-9);
});
