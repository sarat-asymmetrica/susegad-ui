import test from 'node:test';
import assert from 'node:assert/strict';
import tinto from './index.js';
import {
  model, VIGNETTES, IDS, LOOKS, STILL_TIME, W, H, pickLine, placeCard, nextId, inCalm, poderAt, walkerAt, kidsAt, phaseOf, depth, SQUARE,
  SHOPS, BOARD, COW_WORLD, slateOf, minSizes, boardSizes, inWorld,
} from './model.js';
import { meta } from './meta.js';
import { paramsFromAttributes, defaultParams } from '../../core/define-scene.js';

const P = (o = {}) => ({ ...defaultParams(tinto.params), ...o });
const anchorsAt = () => Object.fromEntries(IDS.map((id, i) => [id, [60 + i * 65, 400 + (i % 3) * 100]]));

test('seventeen people, each with one line, every id unique', () => {
  assert.equal(VIGNETTES.length, 17);
  assert.equal(new Set(IDS).size, 17);
  for (const v of VIGNETTES) {
    assert.ok(v.who && v.line, v.id);
    assert.ok(!v.line.includes('—') && !v.who.includes('—'), `no em dash: ${v.id}`);
  }
});

test('the lines are the plate’s own, word for word', () => {
  // spot-check against pieces/tinto.js in the sketchbook
  const line = id => VIGNETTES.find(v => v.id === id).line;
  assert.equal(line('poder'), 'The poder, on his second round. The horn means bread.');
  assert.equal(line('bus'), 'The bus to Mapusa. It leaves when it is full, and it is never full.');
  assert.equal(line('dog'), 'The actual owner of the square, asleep exactly where everyone has to walk.');
});

test('model: deterministic, and every register’s still is the plate’s own moment', () => {
  for (const register of ['quiet', 'warm', 'playful']) {
    const a = model({ time: STILL_TIME, seed: 1, register, params: P() });
    assert.equal(a.t, STILL_TIME, register);
    assert.deepEqual(a, model({ time: STILL_TIME, seed: 1, register, params: P() }));
  }
});

test('model: warm is an easier morning than playful, and boils slower', () => {
  const w0 = model({ time: 20, register: 'warm', params: P() }), w1 = model({ time: 30, register: 'warm', params: P() });
  const p0 = model({ time: 20, register: 'playful', params: P() }), p1 = model({ time: 30, register: 'playful', params: P() });
  assert.ok(w1.t - w0.t < p1.t - p0.t);
  assert.ok(LOOKS.warm.boil < LOOKS.playful.boil && LOOKS.warm.fps < LOOKS.playful.fps);
  assert.equal(LOOKS.quiet.cards, false);
});

test('model: the redraw tick only changes at the register’s rate (so a renderer can skip frames)', () => {
  const ticks = new Set();
  for (let t = 10; t < 11; t += 1 / 60) ticks.add(model({ time: t, register: 'warm', params: P() }).tick);
  assert.ok(ticks.size <= LOOKS.warm.fps + 1, `${ticks.size} ticks in a second`);
});

test('a seed is a different moment of the same morning; seed 1 is the plate', () => {
  assert.equal(phaseOf(1), 0);
  assert.notEqual(phaseOf(2), phaseOf(3));
  assert.equal(phaseOf('goa'), phaseOf('goa'));
});

test('focus pins a line in every register, quiet included, and ignores unknown ids', () => {
  const anchors = anchorsAt();
  for (const look of Object.values(LOOKS)) {
    assert.equal(pickLine({ time: 99, look, anchors, focus: 'tourist' }), 'tourist');
  }
  assert.equal(pickLine({ time: 0, look: LOOKS.quiet, anchors, focus: null }), null, 'quiet shows no card unless pinned');
  const m = model({ time: 1, params: P({ focus: 'nobody' }) });
  assert.equal(m.focus, null);
  const attrs = paramsFromAttributes(tinto.params, a => ({ focus: 'dog', lines: 'false' })[a] ?? null);
  assert.equal(attrs.focus, 'dog'); assert.equal(attrs.lines, false);
  assert.equal(paramsFromAttributes(tinto.params, a => (a === 'focus' ? 'nobody' : null)).focus, null);
});

test('the pointer picks the nearest person within reach; far away, the round goes on', () => {
  const anchors = anchorsAt();
  const [x, y] = anchors.pilot;
  assert.equal(pickLine({ time: 0, look: LOOKS.playful, anchors, pointer: { x: x + 10, y: y + 5, inside: true } }), 'pilot');
  const round = pickLine({ time: 0, look: LOOKS.playful, anchors, pointer: { x: -500, y: -500, inside: true } });
  assert.equal(round, IDS[0]);
});

test('the round visits everyone in order, one line per round', () => {
  const anchors = anchorsAt(), seen = [];
  for (let k = 0; k < IDS.length; k++) seen.push(pickLine({ time: k * LOOKS.warm.round + 0.1, look: LOOKS.warm, anchors }));
  assert.deepEqual(seen, IDS);
});

