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

// ── one layout, two painters (rung 5) ────────────────────────────────────────
import { createLayout } from '../../type/layout.core.js';
import { createFakeOracle } from '../../type/oracle.fake.js';
import { lineBoxes, spanStyle, quadPlan } from '../../stage3d/text.core.js';
import { columnAt, hugFloat } from './matka.core.js';

const WORDS = 'The clay pot on the seat is where the water is kept cool. It has stood there since before the roof was retiled, and it turns, slowly, when nobody is looking, so that every side of it gets the same share of the evening light.';

test('one layout, two painters: the spans and the quads are fed the same lines and agree on every text and box, at every turn of the pot', () => {
  const hq = 78, col = columnAt(hq), px = 14.4, font = `400 ${px}px Kalam`, lh = px * 1.4, lay = createLayout(createFakeOracle());
  let shortened = 0;
  for (let step = 0; step < 16; step++) {
    const th = step / 16 * 2 * Math.PI, pot = toScreen(surfacePoints(th), 0, 0, hq);
    const shape = flowShape(col, (t, b) => extentIn(pot, t, b), Math.max(8, hq * 0.2));
    const { lines } = lay.layIntoShape([{ prepared: lay.prepare(WORDS, font), lineHeight: lh, gap: 0 }], shape, { top: col.y, bottom: col.y + col.h, scale: 1, minWidth: px * 4 });
    assert.ok(lines.length >= 5, 'a paragraph');
    const boxes = lineBoxes(lines, col), plan = quadPlan(boxes, { font, ink: '#222', dpr: 2 });
    // painter 1, the span writer: the text a span holds and where it puts it
    const spans = boxes.map(b => ({ text: b.text + b.tail, ...spanStyle(b, { font, lineHeight: lh }) }));
    assert.equal(spans.length, plan.length);
    spans.forEach((s, i) => {
      assert.equal(s.text.trimEnd(), plan[i].text.trimEnd(), `line ${i} reads the same`);
      assert.equal(parseFloat(s.left), +plan[i].x.toFixed(2)); assert.equal(parseFloat(s.top), +plan[i].y.toFixed(2));
      // and both are the layout's own box, moved to the column's corner
      assert.ok(Math.abs(plan[i].x - (lines[i].x - col.x)) < 1e-9 && Math.abs(plan[i].y - (lines[i].y - col.y)) < 1e-9);
      assert.ok(plan[i].w === lines[i].w && plan[i].h === lines[i].h);
    });
    assert.equal(spans.map(s => s.text).join('').replace(/\s+/g, ' ').trim(), WORDS.replace(/\s+/g, ' '), 'the words are whole and in order');
    shortened += lines.filter(l => l.w < col.w - 8 && l.room < col.w - 8).length;
    for (const l of lines) { const e = extentIn(pot, l.y, l.y + l.h); if (e) assert.ok(l.x + l.w <= e[0] - 8 + 1e-6, 'a line clears the pot'); }
  }
  assert.ok(shortened >= 16 * 3, 'the pot shortens lines at every turn: ' + shortened);
});

test('the still\'s hug is a float beside the column\'s right edge, and the paragraph needs no oracle to lay itself', () => {
  for (const hq of [55, 78, 120]) {
    const col = columnAt(hq), h = hugFloat(toScreen(surfacePoints(0.6), 0, 0, hq), col, { pad: Math.max(8, hq * 0.2) });
    assert.ok(h && h.w > hq * 0.3 && h.w < hq * 1.2 && h.h > hq * 0.9, `the hug at ${hq}: ${h.w.toFixed(0)} x ${h.h.toFixed(0)}`);
    assert.ok(h.polygon.startsWith('polygon('));
  }
});
