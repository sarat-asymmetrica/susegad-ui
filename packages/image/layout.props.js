// The checks that hold layout.core.js to what it is for, written as plain functions of a module so the same list can
// run on the real file (layout.test.js) and on deliberately broken copies of it (mutants.test.js). A check that cannot
// fail is not a check (kernel A10): every planted fault must make at least one of these throw. Tests only; it does
// not ship.

import assert from 'node:assert/strict';
import { createLayout } from '../type/layout.core.js';
import { createFakeOracle } from '../type/oracle.fake.js';

const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (r, a, b) => a + r() * (b - a);
const near = (got, want, why, eps = 1e-6) => assert.ok(Math.abs(got - want) <= eps, `${why}: got ${got}, want ${want}`);
const at = (r, want, why) => { for (const k of Object.keys(want)) near(r[k], want[k], `${why}.${k}`); };

const layout = createLayout(createFakeOracle());

/** [name, (mod) => void]: each throws an AssertionError when the module is wrong. */
export const CHECKS = [
  // ── fitRect: exact cases ────────────────────────────────────────────────
  ['fitRect contain: the whole picture, as large as fits, centred', ({ fitRect }) => {
    at(fitRect({ w: 200, h: 100 }, { x: 10, y: 20, w: 100, h: 100 }, 'contain'), { x: 10, y: 45, w: 100, h: 50, scale: 0.5 }, 'wide in square');
    at(fitRect({ w: 100, h: 200 }, { x: 0, y: 0, w: 100, h: 100 }, 'contain'), { x: 25, y: 0, w: 50, h: 100, scale: 0.5 }, 'tall in square');
    at(fitRect({ w: 50, h: 50 }, { x: 0, y: 0, w: 100, h: 200 }, 'contain'), { x: 0, y: 50, w: 100, h: 100, scale: 2 }, 'small, scaled up');
  }],
  ['fitRect contain: align places the slack (object-position)', ({ fitRect }) => {
    const box = { x: 0, y: 0, w: 100, h: 100 }, pic = { w: 200, h: 100 };
    at(fitRect(pic, box, 'contain', { align: { x: 0, y: 0 } }), { x: 0, y: 0 }, 'top left');
    at(fitRect(pic, box, 'contain', { align: { x: 1, y: 1 } }), { x: 0, y: 50 }, 'bottom right');
    at(fitRect(pic, box, 'contain', { align: { x: 0.25, y: 0.5 } }), { y: 25 }, 'quarter');
  }],
  ['fitRect cover: as small as fills the box, cropped, with the crop in picture pixels', ({ fitRect }) => {
    const r = fitRect({ w: 200, h: 100 }, { x: 5, y: 5, w: 100, h: 100 }, 'cover');
    at(r, { x: -45, y: 5, w: 200, h: 100, scale: 1 }, 'wide in square');
    at(r.crop, { sx: 50, sy: 0, sw: 100, sh: 100 }, 'crop');
    const t = fitRect({ w: 100, h: 200 }, { x: 0, y: 0, w: 50, h: 50 }, 'cover');
    at(t, { x: 0, y: -25, w: 50, h: 100, scale: 0.5 }, 'tall in a small square');
    at(t.crop, { sx: 0, sy: 50, sw: 100, sh: 100 }, 'tall crop');
  }],
  ['fitRect cover: with no focus it is object-position; with a focus the point comes to the middle, never leaving a gap', ({ fitRect }) => {
    const box = { x: 0, y: 0, w: 100, h: 100 }, pic = { w: 400, h: 100 }; // drawn 400 x 100 at scale 1: 300 px to spare
    at(fitRect(pic, box, 'cover', { align: { x: 0, y: 0.5 } }), { x: 0 }, 'align left');
    at(fitRect(pic, box, 'cover', { align: { x: 1, y: 0.5 } }), { x: -300 }, 'align right');
    at(fitRect(pic, box, 'cover', { focus: { x: 0.5, y: 0.5 } }), { x: -150 }, 'centre focus');
    at(fitRect(pic, box, 'cover', { focus: { x: 0.3, y: 0.5 } }), { x: -70 }, 'focus at 0.3: 120 into the picture sits at the middle (50)');
    at(fitRect(pic, box, 'cover', { focus: { x: 0, y: 0.5 } }), { x: 0 }, 'focus at the left edge clamps: no gap on the left');
    at(fitRect(pic, box, 'cover', { focus: { x: 1, y: 0.5 } }), { x: -300 }, 'focus at the right edge clamps: no gap on the right');
  }],
  ['fitRect none: intrinsic size, aligned, with a focus when it overflows', ({ fitRect }) => {
    at(fitRect({ w: 40, h: 20 }, { x: 0, y: 0, w: 100, h: 100 }, 'none'), { x: 30, y: 40, w: 40, h: 20, scale: 1 }, 'small');
    at(fitRect({ w: 300, h: 20 }, { x: 0, y: 0, w: 100, h: 100 }, 'none', { focus: { x: 0.5, y: 0.5 } }), { x: -100, y: 40, w: 300 }, 'wide, centre focus');
    const c = fitRect({ w: 300, h: 20 }, { x: 0, y: 0, w: 100, h: 100 }, 'none').crop;
    at(c, { sx: 100, sy: 0, sw: 100, sh: 20 }, 'crop of the overflow');
  }],
  ['fitRect: a size or a box that is not a positive number, or an unknown mode, is null', ({ fitRect }) => {
    const box = { x: 0, y: 0, w: 10, h: 10 };
    for (const d of [null, {}, { w: 0, h: 5 }, { w: 5, h: -1 }, { w: NaN, h: 5 }, { w: Infinity, h: 5 }]) assert.equal(fitRect(d, box, 'contain'), null, JSON.stringify(d));
    for (const b of [null, { x: 0, y: 0, w: 0, h: 10 }, { x: 0, y: 0, w: 10, h: -2 }, { x: NaN, y: 0, w: 10, h: 10 }]) assert.equal(fitRect({ w: 5, h: 5 }, b, 'cover'), null, JSON.stringify(b));
    assert.equal(fitRect({ w: 5, h: 5 }, box, 'stretch'), null);
  }],
  // ── fitRect: properties over seeded random cases ───────────────────────
  ['fitRect properties: contain fits and touches, cover covers and touches, the proportions never change', ({ fitRect }) => {
    const r = rng(7);
    for (let k = 0; k < 300; k++) {
      const pic = { w: between(r, 10, 4000), h: between(r, 10, 4000) }, box = { x: between(r, -50, 50), y: between(r, -50, 50), w: between(r, 20, 900), h: between(r, 20, 900) };
      const align = { x: r(), y: r() }, focus = r() < 0.5 ? { x: r(), y: r() } : undefined, why = `case ${k}: ${JSON.stringify({ pic, box, align, focus })}`;
      const c = fitRect(pic, box, 'contain', { align, focus }), v = fitRect(pic, box, 'cover', { align, focus });
      near(c.w / c.h, pic.w / pic.h, `${why}: contain keeps the proportions`, 1e-9);
      near(v.w / v.h, pic.w / pic.h, `${why}: cover keeps the proportions`, 1e-9);
      assert.ok(c.x >= box.x - 1e-6 && c.y >= box.y - 1e-6 && c.x + c.w <= box.x + box.w + 1e-6 && c.y + c.h <= box.y + box.h + 1e-6, `${why}: contain stays inside the box`);
      assert.ok(Math.abs(c.w - box.w) < 1e-6 || Math.abs(c.h - box.h) < 1e-6, `${why}: contain touches the box on one axis`);
      assert.ok(v.x <= box.x + 1e-6 && v.y <= box.y + 1e-6 && v.x + v.w >= box.x + box.w - 1e-6 && v.y + v.h >= box.y + box.h - 1e-6, `${why}: cover leaves no gap`);
      assert.ok(Math.abs(v.w - box.w) < 1e-6 || Math.abs(v.h - box.h) < 1e-6, `${why}: cover touches the box on one axis`);
      const cc = v.crop;
      near(cc.sw * v.scale, box.w, `${why}: the crop is the box's width`, 1e-6);
      near(cc.sh * v.scale, box.h, `${why}: the crop is the box's height`, 1e-6);
      assert.ok(cc.sx >= -1e-9 && cc.sy >= -1e-9 && cc.sx + cc.sw <= pic.w + 1e-6 && cc.sy + cc.sh <= pic.h + 1e-6, `${why}: the crop is inside the picture`);
      near(v.x + cc.sx * v.scale, box.x, `${why}: the crop starts at the box's left edge`, 1e-6);
      near(v.y + cc.sy * v.scale, box.y, `${why}: the crop starts at the box's top edge`, 1e-6);
    }
  }],
  ['fitRect properties: with no focus cover and none are CSS object-position; a focus lands at the middle unless clamped', ({ fitRect }) => {
    const r = rng(19);
    for (let k = 0; k < 200; k++) {
      const pic = { w: between(r, 50, 2000), h: between(r, 50, 2000) }, box = { x: 0, y: 0, w: between(r, 40, 700), h: between(r, 40, 700) }, a = { x: r(), y: r() }, f = { x: r(), y: r() };
      const v = fitRect(pic, box, 'cover', { align: a }), why = `case ${k}`;
      near(v.x, (box.w - v.w) * a.x, `${why}: object-position x`, 1e-6);
      near(v.y, (box.h - v.h) * a.y, `${why}: object-position y`, 1e-6);
      const g = fitRect(pic, box, 'cover', { focus: f });
      if (g.w > box.w + 1e-6) near(g.x, Math.min(0, Math.max(box.w - g.w, box.w / 2 - f.x * g.w)), `${why}: focus x`, 1e-6);
      if (g.h > box.h + 1e-6) near(g.y, Math.min(0, Math.max(box.h - g.h, box.h / 2 - f.y * g.h)), `${why}: focus y`, 1e-6);
    }
  }],
  // ── reserve ─────────────────────────────────────────────────────────────
  ['reserve: the height follows the picture\'s proportions; a missing size uses the ratio and says it guessed', ({ reserve }) => {
    assert.deepEqual(reserve({ w: 1200, h: 800 }, 300), { w: 300, h: 200, guessed: false });
    assert.deepEqual(reserve({ w: 600, h: 800 }, 300, 2), { w: 300, h: 400, guessed: false });
    assert.deepEqual(reserve(null, 300, 1.5), { w: 300, h: 200, guessed: true });
    assert.equal(reserve(null, 300), null, 'no size and no ratio');
    assert.equal(reserve({ w: 10, h: 10 }, 0), null);
    assert.equal(reserve({ w: 10, h: 10 }, -5), null);
    assert.equal(reserve({ w: 0, h: 10 }, 100, 2).guessed, true, 'a zero size is no size');
  }],
  // ── flowColumn: the boxes ──────────────────────────────────────────────
  ['flowColumn: a left float hugs the left, a right float the right, at their reserved size', ({ flowColumn }) => {
    const col = { x: 20, y: 100, w: 400 };
    const f = flowColumn(col, [{ id: 'a', side: 'left', width: 120, dims: { w: 600, h: 400 } }, { id: 'b', side: 'right', width: 100, dims: { w: 100, h: 200 }, y: 30 }], { gap: 10 });
    const [a, b] = f.boxes;
    assert.deepEqual([a.id, a.x, a.y, a.w, a.h, a.guessed], ['a', 20, 100, 120, 80, false]);
    assert.deepEqual([b.id, b.x, b.y, b.w, b.h], ['b', 320, 130, 100, 200]);
    near(f.bottom, 340, 'bottom: the lowest float plus its gap');
  }],
  ['flowColumn: share, the ratio fallback, and a float with no usable width', ({ flowColumn }) => {
    const f = flowColumn({ x: 0, y: 0, w: 500 }, [{ id: 'a', side: 'left', share: 0.4, dims: { w: 100, h: 100 } }, { id: 'g', side: 'right', width: 100 }, { id: 'z', side: 'right', width: 0, dims: { w: 1, h: 1 } }]);
    assert.deepEqual(f.boxes.map(b => [b.id, b.w, b.h, b.guessed]), [['a', 200, 200, false], ['g', 100, 75, true]], 'zero width is dropped; no dims uses 4:3 and says so');
  }],
  ['flowColumn: floats on one side stack downward, in order', ({ flowColumn }) => {
    const f = flowColumn({ x: 0, y: 0, w: 400 }, [{ id: 'a', side: 'left', width: 100, dims: { w: 1, h: 1 } }, { id: 'b', side: 'left', width: 80, dims: { w: 1, h: 1 }, y: 10 }, { id: 'c', side: 'right', width: 60, dims: { w: 1, h: 1 } }], { gap: 8 });
    assert.deepEqual(f.boxes.map(b => [b.id, b.y]), [['a', 0], ['b', 108], ['c', 0]], 'b waits for a and its margin; c is on the other side');
  }],
  ['flowColumn: a float that would meet one on the other side goes below it', ({ flowColumn }) => {
    const f = flowColumn({ x: 0, y: 0, w: 300 }, [{ id: 'a', side: 'left', width: 200, dims: { w: 1, h: 1 } }, { id: 'b', side: 'right', width: 150, dims: { w: 1, h: 1 } }, { id: 'c', side: 'right', width: 60, dims: { w: 1, h: 1 } }], { gap: 10 });
    assert.deepEqual(f.boxes.map(b => [b.id, b.y]), [['a', 0], ['b', 210], ['c', 370]], 'b does not fit beside a; c stacks under b (210 + 150 + 10)');
    const roomy = flowColumn({ x: 0, y: 0, w: 300 }, [{ id: 'a', side: 'left', width: 100, dims: { w: 1, h: 1 } }, { id: 'b', side: 'right', width: 100, dims: { w: 1, h: 1 } }], { gap: 10 });
    assert.deepEqual(roomy.boxes.map(b => b.y), [0, 0], 'two that fit stand side by side');
  }],
  // ── flowColumn: the shape ──────────────────────────────────────────────
  ['flowColumn shape: full width with no floats, null outside the column', ({ flowColumn }) => {
    const { shape } = flowColumn({ x: 5, y: 10, w: 300, h: 200 }, []);
    assert.deepEqual(shape(10, 34), { x: 5, w: 300 });
    assert.deepEqual(shape(186, 210), { x: 5, w: 300 }, 'the last band that fits');
    assert.equal(shape(0, 24), null, 'above the column');
    assert.equal(shape(190, 214), null, 'below the column');
    assert.deepEqual(flowColumn({ x: 0, y: 0, w: 100 }, []).shape(5000, 5024), { x: 0, w: 100 }, 'no h: no end');
  }],
  ['flowColumn shape: the room beside a left float starts after the float and its gap, and returns below its margin', ({ flowColumn }) => {
    const { shape } = flowColumn({ x: 0, y: 0, w: 400 }, [{ side: 'left', width: 100, dims: { w: 1, h: 1 } }], { gap: 12 }); // 100 x 100 at 0,0
    assert.deepEqual(shape(0, 24), { x: 112, w: 288 });
    assert.deepEqual(shape(88, 112), { x: 112, w: 288 }, 'a band that reaches into the float');
    assert.deepEqual(shape(100, 124), { x: 112, w: 288 }, 'still inside the bottom margin');
    assert.deepEqual(shape(111, 135), { x: 112, w: 288 }, 'the margin ends at 112: this band still starts inside it');
    assert.deepEqual(shape(112, 136), { x: 0, w: 400 }, 'the first band clear of the margin');
  }],
  ['flowColumn shape: a right float, and both sides together', ({ flowColumn }) => {
    const r = flowColumn({ x: 0, y: 0, w: 400 }, [{ side: 'right', width: 100, dims: { w: 1, h: 1 } }], { gap: 12 }).shape;
    assert.deepEqual(r(0, 24), { x: 0, w: 288 });
    const both = flowColumn({ x: 0, y: 0, w: 400 }, [{ side: 'left', width: 100, dims: { w: 1, h: 1 } }, { side: 'right', width: 50, dims: { w: 1, h: 1 } }], { gap: 10 }).shape;
    assert.deepEqual(both(0, 24), { x: 110, w: 230 });
    assert.deepEqual(both(105, 129), { x: 110, w: 290 }, 'the right float (50 + 10 = 60) is above this band; only the left still narrows it');
  }],
  ['flowColumn shape: a band narrower than nothing is null (step down), and a float that fills the column blocks it', ({ flowColumn }) => {
    const { shape } = flowColumn({ x: 0, y: 0, w: 200 }, [{ side: 'left', width: 200, dims: { w: 2, h: 1 } }], { gap: 10 }); // 200 x 100
    assert.equal(shape(0, 24), null);
    assert.equal(shape(100, 124), null, 'the bottom margin still blocks');
    assert.deepEqual(shape(110, 134), { x: 0, w: 200 });
  }],
  ['flowColumn shape: the room never touches a float\'s margin box and is as wide as it can be (random)', ({ flowColumn }) => {
    const r = rng(3);
    for (let k = 0; k < 200; k++) {
      const col = { x: between(r, 0, 40), y: between(r, 0, 40), w: between(r, 240, 800) };
      const floats = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, i) => ({ id: i, side: r() < 0.5 ? 'left' : 'right', width: between(r, 30, 160), dims: { w: between(r, 1, 3), h: between(r, 1, 3) }, y: between(r, 0, 300) }));
      const gap = between(r, 0, 20), f = flowColumn(col, floats, { gap }), why = `case ${k}`;
      for (let top = col.y; top < col.y + 500; top += 7.3) {
        const bottom = top + 20, room = f.shape(top, bottom);
        const hit = f.boxes.filter(b => top < b.y + b.h + gap - 1e-6 && bottom > b.y + 1e-6);
        if (!room) { const left = Math.max(col.x, ...hit.filter(b => b.side === 'left').map(b => b.x + b.w + gap)), right = Math.min(col.x + col.w, ...hit.filter(b => b.side === 'right').map(b => b.x - gap)); assert.ok(right - left <= 1e-6, `${why}: null at ${top} although ${right - left}px is free`); continue; }
        for (const b of hit) {
          const clear = b.side === 'left' ? room.x >= b.x + b.w + gap - 1e-6 : room.x + room.w <= b.x - gap + 1e-6;
          assert.ok(clear, `${why}: the room at ${top} runs into float ${b.id}`);
        }
        assert.ok(room.x >= col.x - 1e-6 && room.x + room.w <= col.x + col.w + 1e-6, `${why}: the room is inside the column`);
        const lefts = hit.filter(b => b.side === 'left'), rights = hit.filter(b => b.side === 'right');
        near(room.x, lefts.length ? Math.max(...lefts.map(b => b.x + b.w + gap)) : col.x, `${why}: the room starts where the last left float ends`, 1e-6);
        near(room.x + room.w, rights.length ? Math.min(...rights.map(b => b.x - gap)) : col.x + col.w, `${why}: the room ends where the first right float begins`, 1e-6);
      }
    }
  }],
  // ── flowAround: text laid beside the floats ────────────────────────────
  ['flowAround: every line keeps clear of every float, all the words are laid, in order', ({ flowAround }) => {
    const text = 'Rain came early to the veranda and the paddy drank it all in one long morning before nine, while the fishermen mended their nets under the almond tree and the lowest tide of June went out past the lantern.';
    const blocks = [{ prepared: layout.prepare(text, '400 16px Kalam'), lineHeight: 24 }];
    const floats = [{ id: 'a', side: 'right', width: 140, dims: { w: 3, h: 2 } }, { id: 'b', side: 'left', width: 90, dims: { w: 1, h: 1 }, y: 60 }];
    const col = { x: 0, y: 0, w: 360 };
    const out = flowAround(layout, blocks, col, floats, { gap: 12, minWidth: 80 });
    assert.equal(out.fits, true);
    assert.equal(out.lines.map(l => l.text).join('').replace(/\s+/g, ' ').trim(), text, 'no word lost, none out of order');
    for (const l of out.lines) {
      assert.ok(l.x >= -1e-9 && l.x + l.w <= 360 + 1e-9, `the line "${l.text}" is inside the column`);
      for (const b of out.boxes) {
        const apart = l.x + l.w <= b.x - 12 + 1e-9 || l.x >= b.x + b.w + 12 - 1e-9 || l.y + l.h <= b.y + 1e-9 || l.y >= b.y + b.h + 12 - 1e-9;
        assert.ok(apart, `the line "${l.text}" at y=${l.y} meets float ${b.id}`);
      }
    }
    assert.ok(Math.min(...out.lines.filter(l => l.y < 90).map(l => l.room)) < 360, 'the first lines are laid in a narrowed room');
    assert.ok(out.lines.some(l => l.room === 360), 'and the later ones use the whole column');
    assert.ok(out.bottom >= out.boxes.reduce((m, b) => Math.max(m, b.y + b.h), 0), 'the bottom clears the floats');
  }],
  ['flowAround: minWidth steps over a sliver beside a float instead of squeezing words into it', ({ flowAround }) => {
    const blocks = [{ prepared: layout.prepare('Morning on the veranda, the rain over the paddy and the tea going cold.', '400 16px Kalam'), lineHeight: 24 }];
    const col = { x: 0, y: 0, w: 200 }, floats = [{ id: 'a', side: 'right', width: 150, dims: { w: 1, h: 1 } }]; // leaves 38 px beside it
    const out = flowAround(layout, blocks, col, floats, { gap: 12, minWidth: 80 });
    assert.equal(out.fits, true, 'no word was broken to fit the sliver');
    assert.ok(out.lines.every(l => l.room >= 80), 'every line has at least minWidth to itself');
    assert.ok(out.lines.every(l => l.y >= 162 - 1e-6), 'so the text starts below the float and its margin (150 + 12)');
    const squeezed = flowAround(layout, blocks, col, floats, { gap: 12, minWidth: 0 });
    assert.equal(squeezed.fits, false, 'and without minWidth the same text does break words in the sliver (the check can fail)');
  }],
  ['flowAround: with no text left the floats still set the bottom; the reserved boxes come back untouched', ({ flowAround }) => {
    const blocks = [{ prepared: layout.prepare('short', '400 16px Kalam'), lineHeight: 24 }];
    const out = flowAround(layout, blocks, { x: 0, y: 0, w: 300 }, [{ id: 'a', side: 'left', width: 100, dims: { w: 1, h: 3 } }], { gap: 10 });
    assert.equal(out.lines.length, 1);
    near(out.bottom, 310, 'the float is 300 tall and keeps 10 below');
    assert.deepEqual(out.boxes.map(b => [b.w, b.h]), [[100, 300]]);
  }],
];
