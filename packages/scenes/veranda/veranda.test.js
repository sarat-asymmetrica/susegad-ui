import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Z_NEAR, Z_FAR, depthToZ } from '../../stage3d/stage3d.core.js';
import {
  W, H, GW, GH, S, EYE, TAN_Y, SOLIDS, IDX, rayAt, project, projectM, zToDepth, depthByte, trace, shadowed, gbuffer, depthMap, layersMap,
} from './world.js';
import { model, sunAt, lampSwing, motes, LOOKS, SUN_REST } from './model.js';
import { meta } from './meta.js';

// the G-buffer is the slow part (about a third of a second); every test that needs it shares this one
const G = gbuffer(GW, GH);
const MAP = depthMap(G);
const at = (map, u, v, w = GW, h = GH) => map[Math.min(h - 1, Math.floor(v * h)) * w + Math.min(w - 1, Math.floor(u * w))];

// ── the camera ─────────────────────────────────────────────────────────────

test('the camera is the one <sg-depth-photo> rests on: fov 50, aspect 3:2, eye level on the horizon', () => {
  assert.ok(Math.abs(TAN_Y - Math.tan(25 * Math.PI / 180)) < 1e-12);
  assert.equal(W / H, 1.5);
  // a point straight ahead at any distance sits at the centre; the horizon (eye level) is v = 0.5
  assert.deepEqual(project(0, 0, 5), [0.5, 0.5]);
  const [u, v] = project(0.3, 0.2, 2);
  const [dx, dy] = rayAt(u, v);
  assert.ok(Math.abs(dx * 2 - 0.3) < 1e-12 && Math.abs(dy * 2 - 0.2) < 1e-12, 'rayAt inverts project');
});

test('the depth encoding is <sg-depth-photo>\'s: linear in inverse distance, 1 at Z_NEAR, 0 at Z_FAR', () => {
  assert.equal(zToDepth(Z_NEAR), 1);
  assert.equal(zToDepth(Z_FAR), 0);
  assert.equal(zToDepth(0.2), 1);
  assert.equal(zToDepth(50), 0);
  for (const d of [0.1, 0.37, 0.8]) assert.ok(Math.abs(zToDepth(depthToZ(d)) - d) < 1e-12, `round trip at ${d}`);
  assert.ok(zToDepth(2) > zToDepth(3) && zToDepth(3) > zToDepth(6));
});

// ── the world ──────────────────────────────────────────────────────────────

test('the solids are what the drawing says they are: four pillars, a door, a window, a lamp, a garden', () => {
  for (const id of ['pillar1', 'pillar2', 'pillar3', 'pillar4', 'door', 'shutter', 'seat1', 'seat3', 'lamp', 'chain', 'mcrown', 'paddy', 'garden', 'floor', 'roof', 'wall']) assert.ok(id in IDX, id);
  assert.equal(new Set(SOLIDS.map(s => s.id)).size, SOLIDS.length, 'ids are unique');
  assert.ok(SOLIDS.filter(s => s.subject).length >= 3, 'the lamp is the subject');
});

test('rays meet the nearest solid: the near pillar, the floor, the wall, the sky', () => {
  const id = (x, y, z) => { const [u, v] = projectM(x, y, z); return SOLIDS[trace(u, v).i]?.id; };
  assert.equal(id(1.5, 1.2, 3.22), 'pillar1');
  assert.equal(id(0, 0, 4), 'floor');
  assert.equal(id(-1.35, 2.7, 6), 'wall');
  assert.equal(id(-1.24, 1.9, 7), 'door');
  assert.equal(id(1.1, 0.46, 4.5), 'slab1');
  // straight up is the roof; straight ahead at eye level runs level over the garden to the sky
  assert.equal(SOLIDS[trace(0.5, 0.05).i]?.id, 'roof');
  assert.equal(trace(0.5, 0.5).i, -1);
});

// ── gate 8: the depth map is exact ──────────────────────────────────────────

