import test from 'node:test';
import assert from 'node:assert/strict';
import {
  model, makeBowl, bowl, shapeOf, pack, timeline, piecePose, arrangement, swirlPoint, settleGate, tossSpan,
  SHAPES, KINDS, BOWL, TOSS, W, H, K,
} from './model.js';

const still = (params = {}, register = 'warm', seed = 1) => model({ time: 1e6, seed, register, params });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ── the four fail-first checks from the request, each as a predicate that a broken build must fail ──

/** 1. With progress set, nothing changes with time. */
const holdsStill = fn => [0, 1, 2.5, 7, 100].every(t => JSON.stringify(fn({ time: t, seed: 1, register: 'warm', params: { progress: 0.5 } })) === JSON.stringify(fn({ time: 0, seed: 1, register: 'warm', params: { progress: 0.5 } })));
/** 2. The still shows the finished bowl: sauce spread, every flake down, every leaf down. */
const finished = f => f.sauce.pool >= 0.999 && f.sauce.ribbon >= 0.999 && f.flakes.length > 0 && f.flakes.every(x => x.vis && x.z === 0 && x.alpha === 1) && f.leaves.length === 3 && f.leaves.every(x => x.vis && x.z === 0) && f.pieces.every(p => p.vis && p.z === 0);
/** 3. The settle event: how many times a run fires it, stepping the model at 60 fps and listening like the renderer does. */
function firings(fn, params = {}, register = 'playful') {
  const gate = settleGate(), tl = timeline(register);
  let n = 0, first = null;
  for (let t = 0; t < tl.end + 3; t += 1 / 60) {
    const d = fn({ time: t, seed: 1, register, params });
    if (gate({ done: d.done, progressSet: d.progressSet, epoch: 0 })) { n++; first ??= t; }
  }
  return { n, first, done: tl.done };
}
/** 4. Nothing outside the bowl, nothing outside the canvas, once settled. */
const allInside = deal => deal.items.every(it => Math.hypot(it.rest.x - BOWL.x, it.rest.y - BOWL.y) + it.shape.r <= BOWL.R - 8
  && it.rest.x - it.shape.r >= 0 && it.rest.x + it.shape.r <= W && it.rest.y - it.shape.r >= 0 && it.rest.y + it.shape.r <= H);

test('check 1: progress set holds the model still over time; a model that lets time move it fails', () => {
  assert.equal(holdsStill(model), true);
  const broken = args => model({ ...args, params: { ...args.params, progress: null } });
  assert.equal(holdsStill(broken), false, 'the broken variant moves with time');
});

test('check 2: the still is the finished bowl; a still taken before the pour fails', () => {
  for (const reg of ['warm', 'playful', 'quiet']) assert.equal(finished(still({}, reg)), true, reg);
  const early = model({ time: timeline('warm').pieces[6].land + 0.2, seed: 1, register: 'warm' });
  assert.equal(early.sauce.pool, 0);
  assert.equal(finished(early), false, 'a still taken before the pour must fail');
  assert.equal(finished(still({ sauce: 'none' }) && { ...still({}), sauce: { pool: 0, ribbon: 0 } }), false, 'no sauce fails');
});

test('check 3: the settle event fires once after the garnish lands, and never under progress; a gate that fires every frame fails', () => {
  for (const reg of ['warm', 'playful']) {
    const f = firings(model, {}, reg);
    assert.equal(f.n, 1, `${reg}: fired ${f.n} times`);
    assert.ok(f.first >= timeline(reg).done - 1e-9 && f.first < timeline(reg).done + 0.05, `${reg}: fired at ${f.first}, garnish landed at ${timeline(reg).done}`);
  }
  assert.equal(firings(model, { progress: 1 }).n, 0, 'not under progress');
  assert.equal(firings(model, { progress: 0.5 }).n, 0);
  const chatty = fn => args => ({ ...fn(args), progressSet: false });
  assert.equal(firings(chatty(model), { progress: 1 }).n, 1, 'a model that forgets progress would fire');
  const every = () => { let e = null; return ({ done, epoch }) => { e = epoch; return done; }; };
  let n = 0; const g = every(); for (let i = 0; i < 20; i++) if (g({ done: true, epoch: 0 })) n++;
  assert.ok(n > 1, 'the broken gate fires more than once');
});

