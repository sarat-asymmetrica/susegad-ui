// The text gate's judging, with no fonts and no layout: crafted results, each of which the gate must call out.
// (The real manifest on the real fonts is text-gate.test.mjs.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeLaid, judgeExpectation, gateCell, formatTable, failures, MIN_LEADING, PHONE_MIN_PX } from './text-gate.core.js';
import { epsilonFrom } from './text-gate.run.mjs';

const calmOf = lines => lines.map(l => ({ x: l.x - 2, y: l.y - 2, w: l.w + 4, h: l.h + 4 }));
const good = () => ({
  blocks: [{ tag: 'p', px: 16, lineHeight: 20 }],
  lines: [{ block: 0, text: 'Come for ', x: 10, y: 0, w: 64, h: 20, room: 100 }, { block: 0, text: 'the rain', x: 10, y: 20, w: 64, h: 20, room: 100 }],
});
const args = (over = {}) => ({
  laid: good(), bandAt: () => ({ x: 10, w: 100 }), fontOf: () => '400 16px Kalam', scale: 1, epsilon: 0.05,
  measure: (f, t) => t.trimEnd().length * 8, source: ['Come for the rain'], minPx: () => 14, phone: false, calmOf, ...over,
});

test('a clean result has nothing to say', () => {
  assert.deepEqual(judgeLaid(args()), { escapes: [], a11y: [] });
});

test('a line wider than its band is an escape, by the amount, even when the oracle said it fit', () => {
  // the oracle's lines say 80 wide; the shaper, asked about the whole line, says 8 characters x 14 = 112 in a 100 band
  const r = judgeLaid(args({ measure: (f, t) => t.trimEnd().length * 14 }));
  assert.equal(r.escapes.length, 2);
  assert.match(r.escapes[0], /line 1 "Come for" is 12 px wider than its band \(112 of 100 px\)/);
});

test('epsilon is slack, not a free pass: 0.04 px over is fine, 0.06 px over is not', () => {
  const at = over => judgeLaid(args({ measure: () => 100 + over })).escapes.length;
  assert.equal(at(0.04), 0);
  assert.equal(at(0.06), 2);
});

test('a line box outside its band is an escape, whichever side', () => {
  const r = judgeLaid(args({ bandAt: () => ({ x: 20, w: 100 }) })); // lines start at 10, the band at 20
  assert.ok(r.escapes.some(e => /leaves its band/.test(e)));
  const none = judgeLaid(args({ bandAt: () => null }));
  assert.ok(none.escapes.every(e => /no room/.test(e)));
});

test('scale: widths are compared in CSS px, boxes in logical units', () => {
  // at 0.5 px per unit a 100-unit band is 50 px; a 60 px measured line escapes, a 40 px one does not
  const wide = judgeLaid(args({ scale: 0.5, measure: () => 60 })), narrow = judgeLaid(args({ scale: 0.5, measure: () => 40 }));
  assert.ok(wide.escapes.some(e => /wider than its band/.test(e)));
  assert.deepEqual(narrow.escapes, []);
});

test('words lost on the way are an escape (a truncated paragraph)', () => {
  const laid = good();
  laid.lines.pop();
  const r = judgeLaid(args({ laid }));
  assert.match(r.escapes.join(), /block 1 \(p\) lost words: laid 8 of 17 characters/);
});

test('accessibility: under the minimum size, under 14 px on a phone, and a line height under 1.15 x', () => {
  const small = good(); small.blocks[0].px = 12;
  assert.match(judgeLaid(args({ laid: small })).a11y.join(), /p is 12 px, under its minimum 14 px/);
  const phone = good(); phone.blocks[0].px = 13;
  assert.match(judgeLaid(args({ laid: phone, phone: true, minPx: () => null })).a11y.join(), new RegExp(`13 px on a phone, under ${PHONE_MIN_PX} px`));
  const tight = good(); tight.blocks[0].lineHeight = 16 * MIN_LEADING - 0.5;
  assert.match(judgeLaid(args({ laid: tight })).a11y.join(), /line height .* is under 1.15 x/);
  // and exactly 1.15 is fine
  const ok = good(); ok.blocks[0].lineHeight = 16 * MIN_LEADING;
  assert.deepEqual(judgeLaid(args({ laid: ok })).a11y, []);
});

test('every laid line needs a calm box with a size', () => {
  assert.match(judgeLaid(args({ calmOf: () => [] })).a11y.join(), /no calm box/);
  assert.match(judgeLaid(args({ calmOf: ls => ls.map(() => ({ x: 0, y: 0, w: NaN, h: 4 })) })).a11y.join(), /no calm box/);
});

test('expectations: escapes always fail; a fall-back fails only where the surface must hold', () => {
  assert.equal(judgeExpectation('escapes', 'may-fall-back'), false);
  assert.equal(judgeExpectation('falls-back', 'holds'), false);
  assert.equal(judgeExpectation('falls-back', 'may-fall-back'), true);
  assert.equal(judgeExpectation('fits', 'holds'), true);
  assert.equal(judgeExpectation('fits', 'may-fall-back'), true);
});

// ── cells, with a made-up use ────────────────────────────────────────────

