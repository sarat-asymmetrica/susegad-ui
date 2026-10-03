import test from 'node:test';
import assert from 'node:assert/strict';
import ghat from './index.js';
import { buildGhat, geoOf, contours, heightAt, heightText, inkAt, model, front, LOOKS, TL, M, GW, GH, C, STEP, STILL_TIME, INK_DELAY } from './model.js';
import { meta } from './meta.js';
import { paramsFromAttributes, defaultParams } from '../../core/define-scene.js';

const G = geoOf(1);
const P = (o = {}) => ({ ...defaultParams(ghat.params), ...o });

test('the same seed gives the same survey; another seed differs', () => {
  const again = buildGhat(1);
  assert.deepEqual(Array.from(again.h.slice(0, 500)), Array.from(G.h.slice(0, 500)));
  assert.deepEqual(again.road, G.road);
  assert.notDeepEqual(Array.from(geoOf(2).h.slice(4000, 4100)), Array.from(G.h.slice(4000, 4100)));
});

test('the land rises from the sea in the west to a ridge in the east', () => {
  const row = Math.round(GH / 2), at = i => G.h[row * GW + i];
  assert.ok(at(2) < 0, 'sea at the west edge');
  assert.ok(at(GW - 10) > 400, `ridge in the east: ${at(GW - 10)}`);
  assert.ok(G.hmax > 600 && G.hmax < 1400, `hmax ${G.hmax}`);
});

test('every contour is closed, or ends at the edge of the sheet', () => {
  const edge = ([x, y]) => x < M.x0 + C * 1.5 || x > M.x1 - C * 1.5 || y < M.y0 + C * 1.5 || y > M.y1 - C * 1.5;
  let open = 0;
  for (const L of G.levels) for (const ln of L.lines) {
    if (ln.closed) continue;
    open++;
    assert.ok(edge(ln.pts[0]) && edge(ln.pts.at(-1)), `level ${L.level}: an open line ends inside the sheet at ${ln.pts[0]} / ${ln.pts.at(-1)}`);
  }
  assert.ok(open > 0);
  assert.equal(G.levels.filter(l => !l.sea && !l.coast)[0].level, STEP);
});

test('the main river reaches the sea', () => {
  const main = G.rivers.find(r => r.kind === 'main');
  const mouth = main.cells.at(-1);
  assert.ok(G.h[mouth] <= 0 || G.h[main.cells.at(-2)] < 5, 'the last cell is at sea level');
  assert.ok(main.cells.length > 40, `a long river: ${main.cells.length} cells`);
  // it runs downhill toward the mouth, broadly
  assert.ok(G.h[main.cells[0]] > G.h[mouth] + 100);
});

test('the road is one connected line that climbs the escarpment', () => {
  assert.ok(G.road.length > 20, `${G.road.length} points`);
  for (let i = 1; i < G.road.length; i++) {
    const [x0, y0] = G.road[i - 1], [x1, y1] = G.road[i];
    assert.ok(Math.hypot(x1 - x0, y1 - y0) < C * 3, `a gap in the road at ${i}`);
  }
  const hs = [G.road[0], G.road.at(-1)].map(([x, y]) => heightAt(G, x, y));
  assert.ok(hs[1] - hs[0] > 300, `it climbs: ${hs}`);
});

test('marching squares on a single hill gives one closed ring', () => {
  const h = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) h[j * GW + i] = 100 - Math.hypot(i - GW / 2, j - GH / 2);
  const lines = contours(h, 80);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].closed);
});

test('heights: on land in metres, at sea in depth, off the sheet nothing', () => {
  assert.equal(heightAt(G, 0, 0), null);
  assert.equal(heightText(352), '350 m');
  assert.equal(heightText(-12.4), '12 m deep');
  assert.ok(heightAt(G, M.x0 + 20, (M.y0 + M.y1) / 2) < 0);
});

test('time inks the sheet in 22 s in warm and 14 in playful; quiet is inked', () => {
  assert.equal(inkAt(0, 'warm'), 0);
  assert.equal(inkAt(INK_DELAY + 11, 'warm'), 0.5);
  assert.equal(inkAt(INK_DELAY + 14, 'playful'), 1);
  assert.equal(inkAt(0, 'quiet'), 1);
  for (const r of Object.keys(LOOKS)) assert.equal(inkAt(STILL_TIME, r), 1, r);
  assert.ok(front(0) < 0 && front(1) > 1, 'the front starts below the sea and ends above the ridge');
  assert.ok(TL.land[1] < TL.labels[1]);
});

test('with progress set, time stands still, the scene rests, and the status says it', () => {
  const a = model({ time: 0, register: 'warm', params: P({ progress: 0.4 }) });
  const b = model({ time: 99, register: 'warm', params: P({ progress: 0.4 }) });
  assert.equal(a.P, 0.4); assert.equal(b.P, 0.4); assert.ok(a.settled);
  assert.ok(!model({ time: 3, register: 'warm', params: P() }).settled);
  assert.equal(ghat.status(P({ progress: 0.4 })), '40% done');
  assert.equal(ghat.status(P()), '');
  assert.equal(paramsFromAttributes(ghat.params, n => (n === 'progress' ? '2' : null)).progress, 1);
});

test('meta: no em dash, keys for the playful hand', () => {
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
  assert.deepEqual(ghat.interactive, ['playful']);
});