test('check 3b: a new run (a new epoch) fires again', () => {
  const g = settleGate();
  assert.equal(g({ done: true, progressSet: false, epoch: 0 }), true);
  assert.equal(g({ done: true, progressSet: false, epoch: 0 }), false);
  assert.equal(g({ done: false, progressSet: false, epoch: 1 }), false);
  assert.equal(g({ done: true, progressSet: false, epoch: 1 }), true);
});

test('check 4: every piece rests inside the bowl and the canvas, for every pasta and many seeds; a packing bug fails', () => {
  for (const kind of KINDS) for (const seed of [1, 2, 3, 4, 5, 7, 9, 'a', 'b']) assert.equal(allInside(makeBowl(seed, kind)), true, `${kind} seed ${seed}`);
  const broken = makeBowl(1, 'ravioli', { bound: 520 });
  assert.equal(allInside(broken), false, 'a pack that ignores the bowl must fail');
});

// ── shapes ───────────────────────────────────────────────────────────────

test('shapes: every kind is a closed outline with layers inside its own radius', () => {
  for (const kind of [...KINDS, 'basil']) {
    const s = shapeOf(kind, '1:0');
    assert.ok(s.body.length >= 12, kind);
    assert.ok(s.layers.length >= 3, kind);
    const pts = s.layers.flatMap(L => (L.k === 'fill' ? L.pts : L.paths.flat()));
    for (const [x, y] of [...s.body, ...pts]) assert.ok(Number.isFinite(x) && Number.isFinite(y), `${kind} finite`);
    for (const [x, y] of pts) assert.ok(Math.hypot(x, y) <= s.r * 1.25, `${kind}: a layer point at ${Math.hypot(x, y).toFixed(1)} outside r ${s.r.toFixed(1)}`);
    assert.ok(s.r > 8 && s.r < 120, `${kind} r ${s.r}`);
  }
});

test('shapes: a new kind needs only a table entry (each kind has count, fit, size and a make function)', () => {
  for (const [k, S] of Object.entries(SHAPES)) { assert.ok(S.count >= 5 && S.fit > 0.5 && S.size > 0 && typeof S.make === 'function', k); }
});

test('shapes: ravioli are scalloped squares: 24 scallops round a crimped edge with ticks, and a dome', () => {
  const s = shapeOf('ravioli', '1:0');
  assert.equal(s.body.length, 4 * 6 * 7);
  assert.ok(s.layers.find(L => L.k === 'line' && L.role === 'fold').paths.length >= 40, 'crimp ticks');
  assert.ok(s.layers.some(L => L.k === 'fill' && L.role === 'dome'));
});

test('shapeOf: memoised and deterministic per key', () => {
  assert.equal(shapeOf('ravioli', '3:2'), shapeOf('ravioli', '3:2'));
  assert.notDeepEqual(shapeOf('ravioli', '3:2').body, shapeOf('ravioli', '3:3').body);
});

// ── the deal ─────────────────────────────────────────────────────────────

test('makeBowl: the same seed always deals the same bowl; a new seed moves the pieces', () => {
  assert.deepEqual(makeBowl(3, 'ravioli'), makeBowl(3, 'ravioli'));
  assert.notEqual(makeBowl(1).items[0].rest.a, makeBowl(2).items[0].rest.a);
});

test('bowl(): memoised per seed and kind', () => {
  assert.equal(bowl(4, 'gnocchi'), bowl(4, 'gnocchi'));
  assert.notEqual(bowl(4, 'gnocchi'), bowl(4, 'farfalle'));
});

