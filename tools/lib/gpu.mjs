// The GPU gate, browser half: read the renderer string a page would see, and decide (gpu.core.js).
//   const gpu = await probeGpu(browser);        // browser is the one the check launched, with its own flags
//   const gate = gpuGate(gpu);
//   if (!gate.skip('warm: draws on the live tier')) check('warm: draws on the live tier', ...);
//   console.log(gate.finalLine(pass, total));   // "17 of 17 pass, 5 skipped (no GPU)"
// The probe reads WebGL2 the way the library does (stage3d.js webglInfo): WEBGL_debug_renderer_info's
// unmasked renderer, else the plain RENDERER string.
import { decideGpu, gpuGate } from './gpu.core.js';

export { decideGpu, gpuGate, parseSkips, forcedSoftware, skipLine } from './gpu.core.js';

/** @returns {Promise<ReturnType<typeof decideGpu>>} */
export async function probeGpu(browser, opts) {
  let seen = await readRenderer(browser);
  if (!seen.available) seen = await readRenderer(browser); // one retry before answering "none": a context can fail to make once
  return decideGpu(seen, opts);
}

async function readRenderer(browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    return await page.evaluate(() => {
      try {
        const g = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: false });
        if (!g) return { available: false, renderer: '' };
        const ext = g.getExtension('WEBGL_debug_renderer_info');
        const renderer = String(g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER) || '');
        g.getExtension('WEBGL_lose_context')?.loseContext();
        return { available: true, renderer };
      } catch { return { available: false, renderer: '' }; }
    });
  } finally { await context.close(); }
}

/** probeGpu, then the gate, announced once: "GPU: <renderer> (live clauses run | skip)". */
export async function gpuOf(browser, log = console.log) {
  const gpu = await probeGpu(browser);
  // SG_EXPECT_GPU=1 (set on a machine that has a GPU): a software renderer there is a broken driver, not a reason to skip quietly
  if (process.env.SG_EXPECT_GPU === '1' && gpu.software && !gpu.forced) throw new Error(`SG_EXPECT_GPU=1 but the renderer reads as software (${gpu.label}); the live-tier clauses would skip. Fix the GPU or driver, or unset SG_EXPECT_GPU.`);
  log(`GPU: ${gpu.label}${gpu.software ? ' (software: the live-tier clauses will skip)' : ' (hardware: the live-tier clauses run)'}`);
  return gpuGate(gpu, log);
}
