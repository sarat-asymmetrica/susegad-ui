import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPTH, zOf, paneScale, depthWords, depthSaid, stepDepth, parseDepth, cutByte, maskAlpha, samplePoints, coveredShare, settleDepth, byteAt, photoAt, rectsHit, hiddenGrid, hiddenIn, shownPath, lineShares, worstShare, settleSpot, placeNote } from './pane.core.js';
import { zToDepth } from './world.js';

test('zOf inverts the encoding <sg-depth-photo> reads', () => {
  for (const d of [0.1, 0.3, 0.5, 0.85]) assert.ok(Math.abs(zToDepth(zOf(d)) - d) < 1e-12, `depth ${d}`);
  assert.ok(zOf(0.1) > zOf(0.5), 'far is a bigger distance');
});

test('the pane is a little smaller far back and a little larger brought forward, and never unreadable', () => {
  assert.ok(Math.abs(paneScale(DEPTH.home) - 1) < 1e-9, 'home is the base size');
  assert.ok(paneScale(0.1) < paneScale(0.3) && paneScale(0.3) < paneScale(0.85));
  for (const d of [0.1, 0.3, 0.85]) assert.ok(paneScale(d) >= 0.78 && paneScale(d) <= 1.25, `scale at ${d}`);
});

test('depth in plain words, never numbers', () => {
  for (const d of [0.1, 0.25, 0.4, 0.6, 0.8]) assert.ok(!/\d/.test(depthSaid(d, 1)) && depthWords(d).length > 10);
  assert.notEqual(depthWords(0.1), depthWords(0.8));
  assert.match(depthSaid(0.8, 1), /brought forward/);
  assert.match(depthSaid(0.2, -1), /moved back/);
});

test('PageUp and PageDown (and the wheel) step the depth, Shift bigger, and stop at the ends', () => {
  assert.equal(stepDepth(0.3, 'PageUp').d, 0.3 + DEPTH.step);
  assert.ok(Math.abs(stepDepth(0.3, 'PageDown', true).d - (0.3 - DEPTH.big)) < 1e-12);
  assert.equal(stepDepth(0.3, 'wheelUp').dir, 1);
  assert.equal(stepDepth(0.3, 'wheelDown').dir, -1);
  assert.equal(stepDepth(DEPTH.max, 'PageUp').moved, false);
  assert.equal(stepDepth(DEPTH.min, 'PageDown').moved, false);
  assert.equal(stepDepth(0.3, 'ArrowLeft'), null);
  assert.equal(parseDepth('0.6'), 0.6); assert.equal(parseDepth('9'), DEPTH.max); assert.equal(parseDepth(null), DEPTH.home);
});

test('the mask hides what is nearer than the pane and nothing else', () => {
  const bytes = Uint8ClampedArray.from([0, 50, 76, 77, 78, 79, 80, 200, 255]);
  const cut = cutByte(0.3); // the pane's own byte, and 2 of slack
  const a = maskAlpha(bytes, 0.3);
  assert.deepEqual([...a], [...bytes].map(b => (b > cut ? 0 : 255)));
  assert.equal(a[7], 0); assert.equal(a[0], 255);
});

test('the covered share and the settle: a pillar in front of half the words', () => {
  // a 100 x 40 stage; a "pillar" (depth byte 190) covers x >= 60; the words are 20..100 wide
  const at = x => (x >= 60 ? 190 : 20);
  const pts = samplePoints([{ x: 20, y: 10, w: 80, h: 20 }], 5);
  assert.ok(pts.length >= 16);
  const share = coveredShare(pts, at, 0.3);
  assert.ok(share > 0.4 && share < 0.6, `about half covered: ${share}`);
  const r = settleDepth(pts, at, 0.3);
  assert.equal(r.moved, true);
  assert.ok(r.d >= 190 / 255 - 0.02 && r.d <= DEPTH.max, `comes forward to the pillar's depth: ${r.d}`);
  assert.ok(r.share <= 0.02);
  // a little covered is left alone: 10% is under the 15% limit
  const little = settleDepth(pts, x => (x >= 92 ? 190 : 20), 0.3);
  assert.equal(little.moved, false);
  // when it cannot be readable however far it comes (a wall of depth 255), it goes as far forward as it may
  assert.equal(settleDepth(pts, () => 255, 0.3).d, DEPTH.max);
});