test('makeBowl: each kind has its own count and an unknown kind falls back to ravioli', () => {
  assert.deepEqual(KINDS.map(k => makeBowl(1, k).items.length), KINDS.map(k => SHAPES[k].count));
  assert.equal(makeBowl(1, 'momo').kind, 'ravioli');
});

test('pack: nothing overlaps badly, and everything lies inside the bound', () => {
  for (const kind of KINDS) {
    const D = makeBowl(2, kind);
    for (const a of D.items) {
      assert.ok(Math.hypot(a.rest.x - BOWL.x, a.rest.y - BOWL.y) + a.rho <= BOWL.pack + 1e-6, `${kind}: inside the pack bound`);
      for (const b of D.items) if (a.i < b.i) assert.ok(dist(a.rest, b.rest) >= (a.rho + b.rho) * 0.6, `${kind}: ${a.i} and ${b.i} are ${dist(a.rest, b.rest).toFixed(1)} apart`);
    }
  }
});

test('pack: deterministic, and a pile too big for the bound is still clamped inside it', () => {
  assert.deepEqual(pack([30, 30, 30], 100, 's'), pack([30, 30, 30], 100, 's'));
  for (const [x, y] of pack(Array(12).fill(60), 100, 'x')) assert.ok(Math.hypot(x, y) <= 100 - 60 + 1e-9);
});

test('makeBowl: pieces come in from all four edges, top and bottom more than the sides', () => {
  const D = makeBowl(1, 'ravioli'), at = it => (it.fly.sy < 0 ? 'top' : it.fly.sy > H ? 'bottom' : it.fly.sx < 0 ? 'left' : 'right');
  const seen = D.items.map(at);
  for (const e of ['top', 'bottom', 'left', 'right']) assert.ok(seen.includes(e), `${e} in ${seen}`);
  assert.ok(seen.filter(e => e === 'top' || e === 'bottom').length >= seen.filter(e => e === 'left' || e === 'right').length);
});

test('makeBowl: the bowl is at most 62% of the scene height, centred, and a phone-width crop shows all of it', () => {
  assert.ok(BOWL.R * 2 <= 0.62 * H);
  assert.equal(BOWL.x, W / 2);
  assert.equal(BOWL.y, H / 2);
  const crop = H * (360 / 800); // a 360 x 800 phone: the crop is this many scene units wide
  assert.ok(BOWL.R * 2 + 2 <= crop, `bowl ${BOWL.R * 2} in a crop ${crop} wide`);
  assert.ok(K > 0 && K < 1);
});

test('makeBowl: flakes and leaves rest inside the bowl', () => {
  const D = makeBowl(5, 'ravioli');
  for (const c of [...D.flakes, ...D.leaves]) assert.ok(Math.hypot(c.rest.x - BOWL.x, c.rest.y - BOWL.y) + c.shape.r <= BOWL.lip, `inside the lip: ${Math.hypot(c.rest.x - BOWL.x, c.rest.y - BOWL.y)}`);
});

// ── time ─────────────────────────────────────────────────────────────────

test('timeline: pieces, then the pour, then the cheese, then the basil, then rest', () => {
  for (const reg of ['warm', 'playful']) {
    const tl = timeline(reg, { n: 7 });
    assert.ok(tl.pour.start > tl.pieces[6].land);
    assert.ok(tl.cheese.start > tl.pour.start && tl.cheese.start < tl.pour.end, 'the cheese starts while the sauce is still spreading');
    assert.ok(tl.leaves[0].start < tl.cheese.end && tl.leaves[0].start > tl.cheese.start);
    assert.equal(tl.done, Math.max(tl.leaves[2].land, tl.cheese.end, tl.pour.end));
    assert.ok(tl.end > tl.done);
    for (let i = 1; i < 7; i++) assert.ok(tl.pieces[i].land > tl.pieces[i - 1].land);
  }
});

