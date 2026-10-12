// The real oracle's path: Pretext behind measure.js, measuring with a fake
// OffscreenCanvas (every grapheme half the font size wide, as in Pretext's own
// suite). The lines are the ones layout.js gave before the oracle boundary
// (decision 0029), so the boundary changed nothing a scene can see.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const count = t => [...graphemes.segment(t)].length;
globalThis.OffscreenCanvas = class {
  getContext() {
    return { font: '10px sans-serif', measureText(t) { const px = parseFloat(/([\d.]+)px/.exec(this.font)[1]); return { width: count(t) * px * 0.5 }; } };
  }
};
const { createLayout, arch, rect } = await import('./layout.core.js');
const { createPretextOracle } = await import('./measure.js');
const T = createLayout(createPretextOracle());

const PARA = 'Our lowest rate, June to September. The veranda stays dry and the paddy turns green.';
const block = (text, px) => ({ prepared: T.prepare(text, `${px}px Kalam`), lineHeight: px * 1.3 });

test('Pretext breaks an arch the way it did before the boundary', () => {
  const { lines, fits, bottom } = T.layIntoShape([block(PARA, 20)], arch(0, 0, 300, 400, 120, 8), { top: 8, bottom: 392, minWidth: 40 });
  assert.ok(fits);
  assert.equal(bottom, 138);
  assert.deepEqual(lines.map(l => [l.text, l.y, l.w]), [
    ['Our ', 8, 30], ['lowest rate, June ', 34, 170], ['to September. The ', 60, 170],
    ['veranda stays dry and the ', 86, 250], ['paddy turns green.', 112, 180],
  ]);
});

test('Pretext reports a word broken across lines as brokeWord, so it does not fit', () => {
  const { lines, fits } = T.layIntoShape([block('Supercalifragilistic', 20)], rect(0, 0, 100, 400), { top: 0, bottom: 400 });
  assert.equal(fits, false);
  assert.deepEqual(lines.map(l => [l.text, l.w]), [['Supercalif', 100], ['ragilistic', 100]]);
});

test('Pretext cards: shrink-wrap and balance give the same widths', () => {
  const p = T.prepare('Fish before nine, vegetables all morning, and kokum in season.', '16px Kalam');
  assert.deepEqual(T.shrinkWrap(p, 240), { width: 224, lines: 3 });
  assert.deepEqual(T.balance(p, 240), { width: 184, lines: 3 });
});

test('the real oracle can clear what Pretext measured, and measures again after', () => {
  const o = createPretextOracle();
  const p = o.prepare('Come for the rain', '20px Kalam');
  const before = o.stats(p, 1e6).maxLineWidth;
  assert.doesNotThrow(() => o.clear());
  assert.equal(o.stats(o.prepare('Come for the rain', '20px Kalam'), 1e6).maxLineWidth, before);
});
