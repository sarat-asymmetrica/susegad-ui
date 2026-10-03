// Mosaico: an ant on the balcão floor. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/mosaico.js (read
// only; never edited). layFloor, exitOf, turnQuarter, walk and antPlace are
// the plate's own Truchet floor and ant, unchanged in what they do. What the
// port adds: the whole floor is a pure function of (seed, register, time,
// turns asked for, tiles under the page's words). It advances in fixed 1/60 s
// steps from zero, memoised, so a playing scene only pays for new steps. The
// tiles that turn by themselves, and when, come from the seed; the ones a
// hand turns are a timestamped list fed in as their moment comes. Same seed
// and the same inputs, the same floor and the same ant.

import { rng, N, TAU } from '../../engine/index.js';

export const W = 1200, H = 840, T = 120, COLS = 10, ROWS = 7;
export const STEP_DT = 1 / 60;

/** Edges: 0 N, 1 E, 2 S, 3 W. Orientation 0: bands join N–W and S–E; orientation 1 (a quarter turn): N–E and S–W. */
export const exitOf = (o, e) => (o === 0 ? [3, 2, 1, 0] : [1, 0, 3, 2])[e];
export const STEP = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const MID = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];

/** The floor as the seed lays it: every tile's turn (0 to 3) and its wear. */
export function layFloor(seed) {
  const r = rng(`mosaico:${seed}`);
  const tiles = [];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) tiles.push({ i, j, k: r.int(0, 3), wear: r(), id: `${seed}:${i}:${j}` });
  return { tiles, at: (i, j) => (i >= 0 && j >= 0 && i < COLS && j < ROWS ? tiles[j * COLS + i] : null) };
}

/** The ant: which tile, which edge it came in by, how far along the band (0..1). */
export function makeAnt(seed) {
  const r = rng(`ant:${seed}`);
  return { i: r.int(2, COLS - 3), j: r.int(2, ROWS - 3), e: r.int(0, 3), u: r.range(0.1, 0.6), rest: 0 };
}

/** A tile turned n quarters clockwise: its bands (and an ant on them) turn too. */
export function turnQuarter(tile, ant, n = 1) {
  tile.k = (tile.k + n) % 4;
  if (ant && ant.i === tile.i && ant.j === tile.j) ant.e = (ant.e + n) % 4;
}

/**
 * Walk the ant ds along the band. `blocked(i, j)` answers 'wait' (hold at the
 * edge: that tile is moving), 'wall' (turn round: the page's words sit there)
 * or false.
 */
export function walk(floor, ant, ds, blocked = () => false) {
  const len = (Math.PI / 2) * (T / 2);
  ant.u += ds / len;
  while (ant.u >= 1) {
    const t = floor.at(ant.i, ant.j), x = exitOf(t.k & 1, ant.e);
    const ni = ant.i + STEP[x][0], nj = ant.j + STEP[x][1];
    const b = floor.at(ni, nj) ? blocked(ni, nj) : 'wall';
    if (b === 'wall') { ant.e = x; ant.u -= 1; continue; } // the skirting board, or words: turn round
    if (b === 'wait') { ant.u = 1; return; }
    ant.i = ni; ant.j = nj; ant.e = (x + 2) % 4; ant.u -= 1;
  }
}

/** Where the ant is in floor units, and which way it faces. */
export function antPlace(floor, ant) {
  const t = floor.at(ant.i, ant.j), x = exitOf(t.k & 1, ant.e);
  const a = MID[ant.e], b = MID[x];
  // the band's centre is the corner both midpoints are half a tile from
  const c = [a[0] === 0.5 ? b[0] : a[0], a[1] === 0.5 ? b[1] : a[1]];
  const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]), a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
  let d = a1 - a0; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
  const ang = a0 + d * ant.u;
  const x0 = ant.i * T, y0 = ant.j * T;
  return [x0 + (c[0] + Math.cos(ang) * 0.5) * T, y0 + (c[1] + Math.sin(ang) * 0.5) * T, ang + Math.sign(d) * Math.PI / 2];
}

// ── Time: laying, turning, walking ─────────────────────────────────────────

/** The laying order: a diagonal sweep from the top left. */
export const ORDER = layFloor(1).tiles.map(t => [t.i, t.j]).sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
const RANK = new Map(ORDER.map(([i, j], n) => [j * COLS + i, n]));
/** When a tile is set down while the floor is laid, and how long its drop takes. */
export const layTime = (i, j) => 0.2 + RANK.get(j * COLS + i) * 0.025;
export const DROP = 0.45;
export const LAY_END = layTime(...ORDER.at(-1)) + DROP;
/** The finished still: the floor laid, the ant resting where the seed put it, nothing turning. */
export const STILL_TIME = LAY_END + 0.5;
export const turnDuration = n => 0.75 + 0.25 * n;

/**
 * How each register lives on the floor. quiet is the laid floor with the ant
 * at rest; warm lets a tile turn now and then and the ant walk; playful turns
 * them more often, and answers the hand.
 */