/** Known points in metres, with where they sit on their solid. Two of them are 2 px inside a pillar's edge, so that a blur must show. */
const px2 = (x, y, z) => { const [u] = projectM(x, y, z), [u2] = projectM(x + 0.001, y, z); return (u2 - u) * GW; }; // u-pixels per mm
const POINTS = [
  ['the near pillar, front face', 1.5, 1.2, 3.22],
  ['the near pillar, 2 px inside its left edge', 1.32 + 2 / (px2(1.32, 1.2, 3.22) * 1000), 1.2, 3.22],
  ['the near pillar, 2 px inside its right edge', 1.68 - 2 / (px2(1.68, 1.2, 3.22) * 1000), 1.2, 3.22],
  ['the far pillar, front face', 1.5, 1.2, 10.72],
  ['the door leaf', -1.24, 1.9, 7],
  ['the balcao seat, top', 1.1, 0.46, 4.5],
  ['the floor, near', 0, 0, 2.6],
  ['the floor, middle', 0, 0, 5],
  ['the floor, far', 0, 0, 9],
  ['the wall, above the door', -1.35, 2.7, 6],
  ['the lamp, front', 0.25, 2.37, 4.26],
].map(([name, x, y, z]) => ({ name, at: projectM(x, y, z).slice(0, 2), Z: z * S }));

/** Where the map disagrees with the geometry by more than one step (of 255). */
const disagreements = (map, w = GW, h = GH, pts = POINTS) => pts.filter(p => Math.abs(at(map, p.at[0], p.at[1], w, h) - depthByte(p.Z)) > 1).map(p => p.name);

test('depth is exact: every known point matches the geometry within one step', () => {
  assert.deepEqual(disagreements(MAP), []);
  // closed forms for the ground and the sky, which do not go through the ray caster's own solids
  const paddy = [...Array(GW * GH).keys()].filter(k => SOLIDS[G.id[k]]?.id === 'paddy');
  assert.ok(paddy.length > 500, `the paddy is on the picture (${paddy.length} px)`);
  const k = paddy[Math.floor(paddy.length / 2)], v = (Math.floor(k / GW) + 0.5) / GH;
  const Z = (-0.6 - EYE) * S / ((1 - 2 * v) * TAN_Y); // the ground plane's own closed form
  assert.ok(Math.abs(MAP[k] - depthByte(Z)) <= 1, `paddy: ${MAP[k]} against ${depthByte(Z)} (v ${v.toFixed(3)})`);
  const sky = [...Array(GW * GH).keys()].filter(k2 => G.id[k2] < 0);
  assert.ok(sky.length > 500 && sky.every(k2 => MAP[k2] === 0), 'the sky is 0');
});

/** A box blur of radius r over the byte map: what a depth model's smooth output looks like. */
function blur(map, w, h, r) {
  const out = new Uint8ClampedArray(map.length), tmp = new Float32Array(map.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) s += map[y * w + Math.min(w - 1, Math.max(0, x + i))]; tmp[y * w + x] = s / (2 * r + 1); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) s += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x]; out[y * w + x] = s / (2 * r + 1); }
  return out;
}

test('depth is exact: controls. A blurred map fails, and so does a map with the pillars 3% too far', () => {
  const blurred = disagreements(blur(MAP, GW, GH, 3));
  assert.ok(blurred.length >= 1 && blurred.includes('the near pillar, 2 px inside its right edge'), `a 3 px blur must fail at the edge it blurs (it failed: ${blurred.join('; ')})`);
  const far = MAP.slice();
  for (let k = 0; k < far.length; k++) if (SOLIDS[G.id[k]]?.id?.startsWith('pillar')) far[k] = depthByte(G.z[k] * 1.03);
  const off = disagreements(far);
  assert.ok(off.includes('the near pillar, front face') && off.includes('the far pillar, front face'), `pillars 3% too far must fail (it failed: ${off.join('; ')})`);
  assert.ok(!off.includes('the floor, near'), 'and the floor, which was left alone, still passes');
});

