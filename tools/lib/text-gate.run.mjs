// Set up and run the text gate: the HarfBuzz canvas, the real vendored Pretext behind measure.js, the real layout,
// the manifest, and the calibrated epsilon. tools/text-gate.mjs prints the result; the tests and the checks call it.
//
// The order matters: the stand-in OffscreenCanvas must be on globalThis before the vendored Pretext is first imported
// (it finds its canvas on first use and keeps it), so measure.js and layout.core.js are imported here, after the install.
// Pretext keeps what it measured for the life of the process, so one process holds one shaper; a test that needs a
// differently-broken shaper runs a child process (see text-gate.test.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { createShaper, installHbCanvas, REPO_ROOT } from './hb-canvas.mjs';
import { runGate, failures } from './text-gate.core.js';
import { MANIFEST, VIEWPORTS } from './text-gate.manifest.js';
import { COPY, OVERFLOW } from '../../packages/type/fixtures/gate-copy.js';

export const LANGS = ['en-IN', 'gom-Deva', 'gom-Latn', 'kn'];
export const CALIBRATION = path.join(REPO_ROOT, 'packages', 'type', 'fixtures', 'calibration.json');

/** The gate's slack in CSS px from the committed calibration: ten times the worst whole-string deviation from Chromium (gate corpus and held-out set), never under 0.05 px. */
export function epsilonFrom(cal) {
  const worst = Math.max(0, ...Object.values(cal?.stack?.string ?? {}).map(s => s.maxAbsPx), ...Object.values(cal?.heldOut ?? {}).map(s => s.maxAbsPx));
  return Math.max(0.05, Math.ceil(worst * 10 * 100) / 100);
}

let booted = null;
/**
 * Boot once per process: the shaper, the stand-in canvas, then Pretext behind measure.js (imported only now). Pretext keeps
 * the first canvas it finds, so a second boot with other options would measure with the first one's; it throws instead.
 * `layoutScale` multiplies the widths Pretext sees but NOT the gate's own re-measure of each laid line (a "lying oracle"
 * for a test to run in a child process); `widthScale` multiplies both (a consistently broken shaper).
 */
async function boot({ root, layoutScale, widthScale }) {
  const key = JSON.stringify({ root, layoutScale, widthScale });
  if (booted) {
    if (booted.key !== key) throw new Error('the text gate boots once per process (Pretext keeps its first canvas); run a differently-broken shaper in a child process');
    return booted;
  }
  const shaper = await createShaper({ root });
  const honest = shaper.measure.bind(shaper);
  const measure = widthScale === 1 ? honest : (f, t) => honest(f, t) * widthScale;
  installHbCanvas({ measure: (f, t) => measure(f, t) * layoutScale });
  const { createPretextOracle } = await import('../../packages/type/measure.js');
  const { createLayout, calmOf } = await import('../../packages/type/layout.core.js');
  const layout = createLayout(createPretextOracle());
  return (booted = { key, shaper, measure, layout, calmOf });
}

/**
 * @param {{ manifest?: Array, overrides?: object, langs?: string[], only?: { id?: string }, epsilon?: number, root?: string,
 *   widthScale?: number, layoutScale?: number }} [o]
 */
export async function runTextGate({ manifest = MANIFEST, overrides = {}, langs = LANGS, only, epsilon, root = REPO_ROOT, widthScale = 1, layoutScale = 1 } = {}) {
  const cal = JSON.parse(fs.readFileSync(CALIBRATION, 'utf8'));
  const { shaper, measure, layout, calmOf } = await boot({ root, layoutScale, widthScale });
  const eps = epsilon ?? epsilonFrom(cal);
  const quote = f => (/[\s]/.test(f) ? `'${f}'` : f);
  const ctx = {
    // the gate reads the stacks from tokens.css (shaper.stacks), never from the mirror in packages/type/stacks.js
    cssStack: name => shaper.stacks[name].map(quote).join(', '),
    // characters of the copy that no face in the (literal) stack draws
    uncovered: (stackName, weight, texts) => [...new Set(texts.flatMap(t => shaper.uncovered(`${weight} 16px ${ctx.cssStack(stackName)}`, t)))],
  };
  const rows = runGate({ manifest, copy: COPY, overrides, langs, viewports: VIEWPORTS, layout, measure, epsilon: eps, calmOf, ctx, only });
  return { rows, failed: failures(rows), epsilon: eps, calibration: cal, shaper, layout };
}

export { OVERFLOW, COPY, VIEWPORTS, MANIFEST };