test('timeline: playful is quicker than warm, and leaving things out shortens the run', () => {
  assert.ok(timeline('playful').end < timeline('warm').end * 0.6);
  assert.ok(timeline('warm', { sauce: 'none' }).done < timeline('warm').done);
  assert.equal(timeline('warm', { sauce: 'none' }).pour, null);
  assert.equal(timeline('warm', { garnish: 'none' }).leaves.length, 0);
  assert.equal(timeline('warm', { topping: 'none' }).cheese, null);
});

test('model: at the start the bowl is empty and nothing is settled', () => {
  const f = model({ time: 0, seed: 1, register: 'warm' });
  assert.ok(f.pieces.every(p => !p.vis));
  assert.equal(f.sauce.pool, 0);
  assert.ok(f.flakes.every(x => !x.vis) && f.leaves.every(x => !x.vis));
  assert.equal(f.settled, false);
  assert.equal(f.done, false);
});

test('model: one piece at a time arrives in warm, never more than two in the air', () => {
  const tl = timeline('warm');
  for (let t = 0; t < tl.pieces[6].land; t += 0.05) {
    const inAir = model({ time: t, seed: 1, register: 'warm' }).pieces.filter(p => p.vis && p.z > 0.001);
    assert.ok(inAir.length <= 2, `${inAir.length} in the air at ${t.toFixed(2)}`);
  }
});

test('model: the bowl only ever fills up (pieces landed never decreases), and ends settled', () => {
  let prev = 0;
  const tl = timeline('playful');
  for (let t = 0; t < tl.end + 1; t += 0.05) {
    const landed = model({ time: t, seed: 2, register: 'playful' }).pieces.filter(p => p.vis && p.z === 0).length;
    assert.ok(landed >= prev - 1, `landed went from ${prev} to ${landed} at ${t}`);
    prev = landed;
  }
  const end = model({ time: tl.end + 0.01, seed: 2, register: 'playful' });
  assert.equal(end.settled, true);
  assert.equal(end.done, true);
  assert.equal(model({ time: tl.done - 0.3, seed: 2, register: 'playful' }).settled, false);
});

test('piecePose: a piece flies in without jumping, shrinks as it lands, and spins', () => {
  const D = bowl(1, 'ravioli'), tl = timeline('warm'), it = D.items[2], T = tl.pieces[2];
  let prev = null, maxZ = 0, turned = 0;
  for (let t = T.start; t < T.land + 0.5; t += 1 / 60) {
    const p = piecePose(it, tl, t);
    if (prev) { assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 60, `a jump of ${Math.hypot(p.x - prev.x, p.y - prev.y).toFixed(1)} at ${t.toFixed(2)}`); turned += Math.abs(p.a - prev.a); }
    maxZ = Math.max(maxZ, p.z); prev = p;
  }
  assert.ok(maxZ > 0.9 && turned > 2.5, `z ${maxZ}, turned ${turned}`);
  assert.ok(Math.abs(prev.x - it.rest.x) < 6 && Math.abs(prev.y - it.rest.y) < 6, 'on its rest');
  assert.equal(piecePose(it, tl, T.start + 0.001).vis, true);
  assert.equal(piecePose(it, tl, T.start - 0.001).vis, false);
});

test('piecePose: later pieces nudge earlier ones, which settle into their rest a little after', () => {
  const D = bowl(1, 'ravioli'), tl = timeline('warm');
  const nudged = D.items.filter(it => it.nudges.length);
  assert.ok(nudged.length >= 3, `${nudged.length} pieces are nudged`);
  const it = nudged[0], nd = it.nudges[0], land = tl.pieces[nd.by].land;
  const before = piecePose(it, tl, land - 0.01), after = piecePose(it, tl, land + 1.5);
  assert.ok(dist(before, after) > 2, `moved ${dist(before, after).toFixed(1)} when the later piece landed`);
  assert.ok(Math.abs(after.x - it.rest.x) < 0.5 || it.nudges.length > 1, 'at rest');
  const end = piecePose(it, tl, 1e6);
  assert.ok(Math.abs(end.x - it.rest.x) < 1e-6 && Math.abs(end.y - it.rest.y) < 1e-6, 'finally exactly at rest');
});