test('the layers map: G is the sky, B is the subject (the lamp), R is empty', () => {
  const L = layersMap(G);
  let sky = 0, subject = 0, other = 0;
  for (let k = 0; k < GW * GH; k++) {
    const i = G.id[k], g = L[k * 4 + 1], b = L[k * 4 + 2];
    assert.equal(L[k * 4], 0, 'no water here');
    if (i < 0) { assert.equal(g, 255); assert.equal(b, 0); sky++; }
    else if (SOLIDS[i].subject) { assert.equal(b, 255); assert.equal(g, 0); subject++; }
    else { assert.equal(g, 0); assert.equal(b, 0); other++; }
  }
  assert.ok(sky > 1000 && subject > 500 && other > sky, `sky ${sky}, subject ${subject}, other ${other}`);
});

// ── the sun and the shadows ─────────────────────────────────────────────────

test('the sun always shines from the far end and low enough to slip under the eave', () => {
  for (const s of [0, 0.35, 1]) {
    const L = sunAt(s);
    assert.ok(Math.abs(Math.hypot(...L) - 1) < 1e-12);
    assert.ok(L[2] > 0.15 && L[0] > 0.4 && L[1] > 0.15 && L[1] / L[0] < 0.6, `sun at ${s}: ${L.map(v => v.toFixed(2))}`);
  }
});

test('the pillars cast real shadows on the floor, and they move with the sun', () => {
  const floorPoint = (x, z) => [x * S, (0 - EYE) * S + 1e-4, z * S];
  // the sun is beyond the far end, so a floor row just in front of the near pillar (toward the camera) is shaded where the pillar stands between it and the sun
  const L = sunAt(SUN_REST);
  const sh = [];
  for (let x = -1.2; x < 1.3; x += 0.05) sh.push(shadowed(floorPoint(x, 2.9), L, IDX.floor));
  assert.ok(sh.some(Boolean) && sh.some(v => !v), 'a floor row is part shade and part sun');
  const before = sh.map(Number).join('');
  const other = []; for (let x = -1.2; x < 1.3; x += 0.05) other.push(shadowed(floorPoint(x, 2.9), sunAt(0), IDX.floor));
  assert.notEqual(other.map(Number).join(''), before, 'moving the sun moves the shade');
});

// ── the model ──────────────────────────────────────────────────────────────

test('the model is a pure function of time, seed, register and params', () => {
  const s = { time: 3.7, seed: 4, register: 'warm', params: { sun: 0.4, mood: 'auto' }, W, H };
  assert.deepEqual(model(s), model(structuredClone(s)));
  assert.notDeepEqual(model({ ...s, seed: 5 }).motes, model(s).motes, 'a seed is a different scatter of dust');
  assert.deepEqual(model({ ...s, seed: 4 }).motes, model(s).motes);
});

test('the registers set how much moves: quiet nothing, warm a slow lamp and dust, playful more', () => {
  const at = register => model({ time: 5.2, seed: 1, register, params: { sun: SUN_REST, mood: 'auto' }, W, H });
  assert.equal(at('quiet').swing, 0);
  assert.equal(at('quiet').motes.length, 0);
  assert.equal(at('quiet').settled, true);
  assert.ok(Math.abs(at('warm').swing) > 0 && at('warm').motes.length === LOOKS.warm.motes);
  assert.ok(at('playful').motes.length > at('warm').motes.length);
  assert.ok(LOOKS.playful.hand && !LOOKS.warm.hand && !LOOKS.quiet.hand, 'only playful lets the hand move the sun');
  assert.equal(lampSwing(0, 'playful'), 0, 'the lamp starts at rest, so the still (time 0) is the lamp at rest');
  const peak = Math.max(...Array.from({ length: 400 }, (_, i) => Math.abs(lampSwing(i * 0.05, 'playful'))));
  assert.ok(peak > 0.03 && peak <= LOOKS.playful.swing * 1.0001, `playful swing peaks at ${peak.toFixed(3)} rad`);
});

