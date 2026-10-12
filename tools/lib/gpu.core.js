// The GPU gate, pure half. A check clause that asserts the live (WebGL) tier, or something only the live
// tier draws, must not run where the product itself would draw in 2D: on a software renderer (SwiftShader,
// llvmpipe: every GitHub runner, and a person without a GPU). Such a clause prints
//   skip  <clause>  (no GPU: <renderer string>)
// and is neither a pass nor a red (RUNBOOK §6: a gate that did not run is "not run"). The decision uses the
// library's own test, isSoftwareRenderer, so a check skips exactly when the product would choose 2D.
//
// SG_FORCE_SOFTWARE_GL=1 makes any renderer count as software, so the skip path can be proved on a machine
// that has a GPU. (It changes what the CHECK decides; the page under test still draws as the machine allows.)
import { isSoftwareRenderer } from '../../packages/stage3d/stage3d.core.js';

export const FORCE_ENV = 'SG_FORCE_SOFTWARE_GL';
export const forcedSoftware = (env = process.env) => env[FORCE_ENV] === '1';

/**
 * @param {{ available?: boolean, renderer?: string }} seen what the probe page read from WebGL2
 * @returns {{ available: boolean, renderer: string, software: boolean, forced: boolean, label: string }}
 *   label: the renderer string for the skip line ("none" with no WebGL; "forced: <renderer>" under the override)
 */
export function decideGpu(seen = {}, { forced = forcedSoftware() } = {}) {
  const available = !!seen.available, renderer = String(seen.renderer ?? '');
  const software = forced || !available || isSoftwareRenderer(renderer);
  const shown = available ? (renderer || 'unknown renderer') : 'none';
  return { available, renderer, software, forced, label: forced ? `forced by ${FORCE_ENV}: ${shown}` : shown };
}

export const skipLine = (clause, gpu) => `skip  ${clause}  (no GPU: ${gpu.label})`;

/** The state a check keeps: skip(clause) prints the line and remembers it; live(clause) is true when the clause may run. */
export function gpuGate(gpu, log = console.log) {
  const skipped = [];
  return {
    gpu, skipped,
    /** true (and the skip line printed) when the clause must not run here */
    skip(clause) { if (!gpu.software) return false; skipped.push(clause); log(skipLine(clause, gpu)); return true; },
    /** the last line of a check: "17 of 17 pass, 5 skipped (no GPU)" (skips are not in the pass count or the total) */
    finalLine(pass, total, extra = '') { return `${pass} of ${total} pass${skipped.length ? `, ${skipped.length} skipped (no GPU)` : ''}${extra}`; },
  };
}

/** From a check's output: the clauses it skipped for want of a GPU, in order. */
export function parseSkips(out) {
  const clauses = [];
  for (const l of String(out).split(/\r?\n/)) {
    const m = /^skip {2}(.*?) {2}\(no GPU: .*\)\s*$/.exec(l);
    if (m) clauses.push(m[1]);
  }
  return clauses;
}