const VP = { name: 'desktop', vw: 1100, rootPx: 16, hostW: 1068, phone: false };
const entry = { blocks: { kn: [{ tag: 'p', text: 'Come for the rain' }] } };
const lay = (laid, extra = {}) => () => ({ laid, scale: 1, fontOf: () => '400 16px Kalam', bandAt: () => ({ x: 10, w: 100 }), reason: laid ? null : 'no room', reasonKind: 'height', ...extra });
const cell = (use, vp = VP) => gateCell({ id: 'x', copy: 'x', viewports: { desktop: { expect: 'holds' }, ...use.viewports }, legible: () => 14, ...use }, {
  lang: 'kn', vp, entry, measure: (f, t) => t.trimEnd().length * 8, epsilon: 0.05, calmOf, ctx: {},
});

test('a cell that fits is ok; one that falls back where it must hold fails, with the reason', () => {
  const fits = cell({ run: lay(good()) });
  assert.equal(fits.result, 'fits'); assert.equal(fits.ok, true);
  const fell = cell({ run: lay(null) });
  assert.equal(fell.result, 'falls-back'); assert.equal(fell.ok, false);
  assert.deepEqual(fell.notes, ['no room']);
  assert.equal(cell({ run: lay(null), viewports: { desktop: { expect: 'may-fall-back' } } }).ok, true);
});

test('a use whose surface shows what it lays (onUnfit: escapes) fails when the words do not fit', () => {
  const r = cell({ onUnfit: 'escapes', run: lay(null) });
  assert.equal(r.result, 'escapes'); assert.equal(r.ok, false);
});

test('a viewport given as a string is not gated, with its reason', () => {
  const r = cell({ run: lay(null), viewports: { desktop: 'flat below 560 px' } });
  assert.equal(r.result, 'not-gated'); assert.equal(r.ok, true); assert.deepEqual(r.notes, ['flat below 560 px']);
});

test('variants: the cell is the worst of them', () => {
  const r = cell({
    variants: () => [{ id: 'a' }, { id: 'b' }],
    run: ({ variant }) => lay(variant.id === 'a' ? good() : null)(),
  });
  assert.equal(r.result, 'falls-back');
  assert.match(r.notes.join(), /worst of 2 variants: b/);
});

test('a waiver lets a cell fall back, only for its named reason, and must go once the cell holds', () => {
  const waived = byLang => ({ viewports: { desktop: { expect: 'holds', byLang } } });
  const w = { kn: { expect: 'may-fall-back', waiver: 'finding 1', onlyFor: 'height' } };
  const fell = cell({ run: lay(null), ...waived(w) });
  assert.equal(fell.ok, true); assert.match(fell.notes[0], /WAIVED: finding 1/);
  const other = cell({ run: lay(null, { reasonKind: 'broke-word' }), ...waived(w) });
  assert.equal(other.ok, false); assert.match(other.issues.join(), /covers only "height", but this cell falls back for "broke-word"/);
  const stale = cell({ run: lay(good()), ...waived(w) });
  assert.equal(stale.ok, false); assert.match(stale.issues.join(), /stale waiver/);
});

test('a character no face in the stack covers fails the cell, whether the words fit or not', () => {
  const run = (laid, uncovered) => gateCell({ id: 'x', copy: 'x', stack: 'sg-font-hand', viewports: { desktop: { expect: 'holds' } }, run: lay(laid) }, {
    lang: 'kn', vp: VP, entry, measure: (f, t) => t.trimEnd().length * 8, epsilon: 0.05, calmOf, ctx: { uncovered: () => uncovered },
  });
  assert.equal(run(good(), []).ok, true);
  const bad = run(good(), ['ಕ', 'ಮ']);
  assert.equal(bad.ok, false);
  assert.match(bad.issues.join(), /no face in the sg-font-hand stack covers 2 characters of the kn copy \(ಕ ಮ\)/);
  assert.equal(run(null, ['ಕ']).ok, false, 'a fall-back measured in the wrong face is not trusted either');
});

test('an oracle width that is not the width of the line fails the accessibility leg (centring and calm boxes use it)', () => {
  const lines = good();
  lines.lines[0].w = 50; // the shaper says 64
  const r = judgeLaid(args({ laid: lines }));
  assert.match(r.a11y.join(), /line 1 "Come for" reports 50 px wide but measures 64 px/);
  assert.deepEqual(judgeLaid(args({ laid: lines, exactWidth: false })).a11y, []); // plaques are a box around the words
});

test('an a11y issue fails the cell', () => {
  const tiny = good(); tiny.blocks[0].px = 10;
  assert.equal(cell({ run: lay(tiny) }).ok, false);
});

test('formatTable gives every row a line and the reason under the ones that are not plain fits', () => {
  const rows = [cell({ run: lay(good()) }), cell({ run: lay(null) })];
  const text = formatTable(rows);
  assert.equal(text.split('\n').filter(l => l.startsWith('x ')).length, 2);
  assert.match(text, /falls-back  FAIL/);
  assert.match(text, /! no room/);
  assert.equal(failures(rows).length, 1);
});

test('epsilon comes from the calibration: ten times the worst whole-string deviation, never under 0.05 px', () => {
  assert.equal(epsilonFrom({ stack: { string: { latin: { maxAbsPx: 0.002 }, kannada: { maxAbsPx: 0.001 } } } }), 0.05);
  assert.equal(epsilonFrom({ stack: { string: { kannada: { maxAbsPx: 0.2 } } } }), 2);
  assert.equal(epsilonFrom(null), 0.05);
});