export const LOOKS = {
  quiet: { walk: false, gap: null, touch: false },
  warm: { walk: true, gap: [3.6, 7.7], touch: false },
  playful: { walk: true, gap: [2.6, 5.5], touch: true },
};

/** A fresh floor at time zero. */
export function createFloor(seed, register = 'warm') {
  const look = LOOKS[register] || LOOKS.warm;
  return {
    seed, look, t: 0, n: 0, floor: layFloor(seed), ant: makeAnt(seed), turns: [], queue: [], used: 0,
    r: rng(`mosaico:turns:${seed}`), nextTurn: LAY_END + 2, walking: false,
  };
}

const tileKey = (i, j) => j * COLS + i;

/**
 * Turns asked for by a hand (playful). Each is { t, i, j, n, delay? }: at
 * scene time t (+ delay), turn the tile at (i, j) by n quarters. `click`
 * makes the plate's ripple: the tiles within 1.6 of the point turn by one to
 * three quarters, each a little later the further it is.
 */
export function rippleTurns(seed, t, x, y, k = 0) {
  const ci = x / T - 0.5, cj = y / T - 0.5, out = [];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const d = Math.hypot(i - ci, j - cj);
    if (d <= 1.6) out.push({ t, i, j, n: 1 + Math.floor(rng(`relay:${seed}:${i}:${j}:${k}`)() * 3), delay: d * 0.09 });
  }
  return out;
}

/** Advance a floor to time `to` in fixed steps. `inputs` are hand turns; `calm` is a Set of tile keys under the page's words. */
export function advance(s, to, inputs = [], calm = new Set()) {
  const moving = (i, j) => s.turns.some(tr => tr.i === i && tr.j === j);
  const start = (i, j, n, t0) => {
    const tile = s.floor.at(i, j);
    if (!tile || calm.has(tileKey(i, j)) || moving(i, j) || t0 < LAY_END) return false;
    turnQuarter(tile, s.ant, n);
    s.turns.push({ i, j, n, t0, dur: turnDuration(n) });
    return true;
  };
  while (s.t + STEP_DT <= to + 1e-9) {
    const t = (s.n + 1) * STEP_DT;
    // hand turns whose moment has come: queue them (with their ripple delay) as they arrive
    while (s.used < inputs.length && inputs[s.used].t <= t + 1e-9) { const q = inputs[s.used++]; s.queue.push({ ...q, at: q.t + (q.delay || 0) }); }
    s.queue = s.queue.filter(q => (q.at <= t ? (start(q.i, q.j, q.n, q.at), false) : true));
    s.turns = s.turns.filter(tr => t - tr.t0 < tr.dur);
    s.walking = false;
    if (s.look.walk && t > LAY_END + 1) {
      const a = s.ant;
      if (a.rest > 0) a.rest -= STEP_DT;
      else {
        const speed = 22 * (0.75 + 0.5 * (0.5 + N(t * 0.7, 3.3, s.seed)));
        // the page's words are a wall to an ant outside them; one that starts under them may walk out
        const inside = calm.has(tileKey(a.i, a.j));
        walk(s.floor, a, speed * STEP_DT, (i, j) => (!inside && calm.has(tileKey(i, j)) ? 'wall' : moving(i, j) ? 'wait' : false));
        s.walking = true;
        if (s.r() < STEP_DT / 9) a.rest = s.r.range(0.6, 1.6);
      }
      // now and then a tile turns; often the one just ahead of the ant, so it has to re-route
      if (s.look.gap && t > s.nextTurn) {
        const here = s.floor.at(a.i, a.j), x = exitOf(here.k & 1, a.e);
        const ahead = s.floor.at(a.i + STEP[x][0], a.j + STEP[x][1]);
        const pick = ahead && s.r() < 0.45 ? ahead : s.r.pick(s.floor.tiles);
        if (pick && !(pick.i === a.i && pick.j === a.j)) start(pick.i, pick.j, 1, t);
        s.nextTurn = t + s.r.range(...s.look.gap);
      }
    }
    s.n++; s.t = t;
  }
  return s;
}

const memo = new Map();
/**
 * The floor at scene time `time`, pure: memoised per seed, register and epoch,
 * stepping on from the last call when time only moves forward and the inputs
 * only grow; otherwise it starts again from zero.
 */
export function floorAt(seed, register, time, inputs = [], calm = new Set(), epoch = 0) {
  const key = `${seed}|${register}|${epoch}`;
  let s = memo.get(key);
  if (!s || time < s.t - 1e-9 || inputs.length < s.used || (s.used < inputs.length && inputs[s.used].t < s.t - STEP_DT)) {
    s = createFloor(seed, register);
    if (memo.size > 6) memo.delete(memo.keys().next().value);
    memo.set(key, s);
  }
  return advance(s, time, inputs, calm);
}

/** The per-frame description; the renderer asks floorAt for the floor itself, with the hand's turns and the calm tiles. */
export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  return { time, seed, register, look: LOOKS[register] || LOOKS.warm };
}
