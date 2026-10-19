import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from './pixels.mjs';
import * as old from './pixeldiff.mjs';
import * as strip from './strip.mjs';
import * as check from './pixelcheck.mjs';

const px = (rgb, a = 255) => [...rgb, a];
const dist = (p, q) => P.pixelDistance(...p, ...q);
const buf = (...pixels) => new Uint8ClampedArray(pixels.flat());

test('the old paths re-export the one module: same functions, not copies', () => {
  assert.equal(old.pixelDistance, P.pixelDistance);
  assert.equal(old.comparePixels, P.comparePixels);
  for (const k of ['meanLuminance', 'analyseFrames', 'medianFrame', 'onionAlphas', 'onionBlend', 'onionDiff']) assert.equal(strip[k], P[k], k);
  for (const k of ['diffMask', 'alphaMask', 'shiftShapes', 'rasterize', 'grow', 'both', 'count', 'share', 'agreement']) assert.equal(check[k], P[k], k);
});

test('the rule: the two thresholds, and what each is blind to and what it catches', () => {
  assert.equal(P.CHANGED_THRESHOLD, 0.02);
  assert.equal(P.LAYER_THRESHOLD, 0.08);
  const ground = px([251, 246, 233]); // cream paper
  // blind: a few levels of dither or JPEG ringing is below both thresholds
  const noise = px([255, 250, 237]); // four levels on each channel
  assert.ok(dist(ground, noise) < P.CHANGED_THRESHOLD, 'noise stays under the motion threshold');
  // between: a 10-level grey step is motion (over 0.02) but not ink (under 0.08)
  const step = dist(px([128, 128, 128]), px([138, 138, 138]));
  assert.ok(step > P.CHANGED_THRESHOLD && step < P.LAYER_THRESHOLD, `10-level step ${step}`);
  // a pale antialiasing fringe, 5% coverage of black over cream, is not a layer's ink
  assert.ok(dist(ground, px([251 * 0.95, 246 * 0.95, 233 * 0.95])) < P.LAYER_THRESHOLD);
  // catches: pale gold ink on cream, half-covered black, and black on white
  assert.ok(dist(ground, px([232, 217, 168])) > P.LAYER_THRESHOLD, 'pale gold on cream is ink');
  assert.ok(dist(px([255, 255, 255]), px([128, 128, 128])) > 0.4, 'a half-covered edge is ink');
  assert.ok(Math.abs(dist(px([0, 0, 0]), px([255, 255, 255])) - 1) < 1e-9);
  // alpha counts: a transparent pixel is white paper, in both rules
  assert.equal(P.pixelDistance(0, 0, 0, 0, 255, 255, 255, 255), 0);
});

test('diffMask is exactly "pixelDistance above LAYER_THRESHOLD", and the grey line sits at 20 levels as the old sum-of-60 rule had it', () => {
  const pairs = [];
  for (const g of [0, 1, 5, 19, 20, 21, 22, 40]) pairs.push([px([100, 100, 100]), px([100 + g, 100 + g, 100 + g])]);
  for (const [p, q] of [[px([0, 0, 0]), px([60, 0, 0])], [px([0, 0, 0]), px([0, 0, 60])], [px([10, 20, 30], 128), px([10, 20, 30])]]) pairs.push([p, q]);
  const a = buf(...pairs.map(p => p[0])), b = buf(...pairs.map(p => p[1]));
  const mask = P.diffMask(a, b);
  pairs.forEach(([p, q], i) => assert.equal(mask[i], dist(p, q) > P.LAYER_THRESHOLD ? 1 : 0, `pair ${i}`));
  // the old rule (sum of channel differences above 60) on the greys: same verdicts at every integer step
  for (let g = 0; g <= 40; g++) {
    const m = P.diffMask(buf(px([100, 100, 100])), buf(px([100 + g, 100 + g, 100 + g])));
    assert.equal(m[0], 3 * g > 60 ? 1 : 0, `grey step ${g}`);
  }
  // a threshold given in distance units still works
  assert.equal(P.diffMask(buf(px([0, 0, 0])), buf(px([30, 30, 30])), 0.5)[0], 0);
  assert.equal(P.diffMask(buf(px([0, 0, 0])), buf(px([30, 30, 30])), 0.02)[0], 1);
});

test('comparePixels defaults to the motion threshold', () => {
  const a = buf(px([100, 100, 100]), px([100, 100, 100])), b = buf(px([100, 100, 100]), px([108, 108, 108]));
  assert.equal(P.comparePixels(a, b, 2, 1).changed, 1);
  assert.equal(P.comparePixels(a, b, 2, 1, { threshold: P.LAYER_THRESHOLD }).changed, 0);
});
