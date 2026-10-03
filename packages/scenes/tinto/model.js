// Tinto: everyone in the square. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/tinto.js (read
// only; never edited). The plate kept each vignette's line inside its drawing
// function; here the lines, the order, the round, the travellers' paths, the
// pick and the card's place are plain data and pure functions, so they run in
// Node and the renderer and the accessible list read the same words.

import { rng, clamp, lerp } from '../../engine/index.js';

export const W = 1200, H = 800;
export const STILL_TIME = 11.3;
export const SQUARE = { top: 356, bot: 772 };
export const TREE = { x: 430, y: 470 };
/** Figures grow as they come down the square: 1 at its back edge, 1.55 at the front. */
export const depth = y => lerp(1.0, 1.55, clamp((y - SQUARE.top) / (SQUARE.bot - SQUARE.top)));

/**
 * Everyone in the square, far to near (the order they are drawn in and the
 * order of the round). `who` names them for the accessible list; `line` is
 * the caption, word for word as the plate had it. `travels` marks the ones
 * whose place changes with time (their paths are below).
 */
export const VIGNETTES = [
  { id: 'crows', who: 'Two crows on the wire', line: 'Two crows on the wire, keeping an eye on the fish.' },
  { id: 'taverna', who: 'The taverna keeper', line: 'The taverna opens at eleven. It is two minutes to.' },
  { id: 'bakery', who: 'The baker and a small boy', line: 'Fresh poi, still warm, and one already missing.' },
  { id: 'shoppers', who: 'Two neighbours', line: 'Two neighbours haggling over kokum. Both of them are enjoying it.' },
  { id: 'walker', who: 'A woman with an umbrella', line: 'Umbrella up, for the sun this time.', travels: true },
  { id: 'fish', who: 'The fish seller and a cat', line: 'Bangde at forty rupees a plate, and a cat who has been promised the heads.' },
  { id: 'cards', who: 'Two old men under the tree', line: 'A card game that began in 1987 and is still level.' },
  { id: 'tourist', who: 'A tourist with a map', line: 'Looking for the beach. It is behind him.' },
  { id: 'cow', who: 'A cow', line: 'Also waiting for the bus.' },
  { id: 'coconut', who: 'The coconut seller', line: 'Tender coconuts, opened with three strokes and a straw.' },
  { id: 'pilot', who: 'A motorcycle pilot', line: 'A pilot waiting for a fare, reading yesterday’s news.' },
  { id: 'poder', who: 'The poder on his bicycle', line: 'The poder, on his second round. The horn means bread.', travels: true },
  { id: 'dog', who: 'A dog', line: 'The actual owner of the square, asleep exactly where everyone has to walk.' },
  { id: 'cart', who: 'The sugarcane juice man and his customer', line: 'Sugarcane juice with ginger and lime, and a queue of one.' },
  { id: 'kids', who: 'Two children with a ball', line: 'Goa versus the rest of the lane. The score is disputed.', travels: true },
  { id: 'post', who: 'The postman', line: 'The postman, with one letter and all of the village’s news.' },
  { id: 'bus', who: 'The bus conductor', line: 'The bus to Mapusa. It leaves when it is full, and it is never full.' },
];
export const IDS = VIGNETTES.map(v => v.id);
export const byId = Object.fromEntries(VIGNETTES.map(v => [v.id, v]));

/**
 * How each register lives in the square. `pace` scales the square's clock
 * (warm is an easier morning); `boil` is the wobble's re-roll rate; `fps` is
 * how often the people are redrawn (hand-drawn animation, on twos in
 * playful); `round` is the seconds each line stays up when nobody points.
 * quiet is a still with no card unless one is pinned.
 */
export const LOOKS = {
  quiet: { pace: 0, boil: 0, fps: 0, round: 0, cards: false },
  warm: { pace: 0.7, boil: 4, fps: 8, round: 6, cards: true },
  playful: { pace: 1, boil: 6, fps: 12, round: 3.8, cards: true },
};

/** A seed is a different moment of the same morning: seed 1 is the plate's own. */
export const phaseOf = seed => (seed === 1 ? 0 : rng(`tinto:${seed}`)() * 90);

// ── The travellers' paths (the renderer draws them from these) ────────────

/** The poder rides an ellipse round the tree. Returns his wheel base and which way he faces. */
export function poderAt(t) {
  const a = t * 0.22;
  return { x: 470 + Math.cos(a) * 300, y: 610 + Math.sin(a) * 90, a, flip: -Math.sin(a) < 0 };
}
/** The umbrella walker crosses the back of the square, left to right, every 34 s or so. */
export function walkerAt(t) { const u = (t * 0.035) % 1; return { x: lerp(-40, W + 40, u), y: 430 }; }
/** The two children and their ball. */
export function kidsAt(t) {
  const cx = 250, cy = 730;
  return {
    ball: [cx + Math.sin(t * 1.2) * 90, cy - Math.abs(Math.sin(t * 3.4)) * 40],
    k1: [cx - 60 + Math.sin(t * 1.2 - 0.4) * 70, cy],
    k2: [cx + 70 + Math.sin(t * 1.2 + 0.8) * 60, cy + 20],
    ground: cy,
  };
}

// ── Picking a line ─────────────────────────────────────────────────────────