test('stage px map to photo coordinates from two corners, and the byte lookup clamps at the edges', () => {
  const f = photoAt([10, 20], [110, 120]);
  assert.deepEqual(f(60, 70), [0.5, 0.5]);
  assert.deepEqual(f(10, 20), [0, 0]);
  const bytes = Uint8ClampedArray.from([1, 2, 3, 4]);
  assert.equal(byteAt(bytes, 2, 2, 0.9, 0.9), 4); assert.equal(byteAt(bytes, 2, 2, -3, -3), 1); assert.equal(byteAt(bytes, 2, 2, 5, 0), 2);
});

import { nearestAnchor, cycleAnchor, encodeNotes, decodeNotes, walkPlan, walkAt } from './pane.core.js';

const ANCH = [{ id: 'door', u: 0.37, v: 0.39, d: 0.28 }, { id: 'pillar', u: 0.85, v: 0.5, d: 0.75 }, { id: 'lamp', u: 0.54, v: 0.27, d: 0.55 }];

test('a note dropped on the picture belongs to the nearest anchor, and depth breaks a tie the eye would get wrong', () => {
  assert.equal(nearestAnchor(0.371, 0.391, 72, ANCH).anchor.id, 'door');
  assert.equal(nearestAnchor(0.53, 0.29, 140, ANCH).anchor.id, 'lamp');
  // the same spot on the picture: over the pillar the map is near (190), so it is the pillar; over what shows past it, far (20)
  const near = [{ id: 'pillar', u: 0.8, v: 0.5, d: 0.75 }, { id: 'garden', u: 0.8, v: 0.5, d: 0.05 }];
  assert.equal(nearestAnchor(0.8, 0.5, 190, near).anchor.id, 'pillar');
  assert.equal(nearestAnchor(0.8, 0.5, 15, near).anchor.id, 'garden');
  assert.equal(nearestAnchor(0.5, 0.5, 100, []), null);
});

test('the grip cycles the anchors in a ring', () => {
  assert.equal(cycleAnchor(ANCH, 'door', 1).id, 'pillar');
  assert.equal(cycleAnchor(ANCH, 'lamp', 1).id, 'door');
  assert.equal(cycleAnchor(ANCH, 'door', -1).id, 'lamp');
  const seen = new Set(); let id = 'door'; for (let i = 0; i < 3; i++) { id = cycleAnchor(ANCH, id, 1).id; seen.add(id); }
  assert.deepEqual([...seen].sort(), ['door', 'lamp', 'pillar'], 'the keys reach every anchor a drop can');
});

test('a postcard carries anchors and text ids, and nothing else', () => {
  const notes = [{ anchor: 'door', text: 1 }, { anchor: 'lamp', text: 0 }];
  const h = encodeNotes(notes);
  assert.equal(h, 'notes=door.1,lamp.0');
  assert.deepEqual(decodeNotes('#' + h, ['door', 'lamp', 'pillar'], 3), notes);
  assert.deepEqual(decodeNotes('#a=1&' + h, ['door', 'lamp'], 3), notes);
  assert.deepEqual(decodeNotes('#notes=door.1,door.1,nope.0,lamp.9,lamp.x,pillar.-1', ['door', 'lamp', 'pillar'], 3), [{ anchor: 'door', text: 1 }], 'unknown, repeated and out of range are dropped');
  assert.equal(encodeNotes([]), ''); assert.deepEqual(decodeNotes('', ['door'], 3), []); assert.deepEqual(decodeNotes(null, ['door'], 3), []);
  assert.equal(decodeNotes('#notes=' + Array.from({ length: 30 }, (_, i) => `door.${i}`).join(','), ['door'], 40).length, 12, 'a card holds at most twelve');
});

test('the walk: nearest stop first, the camera moves then holds, and every stop is visited in order', () => {
  const plan = walkPlan([{ id: 'far', d: 0.1 }, { id: 'near', d: 0.75 }, { id: 'mid', d: 0.4 }]);
  assert.deepEqual(plan.map(s => s.id), ['near', 'mid', 'far']);
  assert.ok(plan[0].dolly < plan[1].dolly && plan[1].dolly < plan[2].dolly && plan[2].dolly <= 1);
  assert.equal(walkAt(0, plan).dolly, 0);
  const visited = []; let last = -1, prev = -1;
  for (let p = 0; p < 1; p += 0.005) { const w = walkAt(p, plan); assert.ok(w.dolly >= prev - 1e-9, 'the camera never walks back'); prev = w.dolly; if (w.index !== last) { visited.push(w.index); last = w.index; } }
  assert.deepEqual(visited, [0, 1, 2]);
  const hold = walkAt(0.5 / 3 + 0.03, plan);
  assert.equal(hold.holding, true); assert.ok(Math.abs(hold.dolly - plan[0].dolly) < 1e-9 && Math.abs(hold.focus - plan[0].d) < 1e-9, 'holds on the first stop with its note in focus');
  assert.deepEqual(walkAt(0.4, []), { dolly: 0, focus: DEPTH.home, index: -1, holding: false });
});