test('the round skips anyone standing under the page’s text', () => {
  const anchors = anchorsAt(), [x, y] = anchors[IDS[0]];
  const calm = [{ x: x - 20, y: y - 20, w: 40, h: 40 }];
  assert.equal(pickLine({ time: 0.1, look: LOOKS.warm, anchors, calm }), IDS[1]);
  assert.ok(inCalm(x, y, calm));
  assert.ok(!inCalm(x + 200, y, calm));
});

test('Enter goes to the next person, wrapping at the end', () => {
  assert.equal(nextId(IDS[0]), IDS[1]);
  assert.equal(nextId(IDS[IDS.length - 1]), IDS[0]);
});

test('the card stays inside the square and off the page’s text', () => {
  const w = 280, h = 66;
  for (const anchor of [[20, 20], [1180, 30], [600, 780], [1190, 790]]) {
    const box = placeCard(anchor, w, h);
    assert.ok(box.x >= 12 && box.y >= 12 && box.x + w <= W - 12 && box.y + h <= H - 12, JSON.stringify(box));
  }
  const anchor = [600, 400], calm = [{ x: 640, y: 250, w: 400, h: 150 }];
  const box = placeCard(anchor, w, h, calm);
  const hit = box.x < 1040 && box.x + w > 640 && box.y < 400 && box.y + h > 250;
  assert.ok(!hit, `card clear of the text: ${JSON.stringify(box)}`);
});

test('the travellers move and stay in the square', () => {
  const a = poderAt(0), b = poderAt(5);
  assert.notDeepEqual([a.x, a.y], [b.x, b.y]);
  for (let t = 0; t < 120; t += 1.7) {
    const p = poderAt(t), w = walkerAt(t), k = kidsAt(t);
    assert.ok(p.y > SQUARE.top && p.y < H, `poder ${p.y}`);
    assert.ok(w.x >= -40 && w.x <= W + 40);
    assert.ok(k.ball[1] <= k.ground);
  }
  assert.ok(depth(SQUARE.bot) > depth(SQUARE.top));
});

test('words: the param defaults to the panel, and world is carried through the model', () => {
  assert.equal(model({ params: P() }).words, 'panel');
  assert.equal(model({ params: P(paramsFromAttributes(tinto.params, n => (n === 'words' ? 'world' : null))) }).words, 'world');
  assert.equal(model({ params: P({ words: 'elsewhere' }) }).words, 'panel');
  assert.equal(inWorld('warm', 'world'), true);
  assert.equal(inWorld('playful', 'world'), true);
  assert.equal(inWorld('quiet', 'world'), false, 'quiet keeps the words flat');
  assert.equal(inWorld('warm', 'panel'), false);
});

test('words: the legible minimums follow the root font size, and a small drawing offers no board sizes', () => {
  assert.deepEqual(minSizes(16), { body: 14, heading: 20, label: 12, target: 24 });
  assert.equal(minSizes(32).body, 28, 'text at 200% doubles the minimum');
  const desk = boardSizes(1240 / W), phone = boardSizes(358 / W), zoom = boardSizes(1240 / W, 32);
  assert.ok(desk.length > 5 && desk[0] > desk.at(-1) && desk.at(-1) >= 14, `desk ${desk}`);
  assert.deepEqual(phone, [], 'on a phone the board is too small to read');
  assert.deepEqual(zoom, [], 'with text at 200% the board is too small to read');
  for (const s of desk) assert.ok(s * 1.45 >= 20, 'the heading is never under 1.25rem');
});

test('words: the board makes its own break (the cow steps aside), and the plaques hang under their signs', () => {
  const s = slateOf();
  assert.ok(s.x > BOARD.x && s.x + s.w < BOARD.x + BOARD.w && s.y + s.h < BOARD.y + BOARD.h, 'the slate is inside the frame');
  const [cx, cy] = COW_WORLD;
  const cow = { x: cx - 56, y: cy - 36, w: 100, h: 42 }; // her body, head and horns
  const board = { x: BOARD.x, y: BOARD.y, w: BOARD.w, h: BOARD.feet - BOARD.y };
  assert.ok(!(cow.x < board.x + board.w && cow.x + cow.w > board.x && cow.y < board.y + board.h && cow.y + cow.h > board.y), 'the cow is clear of the board');
  assert.ok(BOARD.x + BOARD.w <= W && BOARD.feet < 570, 'the board stands inside the picture and behind the bus');
  assert.deepEqual(SHOPS.map(s => s.sign), ['Mercado', 'Padaria', 'Taverna'], 'reading order: left to right');
  for (const shop of SHOPS) {
    assert.ok(shop.at[1] > 200 && shop.at[1] + 36 < SQUARE.top, `${shop.id} hangs on its building`);
    assert.ok(shop.info.length <= 16 && shop.detail.length > shop.info.length);
    assert.ok(!shop.detail.includes('—') && !shop.info.includes('—'));
  }
});

test('meta: the after line names only Mario Miranda, and the copy has no em dash', () => {
  assert.equal(meta.after.who, 'Mario Miranda');
  for (const k of ['took', 'left']) assert.ok(meta.after[k].length > 10);
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});
