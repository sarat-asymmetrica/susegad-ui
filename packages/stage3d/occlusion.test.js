import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { extentIn, flowShape, rowsOf, silhouetteOf, cssPolygon, hugFloat } from './occlusion.core.js';
import { shapeOf } from '../type/layout.core.js';

// a lopsided object: a body 100 wide with a bump on the left at mid-height, standing on y = 0 and 200 tall (screen y down)
const blob = [];
for (let i = 0; i <= 40; i++) {
  const y = -200 + i * 5, t = (y + 100) / 100, half = 50 * Math.sqrt(Math.max(0, 1 - t * t)) + 4;
  blob.push([half, y], [-half - (Math.abs(y + 100) < 15 ? 30 : 0), y]);
}
const col = { x: -300, y: -230, w: 310, h: 330 };

test('extentIn: the points within a band, or null', () => {
  assert.deepEqual(extentIn([[1, 10], [5, 12], [9, 40]], 9, 13, 0), [1, 5]);
  assert.equal(extentIn([[1, 10]], 20, 30, 0), null);
});

test('silhouetteOf: a polygon descriptor the geometry core takes, whose room is the object where it stands', () => {
  const d = silhouetteOf(blob, { top: -200, bottom: 0, rows: 40 });
  assert.equal(d.kind, 'polygon');
  const shape = shapeOf(d);
  for (const [top, bottom] of [[-140, -130], [-110, -90], [-60, -40]]) {
    const room = shape(top, bottom), e = extentIn(blob, top, bottom, 5);
    assert.ok(room, `room at ${top}`);
    assert.ok(room.x <= e[0] + 6 && room.x + room.w >= e[1] - 6, `the polygon covers the object at ${top}: ${room.x}..${room.x + room.w} against ${e}`);
  }
  assert.equal(silhouetteOf([[0, 0]], { top: 0, bottom: 10 }), null, 'one point is not a silhouette');
  assert.equal(silhouetteOf(blob, { top: 100, bottom: 200 }), null, 'nothing there');
});

test('silhouetteOf with pad is the keep-out: every point of the object is inside it by at least pad', () => {
  const pad = 8, d = silhouetteOf(blob, { top: -210, bottom: 10, rows: 55, pad });
  const room = shapeOf(d);
  for (let y = -190; y < -10; y += 20) {
    const r = room(y, y + 4), e = extentIn(blob, y, y + 4, 0);
    assert.ok(r.x <= e[0] - pad + 1e-6 && r.x + r.w >= e[1] + pad - 1e-6, `at ${y}: ${r.x}..${r.x + r.w} against ${e}`);
  }
});

test('hugFloat: the still\'s float clears the object on every row and is as tight as the live room, within a pad and a row', () => {
  const pad = 8, h = hugFloat(blob, col, { pad, rows: 48 });
  assert.ok(h && h.w > 0 && h.h > 0);
  assert.match(h.polygon, /^polygon\((-?[\d.]+px -?[\d.]+px)(, -?[\d.]+px -?[\d.]+px)+\)$/);
  // the hug's left edge at y, in the column's px (the edge is stepped: two points per row)
  const edgeAt = y => {
    let x = col.w;
    for (let i = 0; i < h.edge.length; i += 2) if (y - col.y >= h.edge[i][1] - 1e-9 && y - col.y <= h.edge[i + 1][1] + 1e-9) x = h.edge[i][0];
    return col.x + x;
  };
  for (const [x, y] of blob) assert.ok(x >= edgeAt(y) + pad - 1.01, `the point ${x},${y} is clear of the hug edge ${edgeAt(y).toFixed(1)}`);
  const live = flowShape(col, (t, b) => extentIn(blob, t, b), pad);
  for (let y = -190; y < -10; y += 20) {
    const liveW = live(y, y + 10).w, hugW = edgeAt(y + 5) - col.x;
    assert.ok(Math.abs(liveW - hugW) <= pad + 10, `at ${y}: live room ${liveW.toFixed(1)}, hug ${hugW.toFixed(1)}`);
  }
});

test('hugFloat: null where the object is clear of the column', () => {
  assert.equal(hugFloat(blob, { x: -900, y: -230, w: 300, h: 330 }), null);
  assert.equal(hugFloat([], col), null);
});

test('cssPolygon: px pairs, moved by an offset', () => {
  assert.equal(cssPolygon([[0, 0], [10.04, 5]], 1, 2), 'polygon(1.0px 2.0px, 11.0px 7.0px)');
});

test('flowShape: the room beside an object, never across it, null off the column', () => {
  const shape = flowShape(col, (t, b) => extentIn(blob, t, b), 8);
  assert.deepEqual(shape(-230, -220), { x: col.x, w: col.w }, 'the whole column above the object');
  const r = shape(-110, -90);
  assert.ok(r.x + r.w <= extentIn(blob, -110, -90)[0] - 8 + 1e-6);
  assert.equal(shape(200, 220), null);
  assert.equal(rowsOf(blob, { top: -200, bottom: 0, rows: 10 }).length, 10);
});

test('no layout logic lives in the stage3d text files: they take lines, they never measure or break one', () => {
  const dir = new URL('.', import.meta.url), seen = readdirSync(dir).filter(f => /^(occlusion|text)\.(core|live)\.js$/.test(f));
  assert.equal(seen.length, 4, seen.join());
  for (const f of seen) {
    const src = readFileSync(new URL(f, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(src, /nextLine|layIntoShape|layZones|createLayout|\.prepare\(|measureText\([^)]*\)\.width|from ['"][^'"]*type\//, `${f} must not measure or break lines`);
  }
});