test('rects touch only when the air between them is less than the pad', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(rectsHit(a, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(rectsHit(a, { x: 12, y: 0, w: 10, h: 10 }), false);
  assert.equal(rectsHit(a, { x: 12, y: 0, w: 10, h: 10 }, 4), true);
  assert.equal(rectsHit(a, { x: 0, y: 30, w: 10, h: 10 }, 4), false);
});

test('the hidden grid puts each near pixel where the camera puts it, and leaves no holes when it stretches', () => {
  const bytes = new Uint8Array(20).fill(0); for (let i = 10; i < 20; i++) bytes[i] = 200; // the right half is near
  const rest = b => [[0, 0], [100, 10]];
  const g0 = hiddenGrid({ bytes, w: 20, h: 1, cut: 80, corners: rest, cw: 50, ch: 5, sw: 100, sh: 10 });
  const at0 = hiddenIn(g0, 50, 5, 100, 10);
  assert.equal(at0(20, 5), false); assert.equal(at0(60, 5), true); assert.equal(at0(99, 5), true);
  // a camera that slides what is near 30 px to the left (parallax) and stretches it by half again
  const walk = b => (b > 100 ? [[-30, 0], [120, 10]] : [[0, 0], [100, 10]]);
  const g1 = hiddenGrid({ bytes, w: 20, h: 1, cut: 80, corners: walk, cw: 50, ch: 5, sw: 100, sh: 10 });
  const at1 = hiddenIn(g1, 50, 5, 100, 10);
  assert.equal(at1(50, 5), true, 'the near half has slid left over what was open'); assert.equal(at1(35, 5), false);
  let holes = 0; for (let x = 47; x < 100; x += 2) if (!at1(x, 5)) holes++;
  assert.equal(holes, 0, 'no gaps inside the stretched shape');
  assert.equal(at1(-3, 5), false); assert.equal(at1(200, 5), false);
});

test('a line that a doorpost takes the first letters of is caught by its own share, not lost in the pane\'s total', () => {
  const lines = [{ x: 0, y: 0, w: 100, h: 20 }, { x: 0, y: 30, w: 300, h: 20 }], hidden = x => x < 30;
  const s = lineShares(lines, hidden, 4);
  assert.ok(s[0] > 0.25 && s[1] < 0.11);
  assert.ok(worstShare(lines, hidden, 4) > 0.25);
});

const room = { w: 1000, h: 600 };
const pane = { x: 400, y: 200, w: 300, h: 100 }, lines = [{ x: 410, y: 210, w: 200, h: 24 }, { x: 410, y: 240, w: 280, h: 24 }];
test('the pane stays where it is when nothing hides it and no other words are near', () => {
  const r = settleSpot({ lines, panel: pane, stage: room, hiddenAt: () => () => false, d: 0.3 });
  assert.deepEqual([r.dx, r.dy, r.d, r.moved, r.free], [0, 0, 0.3, false, true]);
});
test('the pane comes forward, and only forward, when that is enough', () => {
  const hiddenAt = d => x => d < 0.5 && x < 480;
  const r = settleSpot({ lines, panel: pane, stage: room, hiddenAt, d: 0.3 });
  assert.equal(r.dx, 0); assert.equal(r.dy, 0); assert.ok(r.d >= 0.5 && r.d < 0.53, `depth ${r.d}`); assert.equal(r.moved, true);
});
test('the pane moves clear of a note that sits on its words, by the least it can', () => {
  const note = { x: 380, y: 190, w: 200, h: 50 }, ob = [note];
  const r = settleSpot({ lines, panel: pane, stage: room, obstacles: ob, hiddenAt: () => () => false, d: 0.3 });
  assert.equal(r.moved, true); assert.equal(r.free, true); assert.equal(r.d, 0.3, 'it need not come forward to get out of the way');
  const after = lines.map(l => ({ ...l, x: l.x + r.dx, y: l.y + r.dy }));
  assert.ok(after.every(l => !rectsHit(l, note, 6)), 'no line touches the note');
  assert.ok(Math.hypot(r.dx, r.dy) < 120, `a short move, ${Math.hypot(r.dx, r.dy).toFixed(0)} px`);
});
test('the pane keeps clear of two surfaces at once, and inside the stage', () => {
  const ob = [{ x: 300, y: 100, w: 500, h: 60 }, { x: 350, y: 300, w: 400, h: 120 }];
  const r = settleSpot({ lines, panel: pane, stage: room, obstacles: ob, hiddenAt: () => () => false, d: 0.3 });
  const p = { x: pane.x + r.dx, y: pane.y + r.dy };
  assert.ok(lines.every(l => ob.every(o => !rectsHit({ ...l, x: l.x + r.dx, y: l.y + r.dy }, o, 6))));
  assert.ok(p.x >= 14 && p.y >= 14 && p.x + pane.w <= room.w - 14 && p.y + pane.h <= room.h - 14);
});
test('a pane that cannot be clear anywhere still comes forward and says so (free is false)', () => {
  const ob = [{ x: 0, y: 0, w: 1000, h: 600 }];
  const r = settleSpot({ lines, panel: pane, stage: room, obstacles: ob, hiddenAt: d => x => d < 0.5 && x < 480, d: 0.3 });
  assert.equal(r.free, false); assert.ok(r.d >= 0.5);
});

test('a note stands above its anchor, and goes to another side or higher when something is in its place', () => {
  const stage = { w: 1000, h: 600 }, size = { w: 120, h: 40 };
  const usual = placeNote(500, 300, size, { stage });
  assert.deepEqual([usual.side, usual.x, usual.y, usual.hits], ['tr', 500, 300 - 7 - 40, 0]);
  const blocked = placeNote(500, 300, size, { stage, others: [{ x: 480, y: 240, w: 200, h: 60 }] });
  assert.equal(blocked.hits, 0); assert.notEqual(blocked.side + blocked.tail, 'tr7');
  assert.ok(!rectsHit({ x: blocked.x, y: blocked.y, w: 120, h: 40 }, { x: 480, y: 240, w: 200, h: 60 }, 5));
  const edge = placeNote(990, 20, size, { stage });
  assert.ok(edge.x + 120 <= 996 && edge.y >= 4, 'inside the stage');
});

test('the mask is the shown cells as one rect per run, so it is a vector image with nothing to decode', () => {
  const grid = Uint8Array.from([0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1]); // 4 x 3: hidden cells are 1
  const d = shownPath(grid, 4, 3);
  assert.equal(d, 'M0 0h1v1h-1zM3 0h1v1h-1zM0 1h4v1h-4zM0 2h1v1h-1zM2 2h1v1h-1z');
  assert.equal(shownPath(new Uint8Array(12).fill(1), 4, 3), '', 'everything hidden shows nothing');
  assert.equal(shownPath(new Uint8Array(12), 4, 3), 'M0 0h4v1h-4zM0 1h4v1h-4zM0 2h4v1h-4z');
});

test('the pane will not stand where the first letters are clipped by an occluder, even by a few percent', () => {
  const hiddenAt = () => x => x < 440; // a wall at the left that no depth gets in front of
  const r = settleSpot({ lines, panel: pane, stage: room, hiddenAt, d: 0.3 });
  assert.equal(r.moved, true); assert.ok(lines[0].x + r.dx >= 440 && r.dy === 0, `moved ${r.dx}, ${r.dy}`); // the first letter is clear of the wall
  assert.ok(r.worst <= 0.02); assert.equal(r.d, 0.3, 'it slides, it does not come forward, because coming forward does not help');
});

test('when the room is a few pixels narrower than the lattice the search tries a finer one, rather than settle for a clipped letter', () => {
  // a wall hides everything left of x 137 and a note stands at x 567: the pane (444 wide, its words 24 px in) fits only with its left edge in 119..131
  const panel = { x: 212, y: 14, w: 444, h: 186 }, lines = [{ x: 236, y: 34, w: 200, h: 24 }, { x: 236, y: 64, w: 300, h: 24 }];
  const note = { x: 567, y: 0, w: 170, h: 60, panelPad: -8 };
  const r = settleSpot({ lines, panel, stage: { w: 1000, h: 214 }, obstacles: [note], hiddenAt: () => x => x < 137, d: 0.5 });
  const left = panel.x + r.dx;
  assert.equal(r.free, true); assert.ok(lines[0].x + r.dx >= 137 && left <= 131, `left edge ${left}`); assert.ok(r.worst <= 0.02); // the first letter is clear of the wall, the box is clear of the note
});
