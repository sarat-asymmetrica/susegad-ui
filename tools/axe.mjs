// Accessibility check with axe-core, WCAG 2.2 AA, in every register and both themes.
//
//   node tools/axe.mjs --scene kolam [--seed 3] [--content] [--param k=v]
//   node tools/axe.mjs --url /apps/docs/index.html
//
//   --register R / --theme T   check one register or theme instead of all
//   --phone                    390 px with touch instead of 1280 px desktop
//   --json                     print the full result as JSON
//   --no-js                    check the page as a browser without JavaScript builds it (pages only).
//                              The DOM is built with JS off, then checked in a scripted copy with
//                              the page's scripts and inline handlers removed, so axe can run.
//
// Prints each violation with its rule, impact and the selectors it hit.
// Exits non-zero on any violation, and on a target that never became ready.

import { createRequire } from 'node:module';
import { parseArgs } from './lib/args.mjs';
import { TARGET_SPEC, REGISTERS, THEMES, targetFrom } from './lib/target.mjs';
import { session, openTarget, openNoJsSnapshot, waitReady, PHONE, DESKTOP } from './lib/browser.mjs';

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const SPEC = { ...TARGET_SPEC, phone: 'bool', json: 'bool' };
let parsed;
try { parsed = parseArgs(process.argv.slice(2), SPEC); }
catch (e) { console.error(e.message); process.exit(2); }
const { opts, positional } = parsed;
let base;
try { base = targetFrom(opts, positional); } catch (e) { console.error(e.message); process.exit(2); }
if (!base.scene && !base.url) { console.error('usage: node tools/axe.mjs --scene <name> | --url <path>'); process.exit(2); }

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const axeVersion = createRequire(import.meta.url)('axe-core/package.json').version;
const registers = opts.register ? [opts.register] : REGISTERS;
const themes = opts.theme ? [opts.theme] : THEMES;
const view = opts.phone ? PHONE : DESKTOP;

const s = await session();
const runs = [];
let total = 0, failed = 0;
try {
  for (const register of registers) {
    for (const theme of themes) {
      const t = { ...base, register, theme };
      const run = { register, theme, ready: null, violations: [], incomplete: [], passes: 0 };
      let context, page;
      if (base.noJs) ({ context, page, ready: run.ready } = await openNoJsSnapshot(s, t, view));
      else ({ context, page } = await openTarget(s, t, view));
      try {
        if (!base.noJs) run.ready = await waitReady(page, t);
        await page.addScriptTag({ path: axePath });
        const r = await page.evaluate(async tags => {
          const res = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
          return {
            passes: res.passes.length,
            incomplete: res.incomplete.map(v => v.id),
            violations: res.violations.map(v => ({
              id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
              // A target inside shadow DOM is an array of selectors, host first.
              nodes: v.nodes.map(n => ({ target: n.target.map(x => Array.isArray(x) ? x.join(' >>> ') : x).join(' '), summary: n.failureSummary })),
            })),
          };
        }, WCAG_TAGS);
        Object.assign(run, r);
      } finally {
        await context.close();
      }
      runs.push(run);
      const n = run.violations.length;
      total += n;
      if (n || !run.ready.ok) failed++;
      if (!opts.json) {
        console.log(`${n || !run.ready.ok ? 'FAIL' : 'pass'}  ${register}/${theme}: ${n} violation(s), ${run.incomplete.length ? `to review by hand: ${run.incomplete.join(', ')}` : 'nothing to review by hand'}${run.ready.ok ? '' : `, NOT READY (${run.ready.reason})`}`);
        for (const v of run.violations) {
          console.log(`      ${v.id} [${v.impact}] ${v.help}`);
          for (const node of v.nodes) console.log(`        at ${node.target}`);
        }
      }
    }
  }
} finally {
  await s.done();
}
if (opts.json) {
  console.log(JSON.stringify({ target: base.scene ? { scene: base.scene } : { url: base.url }, axe: axeVersion, tags: WCAG_TAGS, view: opts.phone ? 'phone' : 'desktop', javascript: !base.noJs, runs }, null, 2));
} else {
  console.log(`\naxe-core ${axeVersion}, ${WCAG_TAGS.join(' ')}, ${opts.phone ? 'phone' : 'desktop'}${base.noJs ? ', JavaScript off' : ''}: ${total} violation(s) across ${runs.length} run(s)`);
}
process.exit(failed ? 1 : 0);