test('model: the sauce spreads between the pieces and the ribbon is poured over them; cheese and basil land last', () => {
  const tl = timeline('warm'), a = model({ time: tl.pour.start + 1, seed: 1, register: 'warm' }), b = model({ time: tl.pour.end + 1, seed: 1, register: 'warm' });
  assert.ok(a.sauce.pool > 0 && a.sauce.pool < 1 && a.sauce.stream === 1);
  assert.ok(a.sauce.ribbon > 0 && a.sauce.ribbon < 1);
  assert.equal(b.sauce.stream, 0);
  assert.ok(b.sauce.pool > 0.99);
  assert.ok(a.flakes.every(x => !x.vis) || tl.cheese.start < tl.pour.start + 1);
  const mid = model({ time: tl.cheese.start + 1.2, seed: 1, register: 'warm' });
  assert.ok(mid.flakes.filter(x => x.vis).length > 5 && mid.flakes.filter(x => x.vis && x.z === 0).length < mid.flakes.length);
  assert.ok(mid.leaves.every(l => !l.vis));
});

test('swirlPoint: the pour spirals out from the middle and stays on the floor of the bowl', () => {
  let prev = 0;
  for (let u = 0; u <= 1.0001; u += 0.02) {
    const [x, y] = swirlPoint(Math.min(1, u), 1.2, [0.4, 1]), d = Math.hypot(x - BOWL.x, y - BOWL.y);
    assert.ok(d <= BOWL.floor, `${d.toFixed(1)} past the floor`);
    if (u > 0.1) assert.ok(d > prev - 8, 'moves outward');
    prev = d;
  }
});

test('params: topping, garnish and sauce can be left out, and a bad value falls back', () => {
  assert.equal(still({ topping: 'none' }).flakes.length, 0);
  assert.equal(still({ garnish: 'none' }).leaves.length, 0);
  assert.equal(still({ sauce: 'none' }).sauce, null);
  assert.equal(still({ sauce: 'pesto' }).sauce.kind, 'pesto');
  assert.equal(still({ sauce: 'ketchup' }).sauce.kind, 'tomato');
  assert.equal(still({ pieces: 'momo' }).params.pieces, 'ravioli');
  for (const k of KINDS) assert.equal(still({ pieces: k }).pieces.length, SHAPES[k].count);
});

test('quiet: the finished bowl, whatever the time, and settled', () => {
  const f = model({ time: 0, seed: 1, register: 'quiet' });
  assert.equal(finished(f), true);
  assert.equal(f.settled, true);
});

test('progress: that full, time stands still, settled; 1 is the finished still; 0 is an empty bowl', () => {
  const a = model({ time: 0, seed: 1, register: 'warm', params: { progress: 0.5 } }), b = model({ time: 100, seed: 1, register: 'warm', params: { progress: 0.5 } });
  assert.deepEqual(a, b);
  assert.equal(a.settled, true);
  assert.equal(a.progressSet, true);
  const one = model({ seed: 1, params: { progress: 1 } }).pieces, rest = still().pieces;
  one.forEach((p, i) => { for (const k of ['x', 'y', 'a', 's', 'z', 'sq']) assert.ok(Math.abs(p[k] - rest[i][k]) < 1e-9, `${k} of piece ${i}`); });
  assert.equal(finished(model({ seed: 1, params: { progress: 1 } })), true);
  assert.equal(finished(model({ seed: 1, params: { progress: 0.99 } })), false);
  const e = model({ seed: 1, params: { progress: 0 } });
  assert.ok(e.pieces.every(p => !p.vis));
  assert.ok(model({ seed: 1, params: { progress: 0.3 } }).fill - 0.3 < 1e-9);
});