const inside = (x, y, r, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
/** Is a point inside (or within `pad` of) any calm rect? */
export const inCalm = (x, y, calm = [], pad = 40) => calm.some(r => inside(x, y, r, pad));

/**
 * Whose line to show. In order: a pinned `focus`; the nearest person to the
 * pointer within `reach`; a line chosen with Enter (`chosen`); else the slow
 * round, skipping anyone standing under the page's text. Pure.
 * @param {{ time: number, look: object, anchors: Record<string, [number, number]>,
 *   pointer?: { x: number, y: number, inside: boolean } | null, focus?: string | null,
 *   chosen?: string | null, calm?: object[], reach?: number }} o
 */
export function pickLine({ time, look, anchors, pointer = null, focus = null, chosen = null, calm = [], reach = 90 }) {
  if (focus && byId[focus]) return focus;
  if (!look.cards) return null;
  if (pointer?.inside) {
    let best = reach, pick = null;
    for (const id of IDS) {
      const a = anchors[id];
      if (!a || inCalm(a[0], a[1], calm, 0)) continue;
      const d = Math.hypot(a[0] - pointer.x, a[1] - pointer.y);
      if (d < best) { best = d; pick = id; }
    }
    if (pick) return pick;
  }
  if (chosen && byId[chosen]) return chosen;
  const n = IDS.length, start = Math.floor(time / look.round);
  for (let k = 0; k < n; k++) {
    const id = IDS[(((start + k) % n) + n) % n], a = anchors[id];
    if (!a || !inCalm(a[0], a[1], calm, 0)) return id;
  }
  return null;
}

/** The next person after `id` in the round (Enter in playful). */
export const nextId = id => IDS[(IDS.indexOf(id) + 1) % IDS.length];

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Where the caption card goes: up and to the right of the person by default,
 * as the plate had it, flipped at the edges, and moved to whichever side keeps
 * it off the page's text. Pure: box in, box out.
 */
export function placeCard(anchor, w, h, calm = []) {
  const [ax, ay] = anchor, gap = 40;
  const tries = [
    [ax + gap, ay - h - gap], [ax - w - gap, ay - h - gap],
    [ax + gap, ay + gap], [ax - w - gap, ay + gap],
  ];
  const fit = ([x, y]) => ({ x: clamp(x, 12, W - w - 12), y: clamp(y, 12, H - h - 12), w, h });
  // the plate's own rule first: flip left at the right edge, drop below at the top
  const plate = [ax + gap + w > W - 12 ? ax - w - gap : ax + gap, ay - h - gap < 12 ? ay + gap : ay - h - gap];
  for (const p of [plate, ...tries]) {
    const box = fit(p);
    if (!calm.some(r => overlaps(box, r))) return box;
  }
  return fit(plate);
}

// ── Words in the world (words="world"; docs/requests/2026-09-28-words-in-the-world.md) ──

/** The shops in reading order: one piece of information on a plaque under each sign (`at` its top centre, `room` its widest), a detail on press. Placeholder copy. */
export const SHOPS = [
  { id: 'mercado', sign: 'Mercado', info: 'Open 7 to 1', at: [200, 229], room: 190,
    detail: 'Fish before nine, vegetables all morning, and kokum and cashews in season. Closed on Sundays.' },
  { id: 'padaria', sign: 'Padaria', info: 'Poi at 6 and 4', at: [750, 268], room: 168,
    detail: 'Two bakes a day: poi and pão at six in the morning, and again at four for tea.' },
  { id: 'taverna', sign: 'Taverna', info: 'Opens at 11', at: [1030, 276], room: 200,
    detail: 'Cashew feni, cold beer and fish curry rice, from eleven until late. The clock says two minutes to.' },
];

/** The arched chalkboard outside the Taverna, where the cow stands in the plate; she waits by the bus instead. */
export const BOARD = { x: 930, y: 368, w: 262, h: 168, rise: 36, frame: 9, pad: 11, feet: 552 };
export const COW_WORLD = [928, 590];
/** The tallest a plaque may hang under its sign: taller, and it covers the door. */
export const PLAQUE_H = 36;

/** The slate inside the frame, as the tier's arch(x, y, w, h, rise, pad). */
export function slateOf(b = BOARD) {
  return { x: b.x + b.frame, y: b.y + b.frame, w: b.w - 2 * b.frame, h: b.h - 2 * b.frame, rise: b.rise - b.frame * 0.6, pad: b.pad };
}

/** The smallest sizes a drawn surface may use (CSS px, from the root font size, so 200% text doubles them); `target` is WCAG 2.2's 24 px. */
export const minSizes = (rootPx = 16) => ({ body: 0.875 * rootPx, heading: 1.25 * rootPx, label: 0.75 * rootPx, target: 24 });

/** The board's body sizes to try (CSS px, largest first): from the drawing's own (21 units) down to the minimum; empty if none is legible. */
export function boardSizes(scale, rootPx = 16) {
  const min = minSizes(rootPx), out = [];
  for (let s = Math.min(21 * scale, 26); s >= min.body - 1e-9; s -= 0.5) if (s * 1.45 >= min.heading - 1e-9) out.push(+s.toFixed(2));
  return out;
}

/** words="world" puts the words on the surfaces in warm and playful; quiet stays flat. */
export const inWorld = (register, words) => words === 'world' && register !== 'quiet';

/**
 * The per-frame description. Time is the square's own clock (scaled by the
 * register's pace, offset by the seed); `tick` changes only when the people
 * should be redrawn, so a renderer can skip every frame in between.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  // pace bends the clock around the still, so every register's still is the plate's own moment
  const t = STILL_TIME + (time - STILL_TIME) * (look.pace || 1) + phaseOf(seed);
  const boil = look.boil ? Math.floor(t * look.boil) : 0;
  const tick = look.fps ? Math.floor(time * look.fps) : 0;
  const focus = params.focus && byId[params.focus] ? params.focus : null;
  const words = params.words === 'world' ? 'world' : 'panel';
  return { seed, time, t, register, look, boil, tick, focus, lines: params.lines !== false, words };
}