test('the dust stays inside the picture', () => {
  for (const t of [0, 10, 100]) for (const m of motes(t, 1, 'playful')) assert.ok(m.x > 0 && m.x < W + 30 && m.y > 0 && m.y < H, `${m.x}, ${m.y}`);
});

test('meta is what the docs and the registry need', () => {
  assert.equal(meta.W, W); assert.equal(meta.H, H);
  assert.equal(meta.stillTime, 0, 'the still is the lamp at rest');
  assert.ok(meta.alt.length > 40 && !meta.alt.includes('—'));
});

// ── the far tree: a tree in the garden, not a band under the roof ────────────

test('the far tree has a trunk under a rounded crown, and its crown is not a band', () => {
  const count = ids => { let n = 0; for (let k = 0; k < G.id.length; k++) if (ids.includes(SOLIDS[G.id[k]]?.id)) n++; return n; };
  const crowns = ['mcrown', 'mlobeL', 'mlobeR'];
  assert.ok(count(['mtrunk']) >= 150, `the trunk shows under the crown (${count(['mtrunk'])} px)`);
  // the crown's visible rows: how wide the green is on each, from its top row to its bottom row
  const widths = [];
  for (let y = 0; y < GH; y++) { let n = 0; for (let x = 0; x < GW; x++) if (crowns.includes(SOLIDS[G.id[y * GW + x]]?.id)) n++; if (n) widths.push(n); }
  // the roof must not cut the crown into a band: along the crown's top edge, a third or more of it is against the sky, not the roof
  let tops = 0, skyTops = 0;
  for (let x = 0; x < GW; x++) for (let y = 1; y < GH; y++) if (crowns.includes(SOLIDS[G.id[y * GW + x]]?.id)) { tops++; if (G.id[(y - 1) * GW + x] < 0) skyTops++; break; }
  assert.ok(tops > 20 && skyTops >= tops * 0.3, `the crown's top shows against the sky: ${skyTops} of ${tops} columns (the rest are under the roof)`);
  const widest = Math.max(...widths);
  assert.ok(widest <= GW * 0.28, `the crown is a tree's width, not a slab across the corridor: ${widest} px of ${GW}`);
  const last = widths.slice(-4).reduce((a, b) => a + b, 0) / 4;
  assert.ok(last < widest * 0.7, `the crown rounds off at the bottom: its last rows are ${last.toFixed(0)} px wide against ${widest} at the widest`);
});

// ── anchors: places a note can stick to ─────────────────────────────────────

import { ANCHORS, anchorPoint } from './world.js';

test('every anchor is a visible point on a real surface: the ray to it meets that surface, not something in front', () => {
  assert.ok(ANCHORS.length >= 6);
  assert.equal(new Set(ANCHORS.map(a => a.id)).size, ANCHORS.length);
  const want = { window: 'shutter', door: 'door', pillar: 'pillar1', balcao: 'slab1', lamp: 'lamp', mango: 'mtrunk' };
  for (const a of ANCHORS) {
    const p = anchorPoint(a), r = trace(p.u, p.v), Z = a.at[2] * S;
    assert.equal(SOLIDS[r.i]?.id, want[a.id], `${a.id} lies on ${want[a.id]}, the ray meets ${SOLIDS[r.i]?.id}`);
    assert.ok(Math.abs(r.t - Z) < 0.02, `${a.id}: the surface is at ${r.t.toFixed(3)}, the anchor at ${Z.toFixed(3)}`);
    assert.ok(Math.abs(p.d - zToDepth(r.t)) < 0.01 && p.u > 0 && p.u < 1 && p.v > 0 && p.v < 1);
    assert.ok(a.label && !a.label.includes('—'));
  }
});
