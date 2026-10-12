// The operators that measure, through the real oracle's path: Pretext behind
// measure.js with a fake OffscreenCanvas (every grapheme half the font size
// wide), as in pretext.test.js. Pure geometry is proved in operators.test.js;
// this shows the same contracts hold when Pretext does the breaking.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const count = t => [...segmenter.segment(t)].length;
globalThis.OffscreenCanvas = class {
  getContext() {
    return { font: '10px sans-serif', measureText(t) { const px = parseFloat(/([\d.]+)px/.exec(this.font)[1]); return { width: count(t) * px * 0.5 }; } };
  }
};
const { createLayout, rect } = await import('./layout.core.js');
const { createPretextOracle } = await import('./measure.js');
const { fit, clampLines, predictHeight, pack } = await import('./layout.operators.js');
const { layZones } = await import('./layout.zones.js');
const T = createLayout(createPretextOracle());

const PARA = 'Our lowest rate, June to September. The veranda stays dry and the paddy turns green.';
const DEVA = 'नमस्ते दुनिया, यह एक लंबा वाक्य है जो कई पंक्तियों में फैलता है और क्षत्रिय ज्ञान श्री';
const at = (text, px, w, h = 2000) => T.layIntoShape([{ prepared: T.prepare(text, `400 ${px}px Kalam`), lineHeight: px * 1.22 }], rect(0, 0, w, h), { top: 0, bottom: h });

test('fit through Pretext: the largest whole px that fits, and one more does not', () => {
  for (const [text, w, h] of [[PARA, 240, 160], [PARA, 400, 90], [DEVA, 200, 200]]) {
    const shape = rect(0, 0, w, h), opts = { family: 'Kalam', minPx: 6, maxPx: 60, top: 0, bottom: h };
    const got = fit(T, text, shape, opts);
    assert.ok(got, `${text.slice(0, 12)} in ${w}x${h}`);
    assert.equal(T.layIntoShape([{ prepared: T.prepare(text, `400 ${got.px}px Kalam`), lineHeight: +(got.px * 1.22).toFixed(2) }], shape, opts).fits, true);
    assert.equal(T.layIntoShape([{ prepared: T.prepare(text, `400 ${got.px + 1}px Kalam`), lineHeight: +((got.px + 1) * 1.22).toFixed(2) }], shape, opts).fits, false);
  }
});

test('clampLines through Pretext: an ellipsis inside the band, whole clusters, the full text kept', () => {
  for (const text of [PARA, DEVA]) {
    for (let w = 60; w <= 300; w += 13) {
      const lines = at(text, 16, w).lines, got = clampLines(T, lines, 2, { font: '400 16px Kalam' });
      assert.equal(got.fullText.replace(/\s+/g, ' '), text, `w=${w}`);
      if (!got.clamped) continue;
      const last = got.lines.at(-1), prefix = last.text.slice(0, -1), src = lines[1].text;
      assert.ok(last.text.endsWith('…') && got.lines.length === 2);
      assert.ok(count(last.text) * 8 <= last.room + 1e-9, `w=${w}: "${last.text}" is ${count(last.text) * 8} in ${last.room}`);
      assert.ok(src.startsWith(prefix) && !/\p{M}/u.test(src.slice(prefix.length)[0] ?? '') && !prefix.endsWith('्'), `w=${w}: "${prefix}|${src.slice(prefix.length)}"`);
    }
  }
});

test('predictHeight and pack through Pretext: predicted heights are the laid heights, columns do not overlap', () => {
  const texts = [PARA, PARA.slice(0, 30), DEVA, PARA + ' ' + PARA], w = 180;
  const blocks = texts.map((t, i) => ({ id: i, height: predictHeight(T, t, '400 16px Kalam', w, 20) }));
  texts.forEach((t, i) => assert.equal(blocks[i].height, T.layIntoShape([{ prepared: T.prepare(t, '400 16px Kalam'), lineHeight: 20 }], rect(0, 0, w, 2000), { top: 0, bottom: 2000 }).lines.length * 20));
  const got = pack(blocks, { columns: 2, gap: 12, width: 2 * w + 12 });
  assert.equal(got.items.length, 4);
  got.items.forEach((a, i) => got.items.slice(i + 1).forEach(b => assert.ok(!(a.column === b.column && a.y < b.y + b.h && b.y < a.y + a.h), `${a.id} overlaps ${b.id}`)));
});

test('the live door binds fit, clampLines, predictHeight and layZones to the default layout, and re-exports the pure three', async () => {
  const ops = await import('./operators.js');
  const shape = rect(0, 0, 240, 160), opts = { family: 'Kalam', minPx: 6, maxPx: 60, top: 0, bottom: 160 };
  assert.deepEqual(ops.fit(PARA, shape, opts).px, fit(T, PARA, shape, opts).px);
  assert.equal(ops.predictHeight(PARA, '400 16px Kalam', 180, 20), predictHeight(T, PARA, '400 16px Kalam', 180, 20));
  const lines = at(PARA, 16, 120).lines;
  assert.equal(ops.clampLines(lines, 2, { font: '400 16px Kalam' }).lines.length, 2);
  const zones = [{ id: 'z', shape: { kind: 'ellipse', cx: 150, cy: 90, rx: 140, ry: 80, pad: 4 }, text: PARA, minPx: 10, maxPx: 20 }];
  const laidLive = ops.layZones(zones, {}, { family: 'Kalam' }), laid = layZones(T, zones, {}, { family: 'Kalam' });
  assert.equal(laidLive.z.fits, true);
  assert.deepEqual([laidLive.z.px, laidLive.z.lines.map(l => l.text)], [laid.z.px, laid.z.lines.map(l => l.text)]);
  assert.deepEqual(Object.keys(ops).sort(), ['clampLines', 'distribute', 'fit', 'layZones', 'pack', 'place', 'predictHeight']);
});