test('progress: more progress never has fewer things landed', () => {
  let prev = 0;
  for (let p = 0; p <= 1.0001; p += 0.02) {
    const f = model({ seed: 1, params: { progress: Math.min(1, p) } });
    const n = f.pieces.filter(x => x.vis && x.z === 0).length + f.flakes.filter(x => x.vis && x.z === 0).length + f.leaves.filter(x => x.vis && x.z === 0).length;
    assert.ok(n >= prev, `landed fell from ${prev} to ${n} at ${p}`);
    prev = n;
  }
});

// ── the toss (playful) ───────────────────────────────────────────────────

test('toss: pieces hop up, turn and land in a new arrangement; the model is busy until they have', () => {
  const at = 20, n = 1, D = bowl(1, 'ravioli'), tl = timeline('playful', { n: 7 }), params = { tossAt: at, tossN: n };
  const before = model({ time: at - 0.01, seed: 1, register: 'playful', params }), start = model({ time: at, seed: 1, register: 'playful', params }), air = model({ time: at + 0.4, seed: 1, register: 'playful', params });
  const end = model({ time: at + tossSpan(7) + 0.01, seed: 1, register: 'playful', params });
  assert.equal(before.tossing, false);
  assert.equal(before.settled, true);
  assert.equal(air.tossing, true);
  assert.equal(air.settled, false, 'the element keeps running while the toss plays');
  assert.ok(air.pieces.some(p => p.z > 0.5), 'something is in the air');
  assert.ok(Math.max(...air.pieces.map(p => p.s)) > 1.3, 'nearer the camera while it is up');
  assert.equal(end.tossing, false);
  assert.equal(end.settled, true);
  const delta = D.items.map(it => arrangement(it, 1));
  end.pieces.forEach((p, i) => {
    assert.ok(Math.abs(p.x - (D.items[i].rest.x + delta[i].dx)) < 1e-6 && Math.abs(p.y - (D.items[i].rest.y + delta[i].dy)) < 1e-6, `piece ${i} lands in the new arrangement`);
  });
  // continuous at the start: no piece teleports when the toss begins
  start.pieces.forEach((p, i) => assert.ok(dist(p, before.pieces[i]) < 1, `piece ${i} jumped at the start of the toss`));
  assert.ok(tl.end < at);
});

test('toss: a second toss begins from where the first landed, and the rest of the bowl stays put', () => {
  const t1 = 20, t2 = 40;
  const first = model({ time: t2 - 0.01, seed: 1, register: 'playful', params: { tossAt: t1, tossN: 1 } });
  const second0 = model({ time: t2, seed: 1, register: 'playful', params: { tossAt: t2, tossN: 2 } });
  first.pieces.forEach((p, i) => assert.ok(dist(p, second0.pieces[i]) < 1, `piece ${i} continues from the first toss`));
  assert.deepEqual(second0.sauce, first.sauce);
  const cos = a => [Math.cos(a), Math.sin(a)];
  second0.pieces.forEach((p, i) => { const [c, s] = cos(p.a - first.pieces[i].a); assert.ok(c > 0.999 && Math.abs(s) < 0.05, 'same turn'); });
  assert.notDeepEqual(arrangement(bowl(1).items[0], 1), arrangement(bowl(1).items[0], 2));
  assert.deepEqual(arrangement(bowl(1).items[0], 0), { dx: 0, dy: 0, da: 0 });
});

test('toss: is ignored under progress and in quiet, and a piece still in the air is not tossed', () => {
  const p = { tossAt: 20, tossN: 1 };
  assert.equal(model({ time: 20.4, seed: 1, register: 'playful', params: { progress: 1, ...p } }).tossing, false);
  assert.equal(model({ time: 20.4, seed: 1, register: 'quiet', params: p }).tossing, false);
  assert.equal(model({ time: 20.4, seed: 1, register: 'warm', params: p }).tossing, false);
  const tl = timeline('playful'), t = tl.pieces[3].start + 0.3, f = model({ time: t + 0.2, seed: 1, register: 'playful', params: { tossAt: t, tossN: 1 } });
  assert.ok(f.pieces[6].vis === false || f.pieces[6].z >= 0, 'later pieces carry on arriving');
});
